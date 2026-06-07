import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";

import { fetchHtml } from "../../common/request.js";
import { kbRoot, saveJSON } from "../../storage/fileStorage.js";
import {
  absoluteUrl,
  buildStableId,
  normalizeText,
  parsePositiveInteger,
} from "../shared/scraperUtils.js";

const BASE_URL = "https://maharera.maharashtra.gov.in";
const LIST_URL = `${BASE_URL}/projects-search-result`;
const DEFAULT_MAX_PAGES = 10;
const INDEX_RELATIVE_PATH = "rera/maharera/index.json";
const ITEMS_DIR = path.join(kbRoot, "rera/maharera/items");

function buildPageUrl(pageNumber) {
  const params = new URLSearchParams({
    project_name: "",
    project_location: "",
    project_completion_date: "",
    project_state: "27",
    project_district: "0",
    carpetAreas: "",
    completionPercentages: "",
    project_division: "",
    page: String(pageNumber),
    op: "",
  });
  return `${LIST_URL}?${params.toString()}`;
}

function extractTotalResults($) {
  const total = Number.parseInt(
    normalizeText($("p:contains('Showing Final') .colorBlue").first().text()).replace(
      /,/g,
      ""
    ),
    10
  );
  return Number.isFinite(total) ? total : null;
}

function extractField($, card, label) {
  const field = card
    .find(".greyColor")
    .filter((_, node) => normalizeText($(node).text()) === label)
    .first();
  return normalizeText(field.next("p").text());
}

function parseProjectCards(html, pageUrl) {
  const $ = cheerio.load(html || "");
  const cards = $("div.row.shadow")
    .toArray()
    .map((node) => {
      const card = $(node);
      const detailLink = card.find("a[href*='/public/project/view/']").first();
      const originalLink = card
        .find("a[href*='/public/project/view/'][href*='isOriginal=true']")
        .first();
      const detailUrl = absoluteUrl(detailLink.attr("href"), BASE_URL);
      const originalApplicationUrl = absoluteUrl(originalLink.attr("href"), BASE_URL);
      const registrationNo =
        normalizeText(card.find(".col-xl-4 > p").first().text()).replace(/^#\s*/, "") ||
        detailUrl?.match(/\/view\/([^/?]+)/)?.[1] ||
        "";
      const projectName = normalizeText(card.find("h4.title4").first().text());
      const promoterName = normalizeText(card.find(".darkBlue.bold").first().text());
      const district = extractField($, card, "District");
      const state = extractField($, card, "State");
      const pincode = extractField($, card, "Pincode");
      const lastModified = extractField($, card, "Last Modified");
      const title = projectName || registrationNo || detailUrl;

      if (!detailUrl && !registrationNo && !projectName) {
        return null;
      }

      return {
        id: buildStableId("maharera", title, detailUrl || registrationNo),
        authority: "MahaRERA",
        source_type: "rera-project",
        source_label: "Maharashtra Real Estate Regulatory Authority",
        registration_no: registrationNo,
        project_name: projectName,
        promoter_name: promoterName,
        state,
        district,
        pincode,
        last_modified: lastModified,
        source_url: pageUrl,
        detail_url: detailUrl,
        original_application_url: originalApplicationUrl,
        text: normalizeText(card.text()),
        extraction: {
          status: "parsed",
          source_mode: "projects_search_result",
        },
      };
    })
    .filter(Boolean);

  return cards;
}

function resolveMaxPages(totalResults) {
  const requested = String(process.env.SCRAPER_MAHARERA_MAX_PAGES || "").trim();
  if (requested.toLowerCase() === "all") {
    return totalResults ? Math.ceil(totalResults / 10) : DEFAULT_MAX_PAGES;
  }

  return parsePositiveInteger(requested, DEFAULT_MAX_PAGES);
}

function resolveStartPage() {
  return parsePositiveInteger(process.env.SCRAPER_MAHARERA_START_PAGE, 1);
}

function readPreviousIndex() {
  const indexPath = path.join(kbRoot, INDEX_RELATIVE_PATH);
  if (!fs.existsSync(indexPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  } catch {
    return null;
  }
}

function countExistingItems() {
  if (!fs.existsSync(ITEMS_DIR)) {
    return 0;
  }

  return fs
    .readdirSync(ITEMS_DIR)
    .filter((fileName) => fileName.endsWith(".json")).length;
}

export async function runMahaReraScraper() {
  const fetchedAt = new Date().toISOString();
  const firstUrl = buildPageUrl(1);
  const firstResponse = await fetchHtml(firstUrl, {
    maxRedirects: 5,
    retries: 2,
  });
  const firstHtml = firstResponse.data || "";
  const $ = cheerio.load(firstHtml);
  const totalResults = extractTotalResults($);
  const detectedPages = totalResults ? Math.ceil(totalResults / 10) : null;
  const maxPages = Math.min(resolveMaxPages(totalResults), detectedPages || Infinity);
  const startPage = Math.min(resolveStartPage(), maxPages);
  const previousIndex = readPreviousIndex();
  const priorPages =
    startPage > 1 && Array.isArray(previousIndex?.pages)
      ? previousIndex.pages.filter((page) => Number(page?.page) < startPage)
      : [];
  const seenKeys = new Set();
  const existingItems = startPage > 1 ? countExistingItems() : 0;
  let sourceRows = startPage > 1 ? existingItems : 0;
  let uniqueItems = existingItems;
  const pageSummaries = [...priorPages];
  const writeIndex = async (crawlStatus) =>
    saveJSON(INDEX_RELATIVE_PATH, {
      source_label: "MahaRERA registered projects",
      source_url: LIST_URL,
      source_status: firstResponse.status,
      source_rows: sourceRows,
      unique_items: uniqueItems,
      total_results_detected: totalResults,
      total_pages_detected: detectedPages,
      start_page: startPage,
      end_page: maxPages,
      pages_fetched: pageSummaries.length,
      crawl_status: crawlStatus,
      capped:
        detectedPages !== null && pageSummaries.length < detectedPages
          ? "Set SCRAPER_MAHARERA_MAX_PAGES=all to fetch every detected page."
          : null,
      pages: pageSummaries,
      fetched_at: fetchedAt,
    });

  for (let pageNumber = startPage; pageNumber <= maxPages; pageNumber += 1) {
    const pageUrl = buildPageUrl(pageNumber);
    const response =
      pageNumber === 1
        ? firstResponse
        : await fetchHtml(pageUrl, {
            maxRedirects: 5,
            retries: 2,
          });
    const items = parseProjectCards(response.data || "", pageUrl);
    sourceRows += items.length;

    for (const item of items) {
      const key = item.registration_no || item.detail_url || item.id;
      if (!key || seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      uniqueItems += 1;
      await saveJSON(`rera/maharera/items/${item.id}.json`, item);
    }

    pageSummaries.push({
      page: pageNumber,
      source_url: pageUrl,
      status: response.status,
      parsed: items.length,
      unique_saved_so_far: uniqueItems,
    });

    if (items.length === 0) {
      break;
    }

    if (pageNumber % 25 === 0) {
      await writeIndex("running");
    }
  }

  await writeIndex("completed");
}

export const scrapeMahaRera = runMahaReraScraper;
