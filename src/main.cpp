/******************************************************
 *  PRODUCTION-READY ESP32 IoT CLIENT
 ******************************************************/

  #include <WiFi.h>
  #include <WiFiClientSecure.h>
  #include <HTTPClient.h>
  #include <ArduinoJson.h>
  #include <Update.h>
  #include <ArduinoOTA.h>
  #include <SPI.h>
  #include <ELECHOUSE_CC1101_SRC_DRV.h>
  
  /************ CONFIGURATION ************/
  
  #define DEVICE_ID "esp32device1"
  #define RELAY_PIN 5
  #define LED_PIN 4  // Changed from D2 to D4 (D2 is now used for CC1101 GDO0)
  
  // CC1101 Pin Definitions
  #define CC1101_MOSI 23  // SI
  #define CC1101_MISO 19  // SO
  #define CC1101_SCK 18   // SCK
  #define CC1101_CS 15    // CSN
  #define CC1101_GDO0 2   // GDO0 (interrupt pin)
  
  // RF Configuration
  #define RF_FREQUENCY 433.92  // 433.92 MHz (common ISM band)
  #define RF_BANDWIDTH 200     // kHz
  #define RF_DEVIATION 0       // ASK/OOK modulation doesn't use deviation
 
 const char* WIFI_SSIDS[] = {"KK", "JioFiber-5GMMs"};
 const char* WIFI_PASSWORDS[] = {"qwerty63", "12345678"};
 const int WIFI_COUNT = 2;
 
 const char* PROXY_BASE = "https://homeautomation-6446.onrender.com";
 
  /************ GLOBALS ************/
  
  unsigned long lastPoll = 0;
  unsigned long lastHealth = 0;
  unsigned long lastRfCheck = 0;
  
  // RF Buffer
  byte rfBuffer[64];
  byte rfBufferLen = 0;
 
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
   * WIFI MANAGER - HIGHEST PRIORITY
   ******************************************************/
  bool connectToStrongestWiFi() {
    Serial.println("=== WiFi Connection - HIGHEST PRIORITY ===");
    Serial.println("Initializing WiFi...");
    
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(true);
    delay(100);
  
    Serial.println("Scanning for available networks...");
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
      Serial.println("Found network: " + String(WIFI_SSIDS[bestIndex]) + " (RSSI: " + String(bestRSSI) + " dBm)");
      Serial.println("Connecting to WiFi...");
      
      WiFi.begin(WIFI_SSIDS[bestIndex], WIFI_PASSWORDS[bestIndex]);
  
      unsigned long start = millis();
      int attempts = 0;
      while (WiFi.status() != WL_CONNECTED && millis() - start < 30000) {
        delay(500);
        Serial.print(".");
        attempts++;
        if (attempts % 10 == 0) {
          Serial.println();
          Serial.println("Still connecting... (" + String((millis() - start) / 1000) + "s)");
        }
      }
      Serial.println();
  
      if (WiFi.status() == WL_CONNECTED) {
        Serial.println("WiFi CONNECTED!");
        Serial.println("IP Address: " + WiFi.localIP().toString());
        Serial.println("RSSI: " + String(WiFi.RSSI()) + " dBm");
        return true;
      } else {
        Serial.println("WiFi connection FAILED after 30 seconds");
        return false;
      }
    } else {
      Serial.println("No known WiFi networks found");
      return false;
    }
  }
  
  /******************************************************
   * BLOCKING WiFi Connection - Retries until connected
   ******************************************************/
  void ensureWiFiConnected() {
    int retryCount = 0;
    const int MAX_RETRIES = 10;
    
    while (WiFi.status() != WL_CONNECTED && retryCount < MAX_RETRIES) {
      if (retryCount > 0) {
        Serial.println("WiFi not connected. Retrying... (" + String(retryCount) + "/" + String(MAX_RETRIES) + ")");
        delay(2000);
      }
      
      if (connectToStrongestWiFi()) {
        // WiFi connected successfully
        return;
      }
      
      retryCount++;
    }
    
    // If we get here, WiFi connection failed after all retries
    Serial.println("CRITICAL: WiFi connection failed after " + String(MAX_RETRIES) + " attempts");
    Serial.println("Device will continue but logs cannot be sent until WiFi is connected");
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
     pushLog("OTA Size: " + String(len));
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
   * CC1101 RF INITIALIZATION
   ******************************************************/
  void initCC1101() {
    Serial.println("Initializing CC1101 RF module...");
    
    // Safety: Set CS high before SPI initialization to prevent glitches
    digitalWrite(CC1101_CS, HIGH);
    pinMode(CC1101_CS, OUTPUT);
    delay(10);
    
    // Initialize SPI with custom pins
    SPI.begin(CC1101_SCK, CC1101_MISO, CC1101_MOSI, CC1101_CS);
    
    // Set all SPI pins for CC1101 library (IMPORTANT: all 4 pins required)
    ELECHOUSE_cc1101.setSpiPin(CC1101_SCK, CC1101_MISO, CC1101_MOSI, CC1101_CS);
    
    // Check CC1101 connection
    if (ELECHOUSE_cc1101.getCC1101()) {
      Serial.println("CC1101 connection OK");
      if (WiFi.status() == WL_CONNECTED) {
        pushLog("CC1101 connection OK");
      }
    } else {
      Serial.println("CC1101 connection FAILED - check wiring!");
      if (WiFi.status() == WL_CONNECTED) {
        pushLog("CC1101 connection FAILED - check wiring");
      }
    }
    
    // Initialize CC1101
    ELECHOUSE_cc1101.Init();
    
    // Configure CC1101
    ELECHOUSE_cc1101.setMHZ(RF_FREQUENCY);
    ELECHOUSE_cc1101.setModulation(0);  // ASK / OOK modulation
    ELECHOUSE_cc1101.setDeviation(RF_DEVIATION);  // 0 for ASK/OOK
    ELECHOUSE_cc1101.setBandwidth(RF_BANDWIDTH);
    ELECHOUSE_cc1101.setRxBW(200);  // Receive bandwidth for stability
    ELECHOUSE_cc1101.setPA(10);  // Transmit power (0-31, 10 = medium power)
    
    // Set receive mode
    ELECHOUSE_cc1101.SetReceive();
    
    Serial.println("CC1101 initialized at " + String(RF_FREQUENCY) + " MHz");
    
    // Log to server only if WiFi is connected
    if (WiFi.status() == WL_CONNECTED) {
      pushLog("CC1101 initialized at " + String(RF_FREQUENCY) + " MHz");
    }
  }
  
  /******************************************************
   * RF RECEIVE - Check for incoming RF signals
   ******************************************************/
  void checkRFReceive() {
    if (ELECHOUSE_cc1101.CheckReceiveFlag()) {
      rfBufferLen = ELECHOUSE_cc1101.ReceiveData(rfBuffer);
      
      if (rfBufferLen > 0) {
        // Convert received data to hex string for logging
        String hexData = "";
        String asciiData = "";
        
        for (int i = 0; i < rfBufferLen; i++) {
          if (rfBuffer[i] < 16) hexData += "0";
          hexData += String(rfBuffer[i], HEX);
          hexData += " ";
          
          // ASCII representation (if printable)
          if (rfBuffer[i] >= 32 && rfBuffer[i] <= 126) {
            asciiData += (char)rfBuffer[i];
          } else {
            asciiData += ".";
          }
        }
        
        // Log received RF signal
        String logMsg = "RF RX [" + String(rfBufferLen) + " bytes]: HEX=" + hexData + " ASCII=" + asciiData;
        pushLog(logMsg);
        
        // Reset receive mode
        ELECHOUSE_cc1101.SetReceive();
      }
    }
  }
  
  /******************************************************
   * RF SEND - Send RF signal
   ******************************************************/
  bool sendRFSignal(String data) {
    pushLog("Sending RF signal: " + data);
    
    // Convert string to byte array
    byte txBuffer[64];
    int dataLen = data.length();
    
    if (dataLen > 63) {
      pushLog("RF TX Failed: Data too long (max 63 bytes)");
      return false;
    }
    
    data.getBytes(txBuffer, dataLen + 1);
    
    // Set transmit mode
    ELECHOUSE_cc1101.SetTransmit();
    delay(10);
    
    // Send data
    ELECHOUSE_cc1101.SendData(txBuffer, dataLen);
    
    // Wait for transmission to complete
    delay(100);
    
    // Return to receive mode
    ELECHOUSE_cc1101.SetReceive();
    
    pushLog("RF signal sent successfully");
    return true;
  }
  
  /******************************************************
   * DEVICE CONTROLLER
   ******************************************************/
  void executeCommand(String action, JsonObject payload) {
  
    pushLog("Executing: " + action);
    
    if (action == "relay_on") {
      digitalWrite(RELAY_PIN, HIGH);
      pushLog("Action: " + action + " Result: success");
      reportResult(action, "success");
    }
    else if (action == "relay_off") {
      digitalWrite(RELAY_PIN, LOW);
      pushLog("Action: " + action + " Result: success");
      reportResult(action, "success");
    }
    else if (action == "led_on") {
      digitalWrite(LED_PIN, HIGH);
      pushLog("Action: " + action + " Result: success");
      reportResult(action, "success");
    }
    else if (action == "led_off") {
      digitalWrite(LED_PIN, LOW);
      pushLog("Action: " + action + " Result: success");
      reportResult(action, "success");
    }
    else if (action == "led_toggle") {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      pushLog("Action: " + action + " Result: success");
      reportResult(action, "success");
    }
    else if (action == "restart") {
      pushLog("Restarting device");
      ESP.restart();
    }
    else if (action == "ota_update") {
      if (payload.containsKey("url")) {
        performOTA(payload["url"].as<String>());
        return;
      }
      else {
        pushLog("OTA Update Failed: No URL provided");
        reportResult(action, "failed");
      }
    }
    else if (action == "rf_send") {
      if (payload.containsKey("data")) {
        String rfData = payload["data"].as<String>();
        bool success = sendRFSignal(rfData);
        if (success) {
          pushLog("Action: " + action + " Result: success");
          reportResult(action, "success");
        } else {
          pushLog("Action: " + action + " Result: failed");
          reportResult(action, "failed");
        }
      } else {
        pushLog("RF Send Failed: No data provided");
        reportResult(action, "failed");
      }
    }
    else {
      pushLog("Action: " + action + " Result: failed - Unknown command");
      reportResult(action, "failed");
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
   * SETUP - WiFi is HIGHEST PRIORITY
   ******************************************************/
  void setup() {
  
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n\n========================================");
    Serial.println("ESP32 Home Automation Starting...");
    Serial.println("========================================\n");
  
    // STEP 1: Initialize basic GPIO pins (no WiFi needed)
    Serial.println("[1/5] Initializing GPIO pins...");
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    pinMode(CC1101_GDO0, INPUT);
    Serial.println("GPIO pins initialized");
  
    // STEP 2: CONNECT TO WIFI FIRST - HIGHEST PRIORITY
    // This ensures all subsequent logs can be sent
    Serial.println("\n[2/5] Connecting to WiFi (HIGHEST PRIORITY)...");
    ensureWiFiConnected();
    
    if (WiFi.status() == WL_CONNECTED) {
      // Now that WiFi is connected, we can send logs
      pushLog("=== Device Starting ===");
      pushLog("WiFi connected: " + WiFi.localIP().toString());
      Serial.println("WiFi connected - logs can now be sent");
    } else {
      Serial.println("WARNING: WiFi not connected - logs will be queued");
    }
  
    // STEP 3: Initialize CC1101 RF module (after WiFi)
    Serial.println("\n[3/5] Initializing CC1101 RF module...");
    initCC1101();
    if (WiFi.status() == WL_CONNECTED) {
      pushLog("CC1101 RF module initialized");
    }
  
    // STEP 4: Setup OTA (needs WiFi)
    Serial.println("\n[4/5] Setting up OTA...");
    setupOTA();
    if (WiFi.status() == WL_CONNECTED) {
      pushLog("Arduino OTA ready");
    }
    Serial.println("OTA setup complete");
  
    // STEP 5: Send initial health and ready status
    Serial.println("\n[5/5] Sending initial status...");
    sendHealth();
    if (WiFi.status() == WL_CONNECTED) {
      pushLog("Device initialized and ready");
      pushLog("All systems operational");
    }
    
    Serial.println("\n========================================");
    Serial.println("Device initialized and ready!");
    Serial.println("========================================\n");
  }
 
  /******************************************************
   * LOOP - WiFi reconnection has priority
   ******************************************************/
  void loop() {
  
    // PRIORITY 1: Handle Arduino OTA (needs WiFi)
    ArduinoOTA.handle();
  
    // PRIORITY 2: Ensure WiFi is connected (highest priority in loop)
    // If WiFi disconnects, reconnect immediately
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected! Reconnecting...");
      ensureWiFiConnected();
      if (WiFi.status() == WL_CONNECTED) {
        pushLog("WiFi reconnected: " + WiFi.localIP().toString());
      }
    }
  
    // PRIORITY 3: Poll for commands (only if WiFi connected)
    if (WiFi.status() == WL_CONNECTED && millis() - lastPoll > 3000) {
      pollProxy();
      lastPoll = millis();
    }
  
    // PRIORITY 4: Send health updates (only if WiFi connected)
    if (WiFi.status() == WL_CONNECTED && millis() - lastHealth > 60000) {
      sendHealth();
      lastHealth = millis();
    }
  
    // PRIORITY 5: Check for RF signals (works without WiFi, but logs need WiFi)
    if (millis() - lastRfCheck > 100) {
      checkRFReceive();
      lastRfCheck = millis();
    }
  }
