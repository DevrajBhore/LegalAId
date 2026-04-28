import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";

import { fetchBinary, fetchHtml } from "../../common/request.js";
import { parsePDF } from "../../parsers/pdfParser.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { EGAZETTE_ITEMS_ROOT } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EGAZETTE_ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/gazette/egazette/items");

function readExistingItems() {
  if (!fs.existsSync(EGAZETTE_ITEMS_DIR)) return [];

  return fs
    .readdirSync(EGAZETTE_ITEMS_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const fullPath = path.join(EGAZETTE_ITEMS_DIR, name);
      try {
        return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  try {
    return new URL(String(href).trim(), baseUrl).toString();
  } catch {
    return null;
  }
}

function extractPdfUrlFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);

  const directHref =
    $("a[href*='.pdf']").first().attr("href") ||
    $("iframe[src*='.pdf']").first().attr("src") ||
    $("embed[src*='.pdf']").first().attr("src");

  if (directHref) {
    return normalizeUrl(directHref, baseUrl);
  }

  const match = String(html).match(/https?:\/\/[^'"\s>]+\.pdf[^'"\s>]*/i);
  if (match) {
    return normalizeUrl(match[0], baseUrl);
  }

  return null;
}

async function resolveDownloadUrl(item) {
  if (item.download_url) return item.download_url;
  if (!item.detail_url) return null;

  const response = await fetchHtml(item.detail_url).catch(() => null);
  if (!response || response.status !== 200) return null;
  return extractPdfUrlFromHtml(response.data, item.detail_url);
}

async function extractPdfData(url) {
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

  const parsed = await parsePDF(Buffer.from(response.data));
  if (parsed?.error) {
    return {
      status: "error",
      reason: "parse-failed",
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

export async function runPdfExtractor() {
  const items = readExistingItems();
  let extractedCount = 0;

  for (const item of items) {
    if (item.extraction?.status === "parsed" && item.text) {
      continue;
    }

    const resolvedUrl = await resolveDownloadUrl(item);
    const extraction = resolvedUrl
      ? await extractPdfData(resolvedUrl)
      : {
          status: "skipped",
          reason: "missing_download_reference",
          content_type: null,
          text: "",
          num_pages: null,
          info: null,
        };

    const nextItem = {
      ...item,
      download_url: resolvedUrl || item.download_url || null,
      extraction: {
        status: extraction.status,
        reason: extraction.reason,
        content_type: extraction.content_type,
        num_pages: extraction.num_pages,
        info: extraction.info,
      },
      text: extraction.text || "",
    };

    const saved = await saveJSON(`${EGAZETTE_ITEMS_ROOT}/${item.id}.json`, nextItem);
    if (saved && extraction.status === "parsed") {
      extractedCount += 1;
    }
  }

  console.log(`[eGazette] Parsed PDFs for ${extractedCount} gazette items`);
}

export async function extractGazettePdf() {
  return runPdfExtractor();
}
