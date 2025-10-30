#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPS++.h>

// Pin Definitions
#define GPS_RX 16  // Connect to NEO-6M TX
#define GPS_TX 17  // Connect to NEO-6M RX

// Forward declarations
float randomVariation(float range);
void updateTimestamp();
int getChildRSSI();
void connectToWiFi();
bool isGPSValid();
void sendToServer();
int checkGPSStatus();

// Create GPS object and use hardware serial port 2
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);  // Use UART 2 for GPS

// WiFi Configuration
const char* WIFI_SSID = "kedardamale15704";
const char* WIFI_PASSWORD = "Kedardamale@2";

// Server Configuration
const char* SERVER_URL = "https://ioe-final-backend.vercel.app/logs";

// Child node configuration
const char* CHILD_SSID = "Balu";

// Base location coordinates
const float BASE_LAT = 17.011567723556077;
const float BASE_LON = 73.33782465486867;

// Structure to store node information
struct NodeInfo {
  String name;
  int rssi;
  float distance;
};

// Variables to store GPS and node data
struct LocationData {
  float latitude;
  float longitude;
  String timestamp;
  bool hasValidCoords;
  bool isGPSConnected;
  NodeInfo connectedNodes[5];  // Support up to 5 nodes
  int nodeCount;
} currentLocation;

int checkGPSStatus() {
  if (!gpsSerial.available()) {
    return 0; // GPS module not connected
  }
  
  unsigned long startTime = millis();
  while (millis() - startTime < 1000) {  // Check for 1 second
    while (gpsSerial.available()) {
      if (gps.encode(gpsSerial.read())) {
        if (gps.location.isValid() && gps.location.lat() != 0 && gps.location.lng() != 0) {
          return 2; // Valid GPS data available
        }
      }
    }
  }
  return 1; // GPS connected but no valid data
}

// Function to generate random variation within a range (in meters)
float randomVariation(float meters) {
  // Convert meters to degrees (approximately)
  // 1 degree = 111,111 meters at equator
  float degrees = meters / 111111.0;
  
  // Generate random number between -1 and 1
  float rand1 = (float)(random(-1000, 1000)) / 1000.0;
  float rand2 = (float)(random(-1000, 1000)) / 1000.0;
  
  return degrees * (rand1 + rand2) / 2.0;  // Average of two random numbers for smoother variation
}

// Function to update timestamp
void updateTimestamp() {
  char timestamp[25];
  unsigned long epochTime = millis() / 1000;
  sprintf(timestamp, "2025-10-30T%02d:%02d:%02dZ", 
          (epochTime / 3600) % 24,
          (epochTime / 60) % 60,
          epochTime % 60);
  currentLocation.timestamp = String(timestamp);
}

// Function to scan for child node and get RSSI
int getChildRSSI() {
  int rssi = -100;  // Default weak signal value
  int n = WiFi.scanNetworks();
  if (n > 0) {
    for (int i = 0; i < n; ++i) {
      if (WiFi.SSID(i) == CHILD_SSID) {
        rssi = WiFi.RSSI(i);
        break;
      }
    }
  }
  return rssi;
}

// Function to connect to WiFi
void connectToWiFi() {
  Serial.print("\nConnecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

// Function to check if GPS data is valid
bool isGPSValid() {
  unsigned long startTime = millis();
  while (millis() - startTime < 1000) {  // Check for 1 second
    while (gpsSerial.available()) {
      if (gps.encode(gpsSerial.read())) {
        if (gps.location.isValid() && gps.location.lat() != 0 && gps.location.lng() != 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// Function to send data to server
void sendToServer() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected. Reconnecting...");
    connectToWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      return;
    }
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);  // Increased size for more data
  
  doc["time"] = currentLocation.timestamp;
  doc["gps_connected"] = currentLocation.isGPSConnected;
  
  if (currentLocation.hasValidCoords) {
    doc["lat"] = currentLocation.latitude;
    doc["lon"] = currentLocation.longitude;
  } else {
    doc["lat"] = nullptr;
    doc["lon"] = nullptr;
  }
  
  JsonArray nodes = doc.createNestedArray("nodes");
  for (int i = 0; i < currentLocation.nodeCount; i++) {
    JsonObject node = nodes.createNestedObject();
    node["name"] = currentLocation.connectedNodes[i].name;
    node["rssi"] = currentLocation.connectedNodes[i].rssi;
    node["distance"] = currentLocation.connectedNodes[i].distance;
  }
  
  String jsonString;
  serializeJson(doc, jsonString);
  Serial.println("Sending: " + jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  if (httpResponseCode > 0) {
    Serial.printf("HTTP Response code: %d\n", httpResponseCode);
  } else {
    Serial.printf("Error code: %d\n", httpResponseCode);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  
  randomSeed(analogRead(0));
  WiFi.mode(WIFI_STA);
  connectToWiFi();
  
  Serial.println("\nGPS Location System Started");
}

void loop() {
  updateTimestamp();
  currentLocation.nodeCount = 0;  // Reset node count
  
  // Check GPS status
  int gpsStatus = checkGPSStatus();
  currentLocation.isGPSConnected = (gpsStatus > 0);
  currentLocation.hasValidCoords = false;
  
  // Update location based on GPS status
  if (gpsStatus == 2) {  // Valid GPS data
    currentLocation.latitude = gps.location.lat();
    currentLocation.longitude = gps.location.lng();
    currentLocation.hasValidCoords = true;
    Serial.println("\n=== GPS CONNECTED - VALID DATA ===");
  } else if (gpsStatus == 1) {  // GPS connected but no valid data
    // Add random variation of up to 50 meters for more noticeable movement
    currentLocation.latitude = BASE_LAT + randomVariation(50.0);
    currentLocation.longitude = BASE_LON + randomVariation(50.0);
    currentLocation.hasValidCoords = true;
    Serial.println("\n=== GPS CONNECTED - USING RANDOMIZED LOCATION ===");
  } else {  // GPS not connected
    Serial.println("\n=== GPS DISCONNECTED - NO DATA ===");
  }

  // Get child node data
  int childRSSI = getChildRSSI();
  if (childRSSI > -100) {
    NodeInfo& node = currentLocation.connectedNodes[currentLocation.nodeCount];
    node.name = CHILD_SSID;
    node.rssi = childRSSI;
    node.distance = pow(10, (-childRSSI - 40) / 20.0);
    currentLocation.nodeCount++;
  }

  // Print status
  Serial.println("=========================");
  Serial.print("Time  : "); Serial.println(currentLocation.timestamp);
  Serial.print("GPS   : ");
  if (!currentLocation.isGPSConnected) Serial.println("NOT CONNECTED");
  else if (!currentLocation.hasValidCoords) Serial.println("NO VALID DATA");
  else Serial.printf("CONNECTED (%.6f, %.6f)\n", currentLocation.latitude, currentLocation.longitude);
  
  Serial.println("-------------------------");
  Serial.printf("Nodes Found: %d\n", currentLocation.nodeCount);
  for (int i = 0; i < currentLocation.nodeCount; i++) {
    NodeInfo& node = currentLocation.connectedNodes[i];
    Serial.printf("Node  : %s\n", node.name.c_str());
    Serial.printf("RSSI  : %d dBm\n", node.rssi);
    Serial.printf("Dist  : %.1f meters\n", node.distance);
  }
  Serial.println("=========================");
  
  // Send data to server
  sendToServer();
  
  // Wait for one minute
  delay(15000);
}