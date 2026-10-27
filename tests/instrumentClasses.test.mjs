/**
 * instrumentClasses.test.mjs — D4.48
 *
 * Every document type used to be drafted as a bilateral contract. A Privacy
 * Policy called itself "this Agreement" 28 times, warranted that "the Parties"
 * had lawful consideration under the Indian Contract Act, and sent its readers
 * to arbitration; the Refund and Shipping policies did the same; the MOU and the
 * Partnership Deed opened 'THIS AGREEMENT ("Agreement")' under their own titles;
 * the term sheet was laid out as a deed. What shipped is frozen in
 * tests/fixtures/instrumentShape.D4_48.json (captured from fe48d5a6c).
 *
 * knowledge-base/metadata/instrument_classes.json now says what kind of
 * instrument each type is, and backend/services/instrumentClass.js is the one
 * module every layer asks. This file proves, in order:
 *
 *   1. the model: every registered type is classified, and the coarse shape the
 *      validators use is exactly the list that stood in documentShape.js;
 *   2. the frozen defect is the old output, and still shows the defect;
 *   3. positive: each published policy generates with none of an agreement's
 *      general provisions, no Contract Act warranty, no arbitration, no "Parties",
 *      and with its own governing-law line and complaint routes;
 *   4. negative / regression: no agreement's clause set changes, and the
 *      standard-form ToS loses only the warranty;
 *   5. boundary: the enforcement is idempotent, records what it removed, leaves
 *      an agreement untouched, and does nothing for a class held out of
 *      enforcement (the eleven types that do not generate);
 *   6. a saved draft from before D4.48 is flagged for legal review and is never
 *      refused at export;
 *   7. self-names: the Deed and the MOU open as themselves;
 *   8. the intake no longer asks a policy for a governing-law state, and the
 *      consistency check does not fault a document with no governing-law clause;
 *   9. the term sheet is exported as a summary-of-terms table in DOCX, PDF and
 *      TXT, its status column agrees with the declared binding status, its text
 *      is verbatim, and a superseded term sheet keeps its old layout.
 */
import assert from "node:assert";
import fs from "fs";
import zlib from "zlib";
import { createRequire } from "module";

// jszip is a backend dependency (docx uses it), not a root one.
const JSZip = createRequire(new URL("../backend/package.json", import.meta.url))("jszip");

const IC = await import("../backend/services/instrumentClass.js");
const { documentShape, DOCUMENT_SHAPES } = await import("../shared/documentShape.js");
const { generateDocument } = await import("../backend/services/documentService.js");
const { runDocumentValidation } = await import("../backend/services/validationService.js");
const { prepareExportDraft } = await import("../backend/services/mutationEntryPoints.js");
const { draftToDocx, draftToPdf, draftToText, termsTableRows } = await import("../backend/services/exportService.js");
const { getClauseById } = await import("../backend/services/clauseAssembler.js");
const { getVariables } = await import("../backend/config/variableConfig.js");
const { validateDraftConsistency } = await import("../backend/services/draftConsistencyValidator.js");
const { provisionStatusOf } = await import("../backend/services/instrumentKnowledge.js");
const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };

const FROZEN = JSON.parse(fs.readFileSync(new URL("./fixtures/instrumentShape.D4_48.json", import.meta.url), "utf8"));
const MODEL = IC.instrumentClassModel();
const POLICIES = ["PRIVACY_POLICY", "REFUND_AND_CANCELLATION_POLICY", "SHIPPING_AND_DELIVERY_POLICY"];
const WARRANTY = /lawful under Section 23 of the Indian Contract Act/;
const allText = (draft) => draft.clauses.map((c) => `${c.title || ""}\n${c.text || ""}`).join("\n");

