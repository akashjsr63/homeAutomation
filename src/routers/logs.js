/******************************************************
 * LOGS ROUTES - Pagination and Filtering
 ******************************************************/

const express = require("express");
const router = express.Router();
const deviceModel = require("../models/deviceModel");

/**
 * GET LOGS WITH PAGINATION AND FILTERING
 * GET /logs?deviceId=<device_id>&search=<text>&fromTs=<timestamp>&toTs=<timestamp>&page=<page>&limit=<limit>
 * 
 * Query Parameters:
 * - deviceId (optional): Filter by specific device ID
 * - search (optional): Search text in log message (case-insensitive)
 * - fromTs (optional): Start timestamp (Unix timestamp in milliseconds)
 * - toTs (optional): End timestamp (Unix timestamp in milliseconds)
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 50, max: 500)
 * 
 * Examples:
 * - /logs?deviceId=esp32device1&page=1&limit=20
 * - /logs?search=error&fromTs=1609459200000&toTs=1609545600000
 * - /logs?deviceId=esp32device1&search=connected&page=2&limit=50
 */
router.get("/", async (req, res) => {
  try {
    const { deviceId, search, fromTs, toTs, page, limit } = req.query;

    // Parse timestamp filters
    const filters = {
      deviceId: deviceId || undefined,
      search: search || undefined,
      fromTs: fromTs ? parseInt(fromTs) : undefined,
      toTs: toTs ? parseInt(toTs) : undefined,
      page: page || 1,
      limit: limit || 50
    };

    // Validate timestamp filters
    if (filters.fromTs && isNaN(filters.fromTs)) {
      return res.status(400).json({ error: "fromTs must be a valid timestamp" });
    }
    if (filters.toTs && isNaN(filters.toTs)) {
      return res.status(400).json({ error: "toTs must be a valid timestamp" });
    }
    if (filters.fromTs && filters.toTs && filters.fromTs > filters.toTs) {
      return res.status(400).json({ error: "fromTs must be less than or equal to toTs" });
    }

    const result = await deviceModel.getLogsWithFilters(filters);

    res.json(result);
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ error: "Internal server error", message: error.message });
  }
});

module.exports = router;
