const mongoose = require("mongoose");

const customerSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: String,
    totalSpent: {
      type: Number,
      default: 0,
    },
    visitCount: {
      type: Number,
      default: 0,
    },
    lastVisit: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    tags: [String],
    location: {
      city: String,
      state: String,
      country: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

customerSchema.virtual("custromerTier").get(function () {
  if (this.totalSpent > 50000) return "PREMIUM";
  if (this.totalSpent > 20000) return "GOLD";
  if (this.totalSpent > 5000) return "SILVER";
  return "BRONZE";
});

customerSchema.virtual("daysSinceLastVisit").get(function () {
  if (!this.lastVisit) return null;
  return Math.floor((Date.now() - this.lastVisit) / (1000 * 60 * 60 * 24));
});

module.exports = mongoose.model("Customer", customerSchema);