/* ── 1. The model ─────────────────────────────────────────────────────────── */
const registered = Object.keys(DOCUMENT_CONFIG);
ok(registered.length === 40, `40 registered document types (${registered.length})`);
const unclassified = registered.filter((t) => !MODEL.document_types[t]);
ok(unclassified.length === 0, `every registered type is classified (${unclassified.join(", ") || "none missing"})`);
const unknownClass = Object.entries(MODEL.document_types).filter(([, e]) => !MODEL.classes[e.class]);
ok(unknownClass.length === 0, "every classified type names a class that exists");

// documentShape.js BY_TYPE as it stood at fe48d5a6c, copied verbatim. The shape
// decides which validator checks and intake questions apply; D4.48 must not move it.
const SHAPES_AT_FE48D5A6C = {
  PRIVACY_POLICY: "POLICY", TERMS_OF_SERVICE: "POLICY", POSH_POLICY: "POLICY",
  REFUND_AND_CANCELLATION_POLICY: "POLICY", SHIPPING_AND_DELIVERY_POLICY: "POLICY",
  LEGAL_NOTICE: "NOTICE", CHEQUE_BOUNCE_NOTICE: "NOTICE", REPLY_TO_LEGAL_NOTICE: "NOTICE", ARBITRATION_NOTICE: "NOTICE",
  AFFIDAVIT: "SWORN", INDEMNITY_BOND: "SWORN", POWER_OF_ATTORNEY: "SWORN",
};
const shapeTypes = [...new Set([...registered, ...Object.keys(MODEL.document_types), "SOME_FUTURE_TYPE"])];
const moved = shapeTypes.filter((t) => documentShape(t) !== (SHAPES_AT_FE48D5A6C[t] || DOCUMENT_SHAPES.AGREEMENT));
ok(moved.length === 0, `documentShape() is unchanged for all ${shapeTypes.length} types, an unknown one included (${moved.join(", ") || "none moved"})`);
ok(IC.getInstrumentClassName("SOME_FUTURE_TYPE") === "AGREEMENT" && IC.contractDoctrineApplies("SOME_FUTURE_TYPE"),
  "an unclassified type is an AGREEMENT, which is what the engine did before D4.48");
ok(IC.getInstrumentClassName("privacy_policy") === "PUBLISHED_POLICY", "the type name is canonicalised before lookup");

/* ── 2. The frozen defect ─────────────────────────────────────────────────── */
ok(FROZEN.captured_from_commit.startsWith("fe48d5a6c") && Object.keys(FROZEN.documents).length === 40,
  "frozen fixture: captured from fe48d5a6c, all 40 types");
for (const t of POLICIES) {
  const f = FROZEN.documents[t];
  ok(f.markers.contract_act_warranty && f.markers.arbitration_clause && f.clause_ids.some((id) => id.startsWith("CORE_")),
    `frozen fixture: ${t} shipped the Contract Act warranty, arbitration and contract general provisions`);
}
ok(FROZEN.documents.PRIVACY_POLICY.markers.this_agreement === 28 && FROZEN.documents.PRIVACY_POLICY.clause_ids.includes("CORE_INDEMNITY_001"),
  "frozen fixture: the Privacy Policy said 'this Agreement' 28 times and carried an indemnity");
ok(FROZEN.documents.TERMS_OF_SERVICE.markers.contract_act_warranty, "frozen fixture: the ToS carried the 'the Parties represent and warrant' doctrine");

/* ── 3. Positive: the published policies ──────────────────────────────────── */
const generated = {};
const gen = async (type, opts = {}) => (await generateDocument({ document_type: type, variables: variablesFor(type, opts) })).draft;

