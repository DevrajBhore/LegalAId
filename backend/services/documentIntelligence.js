/**
 * documentIntelligence.js
 *
 * "Verification as a product." Surfaces the analysis the engine ALREADY computes
 * but never shows — per-clause why/legal-basis/dispute-hotspots, an overall risk
 * & enforceability summary, the statutes the document rests on, and CROSS-CLAUSE
 * conflict detection. This is advisory/explanatory only — it never blocks the
 * export gate (that is the validator's job); it makes the document defensible and
 * legible in a way a raw chatbot's prose can't be.
 */

const SINGLETON_CATEGORIES = new Set([
  "IDENTITY",
  "GOVERNING_LAW",
  "DISPUTE_RESOLUTION",
  "SIGNATURE_BLOCK",
]);

function normalizeBasis(legalBasis) {
  if (!Array.isArray(legalBasis)) {
    return legalBasis ? [{ act: String(legalBasis), section: "", note: "" }] : [];
  }
  return legalBasis
    .map((b) =>
      typeof b === "string"
        ? { act: b, section: "", note: "" }
        : { act: b.act || "", section: b.section || "", note: b.note || "" }
    )
    .filter((b) => b.act);
}

function formatBasis(b) {
  return b.section ? `${b.act} – S.${b.section}` : b.act;
}

// ── Cross-clause conflict detection ─────────────────────────────────────────
// Genuinely BETWEEN clauses (single-clause issues are the validator's domain).
function detectConflicts(clauses = []) {
  const conflicts = [];
  const byId = new Map(clauses.map((c) => [c.clause_id, c]));
  const text = (c) => String(c.text || "").toLowerCase();

  // 1. Authored conflicts: a clause that declares conflicts_with another present clause.
  for (const c of clauses) {
    for (const other of c.conflicts_with || []) {
      if (byId.has(other) && c.clause_id < other) {
        conflicts.push({
          type: "DECLARED_CONFLICT",
          severity: "HIGH",
          clauses: [c.clause_id, other],
          message: `"${c.title || c.clause_id}" is marked as conflicting with "${byId.get(other).title || other}". Keep only one.`,
        });
      }
    }
  }

  // 2. Liability cap present but does not carve out the indemnity → the indemnity
  //    may be unintentionally capped (a frequent, expensive drafting ambiguity).
  const capClause = clauses.find(
    (c) =>
      /LIABILITY|LIMITATION/.test(String(c.category || "")) ||
      /limitation of liability|aggregate liability|liability.*shall not exceed/.test(text(c))
  );
  const indemnityClause = clauses.find(
    (c) => /INDEMNI/.test(String(c.category || "")) || /indemnif/.test(text(c))
  );
  if (capClause && indemnityClause && !/indemn/.test(text(capClause))) {
    conflicts.push({
      type: "INDEMNITY_NOT_CARVED_OUT",
      severity: "MEDIUM",
      clauses: [capClause.clause_id, indemnityClause.clause_id],
      message:
        "The document has both a liability cap and an indemnity, but the cap does not expressly carve out indemnity obligations. Confirm whether the indemnity is intended to be subject to, or excluded from, the cap.",
    });
  }

  // 3. Duplicate singleton roles (two governing-law / dispute / identity clauses).
  const seen = new Map();
  for (const c of clauses) {
    const cat = String(c.category || "").toUpperCase();
    if (!SINGLETON_CATEGORIES.has(cat)) continue;
    if (seen.has(cat)) {
      conflicts.push({
        type: "DUPLICATE_SINGLETON",
        severity: "MEDIUM",
        clauses: [seen.get(cat), c.clause_id],
        message: `Two "${cat}" clauses are present; a document should have exactly one.`,
      });
    } else {
      seen.set(cat, c.clause_id);
    }
  }

  return conflicts;
}

export function buildDocumentIntelligence(draft, validation = {}) {
  const clauses = draft?.clauses || [];

  const perClause = clauses.map((c) => {
    const basis = normalizeBasis(c.legal_basis);
    return {
      clause_id: c.clause_id,
      title: c.title || c.name || c.clause_id,
      category: c.category || null,
      why: c.inclusion_reason || null,
      legal_basis: basis.map(formatBasis),
      enforceability: c.enforceability || null,
      risk_level: c.risk_level || null,
      litigation_risk: c.litigation_risk || null,
      drafting_strength: c.drafting_strength || null,
      dispute_hotspots: Array.isArray(c.dispute_hotspots) ? c.dispute_hotspots : [],
      watch_for: Array.isArray(c.invalid_if) ? c.invalid_if : [],
    };
  });

  // Unique statutes the whole document rests on.
  const statutes = new Set();
  for (const c of clauses) for (const b of normalizeBasis(c.legal_basis)) statutes.add(b.act);

  const enfCount = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const c of clauses) {
    const e = String(c.enforceability || "").toUpperCase();
    if (e in enfCount) enfCount[e] += 1;
  }

  const conflicts = detectConflicts(clauses);

  return {
    overall: {
      risk_score: validation?.score ?? null,
      risk_level: validation?.risk_level || validation?.overall_risk || validation?.risk || null,
      certification: validation?.certification || null,
      certified: Boolean(validation?.certified),
      clause_count: clauses.length,
      enforceability: enfCount,
      statutes_referenced: [...statutes].sort(),
      conflict_count: conflicts.length,
      tax_flags: {
        tds: clauses.some((c) => c.tds_applicable),
        gst: clauses.some((c) => c.gst_applicable),
        msme_sensitive: clauses.some((c) => c.msme_sensitive),
      },
    },
    clauses: perClause,
    conflicts,
  };
}
