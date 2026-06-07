import * as cheerio from "cheerio";
import { fetchHtml } from "../../common/request.js";
import { fetchPageText, makeActId, buildSections } from "./baseScraper.js";
import { saveJSON, exists } from "../../storage/fileStorage.js";
import { extractActMetadata } from "./actMetadata.js";

const BASE_URL = "https://www.indiacode.nic.in";
const DEFAULT_RPP = 100;
const DEFAULT_DELAY_MS = 300;
const MAX_STATE_ACT_ID_BASE_LENGTH = 120;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeUrl(href, baseUrl = BASE_URL) {
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeLabel(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

function selectedStateLabels() {
  return new Set(
    String(process.env.SCRAPER_STATE_LABELS || "")
      .split(",")
      .map((label) => normalizeLabel(label).toLowerCase())
      .filter(Boolean)
  );
}

function buildStateBrowseUrl(stateUrl, { rpp, offset }) {
  const url = new URL("browse", stateUrl.endsWith("/") ? stateUrl : `${stateUrl}/`);
  url.searchParams.set("type", "shorttitle");
  url.searchParams.set("sort_by", "2");
  url.searchParams.set("order", "ASC");
  url.searchParams.set("rpp", String(rpp));
  url.searchParams.set("offset", String(offset));
  return url.toString();
}

function parseHandleId(url = "") {
  return String(url).match(/\/handle\/\d+\/([^/?#]+)/)?.[1] || null;
}

function buildStateActId(title, handleId) {
  const base = makeActId(title, "").slice(0, MAX_STATE_ACT_ID_BASE_LENGTH).replace(/_+$/g, "");
  return handleId ? `${base}__${handleId}` : base;
}

async function discoverStateListingPages() {
  const response = await fetchHtml(`${BASE_URL}/`, { maxRedirects: 5 });
  const $ = cheerio.load(response.data || "");
  const states = [];
  const seen = new Set();

  $("a[href*='/handle/123456789/']").each((_, element) => {
    const label = normalizeLabel($(element).text());
    const stateUrl = normalizeUrl($(element).attr("href"));
    const handleId = parseHandleId(stateUrl);

    if (!label || !stateUrl || !handleId || seen.has(handleId)) return;
    if (/^(short title|act number|act year|enactment date|ministry|department)$/i.test(label)) return;
    if (/^(repealed acts|spent acts|home|about us|upload|my dspace)$/i.test(label)) return;

    seen.add(handleId);
    states.push({ label, listingUrl: stateUrl, handleId });
  });

  return states;
}

function extractActLinks(html, stateUrl) {
  const $ = cheerio.load(html || "");
  const links = [];

  $("tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length < 4) return;

    const title = normalizeLabel($(tds[2]).text());
    const href = $(tds[3]).find("a[href*='/handle/']").attr("href");
    const url = normalizeUrl(href, stateUrl);
    if (!title || !url) return;

    links.push({ title, url });
  });

  return [...new Map(links.map((link) => [link.url, link])).values()];
}

export async function scrapeStateActs() {
  const rpp = parseOptionalInteger(process.env.SCRAPER_STATE_RPP) ?? DEFAULT_RPP;
  const maxStates = parseOptionalInteger(process.env.SCRAPER_STATE_MAX_STATES);
  const maxPages = parseOptionalInteger(process.env.SCRAPER_STATE_MAX_PAGES);
  const delayMs = parseOptionalInteger(process.env.SCRAPER_STATE_DELAY_MS) ?? DEFAULT_DELAY_MS;
  const selectedLabels = selectedStateLabels();

  console.log("[Scraper] Starting State Acts scraping");

  let states = await discoverStateListingPages();
  if (selectedLabels.size) {
    states = states.filter((state) => selectedLabels.has(state.label.toLowerCase()));
  }
  if (maxStates !== undefined) {
    states = states.slice(0, maxStates);
  }

  console.log(`[Scraper] State listings discovered: ${states.length}`);

  for (const state of states) {
    console.log(`[Scraper] State: ${state.label}`);
    await scrapeStateListing(state, { rpp, maxPages, delayMs });
  }

  console.log("[Scraper] State Acts scraping completed");
}

async function scrapeStateListing(state, { rpp, maxPages, delayMs }) {
  let offset = 0;
  let page = 0;

  while (true) {
    page += 1;
    if (maxPages && page > maxPages) break;

    const pageUrl = buildStateBrowseUrl(state.listingUrl, { rpp, offset });
    console.log(`[Scraper] Fetching state page ${page}: ${state.label} offset=${offset}`);

    let response;
    try {
      response = await fetchHtml(pageUrl, { maxRedirects: 5 });
    } catch (error) {
      console.log(`[Scraper] Failed state listing ${state.label}: ${error.message}`);
      break;
    }

    const actLinks = extractActLinks(response.data, state.listingUrl);
    console.log(`[Scraper] Found ${actLinks.length} state acts on page ${page}`);
    if (!actLinks.length) break;

    for (const actLink of actLinks) {
      await scrapeSingleStateAct(actLink, state.label);
      if (delayMs > 0) await sleep(delayMs);
    }

    if (actLinks.length < rpp) break;
    offset += rpp;
  }
}

async function scrapeSingleStateAct(actLink, stateName) {
  try {
    const page = await fetchPageText(actLink.url);

    if (!page.html || !page.html.includes("Actdetails")) {
      console.log(`[Scraper] Skipping non-Act page: ${actLink.url}`);
      return;
    }

    const meta = extractActMetadata(page.html);
    const title = normalizeLabel(meta.title || actLink.title || "Untitled State Act");
    const handleId = parseHandleId(actLink.url);
    const actId = buildStateActId(title, handleId);
    const actPath = `acts/${actId}.json`;

    if (exists(actPath)) {
      console.log(`[Scraper] Skipping already fetched act: ${actId}`);
      return;
    }

    console.log(`[Scraper] Fetching State Act: ${title}`);
    const sectionsArr = buildSections(page.text);

    await saveJSON(actPath, {
      act_id: actId,
      title,
      jurisdiction: "state",
      state: stateName,
      source_url: actLink.url,
      fetched_at: new Date().toISOString(),
      full_text: page.text,
      headings: page.headings,
      sections_count: sectionsArr.length,
      metadata: {
        ...meta,
        source: "IndiaCode",
        state: stateName,
        handle_id: handleId ?? null,
      },
    });

    for (const section of sectionsArr) {
      const safeNum = String(section.section_number || "1").replace(/[^\w-]/g, "_");
      await saveJSON(`sections/${actId}/${safeNum}.json`, {
        act_id: actId,
        section_number: section.section_number,
        title: section.title,
        text: section.text,
        metadata: {
          source: "IndiaCode",
          state: stateName,
          act_url: actLink.url,
        },
      });
    }

    console.log(`[Scraper] Saved State Act ${actId} with ${sectionsArr.length} sections`);
  } catch (error) {
    console.error(`[Scraper] Failed State Act ${actLink.url}`, error?.message || error);
  }
}
