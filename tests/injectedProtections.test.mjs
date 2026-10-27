/**
 * injectedProtections.test.mjs — D4.50
 *
 * The audit (tests/fixtures/injectedProtections.D4_50.json, captured from the
 * D4.49 engine with each generation stage recorded) found 92 of 136 protection
 * clauses governed by no answer of the user's, and none of them disclosed. The
 * commercial engine added 20 of them, provenance reported each as
 * NO_PRODUCER_OBSERVED, and the Founders Agreement received an indemnity and a
 * cap only in the repair round.
 *
 * The rule this phase holds: an unapproved commercial position is never presented
 * silently as an agreed term, and a protection is never dropped merely because
 * the user did not select it. Proven here, in order:
 *
 *   1. the frozen audit;
 *   2. origin: every protection clause records the stage that added it, and the
 *      record agrees with the frozen stage-by-stage measurement, 136 of 136;
 *   3. nothing removed, nothing re-scored: the same protections, the same
 *      certifications;
 *   4. positive: every protection no answer governs is disclosed, in the API and
 *      in the DOCX, PDF and TXT exports;
 *   5. negative: a protection the user's answer governs is not disclosed as a
 *      default;
 *   6. boundary: a toggle answered "No", a deleted clause, a saved draft with no
 *      origin record;
 *   7. the disclosure never claims a protection is legally required.
 */
import assert from "node:assert";
import fs from "fs";
import zlib from "zlib";
import { createRequire } from "module";

const JSZip = createRequire(new URL("../backend/package.json", import.meta.url))("jszip");
const { generateDocument } = await import("../backend/services/documentService.js");
const { decideProtections, protectionDisclosures, protectionDecisionModel, INCLUSION_BASIS, USER_DECISION, VALUE_PROVENANCE } = await import("../backend/services/protectionDecisions.js");
const { buildDisclosureBlock } = await import("../backend/services/disclosureRenderer.js");
const { draftToDocx, draftToPdf, draftToText } = await import("../backend/services/exportService.js");
const { ESSENTIAL_FIELDS } = await import("../backend/config/essentialFields.js");
const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };
const F = JSON.parse(fs.readFileSync(new URL("./fixtures/injectedProtections.D4_50.json", import.meta.url), "utf8"));
const SAVED = JSON.parse(fs.readFileSync(new URL("./fixtures/savedBeforeInstrumentClasses.D4_48.json", import.meta.url), "utf8"));
const EXPECT_STAGE = { BLUEPRINT: "blueprint", BLUEPRINT_CONDITIONAL: "blueprint", COMMERCIAL_ENGINE: "commercial_engine", HARDENING_BASELINE: "hardening_baseline", DEPENDENCY_RESOLVER: "dependency_resolver", REPAIR_ROUND: "deterministic_repair" };

/* ── 1. The frozen audit ──────────────────────────────────────────────────── */
const rows = F.rows;
const ungoverned = rows.filter((r) => !r.user_choice_governs);
ok(rows.length === 136 && ungoverned.length === 92, `frozen: 136 protection clauses, 92 governed by no answer (${rows.length}, ${ungoverned.length})`);
ok(ungoverned.every((r) => !r.disclosed_in_document && !r.in_assumptions), "frozen: none of the 92 was disclosed");
const engine = rows.filter((r) => r.decided_by === "COMMERCIAL_ENGINE");
ok(engine.length === 20 && engine.every((r) => r.provenance_status === "WITHHELD" && !r.inclusion_reason_recorded),
  "frozen: the commercial engine added 20, each with no recorded reason and provenance WITHHELD");
ok(rows.filter((r) => r.decided_by === "REPAIR_ROUND").every((r) => r.type === "FOUNDERS_AGREEMENT") && rows.some((r) => r.decided_by === "REPAIR_ROUND"),
  "frozen: the repair round added protections, all to the Founders Agreement");

/* ── 2. Origin ────────────────────────────────────────────────────────────── */
const worldVars = (t, w) => {
  if (w === "MINIMAL_DECLINED") return variablesFor(t, { profile: FIXTURE_PROFILE.MINIMAL_DECLINED });
  const well = variablesFor(t, { profile: FIXTURE_PROFILE.WELL_FILLED });
  if (w === "QUICK_ESSENTIALS") return Object.fromEntries(Object.entries(well).filter(([k]) => ESSENTIAL_FIELDS[t].includes(k) || k === "effective_date" || k === "operating_state"));
  return well;
};
const results = new Map();
for (const d of F.documents.filter((x) => x.generated)) {
  const r = await generateDocument({ document_type: d.type, variables: worldVars(d.type, d.world) });
  results.set(`${d.type}::${d.world}`, r);
}
ok(results.size === 63 && [...results.values()].every((r) => r.draft), `all 63 audited documents still generate (${results.size})`);
const originMisses = rows.filter((row) => results.get(`${row.type}::${row.world}`).draft.metadata.clause_origin?.[row.clause_id] !== EXPECT_STAGE[row.decided_by]);
ok(originMisses.length === 0, `the recorded origin of every protection clause agrees with the stage-by-stage audit, ${rows.length - originMisses.length} of ${rows.length}`);
ok(results.get("NDA::WELL_FILLED").draft.metadata.clause_origin.CORE_INDEMNITY_FULL_001 === "commercial_engine",
  "the NDA's indemnity is recorded as added by the commercial engine");

