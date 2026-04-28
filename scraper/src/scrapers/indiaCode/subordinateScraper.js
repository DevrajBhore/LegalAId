import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import crypto from "crypto";

import { fetchHtml } from "../../common/request.js";
import { fetchPDFText, fetchPageText, makeActId } from "./baseScraper.js";
import { kbRoot, saveJSON, exists } from "../../storage/fileStorage.js";
import { getSubordinateDirectoryMetadata } from "../../../../shared/subordinateDirectory.js";

const BASE_URL = "https://www.indiacode.nic.in";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ACTS_DIR = path.join(kbRoot, "acts");
const SUBORDINATE_DIR = path.join(kbRoot, "subordinate");
const DETECTION_VERSION = 10;
// Keep subordinate file names conservative so Git on Windows can still index
// them even when the parent act folder name is long.
const MAX_SUBORDINATE_ID_LENGTH = 96;
const STABLE_ZERO_COUNT_STATUSES = new Set([
  "no_linked_subordinate_detected",
  "possible_mentions_without_linked_sources",
]);

const SUBORDINATE_KEYWORDS = [
  "rule",
  "rules",
  "regulation",
  "regulations",
  "order",
  "orders",
  "scheme",
  "schemes",
  "notification",
  "notifications",
  "direction",
  "directions",
  "guideline",
  "guidelines",
  "by-law",
  "by-laws",
  "bye-law",
  "bye-laws",
  "circular",
  "circulars",
  "ordinance",
  "ordinances",
];

const GENERIC_NAV_TITLES = new Set([
  "rules",
  "regulations",
  "notifications",
  "orders",
  "ordinances",
  "statutes",
  "circulars",
  "subordinate legislations",
  "all acts",
  "sections",
  "income-tax and other direct taxes",
  "go!",
  "ok",
  "cancel",
]);

const GENERIC_SHELL_KEYWORDS = new Set([
  "rules",
  "regulations",
  "notifications",
  "orders",
  "ordinances",
  "circulars",
]);

function shouldRecoverFailedCandidates(options = {}) {
  if (options?.recoverFailedCandidates === true) return true;
  return /^(1|true|yes)$/i.test(
    String(process.env.SCRAPER_RECOVER_FAILED_SUBORDINATE || "false")
  );
}

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeComparableText(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\bcus\b/g, "customs")
    .replace(/\bcust\b/g, "customs")
    .replace(/\bcir\b/g, "circular")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeSourceUrl(url = "") {
  const trimmed = String(url || "").trim();
  const preserved = [];
  const protectedValue = trimmed.replace(/%[0-9A-Fa-f]{2}/g, (match) => {
    preserved.push(match);
    return `__PRESERVED_PERCENT_${preserved.length - 1}__`;
  });

  return encodeURI(protectedValue).replace(
    /__PRESERVED_PERCENT_(\d+)__/g,
    (_, index) => preserved[Number(index)]
  );
}

function resolveSourceUrl(href = "") {
  const normalizedHref = String(href || "").trim();
  if (!normalizedHref) return null;
  if (/^https?:\/\//i.test(normalizedHref)) return normalizeSourceUrl(normalizedHref);
  if (normalizedHref.startsWith("/")) return normalizeSourceUrl(`${BASE_URL}${normalizedHref}`);
  return normalizeSourceUrl(`${BASE_URL}/${normalizedHref.replace(/^\.?\//, "")}`);
}

function containsSubordinateSignal(value = "") {
  const text = normalizeText(value).toLowerCase();
  return SUBORDINATE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isGenericNavigationTitle(title = "") {
  return GENERIC_NAV_TITLES.has(normalizeText(title).toLowerCase());
}

function isLikelyDocumentUrl(url = "") {
  const normalized = String(url || "").trim().toLowerCase();
  if (!normalized || normalized.endsWith("/#") || normalized.endsWith("#")) {
    return false;
  }

  return (
    normalized.includes("/handle/") ||
    normalized.includes("/bitstream/") ||
    normalized.endsWith(".pdf")
  );
}

function isGenericIndiaCodeShell(text = "") {
  const normalized = normalizeText(text).toLowerCase();
  return (
    normalized.includes("india code search hint") &&
    normalized.includes("all acts sections subordinate legislations")
  );
}

function buildKeywordHits(pageText = "") {
  const haystack = normalizeText(pageText).toLowerCase();
  const keywordHits = {};

  for (const keyword of SUBORDINATE_KEYWORDS) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, "g"));
    if (matches?.length) {
      keywordHits[keyword] = matches.length;
    }
  }

  return keywordHits;
}

