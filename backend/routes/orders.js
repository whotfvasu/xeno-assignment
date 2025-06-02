const express = require("express");
const Joi = require("joi");
const authMiddleware = require("../middleware/auth");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

const router = express.Router();

const orderItemSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().min(0).required(),
  quantity: Joi.number().integer().min(1).required(),
  category: Joi.string().optional(),
});

const orderSchema = Joi.object({
  orderId: Joi.string().required(),
  customerId: Joi.string().required(),
  amount: Joi.number().min(0).required(),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  status: Joi.string()
    .valid("PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED")
    .optional(),
  orderDate: Joi.date().optional(),
  deliveryDate: Joi.date().optional(),
  paymentMethod: Joi.string().valid("CARD", "UPI", "WALLET", "COD").optional(),
});

const bulkOrderSchema = Joi.array().items(orderSchema).max(1000);

// POST /api/orders -> create single order
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { error, value } = orderSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: "Validation Failed",
        details: error.details.map((d) => d.message),
      });
    }
    const customer = await Customer.findById(value.customerId);
    if (!customer) {
      res.status(404).json({
        error: "customer not found",
      });
    }
    const existingOrder = await Order.findOne({ orderId: value.orderId });
    if (existingOrder) {
      return res.status(409).json({ error: "Order ID already exists" });
    }
    const order = new Order(value);
    await order.save();
    await updateCustomerStats(value.customerId, value.amount);
    res.status(201).json({
      message: "order created successfuly",
      order,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// POST /api/orders/bulk -> bulk import orders
router.post("/bulk", authMiddleware, async (req, res) => {
  try {
    const { error, value } = bulkOrderSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        error: "Validation Failed",
        details: error.details.map((d) => d.message),
      });
    }
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };
    for (const orderData of value) {
      try {
        const customer = await Customer.findById(orderData.customerId);
        if (!customer) {
          results.failed++;
          results.error.push({
            orderId: orderData.orderId,
            error: "Customer not found",
          });
          continue;
        }
        const existingOrder = await Order.findOne({
          orderId: orderData.orderId,
        });
        if (existingOrder) {
          results.failed++;
          results.errors.push({
            orderId: orderData.orderId,
            error: "Order ID already exists",
          });
          continue;
        }

        const order = new Order(orderData);
        await order.save();
        await updateCustomerStats(orderData.customerId, orderData.amout);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          orderId: orderData.orderId,
          error: error.message,
        });
      }
    }
  } catch (error) {
    console.error("Bulk import error ", error);
    res.status(500).json({ error: "Bulk import orders failed" });
  }
});

// GET /api/orders get all orders with pagination
router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate("customerId", "name email")
      .skip(skip)
      .limit(limit)
      .sort({ orderDate: -1 });

    const total = await Order.countDocuments(filter);

    res.json({
      orders,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: orders.length,
        totalRecords: total,
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id -> get single order
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "customerId",
      "name email"
    );
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

module.exports = router;
