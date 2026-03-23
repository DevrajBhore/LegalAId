import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";

const BASE_URL = "https://www.indiacode.nic.in";
const KB_DIR = path.resolve("knowledge-base/sections");

if (!fs.existsSync(KB_DIR)) {
  fs.mkdirSync(KB_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanHtml(html) {
  if (!html) return "";

  const $ = cheerio.load(html);
  return $.text().replace(/\s+/g, " ").trim();
}

export async function fetchAllSections(actBrowseUrl, actSlug) {

  if (!actSlug) {
    console.log("❌ actSlug missing");
    return [];
  }

  let response;
  try {
    response = await axios.get(actBrowseUrl, { timeout: 20000 });
  } catch {
    console.log("❌ Failed loading act page:", actBrowseUrl);
    return [];
  }

  const $ = cheerio.load(response.data);
  const html = $.html();

  const abv = html.match(/abv=([^&"]+)/)?.[1];
  const statehandle = html.match(/statehandle=([^&"]+)/)?.[1];
  const actid = html.match(/actid=([^&"]+)/)?.[1];
  const orgactid = html.match(/orgactid=([^&"]+)/)?.[1];

  if (!actid || !statehandle) {
    console.log("⏭ Not valid act page:", actBrowseUrl);
    return [];
  }

  const sectionsMeta = [];

  $("a[href*='show-data']").each((_, el) => {
    const href = $(el).attr("href");

    const sectionMatch = href.match(/sectionno=([^&]+)/);
    const orderMatch = href.match(/orderno=([^&]+)/);

    if (sectionMatch && orderMatch) {
      sectionsMeta.push({
        sectionno: sectionMatch[1],
        orderno: orderMatch[1],
      });
    }
  });

  if (!sectionsMeta.length) {
    console.log("⚠ No sections found.");
    return [];
  }

  console.log(`Sections detected: ${sectionsMeta.length}`);

  const actDir = path.join(KB_DIR, actSlug);
  if (!fs.existsSync(actDir)) {
    fs.mkdirSync(actDir, { recursive: true });
  }

  const results = [];

  for (const meta of sectionsMeta) {

    const { sectionno, orderno } = meta;
    const filePath = path.join(actDir, `${sectionno}.json`);

    // 🔁 RE-FETCH IF FILE EXISTS BUT EMPTY
    if (fs.existsSync(filePath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        if (existing.content && existing.content.length > 50) {
          console.log(`⏭ Skipping valid section ${sectionno}`);
          continue;
        } else {
          console.log(`♻ Refetching incomplete section ${sectionno}`);
        }
      } catch {}
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
        console.log(`⚠ Could not extract IDs for section ${sectionno}`);
        continue;
      }

      const realActId = actIdMatch[1];
      const sectionID = secIdMatch[1];

      const contentRes = await axios.get(
        `${BASE_URL}/SectionPageContent`,
        {
          params: {
            actid: realActId,
            sectionID: sectionID,
          },
        }
      );

      const data = contentRes.data;

      const cleanedContent = cleanHtml(data.content);
      const cleanedFootnote = cleanHtml(data.footnote);

      if (!cleanedContent || cleanedContent.length < 20) {
        console.log(`⚠ Empty content for section ${sectionno}`);
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

      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));

      console.log(`✅ Section ${sectionno} saved`);
      results.push(payload);

      await sleep(200);

    } catch (err) {
      console.log(`❌ Failed section ${sectionno}`);
    }
  }

  return results;
}