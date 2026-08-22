import express from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import { protect } from "./authMiddleware.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "./emailService.js";

const router = express.Router();

// Credentials arriving from a request body or query string must be plain
// strings before they reach a Mongo filter. JSON bodies and the `extended`
// query parser can both produce objects, and an object like { $gt: "" } would
// otherwise be passed through by Mongoose as a live query operator — matching
// an arbitrary user's token instead of the one that was actually emailed.
// `mongoose.set("sanitizeFilter")` in index.js is the second layer; this is the
// first, and it also turns malformed input into a clean 400 instead of a 500.
function readCredential(value) {
  return typeof value === "string" ? value : null;
}

function generateJWT(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Sets the JWT as an httpOnly cookie (not readable by JS → resistant to XSS).
// This cookie is the durable session: the client keeps the token in memory only,
// so a refresh is re-authenticated from here rather than from localStorage.
const AUTH_COOKIE_NAME = "legalaid_token";

// Shared by setAuthCookie and clearCookie. A cookie is only overwritten when the
// attributes match, so logout must clear with the same flags it was set with.
function authCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
}

function setAuthCookie(res, token) {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: sevenDaysMs,
  });
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isAdmin: Boolean(user.isAdmin),
    createdAt: user.createdAt,
  };
}

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const name = readCredential(req.body?.name);
    const email = readCredential(req.body?.email);
    const password = readCredential(req.body?.password);
    const phone = readCredential(req.body?.phone);
    if (!name || !email || !password)
      return res
        .status(400)
        .json({ error: "Name, email and password are required." });
    if (password.length < 8)
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });
    if (phone && !/^[6-9]\d{9}$/.test(phone))
      return res
        .status(400)
        .json({ error: "Please enter a valid 10-digit Indian mobile number." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (!existing.isVerified)
        return res
          .status(400)
          .json({
            error: "Account exists but not verified. Check your inbox.",
            unverified: true,
          });
      return res
        .status(400)
        .json({ error: "An account with this email already exists." });
    }

    const verificationToken = generateToken();
    await User.create({
      name,
      email,
      phone: phone || undefined,
      password,
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await sendVerificationEmail(name, email, verificationToken);
    res
      .status(201)
      .json({
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
    const token = readCredential(req.query.token);
    if (!token)
      return res.status(400).json({ error: "Verification token is missing." });

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: mongoose.trusted({ $gt: new Date() }),
    }).select("+verificationToken +verificationTokenExpiry");

    if (!user)
      return res
        .status(400)
        .json({
          error: "Invalid or expired link. Please request a new one.",
          expired: true,
        });

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    const jwtToken = generateJWT(user._id);
    setAuthCookie(res, jwtToken);
    res.json({
      message: "Email verified! You're now logged in.",
      token: jwtToken,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("[Auth] Verify error:", err);
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const email = readCredential(req.body?.email);
    const password = readCredential(req.body?.password);
    if (!email || !password)
      return res
        .status(400)
        .json({ error: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: "Invalid email or password." });

    if (!user.isVerified)
      return res
        .status(403)
        .json({
          error: "Please verify your email before logging in.",
          unverified: true,
          email: user.email,
        });

    const loginToken = generateJWT(user._id);
    setAuthCookie(res, loginToken);
    res.json({
      token: loginToken,
      user: serializeUser(user),
    });
  } catch (err) {
    console.error("[Auth] Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── POST /auth/resend-verification ───────────────────────────────────────────
router.post("/resend-verification", async (req, res) => {
  try {
    const email = readCredential(req.body?.email);
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+verificationToken +verificationTokenExpiry"
    );
    if (!user)
      return res
        .status(404)
        .json({ error: "No account found with this email." });
    if (user.isVerified)
      return res
        .status(400)
        .json({ error: "This account is already verified." });

    const verificationToken = generateToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    await sendVerificationEmail(user.name, email, verificationToken);
    res.json({ message: `Verification email resent to ${email}.` });
  } catch (err) {
    console.error("[Auth] Resend error:", err);
    res
      .status(500)
      .json({ error: "Failed to resend email. Please try again." });
  }
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const email = readCredential(req.body?.email);
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always return success to prevent email enumeration
    if (!user || !user.isVerified) {
      return res.json({
        message:
          "If an account exists with this email, you will receive a password reset link shortly.",
      });
    }

    const resetToken = generateToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    await sendPasswordResetEmail(user.name, email, resetToken);
    res.json({
      message:
        "If an account exists with this email, you will receive a password reset link shortly.",
    });
  } catch (err) {
    console.error("[Auth] Forgot password error:", err);
    res
      .status(500)
      .json({ error: "Failed to send reset email. Please try again." });
  }
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const token = readCredential(req.body?.token);
    const password = readCredential(req.body?.password);
    if (!token || !password)
      return res
        .status(400)
        .json({ error: "Token and new password are required." });
    if (password.length < 8)
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters." });

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: mongoose.trusted({ $gt: new Date() }),
    }).select("+resetPasswordToken +resetPasswordExpiry +password");

    if (!user)
      return res
        .status(400)
        .json({
          error: "Invalid or expired reset link. Please request a new one.",
          expired: true,
        });

    user.password = password; // pre-save hook hashes it
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.json({
      message:
        "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (err) {
    console.error("[Auth] Reset password error:", err);
    res.status(500).json({ error: "Password reset failed. Please try again." });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get("/me", protect, async (req, res) => {
  try {
    res.json({ user: serializeUser(req.user) });
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
  res.json({ message: "Logged out." });
});

// ── POST /auth/change-password (authenticated) ────────────────────────────────
router.post("/change-password", protect, async (req, res) => {
  try {
    const currentPassword = readCredential(req.body?.currentPassword);
    const newPassword = readCredential(req.body?.newPassword);
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ error: "Current and new password are required." });
    if (newPassword.length < 8)
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters." });

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(401).json({ error: "User not found." });
    if (!(await user.comparePassword(currentPassword)))
      return res.status(400).json({ error: "Current password is incorrect." });

    user.password = newPassword;
    await user.save();
    res.json({ message: "Password changed successfully." });
  } catch {
    res
      .status(500)
      .json({ error: "Failed to change password. Please try again." });
  }
});

export default router;
