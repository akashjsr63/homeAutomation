// src/index.js
const express = require("express");
const path = require("path");

const deviceModel = require("./models/device.model");
const longPoll = require("./helper/longPoll");

const app = express();

/************ APP CONFIG ************/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

/************ ESP32 DEVICE ENDPOINTS ************/

/**
 * LONG POLL FOR COMMANDS
 * GET /device/commands?device_id=esp32device1
 */
app.get("/device/commands", async (req, res) => {
  const deviceId = req.query.device_id;
  if (!deviceId) return res.status(400).json({ error: "device_id required" });

  const command = await longPoll(
    () => deviceModel.getCommand(deviceId),
    30000
  );

  res.json(command || { action: "none" });
});

/**
 * REPORT COMMAND RESULT
 * POST /device/report
 */
app.post("/device/report", (req, res) => {
  const { device_id, action, result } = req.body;
  if (!device_id) return res.status(400).end();

  deviceModel.saveResult(device_id, {
    action,
    result,
    ts: Date.now()
  });

  res.json({ status: "ok" });
});

/**
 * DEVICE HEALTH
 * POST /device/health
 */
app.post("/device/health", (req, res) => {
  const { device_id, ...health } = req.body;
  if (!device_id) return res.status(400).end();

  deviceModel.saveHealth(device_id, {
    ...health,
    ts: Date.now()
  });

  res.json({ status: "ok" });
});

/**
 * DEVICE LOGS
 * POST /device/log
 */
app.post("/device/log", (req, res) => {
  const { device_id, log } = req.body;
  if (!device_id || !log) return res.status(400).end();

  deviceModel.pushLog(device_id, log);
  res.json({ status: "ok" });
});

/************ PUBLIC TESTING ENDPOINTS (GET BASED) ************/

/**
 * SEND COMMAND (GET FOR EASY TESTING)
 * /test/command?device_id=esp32device1&action=relay_on
 * /test/command?device_id=esp32device1&action=ota_update&url=http://x/firmware.bin
 */
app.get("/test/command", (req, res) => {
  const { device_id, action, url } = req.query;
  if (!device_id || !action) {
    return res.status(400).json({ error: "device_id & action required" });
  }

  const payload = {};
  if (url) payload.url = url;

  deviceModel.queueCommand(device_id, { action, payload });
  res.json({ status: "queued", device_id, action, payload });
});

/**
 * FULL DEVICE STATE
 * GET /test/device/esp32device1
 */
app.get("/test/device/:id", (req, res) => {
  res.json(deviceModel.getDevice(req.params.id));
});

/**
 * DEVICE LOGS ONLY
 * GET /test/logs/esp32device1
 */
app.get("/test/logs/:id", (req, res) => {
  res.json(deviceModel.getDevice(req.params.id).logs);
});

/**
 * DEVICE HEALTH ONLY
 * GET /test/health/esp32device1
 */
app.get("/test/health/:id", (req, res) => {
  res.json(deviceModel.getDevice(req.params.id).health);
});

/************ BASIC HEALTH CHECK ************/
app.get("/health", (_, res) => res.send("OK"));

/************ START SERVER ************/
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`ESP32 Proxy running on http://localhost:${PORT}`);
});
