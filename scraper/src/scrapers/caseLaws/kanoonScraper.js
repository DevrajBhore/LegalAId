import * as cheerio from "cheerio";

import { fetchHtml } from "../../common/request.js";
import { saveJSON } from "../../storage/fileStorage.js";
import {
  absoluteUrl,
  buildStableId,
  normalizeText,
  parsePositiveInteger,
  uniqueBy,
} from "../shared/scraperUtils.js";

const BASE_URL = "https://indiankanoon.org";
const DEFAULT_QUERY = "doctypes:supremecourt fromdate:01-05-2026";

function buildSearchUrl(query, pageNumber) {
  const params = new URLSearchParams({
    formInput: query,
    pagenum: String(pageNumber),
  });
  return `${BASE_URL}/search/?${params.toString()}`;
}

function extractDateFromTitle(title = "") {
  const match = title.match(/\bon\s+(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/i);
  return match?.[1] || "";
}

function parseSearchPage(html, searchUrl, query) {
  const $ = cheerio.load(html);
  const resultText = normalizeText($(".results-count").text());

  const results = $("article.result")
    .toArray()
    .map((node) => {
      const article = $(node);
      const titleLink = article.find(".result_title a").first();
      const fullDocLink = article.find("a.cite_tag[href^='/doc/']").first();
      const title = normalizeText(titleLink.text());
      const documentUrl = absoluteUrl(
        fullDocLink.attr("href") || titleLink.attr("href"),
        BASE_URL
      );
      const documentId = documentUrl?.match(/\/doc\/([^/]+)\//)?.[1] || "";
      const snippet = normalizeText(article.find(".headline").text() || article.text());

      return {
        id: buildStableId("indiankanoon", title, documentId || documentUrl || title),
        title,
        source_type: "case-law",
        source_label: "Indian Kanoon",
        court: normalizeText(article.find(".docsource").text()) || "Unknown",
        query,
        document_id: documentId,
        document_date: extractDateFromTitle(title),
        document_url: documentUrl,
        search_url: searchUrl,
        snippet,
      };
    })
    .filter((item) => item.title && item.document_url);

  const totalResults = Number.parseInt(
    resultText.match(/of\s+([\d,]+)/i)?.[1]?.replace(/,/g, "") || "",
    10
  );

  return {
    results,
    totalResults: Number.isFinite(totalResults) ? totalResults : null,
    resultText,
  };
}

async function fetchDocumentText(item) {
  const response = await fetchHtml(item.document_url, {
    maxRedirects: 5,
    retries: 2,
  });

  if (response.status < 200 || response.status >= 300) {
    return {
      text: "",
      extraction: {
        status: "source_error",
        source_status: response.status,
      },
    };
  }

  const $ = cheerio.load(response.data || "");
  $("script, style, noscript, svg").remove();

  const title = normalizeText($(".doc_title").first().text()) || item.title;
  const court = normalizeText($(".docsource_main").first().text()) || item.court;
  const text = normalizeText($(".judgments").first().text());

  return {
    title,
    court,
    text,
    extraction: {
      status: text ? "parsed" : "empty_text",
      source_status: response.status,
    },
  };
}

export async function runIndianKanoonScraper() {
  const query = process.env.SCRAPER_INDIANKANOON_QUERY || DEFAULT_QUERY;
  const maxPages = parsePositiveInteger(process.env.SCRAPER_INDIANKANOON_MAX_PAGES, 7);
  const fetchText =
    String(process.env.SCRAPER_INDIANKANOON_FETCH_TEXT || "true").toLowerCase() !==
    "false";
  const fetchedAt = new Date().toISOString();
  const allResults = [];
  const pageSummaries = [];

  for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
    const searchUrl = buildSearchUrl(query, pageNumber);
    const response = await fetchHtml(searchUrl, {
      maxRedirects: 5,
      retries: 2,
    });

    if (response.status < 200 || response.status >= 300) {
      pageSummaries.push({
        page: pageNumber,
        search_url: searchUrl,
        status: response.status,
        parsed: 0,
      });
      break;
    }

    const parsed = parseSearchPage(response.data || "", searchUrl, query);
    allResults.push(...parsed.results);
    pageSummaries.push({
      page: pageNumber,
      search_url: searchUrl,
      status: response.status,
      parsed: parsed.results.length,
      total_results: parsed.totalResults,
      result_text: parsed.resultText,
    });

    if (parsed.results.length === 0) {
      break;
    }
  }

  const uniqueResults = uniqueBy(allResults, (item) => item.document_id || item.document_url);
  let parsedTextCount = 0;

  for (const result of uniqueResults) {
    let item = {
      ...result,
      text: "",
      extraction: {
        status: fetchText ? "queued" : "metadata_only",
      },
    };

    if (fetchText) {
      const document = await fetchDocumentText(item);
      item = {
        ...item,
        ...document,
        source_refs: [
          {
            label: "Indian Kanoon search result",
            url: item.search_url,
          },
          {
            label: "Indian Kanoon document",
            url: item.document_url,
          },
        ],
      };

      if (item.text) {
        parsedTextCount += 1;
      }
    }

    await saveJSON(`case-law/indiankanoon/items/${item.id}.json`, item);
  }

  await saveJSON("case-law/indiankanoon/index.json", {
    source_label: "Indian Kanoon",
    source_url: BASE_URL,
    query,
    max_pages: maxPages,
    source_rows: allResults.length,
    unique_items: uniqueResults.length,
    items_with_text: parsedTextCount,
    pages: pageSummaries,
    fetched_at: fetchedAt,
  });
}

export const scrapeIndianKanoon = runIndianKanoonScraper;
