/**
 * originPolicy.js — which browser origins may talk to this API with credentials.
 *
 * CLIENT_URL is a single origin or a comma-separated list. In production it is
 * REQUIRED: the old fallback reflected any request origin with credentials
 * enabled, which, with a SameSite=None session cookie, let any website make
 * authenticated requests on a signed-in user's behalf.
 *
 * Without CLIENT_URL outside production, only loopback origins (localhost,
 * 127.0.0.1, [::1], any port) are allowed, so local development still works.
 */

// Browser Origin headers never carry a trailing slash while CLIENT_URL often
// does, so both sides are normalized the same way.
export const normalizeOrigin = (value) =>
  String(value || "").trim().replace(/\/+$/, "").toLowerCase();

export function isProductionEnv(env = process.env) {
  return env.NODE_ENV === "production" || Boolean(env.RENDER);
}

export function configuredOrigins(env = process.env) {
  return String(env.CLIENT_URL || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function isOriginAllowed(origin, env = process.env) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  const allowed = configuredOrigins(env);
  if (allowed.length) return allowed.includes(normalized);
  if (isProductionEnv(env)) return false;
  return LOOPBACK_ORIGIN.test(normalized);
}

// A page served by this same host (no cross-site hop) is not a CSRF vector.
function isSameHost(origin, req) {
  const host = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for cookie-authenticated, state-changing requests.
 *
 * A Bearer-token request cannot be forged cross-site (the attacker cannot read
 * the token), so it passes. A cookie-authenticated POST/PUT/PATCH/DELETE must
 * come from an allowed origin. Browsers always send Origin on cross-site
 * unsafe requests; when Origin is absent we fall back to Referer. A request
 * with neither is not from a browser page and is allowed (server-to-server
 * clients do not hold the session cookie).
 */
export function isCrossSiteCookieRequest(req, env = process.env) {
  const method = String(req.method || "GET").toUpperCase();
  if (SAFE_METHODS.has(method)) return false;

  const origin = req.headers?.origin;
  if (origin && origin !== "null") {
    return !isOriginAllowed(origin, env) && !isSameHost(origin, req);
  }
  if (origin === "null") return true; // sandboxed / opaque origin

  const referer = req.headers?.referer;
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      return !isOriginAllowed(refererOrigin, env) && !isSameHost(refererOrigin, req);
    } catch {
      return true;
    }
  }
  return false;
}
