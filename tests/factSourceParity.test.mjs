/**
 * factSourceParity.test.mjs
 *
 * THE TWO HALVES OF THE SYSTEM READ ONE FACT FROM ONE PLACE.
 *
 * This is the inversion of applicabilityFactSource.test.mjs, which recorded the
 * defect: clause selection read deriveGenerationControls, assessment read
 * resolution.positions, and a requirement conditioned on a derived fact reported
 * APPLICABILITY_UNKNOWN while the very same document shipped the clause that
 * fact had gated. Nine of nine conditional requirements, in three families. The
 * document acted; the report said nobody knew.
 *
 * THE INVARIANT. For every fact that influences either clause applicability or
 * requirement applicability:
 *
 *     generationResolvedFact  ===  assessmentResolvedFact
 *
 * and not merely as booleans. Equal final values would be satisfied by two
 * independent derivations that happen to agree on today's fixtures and diverge
 * on tomorrow's, which is the failure this whole exercise is about. So the
 * comparison is on four axes:
 *
 *     VALUE       the tri-state position, not the raw cell. Generation holds the
 *                 select's own word ("Yes"); assessment holds true. Those are
 *                 the same fact, and a test that demanded identical JavaScript
 *                 would force a coercion somewhere and hide the next mismatch.
 *     PROVENANCE  an answer and a derivation are different evidence even at the
 *                 same value, and an assessment that cannot tell them apart
 *                 cannot explain itself to a lawyer.
 *     EVIDENCE    which intake field actually established it, named.
 *     SOURCE      assessment may hold NO fact generation does not, and none that
 *                 is not declared in semantic_facts.json.
 *
 * WHY IT IS NOT CIRCULAR. The generator's side is recomputed here from the raw
 * fixture the way generation computes it — sanitise, then derive — and compared
 * against what came back on a real generateDocument result. The assessment side
 * travelled the whole composed path: resolution, sanitisation, draft assembly,
 * canonical resolution. If any stage along it silently rewrote a fact, the two
 * numbers stop matching. A test that handed both sides the same object would
 * prove only that assignment works.
 *
 * SUCCESS IS NOT "NINE OF NINE GREEN". It is: every requirement evaluates
 * against the same semantic facts generation used, with no assessment-only
 * reconstruction. Green counts are downstream of that and are not the claim.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { positionOf, POSITION } from "../backend/services/generationControls.js";
import { getVariables, sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import {
  resolveCanonicalFacts, loadSemanticFacts, FACT_PROVENANCE,
} from "../backend/services/canonicalFacts.js";
import { assessRequirements, loadDocumentRequirements, COVERAGE }
  from "../backend/services/documentRequirements.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";

let checks = 0;
const fail = [];
const note = (message) => console.log(`      ${message}`);

// Every family that actually exercises a semantic fact. Not the whole portfolio:
// a family where no declared fact holds a position proves nothing about parity,
// and padding the list would inflate the check count without adding evidence.
const FAMILIES = [
  "LOAN_AGREEMENT", "EMPLOYMENT_CONTRACT", "MASTER_SERVICE_AGREEMENT",
  "NDA", "PRIVACY_POLICY",
];

const DECLARED = loadSemanticFacts();

/** What generation resolved, computed the way generation computes it. */
function generationView(family, rawVariables) {
  return deriveControlsForDocument(
    family, sanitizeVariablesForDocument(family, rawVariables || {})
  );
}

