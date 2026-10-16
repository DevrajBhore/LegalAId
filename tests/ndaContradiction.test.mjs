/**
 * ndaContradiction.test.mjs — D4.46
 *
 * The NDA the old engine certified "Automated checks passed" (score 100) while
 * stating three different periods: the user's 24 months in Duration of
 * Confidentiality, a fixed two-year term, and three further years of survival
 * in Term and Survival. Frozen in tests/fixtures/ndaContradiction.D4_46.json.
 *
 * Regression (the frozen draft is now blocked; the engine no longer produces
 * it), positive (contradictions are caught however phrased), negative (the same
 * period in different words, or a clause that defers by name, is not a
 * contradiction), boundary (unreadable periods, the agreement's own term).
 */
import assert from "node:assert";
import fs from "fs";

const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { assessRelationships, normaliseDuration, loadDocumentRequirements } = await import("../backend/services/documentRequirements.js");
const { draftToText } = await import("../backend/services/exportService.js");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/ndaContradiction.D4_46.json", import.meta.url), "utf8"));
const RELATIONSHIP = loadDocumentRequirements().get("NDA").relationships;
const relate = (duration, survival) =>
  assessRelationships(RELATIONSHIP, ["NDA_DURATION_001", "NDA_TERM_SURVIVAL_001"], { NDA_DURATION_001: duration, NDA_TERM_SURVIVAL_001: survival })[0];
const validate = (draft, variables = FROZEN.variables) =>
  runDocumentValidation(draft, { mode: "final", documentType: "NDA", sourceVariables: variables });
const withClause = (draft, id, text) => ({ ...draft, clauses: draft.clauses.map((c) => (c.clause_id === id ? { ...c, text } : c)) });
const DURATION = (period) => `The confidentiality obligations in this Agreement shall take effect on the Effective Date and shall continue for ${period} after the expiry or earlier termination of this Agreement.`;
const OLD_SURVIVAL = (period) => `This Agreement shall commence on the Effective Date and continue for a period of two (2) years, unless earlier terminated by mutual written consent of the Parties. Notwithstanding termination or expiry, the obligations of confidentiality shall survive for a further period of ${period} in respect of Confidential Information that does not constitute a trade secret.`;
const DEFERRING = 'This Agreement shall commence on the Effective Date and continue for two (2) years. Notwithstanding termination or expiry, the obligations of confidentiality shall survive for the period, and on the terms, set out in the clause headed "Duration of Confidentiality".';

/* ── 1. Regression: the frozen defective NDA ──────────────────────────────── */
ok(FROZEN.old_validation.certification === "Automated checks passed" && FROZEN.old_validation.score === 100 &&
   FROZEN.old_validation.relationships[0].coverage === "AMBIGUOUS_EVIDENCE",
  "frozen evidence: the old engine certified this NDA 'Automated checks passed' at 100, its relationship check unread");
ok(/continue for 24 months after the expiry/.test(FROZEN.text) && /two \(2\) years/.test(FROZEN.text) && /further period of three \(3\) years/.test(FROZEN.text),
  "frozen evidence: the shipped text states 24 months, a two-year term, and three further years");
const frozenV = await validate(FROZEN.draft);
const contradiction = frozenV.blockingIssues.find((i) => i.rule_id === "MATERIAL_CONTRADICTION");
ok(frozenV.certification === "Blocked" && frozenV.release_outcome === "BLOCKED" && frozenV.certified === false && contradiction,
  "the exact frozen NDA is now Blocked, with a MATERIAL_CONTRADICTION finding");
ok(/24 months/.test(contradiction.message) && /three \(3\) years/.test(contradiction.message),
  "the finding quotes both periods as the document states them");
ok(frozenV.requirements.entries.find((e) => e.id === "CONFIDENTIALITY_PERIOD_COHERENT").state === "VIOLATED",
  "the requirement ledger records the relationship as VIOLATED");

/* ── 2. Generation: the engine no longer produces it ──────────────────────── */
const now = await generateDocument({ document_type: "NDA", variables: FROZEN.variables });
const survivalNow = now.draft.clauses.find((c) => c.clause_id === "NDA_TERM_SURVIVAL_001").text;
ok(!/three \(3\) years|two \(2\) years/.test(survivalNow) && /clause headed "Duration of Confidentiality"/.test(survivalNow),
  "Term and Survival states no second period: it defers to Duration of Confidentiality by name");