for (const type of POLICIES) {
  for (const profile of [undefined, FIXTURE_PROFILE.WELL_FILLED, FIXTURE_PROFILE.MINIMAL_DECLINED]) {
    const draft = await gen(type, { requiredOnly: false, profile });
    const tag = `${type}${profile ? ` (${profile})` : ""}`;
    if (!profile) generated[type] = draft;
    ok(Boolean(draft), `${tag}: generates`);
    const ids = draft.clauses.map((c) => c.clause_id);
    const forbidden = ids.filter((id) => /^(CORE_|AUTO-)/.test(id));
    ok(forbidden.length === 0, `${tag}: no general provision of an agreement (${forbidden.join(", ") || "none"})`);
    const text = allText(draft);
    ok(!WARRANTY.test(text) && !/represent and warrant/i.test(text), `${tag}: no Contract Act warranty`);
    ok(!/arbitrat/i.test(text), `${tag}: no arbitration`);
    ok(!/\bthis Agreement\b/i.test(text) && !/\bthe Parties\b/.test(text), `${tag}: never 'this Agreement', never 'the Parties'`);
    ok(/governed by the laws of India/.test(text), `${tag}: states its governing law in a sentence`);
    ok(draft.metadata?.instrument_class?.name === "PUBLISHED_POLICY", `${tag}: the draft records its instrument class`);
  }
}
const privacyText = allText(generated.PRIVACY_POLICY);
ok(/withdraw that consent/.test(privacyText) && /Data Protection Board of India/.test(privacyText),
  "Privacy Policy: tells the reader how to withdraw consent and how to complain to the Board (DPDP s.5(1))");
ok(!/agree to be bound/.test(privacyText), "Privacy Policy: reading the notice is not presented as accepting a contract");
for (const type of ["REFUND_AND_CANCELLATION_POLICY", "SHIPPING_AND_DELIVERY_POLICY"]) {
  ok(/Consumer Protection Act, 2019/.test(allText(generated[type])) && generated[type].clauses.some((c) => c.clause_id === "ECOM_GRIEVANCE_REDRESSAL_001"),
    `${type}: the consumer's statutory remedies are preserved and the grievance route is present`);
}
// Exactly what POST /export does (backend/index.js -> prepareExportDraft): the
// answers it validates against are the stored, schema-sanitised source_variables,
// not raw sweep values (which carry questions a policy's form never asks).
for (const type of POLICIES) {
  const exportDraft = prepareExportDraft(generated[type]).draft;
  const v = await runDocumentValidation(exportDraft, { mode: "final", documentType: type, sourceVariables: exportDraft.metadata?.source_variables });
  const own = [...v.blockingIssues, ...v.advisoryIssues].filter((i) => i.layer === "instrument_class");
  ok(own.length === 0 && v.blockingIssues.length === 0 && v.risk !== "BLOCKED",
    `${type}: the export gate finds nothing blocking and no instrument-class finding (${v.blockingIssues.map((i) => i.rule_id).join(", ") || "none"})`);
}

/* ── 4. Negative / regression: agreements keep their clauses ──────────────── */
const changedAgreements = [];
for (const type of registered) {
  const frozen = FROZEN.documents[type];
  if (!frozen?.generated || POLICIES.includes(type)) continue;
  const draft = await gen(type, { requiredOnly: false });
  generated[type] = draft;
  const ids = draft.clauses.map((c) => c.clause_id);
  if (JSON.stringify(ids) !== JSON.stringify(frozen.clause_ids)) changedAgreements.push(type);
}
ok(changedAgreements.length === 0,
  `every other generating type keeps exactly the clause set it shipped with (${changedAgreements.join(", ") || "none changed"})`);
ok(Object.keys(generated).length === 29, `29 types generate, as before (${Object.keys(generated).length})`);
for (const type of Object.keys(generated)) {
  const cls = IC.getInstrumentClass(type);
  if (cls.name !== "AGREEMENT") continue;
  ok(generated[type].metadata?.instrument_class?.excluded?.length === 0, `${type}: nothing removed from an agreement`);
}
ok(!WARRANTY.test(allText(generated.TERMS_OF_SERVICE)),
  "Terms of Service: the contract-formation warranty by 'the Parties' is gone (standard-form terms name no counterparty)");
