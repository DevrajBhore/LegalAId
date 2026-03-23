// scraper/src/scrapers/indiaCode/actsScraper.js
import * as cheerio from "cheerio";
import path from "path";
import { fetchHtml } from "../../common/request.js";
import { fetchAllSections } from "./sectionDetailScraper.js";
import { fetchPageText, makeActId, buildSections } from "./baseScraper.js";
import { saveJSON, saveText, exists } from "../../storage/fileStorage.js";
import { extractActMetadata } from "./actMetadata.js";

/**
 * Production-ready IndiaCode acts scraper (core):
 * - Fetches list of Acts (seed URL)
 * - For each act: fetch act page, extract text, split into sections
 * - Save act JSON into knowledge-base/acts/<act_id>.json
 * - Save sections into knowledge-base/sections/<act_id>/<section_number>.json
 *
 * NOTE: This is written for the common IndiaCode structure. The exact selectors below may require small adjustments
 * after you inspect the current IndiaCode HTML. I include safe fallbacks and logs.
 */

// Example IndiaCode index URL (you may replace with the correct list page)
const BASE_URL = "https://www.indiacode.nic.in";

const INDIA_CODE_INDEX =
  "https://www.indiacode.nic.in/handle/123456789/1362/browse?type=dateissued&rpp=100&sort_by=1&order=ASC&offset=0&locale=en&submit_browse=Update&ajax=true";

/**
 * parseActsIndex(html) -> returns [{ title, url, year? }]
 * Uses heuristics to find links to acts from the index page.
 */
function parseActsIndex(html) {
  const $ = cheerio.load(html);
  const acts = [];

  $("tr").each((i, row) => {
    const tds = $(row).find("td");
    if (tds.length < 4) return;

    // COLUMN 3 = TITLE
    let title = $(tds[2]).text().trim();
    if (!title || title.length < 3) return;

    // ACCEPT ONLY real Act titles:
    // 1️⃣ Must contain "Act"
    // 2️⃣ Must end with a 4-digit year
    if (!/Act.*\d{4}$/i.test(title)) return;

    // COLUMN 4 = VIEW LINK (has real handle)
    const linkEl = $(tds[3]).find("a[href*='/handle/']");
    if (linkEl.length === 0) return;

    let href = linkEl.attr("href");
    if (!href) return;

    // FIX HANDLES:
    // REMOVE trailing slash
    href = href.replace(/\/$/, "");

    // ACCEPT ONLY handles ending with numeric ID (Central Acts use pure numeric)
    const m = href.match(/\/handle\/123456789\/(\d+)/);
    if (!m) return;

    // Build absolute URL
    if (href.startsWith("/")) href = BASE_URL + href;

    acts.push({ title, url: href });
  });

  return acts;
}

// scraper/src/scrapers/indiaCode/actsScraper.js
// (replace only the runActsScraper function below with this version)

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Paginated IndiaCode acts scraper
 * @param {Object} opts
 *   - rpp: results per page (100 recommended)
 *   - concurrency: number of act pages to fetch in parallel (safe default 4)
 *   - maxPages: safety cap (null for no cap)
 *   - politeDelayMs: delay between page requests
 */

export async function runActsScraper({
  rpp = 100,
  concurrency = 4,
  maxPages = null,
  politeDelayMs = 800,
} = {}) {

  console.log("🕷 IndiaCode Acts Scraper (paginated) starting...");

  let offset = 0;
  let page = 0;

  while (true) {

    page += 1;

    if (maxPages && page > maxPages) {
      console.log(`⚠️ Reached maxPages (${maxPages}).`);
      break;
    }

    const pageUrl =
      `${BASE_URL}/handle/123456789/1362/browse?type=dateissued` +
      `&sort_by=1&order=ASC&rpp=${rpp}&offset=${offset}` +
      `&locale=en&submit_browse=Update&ajax=true`;

    console.log(`\n📄 Fetching page ${page} (offset=${offset})`);

    let res;
    try {
      res = await fetchHtml(pageUrl);
    } catch (err) {
      console.error("❌ Failed to fetch page:", err.message);
      break;
    }

    const pageHtml = res.data ?? "";
    const actsOnPage = parseActsIndex(pageHtml);

    console.log(`ℹ️ Found ${actsOnPage.length} potential acts.`);

    if (!actsOnPage.length) break;

    for (let i = 0; i < actsOnPage.length; i += concurrency) {

      const batch = actsOnPage.slice(i, i + concurrency);

      await Promise.all(
        batch.map(async (link) => {

          try {

            const title = link.title.trim();

            const handleMatch =
              link.url.match(/\/handle\/\d+\/([0-9A-Za-z\-_]+)/);

            const handleId = handleMatch ? handleMatch[1] : null;

            const actId = handleId
              ? `${makeActId(title, "")}_${handleId}`
              : makeActId(title, "");

            const actJsonPath = `acts/${actId}.json`;
            const actExists = exists(actJsonPath);

            let meta = null;
            let pageData = null;

            // 🔹 Only fetch metadata if act JSON missing
            if (!actExists) {

              console.log(`➡ Fetching act metadata: ${title}`);

              pageData = await fetchPageText(link.url);

              if (!pageData.html ||
                  !pageData.html.includes("Actdetails")) {
                console.log(`⏭ Skipping NON-ACT page`);
                return;
              }

              meta = extractActMetadata(pageData.html);

            } else {
              console.log(`⏭ Act metadata exists: ${actId}`);
            }

            // 🔥 ALWAYS CHECK / REBUILD SECTIONS
            console.log(`🔎 Processing sections for: ${actId}`);

            const sectionsArr =
              await fetchAllSections(link.url, actId);

            // 🔹 If metadata didn't exist earlier, create act JSON now
            if (!actExists) {

              const actObj = {
                act_id: actId,
                title,
                source_url: link.url,
                fetched_at: new Date().toISOString(),
                sections_count: sectionsArr.length,
                metadata: {
                  ...meta,
                  source: "IndiaCode",
                  url: link.url,
                  handle_id: handleId ?? null,
                },
              };

              await saveJSON(actJsonPath, actObj);

            } else {
              // 🔹 Update sections_count safely
              try {
                const existingAct =
                  require("fs").readFileSync(
                    path.resolve("knowledge-base", actJsonPath),
                    "utf-8"
                  );

                const actData = JSON.parse(existingAct);
                actData.sections_count = sectionsArr.length;

                await saveJSON(actJsonPath, actData);

              } catch {}
            }

            console.log(
              `✅ Sections processed for ${actId}: ${sectionsArr.length}`
            );

          } catch (err) {
            console.error("❌ Error processing act:", err.message);
          }

        })
      );

      await sleep(200);
    }

    offset += rpp;
    await sleep(politeDelayMs);
  }

  console.log("🕷 IndiaCode Acts Scraper finished.");
}
