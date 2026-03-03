/******************************************************
 * ESP32 DEVICE ROUTES
 ******************************************************/

const express = require("express");
const router = express.Router();
const deviceModel = require("../models/deviceModel");
const longPoll = require("../helper/longPoll");

/**
 * LONG POLL FOR COMMANDS
 * GET /device/commands?device_id=<device_id>
 */
router.get("/commands", async (req, res) => {
  const deviceId = req.query.device_id;
  if (!deviceId)
    return res.status(400).json({ error: "device_id required" });

  // Mark device as online when it polls for commands
  await deviceModel.updateOnlineStatus(deviceId, true);

  const command = await longPoll(
    () => deviceModel.getCommand(deviceId),
    30000
  );

  res.json(command || { action: "none" });
});

/**
 * REPORT COMMAND RESULT
 * POST /device/report
 * Body: { device_id, action, result }
 */
router.post("/report", async (req, res) => {
  const { device_id, action, result } = req.body;
  if (!device_id) return res.status(400).end();

  // Mark device as online when reporting results
  await deviceModel.updateOnlineStatus(device_id, true);

  await deviceModel.saveResult(device_id, {
    action,
    result,
    ts: Date.now()
  });

  res.json({ status: "ok" });
});

/**
 * DEVICE HEALTH
 * POST /device/health
 * Body: { device_id, ...health }
 */
router.post("/health", async (req, res) => {
  const { device_id, ...health } = req.body;
  if (!device_id) return res.status(400).end();

  await deviceModel.saveHealth(device_id, {
    ...health,
    ts: Date.now()
  });

  res.json({ status: "ok" });
});

/**
 * DEVICE LOGS
 * POST /device/log
 * Body: { device_id, log }
 */
router.post("/log", async (req, res) => {
  const { device_id, log } = req.body;
  if (!device_id || !log) return res.status(400).end();

  // Mark device as online when sending logs
  await deviceModel.updateOnlineStatus(device_id, true);

  await deviceModel.pushLog(device_id, log);
  res.json({ status: "ok" });
});

module.exports = router;
