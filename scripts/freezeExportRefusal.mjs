/**
 * freezeExportRefusal.mjs — D4.47. Run once, against the pre-fix engine:
 *   node scripts/freezeExportRefusal.mjs <out.json>
 * Captures documents the engine showed as passing or advisory-only, which the
 * export endpoint then refused: the export re-validates in "final" mode, where
 * the AI safety layer runs for any AI-touched or user-edited draft, and its
 * deterministic tamper heuristics flagged the engine's own wording.
 */
const out = process.argv[2];
const fs = await import("fs");
const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { applyDocumentQualityControls } = await import("../backend/services/documentQualityControl.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

async function exportGate(draft) {
  const exportDraft = applyDocumentQualityControls(draft, { document_type: draft.document_type, variables: draft?.metadata?.source_variables || {} });
  const v = await runDocumentValidation(exportDraft, { mode: "final", documentType: exportDraft.document_type, sourceVariables: exportDraft?.metadata?.source_variables });
  return v.blockingIssues.map((i) => ({ rule_id: i.rule_id, clause_id: i.offending_clause_id, message: i.message }));
}
const cases = [];
for (const [type, flag] of [["MASTER_SERVICE_AGREEMENT", "ai_touched"], ["SETTLEMENT_AGREEMENT", "ai_touched"], ["DATA_PROCESSING_AGREEMENT", "user_edited"]]) {
  const variables = variablesFor(type, { profile: FIXTURE_PROFILE.WELL_FILLED });
  const r = await generateDocument({ document_type: type, variables });
  const draft = JSON.parse(JSON.stringify(r.draft));
  delete draft.metadata.provenance;
  draft.metadata[flag] = true; // what the AI path, or any edit in the editor, sets
  cases.push({ document_type: type, flag, shown: { certification: r.validation.certification, score: r.validation.score, blocking: r.validation.blockingIssues.length },
    export_refused_by: await exportGate(draft), draft });
}
fs.writeFileSync(out, JSON.stringify({
  $comment: [
    "Frozen 16 Oct 2026 (D4.47) from the D4.46 engine (commit 39422d779). Never regenerate: the point is the OLD behaviour.",
    "Each document was shown with no blocking issue, and the export endpoint refused it. MASTER_SERVICE_AGREEMENT was shown 'Automated checks passed' at 100.",
    "Causes: '(iii)' and 'Schedule III' read as a malformed repeated-character token; a clause opening with '(a)' read as a lowercase fragment; and with nothing changed, every clause was judged as if edited.",
    "tests/exportParity.test.mjs requires the current export gate to pass each of these drafts.",
  ],
  captured_from_commit: "39422d779",
  cases,
}, null, 1) + "\n");
for (const c of cases) console.log(c.document_type, c.flag, JSON.stringify(c.shown), "->", c.export_refused_by.map((b) => b.rule_id + "@" + b.clause_id).join(", "));
process.exit(0);