ok(generated.TERMS_OF_SERVICE.clauses.some((c) => c.clause_id === "CORE_LIMITATION_LIABILITY_001") &&
   generated.TERMS_OF_SERVICE.clauses.some((c) => c.clause_id === "CORE_DISPUTE_RESOLUTION_001"),
  "Terms of Service: keeps its risk allocation and forum clauses (a standard-form contract may carry them)");
const withWarranty = Object.keys(generated).filter((t) => WARRANTY.test(allText(generated[t])));
const expectWarranty = Object.keys(generated).filter((t) => IC.contractDoctrineApplies(t));
ok(withWarranty.every((t) => expectWarranty.includes(t)), "the Contract Act warranty appears only in a type whose class is a contract between parties");

/* ── 5. Boundary: the enforcement itself ──────────────────────────────────── */
const nda = generated.NDA;
const same = IC.enforceInstrumentClass(nda, "NDA");
ok(same.clauses === nda.clauses, "an agreement is returned with its clause array untouched");
const planted = { ...generated.PRIVACY_POLICY, clauses: [...generated.PRIVACY_POLICY.clauses, { ...getClauseById("CORE_INDEMNITY_001") }, { clause_id: "AUTO-LIAB-001", title: "Limitation of Liability", text: "x" }] };
const once = IC.enforceInstrumentClass(planted, "PRIVACY_POLICY");
const twice = IC.enforceInstrumentClass(once, "PRIVACY_POLICY");
ok(once.clauses.length === generated.PRIVACY_POLICY.clauses.length && !once.clauses.some((c) => /^(CORE_|AUTO-)/.test(c.clause_id)),
  "a forbidden clause added by any stage is removed (an indemnity, a commercial-engine liability cap)");
ok(once.metadata.instrument_class.excluded.some((e) => e.clause_id === "CORE_INDEMNITY_001" && /general clauses of an agreement/.test(e.reason)) &&
   once.metadata.instrument_class.excluded.some((e) => e.clause_id === "AUTO-LIAB-001"),
  "what was removed is recorded on metadata.instrument_class, with the reason");
ok(JSON.stringify(twice) === JSON.stringify(once), "enforcement is idempotent");
ok(IC.forbiddenByInstrumentClass("POSH_POLICY", "CORE_INDEMNITY_001") === null && IC.getInstrumentClassName("POSH_POLICY") === "PUBLISHED_POLICY",
  "the PoSH Policy is classified as a published policy but held out of enforcement while it does not generate");
for (const t of ["AFFIDAVIT", "POWER_OF_ATTORNEY", "INDEMNITY_BOND", "ARBITRATION_NOTICE", "APPOINTMENT_LETTER", "ESOP_GRANT_LETTER", "PROMISSORY_NOTE"]) {
  ok(IC.forbiddenByInstrumentClass(t, "CORE_WAIVER_001") === null, `${t}: classified (${IC.getInstrumentClassName(t)}), not enforced in D4.48`);
}
ok(IC.forbiddenByInstrumentClass("TERM_SHEET", "CORE_SEVERABILITY_001") && !IC.forbiddenByInstrumentClass("TERM_SHEET", "CORE_GOVERNING_LAW_001"),
  "the term sheet may not carry severability but keeps its binding governing-law provision");

