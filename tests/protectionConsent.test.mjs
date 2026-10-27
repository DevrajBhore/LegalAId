/**
 * protectionConsent.test.mjs — D4.51
 *
 * D4.50 made the protections the engine adds visible. D4.51 keeps four things
 * apart that D4.50 still let blur, and makes the user's own answer count:
 *
 *   1. reconciliation: D4.50 disclosed 93 where its audit counted 92 ungoverned;
 *      the difference is shown, from the evidence, to be exactly one clause;
 *   2. five fields, never inferred from one another: origin, inclusion basis,
 *      value provenance, legal review, user decision. A template-standard clause
 *      is never a user-approved one; a clause whose figures the user chose is not
 *      thereby a clause the user agreed to include;
 *   3. the treatment register: every (family, protection) the audit found is
 *      registered PENDING, and nothing can be APPROVED without a named advocate,
 *      a date, a treatment and a rationale;
 *   4. a declined protection still in the document is a review finding on every
 *      validation, never a block;
 *   5. the editor shows the same disclosure the export prints, from the same
 *      renderer, and a draft saved before D4.50 says its list is incomplete.
 */
import assert from "node:assert";
import fs from "fs";

const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { prepareExportDraft } = await import("../backend/services/mutationEntryPoints.js");
const PD = await import("../backend/services/protectionDecisions.js");
const { buildDisclosureBlock, disclosureFor, DISCLOSURE_NOT_ASSESSED_NOTE } = await import("../backend/services/disclosureRenderer.js");
const { draftToText } = await import("../backend/services/exportService.js");
const { ESSENTIAL_FIELDS } = await import("../backend/config/essentialFields.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const F = JSON.parse(read("./fixtures/injectedProtections.D4_50.json"));
const SAVED = JSON.parse(read("./fixtures/savedBeforeInstrumentClasses.D4_48.json"));

const worldVars = (t, w) => {
  if (w === "MINIMAL_DECLINED") return variablesFor(t, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
  const well = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
  if (w === "QUICK_ESSENTIALS") return Object.fromEntries(Object.entries(well).filter(([k]) => ESSENTIAL_FIELDS[t].includes(k) || k === "effective_date" || k === "operating_state"));
  return well;
};
const results = new Map();
for (const d of F.documents.filter((x) => x.generated)) {
  results.set(`${d.type}::${d.world}`, await generateDocument({ document_type: d.type, variables: worldVars(d.type, d.world) }));
}
const decisions = [...results.entries()].flatMap(([key, r]) => r.draft.metadata.protection_decisions.map((d) => ({ ...d, key })));

/* ── 1. Reconciliation ────────────────────────────────────────────────────── */
const moved = F.rows.filter((row) => {
  const now = results.get(`${row.type}::${row.world}`).draft.metadata.protection_decisions.find((d) => d.clause_id === row.clause_id);
  return now.disclosed !== !row.user_choice_governs;
});
ok(moved.length === 1 && moved[0].type === "MOU" && moved[0].world === "MINIMAL_DECLINED" && moved[0].clause_id === "CORE_FORCE_MAJEURE_001" &&
   moved[0].intake_answered.include_force_majeure === "No",
  "92 vs 93: exactly one clause changed classification, the MOU force majeure the user answered No to");
ok(F.rows.filter((r) => !r.user_choice_governs).length + 1 === decisions.filter((d) => d.disclosed).length, "92 ungoverned in the audit + that one = 93 disclosed");

/* ── 2. Five fields ───────────────────────────────────────────────────────── */
const FIELDS = ["origin_stage", "inclusion_basis", "value_provenance", "legal_review", "user_decision"];
ok(decisions.length === 136 && decisions.every((d) => FIELDS.every((f) => d[f] !== undefined && d[f] !== null)), "every one of the 136 protections carries all five fields");
ok(!decisions.some((d) => "basis" in d), "the single D4.50 'basis' field, which conflated them, is gone");
ok(decisions.every((d) => (d.inclusion_basis === PD.INCLUSION_BASIS.USER_SELECTED) === (d.user_decision === PD.USER_DECISION.ACCEPTED)),
  "inclusion is user-selected exactly when the user said yes to it, and in no other case");
ok(decisions.filter((d) => d.inclusion_basis === PD.INCLUSION_BASIS.TEMPLATE_STANDARD).every((d) => d.user_decision !== PD.USER_DECISION.ACCEPTED),
  "a template-standard clause is never recorded as accepted by the user");
ok(decisions.every((d) => (d.value_provenance.source === PD.VALUE_PROVENANCE.USER_ANSWERS) === (Object.keys(d.value_provenance.parameters).length > 0)),
  "value provenance is the user's only where the user answered a parameter");
const accepted = decisions.filter((d) => d.user_decision === PD.USER_DECISION.ACCEPTED);
const parametersOnly = decisions.filter((d) => !d.disclosed && d.user_decision === PD.USER_DECISION.NOT_ASKED);
ok(accepted.length === 3 && accepted.every((d) => d.role === "FORCE_MAJEURE"),
  "only 3 protections were explicitly accepted, all force majeure answered Yes");
ok(parametersOnly.length === 40 && parametersOnly.every((d) => d.value_provenance.source === PD.VALUE_PROVENANCE.USER_ANSWERS),
  "40 more are governed only by parameters the user chose: never asked whether to include them, and recorded as NOT_ASKED");
ok(decisions.every((d) => d.legal_review.approved === false && d.legal_review.treatment_status === "PENDING"),
  "no protection's legal treatment is approved; every one is PENDING");

/* ── 3. The treatment register ────────────────────────────────────────────── */
const register = PD.protectionTreatmentRegister();
const pairs = new Set(F.rows.map((r) => `${r.type}/${r.role}`));
const registered = new Set(Object.entries(register.families).flatMap(([f, roles]) => Object.keys(roles).map((r) => `${f}/${r}`)));
ok(pairs.size === 66 && [...pairs].every((p) => registered.has(p)) && registered.size === pairs.size, "every one of the 66 (family, protection) pairs the audit found is registered, and no other");
ok([...registered].every((p) => { const [f, r] = p.split("/"); return register.families[f][r].status === "PENDING"; }), "every entry is PENDING");
ok(PD.treatmentRegisterProblems().length === 0, "the register as committed has no problems");
ok(JSON.stringify(Object.keys(register.treatments)) === JSON.stringify(["KEEP", "ASK", "CHANGE", "REMOVE"]), "the four treatments are KEEP, ASK, CHANGE, REMOVE");
const planted = JSON.parse(JSON.stringify(register));
planted.families.NDA.INDEMNITY = { ...planted.families.NDA.INDEMNITY, status: "APPROVED", treatment: "KEEP" };
ok(PD.treatmentRegisterProblems(planted).some((p) => /NDA\/INDEMNITY: APPROVED without a named approver/.test(p)) &&
   PD.treatmentRegisterProblems(planted).some((p) => /without a date/.test(p)) && PD.treatmentRegisterProblems(planted).some((p) => /without a rationale/.test(p)),
  "an APPROVED entry with no approver, date or rationale is refused");
planted.families.NDA.INDEMNITY = { ...planted.families.NDA.INDEMNITY, status: "APPROVED", treatment: "MAYBE", decided_by: "A. Advocate", decided_on: "2026-11-01", rationale: "x" };
ok(PD.treatmentRegisterProblems(planted).some((p) => /without a treatment/.test(p)), "an APPROVED entry with a treatment outside the four is refused");
planted.families.NDA.INDEMNITY = { ...planted.families.NDA.INDEMNITY, status: "PENDING", treatment: "KEEP", decided_by: null, decided_on: null };
ok(PD.treatmentRegisterProblems(planted).some((p) => /while the status is PENDING/.test(p)), "a treatment recorded while PENDING is refused: a decision is either made or not");
ok(PD.treatmentFor("NDA", "INDEMNITY").status === "PENDING" && PD.treatmentFor("NDA", "TERMINATION_NOTICE").status === "NOT_REGISTERED",
  "a protection the register does not list is reported as NOT_REGISTERED, not as pending");

/* ── 4. A declined protection still in the document ───────────────────────── */
const mouDeclined = results.get("MOU::MINIMAL_DECLINED");
const finding = mouDeclined.validation.advisoryIssues.find((i) => i.rule_id === PD.DECLINED_PROTECTION_RULE_ID);
ok(finding && finding.offending_clause_id === "CORE_FORCE_MAJEURE_001" && finding.release_outcome === "REQUIRES_LEGAL_REVIEW" && finding.blocks_generation === false,
  "MOU, force majeure declined: a review finding names the clause and does not block");
ok(/You answered that you did not want a force majeure provision, but this document still contains one/.test(finding.message), "it says the answer and the document disagree");
ok(!results.get("MOU::WELL_FILLED").validation.advisoryIssues.some((i) => i.rule_id === PD.DECLINED_PROTECTION_RULE_ID), "MOU, force majeure accepted: no finding");
const withFinding = [...results.entries()].filter(([, r]) => [...r.validation.advisoryIssues, ...r.validation.blockingIssues].some((i) => i.rule_id === PD.DECLINED_PROTECTION_RULE_ID)).map(([k]) => k);
ok(withFinding.length === 1 && withFinding[0] === "MOU::MINIMAL_DECLINED", `the finding appears in that document and no other (${withFinding.join(", ")})`);
const exportDraft = prepareExportDraft(mouDeclined.draft).draft;
const gate = await runDocumentValidation(exportDraft, { mode: "final", documentType: "MOU", sourceVariables: exportDraft.metadata.source_variables });
ok(gate.blockingIssues.length === 0 && gate.risk !== "BLOCKED" && gate.advisoryIssues.some((i) => i.rule_id === PD.DECLINED_PROTECTION_RULE_ID),
  "the export gate still allows the download, and shows the finding");
const svc = results.get("SERVICE_AGREEMENT::WELL_FILLED").draft;
const svcDeclined = PD.verifyDeclinedProtections(svc, "SERVICE_AGREEMENT", { ...svc.metadata.source_variables, include_indemnity_clause: "No" });
ok(svc.clauses.some((c) => PD.protectionRoleOf(c.clause_id) === "INDEMNITY") && svcDeclined.length === 1 && /indemnity provision/.test(svcDeclined[0].message),
  "planted: an indemnity the user declined in another family is caught the same way");
ok(PD.verifyDeclinedProtections({ ...mouDeclined.draft, clauses: mouDeclined.draft.clauses.filter((c) => c.clause_id !== "CORE_FORCE_MAJEURE_001") }, "MOU", mouDeclined.draft.metadata.source_variables).length === 0,
  "once the clause is removed, the finding goes");

/* ── 5. The editor shows what the export prints ───────────────────────────── */
let same = 0;
for (const [key, r] of results) {
  const block = buildDisclosureBlock(r.draft);
  if (JSON.stringify(r.validation.disclosure.entries) === JSON.stringify(block?.entries || [])) same++;
  else console.log("differs:", key);
}
ok(same === results.size, `for every document, the disclosure returned to the editor is the export's block, entry for entry (${same} of ${results.size})`);
const nda = results.get("NDA::WELL_FILLED");
ok(nda.validation.disclosure.protections_assessed === true && nda.validation.disclosure.note === null &&
   nda.validation.disclosure.entries.every((e) => draftToText(nda.draft).includes(e.text)),
  "a fresh NDA: assessed, and every entry on screen is printed in the TXT export");
const edited = { ...nda.draft, clauses: nda.draft.clauses.filter((c) => c.clause_id !== "CORE_INDEMNITY_FULL_001") };
ok(disclosureFor(edited).entries.length === nda.validation.disclosure.entries.length - 1 && !disclosureFor(edited).entries.some((e) => /\("Indemnity"\)/.test(e.text)),
  "after the user deletes the indemnity, its entry drops out of the list");
for (const [type, { draft }] of Object.entries(SAVED.documents)) {
  const d = disclosureFor(draft);
  ok(d.protections_assessed === false && d.note === DISCLOSURE_NOT_ASSESSED_NOTE, `a ${type} saved before D4.50 is reported as not assessed, never as having passed`);
}
const indexSrc = read("../backend/index.js");
const historySrc = read("../backend/services/documentHistoryService.js");
const editorSrc = read("../frontend/src/pages/Editor.jsx");
const panelSrc = read("../frontend/src/components/AssumptionsPanel.jsx");
ok(/validation: \{ \.\.\.validation, disclosure: disclosureFor\(body\) \}/.test(indexSrc), "POST /validate returns the disclosure for the draft as edited");
ok(/disclosure: disclosureFor\(record\.currentDraft\)/.test(historySrc) && !/currentValidation\s*=\s*\{[^}]*disclosure/.test(historySrc),
  "a saved document's disclosure is computed on read from its stored draft, never stored");
ok(/activeTab === "validation" && \([\s\S]{0,120}<AssumptionsPanel disclosure=\{disclosure\} \/>/.test(editorSrc), "the editor shows the panel in the validation tab, its default tab");
ok(!/indemnity|liability|force majeure|was added/i.test(panelSrc), "the panel words nothing itself: every entry comes from the renderer");

console.log(`\nprotectionConsent: ${checks} checks passed`);
process.exit(0);
