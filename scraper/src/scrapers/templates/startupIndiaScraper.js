import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

import { fetchHtml } from "../../common/request.js";
import {
  buildExistingItemIndex,
  buildItemId,
  buildTemplateItem,
  fetchDocumentText,
  getDocumentFormat,
  hashId,
  normalizeText,
  normalizeUrl,
  saveTemplateCollection,
} from "./templateDocumentUtils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_ROOT = "templates/startup-india";
const ITEMS_ROOT = `${STORAGE_ROOT}/items`;
const ITEMS_DIR = path.resolve(
  __dirname,
  "../../../../knowledge-base/templates/startup-india/items"
);

const DEFAULT_SOURCES = [
  {
    url: "https://www.startupindia.gov.in/content/sih/en/reources/templates.html",
    type: "startup-templates",
    label: "Startup India Templates",
    mode: "template-page",
  },
];

function shouldFetchText() {
  return (
    String(
      process.env.SCRAPER_STARTUP_INDIA_FETCH_TEXT ??
        process.env.SCRAPER_TEMPLATE_FETCH_TEXT ??
        "true"
    ).toLowerCase() !== "false"
  );
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
  const configPath = path.resolve(__dirname, "../../../config/startup-india.sources.json");
  const config = readJsonFile(configPath);
  if (Array.isArray(config?.sources) && config.sources.length) return config.sources;
  return DEFAULT_SOURCES;
}

function titleFromUrl(documentUrl) {
  try {
    const lastSegment = decodeURIComponent(new URL(documentUrl).pathname.split("/").pop() || "");
    return lastSegment.replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, "").replace(/[_-]+/g, " ").trim();
  } catch {
    return "Startup India Template";
  }
}

function inferMetadata(documentUrl) {
  const lower = String(documentUrl || "").toLowerCase();

  if (lower.includes("/hr_templates/")) {
    return { category: "HR Templates", language: "English" };
  }
  if (lower.includes("/legal_templates/")) {
    return { category: "Legal Templates", language: "English" };
  }
  if (lower.includes("/pitch_guidelines/")) {
    return { category: "Pitch Deck Guidelines", language: "English" };
  }
  if (lower.includes("/in_english/")) {
    return { category: "English Model Contracts", language: "English" };
  }
  if (lower.includes("/in_hindi/")) {
    return { category: "Hindi Model Contracts", language: "Hindi" };
  }
  if (lower.includes("/in_tamil/")) {
    return { category: "Tamil Model Contracts", language: "Tamil" };
  }
  if (lower.includes("/in_malayalam/")) {
    return { category: "Malayalam Model Contracts", language: "Malayalam" };
  }
  if (lower.includes("/lets_venture/") || lower.includes("/internal_templates/")) {
    return { category: "Startup Relevant Templates", language: "English" };
  }

  return { category: "Startup India Resources", language: "English" };
}

function isTemplateDocumentUrl(documentUrl) {
  const format = getDocumentFormat(documentUrl);
  if (!["pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt"].includes(format)) {
    return false;
  }

  const lower = String(documentUrl || "").toLowerCase();
  return (
    lower.includes("startupindia.gov.in/content/dam/invest-india/templates/") ||
    lower.includes("startupindia.gov.in/content/dam/startupindia/")
  );
}

async function loadHtml(url) {
  const response = await fetchHtml(url, { maxRedirects: 5 });
  if (response.status >= 400 || !response.data) {
    throw new Error(`HTML fetch failed (${response.status}) for ${url}`);
  }
  return cheerio.load(response.data);
}

async function extractTemplatePage(source) {
  const $ = await loadHtml(source.url);
  const candidatesByUrl = new Map();

  $("a[href]").each((_, anchor) => {
    const documentUrl = normalizeUrl($(anchor).attr("href"), source.url);
    if (!documentUrl || !isTemplateDocumentUrl(documentUrl)) return;

    const title = normalizeText($(anchor).text()) || titleFromUrl(documentUrl);
    const previous = candidatesByUrl.get(documentUrl);
    if (previous?.title && (!title || previous.title.length >= title.length)) return;

    const metadata = inferMetadata(documentUrl);
    candidatesByUrl.set(documentUrl, {
      title,
      documentUrl,
      documentDate: null,
      detailUrl: source.url,
      pageUrl: source.url,
      sourceType: source.type,
      sourceLabel: source.label,
      sourceMode: source.mode,
      category: metadata.category,
      language: metadata.language,
    });
  });

  return [...candidatesByUrl.values()].map((candidate) => ({
    ...candidate,
    id: buildItemId({
      title: candidate.title,
      documentUrl: candidate.documentUrl,
      documentDate: candidate.documentDate,
      fallback: "startup_india",
    }),
  }));
}

export async function scrapeStartupIndiaTemplates() {
  const sources = loadSources();
  const existingIndex = buildExistingItemIndex(ITEMS_DIR);
  const canonicalItems = new Map();
  const sourceSummaries = [];
  const fetchText = shouldFetchText();

  console.log("[Scraper] Starting Startup India template scraper");

  for (const source of sources) {
    try {
      const extracted = await extractTemplatePage(source);
      const sourceItems = [];

      for (const candidate of extracted) {
        const key = hashId(candidate.documentUrl);
        const existing = canonicalItems.get(key)?.item || existingIndex.get(key)?.item || null;
        const canReuseText = existing?.document_url === candidate.documentUrl && existing?.text;
        const documentData =
          fetchText && !canReuseText
            ? await fetchDocumentText(candidate.documentUrl, getDocumentFormat(candidate.documentUrl))
            : {
                text: existing?.text || "",
                num_pages: existing?.extraction?.num_pages ?? null,
                info: existing?.extraction?.info || {},
                link_status: existing?.extraction?.link_status || null,
                source_error: existing?.extraction?.source_error || null,
              };
        const item = buildTemplateItem(candidate, existing, documentData);

        canonicalItems.set(key, { item });
        sourceItems.push({
          id: item.id,
          title: item.title,
          category: item.category,
          language: item.language,
          document_url: item.document_url,
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
      console.error(`[Startup India] Source failed (${source.label}):`, error?.message || error);
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
  await saveTemplateCollection({
    storageRoot: STORAGE_ROOT,
    itemsRoot: ITEMS_ROOT,
    items,
    sources: sourceSummaries,
    fetchText,
  });

  console.log(
    `[Scraper] Startup India templates complete: ${items.length} unique items from ${sourceSummaries.length} sources`
  );

  return {
    sourceRows: sourceSummaries.reduce((sum, source) => sum + Number(source.item_count || 0), 0),
    uniqueItems: items.length,
  };
}

export async function runStartupIndiaScraper() {
  return scrapeStartupIndiaTemplates();
}

export default runStartupIndiaScraper;
