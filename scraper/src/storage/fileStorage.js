import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { backupFile } from "./backupStorage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../../..");
const kbRoot = path.join(projectRoot, "knowledge-base");

const storageStats = {
  written: 0,
  skippedUnchanged: 0,
  backedUp: 0,
  failed: 0,
};

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function shouldBackupOnOverwrite() {
  return String(process.env.SCRAPER_BACKUP_MODE || "changed").toLowerCase() !== "none";
}

function resolveFullPath(relativePath) {
  return path.join(kbRoot, relativePath);
}

function readExistingContent(fullPath) {
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  return fs.readFileSync(fullPath, "utf-8");
}

function prepareWrite(relativePath, nextContent) {
  const fullPath = resolveFullPath(relativePath);
  const previousContent = readExistingContent(fullPath);

  if (previousContent === nextContent) {
    storageStats.skippedUnchanged += 1;
    console.log(`[Scraper] Unchanged -> ${relativePath}`);
    return { fullPath, shouldWrite: false };
  }

  if (previousContent !== null && shouldBackupOnOverwrite()) {
    const backupPath = backupFile(fullPath, relativePath);
    if (backupPath) {
      storageStats.backedUp += 1;
    }
  }

  ensureDir(path.dirname(fullPath));
  return { fullPath, shouldWrite: true };
}

function writeContent(relativePath, content, label) {
  try {
    const prepared = prepareWrite(relativePath, content);
    if (!prepared.shouldWrite) {
      return true;
    }

    fs.writeFileSync(prepared.fullPath, content, "utf-8");
    storageStats.written += 1;
    console.log(`[Scraper] Saved ${label} -> ${relativePath}`);
    return true;
  } catch (error) {
    storageStats.failed += 1;
    console.error(`[Scraper] ${label} save error:`, error);
    return false;
  }
}

export async function saveJSON(relativePath, data) {
  return writeContent(relativePath, `${JSON.stringify(data, null, 2)}\n`, "JSON");
}

export function saveText(relativePath, text) {
  return writeContent(relativePath, String(text), "text");
}

export function exists(relativePath) {
  return fs.existsSync(resolveFullPath(relativePath));
}

export function resetStorageStats() {
  storageStats.written = 0;
  storageStats.skippedUnchanged = 0;
  storageStats.backedUp = 0;
  storageStats.failed = 0;
}

export function getStorageStats() {
  return { ...storageStats };
}

export { ensureDir, kbRoot, projectRoot };
