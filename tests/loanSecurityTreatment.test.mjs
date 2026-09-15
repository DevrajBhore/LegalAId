/**
 * loanSecurityTreatment.test.mjs — PHASE C4 / C5
 *
 * THE FOUR LOAN STATES, AND WHAT THE INSTRUMENT SAYS IN EACH.
 *
 * Phase B proved generation and assessment consume the same `is_secured`. They
 * did, and the document was wrong anyway: an unsecured loan shipped
 * LOAN_SECURITY_001 and an event of default predicated on "any security created
 * under this Agreement" in an agreement that creates none. Fact parity cannot
 * save a clause whose boundary is wrong — that is the separation this file
 * exists to hold.
 *
 * TWO MECHANISMS WERE WRONG, and they were propping each other up:
 *
 *   1. LOAN_DEFAULT_001 named LOAN_SECURITY_001 in `required_with`, and the
 *      dependency resolver injects a referenced clause without consulting the
 *      gate that excluded it.
 *   2. The events-of-default builder added the security limb when a security
 *      CLAUSE was present — so (1) injected the clause, the clause's presence
 *      satisfied (2), and the limb followed. The document agreed with itself.
 *
 * Removing only the dependency would have left a default clause silent about
 * security on a SECURED loan. Removing only the circular condition would have
 * left the security clause shipping. Both, and the pair is coherent.
 *
 * BOTH DIRECTIONS ARE TESTED. A repair that simply dropped the security
 * treatment everywhere would satisfy every negative assertion here, so each
 * negative has its positive counterpart.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";
import { getClauseById } from "../backend/services/clauseAssembler.js";

let checks = 0;
const COLLATERAL = "A first charge over the Borrower's plant and machinery at the Mumbai facility.";
const SECURITY_LIMB = /security created under or in connection with this Agreement ceasing to be|security created under this Agreement ceases to be/i;

async function loan(answer, collateral, { engineBuilt = true } = {}) {
  const variables = { ...buildVariables("LOAN_AGREEMENT", "full"), loan_is_secured: answer };
  // The fixture answers `events_of_default` in its own words, and a user's own
  // words are rendered verbatim — which is right, and which means the limbs the
  // engine composes are never reached. Removing it exercises the branch under test.
  if (engineBuilt) delete variables.events_of_default;
  if (collateral === null) delete variables.security_collateral;
  else variables.security_collateral = collateral;

  const result = await generateDocument({ document_type: "LOAN_AGREEMENT", variables });
  const clauses = result.draft?.clauses || [];
  const defaultClause = clauses.find((c) => /^LOAN_DEFAULT/.test(c.clause_id));
  return {
    generates: clauses.length > 0,
    ids: clauses.map((c) => c.clause_id),
    securityLimb: SECURITY_LIMB.test(defaultClause?.text || ""),
    fact: (result.canonical_facts || []).find((o) => o.fact === "is_secured"),
    messages: (result.validation?.errors || result.validation?.issues || [])
      .map((e) => e.message || String(e)).join(" | "),
  };
}

// ── C4: the four states ──────────────────────────────────────────────────────
const securedSupplied = await loan("Yes", COLLATERAL);
const securedAbsent = await loan("Yes", null);
const unsecuredAbsent = await loan("No", null);
const unsecuredSupplied = await loan("No", COLLATERAL);

assert.ok(securedSupplied.generates, "secured + collateral must generate");
assert.ok(!securedAbsent.generates, "secured + no collateral must be refused");
assert.ok(unsecuredAbsent.generates, "unsecured + no collateral must generate");
assert.ok(
  !unsecuredSupplied.generates,
  "unsecured + collateral must be refused — the intake says two things about one loan"
);
assert.match(unsecuredSupplied.messages, /answered as unsecured/);
checks += 5;

// ── C5, negative: the unsecured loan says nothing about security ─────────────
assert.strictEqual(unsecuredAbsent.fact.value, false);
assert.ok(
  !unsecuredAbsent.ids.includes("LOAN_SECURITY_001"),
  "an unsecured loan ships a security clause. The dependency resolver injected it: " +
  "LOAN_DEFAULT_001 must not name LOAN_SECURITY_001 in required_with, because a default " +
  "provision does not presuppose collateral."
);
assert.ok(
  !unsecuredAbsent.securityLimb,
  "an unsecured loan's events of default include one predicated on security failing. That " +
  "limb refers to security this Agreement never created, and the clause is unenforceable on " +
  "its own terms."
);
checks += 3;

// ── C5, positive: the secured loan keeps the treatment ───────────────────────
assert.strictEqual(securedSupplied.fact.value, true);
assert.ok(
  securedSupplied.ids.includes("LOAN_SECURITY_001"),
  "a secured loan no longer carries a security clause — the repair removed the treatment " +
  "rather than conditioning it"
);
assert.ok(
  securedSupplied.securityLimb,
  "a secured loan's events of default no longer include the security limb. The lender's " +
  "protection was dropped, not gated."
);
checks += 3;

// ── The circularity is gone: clause presence is not the authority ────────────
// The limb must follow the FACT. If it followed the clause, then injecting a
// security clause by any route would bring the limb with it — which is exactly
// how the two defects propped each other up.
const dependency = getClauseById("LOAN_DEFAULT_001")?.required_with || [];
assert.ok(
  !dependency.includes("LOAN_SECURITY_001"),
  `LOAN_DEFAULT_001.required_with names LOAN_SECURITY_001 again (${dependency.join(", ")}). ` +
  `The dependency resolver does not consult applicability, so this edge alone reinstates the ` +
  `security clause on every unsecured loan.`
);
const acceleration = dependency.includes("LOAN_ACCELERATION_001");
assert.ok(
  acceleration,
  "LOAN_DEFAULT_001 no longer requires LOAN_ACCELERATION_001 — that dependency IS sound " +
  "(a default provision with no consequence is incomplete) and dropping it is over-correction"
);
checks += 2;

// ── The library fallback must not assert security either ─────────────────────
// This clause's shipped text comes from documentHardening, not the library, so
// the library text is a fallback that runs only if the builder is removed. It is
// still a legal instrument and must be correct in the state it defaults to.
assert.ok(
  !SECURITY_LIMB.test(getClauseById("LOAN_DEFAULT_001")?.text || ""),
  "the library text of LOAN_DEFAULT_001 carries the security limb again. If the builder is " +
  "ever removed, every loan — secured or not — would assert security."
);
checks += 1;

console.log(
  "PASS  four loan states; security treatment follows the canonical fact in both directions\n" +
  `      secured: ${securedSupplied.ids.length} clauses, security clause + limb present\n` +
  `      unsecured: ${unsecuredAbsent.ids.length} clauses, neither present`
);
console.log(`\nALL GREEN (${checks} checks)`);
