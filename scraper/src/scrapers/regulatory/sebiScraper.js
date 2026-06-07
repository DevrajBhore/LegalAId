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

const STORAGE_ROOT = "regulatory/sebi";
const ITEMS_ROOT = `${STORAGE_ROOT}/items`;
const ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/regulatory/sebi/items");
const ITEM_SUFFIX = ".json";
const AJAX_URL = "https://www.sebi.gov.in/sebiweb/ajax/home/getnewslistinfo.jsp";

const DEFAULT_SOURCES = [
  {
    url: "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7",
    type: "circulars",
    label: "SEBI Circulars",
    sid: "1",
    ssid: "7",
    smid: "0",
  },
  {
    url: "https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&smid=0&ssid=6",
    type: "master-circulars",
    label: "SEBI Master Circulars",
    sid: "1",
    ssid: "6",
    smid: "0",
  },
];

function shouldFetchPdf() {
  return String(process.env.SCRAPER_SEBI_FETCH_PDF || "true").toLowerCase() !== "false";
}

function maxPagesOverride() {
  const value = Number.parseInt(String(process.env.SCRAPER_SEBI_MAX_PAGES || ""), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function startPageOverride() {
  const value = Number.parseInt(String(process.env.SCRAPER_SEBI_START_PAGE || "1"), 10);
  return Number.isFinite(value) && value > 0 ? value : 1;
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
  const configPath = path.resolve(__dirname, "../../../config/sebi.sources.json");
  const config = readJsonFile(configPath);
  if (Array.isArray(config?.sources) && config.sources.length) return config.sources;
  return DEFAULT_SOURCES;
}

function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function safeSlug(value = "", maxLength = 120) {
  const slug = slugify(String(value || "")).slice(0, maxLength).replace(/_+$/g, "");
  return slug || "sebi";
}

function hashId(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12);
}

function buildItemId({ title, documentDate, detailUrl, documentUrl }) {
  const basis = documentUrl || detailUrl || `${title || "sebi"}_${documentDate || "undated"}`;
  return `${safeSlug(`${title || "sebi"}_${documentDate || "undated"}`)}_${hashId(basis)}`;
}

function titleFromUrl(url = "") {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return last.replace(/\.(html|pdf)$/i, "").replace(/[_-]+/g, " ").trim() || "SEBI document";
  } catch {
    return "SEBI document";
  }
}

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  try {
    const cleaned = String(href).trim().replace(/\s+/g, "");
    return new URL(cleaned, baseUrl).toString();
  } catch {
    return null;
  }
}

function buildExistingItemIndex() {
  const index = new Map();
  if (!fs.existsSync(ITEMS_DIR)) return index;

  for (const entry of fs.readdirSync(ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(ITEM_SUFFIX)) continue;
    try {
      const item = JSON.parse(fs.readFileSync(path.join(ITEMS_DIR, entry.name), "utf-8"));
      const documentKey = hashId(item.document_url || item.detail_url);
      const detailKey = hashId(item.detail_url || item.document_url);
      if (documentKey) index.set(documentKey, item);
      if (detailKey) index.set(detailKey, item);
    } catch {
      continue;
    }
  }

  return index;
}

function extractTotalPages(html) {
  const hiddenMatch = String(html).match(/name=['"]totalpage['"]\s+value=['"]?(\d+)/i);
  if (hiddenMatch) return Number.parseInt(hiddenMatch[1], 10);

  const lastMatch = String(html).match(/searchFormNewsList\('n','(\d+)'\);\s*"\s*title="Last"/i);
  if (lastMatch) return Number.parseInt(lastMatch[1], 10) + 1;

  return 1;
}

function extractListingItems(html, source) {
  const $ = cheerio.load(html);
  const rows = [];

  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const date = normalizeText($(cells[0]).text()) || null;
    const anchor = $(cells[1]).find("a[href]").first();
    const detailUrl = normalizeUrl(anchor.attr("href"), source.url);
    const title = normalizeText(anchor.text()) || titleFromUrl(detailUrl);
    if (!detailUrl || !/sebi\.gov\.in\/legal\//i.test(detailUrl)) return;
    rows.push({
      title,
      detailUrl,
      documentDate: date,
      sourceType: source.type,
      sourceLabel: source.label,
      sourceUrl: source.url,
    });
  });

  return rows;
}

