/**
 * satisfactionContract.test.mjs — D4.38
 *
 * PINS A REQUIREMENTS RECORD TO THE ARTIFACTS IT WAS DERIVED FROM.
 *
 * D4.38 states what a satisfaction relation must be able to express, using only
 * cases that already exist in this repository. A requirements document whose
 * examples have drifted is worse than none: it argues for expressive power the
 * system may no longer need, and it reads as authoritative while doing it.
 *
 * So this file checks the CASES, not the prose. Every named artifact must still
 * exist and still have the property that put it in the list.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getClauseById, getBlueprintForDocumentType, preloadKnowledgeBase } from "../backend/services/clauseAssembler.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

preloadKnowledgeBase({});
const R = JSON.parse(fs.readFileSync(
  path.join(ROOT, "knowledge-base/governance/satisfaction-contract.json"), "utf8"));
const CASES = new Map(R.the_cases_the_contract_must_handle.cases.map((c) => [c.id, c]));
const VOCAB = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/propositions/propositions.json"), "utf8"));

const RULES = new Map();
for (const f of fs.readdirSync(path.join(ROOT, "knowledge-base/constraints"))) {
  if (!f.endsWith(".json")) continue;
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base/constraints", f), "utf8"));
  for (const r of (body.rules || body.constraints || [])) if (r?.rule_id) RULES.set(r.rule_id, r);
}

check("all eight cases are still stated", () => {
  const want = ["A_SINGLE_CLAUSE", "B_JOINT_SATISFACTION", "C_FAMILY_SPECIALISED_CLAUSE", "D_MUST_NOT_ESTABLISH",
    "E_CONTEXT_DEPENDENT", "F_OPPOSITE_OUTCOMES_BOTH_SATISFY", "G_NEGATIVE_EVIDENCE", "H_OUTSIDE_THE_DOCUMENT"];
  assert.deepStrictEqual([...CASES.keys()], want,
    "the case list changed. If a case was dropped, the requirement it justified is now unsupported; if one was added, say which artifact it came from.");
});

check("case B — the IP grant is still split across right-type clauses", () => {
  /* Joint satisfaction is required because no single clause carries the grant. */
  const bp = getBlueprintForDocumentType("IP_ASSIGNMENT_AGREEMENT");
  const conditional = (bp?.conditional_clauses || []).map((e) => e.clause);
  for (const id of ["IPA_COPYRIGHT_ASSIGNMENT_001", "IP_PATENT_RIGHTS_001", "IPA_TRADEMARK_ASSIGNMENT_001"]) {
    assert.ok(conditional.includes(id),
      `${id} is no longer a conditional clause of the IP assignment blueprint. If the grant was consolidated ` +
      `into one clause, case B has lost its evidence and joint satisfaction may no longer be required.`);
  }
});

check("case D — a term clause still discharges the payment rule, and still says nothing about payment", () => {
  /*
   * This assertion's first version cited CORE_IDENTITY_001 against the
   * consideration rule and FAILED on its first run: that clause carries a full
   * consideration recital which the measuring probe had truncated away. Ten
   * reported findings dissolved. The case now rests on a 144-character clause
   * read in its entirety, and the second half of this check is what makes the
   * example safe rather than merely plausible.
   */
  const rule = RULES.get("SERVICE_REQUIRES_PAYMENT");
  assert.ok(rule?.fails_if?.includes("CORE_TERM_001"),
    "SERVICE_REQUIRES_PAYMENT no longer accepts CORE_TERM_001. That is the repair D4.37 refused to make " +
    "unilaterally — if it was made, the legal authority belongs in the record, and case D needs a new example.");
  const text = String(getClauseById("CORE_TERM_001")?.text || "");
  assert.ok(text, "CORE_TERM_001 no longer exists.");
  assert.ok(!/\bpay(ment|able)?\b|\bfee\b|\bconsideration\b|\binvoice\b/i.test(text),
    "CORE_TERM_001 now speaks to payment. The case rested on its FULL text saying nothing about what is paid; " +
    "re-read the whole clause before relying on case D.");
});

check("case E — a satisfier whose substance is still a template variable", () => {
  /*
   * The strongest argument for context-dependent satisfaction: a clause that
   * defers its own content to a variable currently satisfies a rule about that
   * content by being present.
   */
  const clause = getClauseById("CORE_PURPOSE_001");
  assert.ok(clause, "CORE_PURPOSE_001 no longer exists.");
  assert.match(String(clause.text || ""), /\{\{\s*purpose\s*\}\}/,
    "CORE_PURPOSE_001 no longer defers its substance to a template variable. If it was rewritten with real " +
    "content, case E has lost its evidence and the context requirement needs a different one.");
  assert.ok(RULES.get("SERVICE_REQUIRES_SCOPE")?.fails_if?.includes("CORE_PURPOSE_001"),
    "SERVICE_REQUIRES_SCOPE no longer accepts CORE_PURPOSE_001, so the case no longer demonstrates presence " +
    "standing in for content.");
});

