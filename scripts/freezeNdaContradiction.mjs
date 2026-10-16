/**
 * freezeNdaContradiction.mjs — D4.46. Run once, against a worktree of the pre-D4.46
 * commit: node scripts/freezeNdaContradiction.mjs <worktree> <out.json>
 * Captures the NDA the old engine shipped as "Automated checks passed" although
 * its clauses state three different periods.
 */
const root = process.argv[2], out = process.argv[3];
const fs = await import("fs");
const { generateDocument } = await import(root + "/backend/services/documentService.js");
const { draftToText } = await import(root + "/backend/services/exportService.js");
const { variablesFor, FIXTURE_PROFILE } = await import(root + "/sweep.mjs");
const variables = variablesFor("NDA", { profile: FIXTURE_PROFILE.WELL_FILLED });
const r = await generateDocument({ document_type: "NDA", variables });
const pick = (id) => r.draft.clauses.find((c) => c.clause_id === id);
const clauses = ["NDA_DURATION_001", "NDA_TERM_SURVIVAL_001"].map((id) => ({ clause_id: id, title: pick(id)?.title, text: pick(id)?.text }));
const fixture = {
  $comment: [
    "Frozen 16 Oct 2026 (D4.46) from the pre-D4.46 engine (commit 8c73f15b6). Never regenerate: the point is the OLD output.",
    "The NDA states confidentiality for the user's period (here 24 months) in Duration of Confidentiality, and a fixed two-year term with three further years of survival in Term and Survival, and was certified 'Automated checks passed'.",
    "tests/ndaContradiction.test.mjs requires the current validation to block this exact draft, and the current engine not to produce it.",
  ],
  captured_from_commit: "8c73f15b6",
  document_type: "NDA",
  variables,
  old_validation: { score: r.validation.score, certification: r.validation.certification, blocking: r.validation.blockingIssues.map((i) => i.rule_id), advisory: r.validation.advisoryIssues.map((i) => i.rule_id), relationships: (r.requirements?.relationships || []).map((x) => ({ id: x.id, coverage: x.coverage, read: x.read, silent: x.silent })) },
  clauses,
  draft: r.draft,
  text: draftToText(r.draft),
};
fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log(JSON.stringify(fixture.old_validation), "\n", clauses.map((c) => c.clause_id + ": " + c.text).join("\n\n"));
process.exit(0);
