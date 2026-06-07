import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Minimal cookie reader (avoids adding a cookie-parser dependency).
function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }
  return null;
}

export async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    // Accept either a Bearer header (localStorage flow) or the httpOnly cookie.
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : readCookie(req, "legalaid_token");

    if (!token) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id)
      .select("_id name email phone isVerified isAdmin createdAt")
      .lean();
    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }
    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email to continue." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

// Must be mounted after `protect` so req.user is populated.
export function requireAdmin(req, res, next) {
  if (!req.user?.isAdmin) {
    return res
      .status(403)
      .json({ error: "Administrator access is required for this action." });
  }
  next();
}