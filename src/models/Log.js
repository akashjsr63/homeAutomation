/******************************************************
 * LOG SCHEMA - MongoDB Model (Separate Collection)
 ******************************************************/

const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true
    },
    log: {
      type: String,
      required: true
    },
    ts: {
      type: Number,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries by deviceId and timestamp
logSchema.index({ deviceId: 1, ts: -1 });

const Log = mongoose.model("Log", logSchema);

module.exports = Log;
