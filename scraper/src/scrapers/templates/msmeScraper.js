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

const MSME_STORAGE_ROOT = "templates/msme";
const MSME_ITEMS_ROOT = `${MSME_STORAGE_ROOT}/items`;
const MSME_ITEMS_DIR = path.resolve(
  __dirname,
  "../../../../knowledge-base/templates/msme/items"
);
const MSME_ITEM_FILE_SUFFIX = ".json";

const DEFAULT_SOURCES = [
  {
    url: "https://msme.gov.in/acts-and-rules/circular-orders/archive-circular-orders",
    type: "circular-orders",
    label: "MSME Circulars Archive",
    mode: "archive-table",
  },
  {
    url: "https://my.msme.gov.in/mymsme/Scheme.aspx",
    type: "scheme-guidelines",
    label: "MyMSME Scheme Guidelines",
    mode: "scheme-table",
  },
];

function shouldFetchPdf() {
  return String(process.env.SCRAPER_MSME_FETCH_PDF || "true").toLowerCase() !== "false";
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
  const configPath = path.resolve(__dirname, "../../../config/msme.sources.json");
  const config = readJsonFile(configPath);
  if (Array.isArray(config?.sources) && config.sources.length) {
    return config.sources;
  }
  return DEFAULT_SOURCES;
}

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed || trimmed === "#") return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function looksLikePdf(url = "") {
  return /\.pdf($|[?#])/i.test(String(url || ""));
}

function isGenericMsmeAsset(title = "", url = "") {
  const haystack = `${title} ${url}`.toLowerCase();
  return (
    haystack.includes("website quality certificate") ||
    haystack.includes("newsletter") ||
    haystack.includes("msme-schemes-booklet-hindi") ||
    haystack.includes("favicon") ||
    haystack.includes("javascript is a standard programming language")
  );
}

function safeSlug(value = "", maxLength = 140) {
  const slug = slugify(String(value || "")).slice(0, maxLength);
  return slug || "msme";
}

function hashId(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12);
}

function buildItemId({ title, documentUrl, documentDate }) {
  const basis = documentUrl || `${title || "msme"}_${documentDate || "undated"}`;
  const slug = safeSlug(`${title || "msme"}_${documentDate || "undated"}`);
  return `${slug}_${hashId(basis)}`;
}

function buildItemPath(itemId) {
  return path.join(MSME_ITEMS_DIR, `${itemId}${MSME_ITEM_FILE_SUFFIX}`);
}

function hashDocumentUrl(url = "") {
  if (!url) return null;
  return crypto.createHash("sha1").update(String(url)).digest("hex");
}

function buildExistingItemIndex() {
  const index = new Map();
  if (!fs.existsSync(MSME_ITEMS_DIR)) return index;

  for (const entry of fs.readdirSync(MSME_ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(MSME_ITEM_FILE_SUFFIX)) continue;
    const filePath = path.join(MSME_ITEMS_DIR, entry.name);
    try {
      const item = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const key = hashDocumentUrl(item.document_url);
      if (!key) continue;
      index.set(key, { item, filePath });
    } catch {
      continue;
    }
  }

  return index;
}

function mergeUniqueByKey(existing = [], incoming = [], keyFn) {
  const map = new Map();
  for (const item of [...existing, ...incoming]) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function readExistingItem(itemId) {
  const filePath = buildItemPath(itemId);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

async function fetchPdfText(documentUrl) {
  if (!looksLikePdf(documentUrl) || !shouldFetchPdf()) {
    return {
      text: "",
      numPages: null,
      info: {},
      link_status: "not_pdf",
      recovery_attempts: [],
    };
  }

  const attemptedUrls = [];
  const candidateUrls = [...new Set([documentUrl, encodeURI(decodeURI(documentUrl))])];

  try {
    for (const url of candidateUrls) {
      attemptedUrls.push(url);
      const response = await fetchBinary(url);
      if (response.status >= 400 || !response.data) {
        if (response.status === 404) {
          continue;
        }
        return {
          text: "",
          numPages: null,
          info: {},
          link_status: "unreachable",
          recovery_attempts: attemptedUrls,
          source_error: `binary_fetch_status_${response.status}`,
        };
      }

      const parsed = await parsePDF(response.data);
      return {
        text: parsed.text || "",
        numPages: parsed.numPages || null,
        info: parsed.info || {},
        link_status: "resolved",
        recovery_attempts: attemptedUrls,
        source_error: parsed.error ? parsed.error.message : null,
      };
    }

    return {
      text: "",
      numPages: null,
      info: {},
      link_status: "broken_upstream",
      recovery_attempts: attemptedUrls,
      source_error: "binary_fetch_status_404",
    };
  } catch (error) {
    return {
      text: "",
      numPages: null,
      info: {},
      link_status: "unreachable",
      recovery_attempts: attemptedUrls,
      source_error: error?.message || String(error),
    };
  }
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

async function loadHtml(url) {
  const response = await fetchHtml(url, { maxRedirects: 5 });
  if (response.status >= 400 || !response.data) {
    throw new Error(`HTML fetch failed (${response.status}) for ${url}`);
  }
  return cheerio.load(response.data);
}

async function extractArchiveTable(source) {
  const visited = new Set();
  const pending = [source.url];
  const candidates = [];

  while (pending.length > 0) {
    const currentUrl = pending.shift();
    if (!currentUrl || visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    const $ = await loadHtml(currentUrl);
    const tableRows = $("table tr").slice(1);

    tableRows.each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 4) return;
      const title = normalizeText($(cells[1]).text());
      const documentUrl = normalizeUrl($(cells[2]).find("a").attr("href"), currentUrl);
      const documentDate = normalizeText($(cells[3]).text()) || null;
      if (!title || !documentUrl || isGenericMsmeAsset(title, documentUrl)) return;

      candidates.push({
        title,
        documentUrl,
        documentDate,
        detailUrl: currentUrl,
        pageUrl: currentUrl,
        sourceType: source.type,
        sourceLabel: source.label,
        sourceMode: source.mode,
      });
    });

    const pageLinks = $("a[href*='archive-circular-orders?page=']")
      .map((_, anchor) => normalizeUrl($(anchor).attr("href"), currentUrl))
      .get()
      .filter(Boolean);

    for (const pageLink of pageLinks) {
      if (!visited.has(pageLink) && !pending.includes(pageLink)) {
        pending.push(pageLink);
      }
    }
  }

  return candidates;
}

async function extractSchemeTable(source) {
  const $ = await loadHtml(source.url);
  const rows = $("table").eq(1).find("tr").slice(1);
  const candidates = [];

  rows.each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const title = normalizeText($(cells[0]).text());
    const documentLink = $(cells[1]).find("a").first();
    const documentUrl = normalizeUrl(documentLink.attr("href"), source.url);
    const rawText = normalizeText(documentLink.text());
    if (!title || !documentUrl || isGenericMsmeAsset(rawText || title, documentUrl)) return;

    candidates.push({
      title,
      documentUrl,
      documentDate: null,
      detailUrl: source.url,
      pageUrl: source.url,
      sourceType: source.type,
      sourceLabel: source.label,
      sourceMode: source.mode,
    });
  });

  return candidates;
}

