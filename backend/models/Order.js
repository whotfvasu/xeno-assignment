const mongoose = require("mongoose");

const orderSchema = mongoose.model(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    items: [
      {
        type: String,
        price: Number,
        quantity: Number,
        category: String,
      },
    ],
    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"],
      default: "PENDING",
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    deliveryDate: Date,
    paymentMethod: {
      type: String,
      enum: ["CARD", "UPI", "WALLET", "COD"],
      default: "CARD",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
