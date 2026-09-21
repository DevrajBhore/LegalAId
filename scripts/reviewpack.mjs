/**
 * Measures which clauses each document type actually renders, and writes
 * reviewpack.json for scripts/buildReviewPack.py.
 *
 * Run from the repository root:   node scripts/reviewpack.mjs
 *
 * Sampling comes from sweep.mjs, which is the authoritative definition of what a
 * fixture answer means. This script once inlined its own copy because sweep.mjs
 * was not in the repository; it is now, and the copy had drifted to disagree with
 * it on 53% of fields.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { sampleFor } from "../sweep.mjs";
import { VARIABLE_CONFIG } from "../backend/config/variableConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");


/* ── Sampling comes from the authoritative sampler ───────────────────────── */
//
// This file used to inline its own copy of sampleFor. The header explained why:
// sweep.mjs was not in the repository, so reading the sampler from it meant the
// script could not run from a clean checkout. sweep.mjs IS tracked now, so the
// reason the duplicate existed has expired.
//
// It was not a near-copy by the time it was removed. Compared field by field
// across every document type, the two samplers disagreed on 3,801 of 7,151
// values — 53%. sweep.mjs had grown per-field specimens while this copy still
// answered most free text with one generic sentence, so the review pack was
// being measured on a different population from the suite.
//
// probeContract.test.mjs bans positional choice in scripts/, and this file was
// the one offender: the removed copy chose an answer by its position in the
// option list, which is measurement error #4. Removing the duplicate removes
// that too.
//
// The spelling is not repeated here on purpose. That scan is a regex over source
// text and does not distinguish code from comments, so describing the pattern
// literally re-triggers it. Worth knowing about the detector; not fixed here.

// How many document types each clause actually reaches.
const usage = new Map();
for (const docType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const all = { ...(VARIABLE_CONFIG.COMMON||{}), ...(VARIABLE_CONFIG[docType]||{}) };
  const vars = {};
  for (const [k, d] of Object.entries(all)) {
    if (Array.isArray(d.excludeDocuments) && d.excludeDocuments.includes(docType)) continue;
    if (!d.required) continue;
    vars[k] = sampleFor(k, d);
  }
  let r;
  for (let i = 0; i < 15; i += 1) {
    r = await generateDocument({ document_type: docType, variables: vars });
    if (r?.draft) break;
    const m = String(r?.error || "").match(/Missing required field: (\w+)/);
    if (!m || vars[m[1]] !== undefined) break;
    vars[m[1]] = sampleFor(m[1], all[m[1]] || { type: "text" });
  }
  if (!r?.draft) continue;
  for (const c of r.draft.clauses) {
    const e = usage.get(c.clause_id) || { types: [], words: 0 };
    e.types.push(docType);
    e.words = Math.max(e.words, String(c.text||"").split(/\s+/).filter(Boolean).length);
    usage.set(c.clause_id, e);
  }
}

// Every clause id a blueprint, a variant slot, or the drafting policies can
// reach -- which is a wider set than the ids that appear in the baseline sweep.
const blueprintReferenced = new Set();
{
  const BP = path.join(ROOT, "knowledge-base", "clause_library", "blueprints");
  for (const f of fs.readdirSync(BP)) {
    if (!f.endsWith(".json")) continue;
    const b = JSON.parse(fs.readFileSync(path.join(BP, f), "utf8"));
    for (const c of b.clauses || b.required_clauses || []) blueprintReferenced.add(typeof c === "string" ? c : c.clause);
    for (const e of b.conditional_clauses || []) blueprintReferenced.add(e.clause);
    for (const v of b.variant_clauses || []) {
      for (const c of v.select_first_match || v.variants || []) blueprintReferenced.add(c.clause);
      if (v.default) blueprintReferenced.add(v.default);
    }
  }
  const pol = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base", "metadata", "drafting_policies.json"), "utf8"));
  for (const id of pol?.defaults?.hardening?.baselineClauseIds || []) blueprintReferenced.add(id);
  for (const cfg of Object.values(pol?.documents || {})) {
    for (const id of cfg?.hardening?.requiredClauseIds || []) blueprintReferenced.add(id);
    for (const id of cfg?.hardening?.baselineClauseIds || []) blueprintReferenced.add(id);
  }
}

