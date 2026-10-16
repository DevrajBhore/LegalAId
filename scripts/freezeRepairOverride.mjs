/**
 * freezeRepairOverride.mjs — D4.46. Run once, against a worktree of the pre-D4.46
 * commit: node scripts/freezeRepairOverride.mjs <worktree> <out.json>
 */
// Run against the PRE-D4.46 engine (worktree of 8c73f15b6). Captures what its
// repair did to user values, as frozen regression evidence.
const root = process.argv[2], out = process.argv[3];
const fs = await import("fs"); const crypto = await import("crypto");
const { generateDocument } = await import(root + "/backend/services/documentService.js");
const { applyDeterministicFixes } = await import(root + "/backend/services/deterministicFixer.js");
const { illegalClauseValidate } = await import(root + "/IRE/src/indian-rule-engine/illegalClauseValidator.js");
const { variablesFor, FIXTURE_PROFILE } = await import(root + "/sweep.mjs");
const cases = [];
const loanVars = { ...variablesFor("LOAN_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }), interest_rate: "48", default_interest_rate: "50", principal_amount: "500000", loan_amount: "500000" };
const loan = await generateDocument({ document_type: "LOAN_AGREEMENT", variables: loanVars });
const issues = illegalClauseValidate(loan.draft).filter((i) => i.rule_id === "USURIOUS_INTEREST_RATE");
const fixed = applyDeterministicFixes(loan.draft, issues);
const id = issues[0].offending_clause_id;
cases.push({ case: "LOAN_48_PERCENT", document_type: "LOAN_AGREEMENT", variables: loanVars, issue: issues[0],
  clause_id: id, before: loan.draft.clauses.find((c) => c.clause_id === id).text, after_old_repair: fixed.clauses.find((c) => c.clause_id === id).text });
// MSME: a synthetic clause, since no corpus family surfaces MSME_PAYMENT_DELAY with a clause id under the fixture.
const msmeDraft = { document_type: "SUPPLY_AGREEMENT", clauses: [{ clause_id: "PAYMENT_TERMS_001", category: "PAYMENT", text: "The Buyer shall pay each invoice within 90 days of receipt." }] };
const msmeFixed = applyDeterministicFixes(msmeDraft, [{ rule_id: "MSME_PAYMENT_DELAY", auto_fixable: true, offending_clause_id: "PAYMENT_TERMS_001" }]);
cases.push({ case: "MSME_90_DAYS", document_type: "SUPPLY_AGREEMENT", variables: { payment_terms_days: "90" }, issue: { rule_id: "MSME_PAYMENT_DELAY", auto_fixable: true, offending_clause_id: "PAYMENT_TERMS_001" },
  clause_id: "PAYMENT_TERMS_001", before: msmeDraft.clauses[0].text, after_old_repair: msmeFixed.clauses[0].text });
const fixture = { $comment: ["Frozen 16 Oct 2026 (D4.46) from the pre-D4.46 engine (commit 8c73f15b6). What its deterministic repair did to values the user entered.", "Never regenerate: the point is the OLD behaviour. tests/generationIntegrity.test.mjs requires the current repair to leave 'before' unchanged."], captured_from_commit: "8c73f15b6", cases };
fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
for (const c of cases) console.log(c.case, "|", c.before.match(/\d+\s*(?:%|days)/g)?.slice(0,3), "->", c.after_old_repair.match(/\d+\s*(?:%|days)/g)?.slice(0,3));
process.exit(0);
