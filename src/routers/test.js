/******************************************************
 * PUBLIC TESTING ROUTES
 ******************************************************/

const express = require("express");
const router = express.Router();
const deviceModel = require("../models/deviceModel");

/**
 * SEND COMMAND
 * GET /test/command?device_id=<device_id>&action=<action>&url=<url>
 * Example: /test/command?device_id=esp32device1&action=relay_on
 */
router.get("/command", async (req, res) => {
  const { device_id, action, url } = req.query;
  if (!device_id || !action) {
    return res
      .status(400)
      .json({ error: "device_id & action required" });
  }

  const payload = {};
  if (url) payload.url = url;

  await deviceModel.queueCommand(device_id, { action, payload });

  res.json({ status: "queued", device_id, action, payload });
});

/**
 * FULL DEVICE STATE
 * GET /test/device/:id
 */
router.get("/device/:id", async (req, res) => {
  const device = await deviceModel.getDevice(req.params.id);
  res.json(device);
});

/**
 * DEVICE LOGS
 * GET /test/logs/:id?limit=<limit>
 */
router.get("/logs/:id", async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const logs = await deviceModel.getLogs(req.params.id, limit);
  res.json(logs);
});

/**
 * DEVICE RESULTS
 * GET /test/results/:id?limit=<limit>
 */
router.get("/results/:id", async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const results = await deviceModel.getResults(req.params.id, limit);
  res.json(results);
});

module.exports = router;