function buildContextSignals(pageText = "") {
  const haystack = normalizeText(pageText);
  if (!haystack) {
    return [];
  }

  const patterns = [
    /\b(rules?|regulations?|orders?|notifications?|directions?|guidelines?|schemes?|circulars?|ordinances?)\b.{0,40}\b(?:made|framed|issued|published|prescribed)\b.{0,40}\b(?:under|thereunder|under this act|under the act)\b/gi,
    /\b(?:under|thereunder|under this act|under the act)\b.{0,40}\b(rules?|regulations?|orders?|notifications?|directions?|guidelines?|schemes?|circulars?|ordinances?)\b/gi,
    /\b(power to make|power to issue|may make|may issue)\b.{0,80}\b(rules?|regulations?|orders?|notifications?|directions?|guidelines?|schemes?|circulars?|ordinances?)\b/gi,
  ];

  const matches = new Set();
  for (const pattern of patterns) {
    for (const match of haystack.matchAll(pattern)) {
      const snippet = normalizeText(match[0]).slice(0, 220);
      if (snippet) {
        matches.add(snippet);
      }
    }
  }

  return [...matches].slice(0, 8);
}

function totalHits(keywordHits = {}) {
  return Object.values(keywordHits).reduce((sum, value) => sum + value, 0);
}

function shouldTreatKeywordHitsAsShellNoise(keywordHits = {}, pageText = "") {
  const keys = Object.keys(keywordHits);
  if (keys.length === 0) {
    return false;
  }

  if (!isGenericIndiaCodeShell(pageText)) {
    return false;
  }

  return keys.every((key) => GENERIC_SHELL_KEYWORDS.has(key));
}

function collectCandidateLinks($) {
  const candidates = [];

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    const title = normalizeText($(element).text());
    const absoluteUrl = resolveSourceUrl(href);

    if (!absoluteUrl) {
      return;
    }

    if (!containsSubordinateSignal(title)) {
      return;
    }

    if (isGenericNavigationTitle(title)) {
      return;
    }

    if (!isLikelyDocumentUrl(absoluteUrl)) {
      return;
    }

    candidates.push({
      title,
      url: absoluteUrl,
    });
  });

  return dedupeLinkedCandidates(candidates);
}

function inferTypeFromLabel(label = "") {
  const normalized = normalizeText(label).toLowerCase();
  if (normalized.includes("rule")) return "rules";
  if (normalized.includes("regulation")) return "regulations";
  if (normalized.includes("notification")) return "notification";
  if (normalized.includes("order")) return "order";
  if (normalized.includes("circular")) return "circular";
  if (normalized.includes("ordinance")) return "ordinance";
  if (normalized.includes("statute")) return "statute";
  if (normalized.includes("guideline")) return "guideline";
  if (normalized.includes("direction")) return "direction";
  if (normalized.includes("scheme")) return "scheme";
  if (normalized.includes("by-law") || normalized.includes("bye-law")) return "by-laws";
  return "unknown";
}

function buildBoundedSubordinateId(value = "") {
  const baseId = makeActId(value, "");
  if (baseId.length <= MAX_SUBORDINATE_ID_LENGTH) {
    return baseId;
  }

  const hash = crypto.createHash("sha1").update(baseId).digest("hex").slice(0, 12);
  const prefixLength = MAX_SUBORDINATE_ID_LENGTH - hash.length - 1;
  const prefix = baseId.slice(0, prefixLength).replace(/_+$/g, "");
  return `${prefix}_${hash}`;
}

function buildModalEntryIdentity(label = "", row = {}) {
  return normalizeText(
    [
      label,
      row.year || "undated",
      row.description || row.fileTitle || "document",
      row.fileTitle || "",
      row.sourceUrl || "",
    ].join("::")
  );
}

function buildModalLogicalKey(label = "", row = {}) {
  return [
    normalizeComparableText(label),
    normalizeComparableText(row.year || "undated"),
    normalizeComparableText(row.description || row.fileTitle || "document"),
  ].join("::");
}

function buildCandidateLogicalKey(candidate = {}) {
  return normalizeComparableText(candidate.title || candidate.url || "candidate");
}

function buildModalRowId(label = "", row = {}) {
  const readableId = `${label}_${row.year || "undated"}_${row.description || row.fileTitle || "document"}`;
  const identityHash = crypto
    .createHash("sha1")
    .update(buildModalEntryIdentity(label, row))
    .digest("hex")
    .slice(0, 12);

  return buildBoundedSubordinateId(`${readableId}_${identityHash}`);
}