async function extractAttachmentPage(source) {
  const $ = await loadHtml(source.url);
  const contentTitle =
    normalizeText($("h1").first().text()) ||
    normalizeText($("title").text()).replace(/\s*\|.*$/, "");

  const anchors = $(
    [
      ".field-name-field-attached a",
      ".field-name-field-upload-pdf a",
      ".view-content a[href*='.pdf']",
      ".view-content a[href*='/sites/default/files/']",
      "article a[href*='.pdf']",
      "article a[href*='/sites/default/files/']",
    ].join(", ")
  );

  const candidates = [];
  anchors.each((_, anchor) => {
    const href = normalizeUrl($(anchor).attr("href"), source.url);
    const linkText = normalizeText($(anchor).text());
    const title = linkText || contentTitle;
    if (!href || !looksLikePdf(href) || isGenericMsmeAsset(title, href)) return;

    candidates.push({
      title,
      documentUrl: href,
      documentDate: null,
      detailUrl: source.url,
      pageUrl: source.url,
      sourceType: source.type,
      sourceLabel: source.label,
      sourceMode: source.mode,
    });
  });

  return candidates;
}

async function extractSourceItems(source) {
  switch (source.mode) {
    case "archive-table":
      return extractArchiveTable(source);
    case "scheme-table":
      return extractSchemeTable(source);
    case "attachment-page":
      return extractAttachmentPage(source);
    default:
      return [];
  }
}

function buildCanonicalItem(candidate, existingItem, pdfData) {
  const itemId = buildItemId(candidate);
  const previous = existingItem || readExistingItem(itemId) || {};
  const sourceRef = {
    label: candidate.sourceLabel,
    type: candidate.sourceType,
    mode: candidate.sourceMode,
    page_url: candidate.pageUrl,
    detail_url: candidate.detailUrl,
  };

  const isPdfDocument = looksLikePdf(candidate.documentUrl);
  const hasText = Boolean(pdfData.text || previous.text);
  const extractionStatus = !isPdfDocument
    ? "linked_only"
    : hasText
    ? "parsed"
    : pdfData.link_status === "broken_upstream"
    ? "linked_but_unresolved"
    : pdfData.source_error
    ? "source_error"
    : "linked_but_unresolved";

  return {
    id: itemId,
    title: candidate.title,
    source_type: candidate.sourceType,
    source_label: candidate.sourceLabel,
    source_mode: candidate.sourceMode,
    document_url: candidate.documentUrl,
    detail_url: candidate.detailUrl,
    page_url: candidate.pageUrl,
    document_date: candidate.documentDate,
    document_format: isPdfDocument ? "pdf" : "link",
    has_text: hasText,
    text: pdfData.text || previous.text || "",
    extraction: {
      status: extractionStatus,
      num_pages: pdfData.numPages ?? previous?.extraction?.num_pages ?? null,
      info: pdfData.info || previous?.extraction?.info || {},
      link_status: pdfData.link_status || previous?.extraction?.link_status || null,
      recovery_attempts:
        pdfData.recovery_attempts ||
        previous?.extraction?.recovery_attempts ||
        [],
      source_error: pdfData.source_error || previous?.extraction?.source_error || null,
    },
    source_refs: mergeUniqueByKey(
      previous.source_refs || [],
      [sourceRef],
      (entry) => `${entry.type}::${entry.page_url}::${entry.detail_url || ""}`
    ),
  };
}

