/******************************************************
 *  PRODUCTION-READY ESP32 IoT CLIENT
 ******************************************************/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Update.h>
#include <ArduinoOTA.h>
#include <BluetoothSerial.h>

/************ CONFIGURATION ************/

#define DEVICE_ID "esp32device1"
#define RELAY_PIN 5
#define LED_PIN 2

const char* WIFI_SSIDS[] = {"KK", "JioFiber-5GMMs"};
const char* WIFI_PASSWORDS[] = {"qwerty63", "12345678"};
const int WIFI_COUNT = 2;

const char* PROXY_BASE = "http://YOUR_PROXY_URL";

/************ GLOBALS ************/

BluetoothSerial SerialBT;

unsigned long lastPoll = 0;
unsigned long lastHealth = 0;

/******************************************************
 * LOG SERVICE
 ******************************************************/
void pushLog(String message) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(PROXY_BASE) + "/device/log");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["log"] = message;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code <= 0) {
    Serial.println("Log HTTP error");
  }

  http.end();
}

/******************************************************
 * WIFI MANAGER (Strongest Network Auto)
 ******************************************************/
void connectToStrongestWiFi() {
  Serial.println("Scanning WiFi...");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);

  int n = WiFi.scanNetworks();
  int bestRSSI = -9999;
  int bestIndex = -1;

  for (int i = 0; i < n; i++) {
    for (int j = 0; j < WIFI_COUNT; j++) {
      if (WiFi.SSID(i) == WIFI_SSIDS[j]) {
        if (WiFi.RSSI(i) > bestRSSI) {
          bestRSSI = WiFi.RSSI(i);
          bestIndex = j;
        }
      }
    }
  }

  if (bestIndex >= 0) {
    Serial.println("Connecting to: " + String(WIFI_SSIDS[bestIndex]));
    WiFi.begin(WIFI_SSIDS[bestIndex], WIFI_PASSWORDS[bestIndex]);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
      delay(500);
      Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nConnected!");
      pushLog("Connected to WiFi: " + String(WIFI_SSIDS[bestIndex]));
    } else {
      Serial.println("\nWiFi connection failed");
    }
  } else {
    Serial.println("No known WiFi found");
  }
}

/******************************************************
 * HEALTH SERVICE
 ******************************************************/
void sendHealth() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(PROXY_BASE) + "/device/health");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["heap"] = ESP.getFreeHeap();
  doc["uptime"] = millis();

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code <= 0) {
    Serial.println("Health HTTP error");
  }

  http.end();
}

/******************************************************
 * REPORT RESULT
 ******************************************************/
void reportResult(String action, String result) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(PROXY_BASE) + "/device/report");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["action"] = action;
  doc["result"] = result;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code <= 0) {
    Serial.println("Report HTTP error");
  }

  http.end();
}

/******************************************************
 * OTA SERVICE (HTTP)
 ******************************************************/
void performOTA(String firmwareURL) {
  if (WiFi.status() != WL_CONNECTED) return;

  pushLog("Starting OTA...");

  HTTPClient http;
  http.begin(firmwareURL);

  int code = http.GET();
  if (code == 200) {

    int len = http.getSize();
    WiFiClient * stream = http.getStreamPtr();

    if (!Update.begin(len)) {
      pushLog("OTA Begin Failed");
      http.end();
      return;
    }

    size_t written = Update.writeStream(*stream);

    if (written != len) {
      pushLog("OTA Write Failed");
      http.end();
      return;
    }

    if (Update.end()) {
      if (Update.isFinished()) {
        pushLog("OTA Success. Rebooting...");
        delay(1000);
        ESP.restart();
      } else {
        pushLog("OTA not finished");
      }
    } else {
      pushLog("OTA End Failed");
    }

  } else {
    pushLog("OTA HTTP Failed");
  }

  http.end();
}

/******************************************************
 * DEVICE CONTROLLER
 ******************************************************/
void executeCommand(String action, JsonObject payload) {

  if (action == "relay_on") {
    digitalWrite(RELAY_PIN, HIGH);
  }
  else if (action == "relay_off") {
    digitalWrite(RELAY_PIN, LOW);
  }
  else if (action == "led_toggle") {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
  else if (action == "ota_update") {
    if (payload.containsKey("url")) {
      String url = payload["url"].as<String>();
      performOTA(url);
    }
  }
}

/******************************************************
 * LONG POLLING CLIENT
 ******************************************************/
void pollProxy() {

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(35000);
  http.begin(String(PROXY_BASE) + "/device/commands?device_id=" + DEVICE_ID);

  int code = http.GET();

  if (code == 200) {

    String payload = http.getString();

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, payload);

    if (!err && doc.containsKey("action")) {

      String action = doc["action"].as<String>();

      JsonObject data;
      if (doc.containsKey("payload")) {
        data = doc["payload"].as<JsonObject>();
      }

      if (action != "none") {
        executeCommand(action, data);
        reportResult(action, "success");
      }
    }
  } else {
    Serial.println("Poll HTTP error");
  }

  http.end();
}

/******************************************************
 * BLUETOOTH SERVICE
 ******************************************************/
void setupBluetooth() {
  SerialBT.begin("ESP32_BT");
  pushLog("Bluetooth started");
}

/******************************************************
 * ARDUINO OTA
 ******************************************************/
void setupOTA() {
  ArduinoOTA.setHostname(DEVICE_ID);
  ArduinoOTA.begin();
}

/******************************************************
 * SETUP
 ******************************************************/
void setup() {

  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);

  connectToStrongestWiFi();
  setupBluetooth();
  setupOTA();

  sendHealth();
}

/******************************************************
 * LOOP
 ******************************************************/
void loop() {

  ArduinoOTA.handle();

  // Auto reconnect WiFi
  if (WiFi.status() != WL_CONNECTED) {
    connectToStrongestWiFi();
  }

  // Poll every 3 seconds
  if (millis() - lastPoll > 3000) {
    pollProxy();
    lastPoll = millis();
  }

  // Send health every 60 seconds
  if (millis() - lastHealth > 60000) {
    sendHealth();
    lastHealth = millis();
  }

  // Bluetooth logging
  if (SerialBT.available()) {
    String cmd = SerialBT.readString();
    pushLog("BT Command: " + cmd);
  }
}
