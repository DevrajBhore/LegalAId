import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

import { fetchBinary } from "../../common/request.js";
import { parsePDF } from "../../parsers/pdfParser.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { slugify } from "../indiaCode/baseScraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MCA_STORAGE_ROOT = "regulatory/mca";
const MCA_ITEMS_ROOT = `${MCA_STORAGE_ROOT}/items`;
const MCA_ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/regulatory/mca/items");
const MCA_ITEM_FILE_SUFFIX = ".json";
const MCA_SOURCE_LABELS = {
  "notices-circulars": "MCA Notices & Circulars",
  circulars: "MCA Circulars",
  updates: "MCA Updates",
  "whats-new": "MCA What's New",
  "press-release": "MCA Press Releases",
};
const MCA_DEFAULT_SOURCES = [
  {
    url: "https://www.mca.gov.in/content/mca/global/en/notifications-tender/notices-circulars.html",
    type: "notices-circulars",
    label: "MCA Notices & Circulars",
  },
  {
    url: "https://www.mca.gov.in/content/mca/global/en/notifications-tender/circulars.html",
    type: "circulars",
    label: "MCA Circulars",
  },
  {
    url: "https://www.mca.gov.in/content/mca/global/en/notifications-tender/news-updates/updates.html",
    type: "updates",
    label: "MCA Updates",
  },
  {
    url: "https://www.mca.gov.in/content/mca/global/en/notifications-tender/whats-new.html",
    type: "whats-new",
    label: "MCA What's New",
  },
  {
    url: "https://www.mca.gov.in/content/mca/global/en/notifications-tender/news-updates/press-release.html",
    type: "press-release",
    label: "MCA Press Releases",
  },
];

function shouldFetchPdf() {
  return String(process.env.SCRAPER_MCA_FETCH_PDF || "true").toLowerCase() !== "false";
}

function shouldUsePuppeteer() {
  return String(process.env.SCRAPER_MCA_PUPPETEER || "true").toLowerCase() !== "false";
}

function normalizeUrl(href, baseUrl = "https://www.mca.gov.in/") {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed || trimmed === "#") return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function safeSlug(value = "") {
  const slug = slugify(String(value || "")).slice(0, 140);
  return slug || "mca";
}

function extractDate(value = "") {
  const text = String(value || "");
  const longMatch = text.match(/\b(\d{1,2})[.\-/ ]([A-Za-z]{3,9})[.\-/ ,]+(\d{4})\b/);
  if (longMatch) {
    const [, day, month, year] = longMatch;
    return `${String(day).padStart(2, "0")}-${month}-${year}`;
  }

  const compactMatch = text.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
  if (compactMatch) {
    const [, year, month, day] = compactMatch;
    return `${day}-${month}-${year}`;
  }

  return null;
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
  const configPath = path.resolve(__dirname, "../../../config/mca.sources.json");
  const config = readJsonFile(configPath);
  if (Array.isArray(config?.sources) && config.sources.length) {
    return config.sources;
  }
  return MCA_DEFAULT_SOURCES;
}

function looksLikeDocumentUrl(url = "") {
  const lower = String(url).toLowerCase();
  return (
    lower.includes("/content/dam/mca/") ||
    lower.includes("/bin/dms/getdocument") ||
    lower.endsWith(".pdf") ||
    lower.includes(".pdf?")
  );
}

function buildItemId({ title, documentUrl, documentDate }) {
  const basis = documentUrl || `${title || "mca"}_${documentDate || "undated"}`;
  const slug = safeSlug(`${title || "mca"}_${documentDate || "undated"}`);
  const hash = crypto.createHash("sha1").update(String(basis)).digest("hex").slice(0, 12);
  return `${slug}_${hash}`;
}

function buildItemPath(itemId) {
  return path.join(MCA_ITEMS_DIR, `${itemId}${MCA_ITEM_FILE_SUFFIX}`);
}

function hashDocumentUrl(url = "") {
  if (!url) return null;
  return crypto.createHash("sha1").update(String(url)).digest("hex");
}

function buildExistingItemIndex() {
  const index = new Map();
  if (!fs.existsSync(MCA_ITEMS_DIR)) return index;

  for (const entry of fs.readdirSync(MCA_ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(MCA_ITEM_FILE_SUFFIX)) continue;
    const filePath = path.join(MCA_ITEMS_DIR, entry.name);
    try {
      const item = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const key = hashDocumentUrl(item.document_url);
      if (!key) continue;
      index.set(key, {
        item,
        filePath,
      });
    } catch {
      continue;
    }
  }

  return index;
}