ok(now.validation.release_outcome !== "BLOCKED" && !now.validation.blockingIssues.some((i) => i.rule_id === "MATERIAL_CONTRADICTION") &&
   now.validation.requirements.entries.find((e) => e.id === "CONFIDENTIALITY_PERIOD_COHERENT").state === "SATISFIED",
  "the same answers now generate an NDA whose periods agree, recorded with its evidence");
const distinctVars = { ...FROZEN.variables, agreement_term: "18 months from the Effective Date", confidentiality_period: "5 years" };
const distinct = await generateDocument({ document_type: "NDA", variables: distinctVars });
const distinctText = draftToText(distinct.draft);
ok(/continue for 18 months, unless/.test(distinctText) && /continue for 5 years after the expiry/.test(distinctText) && !/two \(2\) years/.test(distinctText),
  "the user's Agreement Term (18 months) and Confidentiality Period (5 years) both survive generation; the old fixed two years is gone");
ok(!distinct.validation.blockingIssues.some((i) => i.rule_id === "MATERIAL_CONTRADICTION"),
  "negative: a term (18 months) different from the confidentiality period (5 years) is not a contradiction");

/* ── 3. Positive: contradictions however phrased ──────────────────────────── */
ok(relate(DURATION("5 years"), OLD_SURVIVAL("three (3) years")).coverage === "CONTRADICTED",
  "positive: the 5-year / 3-year NDA is CONTRADICTED");
ok(relate("the confidentiality obligations shall survive its termination or expiration and continue for a period of five (5) years thereafter.", OLD_SURVIVAL("three (3) years")).coverage === "CONTRADICTED",
  "positive: the earlier library phrasing ('continue for a period of five (5) years thereafter') is read and compared");
const planted = withClause(now.draft, "NDA_TERM_SURVIVAL_001", OLD_SURVIVAL("three (3) years"));
const plantedV = await validate(withClause(planted, "NDA_DURATION_001", DURATION("5 years")));
ok(plantedV.certification === "Blocked" && plantedV.blockingIssues.some((i) => i.rule_id === "MATERIAL_CONTRADICTION"),
  "positive: a contradiction planted in a current draft blocks release");

/* ── 4. Negative: agreement is not contradiction ──────────────────────────── */
ok(relate(DURATION("24 months"), OLD_SURVIVAL("two (2) years")).coverage === "RESOLVED",
  "negative: 24 months and two (2) years are the same period");
ok(relate(DURATION("three (3) years"), OLD_SURVIVAL("three (3) years")).coverage === "RESOLVED",
  "negative: the same period stated twice agrees");
const deferred = relate(DURATION("5 years"), DEFERRING);
ok(deferred.coverage === "RESOLVED" && deferred.defers?.NDA_TERM_SURVIVAL_001,
  "negative: a clause that defers by name states no second period, and the agreement's own two-year term is not read as one");

/* ── 5. Boundary: what cannot be read is not agreement ────────────────────── */
const unreadable = relate(DURATION("the period the Parties agree"), OLD_SURVIVAL("three (3) years"));
ok(unreadable.coverage === "AMBIGUOUS_EVIDENCE" && unreadable.silent.includes("NDA_DURATION_001"),
  "boundary: a period the extractor cannot read as a period is unknown, not agreement");
const unreadableV = await validate(withClause(now.draft, "NDA_DURATION_001", DURATION("the period the Parties agree")));
ok(unreadableV.release_outcome === "REQUIRES_LEGAL_REVIEW" && unreadableV.certification === "Requires legal review" &&
   unreadableV.advisoryIssues.some((i) => i.rule_id === "RELATIONSHIP_NOT_ESTABLISHED"),
  "boundary: an unreadable relationship is 'Requires legal review': neither Blocked nor passed");
ok(relate(DEFERRING, DEFERRING).coverage === "AMBIGUOUS_EVIDENCE",
  "boundary: two clauses that each defer leave the period unstated");
ok(assessRelationships(RELATIONSHIP, ["NDA_DURATION_001"], { NDA_DURATION_001: DURATION("5 years") })[0].coverage === "NOT_APPLICABLE",
  "boundary: with one clause there is nothing to contradict, and that is NOT reported as coherence");
ok(normaliseDuration("three (3) years") === "36 months" && normaliseDuration("2 years and 6 months") === "30 months" &&
   normaliseDuration("90 days") === "90 days" && normaliseDuration("3 months") !== normaliseDuration("90 days") &&
   normaliseDuration("as agreed") === null && normaliseDuration("indefinitely") === "unlimited",
  "boundary: periods normalise by unit; days are not silently equated with months; prose is not a period");

console.log(`\nndaContradiction: ${checks} checks passed`);
process.exit(0);
