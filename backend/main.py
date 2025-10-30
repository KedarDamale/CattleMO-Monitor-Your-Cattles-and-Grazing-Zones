from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import os
from pymongo import MongoClient
from bson import ObjectId
from pymongo import ReturnDocument
import math
from pymongo.errors import ConnectionFailure
from typing import List, Optional, Any, Dict
from dotenv import load_dotenv
load_dotenv()

# Optional: clustering
try:
    import numpy as np
    from sklearn.cluster import DBSCAN
except Exception:
    np = None
    DBSCAN = None


def get_env_mongo_uri() -> str:
    return os.getenv("MONGODB_URI")


def create_mongo_client() -> MongoClient:
    uri = get_env_mongo_uri()
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print(f"✅ Connected to MongoDB successfully. {uri}")
        return client
    except ConnectionFailure as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise


app = Flask(__name__)
CORS(app)

# Mongo setup
mongo_client = create_mongo_client()
db = mongo_client.get_database("ioe_project")
logs_col = db.get_collection("logs")
logs_null_gps_col = db.get_collection("logs_null_gps")
animals_col = db.get_collection("animals")


def parse_timestamp(ts: str) -> datetime:
    for fmt in (
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(ts, fmt)
        except Exception:
            pass
    try:
        return datetime.fromisoformat(ts)
    except Exception:
        return datetime.utcnow()


def validate_log_payload(data: dict) -> tuple[bool, Optional[str]]:
    """Validate log payload data"""
    if not isinstance(data.get('time'), str) or not data.get('time'):
        return False, "time must be a non-empty string"
    if 'gps_connected' not in data:
        return False, "gps_connected is required"
    if 'nodes' in data and not isinstance(data['nodes'], list):
        return False, "nodes must be a list"
    return True, None


def validate_animal_create(data: dict) -> tuple[bool, Optional[str]]:
    """Validate animal creation data"""
    if not data.get('name'):
        return False, "name is required"
    if 'age' in data and data['age'] is not None and data['age'] < 0:
        return False, "age must be non-negative"
    return True, None


@app.route("/logs", methods=["POST"])
def ingest_logs():
    """Receive ESP32 logs"""
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"error": "Invalid JSON"}), 400
        
        is_valid, error = validate_log_payload(payload)
        if not is_valid:
            return jsonify({"error": error}), 400
        
        doc = {
            "time": payload['time'],
            "time_parsed": parse_timestamp(payload['time']),
            "gps_connected": payload['gps_connected'],
            "lat": payload.get('lat'),
            "lon": payload.get('lon'),
            "nodes": payload.get('nodes', []),
            "node_count": len(payload.get('nodes', [])),
        }
        
        if payload.get('lat') is None or payload.get('lon') is None:
            inserted = logs_null_gps_col.insert_one(doc)
            return jsonify({
                "status": "ok",
                "stored_in": "logs_null_gps",
                "id": str(inserted.inserted_id)
            })
        else:
            inserted = logs_col.insert_one(doc)
            return jsonify({
                "status": "ok",
                "stored_in": "logs",
                "id": str(inserted.inserted_id)
            })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/logs", methods=["GET"])
def list_logs():
    """Return recent valid GPS logs"""
    try:
        limit = request.args.get('limit', default=200, type=int)
        limit = max(1, min(limit, 5000))
        
        items = []
        for d in logs_col.find({"lat": {"$ne": None}, "lon": {"$ne": None}}).sort("time_parsed", -1).limit(limit):
            d["_id"] = str(d["_id"])
            items.append(d)
        
        return jsonify({"count": len(items), "items": items})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def to_radians(coords: List[List[float]]):
    return [[math.radians(lat), math.radians(lon)] for lat, lon in coords]


