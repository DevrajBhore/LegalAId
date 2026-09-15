/**
 * declinedProtections.test.mjs — PROTECTION-ROLE CONSERVATION
 *
 * THE INVARIANT ID-BASED CHECKS CANNOT EXPRESS.
 *
 * The obvious form — "a declined clause id must not appear" — is too weak, and
 * the loophole was live. A user declining CORE_FORCE_MAJEURE_001 was handed
 * CORE_FORCE_MAJEURE_FALLBACK_001 instead: a different id, the same substantive
 * protection, every id-for-id assertion satisfied, and the decline defeated.
 *
 * So the invariant is about the ROLE, not the identifier:
 *
 *     A declined protection role must not be satisfied by ANY clause unless an
 *     authored substitution explicitly permits it.
 *
 * Which catches, without enumerating them: fallback clauses, alternate ids,
 * dependency injection, hardening defaults, general-provisions baselines, and
 * whatever the next module to add a clause turns out to be. Six stages could
 * reintroduce an excluded clause; each was found only after the previous repair
 * failed to hold, and a role-level assertion would have caught all six at once.
 *
 * THE PAIRED FIXTURE. MINIMAL_DECLINED declines every optional protection;
 * WELL_FILLED accepts them. Both are needed, and the pairing is the control: a
 * bug that dropped every conditional clause would satisfy every assertion about
 * declines and fail the acceptance half.
 */
import assert from "node:assert";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { PROTECTION_ROLE_CLAUSE_IDS } from "../backend/commercial/protectionLibrary.js";
import { getVariables } from "../backend/config/variableConfig.js";

let checks = 0;

// Which intake question governs which role, and which clause ids can occupy it.
//
// The two commercial protections take their ids from the injector's own routing
// map, so the test cannot drift from the module it is checking. The two general
// provisions are named here with the ids their constraint rules assert, because
// they are not commercial protections and do not belong in that map — but the
// invariant is about roles, and a general provision is a role.
//
// include_force_majeure and include_indemnity_clause are offered on 7 types
// between them; include_entire_agreement and include_nomenclature_clause are
// COMMON, which is what makes this a portfolio-wide assertion rather than a
// handful of observations.
const ROLES = {
  FORCE_MAJEURE: { field: "include_force_majeure", ids: PROTECTION_ROLE_CLAUSE_IDS.FORCE_MAJEURE },
  INDEMNITY: { field: "include_indemnity_clause", ids: PROTECTION_ROLE_CLAUSE_IDS.INDEMNITY },
  ENTIRE_AGREEMENT: { field: "include_entire_agreement", ids: ["CORE_ENTIRE_AGREEMENT_001"] },
  NOMENCLATURE: { field: "include_nomenclature_clause", ids: ["CORE_DEFINITIONS_001"] },
};

async function draftFor(documentType, profile) {
  const variables = variablesFor(documentType, { profile });
  const result = await generateDocument({ document_type: documentType, variables });
  return {
    variables,
    ids: new Set((result.draft?.clauses || []).map((c) => c.clause_id)),
    generated: Boolean((result.draft?.clauses || []).length),
    declinedDefaults: result.validation?.coverage?.declined_defaults || [],
  };
}

const declined = [];
const accepted = [];
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const schema = getVariables(documentType) || {};
  const roles = Object.entries(ROLES).filter(([, spec]) => spec.field in schema);
  if (!roles.length) continue;

  const minimal = await draftFor(documentType, FIXTURE_PROFILE.MINIMAL_DECLINED);
  const well = await draftFor(documentType, FIXTURE_PROFILE.WELL_FILLED);
  if (!minimal.generated || !well.generated) continue;

  for (const [role, spec] of roles) {
    const { field, ids: roleIds } = spec;
    assert.ok(roleIds?.length, `${role} has no clause ids mapped to it`);
    const occupiedIn = (side) => roleIds.filter((id) => side.ids.has(id));

    // Only where the fixture actually declined and actually accepted — a role
    // the intake never offered proves nothing either way.
    if (String(minimal.variables[field]).toLowerCase() === "no") {
      declined.push({ documentType, role, field, occupied: occupiedIn(minimal) });
    }
    if (String(well.variables[field]).toLowerCase() === "yes") {
      accepted.push({ documentType, role, field, occupied: occupiedIn(well) });
    }
  }
}

