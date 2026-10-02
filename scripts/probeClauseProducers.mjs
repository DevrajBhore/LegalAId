/**
 * probeClauseProducers.mjs — D4.34-B, step 1
 *
 * WHICH STAGES CAN PUT A CLAUSE INTO A DRAFT.
 *
 * Answered by measurement, not by reading the code: every stage of
 * applyGenerationStages is run in documentService's own order and the clause-id
 * set is diffed across it, for every family in the population. A stage that adds
 * a clause for one family and not another is still a producer, and grep for
 * `clauses.push` finds neither the stages that rebuild the array wholesale nor
 * the ones whose additions are conditional on the document.
 *
 * For every clause a stage adds, it also records whether that clause arrives
 * carrying a stamp saying which stage added it.
 *
 * It changes nothing.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
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

/* stage -> { families, added: Map(clause_id -> {stamped, unstamped}) } */
const producers = new Map();
const removers = new Map();
const note = (map, stage) => {
  if (!map.has(stage)) map.set(stage, { families: new Set(), clauses: new Map() });
  return map.get(stage);
};

let familiesWalked = 0;
const unwalkable = [];

for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const variables = variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED });
  const input = { variables, document_type: type };
  let draft;
  try { draft = assembleDocument(type, variables); }
  catch (e) { unwalkable.push({ type, reason: String(e.message).slice(0, 90) }); continue; }
  familiesWalked += 1;

  /* Selection is itself a producer — the one every clause starts from. */
  const selection = note(producers, "resolveClauseSelection (blueprint)");
  selection.families.add(type);
  for (const c of draft.clauses) {
    const rec = selection.clauses.get(c.clause_id) || { stamped: 0, unstamped: 0 };
    rec[c.injected_by ? "stamped" : "unstamped"] += 1;
    selection.clauses.set(c.clause_id, rec);
  }

  let before = new Set(draft.clauses.map((c) => c.clause_id));
  for (const [name, fn] of STAGES) {
    let after;
    try { after = fn(draft, input) || draft; } catch { break; }
    draft = after;
    const now = new Set((draft.clauses || []).map((c) => c.clause_id));

    const added = [...now].filter((id) => !before.has(id));
    const gone = [...before].filter((id) => !now.has(id));

    if (added.length) {
      const p = note(producers, name);
      p.families.add(type);
      for (const id of added) {
        const clause = draft.clauses.find((c) => c.clause_id === id);
        const rec = p.clauses.get(id) || { stamped: 0, unstamped: 0 };
        rec[clause?.injected_by ? "stamped" : "unstamped"] += 1;
        p.clauses.set(id, rec);
      }
    }
    if (gone.length) {
      const r = note(removers, name);
      r.families.add(type);
      for (const id of gone) r.clauses.set(id, (r.clauses.get(id) || { n: 0 }));
    }
    before = now;
  }
}

const shape = (map) => [...map.entries()].map(([stage, v]) => {
  const stamped = [...v.clauses.values()].reduce((a, r) => a + (r.stamped || 0), 0);
  const unstamped = [...v.clauses.values()].reduce((a, r) => a + (r.unstamped || 0), 0);
  return {
    stage,
    families: v.families.size,
    distinct_clauses: v.clauses.size,
    occurrences_stamped: stamped,
    occurrences_unstamped: unstamped,
    stamps: stamped && !unstamped ? "ALWAYS" : unstamped && !stamped ? "NEVER" : "PARTIAL",
    example_clauses: [...v.clauses.keys()].slice(0, 5),
  };
}).sort((a, b) => b.occurrences_unstamped - a.occurrences_unstamped);

const report = {
  $probe: "probeClauseProducers.mjs (D4.34-B step 1)",
  $method: "every stage run in documentService's order, clause-id set diffed across each, over the whole population",
  $scope_limit: [
    "The DETERMINISTIC path only. documentService can also merge clauses returned by a semantic/AI",
    "generation pass, and no API key is available here, so that path is NOT measured. It must be",
    "assumed to be a producer until measured — it is listed as UNMEASURED rather than omitted, because",
    "a stage left out of this table would look like a stage that cannot add a clause.",
  ],
  fixture: "WELL_FILLED",
  families_walked: familiesWalked,
  families_not_walkable: unwalkable,
  producers: shape(producers),
  producers_unmeasured: [
    { stage: "semantic/AI merge (documentService)", why: "requires a live provider key; both configured providers return 403 here" },
    { stage: "applyDeterministicFixes / issueRepairService", why: "runs only on the validation-failure path, which this walk does not enter" },
  ],
  removers: shape(removers).map((r) => ({ stage: r.stage, families: r.families, distinct_clauses: r.distinct_clauses, example_clauses: r.example_clauses })),
};
fs.writeFileSync(path.join(ROOT, "docs/audit/clause-producers.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`families walked: ${familiesWalked}  (not walkable: ${unwalkable.length})\n`);
console.log("PRODUCERS");
for (const p of report.producers) console.log(`  ${p.stage.padEnd(34)} families=${String(p.families).padStart(2)}  clauses=${String(p.distinct_clauses).padStart(3)}  stamps=${p.stamps}  (stamped ${p.occurrences_stamped} / unstamped ${p.occurrences_unstamped})`);
console.log("\nREMOVERS");
for (const r of report.removers) console.log(`  ${r.stage.padEnd(34)} families=${String(r.families).padStart(2)}  clauses=${r.distinct_clauses}`);
