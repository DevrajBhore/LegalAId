import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";

import { exists, kbRoot, saveJSON } from "../../storage/fileStorage.js";

const BASE_URL = "https://www.indiacode.nic.in";
const SECTIONS_ROOT = path.join(kbRoot, "sections");

if (!fs.existsSync(SECTIONS_ROOT)) {
  fs.mkdirSync(SECTIONS_ROOT, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanHtml(html) {
  if (!html) return "";

  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, " ").trim();
}

export async function fetchAllSections(actBrowseUrl, actSlug) {
  if (!actSlug) {
    console.log("[Scraper] actSlug missing");
    return [];
  }

  let response;
  try {
    response = await axios.get(actBrowseUrl, { timeout: 20000 });
  } catch {
    console.log("[Scraper] Failed loading act page:", actBrowseUrl);
    return [];
  }

  const $ = cheerio.load(response.data);
  const html = $.html();

  const abv = html.match(/abv=([^&"]+)/)?.[1];
  const statehandle = html.match(/statehandle=([^&"]+)/)?.[1];
  const actid = html.match(/actid=([^&"]+)/)?.[1];
  const orgactid = html.match(/orgactid=([^&"]+)/)?.[1];

  if (!actid || !statehandle) {
    console.log("[Scraper] Not a valid act page:", actBrowseUrl);
    return [];
  }

  const sectionsMeta = [];

  $("a[href*='show-data']").each((_, element) => {
    const href = $(element).attr("href");
    const sectionMatch = href?.match(/sectionno=([^&]+)/);
    const orderMatch = href?.match(/orderno=([^&]+)/);

    if (sectionMatch && orderMatch) {
      sectionsMeta.push({
        sectionno: sectionMatch[1],
        orderno: orderMatch[1],
      });
    }
  });

  if (!sectionsMeta.length) {
    console.log("[Scraper] No sections found.");
    return [];
  }

  console.log(`[Scraper] Sections detected: ${sectionsMeta.length}`);

  const results = [];

  for (const meta of sectionsMeta) {
    const { sectionno, orderno } = meta;
    const relativePath = `sections/${actSlug}/${sectionno}.json`;
    const fullPath = path.join(SECTIONS_ROOT, actSlug, `${sectionno}.json`);

    if (exists(relativePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
        if (existing.content && existing.content.length > 50) {
          console.log(`[Scraper] Skipping valid section ${sectionno}`);
          continue;
        }
        console.log(`[Scraper] Refetching incomplete section ${sectionno}`);
      } catch {
        console.log(`[Scraper] Refetching unreadable section ${sectionno}`);
      }
    }

    const showDataUrl =
      `${BASE_URL}/show-data?` +
      `abv=${abv}&` +
      `statehandle=${statehandle}&` +
      `actid=${actid}&` +
      `sectionno=${sectionno}&` +
      `orderno=${orderno}&` +
      `orgactid=${orgactid}`;

    try {
      const showRes = await axios.get(showDataUrl);
      const showHtml = showRes.data;

      const actIdMatch = showHtml.match(/act_id='([^']+)'/);
      const secIdMatch = showHtml.match(/secId\s*='([^']+)'/);

      if (!actIdMatch || !secIdMatch) {
        console.log(`[Scraper] Could not extract IDs for section ${sectionno}`);
        continue;
      }

      const realActId = actIdMatch[1];
      const sectionID = secIdMatch[1];

      const contentRes = await axios.get(`${BASE_URL}/SectionPageContent`, {
        params: {
          actid: realActId,
          sectionID,
        },
      });

      const data = contentRes.data;
      const cleanedContent = cleanHtml(data.content);
      const cleanedFootnote = cleanHtml(data.footnote);

      if (!cleanedContent || cleanedContent.length < 20) {
        console.log(`[Scraper] Empty content for section ${sectionno}`);
        continue;
      }

      const payload = {
        act_id: actSlug,
        section_number: sectionno,
        section_id: sectionID,
        title: `Section ${sectionno}`,
        content: cleanedContent,
        footnote: cleanedFootnote,
        metadata: {
          source: "IndiaCode",
          act_url: actBrowseUrl,
          fetched_at: new Date().toISOString(),
        },
      };

      await saveJSON(relativePath, payload);

      console.log(`[Scraper] Section ${sectionno} saved`);
      results.push(payload);

      await sleep(200);
    } catch {
      console.log(`[Scraper] Failed section ${sectionno}`);
    }
  }

  return results;
}
