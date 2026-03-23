import * as cheerio from "cheerio";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

import { fetchHtml } from "../../common/request.js";
import { fetchPageText, makeActId } from "./baseScraper.js";
import { saveJSON, exists } from "../../storage/fileStorage.js";

const BASE_URL = "https://www.indiacode.nic.in";

// 🔒 Resolve project root exactly like fileStorage.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../../..");

// Knowledge base root
const KB_ROOT = path.join(projectRoot, "knowledge-base");
const ACTS_DIR = path.join(KB_ROOT, "acts");

/**
 * Entry point
 */
export async function runSubordinateScraper() {
  console.log("📜 Starting Subordinate Legislation Scraper");

  // Safety check
  try {
    await fs.access(ACTS_DIR);
  } catch {
    throw new Error(`Acts directory not found: ${ACTS_DIR}`);
  }

  const actFiles = await fs.readdir(ACTS_DIR);

  for (const file of actFiles) {
    if (!file.endsWith(".json")) continue;

    const actPath = path.join(ACTS_DIR, file);
    const raw = await fs.readFile(actPath, "utf-8");
    const act = JSON.parse(raw);

    await scrapeSubordinateForAct(act);
  }

  console.log("📜 Subordinate Legislation scraping completed");
}

/**
 * Scrape subordinate legislation for a single Act
 */
async function scrapeSubordinateForAct(act) {
  const actId = act.act_id;
  const actUrl = act.source_url;

  const indexPath = `subordinate/${actId}/index.json`;

  // Idempotency
  if (exists(indexPath)) return;

  console.log(`➡ Checking subordinate legislation for: ${act.title}`);

  const res = await fetchHtml(actUrl);
  const $ = cheerio.load(res.data);

  const links = [];

  $("a[href*='/handle/']").each((_, el) => {
    const text = $(el).text().toLowerCase();

    if (
      text.includes("rule") ||
      text.includes("regulation") ||
      text.includes("order") ||
      text.includes("scheme") ||
      text.includes("notification")
    ) {
      links.push({
        title: $(el).text().trim(),
        url: BASE_URL + $(el).attr("href"),
      });
    }
  });

  if (!links.length) {
    await saveJSON(indexPath, {
      act_id: actId,
      has_subordinate_legislation: false,
      count: 0,
    });
    return;
  }

  let count = 0;

  for (const link of links) {
    try {
      const page = await fetchPageText(link.url);
      const subId = makeActId(link.title, "");

      await saveJSON(`subordinate/${actId}/${subId}.json`, {
        sub_id: subId,
        parent_act_id: actId,
        title: link.title,
        type: detectType(link.title),
        source: "IndiaCode",
        source_url: link.url,
        text: page.text,
        fetched_at: new Date().toISOString(),
      });

      count++;
    } catch (err) {
      console.error(`❌ Failed subordinate: ${link.title}`, err);
    }
  }

  await saveJSON(indexPath, {
    act_id: actId,
    has_subordinate_legislation: true,
    count,
  });
}

/**
 * Infer subordinate type
 */
function detectType(title = "") {
  const t = title.toLowerCase();
  if (t.includes("rule")) return "rules";
  if (t.includes("regulation")) return "regulations";
  if (t.includes("order")) return "order";
  if (t.includes("scheme")) return "scheme";
  if (t.includes("notification")) return "notification";
  return "unknown";
}