/* ── 6. Documents saved before D4.48 ─────────────────────────────────────── */
// Real ones: generated and saved by the engine at 223bfc821, frozen. As the D4.48
// work first stood, the three policies were refused at download: the new
// blueprints require clauses an old policy does not have (clauseSuccession.js).
const SAVED = JSON.parse(fs.readFileSync(new URL("./fixtures/savedBeforeInstrumentClasses.D4_48.json", import.meta.url), "utf8"));
const { SUCCEEDED_CLAUSE_RULE_ID } = await import("../backend/services/clauseSuccession.js");
ok(SAVED.captured_from_commit.startsWith("223bfc821") && Object.keys(SAVED.documents).length === 4, "saved fixture: four documents from 223bfc821");
for (const [type, { shown, draft: savedDraft }] of Object.entries(SAVED.documents)) {
  ok(shown.certification === "Automated checks passed" && shown.blocking === 0 &&
     JSON.stringify(savedDraft.clauses.map((c) => c.clause_id)) === JSON.stringify(FROZEN.documents[type].clause_ids),
    `saved ${type}: was shown 'Automated checks passed', with the clause set the frozen defect records`);
  const old = JSON.parse(JSON.stringify(savedDraft));
  const before = JSON.stringify(old);
  const own = IC.verifyInstrumentClass(old, type);
  const expected = old.clauses.filter((c) => IC.forbiddenByInstrumentClass(type, c)).length;
  ok(own.filter((i) => i.rule_id === "INSTRUMENT_CLASS_MISMATCH").length === expected && own.some((i) => i.rule_id === "INSTRUMENT_CLASS_CONTRACT_WARRANTY"),
    `saved ${type}: flagged for each of its ${expected} provisions its class forbids, and for the warranty`);
  ok(own.every((i) => i.release_outcome === "REQUIRES_LEGAL_REVIEW" && !i.blocks_generation && i.severity !== "CRITICAL"), `saved ${type}: every instrument-class finding asks for review; none blocks`);
  const exportDraft = prepareExportDraft(old).draft;
  const v = await runDocumentValidation(exportDraft, { mode: "final", documentType: type, sourceVariables: exportDraft.metadata?.source_variables });
  ok(v.blockingIssues.length === 0 && v.risk !== "BLOCKED",
    `saved ${type}: can still be downloaded (${v.blockingIssues.map((i) => i.rule_id).join(", ") || "nothing blocking"})`);
  ok(v.release_outcome === "REQUIRES_LEGAL_REVIEW", `saved ${type}: its outcome is Requires legal review (${v.release_outcome})`);
  if (type !== "TERMS_OF_SERVICE") {
    ok(v.advisoryIssues.some((i) => i.rule_id === SUCCEEDED_CLAUSE_RULE_ID && /Generate the document again/.test(i.suggestion)) &&
       !v.advisoryIssues.concat(v.blockingIssues).some((i) => i.rule_id === "MISSING_REQUIRED_CLAUSE"),
      `saved ${type}: a clause the new template added is reported as an earlier template version, not as a missing clause`);
  }
  ok(JSON.stringify(old) === before, `saved ${type}: validating and preparing it for export never modifies it`);
}
// Negative: succession excuses an old document, not a broken new one.
const broken = { ...generated.PRIVACY_POLICY, clauses: generated.PRIVACY_POLICY.clauses.filter((c) => c.clause_id !== "PRIVACY_LAW_AND_COMPLAINTS_001") };
const bv = await runDocumentValidation(broken, { mode: "final", documentType: "PRIVACY_POLICY", sourceVariables: generated.PRIVACY_POLICY.metadata?.source_variables });
ok(bv.blockingIssues.some((i) => i.rule_id === "MISSING_REQUIRED_CLAUSE" && /PRIVACY_LAW_AND_COMPLAINTS_001/.test(i.message)),
  "a current Privacy Policy missing a required clause, with nothing it replaced, is still blocked");
ok(IC.verifyInstrumentClass(generated.NDA, "NDA").length === 0, "an agreement carrying every general provision raises nothing");

/* ── 7. Self-names ────────────────────────────────────────────────────────── */
const deedText = draftToText(generated.PARTNERSHIP_DEED);
ok(/^THIS DEED OF PARTNERSHIP \("Deed"\) is made and executed/m.test(deedText) && !/THIS AGREEMENT \("Agreement"\)/.test(deedText),
  "Partnership Deed: opens as a deed, not 'THIS AGREEMENT'");
