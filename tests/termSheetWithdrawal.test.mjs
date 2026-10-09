/**
 * termSheetWithdrawal.test.mjs — D4.44
 *
 * The term sheet is withdrawn from public generation while it is rebuilt.
 * Withdrawal is not deletion: the engine still builds it for evidence runs, and
 * documents users already hold stay theirs. What is withdrawn is (a) the ability
 * to start one and (b) the assurance attached to any of them.
 */
import assert from "node:assert";
import fs from "fs";

const W = await import("../shared/documentWithdrawals.js");
const { generateDocument, generateDocumentForRequest } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; console.log(`PASS  ${msg}`); };
const INPUTS = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.inputs.json", import.meta.url), "utf8"));

ok(W.isWithdrawn("TERM_SHEET") && !W.isWithdrawn("NDA") && !W.isWithdrawn(undefined), "only the term sheet is withdrawn");

// Generation is refused at the entry point the HTTP route uses.
const refused = await generateDocumentForRequest({ document_type: "TERM_SHEET", variables: INPUTS.complete });
ok(refused.draft === null && refused.statusCode === 410 && /temporarily unavailable/.test(refused.error),
  "the request entry point refuses a withdrawn type with 410");
const other = await generateDocumentForRequest({ document_type: "NDA", variables: {} });
ok(other.statusCode !== 410, "other types pass through the request entry point to the engine");
const internal = await generateDocument({ document_type: "TERM_SHEET", variables: INPUTS.complete });
ok(Boolean(internal.draft), "the engine still builds it for evidence and regression runs (blueprint, clauses and fixtures are kept)");
const index0 = fs.readFileSync(new URL("../backend/index.js", import.meta.url), "utf8");
ok(/await generateDocumentForRequest\(req\.body\)/.test(index0) && !/await generateDocument\(req\.body\)/.test(index0),
  "POST /generate goes through the request entry point, never straight to the engine");

// Every route that starts or generates a document checks the register.
const index = fs.readFileSync(new URL("../backend/index.js", import.meta.url), "utf8");
for (const route of ['"/generate"', '"/interview"', '"/interview/extract"', '"/interview/step"', '"/intake-assistant"']) {
  ok(new RegExp(`app\\.post\\(${route.replace(/\//g, "\\/")}, protect, aiLimiter, rejectWithdrawnBody,`).test(index), `route ${route} refuses withdrawn types`);
}
ok(/filter\(\(\[key\]\) => !withdrawalFor\(key\)\)/.test(index), "the public document list leaves withdrawn types out");
ok(/app\.get\("\/document-config\/:type", \(req, res\) => \{\s*if \(refuseWithdrawnType/.test(index), "the form configuration refuses withdrawn types");

// The assurance is withdrawn from every validation of a term sheet, new or stored.
const stored = { score: 100, certification: "No issues detected", certified: true, checks_passed: true,
  blockingIssues: [], advisoryIssues: [], summary: { blocking: 0, advisory: 0, notices: 0, total: 0 }, issueCount: 0 };
const marked = W.withValidationAssuranceWithdrawn(stored, "TERM_SHEET");
ok(marked.score === null && marked.certified === false && marked.certification === "Requires review",
  "a stored 100 / 'No issues detected' is shown as 'Requires review' with no score");
ok(marked.assurance_withdrawn.superseded_assessment.score === 100, "the old figure is kept for audit, labelled superseded");
ok(marked.advisoryIssues[0].rule_id === W.WITHDRAWAL_RULE_ID && marked.summary.total === 1, "the withdrawal is itself a finding the user sees");
ok(W.withValidationAssuranceWithdrawn(marked, "TERM_SHEET") === marked, "marking is idempotent");
ok(W.withValidationAssuranceWithdrawn(stored, "NDA") === stored, "other types are untouched (same object)");
ok(W.withValidationAssuranceWithdrawn(null, "TERM_SHEET").certification === "Requires review", "a never-validated saved term sheet still shows 'Requires review'");

const live = await runDocumentValidation(internal.draft, { mode: "final", documentType: "TERM_SHEET", sourceVariables: INPUTS.complete });
ok(live.score === null && live.assurance_withdrawn && live.blockingIssues.length === 0,
  "validating a term sheet (editor, export) reports no score, and does not block the user's own document");

const history = fs.readFileSync(new URL("../backend/services/documentHistoryService.js", import.meta.url), "utf8");
ok((history.match(/currentValidationOf\(record\)/g) || []).length >= 3 && /serializeVersionSummary\(v, record\.documentType\)/.test(history),
  "saved documents and their versions are read through the withdrawal");

console.log(`\ntermSheetWithdrawal: ${checks} checks passed`);
process.exit(0);
