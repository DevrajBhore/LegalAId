// scraper/src/scrapers/indiaCode/baseScraper.js
import { fetchHtml, fetchBinary } from "../../common/request.js";
import { extractText, extractHeadings } from "../../parsers/htmlParser.js";
import { cleanText, splitSections } from "../../parsers/textProcessor.js";

/**
 * Helper utilities for IndiaCode scrapers:
 * - slugify / act_id generation
 * - fetch page and extract text
 * - parse sections heuristically
 */

// Simple slug generator (no extra dep)
export function slugify(s) {
  return s
    .toString()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

export function makeActId(title, year) {
  const base = slugify(`${title}_${year ?? "nodate"}`);
  return base;
}

export async function fetchPageText(url) {
  const res = await fetchHtml(url);
  const html = res.data ?? "";
  const text = extractText(html);
  const headings = extractHeadings(html);
  return { html, text: cleanText(text), headings, url, status: res.status };
}

export async function fetchPDFText(url) {
  const res = await fetchBinary(url);
  const buffer = Buffer.from(res.data);
  // parsePDF lives in parsers/pdfParser.js — import dynamically to avoid circular issues
  const { parsePDF } = await import("../../parsers/pdfParser.js");
  const parsed = await parsePDF(buffer);
  return parsed;
}

/**
 * buildSections(text) => [{ section_number, title, text }]
 * Heuristic: splitSections returns paragraph-like chunks; we attempt to detect headings that look like "Section X" or "1." etc.
 */
export function buildSections(text) {
  const parts = splitSections(text);
  // Attempt to find numbers as section numbers for each part
  const sections = parts.map((p, i) => {
    // Try to capture leading "Section X" or "X." using regex on the beginning of p
    const m = p.match(/^\s*(?:Section|Sec\.?)\s*(\d+[\w\.\-]*)\b[:\.\-\s]*/i);
    const num = m ? m[1] : `${i + 1}`;
    // optional short title detection
    const titleMatch = p.match(
      /^\s*(?:Section|Sec\.?)\s*\d+[\w\.\-]*[:\.\-]?\s*([A-Z][^\.\n]{0,80})/
    );
    const title = titleMatch ? titleMatch[1].trim() : "";
    return { section_number: num.toString(), title, text: p };
  });
  return sections;
}
