# 🏠 ESP32 Home Automation – OTA Enabled Firmware

This repository contains the firmware and backend integration for an **ESP32-based Home Automation System** with:

* ✅ WiFi auto-connect (strongest known network)
* ✅ Secure OTA (Over-The-Air) firmware updates
* ✅ Remote command execution
* ✅ Health monitoring
* ✅ GitHub CI/CD auto-build pipeline
* ✅ Wireless firmware deployment via GitHub Releases

---

# 📦 Project Structure

```
homeAutomation/
│
├── src/
│   └── main.cpp          # ESP32 firmware source
│
├── platformio.ini        # PlatformIO build configuration
│
└── .github/workflows/
    └── build.yml         # Auto-build & release pipeline
```

---

# 🔧 ESP32 Firmware Details (`src/main.cpp`)

The firmware includes:

## 🔹 Core Features

### 📡 WiFi Manager

* Scans available networks
* Connects to strongest known SSID
* Auto-reconnects if connection drops

### 🔁 Long Polling Client

* Polls backend server for device commands
* Executes received actions

### 💡 Device Control

Supported commands:

* `relay_on`
* `relay_off`
* `led_toggle`
* `ota_update`

### 📊 Health Monitoring

Every 60 seconds device reports:

* IP address
* RSSI (signal strength)
* Free heap memory
* Uptime

### 🚀 OTA Update System

Downloads firmware binary over HTTPS and installs wirelessly.

OTA is triggered using:

```json
{
  "action": "ota_update",
  "payload": {
    "url": "FIRMWARE_URL"
  }
}
```

---

# 🌐 Backend / Node Server Details

The ESP32 communicates with a backend server (Node.js based).

## Required Endpoints

### `POST /device/log`

Receives device logs.

Payload:

```json
{
  "device_id": "esp32device1",
  "log": "message"
}
```

---

### `POST /device/health`

Receives health data.

Payload:

```json
{
  "device_id": "esp32device1",
  "ip": "192.168.1.10",
  "rssi": -45,
  "heap": 234000,
  "uptime": 120000
}
```

---

### `GET /device/commands?device_id=esp32device1`

Returns command:

Example response:

```json
{
  "action": "relay_on"
}
```

Or OTA:

```json
{
  "action": "ota_update",
  "payload": {
    "url": "https://github.com/akashjsr63/homeAutomation/releases/latest/download/firmware.bin"
  }
}
```

---

### `POST /device/report`

Reports command execution result.

Payload:

```json
{
  "device_id": "esp32device1",
  "action": "relay_on",
  "result": "success"
}
```

---

# ⚙️ Firmware Build System (CI/CD)

Firmware is automatically built using **GitHub Actions + PlatformIO**.

## Trigger Conditions

Build runs when:

* `src/**` changes
* `platformio.ini` changes
* `.github/workflows/**` changes

---

## Build Pipeline

1. Install PlatformIO
2. Compile firmware for `esp32dev`
3. Generate `firmware.bin`
4. Upload artifact
5. Create GitHub Release
6. Attach firmware binary

---

# 🚀 Firmware Download Link (OTA Ready)

### 🔹 Always Latest Version (Recommended)

```
https://github.com/akashjsr63/homeAutomation/releases/latest/download/firmware.bin
```

This link always points to the newest firmware build.

---

### 🔹 Versioned Firmware Example

```
https://github.com/akashjsr63/homeAutomation/releases/download/firmware-4/firmware.bin
```

---

# 📲 OTA Implementation Note

When using HTTPS OTA with GitHub, use:

```cpp
WiFiClientSecure client;
client.setInsecure();
http.begin(client, firmwareURL);
```

This avoids certificate validation issues.

---

# 🛠 Hardware Target

* Board: ESP32 DevKit V1
* Framework: Arduino
* Flash: 4MB

---

# 🔐 Security Considerations (Recommended Next Steps)

* Add firmware version check before update
* Add firmware signature verification
* Add rollback protection
* Use certificate-based HTTPS instead of `setInsecure()`

---

# 🧠 Development Stack

* ESP32 (Arduino Framework)
* PlatformIO
* GitHub Actions
* Node.js backend (custom)
* OTA over HTTPS

---

# 📌 Summary

This project implements a **production-style IoT firmware deployment pipeline**:

```
Push code →
GitHub builds firmware →
Release created →
ESP32 downloads update →
Device updates wirelessly
```

---

# 👨‍💻 Author

Akash
ESP32 IoT Automation Project

---

If you want, next improvements can include:

* Automatic firmware version embedding
* Device version check before OTA
* OTA rollback safety
* Device dashboard with update control
* Secure signed firmware updates

---
