/**
 * probeUngatedDeclines.mjs — D4.34-B, step 3
 *
 * WHERE THE NEGATIVE DECISION IS LOST, for the five ENTIRE_AGREEMENT families.
 *
 * It is not lost at hardening. Hardening consults the exclusion set and its own
 * comment states the right principle: the gate was evaluated against this user's
 * answers and the baseline was not, so the gate wins.
 *
 * It is lost earlier, and not because selection is broken:
 *
 *   applicability_excluded_clause_ids can only record a decline the BLUEPRINT
 *   ASKED ABOUT. It is built from conditional entries whose include_if evaluated
 *   false. A protection the intake offers but no blueprint gates produces an
 *   answer that no downstream stage can see, because there is nothing to record.
 *
 * So the exclusion record is keyed to the blueprint's questions, not to the
 * user's answers. This measures how many (family, protection) pairs sit in that
 * blind spot.
 *
 * It changes nothing.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { assembleDocument, getBlueprintForDocumentType } from "../backend/services/clauseAssembler.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { PROTECTION_ROLE_CLAUSE_IDS } from "../backend/commercial/protectionLibrary.js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const ROLES = {
  FORCE_MAJEURE:    { field: "include_force_majeure",          ids: PROTECTION_ROLE_CLAUSE_IDS.FORCE_MAJEURE },
  INDEMNITY:        { field: "include_indemnity_clause",       ids: PROTECTION_ROLE_CLAUSE_IDS.INDEMNITY },
  ENTIRE_AGREEMENT: { field: "include_entire_agreement",       ids: ["CORE_ENTIRE_AGREEMENT_001"] },
  NOMENCLATURE:     { field: "include_nomenclature_clause",    ids: ["CORE_DEFINITIONS_001"] },
};

const ASKED_AND_GATED = [];
const ASKED_BUT_UNGATED = [];
const NOT_ASKED = [];

for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const schema = getVariables(type) || {};
  let bp, draft, variables;
  try {
    variables = variablesFor(type, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
    draft = assembleDocument(type, variables);
    bp = getBlueprintForDocumentType(type);
  } catch { continue; }

  const conditionalTargets = new Set((bp?.conditional_clauses || []).map((e) => e.clause));
  const excluded = new Set(draft.metadata?.applicability_excluded_clause_ids || []);

  for (const [role, spec] of Object.entries(ROLES)) {
    if (!(spec.field in schema)) { NOT_ASKED.push({ type, role }); continue; }

    /* The intake asks. Does any blueprint gate stand behind the answer? */
    const gated = spec.ids.filter((id) => conditionalTargets.has(id));
    const recorded = spec.ids.filter((id) => excluded.has(id));
    const answer = variables[spec.field];

    const row = { type, role, field: spec.field, answered: answer,
      clause_ids: spec.ids, gated_ids: gated, recorded_as_excluded: recorded };

    if (gated.length) ASKED_AND_GATED.push(row);
    else ASKED_BUT_UNGATED.push(row);
  }
}

/* The blind spot: the intake asked, the user declined, and no gate exists to
   turn that into anything a later stage can read. */
const blindSpot = ASKED_BUT_UNGATED.filter((r) => /^no$/i.test(String(r.answered || "")));

const report = {
  $probe: "probeUngatedDeclines.mjs (D4.34-B step 3)",
  $finding: "applicability_excluded_clause_ids is keyed to the blueprint's questions, not to the user's answers. A protection the intake offers but no blueprint gates produces an answer no downstream stage can see.",
  $not_a_claim: [
    "NOT a claim that the clause should be absent in these cases. Whether a declined protection should be honoured is the precedence question of D4.34-A, still unanswered.",
    "NOT a claim that every ungated pair is a defect. A protection the intake asks about for one family may be legitimately unconditional in another.",
  ],
  fixture: "MINIMAL_DECLINED",
  totals: {
    pairs_where_intake_asks: ASKED_AND_GATED.length + ASKED_BUT_UNGATED.length,
    asked_and_gated: ASKED_AND_GATED.length,
    asked_but_ungated: ASKED_BUT_UNGATED.length,
    ungated_AND_declined_by_the_user: blindSpot.length,
    families_in_the_blind_spot: new Set(blindSpot.map((r) => r.type)).size,
    roles_in_the_blind_spot: [...new Set(blindSpot.map((r) => r.role))],
  },
  blind_spot: blindSpot,
  asked_and_gated: ASKED_AND_GATED,
};
fs.writeFileSync(path.join(ROOT, "docs/audit/ungated-declines.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.totals, null, 2));
for (const r of blindSpot) console.log(`  ${r.type.padEnd(32)} ${r.role.padEnd(18)} ${r.field}=${r.answered}  (no gate for ${r.clause_ids.join(",")})`);
