import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { loadJSONFiles } from "./src/indian-rule-engine/loader.js";
import { IndianRuleRegistry } from "./src/indian-rule-engine/registry.js";
import { buildSchemaValidator } from "./src/indian-rule-engine/schemaValidator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Resolve KB path — works whether IRE is at /project/IRE/IRE or alongside /knowledge-base
const POSSIBLE_KB_PATHS = [
  path.resolve(__dirname, "../knowledge-base"),                     // LEGAL/knowledge-base/ (your structure)
  path.resolve(__dirname, "../../knowledge-base/knowledge-base"),   // double-nested fallback
  path.resolve(__dirname, "../knowledge-base/knowledge-base"),      // double-nested fallback
  path.resolve(__dirname, "knowledge-base"),                        // internal copy fallback
];

function findKBPath() {
  for (const p of POSSIBLE_KB_PATHS) {
    if (fs.existsSync(path.join(p, "clause_library"))) return p;
  }
  return null;
}

const KB_ROOT = findKBPath();

if (!KB_ROOT) {
  console.error("[IRE Bootstrap] ⚠️  Knowledge-base not found. Validation will be degraded.");
}

const CLAUSE_LIBRARY_PATH = KB_ROOT ? path.join(KB_ROOT, "clause_library") : null;
const CONSTRAINTS_PATH    = KB_ROOT ? path.join(KB_ROOT, "constraints")    : null;
const MAPPINGS_PATH       = KB_ROOT ? path.join(KB_ROOT, "mappings")       : null;
const BLUEPRINTS_PATH     = CLAUSE_LIBRARY_PATH ? path.join(CLAUSE_LIBRARY_PATH, "blueprints") : null;

// Schema validator (optional – skip if schema file missing)
let validateClause = () => {};
try {
  if (CLAUSE_LIBRARY_PATH) {
    const schemaPath = path.join(CLAUSE_LIBRARY_PATH, "base_clause.schema.json");
    if (fs.existsSync(schemaPath)) {
      const baseSchema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
      validateClause = buildSchemaValidator(baseSchema);
    }
  }
} catch { /* non-fatal */ }

export function bootstrapIRE() {

  const registry = new IndianRuleRegistry();

  if (!KB_ROOT) return registry;

  console.log("[IRE Bootstrap] Starting with KB:", KB_ROOT);

  // ── 1. Load clause library ──────────────────────────────────────────────
  const clauseFolders = CLAUSE_LIBRARY_PATH
    ? fs.readdirSync(CLAUSE_LIBRARY_PATH, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== "blueprints")
        .map(d => d.name)
    : [];
  let totalClauses = 0;

  for (const folder of clauseFolders) {
    const folderPath = path.join(CLAUSE_LIBRARY_PATH, folder);
    if (!fs.existsSync(folderPath)) continue;

    const clauses = loadJSONFiles(folderPath);

    // Skip empty-text stub clauses (don't pollute registry with blank entries)
    const validClauses = clauses.filter(c => c.clause_id && c.text && c.text.trim().length > 0);

    validClauses.forEach(c => {
      try { validateClause(c); } catch { /* schema errors are non-fatal */ }
    });

    registry.addClauses(validClauses);
    totalClauses += validClauses.length;
  }

  console.log(`[IRE Bootstrap] Loaded ${totalClauses} clauses`);

  // ── 2. Load mappings (document_type → clause IDs) ───────────────────────
  if (MAPPINGS_PATH && fs.existsSync(MAPPINGS_PATH)) {
    const mappings = loadJSONFiles(MAPPINGS_PATH);
    let loaded = 0;

    for (const m of mappings) {
      if (!m.document_type || !m.clauses) continue;
      registry.addMapping(m.document_type, m.clauses);
      loaded++;
    }

    console.log(`[IRE Bootstrap] Loaded ${loaded} mappings`);
  }

  // ── 3. Load blueprints (blueprint clause sequences) ─────────────────────
  if (BLUEPRINTS_PATH && fs.existsSync(BLUEPRINTS_PATH)) {
    const blueprints = loadJSONFiles(BLUEPRINTS_PATH);
    let overridden = 0;
    let total = 0;

    for (const b of blueprints) {
      const clauseIds = b.required_clauses || b.clauses;
      if (!b.document_type || !Array.isArray(clauseIds)) continue;
      total++;
      if (registry.mappings.has(b.document_type)) {
        overridden++;
      }
      registry.addMapping(b.document_type, clauseIds);
    }

    // Show total blueprints on disk, and how many doc types are registered overall
    console.log(
      `[IRE Bootstrap] Loaded ${total} blueprints (${overridden} overrides, ${registry.mappings.size} doc types registered total)`
    );
  }

  // ── 4. Load constraints (domain → rules) ────────────────────────────────
  if (CONSTRAINTS_PATH && fs.existsSync(CONSTRAINTS_PATH)) {
    const constraintFiles = loadJSONFiles(CONSTRAINTS_PATH);
    let loaded = 0;

    for (const f of constraintFiles) {
      if (!f.domain || !f.rules) continue;
      registry.addConstraints(f.domain, f.rules);
      loaded++;
    }

    console.log(`[IRE Bootstrap] Loaded ${loaded} constraint sets`);
  }

  console.log("[IRE Bootstrap] Ready ✓");

  return registry;
}
