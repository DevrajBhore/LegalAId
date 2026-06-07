import crypto from "crypto";

import { slugify } from "../indiaCode/baseScraper.js";

export function normalizeText(value = "") {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashId(value = "") {
  return crypto
    .createHash("sha1")
    .update(String(value || ""))
    .digest("hex")
    .slice(0, 12);
}

export function safeSlug(value = "", fallback = "item", maxLength = 80) {
  const slug = slugify(String(value || ""))
    .slice(0, maxLength)
    .replace(/_+$/g, "");
  return slug || fallback;
}

export function buildStableId(prefix, title, key) {
  const stableKey = key || title || prefix;
  return `${prefix}_${safeSlug(title || stableKey, prefix)}_${hashId(stableKey)}`;
}

export function absoluteUrl(href, baseUrl) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

export function cleanCheerioText($, selector) {
  return normalizeText($(selector).text());
}

export function extractLabelValue(text, label) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(text || "").match(
    new RegExp(`${escaped}\\s*:?\\s*([^\\n\\r]+?)(?=\\s+[A-Z][A-Za-z ]{2,}\\s*:|$)`, "i")
  );
  return normalizeText(match?.[1] || "");
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(item);
  }

  return unique;
}