def compute_cluster_bounding_boxes(cluster_labels: List[int], coords: List[List[float]]):
    clusters: Dict[int, Dict[str, float]] = {}
    for label, (lat, lon) in zip(cluster_labels, coords):
        if label == -1:
            continue
        if label not in clusters:
            clusters[label] = {"minLat": lat, "maxLat": lat, "minLon": lon, "maxLon": lon}
        else:
            clusters[label]["minLat"] = min(clusters[label]["minLat"], lat)
            clusters[label]["maxLat"] = max(clusters[label]["maxLat"], lat)
            clusters[label]["minLon"] = min(clusters[label]["minLon"], lon)
            clusters[label]["maxLon"] = max(clusters[label]["maxLon"], lon)
    
    result = []
    for label, box in clusters.items():
        corners = [
            {"lat": box["minLat"], "lon": box["minLon"]},
            {"lat": box["minLat"], "lon": box["maxLon"]},
            {"lat": box["maxLat"], "lon": box["maxLon"]},
            {"lat": box["maxLat"], "lon": box["minLon"]},
        ]
        result.append({"cluster": int(label), "corners": corners, "bbox": box})
    return result


@app.route("/clusters", methods=["GET"])
def get_clusters():
    """Compute GPS clusters from MongoDB logs"""
    try:
        if np is None or DBSCAN is None:
            return jsonify({"error": "scikit-learn/numpy not installed"}), 500

        eps_meters = request.args.get('eps_meters', 50.0, type=float)
        min_samples = request.args.get('min_samples', 10, type=int)
        mode = request.args.get('mode', 'geo', type=str)

        mongo_query = {"lat": {"$ne": None}, "lon": {"$ne": None}}
        date_str = request.args.get('date')
        if date_str:
            day = datetime.strptime(date_str, "%Y-%m-%d")
            start = day
            end = day.replace(hour=23, minute=59, second=59)
            mongo_query["time_parsed"] = {"$gte": start, "$lte": end}

        cursor = logs_col.find(mongo_query, {"lat": 1, "lon": 1, "_id": 0})
        points = [[float(d["lat"]), float(d["lon"])] for d in cursor if d.get("lat") and d.get("lon")]
        if not points:
            return jsonify({"clusters": [], "count": 0})

        if mode == "geo":
            coords = np.radians(points)
            eps = eps_meters / 6371000.0
            model = DBSCAN(eps=eps, min_samples=min_samples, metric="haversine")
            labels = model.fit_predict(coords)
            boxes = compute_cluster_bounding_boxes(labels.tolist(), points)
        else:
            return jsonify({"error": "Unsupported mode"}), 400

        return jsonify({"mode": mode, "clusters": boxes, "count": len(boxes)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/animals", methods=["POST"])
def create_animal():
    """Create a new animal"""
    try:
        payload = request.get_json()
        if not payload:
            return jsonify({"error": "Invalid JSON"}), 400
        
        is_valid, error = validate_animal_create(payload)
        if not is_valid:
            return jsonify({"error": error}), 400
        
        doc = {
            "name": payload['name'],
            "node_name": payload.get('node_name'),
            "photo_base64": payload.get('photo_base64'),
            "age": payload.get('age'),
            "description": payload.get('description'),
            "milk_yield_timeseries": []
        }
        
        series = []
        for e in payload.get("milk_yield_timeseries", []):
            date_obj = e.get('date')
            if isinstance(date_obj, str):
                date_obj = datetime.fromisoformat(date_obj.replace('Z', '+00:00'))
            series.append({
                "date": date_obj.isoformat() if isinstance(date_obj, datetime) else date_obj,
                "morning_liters": e.get('morning_liters', 0),
                "evening_liters": e.get('evening_liters', 0),
            })
        doc["milk_yield_timeseries"] = series
        
        res = animals_col.insert_one(doc)
        saved = animals_col.find_one({"_id": res.inserted_id})
        saved["_id"] = str(saved["_id"])
        return jsonify(saved), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/animals", methods=["GET"])
def list_animals():
    """List all animals"""
    try:
        results = []
        for a in animals_col.find():
            a["_id"] = str(a["_id"])
            results.append(a)
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/animals/<animal_id>", methods=["GET"])
def get_animal(animal_id: str):
    """Get a specific animal by ID"""
    try:
        if not ObjectId.is_valid(animal_id):
            return jsonify({"error": "Invalid animal id"}), 400
        
        a = animals_col.find_one({"_id": ObjectId(animal_id)})
        if not a:
            return jsonify({"error": "Animal not found"}), 404
        
        a["_id"] = str(a["_id"])
        return jsonify(a)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/animals/<animal_id>", methods=["PUT"])
def update_animal(animal_id: str):
    """Update an animal"""
    try:
        if not ObjectId.is_valid(animal_id):
            return jsonify({"error": "Invalid animal id"}), 400
        
        payload = request.get_json()
        if not payload:
            return jsonify({"error": "Invalid JSON"}), 400
        
        update_doc: Dict[str, Any] = {}
        
        if "milk_yield_timeseries" in payload and payload["milk_yield_timeseries"] is not None:
            series = []
            for e in payload["milk_yield_timeseries"]:
                date_obj = e.get('date')
                if isinstance(date_obj, str):
                    date_obj = datetime.fromisoformat(date_obj.replace('Z', '+00:00'))
                series.append({
                    "date": date_obj.isoformat() if isinstance(date_obj, datetime) else date_obj,
                    "morning_liters": e.get('morning_liters', 0),
                    "evening_liters": e.get('evening_liters', 0),
                })
            update_doc["milk_yield_timeseries"] = series
        
        for key in ['name', 'node_name', 'photo_base64', 'age', 'description']:
            if key in payload:
                update_doc[key] = payload[key]
        
        res = animals_col.find_one_and_update(
            {"_id": ObjectId(animal_id)},
            {"$set": update_doc},
            return_document=ReturnDocument.AFTER
        )
        
        if not res:
            return jsonify({"error": "Animal not found"}), 404
        
        res["_id"] = str(res["_id"])
        return jsonify(res)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/animals/<animal_id>", methods=["DELETE"])
def delete_animal(animal_id: str):
    """Delete an animal"""
    try:
        if not ObjectId.is_valid(animal_id):
            return jsonify({"error": "Invalid animal id"}), 400
        
        res = animals_col.delete_one({"_id": ObjectId(animal_id)})
        if res.deleted_count == 0:
            return jsonify({"error": "Animal not found"}), 404
        
        return jsonify({"status": "deleted", "id": animal_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analytics/milk", methods=["GET"])
def milk_analytics():
    """Returns analytics over milk yields"""
    try:
        animals = list(animals_col.find())
        per_animal = []
        overall_morning = 0.0
        overall_evening = 0.0
        overall_days = 0
        
        for a in animals:
            series = a.get("milk_yield_timeseries", [])
            if not series:
                continue
            morning_sum = sum((e.get("morning_liters") or 0) for e in series)
            evening_sum = sum((e.get("evening_liters") or 0) for e in series)
            count = len(series)
            per_animal.append({
                "animal_id": str(a["_id"]),
                "name": a.get("name"),
                "avg_morning_liters": morning_sum / count if count else 0.0,
                "avg_evening_liters": evening_sum / count if count else 0.0,
                "avg_total_liters": (morning_sum + evening_sum) / count if count else 0.0,
                "days": count,
            })
            overall_morning += morning_sum
            overall_evening += evening_sum
            overall_days += count
        
        overall = {
            "total_morning_liters": overall_morning,
            "total_evening_liters": overall_evening,
            "total_liters": overall_morning + overall_evening,
            "avg_morning_per_day": (overall_morning / overall_days) if overall_days else 0.0,
            "avg_evening_per_day": (overall_evening / overall_days) if overall_days else 0.0,
            "avg_total_per_day": ((overall_morning + overall_evening) / overall_days) if overall_days else 0.0,
        }
        
        return jsonify({"per_animal": per_animal, "overall": overall})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/", methods=["GET"])
def home():
    """Home endpoint"""
    return jsonify({"message": "Server is running successfully","db": get_env_mongo_uri()})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)