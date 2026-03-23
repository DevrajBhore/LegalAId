/**
 * statuteLoader.js
 *
 * Loads act JSON files from knowledge-base/acts/ for a given legal domain.
 *
 * Domain → act mappings are loaded from:
 *   knowledge-base/rules/domain_acts.rules.json
 *
 * To add new domains or map new acts — edit that JSON file. No code changes needed.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Resolve KB paths ──────────────────────────────────────────────────────────

function findKBActsPath() {
  const candidates = [
    path.resolve(__dirname, "../../../knowledge-base/acts"),
    path.resolve(__dirname, "../../../../knowledge-base/acts"),
    path.resolve(__dirname, "../../../../knowledge-base/knowledge-base/acts"),
    path.resolve(__dirname, "../../../knowledge-base/knowledge-base/acts"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function findDomainActsFile() {
  const candidates = [
    path.resolve(__dirname, "../../../knowledge-base/rules/domain_acts.rules.json"),
    path.resolve(__dirname, "../../../../knowledge-base/rules/domain_acts.rules.json"),
    path.resolve(__dirname, "../../../../knowledge-base/knowledge-base/rules/domain_acts.rules.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const KB_ACTS_PATH = findKBActsPath();

// ── Load domain → act map from KB ─────────────────────────────────────────────

function loadDomainActMap() {
  const file = findDomainActsFile();
  if (!file) {
    console.warn("[IRE] domain_acts.rules.json not found — using empty domain map");
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data.domain_act_map || {};
  } catch (err) {
    console.error("[IRE] Failed to load domain_acts.rules.json:", err.message);
    return {};
  }
}

const DOMAIN_ACT_MAP = loadDomainActMap();

// ── File list cache ───────────────────────────────────────────────────────────

let _fileListCache = null;

function getFileList() {
  if (_fileListCache) return _fileListCache;
  if (!fs.existsSync(KB_ACTS_PATH)) {
    console.warn("[IRE] Acts KB not found:", KB_ACTS_PATH);
    _fileListCache = [];
    return _fileListCache;
  }
  _fileListCache = fs.readdirSync(KB_ACTS_PATH);
  return _fileListCache;
}

// ── Main loader ───────────────────────────────────────────────────────────────

export function loadStatutesForDomain(domain) {
  // Fallback: if domain not found, try CONTRACT as the universal fallback
  const actPrefixes =
    DOMAIN_ACT_MAP[domain] ||
    DOMAIN_ACT_MAP["CONTRACT"] ||
    DOMAIN_ACT_MAP["COMMERCIAL"] ||
    [];

  const files  = getFileList();
  const acts   = [];
  const loaded = new Set();

  for (const prefix of actPrefixes) {
    const matchFile = files.find(f => f.startsWith(prefix));
    if (!matchFile || loaded.has(matchFile)) continue;

    const fullPath = path.join(KB_ACTS_PATH, matchFile);
    try {
      const actJSON = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
      acts.push(actJSON);
      loaded.add(matchFile);
    } catch (err) {
      console.error("[IRE] Failed to load act:", matchFile, err.message);
    }
  }

  return acts;
}

export { DOMAIN_ACT_MAP };
