const mongoose = require("mongoose");

const communicationLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED", "DELIVERED", "OPENED", "CLICKED"],
      default: "PENDING",
    },
    sentAt: Date,
    deliveredAt: Date,
    failureReason: String,
    vendorMessageId: String,
    metadata: {
      channel: {
        type: String,
        enum: ["EMAIL", "SMS", "PUSH"],
        default: "EMAIL",
      },
      priority: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH"],
        default: "MEDIUM",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CommunicationLog", communicationLogSchema);
