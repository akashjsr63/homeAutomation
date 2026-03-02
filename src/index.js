// src/index.js
const express = require("express");
const path = require("path");

const app = express();

/******************************************************
 * IN-MEMORY DATABASE (No external files)
 ******************************************************/
const devices = {};

/******************************************************
 * DEVICE MODEL (Inline)
 ******************************************************/
const deviceModel = {
  getDevice(deviceId) {
    if (!devices[deviceId]) {
      devices[deviceId] = {
        commandQueue: [],
        logs: [],
        health: {},
        results: []
      };
    }
    return devices[deviceId];
  },

  queueCommand(deviceId, command) {
    const device = this.getDevice(deviceId);
    device.commandQueue.push(command);
  },

  getCommand(deviceId) {
    const device = this.getDevice(deviceId);
    return device.commandQueue.shift();
  },

  saveResult(deviceId, result) {
    const device = this.getDevice(deviceId);
    device.results.push(result);
  },

  saveHealth(deviceId, health) {
    const device = this.getDevice(deviceId);
    device.health = health;
  },

  pushLog(deviceId, log) {
    const device = this.getDevice(deviceId);
    device.logs.push({
      log,
      ts: Date.now()
    });
  }
};

/******************************************************
 * LONG POLLING (Inline)
 ******************************************************/
async function longPoll(fn, timeout = 30000, interval = 1000) {
  const start = Date.now();

  return new Promise((resolve) => {
    const check = async () => {
      const result = await fn();
      if (result) return resolve(result);

      if (Date.now() - start > timeout) {
        return resolve(null);
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/******************************************************
 * APP CONFIG
 ******************************************************/
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

/******************************************************
 * ESP32 DEVICE ENDPOINTS
 ******************************************************/

/**
 * LONG POLL FOR COMMANDS
 */
app.get("/device/commands", async (req, res) => {
  const deviceId = req.query.device_id;
  if (!deviceId)
    return res.status(400).json({ error: "device_id required" });

  const command = await longPoll(
    () => deviceModel.getCommand(deviceId),
    30000
  );

  res.json(command || { action: "none" });
});

/**
 * REPORT COMMAND RESULT
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
 */
app.post("/device/log", (req, res) => {
  const { device_id, log } = req.body;
  if (!device_id || !log) return res.status(400).end();

  deviceModel.pushLog(device_id, log);
  res.json({ status: "ok" });
});

/******************************************************
 * PUBLIC TESTING ENDPOINTS
 ******************************************************/

/**
 * SEND COMMAND
 * Example:
 * /test/command?device_id=esp32device1&action=relay_on
 */
app.get("/test/command", (req, res) => {
  const { device_id, action, url } = req.query;
  if (!device_id || !action) {
    return res
      .status(400)
      .json({ error: "device_id & action required" });
  }

  const payload = {};
  if (url) payload.url = url;

  deviceModel.queueCommand(device_id, { action, payload });

  res.json({ status: "queued", device_id, action, payload });
});

/**
 * FULL DEVICE STATE
 */
app.get("/test/device/:id", (req, res) => {
  res.json(deviceModel.getDevice(req.params.id));
});

/**
 * DEVICE LOGS
 */
app.get("/test/logs/:id", (req, res) => {
  res.json(deviceModel.getDevice(req.params.id).logs);
});

/**
 * BASIC HEALTH CHECK
 */
app.get("/health", (_, res) => {
  console.log(`[${new Date().toISOString()}] Health check pinged`);
  res.send("OK");
});

/******************************************************
 * START SERVER (Render Compatible)
 ******************************************************/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ESP32 Proxy running on port ${PORT}`);
});