async function fetchListingPage(source, pageIndex) {
  if (pageIndex === 0) {
    const response = await fetchHtml(source.url, { maxRedirects: 5 });
    if (response.status >= 400 || !response.data) {
      throw new Error(`SEBI listing fetch failed (${response.status}) for ${source.url}`);
    }
    return response.data;
  }

  const body = new URLSearchParams({
    nextValue: String(pageIndex),
    next: "n",
    search: "",
    fromDate: "",
    toDate: "",
    fromYear: "",
    toYear: "",
    deptId: "",
    sid: source.sid || "1",
    ssid: source.ssid,
    smid: source.smid || "0",
    ssidhidden: source.ssid,
    intmid: "-1",
    sText: "Legal",
    ssText: source.label?.replace(/^SEBI\s+/i, "") || source.type,
    smText: "",
    doDirect: String(pageIndex),
  });

  const response = await fetchHtml(AJAX_URL, {
    maxRedirects: 5,
    responseType: "text",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      referer: source.url,
      "x-requested-with": "XMLHttpRequest",
    },
    data: body.toString(),
    method: "POST",
  });

  if (response.status >= 400 || !response.data) {
    throw new Error(`SEBI listing page ${pageIndex + 1} failed (${response.status})`);
  }
  return response.data;
}

async function postSebListing(source, pageIndex) {
  const body = new URLSearchParams({
    nextValue: String(pageIndex),
    next: "n",
    search: "",
    fromDate: "",
    toDate: "",
    fromYear: "",
    toYear: "",
    deptId: "",
    sid: source.sid || "1",
    ssid: source.ssid,
    smid: source.smid || "0",
    ssidhidden: source.ssid,
    intmid: "-1",
    sText: "Legal",
    ssText: source.label?.replace(/^SEBI\s+/i, "") || source.type,
    smText: "",
    doDirect: String(pageIndex),
  });

  const response = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      referer: source.url,
      "x-requested-with": "XMLHttpRequest",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`SEBI listing page ${pageIndex + 1} failed (${response.status})`);
  }

  return response.text();
}

async function collectSourceCandidates(source) {
  const firstHtml = await fetchListingPage(source, 0);
  const availablePages = extractTotalPages(firstHtml);
  const requestedStartPage = startPageOverride();
  if (requestedStartPage > availablePages) {
    return {
      totalPages: `${requestedStartPage}-0 of ${availablePages}`,
      candidates: [],
    };
  }
  const startPage = requestedStartPage;
  const pageLimit = maxPagesOverride();
  const endPage = Math.min(availablePages, pageLimit ? startPage + pageLimit - 1 : availablePages);
  const candidates = [];

  for (let pageIndex = startPage - 1; pageIndex < endPage; pageIndex += 1) {
    const html = pageIndex === 0 ? firstHtml : await postSebListing(source, pageIndex);
    candidates.push(...extractListingItems(html, source));
  }

  return {
    totalPages: `${startPage}-${endPage} of ${availablePages}`,
    candidates,
  };
}

