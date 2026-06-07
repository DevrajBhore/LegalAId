import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { saveJSON } from "../../storage/fileStorage.js";
import { EGAZETTE_ITEMS_ROOT, scrapeEgazetteHomePage } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EGAZETTE_INDEX_PATH = path.resolve(__dirname, "../../../../knowledge-base/gazette/egazette/index.json");
const EGAZETTE_ITEMS_DIR = path.resolve(__dirname, "../../../../knowledge-base/gazette/egazette/items");

function readSavedIndexEntries() {
  try {
    if (!fs.existsSync(EGAZETTE_INDEX_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(EGAZETTE_INDEX_PATH, "utf-8"));
    return Array.isArray(parsed.entries) ? parsed.entries : null;
  } catch {
    return null;
  }
}

function buildItemPayload(entry) {
  return {
    id: entry.id,
    gazette_id: entry.gazette_id,
    section: entry.section,
    ministry: entry.ministry,
    title: entry.title,
    publish_date: entry.publish_date,
    file_size: entry.file_size,
    source: entry.source,
    source_url: entry.source_url,
    detail_url: entry.detail_url,
    download_url: entry.download_url,
    raw_text: entry.raw_text,
    extraction: {
      status: "pending",
      reason: entry.download_url || entry.detail_url ? "awaiting_pdf_extraction" : "missing_download_reference",
    },
    text: "",
  };
}

function readExistingItem(itemId) {
  if (!itemId) return null;
  const filePath = path.join(EGAZETTE_ITEMS_DIR, `${itemId}.json`);
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function mergeWithExistingItem(entry) {
  const nextItem = buildItemPayload(entry);
  const existingItem = readExistingItem(entry.id);

  if (existingItem?.extraction?.status === "parsed" && String(existingItem.text || "").trim()) {
    return {
      ...existingItem,
      ...nextItem,
      download_url: existingItem.download_url || nextItem.download_url,
      detail_url: existingItem.detail_url || nextItem.detail_url,
      extraction: existingItem.extraction,
      text: existingItem.text,
    };
  }

  return nextItem;
}

function removeStaleEgazetteItems(activeIds = new Set()) {
  if (!fs.existsSync(EGAZETTE_ITEMS_DIR)) return;

  for (const entry of fs.readdirSync(EGAZETTE_ITEMS_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const itemId = entry.name.replace(/\.json$/i, "");
    if (activeIds.has(itemId)) continue;
    fs.unlinkSync(path.join(EGAZETTE_ITEMS_DIR, entry.name));
    console.log(`[eGazette] Removed stale item -> ${entry.name}`);
  }
}

export async function runNotificationScraper() {
  let entries = readSavedIndexEntries();

  if (!entries) {
    const result = await scrapeEgazetteHomePage();
    entries = result.entries;
  }

  let savedCount = 0;
  const activeIds = new Set(entries.map((entry) => entry.id).filter(Boolean));

  for (const entry of entries) {
    const saved = await saveJSON(`${EGAZETTE_ITEMS_ROOT}/${entry.id}.json`, mergeWithExistingItem(entry));
    if (saved) {
      savedCount += 1;
    }
  }

  removeStaleEgazetteItems(activeIds);

  console.log(`[eGazette] Saved ${savedCount}/${entries.length} gazette item records`);
}

export async function scrapeNotifications() {
  return runNotificationScraper();
}
