"use client";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";

type Corner = { lat: number; lon: number };
type BBox = { minLat: number; minLon: number; maxLat: number; maxLon: number };
type Cluster = { cluster: number; corners: Corner[]; bbox?: BBox };

export default function MapZonesInner({ clusters, center }: { clusters: Cluster[]; center: [number, number] | number[] }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Stable per-mount key
  const [mapKey] = useState(() => `map-${Date.now()}-${Math.random()}`);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonsLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!mapDivRef.current) return;
    if (mapRef.current) return;
    const [lat, lon] = center as any;
    const map = L.map(mapDivRef.current).setView([lat, lon], 14);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
    polygonsLayerRef.current = L.layerGroup().addTo(map);
    const onResize = () => requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener("resize", onResize);
    // Initial size fix for mobile after first render
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [ready, center]);

  useEffect(() => {
    const layer = polygonsLayerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    clusters.forEach((c) => {
      const latlngs = c.corners.map((p) => [p.lat, p.lon]) as any;
      L.polygon(latlngs, { color: "#22c55e", weight: 3, fillColor: "#22c55e", fillOpacity: 0.25 }).addTo(layer);
      c.corners.forEach((p) => {
        L.circleMarker([p.lat, p.lon], { radius: 3, color: "#22c55e", weight: 2, fillOpacity: 1 }).addTo(layer);
      });
    });
    if (clusters.length > 0) {
      const all = clusters.flatMap((c) => c.corners.map((p) => L.latLng(p.lat, p.lon)));
      const bounds = L.latLngBounds(all as any);
      map.invalidateSize();
      map.fitBounds(bounds.pad(0.2));
    }
  }, [clusters, ready]);

  if (!ready) return <div style={{ height: "100%", width: "100%" }} />;

  return <div key={mapKey} ref={mapDivRef} style={{ height: "100%", width: "100%" }} />;
}


