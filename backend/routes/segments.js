const express = require("express");
const Segment = require("../models/Segment");
const Customer = require("../models/Customer");
const authMiddleware = require("../middleware/auth");
const Joi = require("joi");

const router = express.Router();

const ruleSchema = Joi.object({
  field: Joi.string()
    .valid(
      "totalSpent",
      "visitCount",
      "daysSinceLastVisit",
      "cutomerTier",
      "location.city"
    )
    .required(),
  operator: Joi.string()
    .valid(">", "<", ">=", "<=", "=", "!=", "in", "not_in")
    .required(),
  value: Joi.alternatives()
    .try(Joi.number(), Joi.string(), Joi.array(), items(Joi.string()))
    .required(),
  logicalOperator: Joi.string().valid("AND", "OR").default("AND"),
});

const segmentSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  description: Joi.string().optional().max(500),
  rule: Joi.array().items(ruleSchema).min(1).required,
});

function buildSegmentQuery(rules) {
  if (!rules || rules.length === 0) return {};

  const conditions = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    let condition = {};

    // Handle different field types
    if (rule.field === "daysSinceLastVisit") {
      // Special handling for days since last visit
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
      // Handle customer tier (virtual field)
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
      // Standard field handling
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

// POST /api/segments/preview -> preview audience size
router.post("/preview", authMiddleware, async (req, res) => {
  try {
    const { error, value } = Joi.object({
      rules: Joi.array().items(ruleSchema).required(),
    }).validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    const query = buildSegmentQuery(value.rules);
    const count = await Customer.countDocuments(query);

    res.json({
      audienceSize: count,
      query: query, // For debugging purposes
    });
  } catch (error) {
    console.error("Preview segment error:", error);
    res.status(500).json({ error: "Failed to preview segment" });
  }
});

// /api/segments -> create segment
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { error, value } = segmentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    // Calculate audience size
    const query = buildSegmentQuery(value.rules);
    const audienceSize = await Customer.countDocuments(query);

    const segment = new Segment({
      ...value,
      audienceSize,
      createdBy: req.user._id,
      lastCalculated: new Date(),
    });

    await segment.save();

    res.status(201).json({
      message: "Segment created successfully",
      segment,
    });
  } catch (error) {
    console.error("Create segment error:", error);
    res.status(500).json({ error: "Failed to create segment" });
  }
});

// /api/segments -> get all segments
router.post("/", authMiddleware, async (req, res) => {
    try {
      const segments = await Segment.find({ createdBy: req.user._id })
        .sort({ createdAt: -1 })
        .populate("createdBy", "name email");

      res.json({ segments });
    } catch (error) {
      console.error("Get segments error:", error);
      res.status(500).json({ error: "Failed to fetch segments" });
    }
});

// /api/segments/:id/customers -> get customers in segment
router.post("/:id/customers", authMiddleware, async (req, res) => {
    try {
      const segment = await Segment.findById(req.params.id);
      if (!segment) {
        return res.status(404).json({ error: "Segment not found" });
      }

      const query = buildSegmentQuery(segment.rules);
      const customers = await Customer.find(query)
        .limit(100) // Limit for performance
        .select("name email totalSpent visitCount lastVisit");

      res.json({ customers });
    } catch (error) {
      console.error("Get segment customers error:", error);
      res.status(500).json({ error: "Failed to fetch segment customers" });
    }
});

module.exports = router;