function buildCandidateId(candidate = {}) {
  const readableId = candidate.title || candidate.url || "subordinate_document";
  const identityHash = crypto
    .createHash("sha1")
    .update(
      normalizeText(
        [candidate.title || "", candidate.url || ""].join("::")
      )
    )
    .digest("hex")
    .slice(0, 12);

  return buildBoundedSubordinateId(`${readableId}_${identityHash}`);
}

function scoreEntryQuality(entry = {}) {
  let score = 0;
  const description = normalizeText(entry.description || entry.title || "");
  const fileTitle = normalizeText(entry.fileTitle || "");
  const url = normalizeText(entry.sourceUrl || entry.url || "");

  if (description) score += 20 + Math.min(description.length, 120);
  if (fileTitle) score += 10 + Math.min(fileTitle.length, 60);
  if (url) score += 5;
  if (/\b(notification|circular|regulation|rule|order|scheme|ordinance)\b/i.test(description)) {
    score += 10;
  }
  if (/\bno\.?\s*\d|\b\d+\/\d{4}\b/i.test(description)) {
    score += 8;
  }
  if (/\(\d+\)\.pdf$/i.test(fileTitle)) {
    score -= 3;
  }
  if (/^[a-z]{2,5}\d{1,4}[-_]/i.test(fileTitle)) {
    score -= 1;
  }

  return score;
}

function mergeUniqueValues(values = []) {
  const seen = new Set();
  const merged = [];
  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
}

function choosePreferredEntry(current, candidate) {
  const currentScore = scoreEntryQuality(current);
  const candidateScore = scoreEntryQuality(candidate);
  if (candidateScore > currentScore) return candidate;
  if (candidateScore < currentScore) return current;

  const currentDescLength = normalizeText(current.description || current.title || "").length;
  const candidateDescLength = normalizeText(candidate.description || candidate.title || "").length;
  if (candidateDescLength > currentDescLength) return candidate;
  if (candidateDescLength < currentDescLength) return current;

  return String(candidate.sourceUrl || candidate.url || "") <
    String(current.sourceUrl || current.url || "")
    ? candidate
    : current;
}

function mergeDuplicateMetadata(primary, duplicate) {
  return {
    ...primary,
    alternateSourceUrls: mergeUniqueValues([
      ...(primary.alternateSourceUrls || []),
      duplicate.sourceUrl || duplicate.url || "",
      ...(duplicate.alternateSourceUrls || []),
    ]),
    alternateFileTitles: mergeUniqueValues([
      ...(primary.alternateFileTitles || []),
      duplicate.fileTitle || "",
      ...(duplicate.alternateFileTitles || []),
    ]),
    alternateDescriptions: mergeUniqueValues([
      ...(primary.alternateDescriptions || []),
      duplicate.description || duplicate.title || "",
      ...(duplicate.alternateDescriptions || []),
    ]),
    duplicateCount:
      Number(primary.duplicateCount || 0) +
      Number(duplicate.duplicateCount || 0) +
      1,
  };
}

function dedupeModalEntries(entries = []) {
  const bySource = new Map();
  const byLogicalKey = new Map();

  for (const entry of entries) {
    const sourceKey = `${normalizeComparableText(entry.label)}::${normalizeSourceUrl(
      entry.sourceUrl || ""
    ).toLowerCase()}`;
    if (sourceKey !== "::" && bySource.has(sourceKey)) {
      const merged = mergeDuplicateMetadata(
        choosePreferredEntry(bySource.get(sourceKey), entry),
        choosePreferredEntry(bySource.get(sourceKey), entry) === bySource.get(sourceKey)
          ? entry
          : bySource.get(sourceKey)
      );
      bySource.set(sourceKey, merged);
      continue;
    }

    bySource.set(sourceKey, {
      ...entry,
      duplicateCount: Number(entry.duplicateCount || 0),
      alternateSourceUrls: entry.alternateSourceUrls || [],
      alternateFileTitles: entry.alternateFileTitles || [],
      alternateDescriptions: entry.alternateDescriptions || [],
    });
  }

  for (const entry of bySource.values()) {
    const logicalKey = buildModalLogicalKey(entry.label, entry);
    if (byLogicalKey.has(logicalKey)) {
      const existing = byLogicalKey.get(logicalKey);
      const preferred = choosePreferredEntry(existing, entry);
      const duplicate = preferred === existing ? entry : existing;
      byLogicalKey.set(logicalKey, mergeDuplicateMetadata(preferred, duplicate));
      continue;
    }

    byLogicalKey.set(logicalKey, entry);
  }

  return [...byLogicalKey.values()].map((entry) => ({
    ...entry,
    alternateSourceUrls: mergeUniqueValues(entry.alternateSourceUrls || []),
    alternateFileTitles: mergeUniqueValues(entry.alternateFileTitles || []),
    alternateDescriptions: mergeUniqueValues(entry.alternateDescriptions || []),
    duplicateCount: Number(entry.duplicateCount || 0),
    subId: buildModalRowId(entry.label, entry),
  }));
}

