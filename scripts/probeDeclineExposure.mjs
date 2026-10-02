/**
 * probeDeclineExposure.mjs — D4.34-A, exposure surface
 *
 * The nine observed occurrences are what the fixture happened to trip. They are
 * not the size of the defect.
 *
 * A family loses a decline at the dependency stage when TWO things hold at once:
 * the target is in the applicability exclusion set, AND some clause that
 * survived selection declares `depends_on` on it. The second is a property of
 * the draft, not of the family, so a family that looks safe today is exposed the
 * moment a carrier clause enters its blueprint.
 *
 * This measures the pairs. It does not repair and does not generate.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument, getAllClauses } from "../backend/services/clauseAssembler.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

/* clause_id -> [clauses that declare depends_on it]. Only depends_on: the
   required_with branch already consults the exclusion set and refuses. */
const structuralCarriers = new Map();
for (const c of getAllClauses()) {
  for (const target of (Array.isArray(c.depends_on) ? c.depends_on : [])) {
    if (!structuralCarriers.has(target)) structuralCarriers.set(target, []);
    structuralCarriers.get(target).push(c.clause_id);
  }
}

const exposed = [];
const clean = [];
const unbuildable = [];

for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  let draft;
  try { draft = assembleDocument(type, variablesFor(type, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED })); }
  catch (e) { unbuildable.push({ type, reason: String(e.message).slice(0, 100) }); continue; }

  const excluded = draft.metadata?.applicability_excluded_clause_ids;
  if (!Array.isArray(excluded)) { unbuildable.push({ type, reason: "no exclusion record" }); continue; }

  const presentIds = new Set(draft.clauses.map((c) => c.clause_id));
  const pairs = [];
  for (const target of excluded) {
    const carriers = (structuralCarriers.get(target) || []).filter((id) => presentIds.has(id));
    if (carriers.length) pairs.push({ excluded_clause: target, carriers_present: carriers });
  }
  if (pairs.length) exposed.push({ type, pairs });
  else clean.push({ type, excluded_count: excluded.length });
}

const report = {
  $probe: "probeDeclineExposure.mjs (D4.34-A)",
  $question: "In how many families does an excluded clause have a structural carrier present, so the dependency stage will re-inject it?",
  $not_a_claim_about: [
    "whether re-injection is WRONG in any given pair — that is the precedence question, still unanswered",
    "the nine occurrences, which are a different count: those are roles the fixture declined and then found in the draft",
  ],
  fixture: "MINIMAL_DECLINED",
  totals: {
    families_measured: exposed.length + clean.length,
    families_exposed: exposed.length,
    families_with_no_exposed_pair: clean.length,
    families_not_measurable: unbuildable.length,
    distinct_excluded_clauses_with_a_present_carrier:
      new Set(exposed.flatMap((e) => e.pairs.map((p) => p.excluded_clause))).size,
  },
  exposed,
  not_measurable: unbuildable,
};
fs.writeFileSync(path.join(ROOT, "docs/audit/decline-exposure.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 2));
for (const e of exposed) console.log(`  ${e.type}: ${e.pairs.map((p) => `${p.excluded_clause} <- ${p.carriers_present.join(",")}`).join(" | ")}`);
