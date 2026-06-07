import * as cheerio from "cheerio";
import axios from "axios";
import https from "https";

import { fetchHtml } from "../../common/request.js";
import { saveJSON } from "../../storage/fileStorage.js";
import {
  absoluteUrl,
  buildStableId,
  normalizeText,
  parsePositiveInteger,
  uniqueBy,
} from "../shared/scraperUtils.js";

const BASE_URL = "https://rera.delhi.gov.in";
const LIST_URL = `${BASE_URL}/registered_promoters_list`;
const delhiHttpsAgent = new https.Agent({ rejectUnauthorized: false });

function buildPageUrl(pageNumber) {
  return pageNumber === 0 ? LIST_URL : `${LIST_URL}?page=${pageNumber}`;
}

async function fetchDelhiHtml(url) {
  try {
    return await fetchHtml(url, {
      maxRedirects: 5,
      retries: 2,
    });
  } catch (error) {
    if (!/certificate|tls|verify/i.test(error?.message || "")) {
      throw error;
    }

    return axios.get(url, {
      httpsAgent: delhiHttpsAgent,
      maxRedirects: 5,
      timeout: 30000,
      validateStatus: () => true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  }
}

function extractLastPage($) {
  const lastHref = $(".pager-last a").attr("href") || "";
  const parsed = Number.parseInt(lastHref.match(/[?&]page=(\d+)/)?.[1] || "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cellLines($, cell) {
  const html = cell.html() || "";
  const withBreaks = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n");
  const parsed = cheerio.load(`<body>${withBreaks}</body>`);
  return parsed("body")
    .text()
    .split(/\n+/)
    .map(normalizeText)
    .filter(Boolean);
}

function extractLineValue(lines, label) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^${escaped}\\s*:?\\s*(.*)$`, "i");

  for (const line of lines) {
    const match = line.match(pattern);
    if (match) {
      return normalizeText(match[1]);
    }
  }

  return "";
}

function parseProjectRows(html, pageUrl) {
  const $ = cheerio.load(html || "");
  const rows = $("table tbody tr, table.views-table tr")
    .toArray()
    .map((row) => {
      const node = $(row);
      if (node.find("td").length === 0) {
        return null;
      }

      const promoterCell = node.find("td.views-field-php-1").first();
      const projectCell = node.find("td.views-field-field-project-address").first();
      const registrationCell = node
        .find("td.views-field-field-rera-registrationno")
        .first();
      const promoterLines = cellLines($, promoterCell);
      const projectLines = cellLines($, projectCell);
      const registrationLines = cellLines($, registrationCell);
      const promoterText = normalizeText(promoterLines.join(" "));
      const projectText = normalizeText(projectLines.join(" "));
      const registrationText = normalizeText(registrationLines.join(" "));

      if (!registrationText && !projectText && !promoterText) {
        return null;
      }

      const registrationNo =
        extractLineValue(registrationLines, "Registration No.") ||
        registrationText.match(/\bDLRERA[A-Z0-9/-]+\b/i)?.[0] ||
        "";
      const projectName = extractLineValue(projectLines, "Name");
      const promoterName = extractLineValue(promoterLines, "Name");
      const detailPath = node.find("a[href*='promoter_directors']").attr("href");
      const detailUrl = absoluteUrl(detailPath, BASE_URL);
      const title = projectName || registrationNo || promoterName;

      if (!registrationNo && !projectName) {
        return null;
      }

      return {
        id: buildStableId("delhi_rera", title, registrationNo || projectText),
        authority: "Delhi RERA",
        source_type: "rera-project",
        source_label: "Real Estate Regulatory Authority for NCT of Delhi",
        registration_no: registrationNo,
        project_name: projectName,
        promoter_name: promoterName,
        valid_until: extractLineValue(registrationLines, "Valid Until"),
        construction_status: extractLineValue(registrationLines, "Construction Status"),
        project_location: extractLineValue(projectLines, "Location"),
        promoter_email: extractLineValue(promoterLines, "Email"),
        promoter_phone: extractLineValue(promoterLines, "Phone Number"),
        source_url: pageUrl,
        detail_url: detailUrl,
        text: normalizeText(`${projectText} ${promoterText} ${registrationText}`),
        extraction: {
          status: "parsed",
          source_mode: "registered_promoters_list",
        },
      };
    })
    .filter(Boolean);

  return rows;
}

export async function runDelhiReraScraper() {
  const fetchedAt = new Date().toISOString();
  const firstResponse = await fetchDelhiHtml(LIST_URL);
  const firstHtml = firstResponse.data || "";
  const $ = cheerio.load(firstHtml);
  const lastPage = extractLastPage($);
  const envMaxPages = parsePositiveInteger(process.env.SCRAPER_DELHI_RERA_MAX_PAGES, lastPage + 1);
  const pagesToFetch = Math.min(lastPage + 1, envMaxPages);
  const allItems = [];
  const pageSummaries = [];

  for (let pageNumber = 0; pageNumber < pagesToFetch; pageNumber += 1) {
    const pageUrl = buildPageUrl(pageNumber);
    const response =
      pageNumber === 0
        ? firstResponse
        : await fetchDelhiHtml(pageUrl);
    const items = parseProjectRows(response.data || "", pageUrl);
    allItems.push(...items);
    pageSummaries.push({
      page: pageNumber,
      source_url: pageUrl,
      status: response.status,
      parsed: items.length,
    });
  }

  const uniqueItems = uniqueBy(allItems, (item) => item.registration_no || item.id);

  for (const item of uniqueItems) {
    await saveJSON(`rera/delhi-rera/items/${item.id}.json`, item);
  }

  await saveJSON("rera/delhi-rera/index.json", {
    source_label: "Delhi RERA registered projects",
    source_url: LIST_URL,
    source_rows: allItems.length,
    unique_items: uniqueItems.length,
    total_pages_detected: lastPage + 1,
    pages_fetched: pagesToFetch,
    pages: pageSummaries,
    fetched_at: fetchedAt,
  });
}

export const scrapeDelhiRera = runDelhiReraScraper;
