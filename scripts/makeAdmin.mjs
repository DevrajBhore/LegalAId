/**
 * makeAdmin.mjs — grant (or revoke) admin to a user by email.
 *
 *   node scripts/makeAdmin.mjs you@example.com           # grant admin
 *   node scripts/makeAdmin.mjs you@example.com --revoke  # revoke admin
 *
 * Needs MONGODB_URI in the environment (or backend/.env). On Render, run it from
 * the service Shell. Locally, ensure backend/.env has MONGODB_URI.
 */
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env from backend/.env, then root .env (first wins).
dotenv.config({ path: path.resolve(__dirname, "../backend/.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const email = process.argv.find((a) => a.includes("@"));
const revoke = process.argv.includes("--revoke");

if (!email) {
  console.error("Usage: node scripts/makeAdmin.mjs <email> [--revoke]");
  process.exit(1);
}
if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set (check backend/.env or your environment).");
  process.exit(1);
}

const { default: User } = await import(
  "file://" + path.resolve(__dirname, "../backend/models/User.js").replace(/\\/g, "/")
);

await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOne({ email: email.toLowerCase() });

if (!user) {
  console.error(`No user found with email "${email}". Register that account first.`);
  await mongoose.disconnect();
  process.exit(1);
}

user.isAdmin = !revoke;
await user.save();
console.log(`✅ ${user.email} isAdmin = ${user.isAdmin}`);
await mongoose.disconnect();
process.exit(0);
