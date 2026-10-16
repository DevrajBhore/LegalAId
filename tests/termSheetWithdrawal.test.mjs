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
import zlib from "zlib";
import { createRequire } from "module";
const JSZip = createRequire(new URL("../backend/package.json", import.meta.url))("jszip");

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
ok(marked.score === null && marked.certified === false && marked.certification === "Requires legal review" && marked.release_outcome === "REQUIRES_LEGAL_REVIEW",
  "a stored 100 / 'No issues detected' is shown as 'Requires legal review' with no score");
ok(marked.assurance_withdrawn.superseded_assessment.score === 100, "the old figure is kept for audit, labelled superseded");
ok(marked.advisoryIssues[0].rule_id === W.SUPERSEDED_RULE_ID && marked.summary.total === 1,
  "the withdrawal is itself a finding the user sees (a stored term sheet with no draft to inspect is read as a superseded output)");
ok(W.withValidationAssuranceWithdrawn(marked, "TERM_SHEET") === marked, "marking is idempotent");
ok(W.withValidationAssuranceWithdrawn(stored, "NDA") === stored, "other types are untouched (same object)");
ok(W.withValidationAssuranceWithdrawn(null, "TERM_SHEET").certification === "Requires legal review", "a never-validated saved term sheet still shows 'Requires legal review'");

const live = await runDocumentValidation(internal.draft, { mode: "final", documentType: "TERM_SHEET", sourceVariables: INPUTS.complete });
ok(live.score === null && live.assurance_withdrawn && live.blockingIssues.length === 0,
  "validating a term sheet (editor, export) reports no score, and does not block the user's own document");

const history = fs.readFileSync(new URL("../backend/services/documentHistoryService.js", import.meta.url), "utf8");
ok((history.match(/currentValidationOf\(record\)/g) || []).length >= 3 && /serializeVersionSummary\(v, record\.documentType\)/.test(history),
  "saved documents and their versions are read through the withdrawal");

/* ── Historical term sheets: superseded, preserved, and labelled on download ── */
const { draftToText, draftToDocx, draftToPdf } = await import("../backend/services/exportService.js");
const { applyDocumentQualityControls } = await import("../backend/services/documentQualityControl.js");
const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.defective.json", import.meta.url), "utf8"));
const policies = JSON.parse(fs.readFileSync(new URL("../knowledge-base/metadata/drafting_policies.json", import.meta.url), "utf8"));
const record = W.SUPERSEDED_OUTPUTS.TERM_SHEET;
ok(policies.documents.TERM_SHEET.instrument.version === record.current_instrument_version,
  "the superseded register and the drafting policy agree on the current term-sheet version");
ok(internal.draft.metadata.instrument_version === record.current_instrument_version, "a rebuilt draft is stamped with the current version");

const historical = { document_type: "TERM_SHEET", clauses: FROZEN.clauses, metadata: {} };
const before = JSON.stringify(historical);
ok(W.supersededOutputFor("TERM_SHEET", historical) === record && W.supersededOutputFor("TERM_SHEET", internal.draft) === null,
  "an unstamped (historical) term sheet is superseded; a stamped one is not");
ok(W.supersededOutputFor("TERM_SHEET", undefined) === record, "a term sheet whose provenance is unknown is treated as superseded");
ok(W.supersededOutputFor("NDA", historical) === null, "no other type has superseded outputs");
ok(W.supersededOutputFor("TERM_SHEET", { ...historical, metadata: { instrument_version: record.current_instrument_version } }) === record,
  "forging the version stamp on a historical term sheet does not remove the warning (its clauses give it away)");
ok(record.superseded_clause_ids.every((id) => !internal.draft.clauses.some((c) => c.clause_id === id)),
  "no clause the rebuilt version produces is on the superseded list");

