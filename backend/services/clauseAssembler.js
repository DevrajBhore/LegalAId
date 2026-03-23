import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const KB_ROOT    = path.resolve(__dirname, "../../knowledge-base");
const CLAUSE_LIB = path.join(KB_ROOT, "clause_library");
const BLUEPRINTS = path.join(CLAUSE_LIB, "blueprints");

// ── Blueprint loader ──────────────────────────────────────────────────────────

function loadBlueprint(documentType) {
  const base = documentType.toLowerCase();

  // Build candidates — exact name first, then short aliases
  const candidates = [`${base}.blueprint.json`];

  // Strip _agreement only if result is short enough (avoids sales_of_goods truncation)
  const sa = base.replace(/_agreement$/, "");
  if (sa !== base && sa.split("_").length <= 3) {
    candidates.push(`${sa}.blueprint.json`);
  }

  const sc = base.replace(/_contract$/, "");
  if (sc !== base) candidates.push(`${sc}.blueprint.json`);

  const sd = base.replace(/_deed$/, "");
  if (sd !== base) candidates.push(`${sd}.blueprint.json`);

  for (const candidate of candidates) {
    const file = path.join(BLUEPRINTS, candidate);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  }

  throw new Error(
    `Blueprint not found for document type: "${documentType}". ` +
    `Tried: ${candidates.join(", ")}`
  );
}

// ── Clause library loader ─────────────────────────────────────────────────────

let _clauseCache = null;

function loadAllClauses() {
  if (_clauseCache) return _clauseCache;

  const clauses = {};

  if (!fs.existsSync(CLAUSE_LIB)) {
    throw new Error(`Clause library not found at: ${CLAUSE_LIB}`);
  }

  for (const folder of fs.readdirSync(CLAUSE_LIB)) {
    const dir = path.join(CLAUSE_LIB, folder);
    if (!fs.statSync(dir).isDirectory() || folder === "blueprints") continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        if (data.clause_id && data.text?.trim()) {
          clauses[data.clause_id] = data;
        }
      } catch { /* skip corrupt files */ }
    }
  }

  console.log(`[ClauseAssembler] Loaded ${Object.keys(clauses).length} clauses`);
  _clauseCache = clauses;
  return clauses;
}

// ── Fallback clause ───────────────────────────────────────────────────────────

function createFallbackClause(id) {
  return {
    clause_id : id,
    category  : "UNCATEGORIZED",
    title     : id.replace(/_/g, " ").replace(/\d+$/, "").trim(),
    text      : `[CLAUSE ${id} — TO BE DRAFTED]`,
    statutory_reference: ""
  };
}

// ── Main assembler ────────────────────────────────────────────────────────────

export function assembleDocument(documentType, variables = {}) {
  const blueprint    = loadBlueprint(documentType);
  const clauseLibrary = loadAllClauses();

  const clauseIds = blueprint.required_clauses || blueprint.clauses || [];

  if (!Array.isArray(clauseIds)) {
    throw new Error(`Invalid blueprint format for ${documentType}`);
  }

  const clauses = clauseIds.map(id => {
    const clause = clauseLibrary[id];
    if (!clause) {
      console.warn(`[ClauseAssembler] Missing clause: ${id} — using fallback`);
      return createFallbackClause(id);
    }
    return { ...clause };
  });

  return {
    document_type : documentType,
    jurisdiction  : "India",
    clauses,
    metadata: {
      blueprint_clause_count : clauseIds.length,
      loaded_clause_count    : clauses.length,
      missing_clauses        : clauses
        .filter(c => c.category === "UNCATEGORIZED")
        .map(c => c.clause_id),
    }
  };
}

export function clearClauseCache() {
  _clauseCache = null;
}
