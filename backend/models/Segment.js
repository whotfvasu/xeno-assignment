const mongoose = require("mongoose");

const segmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    rules: [
      {
        field: {
          type: String,
          required: true,
          enum: [
            "totalSpent",
            "visitCount",
            "daysSinceLastVisit",
            "customerTier",
            "location.city",
          ],
        },
        operator: {
          type: String,
          required: true,
          enum: [">", "<", ">=", "<=", "=", "!=", "in", "not_in"],
        },
        value: mongoose.Schema.Types.Mixed,
        logicalOperator: {
          type: String,
          enum: ["AND", "OR"],
          default: "AND",
        },
      },
    ],
    audienceSize: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastCalculated: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Segment", segmentSchema);