function dedupeLinkedCandidates(candidates = []) {
  const bySource = new Map();
  const byLogicalKey = new Map();

  for (const candidate of candidates) {
    const sourceKey = normalizeSourceUrl(candidate.url || "").toLowerCase();
    if (sourceKey && bySource.has(sourceKey)) {
      const existing = bySource.get(sourceKey);
      const preferred = choosePreferredEntry(existing, candidate);
      const duplicate = preferred === existing ? candidate : existing;
      bySource.set(sourceKey, mergeDuplicateMetadata(preferred, duplicate));
      continue;
    }

    bySource.set(sourceKey, {
      ...candidate,
      duplicateCount: Number(candidate.duplicateCount || 0),
      alternateSourceUrls: candidate.alternateSourceUrls || [],
      alternateFileTitles: candidate.alternateFileTitles || [],
      alternateDescriptions: candidate.alternateDescriptions || [],
    });
  }

  for (const candidate of bySource.values()) {
    const logicalKey = buildCandidateLogicalKey(candidate);
    if (byLogicalKey.has(logicalKey)) {
      const existing = byLogicalKey.get(logicalKey);
      const preferred = choosePreferredEntry(existing, candidate);
      const duplicate = preferred === existing ? candidate : existing;
      byLogicalKey.set(logicalKey, mergeDuplicateMetadata(preferred, duplicate));
      continue;
    }

    byLogicalKey.set(logicalKey, candidate);
  }

  return [...byLogicalKey.values()].map((candidate) => ({
    ...candidate,
    alternateSourceUrls: mergeUniqueValues(candidate.alternateSourceUrls || []),
    alternateDescriptions: mergeUniqueValues(candidate.alternateDescriptions || []),
    duplicateCount: Number(candidate.duplicateCount || 0),
    subId: buildCandidateId(candidate),
  }));
}

function isPdfLikeSource(entry = {}) {
  const url = String(entry.sourceUrl || "").toLowerCase();
  const fileTitle = String(entry.fileTitle || "").toLowerCase();
  return url.includes(".pdf") || fileTitle.endsWith(".pdf");
}

async function enrichModalEntry(entry) {
  try {
    if (isPdfLikeSource(entry)) {
      const parsed = await fetchPDFText(entry.sourceUrl);
      return {
        text: parsed.text || entry.description || entry.fileTitle || entry.label,
        extraction: {
          content_type: parsed.contentType || "application/pdf",
          final_url: parsed.finalUrl || entry.sourceUrl,
          num_pages: parsed.numPages ?? null,
          parser: parsed.text ? "pdf-parse" : null,
          status: parsed.text
            ? "parsed"
            : parsed.sourceError
              ? "source_error"
              : "empty",
          error_message: parsed.sourceError?.message || null,
          error_code: parsed.sourceError?.code || null,
          error_status: parsed.sourceError?.status || null,
          recovered_from_alternate_source:
            parsed.recoveredFromAlternate === true,
          attempted_urls: parsed.attemptedUrls || [entry.sourceUrl],
          recovery_attempts: parsed.attempts || [],
        },
      };
    }

    const page = await fetchPageText(entry.sourceUrl);
    return {
      text: page.text || entry.description || entry.fileTitle || entry.label,
      extraction: {
        content_type: "text/html",
        final_url: page.url || entry.sourceUrl,
        num_pages: null,
        parser: "html-extract",
        status: page.text ? "parsed" : "empty",
        error_message: null,
        error_code: null,
        error_status: null,
        recovered_from_alternate_source: false,
        attempted_urls: [entry.sourceUrl],
        recovery_attempts: [],
      },
    };
  } catch (error) {
    return {
      text: entry.description || entry.fileTitle || entry.label,
      extraction: {
        content_type: isPdfLikeSource(entry) ? "application/pdf" : "text/html",
        final_url: entry.sourceUrl,
        num_pages: null,
        parser: null,
        status: "source_error",
        error_message: error?.message || String(error),
        error_code: "source_fetch_failed",
        error_status: null,
        recovered_from_alternate_source: false,
        attempted_urls: [entry.sourceUrl],
        recovery_attempts: [],
      },
    };
  }
}

