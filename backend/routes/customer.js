const express = require("express");
const authMiddleware = require("../middleware/auth");
const Customer = require("../models/Customer");
const Joi = require("joi");

const router = express.Router();

const customerSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().email().required(),
  phone: Joi.string()
    .pattern(/^[0-9+\-\s()]+$/)
    .optional(),
  location: Joi.object({
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    country: Joi.string().optional(),
  }).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

const bulkCustomerSchema = Joi.array().items(customerSchema).max(1000);

// POST /api/customers -> create single customer
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { error, value } = customerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }
    const existingCustomer = await Customer.findOne({ email: value.email });
    if (existingCustomer) {
      return res.status(409).json({
        error: "customer with email id already exists",
      });
    }
    const customer = new Customer(value);
    await customer.save();
    res.status(200).json({
      message: "customer created successfuly",
      customer,
    });
  } catch (error) {
    console.error("create customer error: ", error);
    res.status(500).json({ error: "failed to create customer" });
  }
});

// POST /api/customers/bulk -> bulk import customers
router.post("/bulk", authMiddleware, async (req, res) => {
  try {
    const { error, value } = bulkCustomerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };
    for (const customerData of value) {
      const existingCustomer = await Customer.findOne({
        email: customerData.email,
      });
      if (existingCustomer) {
        results.failed++;
        results.errors.push({
          email: customerData.email,
          error: "customer already exists",
        });
        continue;
      }
      const customer = new Customer(customerData);
      await customer.save();
      results.success++;
    }
    res.status(201).json({
      message: "bulk import completed",
      results,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(500).json({ error: "Failed to import customers" });
  }
});

// GET /api/customers -> get all customers with pagination
router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.search) {
      filter.$or = [
        {
          name: {
            $regex: req.query.search,
            $options: "i",
          },
          email: {
            $regex: req.query.search,
            $options: "i",
          },
        },
      ];
    }

    const customers = await Customer.find(filter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await Customer.countDocuments(filter);
    res.json({
      customers,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: customers.length,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("error getting customer", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// GET /api/customers/:id -> get single customer
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    console.error("Get customer error:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// PUT /api/customers/:id -> update Customer
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { error, value } = customerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    });
    if (!customer) {
      res.status(404).json({ error: " customer not found " });
    }
    res.json({
      message: "Customer updated successfuly",
      customer,
    });
  } catch (error) {
    console.error("Error updating customer details", error);
    res.status(500).json({ error: "Customer not updated" });
  }
});

module.exports = router;
