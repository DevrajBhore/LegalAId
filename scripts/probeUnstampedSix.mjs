/**
 * probeUnstampedSix.mjs — D4.34-B, step 2
 *
 * D4.34 recorded six declined-yet-present clauses whose origin "this probe
 * cannot say", because they carry no injected_by and two paths could have
 * produced them.
 *
 * That was true of THAT probe, which read the finished draft. It is not true in
 * general: a differential walk observes which stage the clause appears at, and
 * needs no cooperation from the artifact.
 *
 * The distinction matters and is not a quibble. This resolves the ATTRIBUTION
 * for the investigation. It does NOT close the provenance gap, because the
 * shipped document still cannot state its own origin, and a differential walk is
 * not available to anyone reading a draft in production.
 */
import { assembleDocument } from "../backend/services/clauseAssembler.js";
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
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const CASES = [
  { family: "FOUNDERS_AGREEMENT",           clause: "CORE_ENTIRE_AGREEMENT_001" },
  { family: "TERM_SHEET",                   clause: "CORE_ENTIRE_AGREEMENT_001" },
  { family: "SHARE_SUBSCRIPTION_AGREEMENT", clause: "CORE_ENTIRE_AGREEMENT_001" },
  { family: "DATA_PROCESSING_AGREEMENT",    clause: "CORE_ENTIRE_AGREEMENT_001" },
  { family: "SETTLEMENT_AGREEMENT",         clause: "CORE_ENTIRE_AGREEMENT_001" },
  { family: "MOU",                          clause: "CORE_FORCE_MAJEURE_001" },
];

const STAGES = [
  ["resolveDependencies",          (d, i) => resolveDependencies(d, i)],
  ["injectJurisdictionRules",      (d, i) => injectJurisdictionRules(d, i)],
  ["injectDoctrine",               (d) => injectDoctrine(d)],
  ["enforceScopeGuard",            (d, i) => enforceScopeGuard(d, i)],
  ["resolveSignatures",            (d, i) => resolveSignatures(d, i)],
  ["applyDocumentHardening",       (d, i) => applyDocumentHardening(d, i)],
  ["applyDocumentQualityControls", (d, i) => applyDocumentQualityControls(d, i)],
  ["enhanceCommercially",          (d) => enhanceCommercially(d)],
  ["lockCriticalClauses",          (d) => lockCriticalClauses(d)],
  ["normalizeClauseText",          (d) => normalizeClauseText(d)],
];

const rows = CASES.map(({ family, clause }) => {
  const variables = variablesFor(family, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
  const input = { variables, document_type: family };
  let draft;
  try { draft = assembleDocument(family, variables); }
  catch (e) { return { family, clause, error: String(e.message).slice(0, 120) }; }

  const row = {
    family, clause,
    blueprint_declares_it_required: (draft.clauses || []).some((c) => c.clause_id === clause),
    recorded_as_excluded: (draft.metadata?.applicability_excluded_clause_ids || []).includes(clause),
  };

  if (row.blueprint_declares_it_required) {
    row.produced_by = "resolveClauseSelection (blueprint)";
    row.stamped = false;
    row.$reading = "present straight out of selection — the blueprint names it, so no later stage needed to add it";
    return row;
  }

  let present = false;
  for (const [name, fn] of STAGES) {
    try { draft = fn(draft, input) || draft; } catch (e) { row.stage_error = `${name}: ${String(e.message).slice(0, 80)}`; break; }
    const now = (draft.clauses || []).some((c) => c.clause_id === clause);
    if (now && !present) {
      const c = draft.clauses.find((x) => x.clause_id === clause);
      row.produced_by = name;
      row.stamped = Boolean(c?.injected_by);
      row.stamp = c?.injected_by || null;
      break;
    }
    present = now;
  }
  if (!row.produced_by) row.produced_by = "(never appeared in this walk)";
  return row;
});

const byStage = {};
for (const r of rows) byStage[r.produced_by] = (byStage[r.produced_by] || 0) + 1;

const report = {
  $probe: "probeUnstampedSix.mjs (D4.34-B step 2)",
  $what_changed_since_D4_34: "D4.34 read the finished draft and could not attribute these six. A differential walk attributes them without the artifact's cooperation.",
  $what_did_not_change: "The shipped document still cannot state its own origin. Attribution for the investigation is not provenance for the product.",
  fixture: "MINIMAL_DECLINED",
  rows,
  attributed_to: byStage,
};
fs.writeFileSync(path.join(ROOT, "docs/audit/unstamped-six.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const r of rows) console.log(`${r.family.padEnd(32)} ${r.clause.padEnd(28)} <- ${r.produced_by}${r.stamped ? ` [${r.stamp}]` : " (unstamped)"}${r.error ? " ERROR " + r.error : ""}`);
console.log("\n" + JSON.stringify(byStage, null, 2));
