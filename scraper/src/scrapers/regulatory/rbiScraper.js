import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

import { fetchHtml, fetchBinary } from "../../common/request.js";
import { parsePDF } from "../../parsers/pdfParser.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { slugify } from "../indiaCode/baseScraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RBI_STORAGE_ROOT = "regulatory/rbi";
const RBI_ITEMS_ROOT = `${RBI_STORAGE_ROOT}/items`;
const RBI_ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/regulatory/rbi/items");
const RBI_ITEM_FILE_SUFFIX = ".json";

const DEFAULT_SOURCES = [
  {
    url: "https://www.rbi.org.in/Scripts/NotificationUser.aspx",
    type: "notifications",
    label: "RBI Notifications",
  },
  {
    url: "https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx",
    type: "master-directions",
    label: "RBI Master Directions",
  },
];

function shouldUsePuppeteer() {
  return String(process.env.SCRAPER_RBI_PUPPETEER || "").toLowerCase() === "true";
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    console.error("[RBI] Failed to read JSON config:", error.message);
    return null;
  }
}

function loadSources() {
  const envSeeds = String(process.env.SCRAPER_RBI_SEEDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (envSeeds.length > 0) {
    return envSeeds.map((url) => ({
      url,
      type: "seed",
      label: "RBI Seed",
    }));
  }

  const configPath = path.resolve(__dirname, "../../../config/rbi.sources.json");
  const config = readJsonFile(configPath);
  if (config?.sources?.length) {
    return config.sources;
  }

  return DEFAULT_SOURCES;
}

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function looksLikePdf(url = "") {
  const lower = url.toLowerCase();
  return lower.includes(".pdf");
}

function isGenericRbiAsset(title = "", url = "") {
  const haystack = `${title} ${url}`.toLowerCase();
  return (
    haystack.includes("accessibility statement") ||
    haystack.includes("vision and values") ||
    haystack.includes("utkarsh") ||
    haystack.includes("/rdocs/content/pdfs/") ||
    haystack.includes("accessibility20012026.pdf")
  );
}

function extractDate(text = "") {
  const candidates = [
    /\b(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})\b/,
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/,
  ];
  for (const pattern of candidates) {
    const match = String(text).match(pattern);
    if (match) return match[1];
  }
  return null;
}

function hashId(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function safeSlug(value, maxLength = 120) {
  const slug = slugify(value);
  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/_+$/g, "");
}

function buildItemId(title, date, url) {
  const base = safeSlug(`${title || "rbi"}_${date || "undated"}`);
  return `${base}_${hashId(url || `${title}::${date}`)}`;
}

function extractItemHash(itemId = "") {
  const match = String(itemId).match(/_([a-f0-9]{12})$/i);
  return match ? match[1].toLowerCase() : null;
}

function hashDocumentUrl(url = "") {
  if (!url) return null;
  return crypto.createHash("sha1").update(String(url)).digest("hex").slice(0, 12);
}

function buildItemPath(itemId) {
  return path.join(RBI_ITEMS_DIR, `${itemId}${RBI_ITEM_FILE_SUFFIX}`);
}

function buildExistingItemIndex() {
  const index = new Map();

  if (!fs.existsSync(RBI_ITEMS_DIR)) {
    return index;
  }

  for (const entry of fs.readdirSync(RBI_ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(RBI_ITEM_FILE_SUFFIX)) continue;
    const filePath = path.join(RBI_ITEMS_DIR, entry.name);

    try {
      const item = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const hash = hashDocumentUrl(item.document_url) || extractItemHash(item.id || entry.name);
      if (!hash) continue;

      const existing = index.get(hash) || [];
      existing.push({
        itemId: item.id || entry.name.slice(0, -RBI_ITEM_FILE_SUFFIX.length),
        filePath,
        item,
      });
      index.set(hash, existing);
    } catch (error) {
      console.error(`[RBI] Failed to read existing index item ${entry.name}:`, error.message);
    }
  }

  return index;
}

function resolveExistingItem(itemId, documentUrl, existingItemIndex) {
  const hash = hashDocumentUrl(documentUrl) || extractItemHash(itemId);
  if (!hash) {
    return {
      item: null,
      canonicalItemId: itemId,
      canonicalPath: buildItemPath(itemId),
      aliasPaths: [],
    };
  }

  const records = existingItemIndex.get(hash) || [];
  const canonicalRecord = records.find((record) => record.itemId === itemId) || null;
  const preferredRecord = canonicalRecord || records[0] || null;
  const canonicalItemId = preferredRecord?.itemId || itemId;
  const canonicalPath = buildItemPath(canonicalItemId);
  const aliasPaths = records
    .filter((record) => record.itemId !== canonicalItemId)
    .map((record) => record.filePath);

  return {
    item: preferredRecord?.item || null,
    canonicalItemId,
    canonicalPath,
    aliasPaths,
    existingPath: preferredRecord?.filePath || null,
  };
}

