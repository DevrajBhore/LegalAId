import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve knowledge-base relative to IRE root (one level up from src/statutes)
const KB_SECTIONS_PATH = path.resolve(__dirname, "../../../../knowledge-base/knowledge-base/sections");

export function loadSectionsForAct(act_id) {

  const actFolderPath = path.join(KB_SECTIONS_PATH, act_id);

  if (!fs.existsSync(actFolderPath)) {
    // Fallback: try partial match (act_id might not include handle suffix)
    if (fs.existsSync(KB_SECTIONS_PATH)) {
      const dirs = fs.readdirSync(KB_SECTIONS_PATH);
      const match = dirs.find(d => d.startsWith(act_id));
      if (match) {
        return _loadFromFolder(path.join(KB_SECTIONS_PATH, match));
      }
    }
    return [];
  }

  return _loadFromFolder(actFolderPath);
}

function _loadFromFolder(folderPath) {
  const files = fs.readdirSync(folderPath).filter(f => f.endsWith(".json"));
  const sections = [];

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(folderPath, file), "utf-8"));
      sections.push({
        ...raw,
        // Normalise: content field from IndiaCode scrape → text
        text: raw.text || raw.content || ""
      });
    } catch {
      // skip corrupt files
    }
  }

  return sections;
}
