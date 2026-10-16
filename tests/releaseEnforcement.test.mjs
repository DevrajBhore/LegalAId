/**
 * releaseEnforcement.test.mjs — D4.46
 *
 * The requirement model decides release, across families, in five states:
 * violated (blocks only an audited hard constraint), evidence missing,
 * applicability unresolved, not applicable (with its reason) and satisfied (with
 * its evidence). "Requires information" and "Requires legal review" are distinct
 * from Blocked and from "Automated checks passed"; a blocking finding always wins.
 */
import assert from "node:assert";
import fs from "fs";

const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation, formatValidationResult } = await import("../backend/services/validationService.js");
const { loadDocumentRequirements } = await import("../backend/services/documentRequirements.js");
const R = await import("../backend/services/requirementRelease.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const AUDIT = JSON.parse(fs.readFileSync(new URL("../knowledge-base/governance/block-requirements-audit.json", import.meta.url), "utf8"));
const gen = async (type, profile = FIXTURE_PROFILE.WELL_FILLED) => {
  const variables = variablesFor(type, { profile });
  return { variables, ...(await generateDocument({ document_type: type, variables })) };
};
const without = (draft, ids) => ({ ...draft, clauses: draft.clauses.filter((c) => !ids.includes(c.clause_id)) });
const validate = (type, draft, variables) => runDocumentValidation(draft, { mode: "final", documentType: type, sourceVariables: variables });
const entry = (v, id) => v.requirements.entries.find((e) => e.id === id);

/* ── 1. The audit: every BLOCK requirement, once, before it can block ────── */
const declaredBlock = [...loadDocumentRequirements()].flatMap(([t, rs]) => rs.filter((r) => r.when_unsatisfied === "BLOCK").map((r) => `${t}:${r.id}`));
const audited = AUDIT.requirements.map((r) => `${r.document_type}:${r.id}`);
ok(declaredBlock.length === 34 && audited.length === 34 && declaredBlock.every((k) => audited.filter((a) => a === k).length === 1),
  "all 34 BLOCK requirements are audited individually, each exactly once");
ok(AUDIT.requirements.every((r) => r.enforcement !== "ACTIVE_BLOCK" || Object.values(r.checks).every((v) => v === true)),
  "only a requirement passing every check (A–E) is ACTIVE_BLOCK");
ok(AUDIT.requirements.filter((r) => r.corpus.worlds_generated === 0).every((r) => r.enforcement === "HELD_FOR_LEGAL_REVIEW" && r.checks.D_never_violated_on_corpus === "NOT_TESTED"),
  "no evidence is not passing evidence: a type no fixture world generates is held, D recorded NOT_TESTED");
ok(R.enforcementOf("NDA", "NOT_AUDITED_REQUIREMENT") === "HELD_FOR_LEGAL_REVIEW", "a BLOCK requirement missing from the audit is held, never active");

/* ── 2. Violated: an active hard constraint blocks ───────────────────────── */
const loan = await gen("LOAN_AGREEMENT");
ok(loan.validation.release_outcome === "AUTOMATED_CHECKS_PASSED" && loan.validation.certification === "Automated checks passed",
  "negative: a complete loan passes");
const noPrincipal = await validate("LOAN_AGREEMENT", without(loan.draft, ["LOAN_AMOUNT_001"]), loan.variables);
const notMet = noPrincipal.blockingIssues.find((i) => i.rule_id === "REQUIREMENT_NOT_MET" && i.requirement_id === "PRINCIPAL_ASCERTAINED");
ok(notMet && notMet.severity === "CRITICAL" && noPrincipal.certification === "Blocked" && entry(noPrincipal, "PRINCIPAL_ASCERTAINED").state === "VIOLATED",
  "positive: a loan without its principal clause is Blocked by the ACTIVE_BLOCK requirement");

/* ── 3. Violated: a held requirement is legal review, not a block ────────── */
const rental = await gen("RENTAL_AGREEMENT");
const premisesIds = loadDocumentRequirements().get("RENTAL_AGREEMENT").find((r) => r.id === "PREMISES_IDENTIFIED").satisfied_by.any_of;
const noPremises = await validate("RENTAL_AGREEMENT", without(rental.draft, premisesIds), rental.variables);
const held = noPremises.advisoryIssues.find((i) => i.requirement_id === "PREMISES_IDENTIFIED");
ok(held && held.release_outcome === "REQUIRES_LEGAL_REVIEW" && !noPremises.blockingIssues.some((i) => i.requirement_id === "PREMISES_IDENTIFIED"),
  "boundary: a HELD requirement unmet gives 'Requires legal review', never a block and never a pass");

/* ── 4. Contradicted character (MOU) ─────────────────────────────────────── */
const mou = await gen("MOU");
ok(mou.validation.certification === "Requires legal review" && entry(mou.validation, "NON_BINDING_CHARACTER").state === "VIOLATED",
  "regression: the MOU whose own model said CONTRADICTED is no longer 'Automated checks passed'; it requires legal review");

/* ── 5. Evidence missing: information, not a pass ────────────────────────── */
const sha = await gen("SHAREHOLDERS_AGREEMENT");
ok(sha.validation.certification === "Requires information" && entry(sha.validation, "TRANSFER_RESTRICTIONS_IN_ARTICLES").state === "EVIDENCE_MISSING",
  "an SHA whose Articles were never supplied 'Requires information'");

/* ── 6. Applicability unresolved: information, never met or inapplicable ─── */
const unknown = R.requirementFindings({ assessed: true, relationships: [], results: [
  { id: "PERSONNEL_CONTINUITY", kind: "CONTENT", coverage: "APPLICABILITY_UNKNOWN", statement: "x".repeat(30), undetermined_by: "key_person_dependency", undetermined_source: "position" },
] }, "MASTER_SERVICE_AGREEMENT");
ok(unknown.ledger.entries[0].state === "APPLICABILITY_UNRESOLVED" && unknown.issues[0].release_outcome === "REQUIRES_INFORMATION" &&
   unknown.ledger.summary.satisfied === 0 && unknown.ledger.summary.not_applicable === 0,
  "applicability unresolved asks for the fact; it is counted neither satisfied nor not applicable");

/* ── 7. Not applicable keeps its reason; satisfied keeps its evidence ────── */
const msa = await gen("MASTER_SERVICE_AGREEMENT", FIXTURE_PROFILE.WELL_FILLED);
const msaMin = await gen("MASTER_SERVICE_AGREEMENT", FIXTURE_PROFILE.MINIMAL_DECLINED);
const na = [msa, msaMin, loan, rental, sha].flatMap((r) => r.validation.requirements.entries.filter((e) => e.state === "NOT_APPLICABLE" && e.kind !== "RELATIONSHIP"));
const sat = loan.validation.requirements.entries.filter((e) => e.state === "SATISFIED");
ok(sat.length > 0 && sat.every((e) => Array.isArray(e.evidence?.satisfied_by) && e.evidence.satisfied_by.length > 0),
  "every satisfied requirement records the clauses that satisfy it");
ok(na.length > 0 && na.every((e) => e.reason?.applicability), `every not-applicable requirement (${na.length} here) records the condition that was not met`);

/* ── 8. Precedence of outcomes ───────────────────────────────────────────── */
const mk = (release, extra = {}) => ({ rule_id: `T_${release}`, severity: "MEDIUM", release_outcome: release, manual_review_required: true, message: release, ...extra });
const both = formatValidationResult({ issues: [mk("REQUIRES_INFORMATION"), mk("REQUIRES_LEGAL_REVIEW"), { rule_id: "X", severity: "CRITICAL", blocks_generation: true, message: "x" }] });
ok(both.certification === "Blocked" && both.release_outcome === "BLOCKED", "a blocking finding always wins");
ok(formatValidationResult({ issues: [mk("REQUIRES_LEGAL_REVIEW"), mk("REQUIRES_INFORMATION")] }).certification === "Requires information",
  "missing information comes before legal review: nothing can be reviewed without it");
ok(formatValidationResult({ issues: [mk("REQUIRES_LEGAL_REVIEW"), { rule_id: "Y", severity: "LOW", message: "y" }] }).certification === "Requires legal review",
  "legal review is distinct from an ordinary open finding");
ok(formatValidationResult({ issues: [{ rule_id: "Y", severity: "LOW", message: "y" }] }).certification === "Review Required" &&
   formatValidationResult({ issues: [] }).certification === "Automated checks passed",
  "negative: ordinary findings and a clean result keep their existing outcomes");

/* ── 9. Cross-family: every assessed family, every fixture world ─────────── */
let worlds = 0;
for (const type of loadDocumentRequirements().keys()) {
  for (const profile of Object.values(FIXTURE_PROFILE)) {
    const r = await gen(type, profile);
    if (!r.draft) continue;
    worlds++;
    const v = r.validation;
    const states = v.requirements.entries.map((e) => e.state);
    const notClean = states.some((s) => ["VIOLATED", "EVIDENCE_MISSING", "APPLICABILITY_UNRESOLVED"].includes(s));
    assert.ok(!(notClean && v.certification === "Automated checks passed"), `${type}/${profile}: an unmet requirement shipped as passed`);
    assert.deepStrictEqual(
      Object.fromEntries([...r.requirements.results, ...r.requirements.relationships].map((x) => [x.id, x.coverage])),
      Object.fromEntries(v.requirements.entries.map((e) => [e.id, e.coverage])),
      `${type}/${profile}: the report and the release decision read the same assessment`);
  }
}
ok(worlds >= 14, `cross-family (${worlds} generated worlds): no unmet, contradicted or undetermined requirement is ever 'Automated checks passed', and the response's requirement report equals the release decision's`);

console.log(`\nreleaseEnforcement: ${checks} checks passed`);
process.exit(0);
