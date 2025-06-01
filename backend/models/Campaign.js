const mongoose = require("mongoose");

const campaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Segment",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    audienceSize: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED"],
      default: "DRAFT",
    },
    scheduledAt: Date,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stats: {
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Campaign", campaignSchema);
