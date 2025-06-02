const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ error: "Invalid token or user deactivated" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error", error);
    res.status(401).json({ error: "invalid token" });
  }
};

module.exports = authMiddleware;
