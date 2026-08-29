import assert from "node:assert";
import { getVariables } from "../backend/config/variableConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { variablesFor } from "../sweep.mjs";

// Answering an OPTIONAL question must never cost a user their document.
//
// Twenty-three of the forty document types used to block when every optional
// field was filled, and the errors were unactionable - "the generated
// risk-allocation clauses do not clearly reflect the supplied liability cap
// structure" tells a user nothing they can do. The causes were all the same
// shape: a question asked of a document that cannot answer it, or a checker
// reading the wrong clause. This test keeps the count from climbing back.

let failures = 0;
async function test(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (error) { failures += 1; console.log(`FAIL  ${name}`); console.log(`      ${error.message}`); }
}

const gen = async (documentType, variables) => {
  const result = await generateDocument({ document_type: documentType, variables });
  return result.error || null;
};

await test("a cap figure alone is honoured, not discarded", async () => {
  const base = variablesFor("SERVICE_AGREEMENT", { requiredOnly: true });
  // No basis selected: typing a figure IS the election of a specific cap.
  assert.strictEqual(await gen("SERVICE_AGREEMENT", { ...base, liability_cap_amount: "500000" }), null);
});

await test("a cap figure that contradicts the basis advises, it does not block", async () => {
  const base = variablesFor("SERVICE_AGREEMENT", { requiredOnly: true });
  const result = await generateDocument({
    document_type: "SERVICE_AGREEMENT",
    variables: { ...base, liability_cap_basis: "Unlimited / uncapped", liability_cap_amount: "500000" },
  });
  assert.strictEqual(result.error || null, null, "a contradiction must not block");
  // Non-blocking notices surface in the score breakdown, which is what the
  // product shows the user, rather than in validation.issues.
  const conflict = (result.validation?.score_breakdown?.deductions || []).find(
    (deduction) => String(deduction.rule_id || deduction).includes("LIABILITY_CAP_ANSWERS_CONFLICT")
  );
  assert.ok(conflict, "the contradiction should be reported");
  assert.strictEqual(conflict.severity, "MEDIUM");
  // The deduction carries the message; the suggestion travels with the issue.
  assert.match(conflict.message, /has not been used/);
});

await test("documents that cannot renew are not asked to", async () => {
  // A promissory note is performed, not extended. A published policy has no term
  // to renew. Asking anyway produced a field the user could fill and be blocked for.
  for (const documentType of [
    "PROMISSORY_NOTE", "SEPARATION_AGREEMENT", "IP_ASSIGNMENT_AGREEMENT",
    "SETTLEMENT_AGREEMENT", "SHARE_SUBSCRIPTION_AGREEMENT",
    "REFUND_AND_CANCELLATION_POLICY", "SHIPPING_AND_DELIVERY_POLICY", "PRIVACY_POLICY",
  ]) {
    const fields = getVariables(documentType);
    assert.ok(!fields.renewal_terms, `${documentType} should not ask for renewal terms`);
    assert.ok(!fields.renewal_option, `${documentType} should not ask for a renewal option`);
  }
  // But a document with an ongoing term still should.
  assert.ok(getVariables("SERVICE_AGREEMENT").renewal_terms, "a service agreement does renew");
});

await test("a published policy is not asked for a counterparty or a dispute forum", async () => {
  for (const documentType of ["PRIVACY_POLICY", "TERMS_OF_SERVICE", "POSH_POLICY"]) {
    const fields = getVariables(documentType);
    for (const field of ["party_2_pan", "party_2_gstin", "party_2_cin", "party_2_llpin", "party_2_type"]) {
      assert.ok(!fields[field], `${documentType} should not ask for ${field}`);
    }
    // A PoSH complaint goes to the Internal Committee under the Act, not to arbitration.
    assert.ok(!fields.dispute_resolution_method, `${documentType} should not ask for a dispute forum`);
  }
});

await test("an ordinary use of the word 'schedule' is not read as a cross-reference", async () => {
  const base = variablesFor("CONSULTANCY_AGREEMENT", { requiredOnly: true });
  const timetable = "Up to sixty hours a month, with the schedule agreed a week in advance.";
  assert.strictEqual(
    await gen("CONSULTANCY_AGREEMENT", { ...base, consultant_availability: timetable }),
    null,
    "a timetable is not a deferral to another document"
  );
  // A genuine deferral is still refused, because it leaves the term uncertain.
  const deferred = "Availability is as set out in Schedule A to this Agreement.";
  const error = await gen("CONSULTANCY_AGREEMENT", { ...base, consultant_availability: deferred });
  assert.ok(error, "a real cross-reference must still be caught");
  assert.match(error, /must not refer to schedules/);
});

await test("the liability checker reads whichever cap clause the document uses", async () => {
  // The validator kept its own list naming CORE_LIABILITY_CAP_001 but not
  // CORE_LIMITATION_LIABILITY_001, so documents assembled with the latter had
  // their liability text read as empty and the user's own cap reported missing.
  const base = variablesFor("SERVICE_AGREEMENT", { requiredOnly: true });
  assert.strictEqual(
    await gen("SERVICE_AGREEMENT", {
      ...base, liability_cap_amount: "500000", indemnity_scope: "Breach of agreement only",
    }),
    null
  );
});

// The ratchet. Lower it as the remaining causes are fixed; never raise it.
await test("no more than seven types block with every optional field filled", async () => {
  const blocked = [];
  for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    let full;
    try { full = variablesFor(documentType, {}); } catch { continue; }
    if (await gen(documentType, full)) blocked.push(documentType);
  }
  console.log(`      ${blocked.length} of ${Object.keys(DOCUMENT_TYPE_REGISTRY).length} block: ${blocked.join(", ")}`);
  assert.ok(
    blocked.length <= 7,
    `full-mode blocks rose to ${blocked.length}, above the pinned ceiling of 7: ${blocked.join(", ")}`
  );
});

console.log(failures === 0 ? "\nALL GREEN" : `\n${failures} FAILED`);
if (failures) process.exit(1);
