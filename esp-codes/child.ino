/*
 * Child Device Code - Creates WiFi Hotspot for Proximity Detection
 * Converted from BLE beacon to WiFi hotspot approach
 * Change BEACON_NAME for each device (CHILD_1, CHILD_2, etc.)
 */

#include <WiFi.h>

// CHANGE THIS FOR EACH CHILD DEVICE
#define BEACON_NAME "CHILD_1"   // Change to CHILD_2, CHILD_3, etc.
#define BUILTIN_LED 2          // Built-in LED pin

// WiFi hotspot configuration
const char* ap_ssid = BEACON_NAME;
const char* ap_password = "";      // No password for easier detection
const int wifi_channel = 6;       // WiFi channel (1-13)
const bool hidden_network = false; // Keep visible for detection

void setup() {
  // Setup built-in LED
  pinMode(BUILTIN_LED, OUTPUT);
  digitalWrite(BUILTIN_LED, LOW);
  
  Serial.begin(115200);
  Serial.println("📡 Starting WiFi beacon: " + String(BEACON_NAME));
  
  // Create WiFi Access Point (hotspot)
  WiFi.mode(WIFI_AP);
  
  // Start the hotspot
  bool success = WiFi.softAP(ap_ssid, ap_password, wifi_channel, hidden_network, 1);
  
  if (success) {
    Serial.println("✅ WiFi hotspot created successfully!");
    Serial.println("📶 Network Name: " + String(ap_ssid));
    Serial.print("📍 IP Address: ");
    Serial.println(WiFi.softAPIP());
    Serial.print("📊 Channel: ");
    Serial.println(wifi_channel);
    
    // Turn on LED to indicate beacon is running
    digitalWrite(BUILTIN_LED, HIGH);
    
    // Blink LED 3 times to show successful start
    for(int i = 0; i < 3; i++) {
      digitalWrite(BUILTIN_LED, LOW);
      delay(200);
      digitalWrite(BUILTIN_LED, HIGH);
      delay(200);
    }
  } else {
    Serial.println("❌ Failed to create WiFi hotspot!");
    // Blink LED rapidly to show error
    while(true) {
      digitalWrite(BUILTIN_LED, HIGH);
      delay(100);
      digitalWrite(BUILTIN_LED, LOW);
      delay(100);
    }
  }
}

void loop() {
  static unsigned long lastStatusPrint = 0;
  static bool ledState = true;
  
  unsigned long currentTime = millis();
  
  // Print status every 10 seconds
  if (currentTime - lastStatusPrint >= 10000) {
    Serial.printf("📊 %s - Uptime: %lu sec, Clients: %d\n", 
                  BEACON_NAME, currentTime/1000, WiFi.softAPgetStationNum());
    lastStatusPrint = currentTime;
  }
  
  // Slow blink LED every 2 seconds to show device is active
  static unsigned long lastBlink = 0;
  if (currentTime - lastBlink >= 2000) {
    ledState = !ledState;
    digitalWrite(BUILTIN_LED, ledState);
    lastBlink = currentTime;
  }
  
  // Small delay to prevent watchdog issues
  delay(100);
}