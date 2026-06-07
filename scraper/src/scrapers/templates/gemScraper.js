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

const STORAGE_ROOT = "templates/gem";
const ITEMS_ROOT = `${STORAGE_ROOT}/items`;
const ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/templates/gem/items");

const DEFAULT_SOURCES = [
  {
    url: "https://gem.gov.in/support/sellers/?lang=english",
    type: "gem-support-documents",
    label: "GeM Support Documents",
    mode: "support-page",
  },
  {
    url: "https://gem.gov.in/terms-of-use",
    type: "gem-terms",
    label: "GeM Terms of Use",
    mode: "direct-document",
    title: "GeM Terms of Use",
  },
  {
    url: "https://gem.gov.in/support/terms_conditions",
    type: "gem-terms",
    label: "GeM Terms and Conditions",
    mode: "direct-document",
    title: "GeM Terms and Conditions",
  },
  {
    url: "https://assets-bg.gem.gov.in/resources/upload/shared_doc/gtc/general-te-1675401798.pdf",
    type: "gem-general-terms",
    label: "GeM General Terms and Conditions",
    mode: "direct-document",
    title: "General Terms and Conditions on GeM 4.0",
  },
];

function shouldFetchText() {
  return (
    String(
      process.env.SCRAPER_GEM_FETCH_TEXT ??
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
  const configPath = path.resolve(__dirname, "../../../config/gem.sources.json");
  const config = readJsonFile(configPath);
  if (Array.isArray(config?.sources) && config.sources.length) return config.sources;
  return DEFAULT_SOURCES;
}

function titleFromUrl(documentUrl) {
  try {
    const lastSegment = decodeURIComponent(new URL(documentUrl).pathname.split("/").pop() || "");
    return lastSegment
      .replace(/\.(pdf|docx?|xlsx?|pptx?)$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\b\d{10}\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "GeM Document";
  }
}

function isGenericLinkTitle(title = "") {
  return /^(download|view|click here|pdf|document)$/i.test(normalizeText(title));
}

function inferCategory(title, documentUrl) {
  const haystack = `${title} ${documentUrl}`.toLowerCase();
  if (haystack.includes("terms") || haystack.includes("gtc")) return "Terms and Conditions";
  if (haystack.includes("bank-guarantee") || haystack.includes("epbg") || haystack.includes("emd")) {
    return "Bid Security and Guarantees";
  }
  if (haystack.includes("undertaking") || haystack.includes("format")) return "Formats and Undertakings";
  if (haystack.includes("policy") || haystack.includes("rating") || haystack.includes("validation")) {
    return "Policies";
  }
  if (haystack.includes("manual") || haystack.includes("guidelines")) return "Guidelines and Manuals";
  return "GeM Reference Documents";
}

function isUsefulGemDocument(documentUrl) {
  const lower = String(documentUrl || "").toLowerCase();
  const format = getDocumentFormat(documentUrl);
  if (["pdf", "html"].includes(format) === false) return false;

  return (
    lower.includes("assets-bg.gem.gov.in/resources/") ||
    lower === "https://gem.gov.in/terms-of-use" ||
    lower === "https://gem.gov.in/support/terms_conditions"
  );
}

async function loadHtml(url) {
  const response = await fetchHtml(url, { maxRedirects: 5 });
  if (response.status >= 400 || !response.data) {
    throw new Error(`HTML fetch failed (${response.status}) for ${url}`);
  }
  return cheerio.load(response.data);
}

function buildCandidateFromSource(source, documentUrl, title = "") {
  const normalizedTitle = normalizeText(title) || titleFromUrl(documentUrl);
  return {
    id: buildItemId({
      title: normalizedTitle,
      documentUrl,
      documentDate: null,
      fallback: "gem",
    }),
    title: normalizedTitle,
    documentUrl,
    documentDate: null,
    detailUrl: source.url,
    pageUrl: source.url,
    sourceType: source.type,
    sourceLabel: source.label,
    sourceMode: source.mode,
    category: inferCategory(normalizedTitle, documentUrl),
    language: "English",
  };
}

async function extractSupportPage(source) {
  const $ = await loadHtml(source.url);
  const candidatesByUrl = new Map();

  $("a[href]").each((_, anchor) => {
    const documentUrl = normalizeUrl($(anchor).attr("href"), source.url);
    if (!documentUrl || !isUsefulGemDocument(documentUrl)) return;

    const title =
      normalizeText($(anchor).attr("title")) ||
      normalizeText($(anchor).text()) ||
      normalizeText($(anchor).find("img").attr("alt")) ||
      titleFromUrl(documentUrl);
    const finalTitle = isGenericLinkTitle(title) ? titleFromUrl(documentUrl) : title;
    const previous = candidatesByUrl.get(documentUrl);
    if (previous?.title && previous.title.length >= finalTitle.length) return;

    candidatesByUrl.set(documentUrl, buildCandidateFromSource(source, documentUrl, finalTitle));
  });

  return [...candidatesByUrl.values()];
}

function extractDirectDocument(source) {
  const documentUrl = normalizeUrl(source.url, source.url);
  if (!documentUrl || !isUsefulGemDocument(documentUrl)) return [];
  return [buildCandidateFromSource(source, documentUrl, source.title || source.label)];
}

async function extractSourceItems(source) {
  if (source.mode === "support-page") return extractSupportPage(source);
  if (source.mode === "direct-document") return extractDirectDocument(source);
  return [];
}

export async function scrapeGemTemplates() {
  const sources = loadSources();
  const existingIndex = buildExistingItemIndex(ITEMS_DIR);
  const canonicalItems = new Map();
  const sourceSummaries = [];
  const fetchText = shouldFetchText();

  console.log("[Scraper] Starting GeM template/reference scraper");

  for (const source of sources) {
    try {
      const extracted = await extractSourceItems(source);
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
      console.error(`[GeM] Source failed (${source.label}):`, error?.message || error);
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
    `[Scraper] GeM templates/references complete: ${items.length} unique items from ${sourceSummaries.length} sources`
  );

  return {
    sourceRows: sourceSummaries.reduce((sum, source) => sum + Number(source.item_count || 0), 0),
    uniqueItems: items.length,
  };
}

export async function runGemScraper() {
  return scrapeGemTemplates();
}

export default runGemScraper;