const histValidation = W.withValidationAssuranceWithdrawn({ score: 100, certification: "No issues detected" }, "TERM_SHEET", historical);
ok(histValidation.assurance_withdrawn.reason_code === W.SUPERSEDED_RULE_ID && histValidation.advisoryIssues[0].rule_id === W.SUPERSEDED_RULE_ID,
  "a historical term sheet is reported as a superseded output, not merely as a withdrawn type");
ok(W.withValidationAssuranceWithdrawn({ score: 90 }, "TERM_SHEET", internal.draft).assurance_withdrawn.reason_code === W.WITHDRAWAL_RULE_ID,
  "a rebuilt term sheet is still unscored while the type is withdrawn");

const exportDraft = applyDocumentQualityControls(historical, { document_type: "TERM_SHEET", variables: FROZEN.variables });
ok(exportDraft.clauses.some((c) => /\bthis Agreement\b/.test(c.text)),
  "the export pipeline does not re-word a historical term sheet (no 'this Term Sheet' substitution)");

const txt = draftToText(exportDraft);
const head = txt.slice(0, 800), tail = txt.slice(-1600);
ok(head.includes(record.export_heading) && head.includes("withdrawn on 9 October 2026") && tail.includes(record.export_heading),
  "TXT download: the warning is on the first page and at the end");
ok(FROZEN.clauses.every((c) => txt.includes(c.text.split("\n")[0].slice(0, 60))) || txt.includes("THIS AGREEMENT"),
  "TXT download: the historical text itself is still there");

const zip = await JSZip.loadAsync(await draftToDocx(exportDraft));
const xml = await zip.file("word/document.xml").async("string");
const hits = xml.split(record.export_heading).length - 1;
ok(hits === 2 && xml.indexOf(record.export_heading) < xml.indexOf("THIS AGREEMENT"),
  "DOCX download: the warning appears twice, the first before the document's own opening");

const pdf = (await draftToPdf(exportDraft)).toString("latin1");
let pdfText = "";
for (const m of pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  let body; try { body = zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { continue; }
  for (const tj of body.matchAll(/\[([^\]]*)\]\s*TJ/g)) pdfText += [...tj[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => Buffer.from(h[1], "hex").toString("latin1")).join("") + "\n";
}
const pdfLines = pdfText.split("\n");
const pdfHits = pdfLines.map((l, i) => (l.includes(record.export_heading) ? i : -1)).filter((i) => i >= 0);
ok(pdfHits.length === 2 && pdfHits[0] < 5, "PDF download: the warning is on page 1, under the title, and again at the end");

const rebuiltTxt = draftToText(internal.draft);
ok(!rebuiltTxt.includes(record.export_heading), "a rebuilt term sheet carries no superseded-version warning");
ok(JSON.stringify(historical) === before, "exporting never modifies the stored document");

const historySrc = fs.readFileSync(new URL("../backend/services/documentHistoryService.js", import.meta.url), "utf8");
ok(/withValidationAssuranceWithdrawn\(record\.currentValidation, record\.documentType, record\.currentDraft\)/.test(historySrc) &&
   /withValidationAssuranceWithdrawn\(version\.validationSnapshot, documentType, version\.draftSnapshot\)/.test(historySrc) &&
   !/currentValidation\s*=\s*withValidationAssuranceWithdrawn/.test(historySrc),
  "saved documents and versions are marked on read, judged by their own draft; nothing stored is rewritten");

/* ── Approval: never restored below APPROVED ─────────────────────────────── */
const rebuild = JSON.parse(fs.readFileSync(new URL("../knowledge-base/governance/term-sheet-rebuild.json", import.meta.url), "utf8"));
const cert = rebuild.certification;
ok(cert && cert.status !== "APPROVED" && cert.approved_by === null, `term sheet certification is ${cert?.status}, below APPROVED`);
ok(W.isWithdrawn("TERM_SHEET") || (cert.status === "APPROVED" && cert.approved_by && cert.approved_on),
  "the term sheet is either withdrawn or approved by a named advocate on a date");

console.log(`\ntermSheetWithdrawal: ${checks} checks passed`);
process.exit(0);
