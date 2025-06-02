const express = require("express");
const authMiddleware = require("../middleware/auth");
const jwt = require("jsonwebtoken");
const passport = require("../config/passport");
const User = require("../models/User");

const router = express.Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
  }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { userId: req.user._id, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    } catch (error) {
      console.error("Auth callback error", error);
      res.redirect(
        `${process.env.FRONTEND_URL}/login?error=token_generation_failed`
      );
    }
  }
);

router.get("/me", authMiddleware, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
      },
    });
  } catch (error) {
    console.error("Get user error", error);
    res.status(500).json({ error: "Failed to get user data" });
  }
});

router.post("/logout", authMiddleware, (req, res) => {
  res.json({ message: "Logged out successfully" }); // logout handled on client side as we are using JWT
});

router.get("/verify", authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