function updateExistingItemIndex(existingItemIndex, item) {
  const hash = hashDocumentUrl(item?.document_url) || extractItemHash(item?.id);
  if (!hash) return;
  existingItemIndex.set(hash, [
    {
      itemId: item.id,
      filePath: buildItemPath(item.id),
      item,
    },
  ]);
}

function removeObsoleteAliases(aliasPaths = []) {
  for (const aliasPath of aliasPaths) {
    try {
      if (fs.existsSync(aliasPath)) {
        fs.unlinkSync(aliasPath);
        console.log(`[RBI] Removed obsolete alias -> ${path.basename(aliasPath)}`);
      }
    } catch (error) {
      console.error(`[RBI] Failed to remove obsolete alias ${aliasPath}:`, error.message);
    }
  }
}

function removeObsoleteRbiFiles(activeItemIds = new Set()) {
  if (!fs.existsSync(RBI_ITEMS_DIR)) return;

  for (const entry of fs.readdirSync(RBI_ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(RBI_ITEM_FILE_SUFFIX)) continue;
    const itemId = entry.name.slice(0, -RBI_ITEM_FILE_SUFFIX.length);
    if (activeItemIds.has(itemId)) continue;
    try {
      fs.unlinkSync(path.join(RBI_ITEMS_DIR, entry.name));
      console.log(`[RBI] Removed stale item -> ${entry.name}`);
    } catch (error) {
      console.error(`[RBI] Failed to remove stale item ${entry.name}:`, error.message);
    }
  }
}