ok(!/\bthis Agreement\b/.test(deedText) && !/"Agreement" means this Deed/.test(deedText), "Partnership Deed: calls itself 'this Deed' throughout, and the definition follows");
const mouText = draftToText(generated.MOU);
ok(/^THIS MEMORANDUM OF UNDERSTANDING \("MOU"\) is made and executed/m.test(mouText) && !/\bthis Agreement\b/.test(mouText),
  "MOU: opens as a Memorandum of Understanding and calls itself 'this MOU'");
ok(/^THIS AGREEMENT \("Agreement"\)/m.test(draftToText(generated.NDA)), "an ordinary agreement still opens 'THIS AGREEMENT'");

/* ── 8. Intake and consistency ────────────────────────────────────────────── */
for (const t of POLICIES) ok(!("governing_law_state" in getVariables(t)), `${t}: the intake does not ask for a governing-law state`);
for (const t of ["TERMS_OF_SERVICE", "NDA", "SERVICE_AGREEMENT"]) ok("governing_law_state" in getVariables(t), `${t}: still asks for a governing-law state`);
const stateFinding = (issues) => issues.some((i) => /governing.?law/i.test(`${i.rule_id} ${i.message}`) && /Kerala/.test(i.message || ""));
ok(!stateFinding(validateDraftConsistency(generated.PRIVACY_POLICY, { documentType: "PRIVACY_POLICY", variables: { ...variablesFor("PRIVACY_POLICY"), governing_law_state: "Kerala" } })),
  "a stale governing-law state on a policy with no governing-law clause is not reported as a mismatch");
ok(stateFinding(validateDraftConsistency(generated.NDA, { documentType: "NDA", variables: { ...variablesFor("NDA", { requiredOnly: false }), governing_law_state: "Kerala" } })),
  "an agreement whose governing-law clause names a different state is still caught");

// Found by the conservation gate: the Deed's indemnity says "material breach of this
// Deed", and the indemnity-scope matcher accepted only "breach of this Agreement",
// so every Partnership Deed gained a false finding and lost 20 points.
const deedVars = { ...generated.PARTNERSHIP_DEED.metadata.source_variables, indemnity_scope: "Breach of agreement only" };
const scopeFinding = (draft) => validateDraftConsistency(draft, { documentType: "PARTNERSHIP_DEED", variables: deedVars }).some((i) => i.rule_id === "INPUT_MISMATCH_INDEMNITY_SCOPE");
ok(/breach of this Deed/.test(allText(generated.PARTNERSHIP_DEED)) && !scopeFinding(generated.PARTNERSHIP_DEED),
  "Partnership Deed: an indemnity for 'breach of this Deed' reflects the scope 'Breach of agreement only'");
ok(scopeFinding({ ...generated.PARTNERSHIP_DEED, clauses: generated.PARTNERSHIP_DEED.clauses.map((c) => ({ ...c, text: String(c.text).replace(/breach of this Deed/g, "default") })) }),
  "an indemnity that no longer mentions breach of the instrument is still reported");

/* ── 9. The term sheet as a summary of terms ──────────────────────────────── */
const TS = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.inputs.json", import.meta.url), "utf8"));
const ts = (await generateDocument({ document_type: "TERM_SHEET", variables: TS.complete })).draft;
ok(IC.instrumentLayout("TERM_SHEET") === "terms_table" && IC.instrumentLayout("NDA") === "clauses", "the term sheet's class lays it out as a table of terms");
const body = ts.clauses.filter((c) => !["CORE_IDENTITY_001", "CORE_SIGNATURE_BLOCK_001"].includes(c.clause_id));
const rows = termsTableRows(ts, body);
ok(Array.isArray(rows) && rows.length === body.length, `one row per provision (${rows?.length})`);
ok(rows.every((r) => r.status === provisionStatusOf("TERM_SHEET", r.clause_id)), "each row's status is the declared provision_status");
ok(rows.filter((r) => r.statusLabel === "Binding").map((r) => r.clause_id).sort().join() ===
   ["TS_BINDING_EFFECT_001", "TS_EXCLUSIVITY_001", "TS_CONFIDENTIALITY_AND_COSTS_001", "TS_EXPIRY_001", "CORE_GOVERNING_LAW_001", "CORE_DISPUTE_RESOLUTION_001"].sort().join(),
  "the rows marked Binding are exactly the Binding Provisions the term sheet names");
