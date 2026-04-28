import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

const DEFAULT_BACKUP_ROOT = path.join(projectRoot, "tmp", "scraper-backups");
const DEFAULT_SNAPSHOT_ROOT = path.join(projectRoot, "tmp", "scraper-snapshots");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function sanitizeLabel(value = "") {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "snapshot";
}

export function resolveBackupRoot() {
  return process.env.SCRAPER_BACKUP_ROOT || DEFAULT_BACKUP_ROOT;
}

export function resolveSnapshotRoot() {
  return process.env.SCRAPER_SNAPSHOT_ROOT || DEFAULT_SNAPSHOT_ROOT;
}

export function backupFile(sourcePath, relativePath) {
  try {
    if (!fs.existsSync(sourcePath)) {
      return null;
    }

    const backupRoot = resolveBackupRoot();
    const backupDir = path.join(backupRoot, path.dirname(relativePath));
    const backupName = `${buildTimestamp()}__${path.basename(relativePath)}`;
    const backupPath = path.join(backupDir, backupName);

    ensureDir(backupDir);
    fs.copyFileSync(sourcePath, backupPath);

    console.log(`[Scraper] Backup created -> ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error("[Scraper] Backup error:", error);
    return null;
  }
}

export function createKnowledgeBaseSnapshot({
  sourceDir,
  label = "pre-run",
} = {}) {
  try {
    if (!fs.existsSync(sourceDir)) {
      return null;
    }

    const snapshotRoot = resolveSnapshotRoot();
    const snapshotPath = path.join(
      snapshotRoot,
      `${buildTimestamp()}__${sanitizeLabel(label)}`
    );

    ensureDir(snapshotRoot);
    fs.cpSync(sourceDir, snapshotPath, {
      recursive: true,
      force: false,
    });

    console.log(`[Scraper] KB snapshot created -> ${snapshotPath}`);
    return snapshotPath;
  } catch (error) {
    console.error("[Scraper] Snapshot error:", error);
    return null;
  }
}
