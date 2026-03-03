/******************************************************
 * DASHBOARD ROUTES
 ******************************************************/

const express = require("express");
const router = express.Router();
const deviceModel = require("../models/deviceModel");

/**
 * DASHBOARD HOME PAGE
 * GET /
 */
router.get("/", async (req, res) => {
  try {
    const devices = await deviceModel.getAllDevices();
    res.render("dashboard", { devices });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.status(500).render("error", { message: "Failed to load dashboard" });
  }
});

/**
 * API: Get all devices (for AJAX)
 * GET /api/devices
 */
router.get("/api/devices", async (req, res) => {
  try {
    const devices = await deviceModel.getAllDevices();
    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * API: Get device details
 * GET /api/device/:id
 */
router.get("/api/device/:id", async (req, res) => {
  try {
    const device = await deviceModel.getDevice(req.params.id);
    const logs = await deviceModel.getLogs(req.params.id, 50);
    const results = await deviceModel.getResults(req.params.id, 50);
    
    res.json({
      device,
      logs,
      results
    });
  } catch (error) {
    console.error("Error fetching device details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * API: Send command to device
 * POST /api/command
 * Body: { deviceId, action, url? }
 */
router.post("/api/command", async (req, res) => {
  try {
    const { deviceId, action, url } = req.body;
    
    if (!deviceId || !action) {
      return res.status(400).json({ error: "deviceId and action are required" });
    }

    const payload = {};
    if (url) payload.url = url;

    await deviceModel.queueCommand(deviceId, { action, payload });

    res.json({ status: "success", message: "Command queued" });
  } catch (error) {
    console.error("Error queuing command:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