ok(termsTableRows(generated.NDA, generated.NDA.clauses) === null, "an agreement is not laid out as a table");

const tsTxt = draftToText(ts);
for (const r of rows) {
  ok(new RegExp(`^${r.number}\\. ${r.heading.toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} +\\[${r.statusLabel}\\]$`, "m").test(tsTxt),
    `TXT: row ${r.number} shows "${r.heading}" with its status [${r.statusLabel}]`);
}
ok(tsTxt.includes("₹3,000.03 (Rupees Three Thousand and Paise Three Only) per Security") && /^THIS TERM SHEET is dated/m.test(tsTxt),
  "TXT: clause text is not wrapped or altered, and the opening is unchanged");

const xml = await (await JSZip.loadAsync(await draftToDocx(ts))).file("word/document.xml").async("string");
const docxText = xml.replace(/<w:tab\/>/g, " ").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&apos;/g, "'");
ok((xml.match(/<w:tbl>/g) || []).length === 1 && /<w:tblHeader\/>/.test(xml), "DOCX: one table, with a header row that repeats on each page");
ok(["Term", "Status", "Proposed terms"].every((h) => xml.includes(`>${h}</w:t>`)), "DOCX: the three column headings");
const tableXml = xml.slice(xml.indexOf("<w:tbl>"), xml.indexOf("</w:tbl>"));
ok((tableXml.match(/<w:tr>|<w:tr /g) || []).length === rows.length + 1, "DOCX: a row per provision plus the header");
const firstSentence = (c) => c.text.split("\n")[0].trim().slice(0, 70);
ok(body.every((c) => docxText.includes(firstSentence(c))), "DOCX: every provision's text is in the table, verbatim");
ok(xml.indexOf("THIS TERM SHEET") < xml.indexOf("<w:tbl>") && xml.indexOf("</w:tbl>") < xml.indexOf("IN WITNESS WHEREOF"),
  "DOCX: parties and recitals above the table, execution block below it");

const pdf = (await draftToPdf(ts)).toString("latin1");
let pdfText = "";
for (const m of pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  let s; try { s = zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { continue; }
  for (const tj of s.matchAll(/\[([^\]]*)\]\s*TJ/g)) pdfText += [...tj[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => Buffer.from(h[1], "hex").toString("latin1")).join("") + "\n";
}
ok(/Proposed terms/.test(pdfText) && (pdfText.match(/^Non-binding$/gm) || []).length >= 5 && /^Binding$/m.test(pdfText),
  "PDF: the table header and the status column are drawn");
ok(/\(continued\)/.test(pdfText), "PDF: a row that runs over a page continues under a repeated header, marked (continued)");

// A superseded term sheet keeps the layout it was generated with (D4.44: exported unchanged).
const DEF = JSON.parse(fs.readFileSync(new URL("./fixtures/termSheet.D4_44.defective.json", import.meta.url), "utf8"));
const historical = { document_type: "TERM_SHEET", clauses: DEF.clauses, metadata: {} };
ok(termsTableRows(historical, historical.clauses) === null, "a superseded term sheet is not re-laid out as a table");
const histXml = await (await JSZip.loadAsync(await draftToDocx(historical))).file("word/document.xml").async("string");
ok(!histXml.includes("<w:tbl>"), "its DOCX has no table");

console.log(`\ninstrumentClasses: ${checks} checks passed`);
process.exit(0);
