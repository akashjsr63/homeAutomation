/******************************************************
 * RESULT SCHEMA - MongoDB Model (Separate Collection)
 ******************************************************/

const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true
    },
    result: {
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
resultSchema.index({ deviceId: 1, ts: -1 });

const Result = mongoose.model("Result", resultSchema);

module.exports = Result;
