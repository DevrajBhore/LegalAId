/**
 * loanApplicability.test.mjs
 *
 * A CLAUSE MUST NOT SHIP IN A STATE ITS OWN DEFINITION CALLS INVALID.
 *
 * Step E of the Loan certification. Both open findings were answered by reading
 * the artifacts rather than by inventing a fixture or an abstraction.
 *
 * ── 1. SARFAESI ────────────────────────────────────────────────────────────
 *
 * LOAN_SARFAESI_ENFORCEMENT_001 declares, in its own knowledge record:
 *
 *     invalid_if: ["Lender is not a SARFAESI-eligible secured creditor",
 *                  "Loan is unsecured"]
 *
 * and its text says the Lender "may, without the intervention of any court or
 * tribunal, take possession of, manage, and transfer the secured assets".
 *
 * The blueprint gates it on `lender_is_regulated == true` ALONE. So an unsecured
 * loan from a scheduled bank ships an enforcement clause over secured assets
 * that do not exist — in exactly the state the clause itself names as invalid.
 *
 * The knowledge base is MORE CORRECT than the gate. That is the useful shape of
 * this finding: nothing needs to be discovered about SARFAESI, and no new
 * mechanism is required. The condition is already authored; the applicability
 * gate does not implement half of it.
 *
 * ── 2. LOAN_DEFAULT_001 -> LOAN_SECURITY_001 ───────────────────────────────
 *
 * The open question was whether the default clause genuinely needs security
 * language, in which case forcing the security clause in would be right and an
 * unsecured variant would be the repair. Its text answers it: of seven limbs,
 * exactly one — (g) "if any security created under this Agreement ceases to be
 * valid, enforceable, or perfected" — mentions security, and it is conditional
 * language that is simply inert where no security was created. Limbs (a)–(f)
 * stand on their own.
 *
 * So `required_with` is an implementation shortcut, not a legal necessity, and
 * the edges are MUTUAL: security requires default, default requires security.
 * The pair cannot be separated by applicability in either direction.
 *
 * NEITHER IS REPAIRED HERE. Both repairs change what ships to a user — one
 * narrows a gate, the other cuts a declared dependency — and both belong to
 * whoever owns the legal knowledge. This file records them precisely enough that
 * the repair can be checked against the evidence rather than re-derived.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";

let checks = 0;
const clauses = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c]));

// ── The clause says when it is invalid ─────────────────────────────────────
const sarfaesi = clauses.LOAN_SARFAESI_ENFORCEMENT_001;
assert.ok(sarfaesi, "LOAN_SARFAESI_ENFORCEMENT_001 has left the library");
assert.ok(
  (sarfaesi.invalid_if || []).some((entry) => /loan is unsecured/i.test(entry)),
  "the clause no longer declares itself invalid on an unsecured loan. If that was removed " +
  "deliberately, this whole finding needs rewriting; if it was removed to make a test pass, it " +
  "is the evidence being deleted rather than the defect."
);
checks += 2;

const ship = async (over) => {
  const base = buildVariables("LOAN_AGREEMENT", "full");
  const variables = { ...base, ...over };
  const derived = deriveControlsForDocument("LOAN_AGREEMENT", variables);
  const out = await generateDocument({
    document_type: "LOAN_AGREEMENT", variables, answers: {},
  });
  assert.ok(out?.draft, "the loan fixture must generate");
  return {
    derived,
    ids: out.draft.clauses.map((c) => c.clause_id),
  };
};

// The counterexample, stated as the state the clause forbids.
const unsecuredBank = await ship({ loan_is_secured: "No", lender_type: "Scheduled Bank" });
assert.strictEqual(unsecuredBank.derived.is_secured, false);
assert.strictEqual(unsecuredBank.derived.lender_is_regulated, true);
assert.ok(
  unsecuredBank.ids.includes("LOAN_SARFAESI_ENFORCEMENT_001"),
  "SARFAESI no longer ships on an unsecured loan — if the gate was narrowed to include " +
  "is_secured, invert this assertion and record which way it was fixed"
);
checks += 3;

// The control: eligibility alone is genuinely required, so a non-bank lender
// must not get it either. Without this, a change that dropped the clause
// entirely would look like a repair.
const unsecuredIndividual = await ship({ loan_is_secured: "No", lender_type: "Private Individual" });
assert.ok(
  !unsecuredIndividual.ids.includes("LOAN_SARFAESI_ENFORCEMENT_001"),
  "SARFAESI ships for a lender that is not a SARFAESI-eligible secured creditor at all"
);
const securedBank = await ship({ loan_is_secured: "Yes", lender_type: "Scheduled Bank" });
assert.ok(
  securedBank.ids.includes("LOAN_SARFAESI_ENFORCEMENT_001"),
  "SARFAESI no longer ships where it genuinely belongs — a secured loan from a scheduled bank"
);
checks += 2;

// ── The dependency is mutual, which is why applicability cannot break it ───
const dflt = clauses.LOAN_DEFAULT_001;
const security = clauses.LOAN_SECURITY_001;
assert.ok(
  (dflt.required_with || []).includes("LOAN_SECURITY_001"),
  "LOAN_DEFAULT_001 no longer requires LOAN_SECURITY_001 — record whether the dependency was " +
  "cut or the resolver taught to yield"
);
assert.ok(
  (security.required_with || []).includes("LOAN_DEFAULT_001"),
  "the reverse edge has gone"
);
// And the evidence for calling it a shortcut: one security limb out of seven.
const securityLimbs = (dflt.text.match(/\([a-g]\)/g) || []).length;
assert.ok(securityLimbs >= 7, `LOAN_DEFAULT_001 now lists ${securityLimbs} limbs, not seven`);
assert.ok(
  /\(g\)\s*if any security created under this Agreement/i.test(dflt.text),
  "limb (g) has changed — re-read the clause before trusting the 'one limb of seven' reasoning"
);
checks += 4;

console.log(
  "PASS  SARFAESI ships in the state its own invalid_if forbids; the default/security " +
  "dependency is mutual"
);
console.log(`\nALL GREEN (${checks} checks)`);
