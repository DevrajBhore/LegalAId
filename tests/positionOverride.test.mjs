/**
 * positionOverride.test.mjs
 *
 * A CLAUSE DEPENDENCY MUST NOT REINSTATE WHAT A DECLARED POSITION EXCLUDED.
 *
 * Found while certifying the Loan family, immediately after making `is_secured`
 * a declared answer rather than a guess at a text box. The assembler then did
 * the right thing — answer "No" and the security clause is not selected — and
 * the document still shipped one:
 *
 *     LOAN_DEFAULT_001.required_with = [..., "LOAN_SECURITY_001"]
 *         -> dependencyResolver re-injects it after the gate excluded it
 *
 * So there are two paths to a clause and the user's position governs only one.
 * A clause-level assertion that a default provision "needs" a security provision
 * silently outranks a borrower saying the loan is unsecured.
 *
 * This is the chain being bypassed:
 *     position -> treatment -> clause      is what the architecture promises
 *     clause   -> clause                   is what happens here
 *
 * WHAT THIS FILE DOES NOT DECIDE. Whether the dependency or the position should
 * win is a real question with two defensible answers. LOAN_DEFAULT_001 may well
 * refer to security in its text, in which case forcing the security clause in is
 * the wrong repair and the right one is an unsecured variant of the default
 * clause. Nothing here chooses; it records which gates are actually overridden
 * at runtime, by name, so the choice is made deliberately.
 *
 * A STATIC READING OF required_with FOUND EIGHT. Runtime found two. The other
 * six were clauses listed as conditional AND unconditional in the same blueprint
 * — the gate never mattered — or dependencies that do not fire. Static edges are
 * potential overrides, not actual ones, and reporting eight would have been the
 * same overcount as counting one boilerplate clause twenty-four times.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";

let checks = 0;

// Gates a declared "No" does not close, verified by generating the document.
const OVERRIDDEN = [
  ["LOAN_AGREEMENT", "LOAN_SECURITY_001", "loan_is_secured"],
  ["SOFTWARE_DEVELOPMENT_AGREEMENT", "CORE_INDEMNITY_001", "include_indemnity_clause"],
];
// Gates that do close, kept as the control: without them a bug that omitted
// every conditional clause would satisfy the assertions above.
const RESPECTED = [
  ["EMPLOYMENT_CONTRACT", "EMP_NON_COMPETE_001", "include_non_compete"],
  ["FOUNDERS_AGREEMENT", "CORP_DRAG_ALONG_001", "include_drag_along"],
];

const shipped = async (documentType, flag, clauseId) => {
  const base = buildVariables(documentType, "full");
  const out = await generateDocument({
    document_type: documentType, variables: { ...base, [flag]: "No" }, answers: {},
  });
  assert.ok(out?.draft, `${documentType}: fixture must generate`);
  return out.draft.clauses.find((c) => c.clause_id === clauseId) || null;
};

for (const [documentType, clauseId, flag] of OVERRIDDEN) {
  const clause = await shipped(documentType, flag, clauseId);
  assert.ok(
    clause,
    `${documentType}: ${clauseId} is no longer reinstated after "${flag}: No". If the dependency ` +
    `now yields to the position, move this entry to RESPECTED and say which way the conflict was ` +
    `resolved — by the resolver deferring, or by the depending clause gaining a variant that ` +
    `does not need it.`
  );
  assert.strictEqual(
    clause.injected_by, "dependencyResolver",
    `${documentType}: ${clauseId} still ships against the position but by a different route ` +
    `(${clause.injected_by || "the gate itself"}). That is a different defect and needs its own ` +
    `record.`
  );
  checks += 2;
}

for (const [documentType, clauseId, flag] of RESPECTED) {
  const clause = await shipped(documentType, flag, clauseId);
  assert.strictEqual(
    clause, null,
    `${documentType}: ${clauseId} now ships despite "${flag}: No". A gate that used to hold has ` +
    `stopped holding.`
  );
  checks += 1;
}

console.log(
  `PASS  ${OVERRIDDEN.length} declared positions are overridden by a clause dependency; ` +
  `${RESPECTED.length} are respected`
);
console.log(`\nALL GREEN (${checks} checks)`);
