import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendVerificationEmail } from "./emailService.js";

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
    }

    // Check existing user
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (!existing.isVerified) {
        return res.status(400).json({
          error: "An account with this email exists but is not verified. Please check your inbox or resend the verification email.",
          unverified: true,
        });
      }
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Create user
    const user = await User.create({
      name,
      email,
      phone: phone || undefined,
      password,
      verificationToken,
      verificationTokenExpiry,
    });

    // Send verification email
    await sendVerificationEmail(name, email, verificationToken);

    res.status(201).json({
      message: `Verification email sent to ${email}. Please check your inbox.`,
    });
  } catch (err) {
    console.error("[Auth] Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ── GET /auth/verify-email?token=xxx ─────────────────────────────────────────
router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: "Verification token is missing." });

    // Find user with matching token
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    }).select("+verificationToken +verificationTokenExpiry");

    if (!user) {
      return res.status(400).json({
        error: "Invalid or expired verification link. Please request a new one.",
        expired: true,
      });
    }

    // Mark as verified and clear token
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    // Issue JWT so user is logged in immediately after verification
    const jwtToken = generateToken(user._id);

    res.json({
      message: "Email verified successfully! You're now logged in.",
      token: jwtToken,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("[Auth] Verify error:", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    // Find user with password
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    // Check verified
    if (!user.isVerified) {
      return res.status(403).json({
        error: "Please verify your email before logging in.",
        unverified: true,
        email: user.email,
      });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── POST /auth/resend-verification ───────────────────────────────────────────
router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+verificationToken +verificationTokenExpiry");

    if (!user) return res.status(404).json({ error: "No account found with this email." });
    if (user.isVerified) return res.status(400).json({ error: "This account is already verified." });

    // Refresh token
    const verificationToken = generateVerificationToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await sendVerificationEmail(user.name, email, verificationToken);

    res.json({ message: `Verification email resent to ${email}.` });
  } catch (err) {
    console.error("[Auth] Resend error:", err);
    res.status(500).json({ error: "Failed to resend email. Please try again." });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided." });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: "User not found." });
    res.json({ user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

export default router;