function parseModalTableEntries($) {
  const entries = [];

  $(".modal-body").each((_, element) => {
    const body = $(element);
    const label = normalizeText(body.find("label.subordinate").first().text());
    const table = body.find("table").first();

    if (!label || table.length === 0) {
      return;
    }

    const subordinateType = inferTypeFromLabel(label);

    body.find("tbody tr").each((rowIndex, rowElement) => {
      const row = $(rowElement);
      const cells = row.find("td");
      if (cells.length === 0) {
        return;
      }

      const year = normalizeText($(cells[0]).text());
      const description = normalizeText($(cells[1]).text());
      const hindiDescription = normalizeText($(cells[2]).text());
      const fileAnchor = $(cells[3]).find("a[href]").first();
      const hindiFileAnchor = $(cells[4]).find("a[href]").first();

      const href = fileAnchor.attr("href") || hindiFileAnchor.attr("href") || "";
      const sourceUrl = resolveSourceUrl(href);
      const fileTitle =
        normalizeText(fileAnchor.attr("title")) ||
        normalizeText(hindiFileAnchor.attr("title"));

      if (!sourceUrl || (!description && !fileTitle)) {
        return;
      }

      entries.push({
        rowIndex,
        label,
        type: subordinateType,
        year,
        description,
        hindiDescription,
        sourceUrl,
        fileTitle,
      });
    });
  });

  return dedupeModalEntries(entries);
}

function createBaseIndexPayload({
  act,
  storageDirectoryKey,
  candidates,
  modalEntries = [],
  keywordHits,
  contextSignals = [],
  detectionStatus,
  legalConclusion,
  confidence = "low",
  count = 0,
  possibleSubordinateLegislation = false,
  note,
  failedCandidates = [],
} = {}) {
    return {
      act_id: act.act_id,
      storage_directory_key: storageDirectoryKey || act.act_id,
      has_subordinate_legislation: count > 0,
    possible_subordinate_legislation:
      possibleSubordinateLegislation || candidates.length > count,
    count,
    detection_status: detectionStatus,
    legal_conclusion: legalConclusion,
    confidence,
    detection_version: DETECTION_VERSION,
    note,
    evidence: {
      candidate_link_count: candidates.length,
      candidate_duplicate_count: candidates.reduce(
        (sum, entry) => sum + Number(entry.duplicateCount || 0),
        0
      ),
      modal_entry_count: modalEntries.length,
      modal_duplicate_count: modalEntries.reduce(
        (sum, entry) => sum + Number(entry.duplicateCount || 0),
        0
      ),
      successful_candidate_count: count,
      failed_candidate_count: failedCandidates.length,
      keyword_hits: keywordHits,
      context_signals: contextSignals,
      scanned_source_url: act.source_url,
      scanned_at: new Date().toISOString(),
    },
    failed_candidates: failedCandidates,
  };
}

async function shouldSkipExistingIndex(indexPath, options = {}) {
  const status = await getExistingIndexStatus(indexPath, options);
  if (!status.skip) {
    logExistingIndexDecision(indexPath, status);
  }
  return status.skip;
}