function removeObsoleteMcaFiles(activeItemIds = new Set()) {
  if (!fs.existsSync(MCA_ITEMS_DIR)) return;

  for (const entry of fs.readdirSync(MCA_ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(MCA_ITEM_FILE_SUFFIX)) continue;
    const itemId = entry.name.slice(0, -MCA_ITEM_FILE_SUFFIX.length);
    if (activeItemIds.has(itemId)) continue;
    fs.unlinkSync(path.join(MCA_ITEMS_DIR, entry.name));
    console.log(`[MCA] Removed stale item -> ${entry.name}`);
  }
}

function mergeSourceRefs(existingItem, source) {
  const refs = new Map();
  for (const entry of existingItem?.source_refs || []) {
    if (!entry?.url) continue;
    refs.set(entry.url, entry);
  }
  refs.set(source.url, {
    type: source.type || "mca",
    label: source.label || source.type || "mca",
    url: source.url,
  });
  return [...refs.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function isGenericSiteAsset(title = "", url = "") {
  const haystack = `${title} ${url}`.toLowerCase();
  return (
    haystack.includes("website_policies") ||
    haystack.includes("website policies") ||
    haystack.includes("accessibility statement") ||
    haystack.includes("privacy policy") ||
    haystack.includes("terms of use")
  );
}

function inferMcaDocumentType(title = "", url = "") {
  const haystack = `${title} ${url}`.toLowerCase();

  if (isGenericSiteAsset(title, url)) return null;
  if (/press release/.test(haystack)) return "press-release";
  if (/\b(notice|notification)\b/.test(haystack)) return "notices-circulars";
  if (/\b(circular|guideline|advisory|order)\b/.test(haystack)) return "circulars";
  if (
    /\b(faq|faqs|presentation|webinar|launch|deployment|filing steps|offline payment|go live|spice|llp|v3|form)\b/.test(
      haystack
    )
  ) {
    return "updates";
  }

  return "whats-new";
}

function sourceMatchesDocumentType(sourceType, documentType) {
  if (!documentType) return false;
  if (sourceType === "notices-circulars") {
    return documentType === "notices-circulars" || documentType === "circulars";
  }
  if (sourceType === "whats-new") {
    return documentType === "whats-new" || documentType === "updates";
  }
  return sourceType === documentType;
}

function canReuseExistingItem(existingItem, nextItemBase) {
  if (!existingItem) return false;
  return (
    existingItem.title === nextItemBase.title &&
    existingItem.document_url === nextItemBase.document_url &&
    existingItem.document_date === nextItemBase.document_date &&
    existingItem.category === nextItemBase.category &&
    JSON.stringify(existingItem.source_refs || []) === JSON.stringify(nextItemBase.source_refs || [])
  );
}

function canReuseExistingDocument(existingItem, nextItemBase) {
  if (!existingItem) return false;
  return (
    existingItem.document_url === nextItemBase.document_url &&
    existingItem.document_date === nextItemBase.document_date &&
    existingItem.title === nextItemBase.title
  );
}

async function maybeFetchPdfText(url) {
  if (!shouldFetchPdf() || !url) {
    return null;
  }

  const response = await fetchBinary(url).catch((error) => ({
    error,
    headers: {},
  }));

  if (response?.error) {
    return {
      status: "error",
      reason: response.error?.message || "fetch-failed",
      content_type: null,
      text: "",
      num_pages: null,
      info: null,
    };
  }

  const contentType = response?.headers?.["content-type"] || "";
  if (!String(contentType).toLowerCase().includes("pdf")) {
    return {
      status: "skipped",
      reason: "non-pdf-response",
      content_type: contentType,
      text: "",
      num_pages: null,
      info: null,
    };
  }

  const parsed = await parsePDF(Buffer.from(response.data)).catch((error) => ({ error }));
  if (!parsed || parsed.error) {
    return {
      status: "error",
      reason: parsed?.error?.message || "parse-failed",
      content_type: contentType,
      text: "",
      num_pages: null,
      info: null,
    };
  }

  return {
    status: "parsed",
    reason: null,
    content_type: contentType,
    text: parsed.text || "",
    num_pages: parsed.numPages || null,
    info: parsed.info || null,
  };
}

async function extractLinksWithBrowser(source) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto(source.url, { waitUntil: "domcontentloaded", timeout: 90000 });

    const rawLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => ({
        text: (a.textContent || "").replace(/\s+/g, " ").trim(),
        href: a.getAttribute("href") || "",
      }))
    );

    const links = [];
    const seen = new Set();

    for (const entry of rawLinks) {
      const url = new URL(entry.href, source.url).toString();
      if (!looksLikeDocumentUrl(url)) continue;
      if (seen.has(url)) continue;

      const title = entry.text || path.basename(new URL(url).pathname) || "MCA document";
      const documentDate = extractDate(title) || extractDate(url);
      const inferredType = inferMcaDocumentType(title, url);
      if (!sourceMatchesDocumentType(source.type, inferredType)) continue;

      seen.add(url);
      links.push({
        title,
        url,
        date: documentDate,
        inferredType,
      });
    }

    return links;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function scrapeSource(source) {
  const links = shouldUsePuppeteer() ? await extractLinksWithBrowser(source) : [];
  return {
    source,
    status: "ok",
    item_count: links.length,
    items: links
      .map((link) => ({
        title: link.title,
        document_url: link.url,
        document_date: link.date || null,
        inferred_type: link.inferredType || source.type || "mca",
      }))
      .sort((left, right) => left.document_url.localeCompare(right.document_url)),
  };
}

