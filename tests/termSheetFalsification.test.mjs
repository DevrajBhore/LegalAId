/**
 * termSheetFalsification.test.mjs — D4.44
 *
 * The term sheet that shipped on 9 Oct 2026 contradicted itself on whether it
 * binds and scored 100 / "No issues detected". It is frozen in
 * tests/fixtures/termSheet.D4_44.defective.json. This file proves, in order:
 *
 *   1. the frozen sample is the old output, unaltered;
 *   2. the coherence checks fail it, for each defect it is known to have;
 *   3. full validation no longer passes it;
 *   4. the rebuilt term sheet passes the same checks;
 *   5. each check catches its defect when the defect is planted in the NEW output
 *      (a gate is unproven until it catches a planted defect);
 *   6. open choices are marked, never filled; input outcome classes stay apart;
 *   7. the defects found on the way (a party's name rewritten, paise dropped) stay fixed.
 */
import assert from "node:assert";
import fs from "fs";
import crypto from "crypto";

const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { validateInstrumentCoherence, validateInstrumentInputs, parseDurationDays } = await import("../backend/services/instrumentCoherence.js");
const { draftToText } = await import("../backend/services/exportService.js");

const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.defective.json", import.meta.url), "utf8"));
const INPUTS = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.inputs.json", import.meta.url), "utf8"));

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; console.log(`PASS  ${msg}`); };

const coherence = (clauses, variables) =>
  validateInstrumentCoherence({ document_type: "TERM_SHEET", clauses }, { documentType: "TERM_SHEET", variables });
const has = (issues, rule, pred = () => true) => issues.some((i) => i.rule_id === rule && pred(i));

/* ── 1. The frozen sample is the old output ─────────────────────────────── */
ok(crypto.createHash("sha256").update(FROZEN.rendered_text).digest("hex") === FROZEN.rendered_text_sha256,
  "frozen sample: rendered text matches its recorded hash");
ok(FROZEN.validation_awarded.score === 100 && FROZEN.validation_awarded.certification === "No issues detected",
  "frozen sample: the old engine awarded it 100 / 'No issues detected'");

/* ── 2. Fails for each named reason ─────────────────────────────────────── */
const old = coherence(FROZEN.clauses, FROZEN.variables);
for (const expected of FROZEN.expected_failures) {
  const match = has(old, expected.rule_id, (i) =>
    (expected.clause_id === undefined || expected.clause_id === null || i.offending_clause_id === expected.clause_id) &&
    (!expected.term || i.term === expected.term) &&
    (!expected.choice || i.choice === expected.choice));
  ok(match, `frozen sample fails: ${expected.defect} (${expected.rule_id}${expected.clause_id ? ` @ ${expected.clause_id}` : ""}${expected.term ? ` ${expected.term}` : ""}${expected.choice ? ` ${expected.choice}` : ""})`);
}
ok(old.filter((i) => i.blocks_generation).length >= 5, "frozen sample: at least five blocking findings");

/* ── 3. Full validation no longer passes it ─────────────────────────────── */
const fullOld = await runDocumentValidation(
  { document_type: "TERM_SHEET", clauses: FROZEN.clauses },
  { mode: "final", documentType: "TERM_SHEET", sourceVariables: FROZEN.variables });
ok(fullOld.blockingIssues.length > 0 && fullOld.certified === false && fullOld.score !== 100,
  `full validation of the frozen sample is blocked (${fullOld.blockingIssues.length} blocking), no longer 100`);

/* ── 4. The rebuilt term sheet passes ───────────────────────────────────── */
const gen = async (variables) => generateDocument({ document_type: "TERM_SHEET", variables });
const complete = await gen(INPUTS.complete);
ok(Boolean(complete.draft), "rebuilt: a complete intake generates a draft");
const newIssues = coherence(complete.draft.clauses, INPUTS.complete);
ok(newIssues.length === 0, `rebuilt: no coherence findings on a complete intake (${newIssues.map((i) => i.rule_id).join(", ") || "none"})`);
const nonWithdrawal = [...complete.validation.blockingIssues, ...complete.validation.advisoryIssues]
  .filter((i) => i.rule_id !== "DOCUMENT_TYPE_WITHDRAWN");
