import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSubordinateDirectoryMetadata } from "../../../shared/subordinateDirectory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findKBSubordinatePath() {
  const candidates = [
    path.resolve(__dirname, "../../../knowledge-base/subordinate"),
    path.resolve(__dirname, "../../../../knowledge-base/subordinate"),
    path.resolve(
      __dirname,
      "../../../../knowledge-base/knowledge-base/subordinate"
    ),
    path.resolve(
      __dirname,
      "../../../knowledge-base/knowledge-base/subordinate"
    ),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

const KB_SUBORDINATE_PATH = findKBSubordinatePath();
const SUBORDINATE_INDEX_CACHE = new Map();
const KNOWN_CATEGORIES = new Set([
  "rules",
  "regulations",
  "notifications",
  "circulars",
  "orders",
  "ordinances",
  "statutes",
]);

function parsePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeCategory(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "");

  if (!normalized) return "other";

  const aliases = {
    rule: "rules",
    rules: "rules",
    regulation: "regulations",
    regulations: "regulations",
    notification: "notifications",
    notifications: "notifications",
    circular: "circulars",
    circulars: "circulars",
    order: "orders",
    orders: "orders",
    ordinance: "ordinances",
    ordinances: "ordinances",
    statute: "statutes",
    statutes: "statutes",
  };

  return aliases[normalized] || "other";
}

function summarizeCategoriesFromFolder(actId) {
  const { directoryKey } = getSubordinateDirectoryMetadata(actId);
  const dirPath = path.join(KB_SUBORDINATE_PATH, directoryKey);
  if (!fs.existsSync(dirPath)) {
    return { category_counts: {}, top_categories: [] };
  }

  const categoryCounts = {};
  const files = fs
    .readdirSync(dirPath)
    .filter((name) => name.endsWith(".json") && name !== "index.json");

  for (const file of files) {
    let category = normalizeCategory(file.split("_")[0]);

    if (category === "other") {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(dirPath, file), "utf8")
        );
        category = normalizeCategory(raw.type || raw.category_label);
      } catch {
        category = "other";
      }
    }

    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }

  const sorted = Object.entries(categoryCounts).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });

  return {
    category_counts: categoryCounts,
    top_categories: sorted
      .filter(([category]) => category !== "other")
      .slice(0, 3)
      .map(([category, count]) => ({ category, count })),
  };
}

function readSubordinateIndex(actId) {
  const { directoryKey } = getSubordinateDirectoryMetadata(actId);
  const indexPath = path.join(KB_SUBORDINATE_PATH, directoryKey, "index.json");

  if (!fs.existsSync(indexPath)) {
    SUBORDINATE_INDEX_CACHE.set(actId, null);
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const categorySummary =
      raw.has_subordinate_legislation === true && parsePositiveInteger(raw.count) > 0
        ? summarizeCategoriesFromFolder(actId)
        : { category_counts: {}, top_categories: [] };
    const summary = {
      act_id: raw.act_id || actId,
      has_subordinate_legislation: raw.has_subordinate_legislation === true,
      possible_subordinate_legislation:
        raw.possible_subordinate_legislation === true,
      count: parsePositiveInteger(raw.count),
      detection_status: raw.detection_status || "unknown",
      legal_conclusion: raw.legal_conclusion || "unknown",
      confidence: raw.confidence || "unknown",
      detection_version: raw.detection_version || 0,
      failed_candidate_count: parsePositiveInteger(
        raw?.evidence?.failed_candidate_count
      ),
      category_counts: categorySummary.category_counts,
      top_categories: categorySummary.top_categories,
      known_category_count: Object.entries(categorySummary.category_counts)
        .filter(([category]) => KNOWN_CATEGORIES.has(category))
        .reduce((sum, [, count]) => sum + count, 0),
      evidence: raw.evidence || {},
      note: raw.note || "",
    };

    SUBORDINATE_INDEX_CACHE.set(actId, summary);
    return summary;
  } catch (error) {
    console.warn(
      `[IRE] Failed to load subordinate index for ${actId}: ${error.message}`
    );
    SUBORDINATE_INDEX_CACHE.set(actId, null);
    return null;
  }
}

export function loadSubordinateIndexForAct(actId) {
  if (!actId) return null;
  if (SUBORDINATE_INDEX_CACHE.has(actId)) {
    return SUBORDINATE_INDEX_CACHE.get(actId);
  }

  return readSubordinateIndex(actId);
}

export function loadSubordinateIndexesForActs(actIds = []) {
  const uniqueActIds = [...new Set(actIds.filter(Boolean))];
  return uniqueActIds
    .map((actId) => loadSubordinateIndexForAct(actId))
    .filter(Boolean);
}
