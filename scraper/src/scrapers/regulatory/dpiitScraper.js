import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

import { fetchBinary } from "../../common/request.js";
import { parsePDF } from "../../parsers/pdfParser.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { slugify } from "../indiaCode/baseScraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_ROOT = "regulatory/dpiit";
const ITEMS_ROOT = `${STORAGE_ROOT}/items`;
const INDEX_PATH = path.resolve(__dirname, "../../../../knowledge-base/regulatory/dpiit/index.json");
const ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/regulatory/dpiit/items");
const ITEM_SUFFIX = ".json";
const API_BASE = "https://www.dpiit.gov.in/cms/wp-json";
const API_HEADERS = {
  apikey: "4bW5t13453pa",
  "content-type": "application/json",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

const DEFAULT_SOURCES = [
  {
    type: "orders-and-notices",
    label: "DPIIT Orders and Notices",
    category: "orders-and-notices",
  },
  {
    type: "gazette-notifications",
    label: "DPIIT Gazette Notifications",
    category: "gazette-notifications",
  },
  {
    type: "acts-and-policy",
    label: "DPIIT Acts and Policy",
    category: "acts-and-policy",
  },
  {
    type: "guidelines",
    label: "DPIIT Guidelines",
    category: "guidelines",
  },
  {
    type: "publications",
    label: "DPIIT Publications",
    category: "publications",
  },
];

function shouldFetchPdf() {
  return String(process.env.SCRAPER_DPIIT_FETCH_PDF || "true").toLowerCase() !== "false";
}

function pageLimit() {
  const value = Number.parseInt(String(process.env.SCRAPER_DPIIT_MAX_PAGES || ""), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function pageSize() {
  const value = Number.parseInt(String(process.env.SCRAPER_DPIIT_PAGE_SIZE || "25"), 10);
  return Number.isFinite(value) && value > 0 ? value : 25;
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
  const configPath = path.resolve(__dirname, "../../../config/dpiit.sources.json");
  const config = readJsonFile(configPath);
  const sources = Array.isArray(config?.sources) && config.sources.length ? config.sources : DEFAULT_SOURCES;
  const selected = String(process.env.SCRAPER_DPIIT_SOURCES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!selected.length) return sources;

  const selectedSet = new Set(selected);
  return sources.filter((source) => selectedSet.has(String(source.type || "").toLowerCase()) || selectedSet.has(String(source.category || "").toLowerCase()));
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeSlug(value = "", maxLength = 120) {
  const slug = slugify(String(value || "")).slice(0, maxLength).replace(/_+$/g, "");
  return slug || "dpiit";
}

function hashId(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12);
}

function buildItemId({ title, documentUrl, documentDate }) {
  return `${safeSlug(`${title || "dpiit"}_${documentDate || "undated"}`)}_${hashId(documentUrl)}`;
}

function buildExistingItemIndex() {
  const index = new Map();
  if (!fs.existsSync(ITEMS_DIR)) return index;

  for (const entry of fs.readdirSync(ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(ITEM_SUFFIX)) continue;
    try {
      const item = JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, entry.name), "utf-8"));
      if (!item.document_url) continue;

      const key = hashId(item.document_url);
      const previous = index.get(key);
      const previousHasText = Boolean(previous?.text);
      const itemHasText = Boolean(item?.text);
      if (!previous || (!previousHasText && itemHasText)) {
        index.set(key, item);
      }
    } catch {
      continue;
    }
  }

  return index;
}

async function fetchJson(pathname, retries = 3) {
  const url = `${API_BASE}${pathname}`;
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: API_HEADERS });
      if (!response.ok) {
        throw new Error(`DPIIT API failed (${response.status}) for ${url}`);
      }
      return response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      }
    }
  }

  throw lastError;
}

async function fetchDocumentsPage(source, page) {
  return fetchJson(
    `/document/documents?document_category=${encodeURIComponent(source.category)}&limit=${pageSize()}&page=${page}`
  );
}

function extractFileIds(post) {
  const fileGroups = post?.acf_data?.file;
  if (!Array.isArray(fileGroups)) return [];
  const ids = [];

  for (const group of fileGroups) {
    if (Array.isArray(group?.file)) {
      for (const fileId of group.file) {
        if (Number.isFinite(Number(fileId))) ids.push(Number(fileId));
      }
    }
  }

  return ids;
}

function extractPdfRecords(filePost) {
  const acf = filePost?.acf_data || {};
  const records = [];
  const candidates = [
    acf.pdf,
    acf.pdf_both,
    acf.upload_document,
    acf.upload_document_both,
    acf.document_file,
    acf.document_file_both,
    acf.file,
    acf.file_both,
  ];

  for (const candidate of candidates) {
    if (candidate?.url) {
      records.push({
        url: candidate.url,
        title: normalizeText(acf.title || filePost.post_title),
        date: normalizeText(acf.file_date || acf.date),
        language: Array.isArray(acf.language) ? acf.language.join(", ") : normalizeText(acf.language),
      });
    }
  }

  return records;
}

async function resolveDocumentFiles(post) {
  const fileIds = extractFileIds(post);
  const records = [];

  for (const fileId of fileIds) {
    const fileResponse = await fetchJson(`/post-page/post?id=${fileId}`).catch((error) => ({
      error,
    }));
    if (fileResponse?.error) continue;
    records.push(...extractPdfRecords(fileResponse.posts));
  }

  if (!records.length) {
    const externalFiles = post?.acf_data?.file || [];
    for (const group of externalFiles) {
      if (group?.external_link) {
        records.push({
          url: group.external_link,
          title: normalizeText(group.title || post?.acf_data?.title || post?.post_title),
          date: normalizeText(post?.acf_data?.date),
          language: "",
        });
      }
    }
  }

  return records;
}