/** What assessment resolved, as it came back off the composed path. */
function assessmentView(result) {
  return new Map((result.canonical_facts || []).map((o) => [o.fact, o]));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE PARITY INVARIANT
// ─────────────────────────────────────────────────────────────────────────────
console.log("1. FACT-SOURCE PARITY");

const observed = [];
for (const family of FAMILIES) {
  const raw = buildVariables(family, "full");
  const generation = generationView(family, raw);
  const result = await generateDocument({ document_type: family, variables: raw });
  const assessment = assessmentView(result);

  assert.ok(
    assessment.size > 0,
    `${family}: the result carries no canonical_facts at all. Assessment is running on ` +
    `something other than the canonical resolution, or the wiring in buildSuccess was lost.`
  );

  for (const [id, declaration] of DECLARED) {
    const generationPosition = positionOf(generation[id]);
    const record = assessment.get(id);
    assert.ok(record, `${family}/${id}: declared but absent from canonical_facts`);
    const assessmentPosition = record.provenance === FACT_PROVENANCE.UNKNOWN
      ? POSITION.UNKNOWN : positionOf(record.value);

    // AXIS 1 — VALUE.
    if (generationPosition !== assessmentPosition) {
      fail.push(
        `${family}/${id}: generation resolved ${generationPosition}, assessment resolved ` +
        `${assessmentPosition}. ${generationPosition === POSITION.UNKNOWN
          ? "Assessment invented a fact generation never held."
          : "The document was drafted on a fact the report does not have."}`
      );
    }

    if (assessmentPosition === POSITION.UNKNOWN) continue;
    observed.push({ family, id, position: assessmentPosition, provenance: record.provenance });

    // AXIS 2 — PROVENANCE. A DECLARED fact that reached its value through a
    // derivation is not declared, whatever the declaration file says it is.
    assert.ok(
      [FACT_PROVENANCE.DECLARED, FACT_PROVENANCE.DERIVED].includes(record.provenance),
      `${family}/${id}: established with provenance "${record.provenance}"`
    );
    if (declaration.kind === "DERIVED" && record.provenance === FACT_PROVENANCE.DECLARED) {
      fail.push(
        `${family}/${id}: declared DERIVED in semantic_facts.json but reported as an answer. ` +
        `A derivation reported as the user's own answer is how an inference acquires an ` +
        `authority nobody gave it.`
      );
    }

    // AXIS 3 — EVIDENCE. Named, and a field that exists on this family's intake.
    const schema = getVariables(family) || {};
    assert.ok(
      record.evidence.length > 0,
      `${family}/${id}: established with no evidence named. A fact whose source cannot be ` +
      `stated cannot be defended.`
    );
    for (const field of record.evidence) {
      assert.ok(
        field in schema || DECLARED.has(field),
        `${family}/${id}: evidence names "${field}", which is not a field on this family's ` +
        `intake nor a declared fact.`
      );
    }
  }

  // AXIS 4 — SOURCE. Assessment holds nothing outside the declared surface.
  for (const id of assessment.keys()) {
    assert.ok(
      DECLARED.has(id),
      `${family}: canonical_facts carries "${id}", which is not declared in ` +
      `semantic_facts.json. The declared surface is the admission gate; a fact that ` +
      `arrives around it makes deriveGenerationControls the semantic model by accident.`
    );
  }
  checks += 1;
  note(`${family.padEnd(26)} ${
    [...assessment.values()].filter((o) => o.provenance !== FACT_PROVENANCE.UNKNOWN)
      .map((o) => `${o.fact}=${o.value}(${o.provenance})`).join(" ") || "(no fact holds a position)"
  }`);
}

assert.deepEqual(fail, [], `\n  - ${fail.join("\n  - ")}\n`);
assert.ok(
  observed.length >= 12,
  `only ${observed.length} established facts observed across ${FAMILIES.length} families — ` +
  `too few for this file to be evidence of anything. Did the fixtures stop answering?`
);
assert.ok(
  observed.some((o) => o.provenance === FACT_PROVENANCE.DECLARED)
    && observed.some((o) => o.provenance === FACT_PROVENANCE.DERIVED),
  "every observed fact shares one provenance, so the provenance axis was never exercised"
);
checks += 3;
console.log(`   PASS  ${observed.length} established facts agree on value, provenance, evidence and source`);

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE SIX MUTATIONS
//
// Parity that only holds on the fixtures as frozen is not parity. Each mutation
// changes one thing and states what both halves must do about it.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n2. MUTATIONS");

/** Both halves, for one fact, under one set of variables. */
async function bothHalves(family, variables, id, { allowBlocked = false } = {}) {
  const result = await generateDocument({ document_type: family, variables });
  // A blocked generation has no canonical facts, and every fact then reads
  // UNKNOWN — which is indistinguishable from honest silence unless it is said
  // out loud. M3's first draft failed exactly this way: it deleted a required
  // field, generation refused, and the assertion "the fact is unknown" passed
  // for a reason that had nothing to do with the semantic layer.
  if (!allowBlocked && !(result.draft?.clauses || []).length) {
    throw new Error(
      `${family}: generation produced no document, so no fact was resolved and every ` +
      `assertion below would be measuring validation instead of parity. Issues: ` +
      JSON.stringify(result.validation?.errors || result.validation?.issues || []).slice(0, 400)
    );
  }
  const record = (result.canonical_facts || []).find((o) => o.fact === id);
  return {
    generation: positionOf(generationView(family, variables)[id]),
    assessment: record?.provenance === FACT_PROVENANCE.UNKNOWN
      ? POSITION.UNKNOWN : positionOf(record?.value),
    record, result,
  };
}

// MUTATION 1 — change a DECLARED input. Both halves change, and the fact stays
// an answer.
{
  const base = buildVariables("LOAN_AGREEMENT", "full");
  const secured = await bothHalves("LOAN_AGREEMENT", { ...base, loan_is_secured: "Yes" }, "is_secured");
  // Collateral cleared, not merely re-answered. The intake's own rule is that
  // an unsecured loan has no collateral to describe, and a fixture that answers
  // "No" while still describing security states two different things about one
  // loan. That state is now refused at validation (see M7), so leaving it here
  // would have this mutation measuring the refusal rather than the fact.
  const { security_collateral, ...withoutCollateral } = base;
  const unsecured = await bothHalves(
    "LOAN_AGREEMENT", { ...withoutCollateral, loan_is_secured: "No" }, "is_secured");

  assert.equal(secured.generation, POSITION.TRUE, "M1: Yes did not make generation see a secured loan");
  assert.equal(secured.assessment, POSITION.TRUE, "M1: Yes did not reach assessment");
  assert.equal(unsecured.generation, POSITION.FALSE, "M1: No did not make generation see an unsecured loan");
  assert.equal(
    unsecured.assessment, POSITION.FALSE,
    "M1: the user answered No and assessment does not hold it. This is the original defect, in " +
    "the direction that matters most: a stated negative must be a position, not silence."
  );
  assert.equal(secured.record.provenance, FACT_PROVENANCE.DECLARED);
  assert.equal(unsecured.record.provenance, FACT_PROVENANCE.DECLARED);

  // And the consequence the defect was found through: the shipped clause and the
  // reported applicability move together.
  //
  // The SECURED direction only. An unsecured loan STILL ships LOAN_SECURITY_001,
  // because LOAN_DEFAULT_001 names it in required_with and the dependency
  // resolver injects a referenced clause without consulting the gate that
  // excluded it. That is a CLAUSE defect, not a parity defect, and the
  // distinction is the point: both halves consume the same fact and agree the
  // loan is unsecured — the document is wrong anyway. It is frozen in
  // tests/positionOverride.test.mjs, which records exactly which declared
  // positions a dependency overrides.
  const securityRequirement = (side) =>
    side.result.requirements.results.find((r) => r.id === "SECURITY_POSITION_SETTLED")?.coverage;
  assert.ok(
    (secured.result.draft?.clauses || []).some((c) => c.clause_id === "LOAN_SECURITY_001"),
    "M1: the secured loan does not carry a security clause"
  );
  assert.notEqual(
    securityRequirement(secured), COVERAGE.APPLICABILITY_UNKNOWN,
    "M1: the document asserts security and the report says nobody knows whether security applies " +
    "— the exact disagreement this work exists to end"
  );
  assert.notEqual(
    securityRequirement(unsecured), COVERAGE.APPLICABILITY_UNKNOWN,
    "M1: the user answered No and the security requirement is still undetermined"
  );
  checks += 7;
  note(`M1 declared input   Yes -> gen ${secured.generation}/assess ${secured.assessment} | ` +
       `No -> gen ${unsecured.generation}/assess ${unsecured.assessment}`);
}

// MUTATION 2 — change a DERIVED input. Both halves change identically, from a
// field that is not the fact's own name.
{
  const base = buildVariables("EMPLOYMENT_CONTRACT", "full");
  const small = await bothHalves(
    "EMPLOYMENT_CONTRACT", { ...base, workplace_headcount: "Fewer than 10" }, "employer_headcount_ge_10");
  const large = await bothHalves(
    "EMPLOYMENT_CONTRACT", { ...base, workplace_headcount: "10 or more" }, "employer_headcount_ge_10");

  assert.equal(small.generation, POSITION.FALSE, "M2: fewer than ten did not read as below the threshold");
  assert.equal(small.assessment, small.generation, "M2: the two halves disagree below the threshold");
  assert.equal(large.generation, POSITION.TRUE, "M2: ten or more did not read as at the threshold");
  assert.equal(large.assessment, large.generation, "M2: the two halves disagree at the threshold");
  assert.equal(
    large.record.provenance, FACT_PROVENANCE.DERIVED,
    "M2: a headcount answer became an answer to the threshold question. The user answered how " +
    "many people work there, not whether the Act applies."
  );
  assert.deepEqual(
    large.record.evidence, ["workplace_headcount"],
    "M2: the derivation does not name the answer it rests on"
  );
  checks += 6;
  note(`M2 derived input    <10 -> ${small.generation}/${small.assessment} | ` +
       `>=10 -> ${large.generation}/${large.assessment} (${large.record.provenance})`);
}

// MUTATION 3 — remove the input. Both halves become unknown, and neither
// silently defaults.
//
// THE FIRST ATTEMPT AT THIS TESTED THE WRONG LAYER. Deleting loan_is_secured
// from the fixture blocked generation outright, so what the assertion measured
// was intake validation, not silence semantics — the mutation never reached the
// semantic layer at all. A fact whose question is REQUIRED has no silence path
// through the product, so it cannot be the subject of this mutation.
//
// So the silence is created where silence is actually reachable: an optional
// question, left unanswered, on a document that still generates. Both kinds are
// exercised, because they fail differently — a DECLARED fact goes unknown when
// nobody answers, a DERIVED one when the answer it rests on is missing.
{
  const cases = [
    ["MASTER_SERVICE_AGREEMENT", ["key_person_dependency"], "key_person_dependency", "DECLARED"],
    ["EMPLOYMENT_CONTRACT", ["workplace_headcount"], "employer_headcount_ge_10", "DERIVED"],
    ["EMPLOYMENT_CONTRACT", ["workplace_headcount"], "establishment_is_covered", "DERIVED"],
  ];
  for (const [family, drop, id, kind] of cases) {
    const base = buildVariables(family, "full");
    // Established when answered — otherwise silence proves nothing.
    const answered = await bothHalves(family, base, id);
    assert.notEqual(
      answered.assessment, POSITION.UNKNOWN,
      `M3: ${family}/${id} is not established even when answered, so its silence is not evidence`
    );

    const silent = { ...base };
    for (const field of drop) delete silent[field];
    const side = await bothHalves(family, silent, id);

    assert.ok(
      (side.result.draft?.clauses || []).length > 0,
      `M3: ${family} stopped generating when ${drop.join(", ")} was left unanswered. That is an ` +
      `intake defect, not a silence path — this mutation would be measuring validation again.`
    );
    assert.equal(side.generation, POSITION.UNKNOWN, `M3: ${family}/${id} — generation invented a position from silence`);
    assert.equal(side.assessment, POSITION.UNKNOWN, `M3: ${family}/${id} — assessment invented a position from silence`);
    assert.equal(side.record.provenance, FACT_PROVENANCE.UNKNOWN);
    assert.equal(side.record.value, undefined, `M3: ${family}/${id} — an unestablished fact carries a value`);
    assert.deepEqual(side.record.evidence, [], `M3: ${family}/${id} — an unestablished fact names evidence`);
    assert.ok(
      String(side.record.when_unknown || "").length > 20,
      `M3: ${family}/${id} — silence has no stated consequence`
    );
    assert.equal(side.record.kind, kind, `M3: ${family}/${id} changed kind under silence`);

    // The consequence that matters: silence must not become a finding. Which
    // requirements rest on the fact comes from the DECLARATIONS — an assessed
    // result does not carry its own applicability rule, and filtering the
    // results by a field they do not have matched nothing and reported "0
    // requirements undetermined" as though that were a pass.
    const restingOn = (loadDocumentRequirements().get(family) || [])
      .filter((r) => r.applicability?.position === id).map((r) => r.id);
    assert.ok(
      restingOn.length > 0,
      `M3: no requirement in ${family} rests on ${id}, so its silence has no observable ` +
      `consequence and this case proves nothing`
    );
    const undetermined = side.result.requirements.results
      .filter((r) => restingOn.includes(r.id));
    for (const requirement of undetermined) {
      assert.equal(
        requirement.coverage, COVERAGE.APPLICABILITY_UNKNOWN,
        `M3: ${family}/${requirement.id} rests on ${id}, nobody established it, and it reports ` +
        `${requirement.coverage}. NOT_APPLICABLE here would be a finding of fact drawn from an ` +
        `unanswered question — silence converted into false.`
      );
    }
    checks += 8;
    note(`M3 silence          ${family.padEnd(26)} ${id} -> ${side.assessment} (${kind.toLowerCase()}), ` +
         `${undetermined.length} requirement(s) undetermined, document still generates`);
  }

  // And the fact with NO silence path is required BY DESIGN, not by accident.
  // is_secured decides whether a security clause and SARFAESI enforcement enter
  // the agreement; it is asked rather than left to silence on purpose.
  assert.equal(
    getVariables("LOAN_AGREEMENT").loan_is_secured?.required, true,
    "M3: loan_is_secured became optional. Then the loan has a silence path, and everything the " +
    "security gate gates falls through it — add it to the cases above and decide what an " +
    "unanswered security question should produce."
  );
  checks += 1;
}

// MUTATION 4 — alter a generation-only control. Assessment must not acquire it.
// The declared surface exists so that deriveGenerationControls does not become
// the system's semantic model by accident, and an 87-control object is exactly
// the accident waiting to happen.
{
  const family = "MASTER_SERVICE_AGREEMENT";
  const base = buildVariables(family, "full");
  // contract_value drives the risk profile, which is a presentation and
  // emphasis concern rather than a fact about the world. The first attempt used
  // special_terms, which is not a field on this family's intake at all, so
  // sanitisation stripped it and the control never moved — the guard below is
  // what caught that, and it stays for the next person who picks a dead field.
  const mutated = { ...base, contract_value: 500000000 };

  const controlBefore = generationView(family, base).is_high_value;
  const controlAfter = generationView(family, mutated).is_high_value;
  assert.notEqual(
    controlBefore, controlAfter,
    "M4: the chosen generation-only control did not move, so nothing was tested. Pick another " +
    "— and check the field is actually on this family's schema before assuming it is."
  );
  assert.ok(!DECLARED.has("is_high_value"), "M4: is_high_value is now a declared fact — pick another");

  const before = await generateDocument({ document_type: family, variables: base });
  const after = await generateDocument({ document_type: family, variables: mutated });
  const strip = (r) => JSON.stringify(
    (r.canonical_facts || []).map(({ fact, value, provenance, evidence }) =>
      ({ fact, value, provenance, evidence }))
  );
  assert.equal(
    strip(before), strip(after),
    "M4: moving a control that is NOT a declared semantic fact changed the canonical facts. " +
    "The semantic surface is leaking, and every generation control is on its way to becoming " +
    "something a requirement can rest on."
  );
  assert.ok(
    !(before.canonical_facts || []).some((o) => o.fact === "is_high_value"),
    "M4: assessment acquired a generation-only control"
  );
  checks += 4;
  note(`M4 generation-only  is_high_value ${controlBefore} -> ${controlAfter}; canonical facts unchanged`);
}

// MUTATION 5 — swap the derivation call arguments. This must fail observably.
// The swapped call used to return a small plausible object, which is how a
// measurement error survived long enough to justify an abstraction.
{
  const base = buildVariables("LOAN_AGREEMENT", "full");
  assert.throws(
    () => deriveControlsForDocument(base, "LOAN_AGREEMENT"),
    /must be an UPPER_SNAKE_CASE document type/,
    "M5: the adapter accepted a swapped call"
  );
  assert.throws(
    () => resolveCanonicalFacts(base, "LOAN_AGREEMENT", {}),
    /must be an UPPER_SNAKE_CASE document type/,
    "M5: the canonical resolver accepted a swapped call and would have reported every fact " +
    "unknown — a silent, plausible, wrong answer"
  );
  // And the failure is loud rather than an empty result.
  const swallowed = (() => {
    try { resolveCanonicalFacts(base, "LOAN_AGREEMENT", {}); return "returned"; }
    catch { return "threw"; }
  })();
  assert.equal(swallowed, "threw");
  checks += 3;
  note("M5 swapped args     both the adapter and the resolver refuse");
}

// MUTATION 6 — provenance survives the journey. A derived fact must still read
// as derived after it has crossed into assessment, even where the field behind
// it was answered directly and the value is identical to a declared one.
{
  const family = "LOAN_AGREEMENT";
  const base = buildVariables(family, "full");
  const result = await generateDocument({ document_type: family, variables: base });
  const facts = assessmentView(result);

  const derivedFact = facts.get("lender_is_regulated");
  assert.equal(
    derivedFact.provenance, FACT_PROVENANCE.DERIVED,
    "M6: lender_is_regulated reached assessment as an answer. The user chose a lender TYPE; " +
    "whether that type is regulated is the system's inference, and the $caution on this fact " +
    "says it is not even the statutory test. Reporting it as the user's own answer would put " +
    "our inference behind their signature."
  );
  assert.deepEqual(derivedFact.evidence, ["lender_type"]);
  assert.equal(
    facts.get("is_secured").provenance, FACT_PROVENANCE.DECLARED,
    "M6: a fact the user answered directly reads as derived — provenance is not being carried, " +
    "it is being guessed"
  );
  assert.notEqual(
    derivedFact.value, undefined,
    "M6: the fixture no longer establishes lender_is_regulated, so nothing was tested"
  );
  assert.equal(
    derivedFact.value, facts.get("is_secured").value,
    "M6: the two facts differ in value, so this no longer demonstrates that provenance is " +
    "carried independently of the value"
  );
  checks += 5;
  note(`M6 provenance       lender_is_regulated=${derivedFact.value}(derived) vs ` +
       `is_secured=${facts.get("is_secured").value}(declared) — same value, different evidence`);
}

// MUTATION 7 — THE STATE SPACE. A fact that can be answered two ways must have
// a document behind each answer.
//
// This is the mutation the other six could not have found, because they all
// assume a generatable document. `is_secured = false` claims to represent an
// unsecured loan; the intake required security_collateral unconditionally; so
// the state
//
//     loan_is_secured = No,  security_collateral = (blank)
//
// was REJECTED. The product asked a question, offered "No" as an answer, and
// then refused to produce the document that answer describes. The only way to
// obtain an unsecured loan was to write collateral text into a field whose own
// description says nothing written there can make a loan secured — so the
// intake asserted security while the agreement denied it.
//
// Two declarations disagreed and the resolution rule made the stricter one win:
// variableConfig said `required: false`, DOCUMENT_CONFIG.requiredFields listed
// it, and buildFieldDefinition reads `inRequiredFields || definition.required`.
// The Phase A repair that made the field optional could therefore never take
// effect. That rule is right for its own purpose and was not changed; the field
// was removed from the unconditional list and made conditional instead.
{
  const family = "LOAN_AGREEMENT";
  const base = buildVariables(family, "full");
  const COLLATERAL = "A first charge over the Borrower's plant and machinery at the Mumbai facility.";
  const run = async (answer, collateral) => {
    const vars = { ...base, loan_is_secured: answer };
    if (collateral === null) delete vars.security_collateral;
    else vars.security_collateral = collateral;
    const result = await generateDocument({ document_type: family, variables: vars });
    return {
      generates: (result.draft?.clauses || []).length > 0,
      messages: (result.validation?.errors || result.validation?.issues || [])
        .map((e) => e.message || String(e)).join(" | "),
      fact: (result.canonical_facts || []).find((o) => o.fact === "is_secured"),
    };
  };

  const securedSupplied = await run("Yes", COLLATERAL);
  const securedAbsent = await run("Yes", null);
  const unsecuredAbsent = await run("No", null);
  const unsecuredSupplied = await run("No", COLLATERAL);

  assert.ok(securedSupplied.generates, "M7: a secured loan describing its collateral does not generate");
  assert.equal(securedSupplied.fact.value, true);
  assert.equal(securedSupplied.fact.provenance, FACT_PROVENANCE.DECLARED);

  assert.ok(
    !securedAbsent.generates,
    "M7: a loan answered secured with no collateral described now generates. The security clause " +
    "and any enforcement provisions would be drafted over a blank."
  );
  assert.match(
    securedAbsent.messages, /security_collateral must be provided when the loan is secured/,
    `M7: the secured-but-blank case is refused for the wrong reason: ${securedAbsent.messages}`
  );

  // THE ROW THAT WAS UNREACHABLE.
  assert.ok(
    unsecuredAbsent.generates,
    `M7: the honest unsecured loan STILL cannot be generated. is_secured = false claims to ` +
    `represent this state and the product cannot produce it — a state-space contradiction, not ` +
    `a validation annoyance. Refused with: ${unsecuredAbsent.messages}`
  );
  assert.equal(
    unsecuredAbsent.fact.value, false,
    "M7: the unsecured loan generates but the fact is not established as false"
  );
  assert.equal(unsecuredAbsent.fact.provenance, FACT_PROVENANCE.DECLARED);
  assert.deepEqual(unsecuredAbsent.fact.evidence, ["loan_is_secured"]);

  // The contradiction is SAID, not silently resolved either way.
  assert.ok(
    !unsecuredSupplied.generates,
    "M7: a loan answered unsecured while describing collateral now generates. The intake says " +
    "two different things about one loan and one of them is being discarded in silence."
  );
  assert.match(
    unsecuredSupplied.messages, /answered as unsecured/,
    `M7: the contradiction is refused for the wrong reason: ${unsecuredSupplied.messages}`
  );
  // And never by the old rule, which told the user to write "Unsecured" — one of
  // the phrasings that used to produce a secured loan.
  assert.ok(
    !/explicitly say/i.test(unsecuredSupplied.messages + securedAbsent.messages),
    "M7: the old validation message is back. It instructed the user into the exact trap that " +
    "made \"Unsecured\" produce a secured loan."
  );
  checks += 11;
  note(`M7 state space      secured+collateral=generates | secured+blank=refused | ` +
       `unsecured+blank=GENERATES | unsecured+collateral=refused`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NO ASSESSMENT-ONLY RECONSTRUCTION
//
// The success criterion in its own words. Parity could also be achieved by
// assessment computing the facts a second way and getting lucky. It is not:
// there is one derivation and assessment calls it.
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n3. ONE DERIVATION");
{
  const base = buildVariables("LOAN_AGREEMENT", "full");
  const direct = resolveCanonicalFacts(
    "LOAN_AGREEMENT", sanitizeVariablesForDocument("LOAN_AGREEMENT", base), {}
  );
  const generation = generationView("LOAN_AGREEMENT", base);
  for (const [id, record] of Object.entries(direct.facts)) {
    assert.equal(
      positionOf(record.value), positionOf(generation[id]),
      `${id}: the resolver's own answer differs from the derivation's. It is reimplementing ` +
      `rather than calling.`
    );
  }
  // A requirement may rest only on a declared fact. Enforced at load; asserted
  // here so the two gates cannot drift apart silently.
  const undeclared = [];
  for (const family of FAMILIES) {
    const results = assessRequirements(family, [], {}, {}).results || [];
    for (const r of results) {
      const rests = r.applicability?.position;
      if (rests && !DECLARED.has(rests)) undeclared.push(`${family}/${r.id} rests on ${rests}`);
    }
  }
  assert.deepEqual(undeclared, [], `\n  - ${undeclared.join("\n  - ")}\n`);
  checks += 2;
  console.log(`   PASS  the resolver calls the derivation; every requirement rests on a declared fact`);
}

console.log(`\nALL GREEN (${checks} checks)`);
