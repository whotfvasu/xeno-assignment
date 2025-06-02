// backend/routes/ai.js
const express = require("express");
const aiService = require("../services/aiService");
const authMiddleware = require("../middleware/auth");
const Joi = require("joi");

const router = express.Router();

// Validation schemas
const naturalLanguageSchema = Joi.object({
  description: Joi.string().required().min(5).max(500),
});

const messageGenerationSchema = Joi.object({
  objective: Joi.string().required().min(5).max(200),
  audienceDescription: Joi.string().required().min(5).max(300),
  count: Joi.number().integer().min(1).max(5).default(3),
});

const campaignSummarySchema = Joi.object({
  campaignId: Joi.string().required(),
});

const schedulingSchema = Joi.object({
  audienceSize: Joi.number().integer().min(1).required(),
  location: Joi.string().optional(),
  tier: Joi.string().optional(),
  category: Joi.string().optional(),
});

const taggingSchema = Joi.object({
  message: Joi.string().required().min(5).max(1000),
  audienceDescription: Joi.string().required().min(5).max(300),
});

// POST /api/ai/parse-language - Convert natural language to segment rules
router.post("/parse-language", authMiddleware, async (req, res) => {
  try {
    const { error, value } = naturalLanguageSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    const rules = await aiService.parseNaturalLanguageToRules(
      value.description
    );

    res.json({
      success: true,
      rules,
      originalDescription: value.description,
    });
  } catch (error) {
    console.error("Natural language parsing error:", error);
    res.status(500).json({
      error: "Failed to parse natural language",
      message: error.message,
    });
  }
});

// POST /api/ai/generate-messages - Generate campaign message variants
router.post("/generate-messages", authMiddleware, async (req, res) => {
  try {
    const { error, value } = messageGenerationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    const messages = await aiService.generateCampaignMessages(
      value.objective,
      value.audienceDescription,
      value.count
    );

    res.json({
      success: true,
      messages,
      objective: value.objective,
      audienceDescription: value.audienceDescription,
    });
  } catch (error) {
    console.error("Message generation error:", error);
    res.status(500).json({
      error: "Failed to generate messages",
      message: error.message,
    });
  }
});

// POST /api/ai/campaign-summary - Generate campaign performance summary
router.post("/campaign-summary", authMiddleware, async (req, res) => {
  try {
    const { error, value } = campaignSummarySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    // Get campaign data
    const Campaign = require("../models/Campaign");
    const campaign = await Campaign.findById(value.campaignId).populate(
      "segmentId",
      "name description"
    );

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    // Check if user owns this campaign
    if (campaign.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    const summary = await aiService.generateCampaignSummary(campaign);

    res.json({
      success: true,
      summary,
      campaignId: campaign._id,
      campaignName: campaign.name,
    });
  } catch (error) {
    console.error("Campaign summary error:", error);
    res.status(500).json({
      error: "Failed to generate campaign summary",
      message: error.message,
    });
  }
});

// POST /api/ai/suggest-timing - Get optimal send time suggestions
router.post("/suggest-timing", authMiddleware, async (req, res) => {
  try {
    const { error, value } = schedulingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    const audienceData = {
      size: value.audienceSize,
      location: value.location || "India",
      tier: value.tier || "Mixed",
      category: value.category || "E-commerce",
    };

    const suggestion = await aiService.suggestOptimalSendTime(audienceData);

    res.json({
      success: true,
      suggestion,
      audienceData,
    });
  } catch (error) {
    console.error("Timing suggestion error:", error);
    res.status(500).json({
      error: "Failed to generate timing suggestions",
      message: error.message,
    });
  }
});

// POST /api/ai/generate-tags - Auto-tag campaigns
router.post("/generate-tags", authMiddleware, async (req, res) => {
  try {
    const { error, value } = taggingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

    const tags = await aiService.generateCampaignTags({
      message: value.message,
      audienceDescription: value.audienceDescription,
    });

    res.json({
      success: true,
      tags,
      message: value.message,
      audienceDescription: value.audienceDescription,
    });
  } catch (error) {
    console.error("Tag generation error:", error);
    res.status(500).json({
      error: "Failed to generate tags",
      message: error.message,
    });
  }
});

// GET /api/ai/status - Check AI service availability
router.get("/status", authMiddleware, (req, res) => {
  const providers = Object.keys(aiService.providers)
    .filter((key) => aiService.providers[key].available)
    .map((key) => ({
      name: key,
      status: "available",
    }));

  res.json({
    success: true,
    primaryProvider: aiService.primaryProvider,
    availableProviders: providers,
    features: [
      "Natural Language to Segment Rules",
      "AI-Driven Message Generation",
      "Campaign Performance Summarization",
      "Smart Scheduling Suggestions",
      "Auto-tagging Campaigns",
    ],
  });
});

module.exports = router;
