const express = require("express");
const Campaign = require("../models/Campaign");
const Segment = require("../models/Segment");
const Customer = require("../models/Customer");
const CommunicationLog = require("../models/CommunicationLog");
const authMiddleware = require("../middleware/auth");
const Joi = require("joi");
const axios = require("axios");

const router = express.Router();

// Validation schema
const campaignSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  segmentId: Joi.string().required(),
  message: Joi.string().required().min(10).max(1000),
});

// Dummy vendor API simulation
class VendorAPI {
  static async sendMessage(customerId, message, vendorMessageId) {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));

    // Simulate 90% success rate
    const isSuccess = Math.random() > 0.1;

    if (isSuccess) {
      // Simulate delivery receipt callback after some delay
      setTimeout(async () => {
        try {
          await axios.post(
            `${
              process.env.BACKEND_URL || "http://localhost:5000"
            }/api/campaigns/delivery-receipt`,
            {
              vendorMessageId,
              status: "DELIVERED",
              deliveredAt: new Date().toISOString(),
            }
          );
        } catch (error) {
          console.error("Failed to send delivery receipt:", error.message);
        }
      }, Math.random() * 5000 + 1000); // 1-6 seconds delay

      return { success: true, vendorMessageId };
    } else {
      return {
        success: false,
        error: "Delivery failed",
        vendorMessageId,
      };
    }
  }
}

// Helper function to build segment query (same as in segments.js)
function buildSegmentQuery(rules) {
  if (!rules || rules.length === 0) return {};

  const conditions = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    let condition = {};

    if (rule.field === "daysSinceLastVisit") {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - rule.value);

      switch (rule.operator) {
        case ">":
          condition.lastVisit = { $lt: daysAgo };
          break;
        case "<":
          condition.lastVisit = { $gt: daysAgo };
          break;
        case ">=":
          condition.lastVisit = { $lte: daysAgo };
          break;
        case "<=":
          condition.lastVisit = { $gte: daysAgo };
          break;
        case "=":
          condition.lastVisit = {
            $gte: daysAgo,
            $lt: new Date(daysAgo.getTime() + 24 * 60 * 60 * 1000),
          };
          break;
      }
    } else if (rule.field === "customerTier") {
      const tierRanges = {
        PREMIUM: { min: 50001, max: Infinity },
        GOLD: { min: 20001, max: 50000 },
        SILVER: { min: 5001, max: 20000 },
        BRONZE: { min: 0, max: 5000 },
      };

      if (rule.operator === "=" && tierRanges[rule.value]) {
        const range = tierRanges[rule.value];
        condition.totalSpent = {
          $gte: range.min,
          ...(range.max !== Infinity && { $lte: range.max }),
        };
      }
    } else {
      switch (rule.operator) {
        case ">":
          condition[rule.field] = { $gt: rule.value };
          break;
        case "<":
          condition[rule.field] = { $lt: rule.value };
          break;
        case ">=":
          condition[rule.field] = { $gte: rule.value };
          break;
        case "<=":
          condition[rule.field] = { $lte: rule.value };
          break;
        case "=":
          condition[rule.field] = rule.value;
          break;
        case "!=":
          condition[rule.field] = { $ne: rule.value };
          break;
        case "in":
          condition[rule.field] = {
            $in: Array.isArray(rule.value) ? rule.value : [rule.value],
          };
          break;
        case "not_in":
          condition[rule.field] = {
            $nin: Array.isArray(rule.value) ? rule.value : [rule.value],
          };
          break;
      }
    }

    conditions.push(condition);
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  const operator = rules[0].logicalOperator === "OR" ? "$or" : "$and";
  return { [operator]: conditions };
}

// POST /api/campaigns - Create and launch campaign
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { error, value } = campaignSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    // Get segment
    const segment = await Segment.findById(value.segmentId);
    if (!segment) {
      return res.status(404).json({ error: "Segment not found" });
    }

    // Get customers in segment
    const query = buildSegmentQuery(segment.rules);
    const customers = await Customer.find(query);

    if (customers.length === 0) {
      return res.status(400).json({ error: "No customers found in segment" });
    }

    // Create campaign
    const campaign = new Campaign({
      ...value,
      audienceSize: customers.length,
      createdBy: req.user._id,
      status: "RUNNING",
    });

    await campaign.save();

    // Create communication logs and send messages
    const sendPromises = customers.map(async (customer) => {
      const vendorMessageId = `msg_${campaign._id}_${
        customer._id
      }_${Date.now()}`;

      // Personalize message
      const personalizedMessage = value.message.replace(
        /\{name\}/g,
        customer.name
      );

      // Create communication log
      const commLog = new CommunicationLog({
        campaignId: campaign._id,
        customerId: customer._id,
        message: personalizedMessage,
        status: "PENDING",
        vendorMessageId,
      });

      await commLog.save();

      // Send to vendor API
      try {
        const result = await VendorAPI.sendMessage(
          customer._id,
          personalizedMessage,
          vendorMessageId
        );

        if (result.success) {
          commLog.status = "SENT";
          commLog.sentAt = new Date();
          campaign.stats.sent++;
        } else {
          commLog.status = "FAILED";
          commLog.failureReason = result.error;
          campaign.stats.failed++;
        }

        await commLog.save();
      } catch (error) {
        console.error("Vendor API error:", error);
        commLog.status = "FAILED";
        commLog.failureReason = "Vendor API error";
        campaign.stats.failed++;
        await commLog.save();
      }
    });

    // Execute all sends
    await Promise.all(sendPromises);

    // Update campaign status
    campaign.status = "COMPLETED";
    await campaign.save();

    res.status(201).json({
      message: "Campaign created and launched successfully",
      campaign,
    });
  } catch (error) {
    console.error("Create campaign error:", error);
    res.status(500).json({ error: "Failed to create campaign" });
  }
});

// POST /api/campaigns/delivery-receipt - Handle delivery receipts from vendor
router.post("/delivery-receipt", async (req, res) => {
  try {
    const { vendorMessageId, status, deliveredAt } = req.body;

    const commLog = await CommunicationLog.findOne({ vendorMessageId });
    if (!commLog) {
      return res.status(404).json({ error: "Communication log not found" });
    }

    // Update delivery status
    commLog.status = status;
    if (deliveredAt) {
      commLog.deliveredAt = new Date(deliveredAt);
    }
    await commLog.save();

    // Update campaign stats
    const campaign = await Campaign.findById(commLog.campaignId);
    if (campaign && status === "DELIVERED") {
      campaign.stats.delivered++;
      await campaign.save();
    }

    res.json({ message: "Delivery receipt processed" });
  } catch (error) {
    console.error("Delivery receipt error:", error);
    res.status(500).json({ error: "Failed to process delivery receipt" });
  }
});

// GET /api/campaigns - Get all campaigns
router.get("/", authMiddleware, async (req, res) => {
  try {
    const campaigns = await Campaign.find({ createdBy: req.user._id })
      .populate("segmentId", "name")
      .sort({ createdAt: -1 });

    res.json({ campaigns });
  } catch (error) {
    console.error("Get campaigns error:", error);
    res.status(500).json({ error: "Failed to fetch campaigns" });
  }
});

// GET /api/campaigns/:id - Get single campaign with logs
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("segmentId", "name description")
      .populate("createdBy", "name email");

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Get communication logs
    const logs = await CommunicationLog.find({ campaignId: campaign._id })
      .populate("customerId", "name email")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      campaign,
      logs,
    });
  } catch (error) {
    console.error("Get campaign error:", error);
    res.status(500).json({ error: "Failed to fetch campaign" });
  }
});

module.exports = router;