export async function runMcaScraper() {
  const sources = loadSources();
  if (!sources.length) {
    console.log("[MCA] No sources configured.");
    return;
  }

  const existingItemIndex = buildExistingItemIndex();
  const aggregatedItems = new Map();
  const summary = {
    source_count: sources.length,
    sources: [],
    total_items: 0,
    unique_items: 0,
    canonical_item_files: 0,
  };

  for (const source of sources) {
    console.log(`[MCA] Scraping ${source.url}`);
    const result = await scrapeSource(source);
    summary.sources.push(result);
    summary.total_items += result.item_count || 0;

    for (const link of result.items || []) {
      const key = hashDocumentUrl(link.document_url);
      const itemId = buildItemId({
        title: link.title,
        documentUrl: link.document_url,
        documentDate: link.document_date,
      });
      const inferredType = link.inferred_type || source.type || "mca";
      const existing = aggregatedItems.get(key);
      const sourceRef = {
        type: source.type || "mca",
        label: source.label || MCA_SOURCE_LABELS[source.type] || source.type || "mca",
        url: source.url,
      };

      if (!existing) {
        aggregatedItems.set(key, {
          id: itemId,
          title: link.title,
          type: inferredType,
          category: MCA_SOURCE_LABELS[inferredType] || source.label || inferredType,
          source: "MCA",
          source_url: source.url,
          document_url: link.document_url,
          document_date: link.document_date,
          source_refs: [sourceRef],
        });
      } else {
        existing.source_refs = mergeSourceRefs(existing, source);
      }
    }
  }

  const activeItemIds = new Set();
  const savedItems = new Map();

  for (const item of aggregatedItems.values()) {
    const existingRecord = existingItemIndex.get(hashDocumentUrl(item.document_url));
    const existingItem = existingRecord?.item || null;
    const nextItemBase = {
      ...item,
      source_refs: (item.source_refs || []).sort((left, right) => left.url.localeCompare(right.url)),
    };

    let extraction = { status: "skipped", reason: "pdf_fetch_disabled" };
    let text = "";

    if (canReuseExistingDocument(existingItem, nextItemBase) && existingItem.extraction) {
      extraction = existingItem.extraction;
      text = existingItem.text || "";
    } else {
      const pdfExtraction = await maybeFetchPdfText(item.document_url);
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

    const nextItem = {
      ...nextItemBase,
      extraction,
      text,
    };

    const shouldReuse = canReuseExistingItem(existingItem, nextItem);
    const saved = shouldReuse ? true : await saveJSON(`${MCA_ITEMS_ROOT}/${item.id}.json`, nextItem);
    if (saved) {
      existingItemIndex.set(hashDocumentUrl(item.document_url), {
        item: nextItem,
        filePath: buildItemPath(item.id),
      });
      savedItems.set(item.document_url, nextItem);
      activeItemIds.add(item.id);
    }
  }

  removeObsoleteMcaFiles(activeItemIds);

  summary.sources = summary.sources.map((sourceSummary) => ({
    ...sourceSummary,
    item_count: sourceSummary.items.length,
    items: sourceSummary.items
      .map((item) => {
        const savedItem = savedItems.get(item.document_url);
        if (!savedItem) return null;
        return {
          id: savedItem.id,
          title: savedItem.title,
          document_url: savedItem.document_url,
          document_date: savedItem.document_date,
          type: savedItem.type,
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.id.localeCompare(right.id)),
  }));

  const uniqueIds = new Set();
  for (const source of summary.sources) {
    for (const item of source.items || []) {
      if (item?.id) uniqueIds.add(item.id);
    }
  }
  summary.unique_items = uniqueIds.size;
  summary.canonical_item_files = fs.existsSync(MCA_ITEMS_DIR)
    ? fs.readdirSync(MCA_ITEMS_DIR, { withFileTypes: true }).filter((entry) => entry.isFile() && entry.name.endsWith(MCA_ITEM_FILE_SUFFIX)).length
    : 0;

  await saveJSON(`${MCA_STORAGE_ROOT}/index.json`, summary);
  console.log(
    `[MCA] Completed. Source rows: ${summary.total_items}; unique items: ${summary.unique_items}; files: ${summary.canonical_item_files}`
  );
}

export async function scrapeMcaCirculars() {
  return runMcaScraper();
}
