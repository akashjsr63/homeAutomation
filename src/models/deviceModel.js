/******************************************************
 * DEVICE MODEL - MongoDB Database
 ******************************************************/

const Device = require("./Device");
const Log = require("./Log");
const Result = require("./Result");

const deviceModel = {
  /**
   * Get all devices
   * @returns {Promise<Array>} Array of all device objects
   */
  async getAllDevices() {
    return await Device.find({}).sort({ deviceId: 1 }).lean();
  },

  /**
   * Get or create a device
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object>} Device object with commandQueue, health, onlineStatus
   */
  async getDevice(deviceId) {
    let device = await Device.findOne({ deviceId });
    
    if (!device) {
      device = await Device.create({
        deviceId,
        commandQueue: [],
        health: {},
        onlineStatus: false
      });
    }
    
    return device;
  },

  /**
   * Queue a command for a device
   * @param {string} deviceId - Device identifier
   * @param {Object} command - Command object with action and payload
   */
  async queueCommand(deviceId, command) {
    await Device.findOneAndUpdate(
      { deviceId },
      { $push: { commandQueue: command } },
      { upsert: true, new: true }
    );
  },

  /**
   * Get and remove the next command from queue
   * @param {string} deviceId - Device identifier
   * @returns {Promise<Object|null>} Command object or null if queue is empty
   */
  async getCommand(deviceId) {
    const device = await Device.findOne({ deviceId });
    
    if (!device || !device.commandQueue || device.commandQueue.length === 0) {
      return null;
    }

    // Get first command and remove it atomically
    const command = device.commandQueue[0];
    device.commandQueue.shift();
    await device.save();

    return command;
  },

  /**
   * Save command execution result
   * @param {string} deviceId - Device identifier
   * @param {Object} result - Result object with action, result, ts
   */
  async saveResult(deviceId, result) {
    await Result.create({
      deviceId,
      action: result.action,
      result: result.result,
      ts: result.ts || Date.now()
    });
  },

  /**
   * Save device health data and update online status
   * @param {string} deviceId - Device identifier
   * @param {Object} health - Health data object
   */
  async saveHealth(deviceId, health) {
    await Device.findOneAndUpdate(
      { deviceId },
      { 
        $set: { 
          health,
          onlineStatus: true,
          lastSeen: new Date()
        } 
      },
      { upsert: true, new: true }
    );
  },

  /**
   * Push a log entry for a device
   * @param {string} deviceId - Device identifier
   * @param {string} log - Log message
   */
  async pushLog(deviceId, log) {
    await Log.create({
      deviceId,
      log,
      ts: Date.now()
    });
  },

  /**
   * Get logs for a device
   * @param {string} deviceId - Device identifier
   * @param {number} limit - Maximum number of logs to return (default: 100)
   * @returns {Promise<Array>} Array of log objects
   */
  async getLogs(deviceId, limit = 100) {
    return await Log.find({ deviceId })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();
  },

  /**
   * Get logs with pagination and filtering
   * @param {Object} filters - Filter options
   * @param {string} filters.deviceId - Filter by device ID (optional)
   * @param {string} filters.search - Search text in log message (optional)
   * @param {number} filters.fromTs - Start timestamp (optional)
   * @param {number} filters.toTs - End timestamp (optional)
   * @param {number} filters.page - Page number (default: 1)
   * @param {number} filters.limit - Items per page (default: 50, max: 500)
   * @returns {Promise<Object>} Object with logs array, pagination info
   */
  async getLogsWithFilters(filters = {}) {
    const {
      deviceId,
      search,
      fromTs,
      toTs,
      page = 1,
      limit = 50
    } = filters;

    // Build query
    const query = {};

    // Filter by deviceId
    if (deviceId) {
      query.deviceId = deviceId;
    }

    // Filter by timestamp range
    if (fromTs || toTs) {
      query.ts = {};
      if (fromTs) {
        query.ts.$gte = fromTs;
      }
      if (toTs) {
        query.ts.$lte = toTs;
      }
    }

    // Search in log message (case-insensitive)
    if (search) {
      query.log = { $regex: search, $options: "i" };
    }

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const total = await Log.countDocuments(query);

    // Get logs with pagination
    const logs = await Log.find(query)
      .sort({ ts: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    return {
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNextPage: pageNum * limitNum < total,
        hasPrevPage: pageNum > 1
      }
    };
  },

  /**
   * Get results for a device
   * @param {string} deviceId - Device identifier
   * @param {number} limit - Maximum number of results to return (default: 100)
   * @returns {Promise<Array>} Array of result objects
   */
  async getResults(deviceId, limit = 100) {
    return await Result.find({ deviceId })
      .sort({ ts: -1 })
      .limit(limit)
      .lean();
  },

  /**
   * Update device online status
   * @param {string} deviceId - Device identifier
   * @param {boolean} status - Online status
   */
  async updateOnlineStatus(deviceId, status) {
    await Device.findOneAndUpdate(
      { deviceId },
      { 
        $set: { 
          onlineStatus: status,
          lastSeen: new Date()
        } 
      },
      { upsert: true, new: true }
    );
  },

  /**
   * Mark devices offline based on lastSeen threshold
   * @param {number} thresholdSeconds - Seconds of inactivity before marking offline (default: 90)
   * @returns {Promise<number>} Number of devices marked offline
   */
  async markOfflineDevices(thresholdSeconds = 90) {
    const thresholdDate = new Date(Date.now() - thresholdSeconds * 1000);
    
    const result = await Device.updateMany(
      {
        onlineStatus: true,
        lastSeen: { $lt: thresholdDate }
      },
      {
        $set: { onlineStatus: false }
      }
    );

    return result.modifiedCount;
  }
};

module.exports = deviceModel;
