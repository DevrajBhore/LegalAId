/**
 * auditBlockRequirements.mjs — D4.46
 *
 * Audits every requirement authored `when_unsatisfied: "BLOCK"`, one by one,
 * BEFORE any of them is allowed to block. A declaration of BLOCK is not proof
 * that the requirement is right; this establishes only whether its mechanics
 * can be trusted to fire on the right documents:
 *
 *   A  applicability is decidable (always, or a position the intake asks)
 *   B  every satisfier clause exists in the library
 *   C  at least one satisfier is reachable for that document type
 *   D  on the corpus (every fixture world), it is never violated by a document
 *      that otherwise generates. Where no fixture world of the type generates at
 *      all, D is NOT_TESTED: no evidence is not passing evidence, and the
 *      requirement is held
 *   E  kind: CONTENT (presence of an essential term) can be activated by this
 *      audit; CHARACTER (what the instrument IS) is a legal judgment and is held
 *
 * Writes knowledge-base/governance/block-requirements-audit.json. The legal
 * correctness of each requirement is NOT assessed here; every one remains
 * draft-needs-legal-review.
 *
 *   node scripts/auditBlockRequirements.mjs [--write]
 */
import fs from "fs";
const { loadDocumentRequirements } = await import("../backend/services/documentRequirements.js");
const { getClauseById, getBlueprintForDocumentType } = await import("../backend/services/clauseAssembler.js");
const { generateDocument } = await import("../backend/services/documentService.js");
const { getVariables } = await import("../backend/config/variableConfig.js");
const { getDocumentDraftingPolicy } = await import("../backend/services/draftingPolicy.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");
const { assessRequirements } = await import("../backend/services/documentRequirements.js");
const { resolveCanonicalFacts } = await import("../backend/services/canonicalFacts.js");

const WRITE = process.argv.includes("--write");
const all = loadDocumentRequirements();
const rows = [];
const corpus = new Map();

async function corpusFor(type) {
  if (corpus.has(type)) return corpus.get(type);
  const runs = [];
  for (const profile of Object.keys(FIXTURE_PROFILE)) {
    const variables = variablesFor(type, { profile: FIXTURE_PROFILE[profile] });
    const r = await generateDocument({ document_type: type, variables });
    if (!r.draft) { runs.push({ world: profile, generated: false }); continue; }
    const facts = resolveCanonicalFacts(type, variables, variables.__resolved_positions || {}).facts;
    const a = assessRequirements(type, r.draft.clauses.map((c) => c.clause_id), facts, variables, [],
      Object.fromEntries(r.draft.clauses.map((c) => [c.clause_id, c.text || ""])));
    runs.push({ world: profile, generated: true, results: a.results });
  }
  corpus.set(type, runs);
  return runs;
}

for (const [type, requirements] of all) {
  const blueprint = JSON.stringify(getBlueprintForDocumentType(type) || {});
  const hardening = getDocumentDraftingPolicy(type)?.hardening || {};
  const required = new Set([...(hardening.requiredClauseIds || []), ...(hardening.baselineClauseIds || [])]);
  const schema = getVariables(type) || {};
  for (const req of requirements) {
    if (req.when_unsatisfied !== "BLOCK") continue;
    const by = req.satisfied_by.all_of || req.satisfied_by.any_of || [];
    const A = Boolean(req.applicability?.always) || Boolean(req.applicability?.position);
    const missingClauses = by.filter((id) => !getClauseById(id));
    const reachable = by.filter((id) => blueprint.includes(`"${id}"`) || required.has(id));
    const runs = await corpusFor(type);
    const generated = runs.filter((r) => r.generated);
    const violations = generated
      .map((r) => ({ world: r.world, result: r.results.find((x) => x.id === req.id) }))
      .filter((x) => x.result && ["UNRESOLVED", "ESCALATED"].includes(x.result.coverage));
    const unknown = generated.filter((r) => r.results.find((x) => x.id === req.id)?.coverage === "APPLICABILITY_UNKNOWN").map((r) => r.world);
    const kind = req.kind || "CONTENT";
    const checks = {
      A_applicability_decidable: A,
      B_satisfiers_exist: missingClauses.length === 0,
      C_satisfier_reachable: reachable.length > 0,
      D_never_violated_on_corpus: generated.length === 0 ? "NOT_TESTED" : violations.length === 0,
      E_kind_activatable: kind === "CONTENT",
    };
    const pass = Object.values(checks).every((v) => v === true);
    rows.push({
      document_type: type, id: req.id, kind, statement: req.statement,
      applicability: req.applicability, satisfied_by: req.satisfied_by,
      checks, missing_clauses: missingClauses, reachable_satisfiers: reachable,
      corpus: { worlds_generated: generated.length, worlds_refused: runs.length - generated.length, violated_in: violations.map((v) => v.world), applicability_unknown_in: unknown },
      enforcement: pass ? "ACTIVE_BLOCK" : "HELD_FOR_LEGAL_REVIEW",
      why: pass ? "Mechanics verified (A–E). Blocks release when applicable and unsatisfied."
        : `Held: ${Object.entries(checks).filter(([, v]) => v !== true).map(([k, v]) => (v === "NOT_TESTED" ? `${k} not tested (no fixture world of this type generates)` : k)).join(", ")}. Reported as 'Requires legal review', never as satisfied.`,
      legal_review: req.review_status || "draft-needs-legal-review",
    });
  }
}

const record = {
  $comment: [
    "D4.46 — the 34 requirements authored when_unsatisfied: BLOCK, audited one by one before any is allowed to block (scripts/auditBlockRequirements.mjs).",
    "This audit verifies MECHANICS only: that each requirement's applicability is decidable, its satisfying clauses exist and are reachable, and it does not fire on corpus documents that otherwise generate. It does not verify that the legal proposition is right; every requirement remains draft-needs-legal-review.",
    "ACTIVE_BLOCK: applicable and unsatisfied blocks release. HELD_FOR_LEGAL_REVIEW: applicable and unsatisfied gives 'Requires legal review', never 'Automated checks passed'.",
  ],
  audited_on: "2026-10-16",
  summary: {
    total: rows.length,
    active_block: rows.filter((r) => r.enforcement === "ACTIVE_BLOCK").length,
    held_for_legal_review: rows.filter((r) => r.enforcement !== "ACTIVE_BLOCK").length,
  },
  requirements: rows,
};
console.log(JSON.stringify(record.summary));
for (const r of rows) console.log(`${r.enforcement.padEnd(22)} ${r.document_type.padEnd(26)} ${r.id.padEnd(38)} ${r.why.slice(0, 90)} ${r.corpus.violated_in.length ? "violated:" + r.corpus.violated_in.join("/") : ""}`);
if (WRITE) fs.writeFileSync(new URL("../knowledge-base/governance/block-requirements-audit.json", import.meta.url), JSON.stringify(record, null, 2) + "\n");
process.exit(0);
