// backend/scripts/seed.js
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Order = require("../models/Order");
require("dotenv").config();

// Sample data generators
const cities = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Chennai",
  "Kolkata",
  "Hyderabad",
  "Pune",
  "Ahmedabad",
];
const states = [
  "Maharashtra",
  "Delhi",
  "Karnataka",
  "Tamil Nadu",
  "West Bengal",
  "Telangana",
  "Gujarat",
];
const firstNames = [
  "Amit",
  "Priya",
  "Rahul",
  "Sneha",
  "Vikram",
  "Pooja",
  "Arjun",
  "Kavya",
  "Rohit",
  "Meera",
];
const lastNames = [
  "Sharma",
  "Patel",
  "Singh",
  "Kumar",
  "Gupta",
  "Agarwal",
  "Jain",
  "Shah",
  "Reddy",
  "Iyer",
];
const categories = [
  "Electronics",
  "Fashion",
  "Home & Kitchen",
  "Books",
  "Sports",
  "Beauty",
  "Automotive",
];
const paymentMethods = ["CARD", "UPI", "WALLET", "COD"];
const orderStatuses = ["DELIVERED", "SHIPPED", "CONFIRMED", "PENDING"];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start, end) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateCustomers(count) {
  const customers = [];

  for (let i = 0; i < count; i++) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;

    const createdDate = randomDate(
      new Date(2023, 0, 1),
      new Date(2024, 11, 31)
    );
    const lastVisitDate = randomDate(createdDate, new Date());

    customers.push({
      name: `${firstName} ${lastName}`,
      email: email,
      phone: `+91${randomNumber(7000000000, 9999999999)}`,
      totalSpent: 0, // Will be updated when orders are created
      visitCount: randomNumber(1, 20),
      lastVisit: lastVisitDate,
      createdAt: createdDate,
      location: {
        city: randomElement(cities),
        state: randomElement(states),
        country: "India",
      },
      tags:
        Math.random() > 0.7
          ? [randomElement(["VIP", "Frequent", "New", "Loyal"])]
          : [],
    });
  }

  return customers;
}

function generateOrders(customers, ordersPerCustomer = 3) {
  const orders = [];
  let orderIdCounter = 1000;

  customers.forEach((customer) => {
    const numOrders = randomNumber(0, ordersPerCustomer * 2); // Some customers have no orders

    for (let i = 0; i < numOrders; i++) {
      const orderDate = randomDate(customer.createdAt, new Date());
      const itemCount = randomNumber(1, 5);
      const items = [];

      for (let j = 0; j < itemCount; j++) {
        const itemPrice = randomNumber(500, 5000);
        const quantity = randomNumber(1, 3);

        items.push({
          name: `Product ${randomNumber(1, 1000)}`,
          price: itemPrice,
          quantity: quantity,
          category: randomElement(categories),
        });
      }

      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      orders.push({
        orderId: `ORD${orderIdCounter++}`,
        customerId: customer._id,
        amount: totalAmount,
        items: items,
        status: randomElement(orderStatuses),
        orderDate: orderDate,
        deliveryDate:
          Math.random() > 0.3 ? randomDate(orderDate, new Date()) : null,
        paymentMethod: randomElement(paymentMethods),
      });
    }
  });

  return orders;
}

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/xeno-crm"
    );
    console.log("🗄️  Connected to MongoDB");

    // Clear existing data
    console.log("🗑️  Clearing existing data...");
    await Customer.deleteMany({});
    await Order.deleteMany({});

    // Generate and insert customers
    console.log("👥 Generating customers...");
    const customersData = generateCustomers(500); // Generate 500 customers
    const customers = await Customer.insertMany(customersData);
    console.log(`✅ Created ${customers.length} customers`);

    // Generate and insert orders
    console.log("📦 Generating orders...");
    const ordersData = generateOrders(customers, 3);
    const orders = await Order.insertMany(ordersData);
    console.log(`✅ Created ${orders.length} orders`);

    // Update customer statistics based on orders
    console.log("📊 Updating customer statistics...");
    for (const customer of customers) {
      const customerOrders = orders.filter(
        (order) => order.customerId.toString() === customer._id.toString()
      );

      const totalSpent = customerOrders.reduce(
        (sum, order) => sum + order.amount,
        0
      );
      const lastOrderDate =
        customerOrders.length > 0
          ? new Date(
              Math.max(...customerOrders.map((o) => o.orderDate.getTime()))
            )
          : customer.lastVisit;

      await Customer.findByIdAndUpdate(customer._id, {
        totalSpent: totalSpent,
        visitCount: customerOrders.length,
        lastVisit: lastOrderDate,
      });
    }

    console.log("📈 Customer statistics updated");

    // Display some statistics
    const stats = await Customer.aggregate([
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          totalSpent: { $sum: "$totalSpent" },
          avgSpent: { $avg: "$totalSpent" },
          maxSpent: { $max: "$totalSpent" },
          minSpent: { $min: "$totalSpent" },
        },
      },
    ]);

    const tierStats = await Customer.aggregate([
      {
        $addFields: {
          tier: {
            $switch: {
              branches: [
                { case: { $gt: ["$totalSpent", 50000] }, then: "PREMIUM" },
                { case: { $gt: ["$totalSpent", 20000] }, then: "GOLD" },
                { case: { $gt: ["$totalSpent", 5000] }, then: "SILVER" },
              ],
              default: "BRONZE",
            },
          },
        },
      },
      {
        $group: {
          _id: "$tier",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log("\n📊 Database Statistics:");
    console.log("======================");
    console.log(`Total Customers: ${stats[0]?.totalCustomers || 0}`);
    console.log(`Total Orders: ${orders.length}`);
    console.log(
      `Total Revenue: ₹${(stats[0]?.totalSpent || 0).toLocaleString("en-IN")}`
    );
    console.log(
      `Average Customer Value: ₹${Math.round(
        stats[0]?.avgSpent || 0
      ).toLocaleString("en-IN")}`
    );
    console.log(
      `Highest Customer Value: ₹${(stats[0]?.maxSpent || 0).toLocaleString(
        "en-IN"
      )}`
    );

    console.log("\n🏆 Customer Tiers:");
    tierStats.forEach((tier) => {
      console.log(`${tier._id}: ${tier.count} customers`);
    });

    console.log("\n🎉 Database seeding completed successfully!");
    console.log("You can now start the server and test the APIs.");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the seeding function
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
