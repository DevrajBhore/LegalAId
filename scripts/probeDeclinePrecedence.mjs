/**
 * probeDeclinePrecedence.mjs — D4.34-A
 *
 * Walks ONE declined protection through every stage of applyGenerationStages in
 * the order documentService runs them, and records at each stage two things
 * that are kept apart on purpose:
 *
 *   knew  — what the decline looks like in the information that stage receives
 *   did   — whether the target clause is present after that stage runs
 *
 * "The stage re-injected the clause" and "the stage could not have known not
 * to" are different findings with different owners, and a probe that reports
 * only presence cannot tell them apart.
 *
 * It changes nothing. It re-runs the existing stages and reads the result.
 */
import { assembleDocument, getAllClauses } from "../backend/services/clauseAssembler.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { resolveDependencies } from "../backend/services/dependencyResolver.js";
import { injectJurisdictionRules } from "../backend/services/jurisdictionEngine.js";
import { injectDoctrine } from "../backend/services/doctrineInjector.js";
import { enforceScopeGuard } from "../backend/services/scopeGuard.js";
import { resolveSignatures } from "../backend/services/signatureResolver.js";
import { applyDocumentHardening } from "../backend/services/documentHardening.js";
import { applyDocumentQualityControls } from "../backend/services/documentQualityControl.js";
import { enhanceCommercially } from "../backend/commercial/commercialEngine.js";
import { lockCriticalClauses } from "../backend/services/clauseLocker.js";
import { normalizeClauseText } from "../backend/services/clauseQualityNormalizer.js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const TARGET = "CORE_DEFINITIONS_001";
const DECLINE_FIELD = "include_nomenclature_clause";
const AFFECTED = ["CONSULTANCY_AGREEMENT", "INDEPENDENT_CONTRACTOR_AGREEMENT", "SOFTWARE_DEVELOPMENT_AGREEMENT"];
const CONTROL = ["SERVICE_AGREEMENT"];

/* The stages, in documentService's order. Named so the report says which one,
   not "somewhere after dependency resolution". */
const STAGES = [
  ["resolveDependencies",         (d, i) => resolveDependencies(d, i)],
  ["injectJurisdictionRules",     (d, i) => injectJurisdictionRules(d, i)],
  ["injectDoctrine",              (d) => injectDoctrine(d)],
  ["enforceScopeGuard",           (d, i) => enforceScopeGuard(d, i)],
  ["resolveSignatures",           (d, i) => resolveSignatures(d, i)],
  ["applyDocumentHardening",      (d, i) => applyDocumentHardening(d, i)],
  ["applyDocumentQualityControls",(d, i) => applyDocumentQualityControls(d, i)],
  ["enhanceCommercially",         (d) => enhanceCommercially(d)],
  ["lockCriticalClauses",         (d) => lockCriticalClauses(d)],
  ["normalizeClauseText",         (d) => normalizeClauseText(d)],
];

function carriersOf(targetId) {
  const out = [];
  for (const c of getAllClauses()) {
    for (const rel of ["depends_on", "required_with"]) {
      if (Array.isArray(c[rel]) && c[rel].includes(targetId)) out.push({ carrier: c.clause_id, relationship: rel });
    }
  }
  return out;
}

/*
 * The SAME fixture the finding came from. An earlier revision of this probe
 * built six variables by hand; that produced a draft in which the structural
 * carriers were not present, so the trace reported a mechanism that was an
 * artifact of the fixture rather than of the pipeline. A trace of a different
 * object is not a trace.
 */
const variablesForType = (type) =>
  variablesFor(type, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });

const present = (d) => Array.isArray(d?.clauses) && d.clauses.some((c) => c.clause_id === TARGET);

function trace(documentType) {
  const variables = variablesForType(documentType);
  if (variables[DECLINE_FIELD] === undefined) return { ...row, skipped: "this family does not expose " + DECLINE_FIELD };
  const input = { variables, document_type: documentType };
  const row = { document_type: documentType };

  let draft;
  try { draft = assembleDocument(documentType, variables); }
  catch (e) { return { ...row, error: String(e.message).slice(0, 200) }; }

  const excluded = new Set(draft.metadata?.applicability_excluded_clause_ids || []);
  row.selection = {
    knew: excluded.has(TARGET)
      ? "the decline is recorded: the target is in applicability_excluded_clause_ids"
      : "no exclusion recorded for the target",
    did: present(draft) ? "PRESENT" : "absent",
  };
  row.carriers_present_at_selection = carriersOf(TARGET)
    .filter((c) => draft.clauses.some((x) => x.clause_id === c.carrier));

  /* The exclusion set travels in metadata, so every stage below can read it.
     Whether a stage DOES read it is the separate question this records. */
  const walk = [];
  let last = present(draft);
  for (const [name, fn] of STAGES) {
    let after;
    try { after = fn(draft, input) || draft; }
    catch (e) { walk.push({ stage: name, error: String(e.message).slice(0, 140) }); break; }
    draft = after;
    const now = present(draft);
    const entry = { stage: name, target_present_after: now };
    if (now !== last) {
      entry.transition = last ? "REMOVED here" : "ADDED here";
      const c = draft.clauses.find((x) => x.clause_id === TARGET);
      if (c) entry.injected_by = c.injected_by || "(not stamped)";
      entry.exclusion_set_reaches_this_stage =
        Array.isArray(draft.metadata?.applicability_excluded_clause_ids);
    }
    walk.push(entry);
    last = now;
  }
  row.stages = walk;
  row.final = last ? "DECLINE LOST" : "decline survived";
  return row;
}

const rows = [...AFFECTED, ...CONTROL].map(trace);
const report = {
  $probe: "probeDeclinePrecedence.mjs (D4.34-A)",
  $what_this_is: "a stage-by-stage trace. Generation is unchanged by this script.",
  target_clause: TARGET,
  decline_field: DECLINE_FIELD,
  structural_carriers_in_library: carriersOf(TARGET),
  rows,
};
const outPath = path.join(ROOT, "docs/audit/decline-precedence.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
for (const r of rows) {
  console.log(`\n${r.document_type}: ${r.final || r.error}`);
  for (const s of r.stages || []) {
    if (s.transition || s.error) console.log(`   ${s.stage}: ${s.transition || s.error}${s.injected_by ? ` [injected_by: ${s.injected_by}]` : ""}`);
  }
}
