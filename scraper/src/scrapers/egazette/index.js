import crypto from "crypto";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

import { fetchHtml } from "../../common/request.js";
import { saveJSON } from "../../storage/fileStorage.js";

export const EGAZETTE_STORAGE_ROOT = "gazette/egazette";
export const EGAZETTE_ITEMS_ROOT = `${EGAZETTE_STORAGE_ROOT}/items`;
const EGAZETTE_HOME_URL = "https://egazette.gov.in/";

function shouldUsePuppeteer() {
  const configured = String(process.env.SCRAPER_EGAZETTE_PUPPETEER || "").toLowerCase();
  return configured !== "false";
}

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function slugify(value = "") {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeUrl(href, baseUrl = EGAZETTE_HOME_URL) {
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

function extractUrlsFromString(value, baseUrl) {
  const urls = new Set();
  const text = String(value || "");

  const absoluteMatches = text.match(/https?:\/\/[^'"\s>]+/gi) || [];
  for (const match of absoluteMatches) {
    const normalized = normalizeUrl(match, baseUrl);
    if (normalized) urls.add(normalized);
  }

  const quotedMatches = text.match(/['"]([^'"]+(?:pdf|aspx)[^'"]*)['"]/gi) || [];
  for (const match of quotedMatches) {
    const cleaned = match.slice(1, -1);
    const normalized = normalizeUrl(cleaned, baseUrl);
    if (normalized) urls.add(normalized);
  }

  return [...urls];
}

function looksUsefulDocumentUrl(url = "") {
  const lower = String(url).toLowerCase();
  return (
    lower.includes(".pdf") ||
    lower.includes("viewpdf.aspx") ||
    lower.includes("viewgazette") ||
    lower.includes("searchgazette")
  );
}

function extractDownloadCandidates($node, baseUrl) {
  const urls = new Set();

  $node.find("a, input, button").each((_, el) => {
    const attrs = ["href", "onclick", "data-href", "data-url", "data-file"];
    for (const attr of attrs) {
      const value = el?.attribs?.[attr];
      if (!value) continue;
      for (const candidate of extractUrlsFromString(value, baseUrl)) {
        if (looksUsefulDocumentUrl(candidate)) urls.add(candidate);
      }
    }
  });

  for (const candidate of extractUrlsFromString($node.html() || "", baseUrl)) {
    if (looksUsefulDocumentUrl(candidate)) urls.add(candidate);
  }

  return [...urls];
}

function buildItemId(entry) {
  const basis = entry.gazette_id || entry.download_url || entry.detail_url || entry.title || "egazette";
  const slug = slugify(basis).slice(0, 120) || "egazette";
  const hash = crypto.createHash("sha1").update(basis).digest("hex").slice(0, 12);
  return `${slug}_${hash}`;
}

function classifySection(gazetteId = "") {
  const value = String(gazetteId).toUpperCase();
  if (value.includes("-E-")) return "recent-extraordinary";
  if (value.includes("-W-")) return "recent-weekly";
  return "recent-gazettes";
}

function inferDownloadUrlFromGazetteId(gazetteId = "", publishDate = null) {
  const match = String(gazetteId).match(/-(\d{8})-(\d+)$/);
  if (!match) return null;

  const [, compactDate, documentNumber] = match;
  const year = compactDate.slice(4, 8);
  if (!year || !documentNumber) return null;

  const inferred = `https://egazette.gov.in/WriteReadData/${year}/${documentNumber}.pdf`;
  return normalizeUrl(inferred, EGAZETTE_HOME_URL);
}

function buildEntryFromCells(cells, candidates, buttonId = null) {
  const normalizedCells = cells.map((cell) => normalizeText(cell)).filter(Boolean);
  const rawText = normalizeText(normalizedCells.join(" "));
  const gazetteIdMatches = rawText.match(/[A-Z]{2}-[A-Z]{2}-[EW]-\d{8}-\d+/gi) || [];
  if (gazetteIdMatches.length !== 1) return null;
  const gazetteId = gazetteIdMatches[0];

  const publishDate = normalizedCells.find((cell) => /\b\d{2}-[A-Za-z]{3}-\d{4}\b/.test(cell)) || null;
  const fileSize = normalizedCells.find((cell) => /\b\d+(?:\.\d+)?\s*MB\b/i.test(cell)) || null;
  const contentCells = normalizedCells.filter((cell) => cell !== gazetteId && cell !== publishDate && cell !== fileSize);

  let ministry = null;
  let title = rawText;
  if (contentCells.length >= 2) {
    ministry = contentCells[0];
    title = contentCells.slice(1).join(" ");
  } else if (contentCells.length === 1) {
    title = contentCells[0];
  }

  const pdfUrl =
    candidates.find((candidate) => candidate.toLowerCase().includes(".pdf")) ||
    inferDownloadUrlFromGazetteId(gazetteId, publishDate) ||
    null;
  const detailUrl = candidates.find((candidate) => !candidate.toLowerCase().includes(".pdf")) || null;

  const entry = {
    gazette_id: gazetteId,
    section: classifySection(gazetteId),
    ministry,
    title,
    publish_date: publishDate,
    file_size: fileSize,
    detail_url: detailUrl,
    download_url: pdfUrl,
    source_url: EGAZETTE_HOME_URL,
    source: "eGazette",
    raw_text: rawText,
    button_id: buttonId,
  };
  entry.id = buildItemId(entry);
  return entry;
}

function extractEntriesFromHtml(html, baseUrl = EGAZETTE_HOME_URL) {
  const $ = cheerio.load(html);
  const entries = new Map();

  $("tr").each((_, row) => {
    const $row = $(row);
    const cells = $row.find("td").map((__, cell) => $(cell).text()).get();
    if (!cells.length) return;
    const candidates = extractDownloadCandidates($row, baseUrl);
    const buttonId = $row.find("input[type='image'][id]").first().attr("id") || null;
    const entry = buildEntryFromCells(cells, candidates, buttonId);
    if (entry) entries.set(entry.id, entry);
  });

  if (!entries.size) {
    $("li, div").each((_, node) => {
      const $node = $(node);
      const rawText = normalizeText($node.text());
      if (!/[A-Z]{2}-[A-Z]{2}-[EW]-\d{8}-\d+/i.test(rawText)) return;
      const candidates = extractDownloadCandidates($node, baseUrl);
      const buttonId = $node.find("input[type='image'][id]").first().attr("id") || null;
      const entry = buildEntryFromCells([rawText], candidates, buttonId);
      if (entry) entries.set(entry.id, entry);
    });
  }

  return [...entries.values()].sort((left, right) => left.gazette_id.localeCompare(right.gazette_id)).reverse();
}

async function fetchHtmlWithBrowser(url) {
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
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    return await page.content();
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function enrichEntriesWithPopupTargets(entries, startUrl) {
  if (!entries.some((entry) => entry.button_id && !entry.detail_url)) {
    return entries;
  }

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
    await page.goto(startUrl, { waitUntil: "networkidle2", timeout: 60000 });

    for (const entry of entries) {
      if (!entry.button_id || entry.detail_url) continue;

      const selector = `#${entry.button_id}`;
      const handle = await page.$(selector);
      if (!handle) continue;

      const beforePages = await browser.pages();
      await handle.click();
      await sleep(2500);
      const afterPages = await browser.pages();
      const popup =
        afterPages.find((candidate) => !beforePages.includes(candidate) && candidate.url().includes("ViewPDF.aspx")) ||
        afterPages.find((candidate) => candidate.url().includes("ViewPDF.aspx"));

      if (!popup) {
        continue;
      }

      entry.detail_url = popup.url();
      const iframeSrc = await popup.$eval("#framePDFDisplay", (el) => el.getAttribute("src")).catch(() => null);
      if (iframeSrc) {
        entry.download_url = normalizeUrl(iframeSrc, popup.url());
      }
      await popup.close().catch(() => {});
      await page.bringToFront().catch(() => {});
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return entries;
}

async function fetchEgazetteLandingPage(url = EGAZETTE_HOME_URL, depth = 0) {
  if (depth > 4) {
    throw new Error("eGazette redirect chain exceeded safe limit");
  }

  const response = await fetchHtml(url);
  if (!response) {
    throw new Error("eGazette request returned no response");
  }

  if (response.status === 302 && response.headers?.location) {
    const nextUrl = normalizeUrl(response.headers.location, url);
    if (!nextUrl) {
      throw new Error("eGazette redirect location could not be resolved");
    }
    return fetchEgazetteLandingPage(nextUrl, depth + 1);
  }

  if (response.status !== 200) {
    throw new Error(`eGazette homepage request failed: ${response.status || "unknown"}`);
  }

  return {
    html: response.data,
    finalUrl: url,
  };
}

export async function scrapeEgazetteHomePage() {
  const landing = await fetchEgazetteLandingPage();
  let html = landing.html;
  let baseUrl = landing.finalUrl || EGAZETTE_HOME_URL;
  let entries = extractEntriesFromHtml(html, baseUrl);

  if (shouldUsePuppeteer() && entries.length < 3) {
    console.log("[eGazette] Low homepage entry count, trying Puppeteer");
    const browserHtml = await fetchHtmlWithBrowser(EGAZETTE_HOME_URL).catch(() => null);
    if (browserHtml) {
      html = browserHtml;
      baseUrl = EGAZETTE_HOME_URL;
      entries = extractEntriesFromHtml(html, baseUrl);
    }
  }

  if (shouldUsePuppeteer()) {
    entries = await enrichEntriesWithPopupTargets(entries, baseUrl).catch((error) => {
      console.error("[eGazette] Popup enrichment failed:", error.message);
      return entries;
    });
  }

  return {
    source_url: baseUrl,
    entry_count: entries.length,
    entries,
  };
}

export async function runEgazetteScraper() {
  const result = await scrapeEgazetteHomePage();
  const summary = {
    source_url: result.source_url,
    entry_count: result.entry_count,
    sections: {
      recent_extraordinary: result.entries.filter((entry) => entry.section === "recent-extraordinary").length,
      recent_weekly: result.entries.filter((entry) => entry.section === "recent-weekly").length,
      recent_other: result.entries.filter((entry) => entry.section === "recent-gazettes").length,
    },
    entries: result.entries.map((entry) => ({
      id: entry.id,
      gazette_id: entry.gazette_id,
      section: entry.section,
      ministry: entry.ministry,
      title: entry.title,
      publish_date: entry.publish_date,
      file_size: entry.file_size,
      download_url: entry.download_url,
      detail_url: entry.detail_url,
    })),
  };

  await saveJSON(`${EGAZETTE_STORAGE_ROOT}/index.json`, summary);
  console.log(`[eGazette] Indexed ${summary.entry_count} homepage gazettes`);
}

export async function runEGazetteScraper() {
  return runEgazetteScraper();
}

export async function scrapeEGazette() {
  return runEgazetteScraper();
}