async function getExistingIndexStatus(indexPath, options = {}) {
  if (!exists(indexPath)) {
    return { skip: false, reason: "missing_index" };
  }

  try {
    const absolutePath = path.join(SUBORDINATE_DIR, indexPath.replace(/^subordinate[\\/]/, ""));
    const raw = await fs.readFile(absolutePath, "utf-8");
    const parsed = JSON.parse(raw);
    const actDir = path.dirname(absolutePath);
    let subordinateFileCount = 0;

    try {
      const entries = await fs.readdir(actDir, { withFileTypes: true });
      subordinateFileCount = entries.filter(
        (entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json"
      ).length;
    } catch {
      subordinateFileCount = 0;
    }

    if (!parsed?.detection_status || !parsed?.legal_conclusion) {
      return { skip: false, reason: "legacy_index_missing_fields" };
    }

    if (parsed?.detection_version !== DETECTION_VERSION) {
      return {
        skip: false,
        reason: "legacy_index_version",
        expectedVersion: DETECTION_VERSION,
        actualVersion: parsed?.detection_version ?? null,
      };
    }

    if (
      shouldRecoverFailedCandidates(options) &&
      Array.isArray(parsed?.failed_candidates) &&
      parsed.failed_candidates.length > 0
    ) {
      return {
        skip: false,
        reason: "recover_failed_candidates",
        failedCandidateCount: parsed.failed_candidates.length,
      };
    }

    const expectedCount = Number(parsed?.count || 0);

    if (expectedCount > 0) {
      if (subordinateFileCount !== expectedCount) {
        return {
          skip: false,
          reason: "count_mismatch",
          expectedCount,
          subordinateFileCount,
        };
      }

      return { skip: true, reason: "current_positive_index" };
    }

    if (subordinateFileCount > 0) {
      return {
        skip: false,
        reason: "zero_count_with_files",
        subordinateFileCount,
      };
    }

    if (!STABLE_ZERO_COUNT_STATUSES.has(parsed.detection_status)) {
      return {
        skip: false,
        reason: "unresolved_zero_count",
        detectionStatus: parsed.detection_status,
      };
    }

    if (
      parsed?.has_subordinate_legislation === false &&
      parsed?.count === 0 &&
      parsed?.failed_candidates?.length === 0
    ) {
      return { skip: true, reason: "stable_zero_count" };
    }

    return { skip: false, reason: "ambiguous_zero_count" };
  } catch (error) {
    return { skip: false, reason: "invalid_index", error: error?.message || String(error) };
  }
}

function logExistingIndexDecision(indexPath, status = {}) {
  switch (status.reason) {
    case "missing_index":
      console.log(`[Scraper] Missing subordinate index: ${indexPath}`);
      break;
    case "legacy_index_missing_fields":
      console.log(`[Scraper] Rescanning legacy subordinate index: ${indexPath}`);
      break;
    case "legacy_index_version":
      console.log(
        `[Scraper] Rescanning legacy subordinate index: ${indexPath} (expected v${status.expectedVersion}, found v${status.actualVersion ?? "unknown"})`
      );
      break;
    case "recover_failed_candidates":
      console.log(
        `[Scraper] Recovering failed subordinate candidates: ${indexPath} (${status.failedCandidateCount} unresolved)`
      );
      break;
    case "count_mismatch":
      console.log(
        `[Scraper] Rescanning inconsistent subordinate index: ${indexPath} (expected ${status.expectedCount}, found ${status.subordinateFileCount})`
      );
      break;
    case "zero_count_with_files":
      console.log(
        `[Scraper] Rescanning inconsistent zero-count index: ${indexPath} (found ${status.subordinateFileCount} subordinate files)`
      );
      break;
    case "unresolved_zero_count":
      console.log(
        `[Scraper] Rescanning unresolved zero-count index: ${indexPath} (${status.detectionStatus})`
      );
      break;
    case "ambiguous_zero_count":
      console.log(`[Scraper] Rescanning ambiguous subordinate index: ${indexPath}`);
      break;
    case "invalid_index":
      console.log(`[Scraper] Rescanning invalid subordinate index: ${indexPath}`);
      break;
    default:
      console.log(`[Scraper] Rescanning subordinate index: ${indexPath}`);
      break;
  }
}

function detectType(title = "") {
  const text = title.toLowerCase();
  if (text.includes("rule")) return "rules";
  if (text.includes("regulation")) return "regulations";
  if (text.includes("order")) return "order";
  if (text.includes("scheme")) return "scheme";
  if (text.includes("notification")) return "notification";
  if (text.includes("direction")) return "direction";
  if (text.includes("guideline")) return "guideline";
  if (text.includes("by-law") || text.includes("bye-law")) return "by-laws";
  if (text.includes("circular")) return "circular";
  if (text.includes("ordinance")) return "ordinance";
  return "unknown";
}

async function clearExistingSubordinateArtifacts(actId) {
  const { directoryKey } = getSubordinateDirectoryMetadata(actId);
  const actDir = path.join(SUBORDINATE_DIR, directoryKey);

  try {
    await fs.access(actDir);
  } catch {
    return;
  }

  const entries = await fs.readdir(actDir, { withFileTypes: true });
  for (const entry of entries) {
    const targetPath = path.join(actDir, entry.name);
    if (entry.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true });
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      await fs.rm(targetPath, { force: true });
    }
  }
}

