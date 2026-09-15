/**
 * portfolioInventory.mjs
 *
 * THE SOURCE OF TRUTH FOR WHAT THIS PRODUCT NEEDS NEXT.
 *
 * One row per family x REQUIREMENT, never per family. A family with twelve
 * requirements, eleven healthy and one resting on a proposition nothing can
 * establish, is a clean-looking family and a dangerous document; rolled up to a
 * single row it would report as fine, which is the same arithmetic that let
 * twenty boilerplate clauses satisfy one of thirteen identity requirements.
 *
 * The family map below is CALCULATED from the requirement rows. Nothing in it is
 * summarised by hand, because a hand summary is an assertion and this file is
 * supposed to contain measurements.
 *
 * The column that matters most is failure_if_unknown. Knowing an input's SOURCE
 * is not enough:
 *
 *     processes_personal_data          source EVIDENCE   unknown -> ESCALATED
 *     an optional commercial preference source POSITION  unknown -> DEFAULTED
 *
 * Radically different legal behaviour from the same shape of missing input. This
 * column is where the standing invariant gets tested in the aggregate: UNKNOWN
 * must never collapse into FALSE, into NOT_APPLICABLE, or into a drafting
 * default that nobody chose.
 *
 * Run: node scripts/portfolioInventory.mjs [--rows] [--json out.json]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  loadDocumentRequirements, assessRequirements, COVERAGE, FINDING,
} from "../backend/services/documentRequirements.js";
import { loadPropositions } from "../backend/services/evidencePropositions.js";
import { certify } from "../backend/services/familyCertification.js";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { reachableControlsFor } from "../backend/services/derivationAdapter.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SHOW_ROWS = process.argv.includes("--rows");
const JSON_OUT = process.argv.includes("--json")
  ? process.argv[process.argv.indexOf("--json") + 1] : null;

const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types || {};
const clauses = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c]));
const TEXT = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c.text || ""]));
const requirements = loadDocumentRequirements({ refresh: true });
const propositions = loadPropositions({ refresh: true });

// PER DOCUMENT, not globally. sanitizeVariablesForDocument filters intake to the
// document's OWN schema, so a field declared in another family's config is not a
// source here: it is dropped before clause selection sees it. The global set
// made three scripts disagree with one another by a few gates each — small
// enough to read as rounding, which is how the last set of numbers survived.
const askableIn = (documentType) => new Set(Object.keys(getVariables(documentType) || {}));
// DERIVABILITY IS PROBED WITH THE SCHEMA'S OWN FIXTURES, AND THE ARGUMENTS ARE
// IN THE RIGHT ORDER. Both halves of that sentence were wrong here once, and
// each produced a confident false measurement:
//
//   1. deriveGenerationControls(documentType, variables) -- documentType FIRST.
//      Called the other way round it silently returns almost nothing, and every
//      gate reads as resting on no source. That error reported 29 orphan
//      propositions where there are 14, and drove a whole abstraction.
//   2. The fixture must be the schema's own synthetic intake, not values I
//      invent. Probing lender_type with "Bank" and "NBFC" found nothing because
//      the declared option is "Scheduled Bank".
//
// buildVariables is the baseline's own fixture builder, so the probe measures
// what the recorded baseline measures rather than a second fixture that drifts.
const derivedCache = new Map();
// Populated eagerly for every type the script will ask about, so the lookup
// below stays synchronous and no call site has to remember to await it.
for (const documentType of new Set([...requirements.keys(), ...Object.keys(DOCUMENT_TYPE_REGISTRY)])) {
  derivedCache.set(documentType, await reachableControlsFor(documentType));
}
const derivedFor = (documentType) => derivedCache.get(documentType) || new Set();

// Certification, computed once, with the coherence defects fed in.
const emits = new Map(
  Object.entries(baseline).map(([t, r]) => [t, r?.full?.clauses || []])
);
const generates = new Set(
  Object.entries(baseline).filter(([, r]) => (r?.full?.clauses || []).length).map(([t]) => t)
);
const reviewedClauses = new Set(
  getAllClauses().filter((c) => c.review_status && !/draft|needs/i.test(c.review_status))
    .map((c) => c.clause_id)
);
const assessments = {};
const defects = new Map();
for (const [type, list] of Object.entries(emits)) void list;
for (const type of Object.keys(baseline)) {
  const list = emits.get(type) || [];
  if (!list.length) continue;
  const a = assessRequirements(type, list, {}, {}, [], TEXT);
  if (!a.assessed) continue;
  assessments[type] = a;
  const broken = (a.relationships || []).filter(
    (r) => r.coverage !== COVERAGE.NOT_APPLICABLE && r.finding !== FINDING.ESTABLISHED_POSITIVE
  );
  if (broken.length) defects.set(type, broken.map((b) => b.id));
}
const { families: certified } = certify({ generates, emits, reviewedClauses, defects });

// ── ONE ROW PER FAMILY x REQUIREMENT ────────────────────────────────────────
//
// Exported, and the report below consumes the same function the tests do. An
// earlier test in this repo shelled out to a script and parsed its stdout, which
// ran the work twice and made a dotenv banner part of the assertion surface.
export function buildInventory() { return rows; }
export { certified, defects, assessments };
const rows = [];
for (const [family, list] of requirements) {
  const relationships = list.relationships || [];
  const assessment = assessments[family];
  for (const r of list) {
    const rule = r.applicability || { always: true };
    const satisfiedBy = r.satisfied_by?.all_of || r.satisfied_by?.any_of || [];

    // Applicability source, and the provenance of whatever it rests on.
    let source = "UNCONDITIONAL";
    let provenance = "none";
    let restsOn = null;
    if (rule.evidence) {
      source = "EVIDENCE"; restsOn = rule.evidence;
      provenance = propositions.has(rule.evidence) ? "admitted proposition" : "UNDECLARED";
    } else if (rule.position) {
      restsOn = rule.position;
      if (askableIn(family).has(rule.position)) { source = "POSITION"; provenance = "declared"; }
      else if (derivedFor(family).has(rule.position)) { source = "FACT"; provenance = "derived"; }
      else { source = "POSITION"; provenance = "NO SOURCE"; }
    }

    // What outside the document can change the answer.
    const declaration = restsOn ? propositions.get(restsOn) : null;
    const evidenceDependency =
      r.kind === "EXTERNAL_COHERENCE" ? "external_document"
      : source === "EVIDENCE" ? (declaration?.class === "service practice" ? "system_state" : "world_sourced")
      : "none";

    // failure_if_unknown -- the column the whole inventory turns on.
    let failureIfUnknown;
    if (source === "UNCONDITIONAL") failureIfUnknown = "n/a — always applicable";
    else if (source === "EVIDENCE") {
      failureIfUnknown = declaration
        ? (declaration.when_unknown === "ESCALATE" ? "ESCALATED" : "UNRESOLVED (disclosed)")
        : "UNKNOWABLE — proposition not declared";
    } else failureIfUnknown = provenance === "NO SOURCE"
      ? "APPLICABILITY_UNKNOWN (and nothing can ever resolve it)"
      : "APPLICABILITY_UNKNOWN";

    rows.push({
      family,
      requirement_id: r.id,
      identity_dimension: r.kind || "CONTENT",
      requirement_statement: r.statement,
      applicability_source: source,
      source_provenance: provenance,
      rests_on: restsOn,
      evidence_dependency: evidenceDependency,
      subject_binding: r.subject_binding || declaration?.subject_binding || null,
      temporal_dependency:
        r.kind === "TIMING" ? `window: ${r.window}`
        : Number.isFinite(r.evidence_valid_for_days) ? `evidence valid ${r.evidence_valid_for_days}d`
        : Number.isFinite(declaration?.evidence_valid_for_days) ? `evidence valid ${declaration.evidence_valid_for_days}d`
        : null,
      external_act_dependency: r.outside_the_document || null,
      clause_ids: satisfiedBy,
      clauses_in_library: satisfiedBy.filter((id) => clauses[id]).length,
      relationship_dependencies: relationships
        .filter((rel) => rel.between.some((id) => satisfiedBy.includes(id)))
        .map((rel) => rel.id),
      unknown_behaviour: failureIfUnknown,
      failure_if_unknown: failureIfUnknown,
      when_unsatisfied: r.when_unsatisfied,
      contradiction_handling:
        r.kind === "CHARACTER" ? `defeated by ${(r.contradicted_by || []).length} clauses`
        : relationships.some((rel) => rel.between.some((id) => satisfiedBy.includes(id)))
          ? "inter-clause relationship" : "none",
      falsification: r.falsification ? "present" : "absent",
      current_finding: assessment
        ? (() => {
            const hit = assessment.results.find((x) => x.id === r.id);
            return hit ? `${hit.coverage} / ${hit.finding}` : "not assessed";
          })()
        : "family does not generate",
      certification_rung: certified[family]?.status || "NOT REGISTERED",
      review_status: r.review_status,
    });
  }
}

if (JSON_OUT) {
  fs.writeFileSync(JSON_OUT, JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2));
}

// ── THE FAMILY MAP, CALCULATED FROM THE ROWS ────────────────────────────────
const byFamily = {};
for (const row of rows) (byFamily[row.family] ||= []).push(row);

const count = (list, field, value) => list.filter((r) => r[field] === value).length;

// Printing happens only when this file is the entry point. A test that imports
// it gets the data and none of the noise.
const REPORT = Boolean(process.argv[1] && process.argv[1].endsWith("portfolioInventory.mjs"));
const log = REPORT ? console.log : () => {};
log("=".repeat(104));
log("PORTFOLIO INVENTORY — one row per family x requirement, family map derived from the rows");
log("=".repeat(104));
log(
  `${rows.length} requirements across ${Object.keys(byFamily).length} families with identity ` +
  `authored. ${Object.keys(DOCUMENT_TYPE_REGISTRY).length - Object.keys(byFamily).length} ` +
  `registered families have none.`
);

for (const [family, list] of Object.entries(byFamily).sort()) {
  const cert = certified[family] || {};
  log(`\n${family}   [${cert.status || "NOT REGISTERED"}]   ${list.length} requirements`);
  log(
    `  applicability   unconditional ${count(list, "applicability_source", "UNCONDITIONAL")}` +
    `  position ${count(list, "applicability_source", "POSITION")}` +
    `  fact ${count(list, "applicability_source", "FACT")}` +
    `  evidence ${count(list, "applicability_source", "EVIDENCE")}`
  );
  const dep = (v) => list.filter((r) => r.evidence_dependency === v).length;
  log(
    `  dependencies    external-document ${dep("external_document")}` +
    `  world ${dep("world_sourced")}  system-state ${dep("system_state")}` +
    `  temporal ${list.filter((r) => r.temporal_dependency).length}` +
    `  external-act ${list.filter((r) => r.external_act_dependency).length}` +
    `  inter-clause ${list.filter((r) => r.relationship_dependencies.length).length}`
  );
  const findings = {};
  for (const r of list) findings[r.current_finding.split(" / ")[0]] =
    (findings[r.current_finding.split(" / ")[0]] || 0) + 1;
  log(`  findings        ${Object.entries(findings).map(([k, n]) => `${k}:${n}`).join("  ")}`);
  log(
    `  falsification   ${count(list, "falsification", "present")} of ${list.length} requirements ` +
    `name an attack` +
    (defects.has(family) ? `   ! SHIPS A DEFECT: ${defects.get(family).join(", ")}` : "")
  );
  const unreviewed = list.filter((r) => /draft|needs/i.test(r.review_status || "")).length;
  log(
    `  review          ${list.length - unreviewed} of ${list.length} requirements reviewed; ` +
    `clause/family/approval: ${["clause_review", "family_review", "approval"]
      .map((k) => (cert.evidence?.[k] ? "yes" : "no")).join("/")}`
  );
  const dangerous = list.filter((r) => /NO SOURCE|UNDECLARED|never|UNKNOWABLE/i.test(
    `${r.source_provenance} ${r.failure_if_unknown}`));
  for (const row of dangerous) {
    log(`  ! ${row.requirement_id}: rests on "${row.rests_on}" — ${row.failure_if_unknown}`);
  }
}

// ── FAILURE-IF-UNKNOWN, ACROSS THE WHOLE PORTFOLIO ──────────────────────────
log("\n" + "=".repeat(104));
log("FAILURE IF UNKNOWN — knowing the SOURCE of an input is not knowing what happens without it");
log("=".repeat(104));
const unknowns = {};
for (const row of rows) {
  const key = `${row.applicability_source.padEnd(14)} -> ${row.failure_if_unknown}`;
  (unknowns[key] ||= []).push(row);
}
for (const [key, list] of Object.entries(unknowns).sort((a, b) => b[1].length - a[1].length)) {
  log(`  ${String(list.length).padStart(3)}  ${key}`);
}
const collapsing = rows.filter((r) =>
  r.applicability_source !== "UNCONDITIONAL" &&
  /\bFALSE\b|NOT_APPLICABLE|DEFAULT/i.test(r.failure_if_unknown)
);
log(
  collapsing.length
    ? `\n!! ${collapsing.length} requirements let an UNKNOWN input collapse into FALSE, ` +
      `NOT_APPLICABLE or a drafting default.`
    : `\nNo requirement lets an UNKNOWN input collapse into FALSE, NOT_APPLICABLE or a drafting ` +
      `default. That is the invariant, measured rather than asserted.`
);

// ── DIMENSION COVERAGE: what kind of reasoning is exercised, and by whom ────
log("\n" + "=".repeat(104));
log("ARCHITECTURAL DIMENSION COVERAGE — which families exercise which class of truth");
log("=".repeat(104));
export const DIMENSIONS = {
  "identity / substance": (r) => r.identity_dimension === "CONTENT",
  "statutory applicability": (r) => r.applicability_source === "POSITION" || r.applicability_source === "FACT",
  "formality vs act": (r) => Boolean(r.external_act_dependency),
  "timing": (r) => r.identity_dimension === "TIMING",
  "declared character": (r) => r.identity_dimension === "CHARACTER",
  "external instrument": (r) => r.evidence_dependency === "external_document",
  "inter-clause coherence": (r) => r.relationship_dependencies.length > 0,
  "world-sourced applicability": (r) => r.applicability_source === "EVIDENCE",
};
for (const [dimension, test] of Object.entries(DIMENSIONS)) {
  const families = [...new Set(rows.filter(test).map((r) => r.family))];
  const passed = families.filter((f) => certified[f]?.status === "FALSIFICATION_PASSED"
    || certified[f]?.status === "ADVOCATE_REVIEW" || certified[f]?.status === "APPROVED");
  log(
    `  ${dimension.padEnd(30)} ${families.length ? "exercised by" : "NOT EXERCISED"} ` +
    `${families.join(", ") || "any family"}` +
    (families.length && !passed.length ? "   (none falsification-passed)" : "")
  );
}

if (SHOW_ROWS) {
  log("\n" + "=".repeat(104));
  log("THE ROWS");
  log("=".repeat(104));
  for (const row of rows) {
    log(
      `\n${row.family} / ${row.requirement_id}  [${row.identity_dimension}]`
    );
    log(`  source ${row.applicability_source} (${row.source_provenance}` +
      `${row.rests_on ? `: ${row.rests_on}` : ""})   unknown -> ${row.failure_if_unknown}`);
    log(`  clauses ${row.clause_ids.join(", ") || "—"}` +
      `${row.relationship_dependencies.length ? `   rel: ${row.relationship_dependencies.join(", ")}` : ""}`);
    log(`  now ${row.current_finding}   falsification ${row.falsification}`);
  }
}
