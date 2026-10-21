/**
 * exportParity.test.mjs — D4.47
 *
 * A document the engine shows without a blocking issue can be downloaded. The
 * export endpoint re-validates in "final" mode, where the AI safety layer runs
 * for any AI-touched or edited draft; before D4.47 its tamper heuristics read
 * the engine's own "(iii)", "Schedule III" and "(a) In full and final ..." as
 * malformed text, judged every clause of an untouched draft as if edited, and
 * let a model's unverified verdict refuse the download.
 *
 * Regression (frozen refusals now export), parity (every generated draft, plain,
 * AI-touched and edited), positive (real tampering still blocks), negative
 * (enumerators and Roman numerals in an edit pass), boundary (untouched and
 * legacy drafts), and the treatment of a model's verdict.
 */
import assert from "node:assert";
import fs from "fs";

const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { prepareExportDraft } = await import("../backend/services/mutationEntryPoints.js");
const { draftToDocx, draftToPdf, draftToText } = await import("../backend/services/exportService.js");
const { aiLegalSafetyValidate } = await import("../IRE/src/indian-rule-engine/aiLegalSafetyValidator.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");
const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/exportRefusal.D4_47.json", import.meta.url), "utf8"));

// Exactly what POST /export does (backend/index.js -> prepareExportDraft).
async function exportGate(draft) {
  const exportDraft = prepareExportDraft(draft).draft;
  const v = await runDocumentValidation(exportDraft, { mode: "final", documentType: exportDraft.document_type, sourceVariables: exportDraft?.metadata?.source_variables });
  return { exportDraft, v, canExport: (v.blockingIssues?.length ?? 0) === 0 && v.risk !== "BLOCKED" };
}
const flagged = (draft, flag) => { const d = JSON.parse(JSON.stringify(draft)); d.metadata = { ...(d.metadata || {}), [flag]: true }; return d; };
const noModel = { integrity: async () => { throw new Error("no provider in tests"); }, legal: async () => { throw new Error("no provider in tests"); } };

/* ── 1. Regression: the frozen refusals ───────────────────────────────────── */
for (const c of FROZEN.cases) {
  ok(c.shown.blocking === 0 && c.export_refused_by.length > 0,
    `frozen evidence: ${c.document_type} was shown '${c.shown.certification}' and its export was refused (${[...new Set(c.export_refused_by.map((b) => b.rule_id))].join(", ")})`);
  const g = await exportGate(c.draft);
  ok(g.canExport, `${c.document_type} (${c.flag}) now exports`);
}

/* ── 2. Parity across the corpus ──────────────────────────────────────────── */
let worlds = 0, exported = 0;
const refusals = [];
let msa = null;
for (const type of Object.keys(DOCUMENT_CONFIG)) {
  for (const profile of Object.values(FIXTURE_PROFILE)) {
    const r = await generateDocument({ document_type: type, variables: variablesFor(type, { profile }) });
    if (!r.draft || r.validation.blockingIssues.length) continue;
    if (type === "MASTER_SERVICE_AGREEMENT" && profile === FIXTURE_PROFILE.WELL_FILLED) msa = r;
    worlds++;
    for (const variant of ["plain", "ai_touched", "user_edited"]) {
      const draft = variant === "plain" ? JSON.parse(JSON.stringify(r.draft)) : flagged(r.draft, variant);
      const g = await exportGate(draft);
      if (!g.canExport) refusals.push(`${type}/${profile}/${variant}: ${g.v.blockingIssues.map((i) => i.rule_id).join(",")}`);
      else exported++;
    }
  }
}
ok(refusals.length === 0 && worlds > 30,
  `parity: every one of ${worlds} drafts shown without a blocking issue exports, plain, AI-touched and edited (${exported} exports)${refusals.length ? `; refused: ${refusals.join("; ")}` : ""}`);
const g = await exportGate(flagged(msa.draft, "user_edited"));
const [docx, pdf] = await Promise.all([draftToDocx(g.exportDraft), draftToPdf(g.exportDraft)]);
ok(docx.length > 1000 && pdf.length > 1000 && /SERVICE|Agreement/i.test(draftToText(g.exportDraft)),
  "the export produces a DOCX and a PDF for a document that was refused before");