async function scrapeSubordinateForAct(act, options = {}) {
  const actId = act.act_id;
  const { directoryKey } = getSubordinateDirectoryMetadata(actId);
  const actUrl = act.source_url;
  const indexPath = `subordinate/${directoryKey}/index.json`;
  const { bypassExistingCheck = false } = options;

  if (
    !bypassExistingCheck &&
    (await shouldSkipExistingIndex(indexPath, options))
  ) {
    return;
  }

  await clearExistingSubordinateArtifacts(actId);

  console.log(`[Scraper] Checking subordinate legislation for: ${act.title}`);

  const res = await fetchHtml(actUrl);
  const html = res.data ?? "";
  const $ = cheerio.load(html);
  const pageText = $.text();

  const candidates = collectCandidateLinks($);
  const modalEntries = parseModalTableEntries($);
  const rawKeywordHits = buildKeywordHits(pageText);
  const keywordHits = shouldTreatKeywordHitsAsShellNoise(rawKeywordHits, pageText)
    ? {}
    : rawKeywordHits;
  const contextSignals = buildContextSignals(pageText);
  const keywordHitTotal = totalHits(keywordHits);
  const hasContextualEvidence = contextSignals.length > 0;

  if (modalEntries.length > 0) {
    let count = 0;
    const failedCandidates = [];

    for (const entry of modalEntries) {
      try {
        const enriched = await enrichModalEntry(entry);
          const saved = await saveJSON(`subordinate/${directoryKey}/${entry.subId}.json`, {
            sub_id: entry.subId,
            parent_act_id: actId,
          title: entry.description || entry.fileTitle || entry.label,
          type: entry.type,
          category_label: entry.label,
          source: "IndiaCode",
          source_url: entry.sourceUrl,
          detection_method: "modal-table-scan",
          document_date: entry.year || null,
          description: entry.description,
          hindi_description: entry.hindiDescription || null,
          file_title: entry.fileTitle || null,
          duplicate_count: Number(entry.duplicateCount || 0),
          alternate_source_urls: mergeUniqueValues(entry.alternateSourceUrls || []),
          alternate_file_titles: mergeUniqueValues(entry.alternateFileTitles || []),
          alternate_descriptions: mergeUniqueValues(entry.alternateDescriptions || []),
          document_format: isPdfLikeSource(entry) ? "pdf" : "html",
          extraction: enriched.extraction,
          text: enriched.text,
          fetched_at: new Date().toISOString(),
        });

        const failedCandidateBase = {
          title: entry.description || entry.fileTitle || entry.label,
          url: entry.sourceUrl,
          attempted_urls: enriched.extraction.attempted_urls || [entry.sourceUrl],
          recovery_attempts: enriched.extraction.recovery_attempts || [],
        };

        if (!saved) {
          failedCandidates.push({
            ...failedCandidateBase,
            error: "write_failed",
          });
          continue;
        }

        if (enriched.extraction.status === "source_error") {
          failedCandidates.push({
            ...failedCandidateBase,
            error: enriched.extraction.error_message || "source_error",
            error_code: enriched.extraction.error_code || null,
            error_status: enriched.extraction.error_status || null,
          });
        }

        count += 1;
      } catch (error) {
        failedCandidates.push({
          title: entry.description || entry.fileTitle || entry.label,
          url: entry.sourceUrl,
          error: error?.message || String(error),
        });
      }
    }

    await saveJSON(
      indexPath,
        createBaseIndexPayload({
          act,
          storageDirectoryKey: directoryKey,
          candidates,
        modalEntries,
        keywordHits,
        contextSignals,
        count,
        failedCandidates,
        detectionStatus:
          count > 0
            ? "modal_subordinate_detected"
            : "modal_entries_found_but_unresolved",
        legalConclusion: count > 0 ? "likely_exists" : "not_determined",
        confidence: count > 0 ? "high" : "low",
        possibleSubordinateLegislation: count === 0,
        note:
          count > 0
            ? "Subordinate documents were detected directly from the India Code subordinate modal tables."
            : "Subordinate modal entries were present on the page, but none could be saved successfully.",
      })
    );
    return;
  }

  if (!candidates.length) {
    await saveJSON(
      indexPath,
        createBaseIndexPayload({
          act,
          storageDirectoryKey: directoryKey,
          candidates,
        modalEntries,
        keywordHits,
        contextSignals,
        count: 0,
        detectionStatus:
          hasContextualEvidence
            ? "possible_mentions_without_linked_sources"
            : "no_linked_subordinate_detected",
        legalConclusion: "not_determined",
        confidence: "low",
        possibleSubordinateLegislation: hasContextualEvidence,
        note:
          hasContextualEvidence
            ? "The source page contains contextual references to subordinate-law instruments made or issued under the Act, but no linked subordinate source was detected. This is an inconclusive scan result."
            : "No linked subordinate source was detected on the scanned India Code page. This is not a definitive legal conclusion that no subordinate legislation exists.",
      })
    );
    return;
  }

  let count = 0;
  const failedCandidates = [];

  for (const candidate of candidates) {
    try {
      const page = await fetchPageText(candidate.url);
      if (isGenericIndiaCodeShell(page.text)) {
        failedCandidates.push({
          title: candidate.title,
          url: candidate.url,
          error: "generic_india_code_navigation_shell",
        });
        continue;
      }

      const subId = candidate.subId || buildCandidateId(candidate);

        const saved = await saveJSON(`subordinate/${directoryKey}/${subId}.json`, {
          sub_id: subId,
          parent_act_id: actId,
        title: candidate.title,
        type: detectType(candidate.title),
        source: "IndiaCode",
        source_url: candidate.url,
        duplicate_count: Number(candidate.duplicateCount || 0),
        alternate_source_urls: mergeUniqueValues(candidate.alternateSourceUrls || []),
        alternate_descriptions: mergeUniqueValues(candidate.alternateDescriptions || []),
        detection_method: "linked-source-scan",
        text: page.text,
        fetched_at: new Date().toISOString(),
      });

      if (!saved) {
        failedCandidates.push({
          title: candidate.title,
          url: candidate.url,
          error: "write_failed",
        });
        continue;
      }

      count += 1;
    } catch (error) {
      console.error(`[Scraper] Failed subordinate candidate: ${candidate.title}`, error);
      failedCandidates.push({
        title: candidate.title,
        url: candidate.url,
        error: error?.message || String(error),
      });
    }
  }

  const detected = count > 0;
  await saveJSON(
    indexPath,
      createBaseIndexPayload({
        act,
        storageDirectoryKey: directoryKey,
        candidates,
      modalEntries,
      keywordHits,
      contextSignals,
      count,
      failedCandidates,
      detectionStatus: detected
        ? "linked_subordinate_detected"
        : "linked_candidates_found_but_unresolved",
      legalConclusion: detected ? "likely_exists" : "not_determined",
      confidence: detected ? "medium" : "low",
      possibleSubordinateLegislation: !detected,
      note: detected
        ? "Subordinate-linked sources were detected and captured from the India Code page."
        : "Possible subordinate-linked sources were detected, but none could be resolved successfully. This is an inconclusive scan result.",
    })
  );
}