/* ── 3. Nothing removed, nothing re-scored ────────────────────────────────── */
const changedSets = F.documents.filter((d) => d.generated).filter((d) => {
  const before = rows.filter((r) => r.type === d.type && r.world === d.world).map((r) => r.clause_id).sort().join();
  const after = (results.get(`${d.type}::${d.world}`).draft.metadata.protection_decisions || []).map((x) => x.clause_id).sort().join();
  return before !== after;
});
ok(changedSets.length === 0, `every document carries exactly the protections it carried before (${changedSets.map((d) => d.type).join(", ") || "none changed"})`);
const recertified = F.documents.filter((d) => d.generated && results.get(`${d.type}::${d.world}`).validation?.certification !== d.certification);
ok(recertified.length === 0, `no certification changed (${recertified.map((d) => d.type).join(", ") || "none"})`);

/* ── 4. Positive: every default is disclosed ──────────────────────────────── */
let defaults = 0;
const undisclosed = [];
for (const [key, r] of results) {
  const block = buildDisclosureBlock(r.draft);
  for (const d of r.draft.metadata.protection_decisions) {
    if (!d.disclosed) continue;
    defaults++;
    const inBlock = block?.entries?.some((e) => e.kind === "DRAFTING DEFAULT" && e.text.includes(`("${d.title}")`));
    const inApi = r.assumptions.some((a) => a.clause_id === d.clause_id && a.kind === "DRAFTING_DEFAULT");
    if (!inBlock || !inApi) undisclosed.push(`${key}/${d.clause_id}`);
  }
}
// The audit's 92, plus one it counted as a choice: the MOU asks "Add a force
// majeure clause?" and keeps the clause when the answer is No (its blueprint
// requires it; held open in governance/declined-protections.json). An answer the
// clause contradicts is not a choice the clause reflects.
ok(defaults === 93, `93 protections are governed by no answer: the audit's 92 and the MOU's declined force majeure (${defaults})`);
ok(undisclosed.length === 0, `each of them is disclosed, in the document and in the API (${undisclosed.slice(0, 4).join(", ") || "all disclosed"})`);
const nda = results.get("NDA::WELL_FILLED").draft;
const ndaText = draftToText(nda);
ok(/\[DRAFTING DEFAULT\] The indemnity provision \("Indemnity"\) was added automatically because LegalAId treats this as a commercial agreement\. You were not asked whether to include it/.test(ndaText),
  "TXT: the NDA says its indemnity was added automatically and that nobody was asked");
ok(/The limitation of liability provision \("Limitation of Liability"\) was added automatically/.test(ndaText), "TXT: and the same for its limitation of liability");
const xml = await (await JSZip.loadAsync(await draftToDocx(nda))).file("word/document.xml").async("string");
ok(xml.includes("ASSUMPTIONS AND OPEN POINTS") && /was added automatically because LegalAId treats this as a commercial agreement/.test(xml), "DOCX: the disclosure is printed");
const pdf = (await draftToPdf(nda)).toString("latin1");
let pdfText = "";
for (const m of pdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
  let s; try { s = zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"); } catch { continue; }
  for (const tj of s.matchAll(/\[([^\]]*)\]\s*TJ/g)) pdfText += [...tj[1].matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => Buffer.from(h[1], "hex").toString("latin1")).join("");
}
ok(/DRAFTING DEFAULT/.test(pdfText) && /added automatically/.test(pdfText), "PDF: the disclosure is printed");
const founders = results.get("FOUNDERS_AGREEMENT::WELL_FILLED").draft.metadata.protection_decisions;
ok(founders.filter((d) => d.origin_stage === "deterministic_repair").length === 2 &&
   founders.filter((d) => d.origin_stage === "deterministic_repair").every((d) => d.inclusion_basis === INCLUSION_BASIS.REPAIR_RECOMMENDATION && d.user_decision === USER_DECISION.NOT_ASKED),
  "Founders Agreement: the two protections the repair round added are recorded as repair recommendations");
