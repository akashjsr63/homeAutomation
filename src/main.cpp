/******************************************************
 *  PRODUCTION-READY ESP32 IoT CLIENT
 ******************************************************/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Update.h>
#include <ArduinoOTA.h>

/************ CONFIGURATION ************/

#define DEVICE_ID "esp32device1"
#define RELAY_PIN 5
#define LED_PIN 2

const char* WIFI_SSIDS[] = {"KK", "JioFiber-5GMMs"};
const char* WIFI_PASSWORDS[] = {"qwerty63", "12345678"};
const int WIFI_COUNT = 2;

const char* PROXY_BASE = "https://homeautomation-6446.onrender.com";

/************ GLOBALS ************/

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

  http.POST(body);
  http.end();
}

/******************************************************
 * WIFI MANAGER
 ******************************************************/
void connectToStrongestWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(100);

  int n = WiFi.scanNetworks();
  int bestRSSI = -9999;
  int bestIndex = -1;

  for (int i = 0; i < n; i++) {
    for (int j = 0; j < WIFI_COUNT; j++) {
      if (WiFi.SSID(i) == WIFI_SSIDS[j] && WiFi.RSSI(i) > bestRSSI) {
        bestRSSI = WiFi.RSSI(i);
        bestIndex = j;
      }
    }
  }

  if (bestIndex >= 0) {
    WiFi.begin(WIFI_SSIDS[bestIndex], WIFI_PASSWORDS[bestIndex]);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
      delay(500);
    }

    if (WiFi.status() == WL_CONNECTED) {
      pushLog("Connected to WiFi: " + String(WIFI_SSIDS[bestIndex]));
    }
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

  http.POST(body);
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

  http.POST(body);
  http.end();
}

/******************************************************
 * OTA SERVICE (HTTPS + Redirect Fix)
 ******************************************************/
void performOTA(String firmwareURL) {
  if (WiFi.status() != WL_CONNECTED) {
    pushLog("OTA failed: WiFi not connected");
    return;
  }

  pushLog("Starting OTA from: " + firmwareURL);

  WiFiClientSecure client;
  client.setInsecure();  // Skip certificate validation

  HTTPClient http;
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.begin(client, firmwareURL);
  http.setTimeout(30000);

  int code = http.GET();

  if (code == HTTP_CODE_OK) {

    int len = http.getSize();
    WiFiClient *stream = http.getStreamPtr();

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

    if (!Update.end() || !Update.isFinished()) {
      pushLog("OTA End Failed");
      http.end();
      return;
    }

    pushLog("OTA Success. Rebooting...");
    delay(2000);
    ESP.restart();

  } else {
    pushLog("OTA HTTP Failed. Code: " + String(code));
  }

  http.end();
}

/******************************************************
 * DEVICE CONTROLLER
 ******************************************************/
void executeCommand(String action, JsonObject payload) {

  pushLog("Executing: " + action);

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
      performOTA(payload["url"].as<String>());
      return;
    }
  }

  reportResult(action, "success");
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
    if (!deserializeJson(doc, payload) && doc.containsKey("action")) {

      String action = doc["action"].as<String>();
      JsonObject data = doc["payload"].as<JsonObject>();

      if (action != "none") {
        executeCommand(action, data);
      }
    }
  }

  http.end();
}

/******************************************************
 * ARDUINO OTA (LOCAL IDE OTA)
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
  setupOTA();
  sendHealth();
}

/******************************************************
 * LOOP
 ******************************************************/
void loop() {

  ArduinoOTA.handle();

  if (WiFi.status() != WL_CONNECTED) {
    connectToStrongestWiFi();
  }

  if (millis() - lastPoll > 3000) {
    pollProxy();
    lastPoll = millis();
  }

  if (millis() - lastHealth > 60000) {
    sendHealth();
    lastHealth = millis();
  }
}
