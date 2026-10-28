/**
 * originPolicy.test.mjs — CREDENTIALED CORS FAILS CLOSED; COOKIE CSRF IS CHECKED;
 * ANY CONFIGURED AI PROVIDER IS DETECTED
 *
 * 1. Without CLIENT_URL the backend used to reflect every request origin with
 *    credentials enabled. Production now requires CLIENT_URL; development
 *    without it allows loopback only.
 * 2. A cookie-authenticated, state-changing request from a foreign origin is
 *    refused (the production cookie is SameSite=None).
 * 3. hasSemanticProviderConfigured checked only GEMINI/GROQ keys; an
 *    OpenAI-only configuration never entered semantic drafting.
 */
import assert from "node:assert/strict";
import {
  isOriginAllowed,
  isCrossSiteCookieRequest,
  isProductionEnv,
} from "../backend/auth/originPolicy.js";

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
  console.log(`PASS  ${msg}`);
};

const prod = { NODE_ENV: "production", CLIENT_URL: "https://legalaid.example/, https://www.legalaid.example" };
const prodNoClient = { NODE_ENV: "production" };
const renderNoClient = { RENDER: "true" };
const dev = {};

/* ── Origin allowlist ───────────────────────────────────────────────────── */
ok(isOriginAllowed("https://legalaid.example", prod), "configured origin is allowed (trailing slash normalized)");
ok(isOriginAllowed("https://WWW.legalaid.example", prod), "configured origins match case-insensitively");
ok(!isOriginAllowed("https://evil.example", prod), "unlisted origin is refused in production");
ok(!isOriginAllowed("https://evil.example", prodNoClient), "production without CLIENT_URL refuses foreign origins");
ok(!isOriginAllowed("http://localhost:5173", prodNoClient), "production without CLIENT_URL does not fall back to loopback");
ok(isProductionEnv(renderNoClient), "running on Render counts as production");
ok(isOriginAllowed("http://localhost:5173", dev), "development without CLIENT_URL allows localhost");
ok(isOriginAllowed("http://127.0.0.1:3000", dev), "development without CLIENT_URL allows 127.0.0.1");
ok(!isOriginAllowed("https://evil.example", dev), "development without CLIENT_URL refuses non-loopback origins");
ok(!isOriginAllowed("http://localhost.evil.example", dev), "loopback match is exact, not a prefix");

/* ── Cookie CSRF guard ──────────────────────────────────────────────────── */
const req = (method, headers = {}) => ({ method, headers: { host: "api.legalaid.example", ...headers } });
ok(!isCrossSiteCookieRequest(req("GET", { origin: "https://evil.example" }), prod), "safe methods are not CSRF-checked");
ok(isCrossSiteCookieRequest(req("POST", { origin: "https://evil.example" }), prod), "cross-site cookie POST is refused");
ok(isCrossSiteCookieRequest(req("DELETE", { referer: "https://evil.example/page" }), prod), "cross-site DELETE identified by Referer is refused");
ok(isCrossSiteCookieRequest(req("POST", { origin: "null" }), prod), "opaque (null) origin is refused");
ok(!isCrossSiteCookieRequest(req("POST", { origin: "https://legalaid.example" }), prod), "allowed-origin cookie POST passes");
ok(!isCrossSiteCookieRequest(req("POST", { origin: "https://api.legalaid.example" }), prod), "same-host POST passes");
ok(!isCrossSiteCookieRequest(req("POST"), prod), "a request with no Origin or Referer (not a browser page) passes");

/* ── Provider detection ─────────────────────────────────────────────────── */
const saved = { ...process.env };
// Blank rather than delete: backend/loadEnv.js runs dotenv on import, which
// fills in variables that are absent but never overrides ones already set.
for (const key of ["GEMINI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY", "AI_PROVIDER", "AI_FALLBACK_PROVIDER"]) {
  process.env[key] = "";
}
const { hasConfiguredProvider, getProviderChain } = await import("../backend/ai/providers.js");
try {
  ok(!hasConfiguredProvider(), "no keys: no provider configured");
  process.env.OPENAI_API_KEY = "test-key";
  ok(hasConfiguredProvider(), "OpenAI-only configuration counts as a configured provider");
  ok(getProviderChain()[0].name === "openai",
    "OpenAI-only configuration routes calls to OpenAI even with the default primary unset");
  process.env.GEMINI_API_KEY = "test-key";
  ok(getProviderChain()[0].name === "gemini", "a configured primary still takes precedence");
} finally {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
  Object.assign(process.env, saved);
}

console.log(`\nALL GREEN (${checks} checks)`);