check("case F — opposite allocations still both satisfy one proposition", () => {
  /*
   * The case most likely to be broken by a repair aimed at D and E. If a future
   * design requires a clause to 'assert the proposition', this breaks: the
   * proposition is that ownership be SPECIFIED, not that it vest in anyone.
   */
  const rule = RULES.get("IP_REQUIRES_OWNERSHIP");
  assert.ok(rule, "IP_REQUIRES_OWNERSHIP no longer exists.");
  for (const id of ["IP_OWNERSHIP_001", "IP_DEVELOPER_RETAINS_001"]) {
    assert.ok(rule.fails_if.includes(id), `${id} is no longer a satisfier of IP_REQUIRES_OWNERSHIP.`);
  }
  const a = String(getClauseById("IP_OWNERSHIP_001")?.text || "");
  const b = String(getClauseById("IP_DEVELOPER_RETAINS_001")?.text || "");
  assert.ok(a && b && a !== b,
    "the two ownership clauses no longer differ, so they no longer demonstrate opposite allocations satisfying one proposition.");
});

check("case G — the negative-evidence clause still says what it said", () => {
  const clause = getClauseById("IPA_MORAL_RIGHTS_001");
  assert.ok(clause, "IPA_MORAL_RIGHTS_001 no longer exists.");
  assert.match(String(clause.text || ""), /57/,
    "IPA_MORAL_RIGHTS_001 no longer cites section 57. The case rested on it recording rights that are NOT " +
    "assigned, which is why it was the wrong evidence for an assignment.");
});

check("case H — satisfaction outside the document is still expressible", () => {
  const outside = VOCAB.propositions.filter((p) => p.satisfaction === "OUTSIDE_THE_DOCUMENT");
  assert.ok(outside.length >= 1,
    "no proposition declares OUTSIDE_THE_DOCUMENT any more. A contract that can only speak about clauses " +
    "cannot represent a requirement discharged by registration, filing or conduct.");
});

/* ── The record must stay requirements, not become a design ───────────────── */

check("no schema was proposed", () => {
  /*
   * Scope assertion, and the one most likely to erode. The moment this record
   * names fields, the representation becomes the argument and the requirements
   * stop being reviewable on their own terms.
   */
  assert.ok(/no schema proposed/i.test(String(R.status || "")),
    "the record's status no longer says no schema was proposed.");
  const joined = JSON.stringify(R.what_this_record_does_not_do || []);
  assert.ok(/no schema, no field names/i.test(joined),
    "the record no longer disclaims proposing a schema, field names or an encoding.");
});

check("the engine/legal split is intact in both directions", () => {
  /*
   * Listing only what the engine CAN do would read as a feature list. The
   * prohibitions are the half that carries the design.
   */
  const s = R.what_the_engine_can_decide_and_what_it_cannot;
  assert.ok((s?.the_engine_can_decide || []).length >= 4, "the engine-decidable list was truncated.");
  assert.ok((s?.the_engine_must_not_decide || []).length >= 4,
    "the must-not-decide list was truncated. Every failure in D4.35 and D4.37 came from a mechanism deciding " +
    "something only a lawyer can decide; that half is the design.");
});

check("the five guardrails are kept", () => {
  const f = R.what_the_contract_must_forbid?.forbidden || [];
  assert.ok(f.length >= 5, `only ${f.length} prohibitions remain; each records a failure this investigation observed.`);
  const joined = JSON.stringify(f).toLowerCase();
  assert.ok(/must never read as|does not satisfy/.test(joined), "the 'missing declaration is not a denial' guardrail was dropped.");
  assert.ok(/second enumeration|relocation/.test(joined), "the 'not a second enumeration, merely distributed' guardrail was dropped.");
});

check("the five prerequisites each still cite a case", () => {
  const p = R.the_five_prerequisites_restated_against_the_cases || [];
  assert.strictEqual(p.length, 5, `${p.length} prerequisites recorded, expected 5.`);
  for (const item of p) {
    assert.ok(item.case && item.status,
      `prerequisite "${item.prerequisite}" no longer names the case that justifies it or its current status. ` +
      `A prerequisite with no case behind it is an assumption.`);
  }
});

console.log(`\n${checks} checks passed`);
