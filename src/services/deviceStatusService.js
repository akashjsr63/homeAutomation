/******************************************************
 * DEVICE STATUS SERVICE - Background Job
 * Automatically marks devices as offline based on inactivity
 ******************************************************/

const deviceModel = require("../models/deviceModel");

// Configuration
const CHECK_INTERVAL_SECONDS = 45; // Check every 45 seconds
const OFFLINE_THRESHOLD_SECONDS = 90; // Mark offline if inactive for 90 seconds

let statusCheckInterval = null;

/**
 * Check and mark offline devices
 */
async function checkDeviceStatus() {
  try {
    const markedOffline = await deviceModel.markOfflineDevices(OFFLINE_THRESHOLD_SECONDS);
    
    if (markedOffline > 0) {
      console.log(`[DeviceStatus] Marked ${markedOffline} device(s) as offline`);
    }
  } catch (error) {
    console.error(`[DeviceStatus] Error checking device status:`, error.message);
  }
}

/**
 * Start the device status monitoring service
 */
function startDeviceStatusService() {
  if (statusCheckInterval) {
    console.log("[DeviceStatus] Service already running");
    return;
  }

  console.log(`[DeviceStatus] Starting service (check every ${CHECK_INTERVAL_SECONDS}s, offline threshold: ${OFFLINE_THRESHOLD_SECONDS}s)`);
  
  // Run immediately on startup
  checkDeviceStatus();
  
  // Then run at regular intervals
  statusCheckInterval = setInterval(checkDeviceStatus, CHECK_INTERVAL_SECONDS * 1000);
}

/**
 * Stop the device status monitoring service
 */
function stopDeviceStatusService() {
  if (statusCheckInterval) {
    clearInterval(statusCheckInterval);
    statusCheckInterval = null;
    console.log("[DeviceStatus] Service stopped");
  }
}

// Note: Graceful shutdown is handled in index.js
// This service only stops the interval, not the process

module.exports = {
  startDeviceStatusService,
  stopDeviceStatusService,
  checkDeviceStatus
};