/* ── 3. Positive: tampering an edit introduced still blocks ──────────────── */
const base = flagged(msa.draft, "user_edited");
const target = base.clauses.find((c) => c.clause_id === "SERVICE_TERMINATION_001");
const edit = (text) => ({ ...base, clauses: base.clauses.map((c) => (c.clause_id === target.clause_id ? { ...c, text } : c)) });
const blocks = async (draft, rule) => (await exportGate(draft)).v.blockingIssues.some((i) => i.rule_id === rule && i.offending_clause_id === target.clause_id);
ok(await blocks(edit(`${target.text} lol hacked`), "CLAUSE_TAMPER_DETECTED"), "positive: a stray fragment appended to a clause blocks export");
ok(await blocks(edit(target.text.replace(/\bParty\b/, "Partyyyy")), "AI_INTEGRITY_VIOLATION"), "positive: a malformed token the edit introduced blocks export");
ok(await blocks(edit(`and ${target.text}`), "AI_INTEGRITY_VIOLATION"), "positive: an edit that turns the clause into a lowercase fragment blocks export");

/* ── 4. Negative: legitimate drafting in an edit passes ──────────────────── */
ok(!(await blocks(edit(`${target.text} (iii) Either Party may also terminate on the insolvency of the other.`), "AI_INTEGRITY_VIOLATION")),
  "negative: an edit adding '(iii)' is not a malformed token");
ok(!(await blocks(edit(`${target.text} The fees in Schedule III shall remain payable.`), "AI_INTEGRITY_VIOLATION")),
  "negative: 'Schedule III' is not a malformed token");
ok(!(await blocks(edit(`(a) ${target.text}`), "AI_INTEGRITY_VIOLATION")),
  "negative: a clause opening with an enumerator '(a)' is not a lowercase fragment");

/* ── 5. Boundary: what is judged ─────────────────────────────────────────── */
ok((await aiLegalSafetyValidate(flagged(msa.draft, "user_edited"), { isUserEdit: true, reviewers: noModel })).length === 0,
  "boundary: a draft in which nothing changed has nothing judged as an edit");
const one = edit(`${target.text} Each Party shall act in good faith.`);
const judged = [];
await aiLegalSafetyValidate(one, { isUserEdit: true, reviewers: { integrity: async (cl) => { judged.push(...cl.map((c) => c.clause_id)); return []; }, legal: async () => [] } });
ok(judged.length === 1 && judged[0] === target.clause_id, "boundary: only the edited clause is sent for review");
const legacy = { ...JSON.parse(JSON.stringify(msa.draft)), metadata: { user_edited: true } };
ok((await aiLegalSafetyValidate(legacy, { isUserEdit: true, reviewers: noModel })).every((i) => !i.blocks_generation),
  "boundary: a legacy save with no drafted baseline is judged in full, and the engine's own wording passes");

/* ── 6. A model's verdict asks for a lawyer; it does not refuse the download ─ */
const verdict = await aiLegalSafetyValidate(one, { isUserEdit: true, reviewers: {
  integrity: async () => [{ clause_id: target.clause_id, reason: "reads oddly" }],
  legal: async () => [{ category_id: "OUSTER_OF_COURTS", clause_id: target.clause_id, confidence: "HIGH", explanation: "may restrict recourse to courts" }],
} });
ok(verdict.length === 2 && verdict.every((i) => i.blocks_generation === false && i.release_outcome === "REQUIRES_LEGAL_REVIEW" && i.verified_authority === false),
  "a model's integrity or legal verdict is 'Requires legal review', never a block");
ok(verdict.find((i) => i.rule_id === "AI_SEMANTIC_OUSTER_OF_COURTS").concern_severity === "CRITICAL" && /not a verified legal conclusion/.test(verdict[1].message),
  "the concern's weight is kept and the finding says it is not a verified conclusion");
const v = await runDocumentValidation(one, { mode: "background", documentType: "MASTER_SERVICE_AGREEMENT", sourceVariables: one.metadata.source_variables,
  extraIssues: verdict });
ok(v.certification === "Requires legal review" && v.blockingIssues.length === 0, "the release outcome shows it: 'Requires legal review'");

console.log(`\nexportParity: ${checks} checks passed`);
process.exit(0);
