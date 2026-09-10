/**
 * factQuestions.test.mjs
 *
 * Phase 4. Two boundaries, both of which the clause checklist crosses and this
 * interview must not.
 *
 *   1. NO QUESTION NAMES A MECHANISM. "Do you want an indemnity?" is the
 *      checklist in better clothes. A user should not have to know what the
 *      protection they want is called in order to ask for it.
 *
 *   2. NO FACT SELECTS A CLAUSE. A fact option establishes a fact; the
 *      treatments table turns facts into positions. The interview stays strictly
 *      upstream of clause selection, which the deterministic engine owns.
 *
 * And the measure that matters: mechanisms resolved per question asked. Seven
 * flags becoming seven questions would be a failure dressed as full coverage.
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { planGapQuestions } from "../backend/services/factQuestionPlanner.js";

const registry = JSON.parse(
  fs.readFileSync(path.resolve("knowledge-base/intake/legal_facts.json"), "utf8")
);
let checks = 0;

// ── 1. The mechanism lexicon ────────────────────────────────────────────────
// Terms of art for contractual machinery. A question containing one of these is
// asking about the mechanism instead of the circumstance behind it.
const MECHANISM_TERMS = [
  "indemnity", "indemnify", "indemnification", "hold harmless",
  "non-compete", "noncompete", "restraint of trade", "non-solicit", "nonsolicit",
  "assignment of", "ip assignment", "licence grant", "license grant",
  "service level", "sla", "warranty", "warrant", "covenant", "undertaking",
  "clause", "provision", "arbitration", "liability cap", "limitation of liability",
  "force majeure", "entire agreement", "severability", "governing law",
  "confidentiality clause", "nda", "data processing agreement", "dpa",
  "transition assistance", "price revision", "exclusivity", "termination clause",
  "acceptance clause", "change control", "retainer",
];
// Matched on word boundaries, not as substrings. A plain `includes` reports
// "standards" as containing "nda" -- the same defect as the money regex that
// once read `parent_name` as a rent field and filled a deponent's parent with
// Rs. 5,00,000.
const termPattern = (term) =>
  new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
for (const fact of registry.facts) {
  const text = String(fact.question);
  const found = MECHANISM_TERMS.filter((term) => termPattern(term).test(text));
  assert.deepStrictEqual(found, [],
    `Fact ${fact.id} asks about a mechanism, not a circumstance. Its question contains ` +
    `${found.map((f) => `"${f}"`).join(", ")}:\n    "${fact.question}"\n  ` +
    `Rewrite it as the underlying fact and let the treatments table derive the mechanism.`);
  checks += 1;
}
console.log(`PASS  no question names a contractual mechanism (${registry.facts.length} facts)`);

// ── 2. The fact / treatment boundary ────────────────────────────────────────
for (const fact of registry.facts) {
  for (const option of fact.options || []) {
    const leaked = Object.keys(option.establishes || {}).filter((k) =>
      /^(include_|is_|involves_|requires_|processes_)/.test(k) && k !== "processes_personal_data"
        ? /^include_/.test(k)
        : false
    );
    assert.deepStrictEqual(leaked, [],
      `Fact ${fact.id} writes ${leaked.join(", ")} directly. A fact establishes a fact; ` +
      `only the treatments table may take a position on a mechanism.`);
    assert.ok(Object.keys(option.establishes || {}).length,
      `Fact ${fact.id} has an option that establishes nothing: "${option.label}"`);
    checks += 2;
  }
}
console.log("PASS  facts establish facts; only treatments name mechanisms");

// ── 3. Every fact a treatment depends on is actually askable ────────────────
const establishable = new Set(
  registry.facts.flatMap((f) => (f.options || []).flatMap((o) => Object.keys(o.establishes || {})))
);
const orphanTreatments = registry.treatments
  .filter((t) => !establishable.has(t.fact))
  .map((t) => t.fact);
assert.deepStrictEqual([...new Set(orphanTreatments)], [],
  `These treatments depend on facts no question establishes, so they can never fire: ` +
  `${[...new Set(orphanTreatments)].join(", ")}`);
checks += 1;

// ── 4. Every treatment states its legal basis ───────────────────────────────
for (const t of registry.treatments) {
  assert.ok(String(t.basis || "").trim().length > 20,
    `Treatment ${t.fact}=${t.value} has no stated basis. An advocate must be able to ` +
    `see why this answer changes this mechanism.`);
  checks += 1;
}
// ── 5. Every question states the uncertainty it resolves ────────────────────
for (const fact of registry.facts) {
  assert.ok(String(fact.why || "").trim().length > 40,
    `Fact ${fact.id} does not say what uncertainty it resolves. If nobody can name ` +
    `the legal treatment that changes because of the answer, do not ask it.`);
  checks += 1;
}
console.log("PASS  every question states its uncertainty; every treatment states its basis");

// ── 6. The interview collapses, and drops nothing ───────────────────────────
const CASES = [
  ["CONSULTANCY_AGREEMENT", {
    party_1_name: "Devraj Vishal Bhore", party_2_name: "Varun Raghunath Shastri",
    consulting_fee: "30000", contract_duration: "12 months",
    services_description: "Strategic advisory covering market entry.",
  }],
  ["VENDOR_AGREEMENT", {
    party_1_name: "Ashwin Traders Private Limited", party_2_name: "Kesari Components LLP",
    goods_description: "Precision-machined brass fittings.", contract_value: "4500000",
  }],
];
for (const [documentType, variables] of CASES) {
  const plan = planGapQuestions({ documentType, variables });
  const opening = plan.questions.filter((q) => q.stage === "opening");

  assert.deepStrictEqual(plan.unserved, [],
    `${documentType}: these mechanisms would be asked about but no fact question can ` +
    `resolve them: ${plan.unserved.join(", ")}. Either add the fact or let them default.`);

  const covered = new Set([
    ...plan.questions.flatMap((q) => q.resolves),
    ...plan.settled.map((s) => s.mechanism),
  ]);
  const dropped = plan.openMechanisms.filter((m) => !covered.has(m));
  assert.deepStrictEqual(dropped, [],
    `${documentType} silently drops ${dropped.join(", ")}: open, not resolved, not disclosed.`);

  assert.ok(opening.length < plan.openMechanisms.length,
    `${documentType} asks ${opening.length} questions for ${plan.openMechanisms.length} ` +
    `mechanisms. One question per flag is the checklist this replaced.`);
  checks += 3;
}
const consultancy = planGapQuestions({ documentType: "CONSULTANCY_AGREEMENT", variables: CASES[0][1] });
console.log(
  `PASS  ${consultancy.openMechanisms.length} open mechanisms collapse to ` +
  `${consultancy.questions.filter((q) => q.stage === "opening").length} opening questions, all resolved`
);

// ── 7. A default never claims the user chose ────────────────────────────────
const CONSENT_WORDS = ["you chose", "the parties agreed", "you agreed", "you decided", "you elected", "as requested by you"];
for (const [mechanism, spec] of Object.entries(registry.defaults)) {
  const text = String(spec.disclosure).toLowerCase();
  const claim = CONSENT_WORDS.find((w) => text.includes(w));
  assert.ok(!claim,
    `The default disclosure for ${mechanism} claims the user chose it ("${claim}"). ` +
    `A drafting default must be disclosed as a default, not as consent nobody gave.`);
  checks += 1;
}
console.log("PASS  no default disclosure represents itself as the user's choice");

// ── 8. Questions address the right side of the table ────────────────────────
// The planner used to assume the user was the first party named. On a vendor
// agreement, where the naming policy makes party 1 the Supplier and party 2 the
// Buyer, that meant asking what "the Buyer" would have access to -- when the
// user is nearly always the buyer, asking about the vendor. Every protection
// selected from the answer would have been drafted for the wrong party.
import { buildDocumentSections } from "../backend/services/documentIntakeConfig.js";

const asBuyer = planGapQuestions({
  documentType: "VENDOR_AGREEMENT",
  variables: { ...CASES[1][1], drafting_for: "Buyer" },
});
const asSupplier = planGapQuestions({
  documentType: "VENDOR_AGREEMENT",
  variables: { ...CASES[1][1], drafting_for: "Supplier" },
});
assert.strictEqual(asBuyer.counterparty, "Supplier",
  "a buyer's questions must ask about the supplier");
assert.strictEqual(asSupplier.counterparty, "Buyer",
  "a supplier's questions must ask about the buyer");
assert.strictEqual(asBuyer.counterpartyAssumed, false,
  "a stated side must not be reported as assumed");
assert.ok(
  planGapQuestions({ documentType: "VENDOR_AGREEMENT", variables: CASES[1][1] }).counterpartyAssumed,
  "where the user has not said which side they are on, the assumption must be flagged as one"
);
checks += 4;

// The question that decides all of this is asked before the questions that
// depend on it.
for (const documentType of ["CONSULTANCY_AGREEMENT", "VENDOR_AGREEMENT", "RENTAL_AGREEMENT"]) {
  const sections = buildDocumentSections(documentType);
  const position = sections.findIndex((s) => (s.fields || []).some((f) => f.name === "drafting_for"));
  assert.strictEqual(position, 0,
    `${documentType} asks which side the user is on in section ${position + 1}. It has to come ` +
    `first: every later question is phrased as "you" and "them", and answering it last means ` +
    `answering those with the framing unresolved.`);
  const options = sections[0].fields[0].options || [];
  assert.strictEqual(options.length, 2,
    `${documentType} must offer both of its own party roles, not a generic pair. Got: ${options.join(", ")}`);
  assert.ok(!options.some((o) => /party [12]/i.test(o)),
    `${documentType} offers "${options.join(", ")}" — the document's own role names read better ` +
    `and are what the rest of the draft calls them.`);
  checks += 3;
}
console.log("PASS  questions address the side the user is actually on");
console.log(`\nALL GREEN (${checks} checks)`);
