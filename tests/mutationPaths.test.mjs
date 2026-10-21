/**
 * mutationPaths.test.mjs — D4.47
 *
 * Every path that changes clause text after rendering is listed in
 * governance/mutation-paths.json and guarded; this verifies each entry against
 * the code, then attacks the guard with changes that keep every number but
 * change the meaning, and records honestly what it still does not catch.
 * Also: export fidelity (DOCX), and release-outcome precedence on mixed
 * findings (a blocking contradiction with missing information).
 */
import assert from "node:assert";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(new URL("../backend/package.json", import.meta.url));
const JSZip = require("jszip");
const { generateDocument, mergeAIDraftWithSeed } = await import("../backend/services/documentService.js");
const { runDocumentValidation, formatValidationResult } = await import("../backend/services/validationService.js");
const { prepareExportDraft, guardChatEdits } = await import("../backend/services/mutationEntryPoints.js");
const G = await import("../backend/services/mutationGuard.js");
const { draftToDocx, draftToText } = await import("../backend/services/exportService.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");
const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PATHS = JSON.parse(read("knowledge-base/governance/mutation-paths.json"));
const suite = JSON.parse(read("package.json")).scripts.test;

/* ── 1. The inventory matches the code ───────────────────────────────────── */
for (const p of PATHS.paths) {
  const file = p.where.split(" ")[0];
  const src = read(file) + (p.where.includes("mutationEntryPoints") ? read("backend/services/mutationEntryPoints.js") : "");
  assert.ok(src.includes(p.code_marker), `${p.id}: ${file} no longer contains ${p.code_marker}`);
  assert.ok(suite.includes(p.verified_by), `${p.id}: ${p.verified_by} is not in the suite`);
}
ok(PATHS.paths.length === 6, `all ${PATHS.paths.length} listed mutation paths are guarded where the record says, and each names a test in the suite`);
const index = read("backend/index.js");
ok(!/applyDocumentQualityControls\(draft/.test(index) && /prepareExportDraft\(/.test(index) && /guardChatEdits\(/.test(index),
  "the export and chat handlers go through the guarded entry points, not around them");

/* ── 2. AI tailoring: meaning, not only numbers ──────────────────────────── */
const loanVars = { ...variablesFor("LOAN_AGREEMENT", { profile: FIXTURE_PROFILE.WELL_FILLED }) };
const loan = await generateDocument({ document_type: "LOAN_AGREEMENT", variables: loanVars });
const seed = { ...loan.draft, clauses: loan.draft.clauses.map((c) => ({ ...c, _seed_text: c.text })) };
const parties = G.partyNamesOf(seed);
ok(parties.size >= 2, `party names are read from the draft itself (${[...parties].join(", ")})`);
let P1, P2, target;
for (const c of seed.clauses) {
  if (G.isProtectedClause(c) || !/\b(not|no|without)\b/.test(c.text)) continue;
  const actor = [...parties].find((p) => new RegExp(`\\b${p}\\b\\s+shall\\b`).test(c.text));
  if (actor) { target = c; P1 = actor; P2 = [...parties].find((p) => p !== actor); break; }
}
assert.ok(target && P2, "a clause with a party obligation and a negation to attack");
const tryAI = (text) => {
  const merged = mergeAIDraftWithSeed(seed, { document_type: "LOAN_AGREEMENT", clauses: [{ clause_id: target.clause_id, text }] }, { document_type: "LOAN_AGREEMENT", variables: loanVars }, "test");
  const refusal = (merged.metadata.refused_mutations || []).find((r) => r.clause_id === target.clause_id && r.source === "ai_tailoring");
  return refusal ? refusal.reasons.map((r) => r.code) : [];
};
const ATTACKS = {
  NEGATION_CHANGED: target.text.replace(/\b(not|no|without)\b\s*/, ""),
  OBLIGATION_CHANGED: target.text.replace(new RegExp(`(${P1}\\s+)shall\\b`), "$1may"),
  PARTY_CHANGED: target.text.split(P1).join("\u0000").split(P2).join(P1).split("\u0000").join(P2),
  CONDITION_CHANGED: `${target.text.replace(/\.$/, "")}, unless the Parties agree otherwise in writing.`,
  REMEDY_CHANGED: `${target.text.replace(/\.$/, "")}, failing which the other Party may claim damages.`,
};
for (const [code, text] of Object.entries(ATTACKS)) {
  assert.ok(tryAI(text).includes(code), `${code} not caught: ${text.slice(0, 160)}`);
}
ok(true, "positive: an AI rewrite that keeps every figure but drops a negation, weakens 'shall' to 'may', exchanges the parties, adds an exception or adds a remedy is refused");
const reworded = `For the avoidance of doubt, ${target.text.charAt(0).toLowerCase()}${target.text.slice(1)}`;
ok(reworded !== target.text && tryAI(reworded).length === 0,
  "negative: a rewording that keeps every figure, obligation, condition, remedy and party is accepted");
ok(G.refusalReasons({ clause_id: "X", text: "The Borrower shall repay within three years." }, { clause_id: "X", text: "The Borrower shall repay within five years." }, { introducedFiguresForbidden: true })
  .some((r) => r.code === "FIGURE_INTRODUCED"), "positive: a period written in words ('three' to 'five') is a figure the AI may not change");

// What the guard does NOT catch, asserted so the record cannot drift.
const pass = (a, b) => G.refusalReasons({ clause_id: "X", text: a }, { clause_id: "X", text: b }, { introducedFiguresForbidden: true, partyNames: new Set(["Lender", "Borrower"]) }).length === 0;
const GAPS = [
  ["The Borrower shall repay all sums due.", "The Borrower shall repay any sums due."],
  ["The Lender shall give notice before enforcement.", "The Lender shall give notice after enforcement."],
  ["The Lender shall act reasonably in deciding.", "The Lender shall act in its sole discretion in deciding."],
];
ok(GAPS.every(([a, b]) => pass(a, b)) && PATHS.meaning_markers.not_caught.length >= 3,
  "recorded gaps hold as recorded: scope quantifiers, temporal order and standards of conduct still pass the guard");

/* ── 3. Chat edits ───────────────────────────────────────────────────────── */
const interest = loan.draft.clauses.find((c) => /\d+(?:\.\d+)?\s*%/.test(c.text) && !G.isProtectedClause(c));
const rate = interest.text.match(/(\d+(?:\.\d+)?)\s*%/)[1];
const chat = (edits, message) => guardChatEdits(loan.draft, { type: "edit", reply: "Done.", edits }, message);
const identity = loan.draft.clauses.find((c) => G.isProtectedClause(c));
const r1 = chat([{ clause_id: identity.clause_id, new_text: "Rewritten." }], "rewrite the parties clause");
ok(r1.type === "reply" && r1.edits.length === 0 && r1.refused[0].reasons[0].code === "PROTECTED_CLAUSE" && /Not applied/.test(r1.reply),
  "chat: an edit to a locked clause is refused and the user is told why");
const lowered = interest.text.replace(`${rate}%`, "9%");
ok(chat([{ clause_id: interest.clause_id, new_text: lowered }], "please change the interest rate to 9%").edits.length === 1,
  "chat: a figure the user typed in the request is theirs to introduce");
ok(chat([{ clause_id: interest.clause_id, new_text: lowered }], "make the interest fairer").refused?.some((r) => r.reasons.some((x) => x.code === "FIGURE_INTRODUCED")),
  "chat: a figure the user did not ask for is refused");
ok(chat([{ clause_id: interest.clause_id, new_text: interest.text.replace(/\bshall\b/, "may") }], "tidy the wording").refused?.length === 1,
  "chat: wording that weakens an obligation is refused");

/* ── 4. Export: fixed point on engine drafts, and DOCX fidelity ──────────── */
let drafts = 0; const moved = [], lost = [];
for (const type of Object.keys(DOCUMENT_CONFIG)) {
  for (const profile of Object.values(FIXTURE_PROFILE)) {
    const r = await generateDocument({ document_type: type, variables: variablesFor(type, { profile }) });
    if (!r.draft) continue;
    drafts++;
    const { draft: e, refused } = prepareExportDraft(JSON.parse(JSON.stringify(r.draft)));
    if (refused.length || e.clauses.some((c, i) => c.text !== r.draft.clauses[i].text)) moved.push(`${type}/${profile}`);
    const zip = await JSZip.loadAsync(await draftToDocx(e));
    // Paragraph and run boundaries become spaces: "1962." ending one paragraph and
    // "17.5" opening the next must not read as one number.
    const xml = (await zip.file("word/document.xml").async("string")).replace(/<\/w:p>|<w:tab\/>|<w:br\/>/g, " \n ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
    const inDocx = G.figuresIn(xml);
    const missing = [...G.figuresIn(e.clauses.map((c) => c.text).join("\n"))].filter((n) => !inDocx.has(n));
    if (missing.length) lost.push(`${type}/${profile}: ${missing.slice(0, 5).join(",")}`);
  }
}
ok(moved.length === 0, `export quality controls are a fixed point on all ${drafts} engine drafts${moved.length ? ` (moved: ${moved.join(", ")})` : ""}`);
ok(lost.length === 0, `DOCX fidelity: every figure in the draft text is in the exported document, on all ${drafts} drafts${lost.length ? ` (lost: ${lost.join("; ")})` : ""}`);

/* ── 5. Mixed findings: a blocking contradiction with missing information ── */
const nda = JSON.parse(read("tests/fixtures/ndaContradiction.D4_46.json"));
const info = { rule_id: "REQUIREMENT_APPLICABILITY_UNRESOLVED", severity: "MEDIUM", release_outcome: "REQUIRES_INFORMATION", manual_review_required: true, layer: "requirements", requirement_id: "PROBE", message: "a fact was not established" };
const mixed = await runDocumentValidation(nda.draft, { mode: "final", documentType: "NDA", sourceVariables: nda.variables, extraIssues: [info] });
ok(mixed.certification === "Blocked" && mixed.release_outcome === "BLOCKED" && mixed.blockingIssues.some((i) => i.rule_id === "MATERIAL_CONTRADICTION"),
  "mixed findings: a blocking contradiction with missing information shows Blocked");
ok(mixed.advisoryIssues.some((i) => i.release_outcome === "REQUIRES_INFORMATION" && i.requirement_id === "PROBE"),
  "and the missing-information finding is kept in the detailed report");
const review = { ...info, rule_id: "X_REVIEW", release_outcome: "REQUIRES_LEGAL_REVIEW", requirement_id: "PROBE2" };
const ordered = formatValidationResult({ issues: [review, info, { rule_id: "C", severity: "CRITICAL", blocks_generation: true, message: "c" }] });
ok(ordered.release_outcome === "BLOCKED" && ordered.advisoryIssues.length === 2,
  "every lower outcome's finding survives under a block; none is dropped to make the label tidy");

console.log(`\nmutationPaths: ${checks} checks passed`);
process.exit(0);