// Library metadata.
const LIB = path.join(ROOT, "knowledge-base", "clause_library");
const clauses = [];
for (const dir of fs.readdirSync(LIB, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === "blueprints") continue;
  for (const file of fs.readdirSync(path.join(LIB, dir.name))) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(LIB, dir.name, file);
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(full, "utf8")); } catch { continue; }
    for (const c of (Array.isArray(parsed) ? parsed : [parsed])) {
      if (!c?.clause_id) continue;
      // A deprecated clause is not loaded by the engine and can never reach a
      // document. Putting it in the review pack asks the advocate to sign off
      // text the product cannot emit.
      if (c.deprecated === true) continue;
      const u = usage.get(c.clause_id) || { types: [], words: 0 };
      clauses.push({
        clause_id: c.clause_id,
        title: c.title || c.name || "",
        domain: dir.name,
        // Repo-relative, deliberately. The committed pack carried absolute paths
        // beginning /tmp/la — the ephemeral working copy it was generated in, which
        // no longer exists. An artifact that records the machine it was built on
        // instead of the file it describes cannot be read on any other machine, and
        // it is how this pack's own provenance was lost.
        file: path.relative(ROOT, full).split(path.sep).join("/"),
        doc_types_reached: u.types.length,
        doc_types: u.types.join(", "),
        rendered_words: u.words,
        risk_level: c.risk_level || "",
        enforceability: c.enforceability || "",
        mandatory: c.mandatory === true,
        review_status: c.review_status || "unmarked",
        reviewed_by: c.reviewed_by || "",
        citations: (c.legal_basis || []).map(b => `${b.act||""} s.${b.section||""}`).join("; "),
        text: c.text || "",
        // The specific judgement the clause author could not make. This is the
        // most useful column in the pack: it turns "review this text" into a
        // concrete question, and it is where every deliberate drafting choice
        // and every unverified citation was recorded.
        authoring_note: c.authoring_note || "",
        statute_currency: c.statute_currency || "",
        // Why a clause reaches nothing matters. A clause no blueprint mentions is
        // dead. A conditional clause is alive but waits on a question this
        // fixture did not answer -- it will appear the moment a user answers it,
        // so it still needs review, just not first.
        reach_status: u.types.length > 0
          ? "in every generated draft that uses it"
          : (blueprintReferenced.has(c.clause_id)
              ? "conditional or variant -- reachable, but not triggered by the baseline fixture"
              : "NOT referenced by any blueprint or policy"),
      });
    }
  }
}

// Priority: reach across document types, weighted up for high risk and for
// clauses that are mandatory in the blueprint.
const RISK_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1, "": 1 };
for (const c of clauses) {
  c.priority =
    c.doc_types_reached * (RISK_WEIGHT[c.risk_level.toUpperCase()] || 1) +
    (c.mandatory ? 5 : 0) +
    // A clause with an authoring note carries a question already framed for the
    // advocate, so it is cheaper to decide and should not sink below untouched
    // boilerplate that merely appears in many documents.
    (c.authoring_note ? 8 : 0) +
    // Repointed to the labour Codes on 21 November 2025: the substance moved,
    // not just the citation, so these need a look before anything else.
    (c.statute_currency ? 12 : 0);
}
clauses.sort((a, b) => b.priority - a.priority);

// A provenance header, so the pack can say what produced it.
//
// `doc_types_reached` is POPULATION-DEPENDENT evidence: it counts the families
// that actually generated, not the families in the measurement population. Eleven
// of the forty do not currently realize, so a clause reaching only agreements
// shows a smaller number here than it will once CONSTRAINT_SCOPE_DECLARATIONS is
// decided. Stamping the figures is what stops them being read as stable.
const realized = new Set();
for (const c of clauses) for (const t of String(c.doc_types || "").split(", ").filter(Boolean)) realized.add(t);
const provenance = {
  generated_at: new Date().toISOString(),
  sampler: "sweep.mjs — the authoritative sampler; this script no longer keeps its own copy",
  population_rule: "DOCUMENT_TYPE_REGISTRY with an existing named blueprint",
  population_members: Object.keys(DOCUMENT_TYPE_REGISTRY).length,
  families_realized: realized.size,
  caveat: "doc_types_reached counts realized families, not population members. It moves when realization changes.",
};
fs.writeFileSync(
  path.join(ROOT, "reviewpack.json"),
  JSON.stringify({ $provenance: provenance, clauses }, null, 1)
);
const reached = clauses.filter(c => c.doc_types_reached > 0);
const typeCount = Object.keys(DOCUMENT_TYPE_REGISTRY).length;
const conditional = clauses.filter(c => c.doc_types_reached === 0 && blueprintReferenced.has(c.clause_id));
const dead = clauses.filter(c => c.doc_types_reached === 0 && !blueprintReferenced.has(c.clause_id));
console.log(`${clauses.length} live clauses, ${reached.length} appear in a baseline draft of one of the ${typeCount} types`);
console.log(`${conditional.length} are conditional or variant -- reachable, awaiting a trigger the baseline fixture does not answer`);
console.log(`${dead.length} are referenced by no blueprint or policy at all\n`);
let cum = 0;
const totalPlacements = clauses.reduce((n,c)=>n+c.doc_types_reached,0);
for (const [n] of [[10],[20],[30],[50]]) {
  cum = clauses.slice(0,n).reduce((s,c)=>s+c.doc_types_reached,0);
  console.log(`  top ${String(n).padStart(3)} clauses cover ${String(cum).padStart(4)} of ${totalPlacements} clause placements (${Math.round(100*cum/totalPlacements)}%)`);
}
