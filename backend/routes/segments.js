const express = require("express");
const Segment = require("../models/Segment");
const Customer = require("../models/Customer");
const authMiddleware = require("../middleware/auth");
const Joi = require("joi");

const router = express.Router();

const ruleSchema = Joi.object();

const segmentSchema = Joi.object();

function builtSegmentQuery(rules) {}

// POST /api/segments/preview -> preview audience size
router.post("/preview", authMiddleware, async (req, res) => {});

// /api/segments -> create segment
router.post("/", authMiddleware, async (req, res) => {});

// /api/segments -> get all segments
router.post("/", authMiddleware, async (req, res) => {});

// /api/segments/:id/customers -> get customers in segment
router.post("/:id/customers", authMiddleware, async (req, res) => {});