export async function runForOneAct(act) {
  return scrapeSubordinateForAct(act);
}

export async function runSubordinateScraper(options = {}) {
  console.log("[Scraper] Starting subordinate legislation scraper");

  try {
    await fs.access(ACTS_DIR);
  } catch {
    throw new Error(`Acts directory not found: ${ACTS_DIR}`);
  }

  const actFiles = (await fs.readdir(ACTS_DIR)).filter((file) => file.endsWith(".json"));
  const pendingActs = [];
  const reasonCounts = {};
  let upToDate = 0;
  const recoverFailedCandidates = shouldRecoverFailedCandidates(options);

  console.log(
    `[Scraper] Subordinate recovery mode: ${
      recoverFailedCandidates ? "failed-candidates-only enabled" : "standard"
    }`
  );

    for (const file of actFiles) {
      const actId = file.replace(/\.json$/i, "");
      const { directoryKey } = getSubordinateDirectoryMetadata(actId);
      const indexPath = `subordinate/${directoryKey}/index.json`;
    const status = await getExistingIndexStatus(indexPath, {
      recoverFailedCandidates,
    });
    if (status.skip) {
      upToDate += 1;
      continue;
    }

    reasonCounts[status.reason] = (reasonCounts[status.reason] || 0) + 1;
    pendingActs.push({ file, status });
  }

  console.log(
    `[Scraper] Pending subordinate acts: ${pendingActs.length}/${actFiles.length} (${upToDate} already current)`
  );
  if (pendingActs.length > 0) {
    console.log("[Scraper] Pending reasons:", JSON.stringify(reasonCounts));
  }

  const requestedConcurrency = Number.parseInt(
    String(
      options?.subordinateConcurrency ??
        process.env.SCRAPER_SUBORDINATE_CONCURRENCY ??
        options?.concurrency ??
        "1"
    ),
    10
  );
  const workerCount = Math.max(
    1,
    Math.min(
      pendingActs.length || 1,
      Number.isNaN(requestedConcurrency) ? 1 : requestedConcurrency
    )
  );

  console.log(`[Scraper] Subordinate worker count: ${workerCount}`);

  let cursor = 0;
  let completed = 0;

  async function workerLoop(workerId) {
    while (true) {
      const currentIndex = cursor;
      cursor += 1;

      if (currentIndex >= pendingActs.length) {
        return;
      }

      const pending = pendingActs[currentIndex];
      const actPath = path.join(ACTS_DIR, pending.file);
      const raw = await fs.readFile(actPath, "utf-8");
      const act = JSON.parse(raw);

      console.log(
        `[Scraper] Subordinate progress ${currentIndex + 1}/${pendingActs.length} [worker ${workerId}/${workerCount}]: ${act.title} (${pending.status.reason})`
      );
      await scrapeSubordinateForAct(act, {
        bypassExistingCheck: true,
        recoverFailedCandidates,
      });
      completed += 1;

      if (completed % 25 === 0 || completed === pendingActs.length) {
        console.log(
          `[Scraper] Subordinate completed ${completed}/${pendingActs.length}`
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, (_, index) => workerLoop(index + 1))
  );

  console.log("[Scraper] Subordinate legislation scraping completed");
}
