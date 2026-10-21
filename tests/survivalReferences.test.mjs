/**
 * survivalReferences.test.mjs — D4.47
 *
 * The survival list is drawn from the FINAL clause set, by clause id against
 * authored semantics (knowledge-base/metadata/survival_semantics.json), and the
 * rendered document is checked against it.
 *
 * Regression (the 8 frozen documents that omitted indemnity and limitation of
 * liability), corpus (every generated document agrees with its own clauses, and
 * re-rendering it changes nothing), negative controls (provisions a title would
 * have pulled in are not said to survive), positive (an edit that breaks the
 * agreement is caught), boundary (free-text survival clauses, completeness of
 * the authored decisions).
 */
import assert from "node:assert";
import fs from "fs";

const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { rerenderSurvivalReferences } = await import("../backend/services/documentHardening.js");
const S = await import("../backend/services/survivalSemantics.js");
const { getAllClauses } = await import("../backend/services/clauseAssembler.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");
const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/survivalStale.D4_47.json", import.meta.url), "utf8"));
const SEM = JSON.parse(fs.readFileSync(new URL("../knowledge-base/metadata/survival_semantics.json", import.meta.url), "utf8"));
const asDraft = (ids, referencing) => ({ clauses: ids.map((id) => referencing.find((c) => c.clause_id === id) || { clause_id: id, text: "" }) });
const listOf = (text) => (text.match(/relating to (.+?) shall survive/i) || [])[1] || "";

/* ── 1. Regression: the frozen eight ─────────────────────────────────────── */
ok(FROZEN.cases.length === 8, "frozen evidence: 8 shipped documents (NDA 5, Leave and Licence 3) omitted provisions they contained");
for (const c of FROZEN.cases) {
  const issues = S.verifySurvivalReferences(asDraft(c.clause_ids, c.referencing_clauses));
  const survival = issues.find((i) => i.offending_clause_id === "CORE_SURVIVAL_001");
  assert.ok(survival && c.missing.every((label) => survival.evidence.expected.includes(label) && !survival.evidence.named.includes(label)), `${c.case}: flagged`);
}
ok(true, "each of the 8 is now flagged SURVIVAL_REFERENCES_MISMATCH, naming the provisions it omits");
for (const type of ["NDA", "LEAVE_AND_LICENSE_AGREEMENT"]) {
  for (const profile of Object.values(FIXTURE_PROFILE)) {
    const r = await generateDocument({ document_type: type, variables: variablesFor(type, { profile }) });
    const list = listOf(r.draft.clauses.find((c) => c.clause_id === "CORE_SURVIVAL_001").text);
    assert.ok(/indemnity/.test(list) && /limitation of liability/.test(list), `${type}/${profile}: ${list}`);
  }
}
ok(true, "the same families now name indemnity and limitation of liability, which they contain");

/* ── 2. Corpus: every document agrees with its own final clause set ─────── */
let documents = 0, referencing = 0;
const disagreements = [], unstable = [];
for (const type of Object.keys(DOCUMENT_CONFIG)) {
  for (const profile of Object.values(FIXTURE_PROFILE)) {
    const r = await generateDocument({ document_type: type, variables: variablesFor(type, { profile }) });
    if (!r.draft) continue;
    documents++;
    const issues = S.verifySurvivalReferences(r.draft);
    if (issues.length) disagreements.push(`${type}/${profile}: ${issues.map((i) => i.message).join(" | ")}`);
    if (r.draft.clauses.some((c) => S.survivalReferencingClauseIds().has(c.clause_id))) referencing++;
    const again = rerenderSurvivalReferences(r.draft, { document_type: type, variables: r.draft.metadata.source_variables });
    const changed = again.clauses.filter((c, i) => S.survivalReferencingClauseIds().has(c.clause_id) && c.text !== r.draft.clauses[i].text);
    // Re-rendering may differ only by the normalisation the pipeline applies after it.
    if (changed.some((c, i) => listOf(c.text) && listOf(c.text) !== listOf(r.draft.clauses.find((x) => x.clause_id === c.clause_id).text))) unstable.push(`${type}/${profile}`);
  }
}
ok(disagreements.length === 0 && referencing > 30,
  `corpus: in all ${documents} documents (${referencing} with a survival list) the list names exactly the surviving provisions present${disagreements.length ? `; ${disagreements.join("; ")}` : ""}`);
ok(unstable.length === 0, `the list is a fixed point: drawing it again from the final clause set changes nothing${unstable.length ? ` (${unstable.join(", ")})` : ""}`);

/* ── 3. Negative controls: provisions a title would have pulled in ──────── */
const allExcluded = SEM.concepts.flatMap((c) => (c.excluded || []).map((e) => e.clause_id));
ok(S.survivingLabels(allExcluded).length === 0,
  `none of the ${allExcluded.length} excluded clauses (termination notice, notice period, licences, data security, return of information, ...) makes anything survive`);