ok(nonWithdrawal.length === 0, `rebuilt: full validation has no finding but the withdrawal notice (${nonWithdrawal.map((i) => i.rule_id).join(", ") || "none"})`);
const text = draftToText(complete.draft);
ok(/^THIS TERM SHEET is dated 9 October 2026/m.test(text) && !/THIS AGREEMENT|made and executed|in consideration of the mutual/i.test(text),
  "rebuilt: opens as a term sheet, with no contract-formation formula anywhere");
ok(!/\bthis Agreement\b/.test(text), "rebuilt: the document never calls itself 'this Agreement'");
const ids = complete.draft.clauses.map((c) => c.clause_id);
ok(!ids.some((id) => /^CORE_(FORCE_MAJEURE|SURVIVAL|ASSIGNMENT|AMENDMENT|WAIVER|SEVERABILITY|ENTIRE_AGREEMENT|FURTHER_ASSURANCE|COUNTERPARTS|DEFINITIONS|INTERPRETATION|NOTICE|STAMP_AND_COSTS)_001$/.test(id)) && !ids.includes("NOTICE_PERIOD_DEFAULT"),
  "rebuilt: none of the general provisions of a binding contract, and no injected termination notice");
for (const name of ["Ananya Rao", "Vikram Shetty"]) {
  ok(new RegExp(`${name}, an individual residing at`).test(text) && new RegExp(`\\n${name}\\n_+\\nName: ${name}`).test(text),
    `rebuilt: founder ${name} is a party and signs`);
}

/* ── 5. Planted defects in the NEW output are caught ────────────────────── */
const plant = (id, fn) => complete.draft.clauses.map((c) => (c.clause_id === id ? { ...c, text: fn(c.text) } : c));
const plants = [
  ["BINDING_STATUS_CONTRADICTED", plant("CORE_IDENTITY_001", (t) => t.replace("The proposed terms are as follows.", "NOW, THEREFORE, in consideration of the mutual covenants herein, the Parties agree as follows:"))],
  ["NON_BINDING_OPERATIVE_LANGUAGE", plant("TS_GOVERNANCE_AND_FOUNDERS_001", (t) => `${t}\nAny transfer of shares in breach of this provision shall be void.`)],
  ["NON_PARTY_OBLIGATION", plant("TS_EXCLUSIVITY_001", (t) => t.replace("the Company and each Founder shall not", "the Company and the Shareholders shall not"))],
  ["ARTICLES_PRECEDENCE_UNSUPPORTED", plant("TS_GOVERNANCE_AND_FOUNDERS_001", (t) => `${t}\nIf this Term Sheet conflicts with the Articles, this Term Sheet shall prevail.`)],
  ["SELF_SUPERSESSION", plant("TS_BINDING_EFFECT_001", (t) => `${t}\nThis Term Sheet supersedes all earlier term sheets.`)],
  ["UNDEFINED_CROSS_REFERENCE", plant("TS_BINDING_EFFECT_001", (t) => t.replace('"Expiry"', '"Termination"'))],
  ["BOARD_SIZE_CONTRADICTION", plant("TS_GOVERNANCE_AND_FOUNDERS_001", (t) => `${t}\nThe board shall comprise such number of directors as agreed.`)],
];
for (const [rule, clauses] of plants) {
  ok(has(coherence(clauses, INPUTS.complete), rule), `planted in the rebuilt output: ${rule} is caught`);
}
ok(has(coherence(complete.draft.clauses.filter((c) => c.clause_id !== "TS_EXPIRY_001"), INPUTS.complete), "REQUIRED_TERM_MISSING", (i) => i.term === "EXPIRY"),
  "planted: removing the Expiry provision is caught as a missing term");
const { option_pool_timing: _omit, ...withoutPoolAnswer } = INPUTS.complete;
ok(has(coherence(complete.draft.clauses, withoutPoolAnswer), "SILENT_DEFAULT", (i) => i.choice === "OPTION_POOL_TIMING"),
  "planted: an option-pool position with no answer behind it is caught as a silent default");
const withBoilerplate = [...complete.draft.clauses, { clause_id: "CORE_FORCE_MAJEURE_001", title: "Force Majeure", text: "Neither Party shall be liable for delay caused by a Force Majeure Event." }];
ok(has(coherence(withBoilerplate, INPUTS.complete), "BINDING_CONTRACT_BOILERPLATE") && has(coherence(withBoilerplate, INPUTS.complete), "BINDING_STATUS_UNDECLARED"),
  "planted: a force majeure clause is caught as boilerplate and as a provision with no declared status");