ok(/added automatically after the draft was checked/.test(draftToText(results.get("FOUNDERS_AGREEMENT::WELL_FILLED").draft)), "and the document says so");

/* ── 5. Negative: an answer governs ───────────────────────────────────────── */
const service = results.get("SERVICE_AGREEMENT::WELL_FILLED");
const serviceCap = service.draft.metadata.protection_decisions.find((d) => d.role === "LIABILITY_CAP");
ok(serviceCap && serviceCap.value_provenance.source === VALUE_PROVENANCE.USER_ANSWERS && serviceCap.answers.liability_cap_basis && !serviceCap.disclosed,
  "Service Agreement: the cap the user's answers govern is a user choice and is not disclosed as a default");
ok(!service.assumptions.some((a) => a.clause_id === serviceCap.clause_id), "and the API does not list it as an assumption");
const governedCount = [...results.values()].flatMap((r) => r.draft.metadata.protection_decisions).filter((d) => !d.disclosed).length;
ok(governedCount === 43, `43 protections are governed by an answer (the audit's 44, less the MOU's declined force majeure) (${governedCount})`);
const mou = results.get("MOU::MINIMAL_DECLINED");
const mouFm = mou.draft.metadata.protection_decisions.find((d) => d.role === "FORCE_MAJEURE");
ok(mouFm.declined_by_toggle && /You answered that you did not want a force majeure provision, but this draft still contains one/.test(draftToText(mou.draft)) &&
   !/force majeure provision \("Force Majeure"\)[^.]*\. You were not asked/.test(draftToText(mou.draft)),
  "MOU: the document says the user declined force majeure and the clause is still there, never that they were not asked");

/* ── 6. Boundary ──────────────────────────────────────────────────────────── */
const declined = decideProtections(
  { document_type: "SERVICE_AGREEMENT", clauses: [{ clause_id: "CORE_INDEMNITY_001", title: "Indemnity" }], metadata: { clause_origin: { CORE_INDEMNITY_001: "blueprint" } } },
  "SERVICE_AGREEMENT", { include_indemnity_clause: "No" });
ok(declined[0].declined_by_toggle && declined[0].disclosed && declined[0].inclusion_basis === INCLUSION_BASIS.TEMPLATE_STANDARD && declined[0].user_decision === USER_DECISION.DECLINED,
  "a protection present although the user answered No is not treated as their choice, and is disclosed");
const withoutIndemnity = { ...nda, clauses: nda.clauses.filter((c) => c.clause_id !== "CORE_INDEMNITY_FULL_001") };
ok(!protectionDisclosures(withoutIndemnity).some((e) => e.clause_id === "CORE_INDEMNITY_FULL_001") && protectionDisclosures(withoutIndemnity).length === protectionDisclosures(nda).length - 1,
  "a protection deleted after generation is no longer disclosed; the others still are");
const unrecorded = decideProtections({ document_type: "NDA", clauses: [{ clause_id: "CORE_INDEMNITY_FULL_001", title: "Indemnity" }], metadata: {} }, "NDA", {});
const unrecordedText = protectionDisclosures({ clauses: [{ clause_id: "CORE_INDEMNITY_FULL_001" }], metadata: { protection_decisions: unrecorded } })[0]?.text || "";
ok(unrecorded[0].inclusion_basis === INCLUSION_BASIS.ORIGIN_NOT_RECORDED && /does not record how it was added/.test(unrecordedText),
  "a protection with no recorded origin says so, instead of guessing one");
for (const [type, { draft }] of Object.entries(SAVED.documents)) {
  const before = JSON.stringify(buildDisclosureBlock({ ...draft, metadata: { ...draft.metadata, protection_decisions: undefined } }));
  ok(JSON.stringify(buildDisclosureBlock(draft)) === before && !draft.metadata.protection_decisions,
    `a ${type} saved before D4.50 exports the same disclosure as before (nothing is added to a stored document)`);
}

/* ── 7. No claim of legal necessity ───────────────────────────────────────── */
const model = protectionDecisionModel();
const allTexts = [...results.values()].flatMap((r) => protectionDisclosures(r.draft).map((e) => e.text));
ok(allTexts.length === 93 && allTexts.every((t) => !/\b(required by law|legally required|mandatory|must be included)\b/i.test(t)),
  "no disclosure says a protection is required by law");
ok(!Object.values(model.origins).some((o) => /REQUIRED/.test(o.basis)) && model.review_status === "draft-needs-legal-review",
  "the model has no 'legally required' basis, and its wording awaits legal review");

console.log(`\ninjectedProtections: ${checks} checks passed`);
process.exit(0);