function extractLinksFromHtml(html, sourceUrl) {
  const $ = cheerio.load(html);
  const links = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const url = normalizeUrl(href, sourceUrl);
    if (!url || !looksLikePdf(url)) return;
    const title = $(el).text().trim() || $(el).attr("title") || "";
    const contextText = $(el).closest("tr, li, p, div").text();
    const date = extractDate(contextText) || extractDate(title);
    links.push({
      title: title.trim(),
      url,
      date,
      context: contextText.trim(),
    });
  });

  $("a[onclick]").each((_, el) => {
    const onclick = $(el).attr("onclick") || "";
    const matches = String(onclick).match(
      /(https?:\/\/[^'"\s>]+\.pdf[^'"\s>]*)/gi
    );
    if (!matches) return;
    const title = $(el).text().trim() || $(el).attr("title") || "";
    const contextText = $(el).closest("tr, li, p, div").text();
    const date = extractDate(contextText) || extractDate(title);
    for (const match of matches) {
      const url = normalizeUrl(match, sourceUrl);
      if (!url) continue;
      links.push({
        title: title.trim(),
        url,
        date,
        context: contextText.trim(),
      });
    }
  });

  $("[data-href],[data-url],[data-file]").each((_, el) => {
    const candidate =
      $(el).attr("data-href") || $(el).attr("data-url") || $(el).attr("data-file");
    const url = normalizeUrl(candidate, sourceUrl);
    if (!url || !looksLikePdf(url)) return;
    const title = $(el).text().trim() || $(el).attr("title") || "";
    const contextText = $(el).closest("tr, li, p, div").text();
    const date = extractDate(contextText) || extractDate(title);
    links.push({
      title: title.trim(),
      url,
      date,
      context: contextText.trim(),
    });
  });

  const pdfMatches = String(html).match(
    /(https?:\/\/[^'"\s>]+\.pdf[^'"\s>]*)/gi
  );
  if (pdfMatches) {
    for (const match of pdfMatches) {
      const url = normalizeUrl(match, sourceUrl);
      if (!url) continue;
      links.push({
        title: "",
        url,
        date: null,
        context: "",
      });
    }
  }

  return links;
}

function dedupeLinks(links = []) {
  const byUrl = new Map();
  for (const link of links) {
    const key = link.url.toLowerCase();
    const current = byUrl.get(key);
    if (!current) {
      byUrl.set(key, link);
      continue;
    }
    const currentScore = (current.title || "").length + (current.context || "").length;
    const nextScore = (link.title || "").length + (link.context || "").length;
    if (nextScore > currentScore) {
      byUrl.set(key, link);
    }
  }
  return [...byUrl.values()];
}

function buildItemSignature(item) {
  const sourceRefs = (item.source_refs || [])
    .map((entry) => ({
      type: entry.type,
      label: entry.label,
      url: entry.url,
    }))
    .sort((left, right) => left.url.localeCompare(right.url));

  return JSON.stringify({
    id: item.id,
    title: item.title,
    source: item.source,
    document_url: item.document_url,
    document_date: item.document_date || null,
    source_refs: sourceRefs,
  });
}

function canReuseExistingItem(existingItem, nextItem) {
  if (!existingItem) return false;

  const sameSignature =
    buildItemSignature(existingItem) === buildItemSignature(nextItem);
  if (!sameSignature) return false;

  const previousExtraction = existingItem.extraction || {};
  if (String(process.env.SCRAPER_RBI_FETCH_PDF || "").toLowerCase() === "true") {
    return previousExtraction.status === "parsed";
  }

  return true;
}

function canReuseExistingDocument(existingItem, nextItem) {
  if (!existingItem) return false;
  return (
    existingItem.id === nextItem.id &&
    existingItem.title === nextItem.title &&
    existingItem.source === nextItem.source &&
    existingItem.document_url === nextItem.document_url &&
    (existingItem.document_date || null) === (nextItem.document_date || null)
  );
}

function buildSourceRef(source) {
  return {
    type: source.type || "notification",
    label: source.label || source.type || "rbi",
    url: source.url,
  };
}

function mergeSourceRefs(existingItem, source) {
  const refs = new Map();

  for (const entry of existingItem?.source_refs || []) {
    if (!entry?.url) continue;
    refs.set(entry.url, {
      type: entry.type || "notification",
      label: entry.label || entry.type || "rbi",
      url: entry.url,
    });
  }

  const current = buildSourceRef(source);
  refs.set(current.url, current);

  return [...refs.values()].sort((left, right) => left.url.localeCompare(right.url));
}

function collectPdfUrlsFromJson(value, urls) {
  if (!value) return;
  if (typeof value === "string") {
    if (value.toLowerCase().includes(".pdf")) {
      urls.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPdfUrlsFromJson(item, urls);
    return;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      collectPdfUrlsFromJson(value[key], urls);
    }
  }
}

async function fetchHtmlWithBrowser(url) {
  let browser;
  const capturedPdfUrls = new Set();
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    page.on("response", async (response) => {
      try {
        const contentType = response.headers()["content-type"] || "";
        if (!contentType.includes("application/json")) return;
        const json = await response.json();
        collectPdfUrlsFromJson(json, capturedPdfUrls);
      } catch {
        // ignore parse failures
      }
    });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    const html = await page.content();
    return { html, capturedPdfUrls: [...capturedPdfUrls] };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function maybeFetchPdfText(url) {
  if (String(process.env.SCRAPER_RBI_FETCH_PDF || "").toLowerCase() !== "true") {
    return null;
  }

  const response = await fetchBinary(url);
  const contentType = response?.headers?.["content-type"] || "";
  if (!String(contentType).toLowerCase().includes("pdf")) {
    return {
      status: "skipped",
      reason: "non-pdf-response",
      content_type: contentType,
    };
  }

  const parsed = await parsePDF(Buffer.from(response.data));
  if (parsed?.error) {
    return {
      status: "error",
      reason: "parse-failed",
      content_type: contentType,
    };
  }

  return {
    status: "parsed",
    content_type: contentType,
    num_pages: parsed.numPages ?? null,
    text: parsed.text ?? "",
    info: parsed.info ?? {},
  };
}

async function scrapeSource(source, existingItemIndex) {
  const response = await fetchHtml(source.url);
  if (!response || response.status !== 200) {
    return {
      source,
      status: "failed",
      reason: `http_${response?.status || "unknown"}`,
      items: [],
    };
  }

  let html = response.data;
  let links = dedupeLinks(extractLinksFromHtml(html, source.url));

  if (shouldUsePuppeteer() && links.length <= 3) {
    console.log(`[RBI] Low link count for ${source.url} - trying Puppeteer`);
    const browserResult = await fetchHtmlWithBrowser(source.url).catch(() => null);
    if (browserResult?.html) {
      html = browserResult.html;
      links = dedupeLinks(extractLinksFromHtml(html, source.url));
      if (browserResult.capturedPdfUrls?.length) {
        for (const pdfUrl of browserResult.capturedPdfUrls) {
          links.push({
            title: "",
            url: normalizeUrl(pdfUrl, source.url),
            date: null,
            context: "",
          });
        }
        links = dedupeLinks(links);
      }
    }
  }
  const items = [];

  for (const link of links) {
    const title = link.title || link.context || "RBI Document";
    if (isGenericRbiAsset(title, link.url)) {
      continue;
    }
    const itemId = buildItemId(title, link.date, link.url);
    const itemBase = {
      id: itemId,
      title,
      type: source.type || "notification",
      category: source.label || source.type || "rbi",
      source: "RBI",
      source_url: source.url,
      document_url: link.url,
      document_date: link.date || null,
      source_refs: mergeSourceRefs(null, source),
    };

    const resolvedItem = resolveExistingItem(itemId, link.url, existingItemIndex);
    const existingItem = resolvedItem.item;
    const canonicalItemId = resolvedItem.canonicalItemId || itemId;
    const nextItemBase = existingItem
      ? {
          ...itemBase,
          id: canonicalItemId,
          type: existingItem.type || itemBase.type,
          category: existingItem.category || itemBase.category,
          source_url: existingItem.source_url || itemBase.source_url,
          source_refs: mergeSourceRefs(existingItem, source),
        }
      : {
          ...itemBase,
          id: canonicalItemId,
        };

    if (canReuseExistingItem(existingItem, nextItemBase)) {
      if (
        resolvedItem.existingPath &&
        resolvedItem.existingPath !== resolvedItem.canonicalPath &&
        fs.existsSync(resolvedItem.existingPath)
      ) {
        fs.renameSync(resolvedItem.existingPath, resolvedItem.canonicalPath);
        console.log(`[RBI] Canonicalized item -> ${canonicalItemId}.json`);
      }
      removeObsoleteAliases(resolvedItem.aliasPaths);
      updateExistingItemIndex(existingItemIndex, {
        ...existingItem,
        ...nextItemBase,
      });
      items.push({
        id: nextItemBase.id,
        title: nextItemBase.title,
        document_url: nextItemBase.document_url,
        document_date: nextItemBase.document_date,
        type: source.type || "notification",
      });
      continue;
    }

    let extraction = { status: "skipped", reason: "pdf_fetch_disabled" };
    let text = "";

    if (canReuseExistingDocument(existingItem, nextItemBase) && existingItem.extraction) {
      extraction = existingItem.extraction;
      text = existingItem.text || "";
    } else {
      const pdfExtraction = await maybeFetchPdfText(link.url);
      extraction = pdfExtraction
        ? {
            status: pdfExtraction.status,
            content_type: pdfExtraction.content_type || null,
            num_pages: pdfExtraction.num_pages || null,
            info: pdfExtraction.info || null,
            reason: pdfExtraction.reason || null,
          }
        : extraction;
      text = pdfExtraction?.text || "";
    }

    const item = {
      ...nextItemBase,
      extraction,
      text,
    };

    const saved = await saveJSON(`${RBI_ITEMS_ROOT}/${canonicalItemId}.json`, item);
    if (saved) {
      removeObsoleteAliases(resolvedItem.aliasPaths);
      updateExistingItemIndex(existingItemIndex, item);
    }
    items.push({
      id: canonicalItemId,
      title: item.title,
      document_url: item.document_url,
      document_date: item.document_date,
      type: source.type || "notification",
    });
  }

  items.sort((left, right) => left.id.localeCompare(right.id));

  return {
    source,
    status: "ok",
    item_count: items.length,
    items,
  };
}

export async function runRbiScraper() {
  const sources = loadSources();
  if (!sources.length) {
    console.log("[RBI] No sources configured. Set SCRAPER_RBI_SEEDS or config file.");
    return;
  }

  const existingItemIndex = buildExistingItemIndex();
  const summary = {
    source_count: sources.length,
    sources: [],
    total_items: 0,
    unique_items: 0,
    canonical_item_files: 0,
  };
  const activeItemIds = new Set();

  for (const source of sources) {
    console.log(`[RBI] Scraping ${source.url}`);
    const result = await scrapeSource(source, existingItemIndex);
    summary.sources.push(result);
    summary.total_items += result.item_count || 0;
    for (const item of result.items || []) {
      if (item?.id) activeItemIds.add(item.id);
    }
  }

  const uniqueIds = new Set();
  const uniqueDocumentUrls = new Set();
  for (const source of summary.sources) {
    for (const item of source.items || []) {
      if (item?.id) uniqueIds.add(item.id);
      if (item?.document_url) uniqueDocumentUrls.add(item.document_url);
    }
  }
  summary.unique_items = uniqueDocumentUrls.size || uniqueIds.size;
  removeObsoleteRbiFiles(activeItemIds);
  summary.canonical_item_files = fs.existsSync(RBI_ITEMS_DIR)
    ? fs.readdirSync(RBI_ITEMS_DIR, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(RBI_ITEM_FILE_SUFFIX)).length
    : 0;

  await saveJSON(`${RBI_STORAGE_ROOT}/index.json`, summary);
  console.log(
    `[RBI] Completed. Source rows: ${summary.total_items}; unique items: ${summary.unique_items}; files: ${summary.canonical_item_files}`
  );
}

export async function scrapeRbiCirculars() {
  return runRbiScraper();
}