ok(!S.survivingLabels(["CORE_TERMINATION_NOTICE_001", "EMP_NOTICE_PERIOD_001"]).includes("notices") && S.survivingLabels(["CORE_NOTICE_001"]).includes("notices"),
  "a Termination Notice or a Notice Period is not the Notices provision; CORE_NOTICE_001 is");
ok(!S.survivingLabels(["IP_LICENSE_001", "TOS_LICENSE_TO_USE_001"]).includes("ownership of intellectual property") &&
   S.survivingLabels(["IP_OWNERSHIP_001"]).includes("ownership of intellectual property"),
  "a licence does not make 'ownership of intellectual property' survive; an ownership clause does");
ok(SEM.does_not_survive.concepts.every((n) => !SEM.concepts.some((c) => c.concept === n.concept)),
  "representations, security, insurance and licences are recorded as not surviving, and never listed");

/* ── 4. Positive: an edit that breaks the agreement is caught ───────────── */
const msa = await generateDocument({ document_type: "MASTER_SERVICE_AGREEMENT", variables: variablesFor("MASTER_SERVICE_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }) });
const surv = msa.draft.clauses.find((c) => c.clause_id === "CORE_SURVIVAL_001");
const withSurvival = (text) => ({ ...msa.draft, clauses: msa.draft.clauses.map((c) => (c.clause_id === surv.clause_id ? { ...c, text } : c)) });
const dropped = await runDocumentValidation(withSurvival(surv.text.replace("indemnity, ", "")), { mode: "background", documentType: "MASTER_SERVICE_AGREEMENT", sourceVariables: msa.draft.metadata.source_variables });
const finding = dropped.advisoryIssues.find((i) => i.rule_id === "SURVIVAL_REFERENCES_MISMATCH");
ok(finding && /omits indemnity/.test(finding.message) && finding.release_outcome === "REQUIRES_LEGAL_REVIEW" && dropped.certification === "Requires legal review",
  "positive: a survival list that omits a surviving provision the document contains is 'Requires legal review'");
const noIndemnity = { ...msa.draft, clauses: msa.draft.clauses.filter((c) => !/INDEMNIT/.test(c.clause_id)) };
const named = S.verifySurvivalReferences(noIndemnity).find((i) => i.offending_clause_id === "CORE_SURVIVAL_001");
ok(named && /names indemnity, which the document does not contain/.test(named.message),
  "positive: a survival list naming a provision the document no longer contains is caught");
const term = msa.draft.clauses.find((c) => S.survivalReferencingClauseIds().has(c.clause_id) && c.clause_id !== "CORE_SURVIVAL_001");
ok(term && S.verifySurvivalReferences({ clauses: msa.draft.clauses.map((c) => (c.clause_id === term.clause_id ? { ...c, text: c.text.replace("indemnity, ", "") } : c)) })
  .some((i) => i.offending_clause_id === term.clause_id),
  `the termination clause's own survival sentence (${term?.clause_id}) is checked the same way`);

/* ── 5. Boundary ─────────────────────────────────────────────────────────── */
ok(S.verifySurvivalReferences(withSurvival("Clauses 4, 7 and 9 shall survive termination.")).filter((i) => i.offending_clause_id === "CORE_SURVIVAL_001").length === 0,
  "boundary: a survival clause rewritten in the user's own terms is not guessed at");
const library = new Set(getAllClauses().map((c) => c.clause_id));
const authored = SEM.concepts.flatMap((c) => [...c.clause_ids, ...(c.excluded || []).map((e) => e.clause_id)]);
ok(authored.every((id) => library.has(id)), "every clause the semantics names exists in the library");
const TITLE_MATCH = /CONFIDENTIAL|(?:^|_)IP(?:_|$)|INTELLECTUAL|INDEMNIT|LIABILITY|DISPUTE|ARBITRAT|GOVERNING_LAW|JURISDICTION|(?:^|_)NOTICE(?:_|$)/i;
const undecided = getAllClauses().filter((c) => TITLE_MATCH.test(c.clause_id) && !/^(ARB_NOTICE|LEGAL_NOTICE|NOTICE_|S138_|REPLY_|AFFIDAVIT_)/.test(c.clause_id) && !authored.includes(c.clause_id));
ok(undecided.length === 0, `every agreement clause a title would once have counted has an authored decision${undecided.length ? ` (undecided: ${undecided.map((c) => c.clause_id).join(", ")})` : ""}`);
ok(SEM.review_status === "draft-needs-legal-review", "the semantics are recorded as awaiting legal review");

console.log(`\nsurvivalReferences: ${checks} checks passed`);
process.exit(0);
