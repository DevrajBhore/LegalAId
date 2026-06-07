import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

import { fetchHtml } from "../../common/request.js";
import { saveJSON } from "../../storage/fileStorage.js";
import {
  buildEntryFromCells,
  buildItemId,
  classifySection,
  EGAZETTE_ITEMS_ROOT,
  inferDownloadUrlFromGazetteId,
  normalizeText,
  normalizeUrl,
} from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EGAZETTE_HOME_URL = "https://egazette.gov.in/";
const EGAZETTE_ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/gazette/egazette/items");
const EGAZETTE_RECENT_INDEX_ROOT = "gazette/egazette";

const RECENT_CATEGORIES = {
  1: "Bill & Act",
  2: "Weekly Gazette",
  3: "Extraordinary Gazette",
  4: "Part II Section 3 Sub-section (i)",
  5: "Part II Section 3 Sub-section (ii)",
};

function parsePositiveInteger(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, parsed);
}

function parseCategories() {
  const configured = String(process.env.SCRAPER_EGAZETTE_RECENT_CATEGORIES || "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => RECENT_CATEGORIES[value]);

  return configured.length ? [...new Set(configured)] : [1, 2, 3, 4, 5];
}

function recentMaxPages() {
  return parsePositiveInteger(process.env.SCRAPER_EGAZETTE_RECENT_MAX_PAGES, 1, 1);
}

function recentPoliteDelayMs() {
  return parsePositiveInteger(process.env.SCRAPER_EGAZETTE_RECENT_DELAY_MS, 1200, 0);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hiddenFieldsFromHtml(html) {
  const $ = cheerio.load(html);
  const fields = new URLSearchParams();

  $("input[type='hidden'][name]").each((_, input) => {
    const name = $(input).attr("name");
    if (!name) return;
    fields.set(name, $(input).attr("value") || "");
  });

  return fields;
}

function sessionBaseFromUrl(url) {
  const match = String(url || "").match(/^(https?:\/\/[^/]+\/\(S\([^)]+\)\)\/)/i);
  return match ? match[1] : EGAZETTE_HOME_URL;
}

async function fetchSessionBase() {
  const landing = await fetchHtml(EGAZETTE_HOME_URL, { maxRedirects: 5 });
  if (!landing || landing.status !== 200) {
    throw new Error(`eGazette landing request failed: ${landing?.status || "unknown"}`);
  }

  return sessionBaseFromUrl(landing.request?.res?.responseUrl || landing.config?.url || EGAZETTE_HOME_URL);
}

function sourceUrlForCategory(sessionBase, category) {
  return normalizeUrl(`RecentUploads.aspx?Category=${category}`, sessionBase);
}

async function postAspNetPage(url, html, eventTarget, eventArgument) {
  const fields = hiddenFieldsFromHtml(html);
  fields.set("__EVENTTARGET", eventTarget);
  fields.set("__EVENTARGUMENT", eventArgument);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://egazette.gov.in",
      Referer: url,
    },
    body: fields,
  });

  return {
    status: response.status,
    data: await response.text(),
    finalUrl: response.url || url,
  };
}

function parseRecentUploadRows(html, sourceUrl, category) {
  const $ = cheerio.load(html);
  const entries = new Map();

  $("#gvGazetteList tr, table tr").each((_, row) => {
    const $row = $(row);
    const gazetteText = normalizeText($row.text());
    if (!/[A-Z]{2}-[A-Z]{2}-[EW]-\d{8}-\d+/i.test(gazetteText)) return;

    const cells = $row.find("td").map((__, cell) => normalizeText($(cell).text())).get();
    const gazetteId = (gazetteText.match(/[A-Z]{2}-[A-Z]{2}-[EW]-\d{8}-\d+/i) || [])[0];
    if (!gazetteId) return;

    const candidates = [];
    const entry = buildEntryFromCells(cells, candidates) || {
      gazette_id: gazetteId,
      section: classifySection(gazetteId),
      ministry: cells[1] || null,
      title: cells[4] || gazetteText,
      publish_date: cells.find((cell) => /\b\d{2}-[A-Za-z]{3}-\d{4}\b/.test(cell)) || null,
      file_size: cells.find((cell) => /\b\d+(?:\.\d+)?\s*MB\b/i.test(cell)) || null,
      detail_url: normalizeUrl("ViewPDF.aspx", sourceUrl),
      download_url: inferDownloadUrlFromGazetteId(gazetteId),
      source_url: sourceUrl,
      source: "eGazette",
      raw_text: gazetteText,
    };

    entry.id = entry.id || buildItemId(entry);
    entry.source = "eGazette";
    entry.source_url = sourceUrl;
    entry.recent_category = category;
    entry.recent_category_label = RECENT_CATEGORIES[category] || `Category ${category}`;
    entry.download_url = entry.download_url || inferDownloadUrlFromGazetteId(entry.gazette_id, entry.publish_date);
    entry.detail_url = entry.detail_url || normalizeUrl("ViewPDF.aspx", sourceUrl);

    entries.set(entry.gazette_id || entry.id, entry);
  });

  return [...entries.values()];
}