/* ── 6. Open choices are marked, never filled; outcome classes apart ───── */
const open = await gen(INPUTS.open);
ok(Boolean(open.draft), "open intake: still generates (open points are allowed in non-binding provisions)");
const openText = draftToText(open.draft);
const markers = openText.match(/\[To be agreed: [^\]]+\]/g) || [];
ok(markers.length >= 10, `open intake: ${markers.length} terms are marked 'To be agreed'`);
ok(!/non-participating|broad-based|counted in the pre-money/i.test(openText), "open intake: no economic choice is stated that nobody made");
const openFindings = [...open.validation.blockingIssues, ...open.validation.advisoryIssues];
ok(!openFindings.some((i) => ["UNCERTAINTY_PLACEHOLDER", "AGREEMENT_VOID_FOR_UNCERTAINTY"].includes(i.rule_id)),
  "open intake: the s.29 uncertainty rules are scoped to binding provisions, which have no open points");
ok(has(openFindings, "TERMS_TO_BE_AGREED"), "open intake: the open points are reported instead");
ok(/Section 71\(1\)/.test(openText) && /Non-debt Instruments\) Rules, 2019/.test(openText),
  "open intake: CCD approvals cite s.71(1) and a non-resident investor brings in the NDI Rules");
ok(has(openFindings, "TS_NON_RESIDENT", (i) => i.outcome_class === "LEGAL_REVIEW_REQUIRED") && has(openFindings, "TS_CCD_DEPOSIT", (i) => i.outcome_class === "LEGAL_REVIEW_REQUIRED"),
  "open intake: non-resident investor and CCDs are legal-review findings");

const inputs = (over) => validateInstrumentInputs("TERM_SHEET", { ...INPUTS.complete, ...over });
const outcome = (list, id) => list.find((i) => i.rule_id === id);
const low = inputs({ liquidation_preference_multiple: "0.3" });
ok(outcome(low, "TS_PREFERENCE_BELOW_1X")?.outcome_class === "COMMERCIALLY_UNUSUAL" && !outcome(low, "TS_PREFERENCE_BELOW_1X").blocks_generation,
  "0.3x preference: commercially unusual, not invalid and not blocking");
const long = inputs({ exclusivity_period: "24 months" });
ok(outcome(long, "TS_EXCLUSIVITY_LONG")?.outcome_class === "COMMERCIALLY_UNUSUAL" && outcome(long, "TS_EXCLUSIVITY_VERY_LONG")?.outcome_class === "LEGAL_REVIEW_REQUIRED" && !long.some((i) => i.blocks_generation),
  "24-month exclusivity: unusual and for legal review, not 'unlawful' and not blocking");
ok(outcome(inputs({ liquidation_preference_multiple: "0" }), "TS_PREFERENCE_NOT_POSITIVE")?.blocks_generation === true,
  "0x preference: invalid input, blocks");
ok(outcome(inputs({ term_sheet_expiry_date: "2026-10-01" }), "TS_EXPIRY_NOT_AFTER_DATE")?.outcome_class === "INVALID_INPUT",
  "lapse date before the term sheet's date: invalid input");
ok(outcome(inputs({ exclusivity_period: "until we decide" }), "TS_EXCLUSIVITY_NOT_A_PERIOD")?.outcome_class === "INVALID_INPUT",
  "exclusivity that is not a period: invalid input");
ok(!inputs({}).some((i) => i.outcome_class === "LEGALLY_PROHIBITED"), "no input is classed LEGALLY_PROHIBITED without a verified authority");
ok(parseDurationDays("forty-five days") === 45 && parseDurationDays("sixty (60) days") === 60 && parseDurationDays("3 months") === 90,
  "durations parse in words, words-with-figures and figures");

/* ── 7. Defects found on the way stay fixed ─────────────────────────────── */
ok(text.includes("Northbridge Seed Fund LLP") && !text.includes("Northbridge Seed Investor LLP"),
  "a party's name is not rewritten by role aliases ('Fund' is an alias of 'Investor')");
ok(text.includes("₹3,000.03 (Rupees Three Thousand and Paise Three Only) per Security"),
  "a price with paise keeps its paise (₹3,000.03, not ₹3,000)");
ok(text.includes("approximately 8,333 Securities would be issued") && text.includes("approximately 20 per cent"),
  "share count and percentage are arithmetic on the answers");

console.log(`\ntermSheetFalsification: ${checks} checks passed`);
process.exit(0);
