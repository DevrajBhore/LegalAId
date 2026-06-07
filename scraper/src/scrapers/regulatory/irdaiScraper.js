import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

import { fetchBinary, fetchHtml } from "../../common/request.js";
import { parsePDF } from "../../parsers/pdfParser.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { slugify } from "../indiaCode/baseScraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_ROOT = "regulatory/irdai";
const ITEMS_ROOT = `${STORAGE_ROOT}/items`;
const ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/regulatory/irdai/items");
const ITEM_SUFFIX = ".json";

const DEFAULT_SOURCES = [
  {
    url: "https://irdai.gov.in/en/circulars",
    type: "circulars",
    label: "IRDAI Circulars",
  },
];

function shouldFetchPdf() {
  return String(process.env.SCRAPER_IRDAI_FETCH_PDF || "true").toLowerCase() !== "false";
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function loadSources() {
  const configPath = path.resolve(__dirname, "../../../config/irdai.sources.json");
  const config = readJsonFile(configPath);
  if (Array.isArray(config?.sources) && config.sources.length) return config.sources;
  return DEFAULT_SOURCES;
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(String(href).trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function safeSlug(value = "", maxLength = 120) {
  const slug = slugify(String(value || "")).slice(0, maxLength).replace(/_+$/g, "");
  return slug || "irdai";
}

function hashId(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12);
}

function titleFromUrl(documentUrl) {
  try {
    const pathParts = new URL(documentUrl).pathname.split("/");
    const filePart = decodeURIComponent(pathParts.find((part) => /\.pdf$/i.test(part)) || pathParts.at(-2) || "");
    return filePart.replace(/\.pdf$/i, "").replace(/[+_-]+/g, " ").trim() || "IRDAI document";
  } catch {
    return "IRDAI document";
  }
}

function extractDate(value = "") {
  const text = String(value || "");
  const match = text.match(/\b(\d{2}-\d{2}-\d{4})\b/);
  if (match) return match[1];
  const longMatch = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (longMatch) return `${String(longMatch[1]).padStart(2, "0")}-${longMatch[2]}-${longMatch[3]}`;
  return null;
}

function buildItemId({ title, documentUrl, documentDate }) {
  return `${safeSlug(`${title || "irdai"}_${documentDate || "undated"}`)}_${hashId(documentUrl)}`;
}

function buildExistingItemIndex() {
  const index = new Map();
  if (!fs.existsSync(ITEMS_DIR)) return index;

  for (const entry of fs.readdirSync(ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(ITEM_SUFFIX)) continue;
    try {
      const item = JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, entry.name), "utf-8"));
      if (item.document_url) index.set(hashId(item.document_url), item);
    } catch {
      continue;
    }
  }

  return index;
}

function isDocumentLink(url = "") {
  return /irdai\.gov\.in\/documents\//i.test(url) && /\.pdf(\/|$|\?)/i.test(url);
}

function extractCandidates(html, source) {
  const $ = cheerio.load(html);
  const byUrl = new Map();

  $("a[href]").each((_, anchor) => {
    const documentUrl = normalizeUrl($(anchor).attr("href"), source.url);
    if (!documentUrl || !isDocumentLink(documentUrl)) return;
    const rowText = normalizeText($(anchor).closest("tr, li, div").text());
    const title = normalizeText($(anchor).text()) || titleFromUrl(documentUrl);
    if (/^forms$/i.test(title)) return;
    const candidate = {
      title,
      documentUrl,
      documentDate: extractDate(rowText),
      sourceType: source.type,
      sourceLabel: source.label,
      sourceUrl: source.url,
    };
    const current = byUrl.get(documentUrl);
    if (!current || current.title.length < candidate.title.length) {
      byUrl.set(documentUrl, candidate);
    }
  });

  return [...byUrl.values()];
}

async function fetchPdfText(documentUrl) {
  if (!shouldFetchPdf()) {
    return {
      text: "",
      extraction: {
        status: "skipped",
        reason: "pdf_fetch_disabled",
      },
    };
  }

  const response = await fetchBinary(documentUrl, { maxRedirects: 5 });
  if (response.status >= 400 || !response.data) {
    return {
      text: "",
      extraction: {
        status: "source_error",
        reason: `pdf_fetch_status_${response.status}`,
      },
    };
  }

  const parsed = await parsePDF(Buffer.from(response.data));
  if (parsed.error) {
    return {
      text: "",
      extraction: {
        status: "error",
        reason: parsed.error.message,
      },
    };
  }

  return {
    text: parsed.text || "",
    extraction: {
      status: "parsed",
      num_pages: parsed.numPages || null,
      info: parsed.info || {},
      reason: null,
    },
  };
}

export async function runIrdaiScraper() {
  const sources = loadSources();
  const existingIndex = buildExistingItemIndex();
  const itemsByUrl = new Map();
  const sourceSummaries = [];

  console.log("[IRDAI] Starting IRDAI regulatory scraper");

  for (const source of sources) {
    const response = await fetchHtml(source.url, { maxRedirects: 5 });
    if (response.status >= 400 || !response.data) {
      sourceSummaries.push({
        label: source.label,
        type: source.type,
        url: source.url,
        status: "failed",
        error: `html_fetch_status_${response.status}`,
        item_count: 0,
        items: [],
      });
      continue;
    }

    const candidates = extractCandidates(response.data, source);
    const sourceItems = [];
    for (const candidate of candidates) {
      const existing = existingIndex.get(hashId(candidate.documentUrl));
      const parsed = existing?.text ? { text: existing.text, extraction: existing.extraction } : await fetchPdfText(candidate.documentUrl);
      const itemId = buildItemId(candidate);
      const item = {
        id: itemId,
        title: candidate.title,
        type: candidate.sourceType,
        category: candidate.sourceLabel,
        source: "IRDAI",
        source_url: candidate.sourceUrl,
        document_url: candidate.documentUrl,
        document_date: candidate.documentDate,
        document_format: "pdf",
        has_text: Boolean(parsed.text),
        extraction: parsed.extraction,
        text: parsed.text || "",
        source_refs: [
          {
            type: candidate.sourceType,
            label: candidate.sourceLabel,
            url: candidate.sourceUrl,
          },
        ],
      };
      itemsByUrl.set(candidate.documentUrl, item);
      sourceItems.push({
        id: item.id,
        title: item.title,
        document_url: item.document_url,
        document_date: item.document_date,
        type: item.type,
      });
    }

    sourceSummaries.push({
      label: source.label,
      type: source.type,
      url: source.url,
      status: "ok",
      item_count: sourceItems.length,
      items: sourceItems.sort((left, right) => left.id.localeCompare(right.id)),
    });
  }

  const items = [...itemsByUrl.values()].sort((left, right) => left.id.localeCompare(right.id));
  for (const item of items) {
    await saveJSON(`${ITEMS_ROOT}/${item.id}.json`, item);
  }

  await saveJSON(`${STORAGE_ROOT}/index.json`, {
    source_count: sources.length,
    total_items: sourceSummaries.reduce((sum, source) => sum + source.item_count, 0),
    unique_items: items.length,
    parsed_items: items.filter((item) => item.extraction?.status === "parsed").length,
    sources: sourceSummaries,
  });

  console.log(`[IRDAI] Completed. Unique items: ${items.length}`);
}

export async function scrapeIrdaiCirculars() {
  return runIrdaiScraper();
}

export default runIrdaiScraper;