export async function scrapeMsmeTemplates() {
  const sources = loadSources();
  const existingIndex = buildExistingItemIndex();
  const canonicalItems = new Map();
  const sourceSummaries = [];

  console.log("[Scraper] Starting MSME template scraper");

  for (const source of sources) {
    try {
      const extracted = await extractSourceItems(source);
      const sourceItems = [];

      for (const candidate of extracted) {
        const key = hashDocumentUrl(candidate.documentUrl) || candidate.documentUrl;
        const existing = canonicalItems.get(key)?.item || existingIndex.get(key)?.item || null;
        const shouldReusePdf =
          shouldFetchPdf() &&
          existing &&
          existing.document_url === candidate.documentUrl &&
          typeof existing.text === "string" &&
          existing.text.length > 0;

        const pdfData = shouldReusePdf
          ? {
              text: existing.text,
              numPages: existing?.extraction?.num_pages ?? null,
              info: existing?.extraction?.info || {},
              source_error: existing?.extraction?.source_error || null,
            }
          : await fetchPdfText(candidate.documentUrl);

        const item = buildCanonicalItem(candidate, existing, pdfData);
        canonicalItems.set(key, { item, filePath: buildItemPath(item.id) });
        sourceItems.push({
          id: item.id,
          title: item.title,
          document_url: item.document_url,
          document_date: item.document_date,
          format: item.document_format,
        });
      }

      sourceSummaries.push({
        label: source.label,
        type: source.type,
        mode: source.mode,
        url: source.url,
        item_count: sourceItems.length,
        items: sourceItems.sort((left, right) => left.id.localeCompare(right.id)),
      });
    } catch (error) {
      console.error(`[MSME] Source failed (${source.label}):`, error?.message || error);
      sourceSummaries.push({
        label: source.label,
        type: source.type,
        mode: source.mode,
        url: source.url,
        item_count: 0,
        error: error?.message || String(error),
        items: [],
      });
    }
  }

  const items = [...canonicalItems.values()].map((entry) => entry.item);
  items.sort((left, right) => left.id.localeCompare(right.id));

  const parsedItems = items.filter((item) => item?.extraction?.status === "parsed");
  const unresolvedItems = items.filter((item) =>
    ["linked_but_unresolved", "linked_only", "source_error"].includes(
      item?.extraction?.status
    )
  );
  const parsedSummaries = parsedItems.map((item) => ({
    id: item.id,
    title: item.title,
    source_type: item.source_type,
    document_url: item.document_url,
    document_date: item.document_date,
    document_format: item.document_format,
    text_length: String(item.text || "").length,
    num_pages: item?.extraction?.num_pages ?? null,
  }));
  const unresolvedSummaries = unresolvedItems.map((item) => ({
    id: item.id,
    title: item.title,
    source_type: item.source_type,
    document_url: item.document_url,
    document_date: item.document_date,
    document_format: item.document_format,
    status: item?.extraction?.status || "unknown",
    link_status: item?.extraction?.link_status || null,
    source_error: item?.extraction?.source_error || null,
  }));

  for (const item of items) {
    await saveJSON(`${MSME_ITEMS_ROOT}/${item.id}.json`, item);
  }

  await saveJSON(`${MSME_STORAGE_ROOT}/parsed-index.json`, {
    count: parsedSummaries.length,
    items: parsedSummaries,
  });

  await saveJSON(`${MSME_STORAGE_ROOT}/unresolved.json`, {
    count: unresolvedSummaries.length,
    items: unresolvedSummaries,
  });

  await saveJSON(`${MSME_STORAGE_ROOT}/index.json`, {
    source_rows: sourceSummaries.reduce((sum, source) => sum + Number(source.item_count || 0), 0),
    unique_items: items.length,
    canonical_item_files: items.length,
    parsed_items: parsedSummaries.length,
    unresolved_items: unresolvedSummaries.length,
    fetch_pdf: shouldFetchPdf(),
    sources: sourceSummaries,
  });

  console.log(
    `[Scraper] MSME templates complete: ${items.length} unique items from ${sourceSummaries.length} sources`
  );

  return {
    sourceRows: sourceSummaries.reduce((sum, source) => sum + Number(source.item_count || 0), 0),
    uniqueItems: items.length,
  };
}

export async function runMsmeScraper() {
  return scrapeMsmeTemplates();
}

export default runMsmeScraper;
