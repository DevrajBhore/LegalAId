/**
 * measurementIntegrity.mjs
 *
 * WHAT THE PORTFOLIO ACTUALLY SAYS, AND WHAT IT WAS SAID TO SAY.
 *
 * A measurement error produced a coherent, actionable, test-backed explanation
 * for work that was never necessary. The application suite stayed green
 * throughout, because the application was calling the function correctly; only
 * the audit scripts were not. So "the tests pass" was no evidence at all about
 * the reports, and comparing the corrected numbers against the old ones is not
 * enough either — the corrected ones are more PLAUSIBLE, and plausibility is
 * what made the wrong ones persuasive.
 *
 * This file therefore does two things:
 *
 *   1. Re-derives the four populations FROM SCRATCH through the canonical
 *      adapter, and prints every member BY NAME. A count cannot be checked by
 *      reading; a list can.
 *   2. Carries the superseded claims beside the corrections, each with the
 *      reason and the action taken, so the retraction is part of the record
 *      rather than a thing that quietly stopped being mentioned.
 *
 * Run: node scripts/measurementIntegrity.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { reachableControlsFor } from "../backend/services/derivationAdapter.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { loadPropositions } from "../backend/services/evidencePropositions.js";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { loadFactRegistry } from "../backend/services/factRegistry.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BP_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");

const blueprints = {};
for (const name of fs.readdirSync(BP_DIR).filter((n) => n.endsWith(".blueprint.json"))) {
  const bp = JSON.parse(fs.readFileSync(path.join(BP_DIR, name), "utf8"));
  if (bp.document_type) blueprints[bp.document_type] = bp;
}
const clauses = new Set(getAllClauses().map((c) => c.clause_id));
// The fact registry is a THIRD source, alongside the intake schema and
// derivation. Leaving it out made this script disagree with auditClaimAuthority
// by three flags — small enough to look like rounding and exactly the kind of
// unexplained gap that made the last set of numbers untrustworthy.
const registryFlags = new Set();
for (const fact of loadFactRegistry().facts || []) {
  if (fact.id) registryFlags.add(fact.id);
  for (const treatment of fact.treatments || []) if (treatment.flag) registryFlags.add(treatment.flag);
}
const reachable = new Map();
for (const documentType of Object.keys(blueprints)) {
  reachable.set(documentType, await reachableControlsFor(documentType));
}

// ── The four populations, re-derived ────────────────────────────────────────
const gates = [];
for (const [documentType, bp] of Object.entries(blueprints)) {
  const schema = new Set(Object.keys(getVariables(documentType) || {}));
  for (const entry of bp.conditional_clauses || []) {
    const expression = String(entry.include_if || entry.when || "");
    const flag = expression.replace(/^!/, "").split(/[\s=!<>]/)[0].trim();
    if (!flag) continue;
    gates.push({
      documentType, flag, clause: entry.clause, expression,
      inSchema: schema.has(flag) || registryFlags.has(flag),
      derived: reachable.get(documentType).has(flag),
      clauseExists: clauses.has(entry.clause),
      held: Boolean(bp._unreachable),
    });
  }
}
const noSource = gates.filter((g) => !g.inSchema && !g.derived);
// SCOPE, stated because two of these scripts otherwise disagree and a reader
// would be right to distrust both. auditClaimAuthority counts only gates whose
// clause appears in the recorded baseline -- what the product SHIPS. This counts
// every conditional a blueprint declares, shipped or not. Neither is wrong; they
// answer different questions, and the difference is the set of gates on clauses
// no baseline records.
const baselineTypes = JSON.parse(fs.readFileSync(
  path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")).types || {};
const shipsIn = (documentType, clause) =>
  (baselineTypes[documentType]?.full?.clauses || []).includes(clause);
const noSourceShipping = noSource.filter((g) => shipsIn(g.documentType, g.clause));
const deterministic = gates.filter((g) => !g.inSchema && g.derived);
const unreachableClause = gates.filter((g) => !g.clauseExists);

const requirements = loadDocumentRequirements({ refresh: true });
const propositions = loadPropositions({ refresh: true });
const unestablishable = [];
const evidenceSourced = [];
for (const [family, list] of requirements) {
  for (const r of list) {
    const rule = r.applicability || {};
    if (rule.evidence) {
      evidenceSourced.push(`${family}/${r.id}`);
      if (!propositions.has(rule.evidence)) unestablishable.push(`${family}/${r.id} (undeclared: ${rule.evidence})`);
    } else if (rule.position
      && !new Set(Object.keys(getVariables(family) || {})).has(rule.position)
      && !reachable.get(family)?.has(rule.position)) {
      unestablishable.push(`${family}/${r.id} (position: ${rule.position})`);
    }
  }
}

const name = (list) => [...new Set(list.map((g) => `${g.flag} [${g.documentType}]`))].sort();

console.log("=".repeat(96));
console.log("THE FOUR POPULATIONS, RE-DERIVED THROUGH THE CANONICAL ADAPTER");
console.log("=".repeat(96));
console.log(`${gates.length} conditional gates across ${Object.keys(blueprints).length} families\n`);

console.log(`1. PROPOSITION / NO SOURCE — ${noSource.length} gate uses, ` +
  `${new Set(noSource.map((g) => g.flag)).size} distinct flags`);
console.log(`   of which ${noSourceShipping.length} gate a clause the recorded baseline ships. ` +
  `That smaller number is what\n   auditClaimAuthority reports; the two scripts count different ` +
  `populations on purpose.`);
for (const entry of name(noSource)) console.log(`     ${entry}`);

console.log(`\n2. DETERMINISTIC FACT — ${deterministic.length} gate uses, ` +
  `${new Set(deterministic.map((g) => g.flag)).size} distinct flags`);
for (const entry of name(deterministic)) console.log(`     ${entry}`);

console.log(`\n3. UNREACHABLE (gates a clause not in the library) — ${unreachableClause.length}`);
for (const entry of name(unreachableClause)) console.log(`     ${entry}`);
if (!unreachableClause.length) console.log("     (none)");

console.log(`\n4. REQUIREMENT / NO ESTABLISHABLE SOURCE — ${unestablishable.length}`);
for (const entry of unestablishable.sort()) console.log(`     ${entry}`);
if (!unestablishable.length) console.log("     (none)");

console.log(`\n   EVIDENCE-SOURCED REQUIREMENTS — ${evidenceSourced.length}`);
for (const entry of evidenceSourced.sort()) console.log(`     ${entry}`);
if (!evidenceSourced.length) {
  console.log("     (none — the mechanism is built, tested, and consumed by nothing.");
  console.log("      Left that way on purpose: authoring a requirement onto the EVIDENCE source");
  console.log("      to make this number move is how the first error became load-bearing.)");
}

// ── The retraction, carried with the correction ─────────────────────────────
const SUPERSEDED = [
  {
    claim: "29 propositions gate a clause with nothing able to establish them",
    corrected: () => `${new Set(noSource.map((g) => g.flag)).size} distinct flags, ${noSource.length} gate uses`,
    reason: "three audit scripts called deriveGenerationControls(variables, documentType); the " +
            "signature is (documentType, variables), and reversed it returns a small plausible object",
    action: "canonical adapter added; it refuses a swapped call rather than returning one",
  },
  {
    claim: "17 gates rest on a deterministic fact",
    corrected: () => `${deterministic.length} gate uses`,
    reason: "same swapped call — a gate resting on a derived flag read as resting on nothing",
    action: "re-derived through the adapter and listed by name above",
  },
  {
    claim: "20 gate uses can never fire",
    corrected: () => `${noSource.length} gate uses rest on no source; ${unreachableClause.length} gate a clause not in the library`,
    reason: "same swapped call, compounded by a probe that invented lender_type values " +
            "(\"Bank\", \"NBFC\") where the schema declares \"Scheduled Bank\"",
    action: "probe fixtures now come from buildVariables, the baseline's own builder",
  },
  {
    claim: "2 requirements rest on something nothing can establish (employer_headcount_ge_10, is_female_employee)",
    corrected: () => `${unestablishable.length}`,
    reason: "both are derived, and always were",
    action: "ceiling emptied; the principle written to protect them is retracted with it",
  },
  {
    claim: "MASTER_SERVICE_AGREEMENT/PERSONAL_DATA_HANDLED belongs on the EVIDENCE source",
    corrected: () => "reverted to POSITION",
    reason: "processes_personal_data is derived for that family and four others; the migration " +
            "made every MSA report the requirement permanently undetermined",
    action: "reverted; the open legal question (is a party's answer the right authority for a " +
            "fact about its systems?) recorded in the artifact rather than acted on",
  },
];
console.log("\n" + "=".repeat(96));
console.log("SUPERSEDED CLAIMS — kept beside their corrections, not quietly dropped");
console.log("=".repeat(96));
for (const row of SUPERSEDED) {
  console.log(`\n  claimed   ${row.claim}`);
  console.log(`  actual    ${row.corrected()}`);
  console.log(`  reason    ${row.reason}`);
  console.log(`  action    ${row.action}`);
}
