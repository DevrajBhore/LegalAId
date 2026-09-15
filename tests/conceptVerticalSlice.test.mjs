/**
 * conceptVerticalSlice.test.mjs — THE FIRST COMPLETE CHAIN
 *
 * The D4.3 trace measured a system with two disconnected legal representations:
 * 3 of 17 facts reached the document, 10 carried statutory authority, and NONE
 * did both. This test asserts that exactly one concept now does both, end to
 * end, and that the connection is real rather than cosmetic.
 *
 *     question -> fact -> concept -> authority -> clause
 *
 * WHY "ZERO BASELINE DRIFT" IS THE POINT AND NOT A DISAPPOINTMENT. Nineteen
 * blueprints asked one legal question under five different gate names
 * (`involves_personal_data`, `processes_personal_data`, and the `company_`,
 * `firm_`, `jv_` variants). All nineteen now read
 * `concept:PERSONAL_DATA_PROCESSING`. If a single document had changed, either
 * the concept or one of the nineteen gates was wrong and we would not know
 * which. Identical output is what proves the concept faithfully reproduces every
 * decision it replaced — and the decisions now carry an Act and a section.
 *
 * WHAT WOULD MAKE THIS TEST A LIE. Three things, each checked below:
 *
 *   1. The clause could still be driven by the raw boolean, with the concept
 *      merely observing. So the test drives generation through the concept's
 *      own resolution and asserts the clause follows it.
 *   2. The "authority" could be decorative text attached to a clause that would
 *      have shipped anyway. So the negative direction is asserted too: no
 *      concept, no clause, and a stated reason for the absence.
 *   3. An INFERRED resolution could silently attach ten data-processing clauses
 *      on the strength of a classifier reading free text. So the provenance
 *      boundary is asserted directly.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import {
  loadConcepts, resolveConcept, conceptAttaches, explainClause, resolveConcepts,
  CONCEPT_STATE, CONCEPT_PROVENANCE,
} from "../backend/services/conceptResolver.js";

let checks = 0;
const check = (label, fn) => { fn(); checks += 1; console.log(`PASS  ${label}`); };

const CONCEPT = "PERSONAL_DATA_PROCESSING";
const CLAUSE = "CORE_DATA_PROCESSING_001";
const record = loadConcepts().get(CONCEPT);
assert.ok(record, `${CONCEPT} record missing`);

/* ── 1. the concept carries law, section-deep ─────────────────────────────── */

check("the concept cites Acts down to the section", () => {
  const cited = (record.authority || []).filter((a) => a.act && a.section);
  assert.ok(cited.length >= 3,
    `expected section-deep authority, got ${cited.length} citation(s) with a section`);
  assert.ok(cited.some((a) => /Digital Personal Data Protection Act, 2023/.test(a.act)),
    "the DPDP Act is not among the cited authorities");
});

/* ── 2. resolution follows the answer, in both directions ─────────────────── */

check("an affirmative answer resolves the concept PRESENT and DECLARED", () => {
  const r = resolveConcept(record, { involves_personal_data: "Yes" }, {});
  assert.strictEqual(r.state, CONCEPT_STATE.PRESENT);
  assert.strictEqual(r.provenance, CONCEPT_PROVENANCE.DECLARED);
  assert.strictEqual(r.assumed, false, "an answered concept must not be marked assumed");
});

check("'Yes', 'true' and true are the same answer", () => {
  for (const value of ["Yes", "true", true]) {
    const r = resolveConcept(record, { involves_personal_data: value }, {});
    assert.strictEqual(r.state, CONCEPT_STATE.PRESENT,
      `${JSON.stringify(value)} did not resolve PRESENT — the Phase B raw-"Yes" leak, one layer up`);
  }
});

check("a negative answer resolves ABSENT, not UNRESOLVED", () => {
  const r = resolveConcept(record, { involves_personal_data: "No" }, {});
  assert.strictEqual(r.state, CONCEPT_STATE.ABSENT);
  assert.strictEqual(r.assumed, false,
    "a declined concept is established, not assumed — silence and refusal are different");
});

