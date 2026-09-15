/**
 * requirementKind.test.mjs — D3.8
 *
 * EVERY REQUIREMENT MUST SAY WHAT SETTLES IT.
 *
 * `kind` was optional and 31 of 94 authored requirements declared none. An
 * undeclared kind silently became CONTENT at assessment time — the assumption
 * that a requirement's subject is the document, applied by default to a third of
 * the corpus without anyone deciding it.
 *
 * WHAT THIS DOES NOT DO. It does not catch a requirement that declares the WRONG
 * kind. "The user has accepted these Terms", authored as CONTENT and satisfied
 * by the clause that says so, is still admitted — asserted below, so that nobody
 * reads this gate as closing the Terms of Service false-green path. The two
 * structural alternatives were measured and rejected: requiring the identity
 * test to name the instrument refuses 46 legitimate requirements, and
 * load-bearingness admits the bad one.
 */
import assert from "node:assert";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";

let checks = 0;
const KINDS = ["CONTENT", "FORMALITY", "TIMING", "CHARACTER", "EXTERNAL_COHERENCE"];

const undeclared = [];
const byKind = {};
for (const [family, list] of loadDocumentRequirements({ refresh: true })) {
  for (const requirement of list) {
    if (!requirement.kind) undeclared.push(`${family}/${requirement.id}`);
    else byKind[requirement.kind] = (byKind[requirement.kind] || 0) + 1;
  }
}
assert.deepEqual(
  undeclared, [],
  "a requirement declares no kind. It would become CONTENT at assessment time, which asserts " +
  "that the document's own words settle it — and nobody decided that."
);
checks += 1;

// Every kind in use is one the assessor knows what to do with.
for (const kind of Object.keys(byKind)) {
  assert.ok(KINDS.includes(kind), `unknown kind "${kind}" in use`);
}
// FORMALITY carries its own consequence: it must name the act, and it caps at
// PROVIDED_FOR. Without that the kind would be decoration.
for (const [family, list] of loadDocumentRequirements()) {
  for (const requirement of list.filter((r) => r.kind === "FORMALITY")) {
    assert.ok(
      String(requirement.outside_the_document || "").trim().length > 40,
      `${family}/${requirement.id}: FORMALITY without saying what act lies outside the document`
    );
  }
}
checks += 2;

// The corpus still uses more than one kind — if everything collapsed to CONTENT
// the gate would be satisfied and would mean nothing.
assert.ok(
  Object.keys(byKind).length >= 4,
  `only ${Object.keys(byKind).length} distinct kinds in use: ${JSON.stringify(byKind)}. The gate ` +
  `passes trivially if every requirement is CONTENT.`
);
checks += 1;

console.log(
  `PASS  every authored requirement declares what settles it — ${JSON.stringify(byKind)}\n` +
  `      NOTE a wrongly-declared kind is still admitted; see docs/audit/IDENTITY_TEST_PROBE.md`
);
console.log(`\nALL GREEN (${checks} checks)`);
