// scraper/src/storage/fileStorage.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to project root (LegalAId)
const projectRoot = path.resolve(__dirname, "../../..");

// Path to knowledge-base folder
const kbRoot = path.join(projectRoot, "knowledge-base");

// Utility: ensure directory exists
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Save JSON to KB
 */
export async function saveJSON(relativePath, data) {
    try {
        const fullPath = path.join(kbRoot, relativePath);

        ensureDir(path.dirname(fullPath));

        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");

        console.log(`📁 Saved JSON → ${relativePath}`);
        return true;
    } catch (err) {
        console.error("❌ JSON Save Error:", err);
        return false;
    }
}

/**
 * Save raw text files (for PDFs, HTML, raw templates)
 */
export function saveText(relativePath, text) {
    try {
        const fullPath = path.join(kbRoot, relativePath);

        ensureDir(path.dirname(fullPath));

        fs.writeFileSync(fullPath, text, "utf-8");

        console.log(`📄 Saved text → ${relativePath}`);
        return true;
    } catch (err) {
        console.error("❌ Text Save Error:", err);
        return false;
    }
}

/**
 * Check if file already exists (avoid re-scraping)
 */
export function exists(relativePath) {
    return fs.existsSync(path.join(kbRoot, relativePath));
}

// ✅ EXPORT ensureDir so subordinateScraper can use it
export { ensureDir };