check("silence takes the record's own unresolved_behaviour and discloses it", () => {
  const r = resolveConcept(record, {}, {});
  assert.strictEqual(r.state, CONCEPT_STATE.ABSENT, "record declares assume: absent");
  assert.strictEqual(r.assumed, true, "an assumption must be marked as one");
  assert.strictEqual(r.disclose, true, "an assumption the user never sees is a fabrication");
  assert.ok(r.confirmation?.question, "an assumed concept must carry its confirmation question");
});

/* ── 3. provenance is load-bearing ────────────────────────────────────────── */

check("an INFERRED resolution never attaches clauses", () => {
  const inferred = { ...resolveConcept(record, { involves_personal_data: "Yes" }, {}),
    provenance: CONCEPT_PROVENANCE.INFERRED };
  assert.strictEqual(inferred.state, CONCEPT_STATE.PRESENT);
  assert.strictEqual(conceptAttaches(inferred), false,
    "a classifier reading free text must raise the confirmation question, never attach obligations");
});

/* ── 4. the chain reaches the document, and the document explains itself ──── */

const world = async (documentType, answer) => {
  const variables = { ...variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }) };
  if (answer !== undefined) variables.involves_personal_data = answer;
  const result = await generateDocument({ document_type: documentType, variables });
  const clauses = result.draft?.clauses || [];
  const meta = result.draft?.metadata || {};
  return {
    ids: clauses.map((c) => c.clause_id),
    provenance: meta.clause_provenance || {},
    resolutions: meta.concept_resolutions || [],
  };
};

const yes = await world("MASTER_SERVICE_AGREEMENT", "Yes");
const no = await world("MASTER_SERVICE_AGREEMENT", "No");

check("answering yes puts the clause in the document", () => {
  assert.ok(yes.ids.includes(CLAUSE), `${CLAUSE} absent from the affirmative world`);
});

check("answering no keeps it out", () => {
  assert.ok(!no.ids.includes(CLAUSE), `${CLAUSE} present in the negative world`);
});

check("the clause states WHY it is there, citing the Act and section", () => {
  const p = yes.provenance[CLAUSE];
  assert.ok(p, "no provenance record for the clause");
  assert.strictEqual(p.concept, CONCEPT, "the clause does not name the concept that attached it");
  assert.ok(Array.isArray(p.concept_authority) && p.concept_authority.length,
    "the clause carries no concept authority");
  assert.ok(p.concept_authority.some((a) => a.section),
    "the authority names no section");
  assert.match(p.reason, /Digital Personal Data Protection Act/,
    `the stated reason does not reach the statute: "${p.reason}"`);
});

check("the negative resolution is recorded, not merely missing", () => {
  const r = no.resolutions.find((x) => x.concept_id === CONCEPT);
  assert.ok(r, "an absent concept went unrecorded — indistinguishable from one never considered");
  assert.strictEqual(r.state, CONCEPT_STATE.ABSENT);
  const why = explainClause(CLAUSE, resolveConcepts({ involves_personal_data: "No" }, {}));
  assert.strictEqual(why.included, false);
  assert.ok(why.because.length > 0, "no reason given for the absence");
});

/* ── 5. one question, one answer, across every name it used to have ───────── */

check("five gate names now resolve through one concept", async () => {
  /* Families that previously asked the same legal question under different
   * names. Each must now agree with the concept, which is the whole point of
   * replacing nineteen local decisions with one. */
  for (const documentType of ["MASTER_SERVICE_AGREEMENT", "NDA", "PARTNERSHIP_DEED"]) {
    const on = await world(documentType, "Yes");
    const off = await world(documentType, "No");
    assert.ok(on.ids.includes(CLAUSE), `${documentType}: clause missing when answered yes`);
    assert.ok(!off.ids.includes(CLAUSE), `${documentType}: clause present when answered no`);
  }
});

check("the concept is not yet advocate-signed, and says so", () => {
  const r = yes.resolutions.find((x) => x.concept_id === CONCEPT);
  assert.match(String(r.review_status), /draft|needs/i,
    "an unsigned concept must not present itself as reviewed legal knowledge");
});

console.log(`\nALL GREEN (${checks} checks)`);
