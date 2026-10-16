/**
 * generationIntegrity.test.mjs — D4.46
 *
 * The user's agreed terms survive every machine change: deterministic repair,
 * AI tailoring and /fix-issue. Locks hold on every path. The AI is checked
 * against the text as it was BEFORE any AI change.
 *
 * Positive (the defect is caught), negative (legitimate change passes), boundary
 * (reformatting, new clauses, user edits) and regression (the frozen old output).
 */
import assert from "node:assert";
import fs from "fs";
import { createHash } from "crypto";

const { applyDeterministicFixes } = await import("../backend/services/deterministicFixer.js");
const G = await import("../backend/services/mutationGuard.js");
const { mergeAIDraftWithSeed, generateDocument } = await import("../backend/services/documentService.js");
const { repairDocumentIssue } = await import("../backend/services/issueRepairService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { illegalClauseValidate } = await import("../IRE/src/indian-rule-engine/illegalClauseValidator.js");
const { draftToText } = await import("../backend/services/exportService.js");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/repairOverride.D4_46.json", import.meta.url), "utf8"));
const sha = (t) => createHash("sha256").update(String(t)).digest("hex");

/* ── 1. Regression: what the old repair did, and what the repair does now ── */
for (const c of FROZEN.cases) {
  ok(c.before !== c.after_old_repair, `frozen evidence: the pre-D4.46 repair changed ${c.case} (${c.before.match(/\d+\s*(?:%|days)/)[0]} → ${c.after_old_repair.match(/\d+\s*(?:%|days)/)[0]})`);
  const draft = { document_type: c.document_type, clauses: [{ clause_id: c.clause_id, category: "FINANCE", text: c.before }] };
  const after = applyDeterministicFixes(draft, [c.issue]);
  ok(after.clauses[0].text === c.before, `${c.case}: the repair now leaves the user's value exactly as entered`);
}

/* ── 2. End to end: a 48% loan keeps 48% and is flagged, not rewritten ──── */
const loanCase = FROZEN.cases.find((c) => c.case === "LOAN_48_PERCENT");
const loan = await generateDocument({ document_type: "LOAN_AGREEMENT", variables: loanCase.variables });
const loanText = draftToText(loan.draft);
ok(/48%/.test(loanText) && /50%/.test(loanText) && !/\b24%/.test(loanText), "a 48% loan ships at 48% (default 50%), never 24%");
const findings = [...loan.validation.blockingIssues, ...loan.validation.advisoryIssues].map((i) => i.rule_id);
ok(findings.includes("USURIOUS_INTEREST_RATE"), "the concern is flagged separately, as a finding the user sees");
const usury = illegalClauseValidate(loan.draft).find((i) => i.rule_id === "USURIOUS_INTEREST_RATE");
ok(usury?.auto_fixable === true && applyDeterministicFixes(loan.draft, [usury]).clauses.every((c, i) => c.text === loan.draft.clauses[i].text),
  "even with the finding marked auto-fixable and a clause id, the repair changes no clause text");

/* ── 3. The guard: boundaries ───────────────────────────────────────────── */
const figs = G.userValueFigures({ interest_rate: "48", loan_amount: "500000", lender_pan: "AAACA1234C", effective_date: "2026-10-01" }, { interest_rate: { type: "number" }, loan_amount: { type: "number" } });
ok(figs.has(48) && figs.has(500000) && !figs.has(1234) && ![...figs.keys()].some((n) => n === 2026),
  "user figures are terms (rate, amount); identifiers and dates are not counted");
const c = (text, extra = {}) => ({ clause_id: "X", category: "FINANCE", text, ...extra });
ok(G.refusalReasons(c("interest at 48% p.a."), c("interest at 24% p.a."), { userFigures: figs }).some((r) => r.code === "USER_VALUE_REMOVED"),
  "positive: removing a user figure is refused");
ok(G.refusalReasons(c("a loan of ₹5,00,000"), c("a loan of Rs. 500000"), { userFigures: figs }).length === 0,
  "boundary: re-formatting a figure (₹5,00,000 → Rs. 500000) is not a change of value");
ok(G.refusalReasons(c("interest at 48% p.a."), c("interest at the rate of 48% per annum"), { userFigures: figs, introducedFiguresForbidden: true }).length === 0,
  "negative: rewording that keeps every figure is allowed, even for the AI");
ok(G.refusalReasons(c("payable monthly"), c("payable within 30 days"), { userFigures: figs, introducedFiguresForbidden: true }).some((r) => r.code === "FIGURE_INTRODUCED"),
  "positive: the AI may not introduce a figure the clause did not carry");
ok(G.refusalReasons(c("payable monthly"), c("payable within 30 days"), { userFigures: figs }).length === 0,
  "boundary: the deterministic engine adding a figure is not judged by the AI rule");
ok(G.refusalReasons(c("Signed by A", { category: "SIGNATURE_BLOCK" }), c("Signed by B", { category: "SIGNATURE_BLOCK" })).some((r) => r.code === "PROTECTED_CLAUSE"),
  "positive: a protected clause may not be changed");
const guarded = G.guardDraftMutation({ clauses: [c("48%")] }, { clauses: [c("24%"), { clause_id: "NEW", text: "new 10%" }] }, { userFigures: figs, source: "test" });
ok(guarded.draft.clauses[0].text === "48%" && guarded.draft.clauses[1].clause_id === "NEW" && guarded.draft.metadata.refused_mutations.length === 1,
  "a refused change keeps the previous text; an added clause is allowed; the refusal is recorded");

/* ── 4. AI tailoring ────────────────────────────────────────────────────── */
const input = { document_type: "LOAN_AGREEMENT", variables: loanCase.variables };
const seed = { ...loan.draft, clauses: loan.draft.clauses.map((cl) => ({ ...cl, _seed_text: cl.text })) };
const interest = seed.clauses.find((cl) => cl.clause_id === loanCase.clause_id);
const someOther = seed.clauses.find((cl) => !G.isProtectedClause(cl) && cl.clause_id !== interest.clause_id && !/\d/.test(cl.text));
const identity = seed.clauses.find((cl) => G.isProtectedClause(cl));
const ai = (edits) => ({ document_type: "LOAN_AGREEMENT", clauses: edits });
const m1 = mergeAIDraftWithSeed(seed, ai([{ clause_id: interest.clause_id, text: interest.text.replace(/48%/g, "24%") }]), input, "test");
ok(m1.clauses.find((cl) => cl.clause_id === interest.clause_id).text.includes("48%") &&
   m1.metadata.refused_mutations?.some((r) => r.source === "ai_tailoring" && r.clause_id === interest.clause_id),
  "AI that changes 48% to 24% is refused: the deterministic clause is kept and the refusal recorded");
const m2 = mergeAIDraftWithSeed(seed, ai([{ clause_id: someOther.clause_id, text: `${someOther.text} (as tailored)` }]), input, "test");
const tailoredClause = m2.clauses.find((cl) => cl.clause_id === someOther.clause_id);
ok(tailoredClause.text.includes("as tailored") && tailoredClause._ai_text_sha && m2.metadata.pre_ai_baseline[someOther.clause_id] === someOther.text,
  "negative: AI rewording with no figure change is accepted and stamped; the pre-AI text is kept immutably");
const m3 = mergeAIDraftWithSeed(seed, ai([{ clause_id: identity.clause_id, text: "THIS AGREEMENT is between nobody." }]), input, "test");
ok(m3.clauses.find((cl) => cl.clause_id === identity.clause_id).text !== "THIS AGREEMENT is between nobody.", "AI cannot change a protected clause");

/* ── 5. The independent check uses the immutable pre-AI baseline ───────── */
// Bypass the merge guard to simulate an AI change that got through, then reset
// baseline_clause_map to the AI text exactly as the engine does after a merge.
const bypass = JSON.parse(JSON.stringify(m2));
const tampered = bypass.clauses.find((cl) => cl.clause_id === interest.clause_id);
tampered.text = tampered.text.replace(/48%/, "24%");
tampered._ai_text_sha = sha(tampered.text);
bypass.metadata.pre_ai_baseline[interest.clause_id] = interest.text;
bypass.metadata.baseline_clause_map = Object.fromEntries(bypass.clauses.map((cl) => [cl.clause_id, { text: cl.text }]));
const v = await runDocumentValidation(bypass, { mode: "background", documentType: "LOAN_AGREEMENT", sourceVariables: loanCase.variables });
ok(v.blockingIssues.some((i) => i.rule_id === "AI_CHANGED_AGREED_TERMS" && i.offending_clause_id === interest.clause_id),
  "an AI change of 48% to 24% is caught and blocks, although baseline_clause_map was reset to the AI text");
const userEdited = JSON.parse(JSON.stringify(bypass));
userEdited.clauses.find((cl) => cl.clause_id === interest.clause_id).text = interest.text.replace(/48%/, "36%");
const v2 = await runDocumentValidation(userEdited, { mode: "background", documentType: "LOAN_AGREEMENT", sourceVariables: loanCase.variables });
ok(!v2.blockingIssues.some((i) => i.rule_id === "AI_CHANGED_AGREED_TERMS"), "negative: the user's own later edit is not judged as an AI change");
const plain = await runDocumentValidation(loan.draft, { mode: "background", documentType: "LOAN_AGREEMENT", sourceVariables: loanCase.variables });
ok(!plain.coverage?.layers_run?.includes?.("ai_integrity") && !plain.blockingIssues.some((i) => i.rule_id === "AI_CHANGED_AGREED_TERMS"),
  "negative: a deterministic draft (no AI) is not subject to the AI check");

/* ── 6. /fix-issue ──────────────────────────────────────────────────────── */
const loanDraft = { ...loan.draft, metadata: { ...loan.draft.metadata, source_variables: loanCase.variables } };
const fakeAI = (edits) => async () => ({ edits, explanation: "fake" });
const r1 = await repairDocumentIssue(loanDraft, usury, { aiFix: fakeAI([{ clause_id: interest.clause_id, new_text: interest.text.replace(/48%/g, "24%") }]) });
ok(r1.fixed === false && r1.refused?.some((x) => x.reasons.some((r) => r.code === "USER_VALUE_REMOVED")) &&
   r1.draft.clauses.find((cl) => cl.clause_id === interest.clause_id).text.includes("48%"),
  "/fix-issue: an AI 'fix' that changes the user's rate is refused, and the user is told why");
const r2 = await repairDocumentIssue(loanDraft, usury, { aiFix: fakeAI([{ clause_id: identity.clause_id, new_text: "Rewritten identity." }]) });
ok(r2.fixed === false && r2.refused?.some((x) => x.clause_id === identity.clause_id && x.reasons.some((r) => r.code === "PROTECTED_CLAUSE")),
  "/fix-issue: an AI edit to a locked clause is refused");

/* ── 7. One definition of a protected clause ────────────────────────────── */
const lockerSrc = fs.readFileSync(new URL("../backend/services/clauseLocker.js", import.meta.url), "utf8");
const serviceSrc = fs.readFileSync(new URL("../backend/services/documentService.js", import.meta.url), "utf8");
ok(/PROTECTED_CATEGORIES/.test(lockerSrc) && !/PROTECTED_SEMANTIC_CATEGORIES = new Set/.test(serviceSrc),
  "the clause locker and the AI merge read the same protected set");
ok(/createDeterministicBaseDraft\(generationInput\), generationInput\)/.test(serviceSrc),
  "the AI starts from the variable-injected draft, so its baseline carries the user's values");

console.log(`\ngenerationIntegrity: ${checks} checks passed`);
process.exit(0);