assert.ok(
  declined.length >= 10 && accepted.length >= 10,
  `only ${declined.length} declined / ${accepted.length} accepted observations — too few to be evidence`
);
checks += 1;

// A KNOWLEDGE QUESTION, not a reintroduction. Pinned by name so it cannot grow
// and cannot be forgotten.
//
// The MOU blueprint lists CORE_FORCE_MAJEURE_001 in `required_clauses` with no
// gate at all, while the intake offers include_force_majeure on that family. So
// the clause is not being REINTRODUCED after exclusion — it was never excluded,
// because the blueprint states that an MOU requires it.
//
// Two authored artifacts disagree: one says required, the other offers a choice.
// That is invariant 23's shape — a question that changes nothing — and settling
// it means deciding whether force majeure is mandatory in a memorandum of
// understanding. A legal question, left to the advocate rather than answered by
// deleting whichever artifact is inconvenient.
const KNOWN_UNGATED = new Set(["MOU/FORCE_MAJEURE"]);

// 1. NEGATIVE — a declined role is occupied by nothing at all.
const defeated = declined
  .filter((d) => d.occupied.length)
  .filter((d) => !KNOWN_UNGATED.has(`${d.documentType}/${d.role}`));
assert.deepEqual(
  defeated.map((d) => `${d.documentType}/${d.role} still carries ${d.occupied.join(", ")}`), [],
  "a protection the user declined is present under some clause id. If the clause that appeared " +
  "is not the one they declined, that is the point of this test: the role is what they " +
  "declined, not the identifier."
);
checks += 1;

// The pinned exception must still BE one. If MOU stops shipping the clause the
// list is stale and should shrink; if something else joins it, that is a new
// defect wearing the exception's coat.
const stillUngated = declined
  .filter((d) => d.occupied.length)
  .map((d) => `${d.documentType}/${d.role}`);
assert.deepEqual(
  stillUngated, [...KNOWN_UNGATED],
  "the pinned ungated-role list no longer matches what is observed. Shrink it if a family was " +
  "repaired; investigate before growing it."
);
checks += 1;

// 2. POSITIVE — accepting it produces one. Without this, a bug that stripped
//    every optional clause would pass assertion 1 perfectly.
const missing = accepted.filter((a) => !a.occupied.length);
assert.deepEqual(
  missing.map((a) => `${a.documentType}/${a.role}`), [],
  "a protection the user ASKED FOR is absent. Assertion 1 would be satisfied by a bug that " +
  "dropped every optional clause; this is what makes it meaningful."
);
checks += 1;

// 3. Declining is reported as a CHOICE, not as a defect. The general-provisions
//    rules are a default set — `defaults.hardening`, severity MEDIUM, worded
//    "should", and described in the intake as optional protection — so a user
//    exercising the option must not read as a violation.
const sample = await draftFor("SERVICE_AGREEMENT", FIXTURE_PROFILE.MINIMAL_DECLINED);
const declinedOutcomes = sample.declinedDefaults;
assert.ok(
  declinedOutcomes.length > 0,
  "no constraint reported a `declined` outcome on a fixture that declines every optional " +
  "protection. Either coverage.declined_defaults is not reaching the validation result, or the " +
  "declines are not being honoured at all."
);
for (const outcome of declinedOutcomes) {
  assert.ok(
    Array.isArray(outcome.clause_ids) && outcome.clause_ids.length,
    `${outcome.rule_id}: reported declined without naming what was declined`
  );
}
checks += 2;

console.log(
  `PASS  ${declined.length} declined protection roles are occupied by nothing; ` +
  `${accepted.length} accepted roles are occupied\n` +
  `      ${declinedOutcomes.length} constraint(s) report \`declined\` rather than a violation`
);
console.log(`\nALL GREEN (${checks} checks)`);
