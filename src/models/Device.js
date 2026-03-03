/******************************************************
 * DEVICE SCHEMA - MongoDB Model
 ******************************************************/

const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    commandQueue: [
      {
        action: String,
        payload: mongoose.Schema.Types.Mixed
      }
    ],
    health: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    onlineStatus: {
      type: Boolean,
      default: false,
      index: true
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const Device = mongoose.model("Device", deviceSchema);

module.exports = Device;
