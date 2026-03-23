import * as cheerio from "cheerio";
import { fetchHtml } from "../../common/request.js";
import { fetchPageText, makeActId, buildSections } from "./baseScraper.js";
import { saveJSON, exists } from "../../storage/fileStorage.js";
import { extractActMetadata } from "./actMetadata.js";

const BASE_URL = "https://www.indiacode.nic.in";

/**
 * Entry point
 */
export async function scrapeStateActs() {
  console.log("🏛 Starting State Acts scraping");

  const states = await discoverStateListingPages();

  for (const state of states) {
    console.log(`🏷 State: ${state.label}`);
    await scrapeStateListing(state);
  }

  console.log("🏛 State Acts scraping completed");
}

/**
 * Discover state listing pages
 */
async function discoverStateListingPages() {
  const res = await fetchHtml(`${BASE_URL}/browse-state-acts`);
  const $ = cheerio.load(res.data);

  return $("a[href*='state']")
    .map((_, el) => ({
      label: $(el).text().trim(),
      listingUrl: BASE_URL + $(el).attr("href"),
    }))
    .get();
}

/**
 * Scrape paginated listing for a state
 */
async function scrapeStateListing(state) {
  let nextPageUrl = state.listingUrl;

  while (nextPageUrl) {
    console.log(`📄 Fetching ${nextPageUrl}`);
    const res = await fetchHtml(nextPageUrl);
    const $ = cheerio.load(res.data);

    const actLinks = $("a[href*='/handle/']")
      .map((_, el) => BASE_URL + $(el).attr("href"))
      .get();

    for (const actUrl of [...new Set(actLinks)]) {
      await scrapeSingleStateAct(actUrl, state.label);
    }

    const next = $("a:contains('Next')").attr("href");
    nextPageUrl = next ? BASE_URL + next : null;
  }
}

/**
 * Scrape a single State Act using SAME pipeline as Central Acts
 */
async function scrapeSingleStateAct(actUrl, stateName) {
  try {
    const page = await fetchPageText(actUrl);

    // Guard: must be real Act
    if (!page.html || !page.html.includes("Actdetails")) {
      console.log(`⏭ Skipping non-Act page: ${actUrl}`);
      return;
    }

    const meta = extractActMetadata(page.html);
    const title = meta.title || "Untitled State Act";

    // include handle id to avoid collisions
    let handleId = null;
    try {
      const m = actUrl.match(/\/handle\/\d+\/([0-9A-Za-z\-_.]+)/);
      if (m) handleId = m[1];
    } catch {}

    const actId = handleId
      ? `${makeActId(title, "")}_${handleId}`
      : makeActId(title, "");

    const actPath = `acts/${actId}.json`;

    if (exists(actPath)) {
      console.log(`⏭ Skipping already fetched act: ${actId}`);
      return;
    }

    console.log(`➡ Fetching State Act: ${title}`);

    const sectionsArr = buildSections(page.text);

    const actObj = {
      act_id: actId,
      title,
      jurisdiction: "state",
      state: stateName,
      source_url: actUrl,
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
    };

    await saveJSON(actPath, actObj);

    for (const s of sectionsArr) {
      const safeNum = (s.section_number || "1")
        .toString()
        .replace(/[^\w\-]/g, "_");

      await saveJSON(`sections/${actId}/${safeNum}.json`, {
        act_id: actId,
        section_number: s.section_number,
        title: s.title,
        text: s.text,
        metadata: {
          source: "IndiaCode",
          state: stateName,
          act_url: actUrl,
        },
      });
    }

    console.log(
      `✅ Saved State Act ${actId} with ${sectionsArr.length} sections`
    );
  } catch (err) {
    console.error(`❌ Failed State Act ${actUrl}`, err);
  }
}
