import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as cheerio from "cheerio";

import { fetchBinary, fetchHtml } from "../../common/request.js";
import { parseDOCX } from "../../parsers/docxParser.js";
import { parsePDF } from "../../parsers/pdfParser.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { slugify } from "../indiaCode/baseScraper.js";

export function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeUrl(href, baseUrl) {
  if (!href) return null;
  const trimmed = String(href).trim();
  if (!trimmed || trimmed === "#") return null;
  if (/^javascript:/i.test(trimmed) || /^mailto:/i.test(trimmed)) return null;

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

export function safeSlug(value = "", fallback = "template", maxLength = 120) {
  const slug = slugify(String(value || "")).slice(0, maxLength);
  return slug || fallback;
}

export function hashId(value = "") {
  return crypto.createHash("sha1").update(String(value || "")).digest("hex").slice(0, 12);
}

export function getDocumentFormat(url = "") {
  const lower = String(url || "").toLowerCase().split(/[?#]/)[0];
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".docx")) return "docx";
  if (lower.endsWith(".doc")) return "doc";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  if (lower.endsWith(".pptx")) return "pptx";
  if (lower.endsWith(".ppt")) return "ppt";
  return "html";
}

export function buildItemId({ title, documentUrl, documentDate, fallback = "template" }) {
  const basis = documentUrl || `${title || fallback}_${documentDate || "undated"}`;
  const slug = safeSlug(`${title || fallback}_${documentDate || "undated"}`, fallback);
  return `${slug}_${hashId(basis)}`;
}

export function buildExistingItemIndex(itemsDir, suffix = ".json") {
  const index = new Map();
  if (!fs.existsSync(itemsDir)) return index;

  for (const entry of fs.readdirSync(itemsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(suffix)) continue;
    const filePath = path.join(itemsDir, entry.name);
    try {
      const item = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (!item.document_url) continue;
      index.set(hashId(item.document_url), { item, filePath });
    } catch {
      continue;
    }
  }

  return index;
}

function dedupeRefs(existing = [], incoming = []) {
  const refs = new Map();
  for (const ref of [...existing, ...incoming]) {
    const key = `${ref.label || ""}::${ref.page_url || ""}::${ref.detail_url || ""}`;
    if (!refs.has(key)) refs.set(key, ref);
  }
  return [...refs.values()];
}

async function fetchHtmlText(url) {
  const response = await fetchHtml(url, { maxRedirects: 5 });
  if (response.status >= 400 || !response.data) {
    return {
      text: "",
      source_error: `html_fetch_status_${response.status}`,
      link_status: "unreachable",
    };
  }

  const $ = cheerio.load(response.data);
  $("script, style, noscript, svg").remove();
  const text = normalizeText($("main").text() || $("body").text());

  return {
    text,
    num_pages: null,
    info: {
      title: normalizeText($("title").text()),
    },
    link_status: "resolved",
  };
}

async function fetchBinaryDocument(url, format) {
  let encodedUrl = url;
  try {
    encodedUrl = encodeURI(decodeURI(url));
  } catch {
    encodedUrl = encodeURI(url);
  }
  const attemptedUrls = [...new Set([url, encodedUrl])];

  for (const candidateUrl of attemptedUrls) {
    const response = await fetchBinary(candidateUrl, { maxRedirects: 5 });
    if (response.status >= 400 || !response.data) {
      continue;
    }

    const buffer = Buffer.from(response.data);
    if (format === "pdf") {
      if (buffer.slice(0, 5).toString("utf8") !== "%PDF-") {
        return {
          text: "",
          num_pages: null,
          info: {},
          link_status: "invalid_binary",
          recovery_attempts: attemptedUrls,
          source_error: "source_did_not_return_pdf",
        };
      }

      const parsed = await parsePDF(buffer);
      return {
        text: parsed.text || "",
        num_pages: parsed.numPages || null,
        info: parsed.info || {},
        link_status: parsed.error ? "parse_error" : "resolved",
        recovery_attempts: attemptedUrls,
        source_error: parsed.error ? parsed.error.message : null,
      };
    }

    if (format === "docx") {
      if (buffer.slice(0, 2).toString("utf8") !== "PK") {
        return {
          text: "",
          num_pages: null,
          info: {},
          link_status: "invalid_binary",
          recovery_attempts: attemptedUrls,
          source_error: "source_did_not_return_docx",
        };
      }

      const parsed = await parseDOCX(buffer);
      return {
        text: parsed.text || "",
        num_pages: null,
        info: {
          messages: parsed.messages || [],
        },
        link_status: parsed.error ? "parse_error" : "resolved",
        recovery_attempts: attemptedUrls,
        source_error: parsed.error ? parsed.error.message : null,
      };
    }
  }

  return {
    text: "",
    num_pages: null,
    info: {},
    link_status: "broken_upstream",
    recovery_attempts: attemptedUrls,
    source_error: "binary_fetch_failed",
  };
}

export async function fetchDocumentText(documentUrl, format) {
  if (format === "pdf" || format === "docx") {
    return fetchBinaryDocument(documentUrl, format);
  }

  if (format === "html") {
    return fetchHtmlText(documentUrl);
  }

  return {
    text: "",
    num_pages: null,
    info: {},
    link_status: "unsupported_format",
    recovery_attempts: [],
    source_error: null,
  };
}

export function buildTemplateItem(candidate, existingItem, documentData) {
  const format = getDocumentFormat(candidate.documentUrl);
  const previous = existingItem || {};
  const hasText = Boolean(documentData.text || previous.text);
  const sourceRef = {
    label: candidate.sourceLabel,
    type: candidate.sourceType,
    mode: candidate.sourceMode,
    page_url: candidate.pageUrl,
    detail_url: candidate.detailUrl,
  };
  const extractionStatus = hasText
    ? "parsed"
    : documentData.link_status === "unsupported_format"
    ? "linked_only"
    : documentData.source_error
    ? "source_error"
    : "linked_but_unresolved";

  return {
    id: candidate.id,
    title: candidate.title,
    source_type: candidate.sourceType,
    source_label: candidate.sourceLabel,
    source_mode: candidate.sourceMode,
    category: candidate.category || null,
    language: candidate.language || null,
    document_url: candidate.documentUrl,
    detail_url: candidate.detailUrl,
    page_url: candidate.pageUrl,
    document_date: candidate.documentDate || null,
    document_format: format,
    has_text: hasText,
    text: documentData.text || previous.text || "",
    extraction: {
      status: extractionStatus,
      num_pages: documentData.num_pages ?? previous?.extraction?.num_pages ?? null,
      info: documentData.info || previous?.extraction?.info || {},
      link_status: documentData.link_status || previous?.extraction?.link_status || null,
      recovery_attempts:
        documentData.recovery_attempts ||
        previous?.extraction?.recovery_attempts ||
        [],
      source_error: documentData.source_error || previous?.extraction?.source_error || null,
    },
    source_refs: dedupeRefs(previous.source_refs || [], [sourceRef]),
  };
}

export async function saveTemplateCollection({
  storageRoot,
  itemsRoot,
  items,
  sources,
  fetchText,
}) {
  items.sort((left, right) => left.id.localeCompare(right.id));

  const parsedItems = items.filter((item) => item?.extraction?.status === "parsed");
  const unresolvedItems = items.filter((item) => item?.extraction?.status !== "parsed");
  const parsedSummaries = parsedItems.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    language: item.language,
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
    category: item.category,
    language: item.language,
    source_type: item.source_type,
    document_url: item.document_url,
    document_date: item.document_date,
    document_format: item.document_format,
    status: item?.extraction?.status || "unknown",
    link_status: item?.extraction?.link_status || null,
    source_error: item?.extraction?.source_error || null,
  }));

  for (const item of items) {
    await saveJSON(`${itemsRoot}/${item.id}.json`, item);
  }

  await saveJSON(`${storageRoot}/parsed-index.json`, {
    count: parsedSummaries.length,
    items: parsedSummaries,
  });

  await saveJSON(`${storageRoot}/unresolved.json`, {
    count: unresolvedSummaries.length,
    items: unresolvedSummaries,
  });

  await saveJSON(`${storageRoot}/index.json`, {
    source_rows: sources.reduce((sum, source) => sum + Number(source.item_count || 0), 0),
    unique_items: items.length,
    canonical_item_files: items.length,
    parsed_items: parsedSummaries.length,
    unresolved_items: unresolvedSummaries.length,
    fetch_text: fetchText,
    sources,
  });
}
