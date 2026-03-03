/******************************************************
 * HEALTH CHECK ROUTE
 ******************************************************/

const express = require("express");
const router = express.Router();

/**
 * BASIC HEALTH CHECK
 * GET /health
 */
router.get("/", (_, res) => {
  console.log(`[${new Date().toISOString()}] Health check pinged`);
  res.send("OK");
});

module.exports = router;