async function fetchPdfText(documentUrl) {
  if (!shouldFetchPdf() || !/\.pdf($|[?#])/i.test(documentUrl)) {
    return {
      text: "",
      extraction: {
        status: "linked_only",
        reason: shouldFetchPdf() ? "not_pdf" : "pdf_fetch_disabled",
      },
    };
  }

  const response = await fetchBinary(documentUrl, { maxRedirects: 5 }).catch((error) => ({
    error,
    status: error?.response?.status || null,
    data: null,
  }));
  if (response.error) {
    return {
      text: "",
      extraction: {
        status: "source_error",
        reason: response.error?.message || "pdf_fetch_failed",
      },
    };
  }
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

export async function runDpiitScraper() {
  const sources = loadSources();
  const existingIndex = buildExistingItemIndex();
  const itemsByUrl = new Map();
  const sourceSummaries = [];
  const maxPages = pageLimit();

  console.log("[DPIIT] Starting DPIIT regulatory scraper");

  for (const source of sources) {
    console.log(`[DPIIT] Scraping ${source.label}`);
    let page = 1;
    let totalPages = 1;
    const sourceItems = [];

    do {
      const response = await fetchDocumentsPage(source, page).catch((error) => ({
        error,
        posts: [],
        total_pages: page,
      }));
      if (response.error) {
        sourceItems.push({
          id: `source_error_${hashId(`${source.category}_${page}`)}`,
          title: `Source fetch failed for ${source.label}, page ${page}`,
          document_url: `${API_BASE}/document/documents?document_category=${source.category}&page=${page}`,
          document_date: null,
          type: source.type,
          error: response.error?.message || String(response.error),
        });
        break;
      }
      totalPages = Number(response.total_pages || totalPages || 1);

      for (const post of response.posts || []) {
        const title = normalizeText(post?.acf_data?.title || post.post_title);
        const postDate = normalizeText(post?.acf_data?.date || post.post_date);
        const fileRecords = await resolveDocumentFiles(post);

        for (const file of fileRecords) {
          if (!file.url) continue;
          const documentDate = file.date || postDate || null;
          if (itemsByUrl.has(file.url)) continue;

          const existing = existingIndex.get(hashId(file.url));
          const itemId =
            existing?.id ||
            buildItemId({
              title: file.title || title,
              documentUrl: file.url,
              documentDate,
            });
          const parsed = existing?.text ? { text: existing.text, extraction: existing.extraction } : await fetchPdfText(file.url);
          const item = {
            id: itemId,
            title: file.title || title,
            type: source.type,
            category: source.label,
            source: "DPIIT",
            source_url: `${API_BASE}/document/documents?document_category=${source.category}`,
            detail_url: `https://www.dpiit.gov.in/documents/${source.category}/details/${post.post_slug || post.post_name}-${post.ID}`,
            document_url: file.url,
            document_date: documentDate,
            document_format: /\.pdf($|[?#])/i.test(file.url) ? "pdf" : "link",
            language: file.language || null,
            has_text: Boolean(parsed.text),
            extraction: parsed.extraction,
            text: parsed.text || "",
            source_refs: [
              {
                type: source.type,
                label: source.label,
                url: `${API_BASE}/document/documents?document_category=${source.category}`,
              },
            ],
          };
          itemsByUrl.set(file.url, item);
          await saveJSON(`${ITEMS_ROOT}/${item.id}.json`, item);
          sourceItems.push({
            id: item.id,
            title: item.title,
            document_url: item.document_url,
            document_date: item.document_date,
            type: item.type,
          });
        }
      }

      page += 1;
    } while (page <= totalPages && (!maxPages || page <= maxPages));

    sourceSummaries.push({
      label: source.label,
      type: source.type,
      category: source.category,
      pages: Math.min(totalPages, maxPages || totalPages),
      item_count: sourceItems.length,
      items: sourceItems.sort((left, right) => left.id.localeCompare(right.id)),
    });
  }

  const previousIndex = readJsonFile(INDEX_PATH);
  const selectedTypes = new Set(sources.map((source) => source.type));
  const mergedSourceSummaries =
    sources.length < DEFAULT_SOURCES.length && Array.isArray(previousIndex?.sources)
      ? [
          ...previousIndex.sources.filter((source) => !selectedTypes.has(source.type)),
          ...sourceSummaries,
        ].sort((left, right) => String(left.type || "").localeCompare(String(right.type || "")))
      : sourceSummaries;

  const items = [...itemsByUrl.values()].sort((left, right) => left.id.localeCompare(right.id));
  const mergedItemIds = new Set();
  for (const source of mergedSourceSummaries) {
    for (const item of source.items || []) {
      if (item.id && !String(item.id).startsWith("source_error_")) {
        mergedItemIds.add(item.id);
      }
    }
  }
  const parsedItemCount = [...mergedItemIds].filter((id) => {
    const item = readJsonFile(path.join(ITEMS_DIR, `${id}.json`));
    return item?.extraction?.status === "parsed";
  }).length;

  await saveJSON(`${STORAGE_ROOT}/index.json`, {
    source_count: mergedSourceSummaries.length,
    total_items: mergedSourceSummaries.reduce((sum, source) => sum + source.item_count, 0),
    unique_items: sources.length < DEFAULT_SOURCES.length ? mergedItemIds.size : items.length,
    parsed_items: sources.length < DEFAULT_SOURCES.length ? parsedItemCount : items.filter((item) => item.extraction?.status === "parsed").length,
    sources: mergedSourceSummaries,
  });

  console.log(`[DPIIT] Completed. Unique items: ${items.length}`);
}

export async function scrapeDpiitNotifications() {
  return runDpiitScraper();
}

export default runDpiitScraper;