function extractPdfUrlFromDetail(html, detailUrl) {
  const $ = cheerio.load(html);
  const iframeSrc = $("iframe[src*='file=']").first().attr("src");
  if (iframeSrc) {
    try {
      const iframeUrl = new URL(iframeSrc, detailUrl);
      const fileUrl = iframeUrl.searchParams.get("file");
      const normalizedFileUrl = normalizeUrl(fileUrl, detailUrl);
      if (normalizedFileUrl) return normalizedFileUrl;
    } catch {
      // fall through
    }
  }

  const rawMatch = String(html).match(/https:\/\/www\.sebi\.gov\.in\/sebi_data\/attachdocs\/[^'"\s>]+\.pdf/);
  return rawMatch ? normalizeUrl(rawMatch[0], detailUrl) : null;
}

function extractTextFromDetailHtml(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, nav, header, footer").remove();
  const candidates = [
    ".main_full",
    ".container_full",
    ".page-content",
    ".main-content",
    ".content",
    ".container-right",
    "article",
    ".view-content",
    "body",
  ];
  let text = "";

  for (const selector of candidates) {
    $(selector).each((_, element) => {
      const candidateText = normalizeText($(element).text());
      if (candidateText.length > text.length) text = candidateText;
    });
    if (text.length > 1000) break;
  }

  text = text
    .replace(/^.*?Home\s+Legal\s+/i, "")
    .replace(/\s+Subscribe to receive latest.*$/i, "")
    .trim();
  return text.length > 100 ? text : "";
}

async function fetchDetail(candidate) {
  const response = await fetchHtml(candidate.detailUrl, { maxRedirects: 5 }).catch((error) => ({
    error,
    status: error?.response?.status || null,
    data: null,
  }));
  if (response.error) {
    return {
      documentUrl: null,
      text: "",
      extraction: {
        status: "source_error",
        reason: response.error?.message || "detail_fetch_failed",
      },
    };
  }
  if (response.status >= 400 || !response.data) {
    return {
      documentUrl: null,
      text: "",
      extraction: {
        status: "source_error",
        reason: `detail_fetch_status_${response.status}`,
      },
    };
  }

  const html = response.data;
  const documentUrl = extractPdfUrlFromDetail(html, candidate.detailUrl);
  if (!documentUrl) {
    const htmlText = extractTextFromDetailHtml(html);
    return {
      documentUrl: candidate.detailUrl,
      text: htmlText,
      extraction: {
        status: htmlText ? "parsed" : "linked_only",
        reason: htmlText ? "html_text_extracted" : "no_pdf_found",
      },
    };
  }

  if (!shouldFetchPdf()) {
    return {
      documentUrl,
      text: "",
      extraction: {
        status: documentUrl ? "skipped" : "linked_only",
        reason: documentUrl ? "pdf_fetch_disabled" : "no_pdf_found",
      },
    };
  }

  const pdfResponse = await fetchBinary(documentUrl, { maxRedirects: 5 }).catch((error) => ({
    error,
    status: error?.response?.status || null,
    data: null,
  }));
  if (pdfResponse.error) {
    return {
      documentUrl,
      text: "",
      extraction: {
        status: "source_error",
        reason: pdfResponse.error?.message || "pdf_fetch_failed",
      },
    };
  }
  if (pdfResponse.status >= 400 || !pdfResponse.data) {
    return {
      documentUrl,
      text: "",
      extraction: {
        status: "source_error",
        reason: `pdf_fetch_status_${pdfResponse.status}`,
      },
    };
  }

  const parsed = await parsePDF(Buffer.from(pdfResponse.data));
  if (parsed.error) {
    return {
      documentUrl,
      text: "",
      extraction: {
        status: "error",
        reason: parsed.error.message,
      },
    };
  }

  return {
    documentUrl,
    text: parsed.text || "",
    extraction: {
      status: "parsed",
      num_pages: parsed.numPages || null,
      info: parsed.info || {},
      reason: null,
    },
  };
}

export async function runSebiScraper() {
  const sources = loadSources();
  const existingIndex = buildExistingItemIndex();
  const itemsByDocument = new Map();
  const sourceSummaries = [];

  console.log("[SEBI] Starting SEBI regulatory scraper");

  for (const source of sources) {
    console.log(`[SEBI] Scraping ${source.label}`);
    const { totalPages, candidates } = await collectSourceCandidates(source);
    const sourceItems = [];

    for (const candidate of candidates) {
      const existingKey = hashId(candidate.detailUrl);
      const existing = existingIndex.get(existingKey);
      const detail = existing?.text
        ? {
            documentUrl: existing.document_url,
            text: existing.text,
            extraction: existing.extraction,
          }
        : await fetchDetail(candidate);
      if (detail.extraction?.status === "source_error" && existing) {
        detail.documentUrl = existing.document_url || candidate.detailUrl;
        detail.text = existing.text || "";
        detail.extraction = existing.extraction || detail.extraction;
      }
      const documentUrl = detail.documentUrl || candidate.detailUrl;
      const itemId = buildItemId({
        title: candidate.title,
        documentDate: candidate.documentDate,
        detailUrl: candidate.detailUrl,
        documentUrl,
      });
      const item = {
        id: itemId,
        title: candidate.title,
        type: candidate.sourceType,
        category: candidate.sourceLabel,
        source: "SEBI",
        source_url: candidate.sourceUrl,
        detail_url: candidate.detailUrl,
        document_url: documentUrl,
        document_date: candidate.documentDate,
        document_format: /\.pdf($|[?#])/i.test(documentUrl) ? "pdf" : "html",
        has_text: Boolean(detail.text),
        extraction: detail.extraction,
        text: detail.text || "",
        source_refs: [
          {
            type: candidate.sourceType,
            label: candidate.sourceLabel,
            url: candidate.sourceUrl,
          },
        ],
      };

      itemsByDocument.set(hashId(documentUrl), item);
      await saveJSON(`${ITEMS_ROOT}/${item.id}.json`, item);
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
      pages: totalPages,
      item_count: sourceItems.length,
      items: sourceItems,
    });
  }

  const items = [...itemsByDocument.values()].sort((a, b) => a.id.localeCompare(b.id));
  await saveJSON(`${STORAGE_ROOT}/index.json`, {
    source_count: sources.length,
    total_items: sourceSummaries.reduce((sum, source) => sum + source.item_count, 0),
    unique_items: items.length,
    parsed_items: items.filter((item) => item.extraction?.status === "parsed").length,
    sources: sourceSummaries,
  });

  console.log(`[SEBI] Completed. Unique items: ${items.length}`);
}

export async function scrapeSebiCirculars() {
  return runSebiScraper();
}

export default runSebiScraper;