function readExistingItem(itemId) {
  if (!itemId) return null;
  const filePath = path.join(EGAZETTE_ITEMS_DIR, `${itemId}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function buildItemPayload(entry) {
  const nextItem = {
    id: entry.id,
    gazette_id: entry.gazette_id,
    section: entry.section,
    ministry: entry.ministry,
    title: entry.title,
    publish_date: entry.publish_date,
    file_size: entry.file_size,
    source: "eGazette",
    source_url: entry.source_url,
    detail_url: entry.detail_url,
    download_url: entry.download_url,
    raw_text: entry.raw_text,
    recent_category: entry.recent_category,
    recent_category_label: entry.recent_category_label,
    extraction: {
      status: "pending",
      reason: entry.download_url || entry.detail_url ? "awaiting_pdf_extraction" : "missing_download_reference",
    },
    text: "",
  };

  const existingItem = readExistingItem(entry.id);
  if (existingItem?.extraction?.status === "parsed" && String(existingItem.text || "").trim()) {
    return {
      ...existingItem,
      ...nextItem,
      download_url: existingItem.download_url || nextItem.download_url,
      detail_url: existingItem.detail_url || nextItem.detail_url,
      extraction: existingItem.extraction,
      text: existingItem.text,
    };
  }

  return nextItem;
}

async function scrapeCategory(category, sessionBase, maxPages, delayMs) {
  const sourceUrl = sourceUrlForCategory(sessionBase, category);
  const firstPage = await fetchHtml(sourceUrl, { maxRedirects: 2 });
  if (!firstPage || firstPage.status !== 200) {
    throw new Error(`RecentUploads category ${category} failed: ${firstPage?.status || "unknown"}`);
  }

  let html = firstPage.data;
  const entries = new Map();
  const pageSummaries = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const pageEntries = parseRecentUploadRows(html, sourceUrl, category);
    for (const entry of pageEntries) {
      entries.set(entry.gazette_id || entry.id, entry);
    }

    pageSummaries.push({
      page,
      item_count: pageEntries.length,
    });

    if (page >= maxPages) break;
    await sleep(delayMs);
    const nextPage = await postAspNetPage(sourceUrl, html, "gvGazetteList", `Page$${page + 1}`);
    if (nextPage.status !== 200) break;
    html = nextPage.data;
  }

  return {
    category,
    label: RECENT_CATEGORIES[category] || `Category ${category}`,
    source_url: sourceUrl,
    pages_scraped: pageSummaries.length,
    page_summaries: pageSummaries,
    entries: [...entries.values()],
  };
}

export async function runRecentUploadsScraper() {
  const categories = parseCategories();
  const maxPages = recentMaxPages();
  const delayMs = recentPoliteDelayMs();
  const sessionBase = await fetchSessionBase();
  const allEntries = new Map();
  const categorySummaries = [];

  for (const category of categories) {
    console.log(`[eGazette] Scraping recent uploads category ${category} (${RECENT_CATEGORIES[category]})`);
    const result = await scrapeCategory(category, sessionBase, maxPages, delayMs);
    categorySummaries.push({
      category: result.category,
      label: result.label,
      source_url: result.source_url,
      pages_scraped: result.pages_scraped,
      page_summaries: result.page_summaries,
      item_count: result.entries.length,
    });

    for (const entry of result.entries) {
      allEntries.set(entry.gazette_id || entry.id, entry);
    }
  }

  let savedCount = 0;
  for (const entry of allEntries.values()) {
    const saved = await saveJSON(`${EGAZETTE_ITEMS_ROOT}/${entry.id}.json`, buildItemPayload(entry));
    if (saved) savedCount += 1;
  }

  const summary = {
    source: "eGazette Recent Uploads",
    source_url: sessionBase,
    categories,
    max_pages_per_category: maxPages,
    category_summaries: categorySummaries,
    total_items: [...allEntries.values()].length,
    saved_items: savedCount,
    scraped_at: new Date().toISOString(),
    entries: [...allEntries.values()].map((entry) => ({
      id: entry.id,
      gazette_id: entry.gazette_id,
      section: entry.section,
      ministry: entry.ministry,
      title: entry.title,
      publish_date: entry.publish_date,
      file_size: entry.file_size,
      download_url: entry.download_url,
      detail_url: entry.detail_url,
      recent_category: entry.recent_category,
      recent_category_label: entry.recent_category_label,
    })),
  };

  await saveJSON(`${EGAZETTE_RECENT_INDEX_ROOT}/recent-index.json`, summary);
  console.log(`[eGazette] Recent uploads saved ${savedCount}/${summary.total_items} unique items`);
}

export async function scrapeRecentUploads() {
  return runRecentUploadsScraper();
}
