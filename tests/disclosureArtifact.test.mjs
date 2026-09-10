/**
 * disclosureArtifact.test.mjs
 *
 * Phase 5.1. A disclosure that appears in the app but not in the file the
 * parties sign is worth less than none, because it creates the belief that the
 * reader was told.
 *
 * So these tests read the ARTIFACTS -- the text, the DOCX bytes, the PDF bytes
 * -- and look for the disclosure inside them. Asserting that a renderer was
 * called would pass while the signed document stayed silent.
 *
 * The exporters share one renderer. If they ever each work out for themselves
 * what to disclose, the DOCX will say one thing, the PDF another and the API a
 * third, and the one that governs is whichever the parties signed.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { draftToText, draftToDocx, draftToPdf } from "../backend/services/exportService.js";
import { buildDisclosureBlock, DISCLOSURE_HEADING } from "../backend/services/disclosureRenderer.js";
import { resolvePositions } from "../backend/services/positionResolution.js";

const BASE = {
  party_1_name: "Devraj Vishal Bhore", party_1_type: "Individual",
  party_2_name: "Varun Raghunath Shastri", party_2_type: "Individual",
  consulting_fee: "30000", contract_duration: "12 months",
  services_description: "Strategic advisory covering market entry.",
  consulting_services: "Strategic advisory covering market entry.",
  deliverables: "Monthly strategy reports.",
  payment_terms: "Rs. 30,000 per month.", effective_date: "2026-08-21",
  operating_state: "Maharashtra", execution_city: "Pune",
};
let checks = 0;

// DOCX is a zip; PDF compresses its streams. Neither yields the sentence to a
// naive byte search, so both are searched for evidence the block was written --
// and the text export, which shares the same renderer, is checked verbatim.
const asString = (buffer) => Buffer.from(buffer).toString("latin1");

const generated = await generateDocument({ document_type: "CONSULTANCY_AGREEMENT", variables: BASE, answers: {} });
assert.ok(generated?.draft, "the fixture must generate");

// ── 1. A material assumption exists ─────────────────────────────────────────
const block = buildDisclosureBlock(generated.draft);
assert.ok(block && block.entries.length >= 2,
  "a document drafted with no answers must have something to disclose");
checks += 1;

// ── 2 & 3. Each artifact carries it, identifiably ───────────────────────────
const text = draftToText(generated.draft);
assert.ok(text.includes(DISCLOSURE_HEADING),
  "the text export omits the disclosure heading");
assert.ok(text.includes(block.entries[1].text),
  "the text export omits a disclosure entry verbatim");
assert.ok(/\[(OPEN POINT|ASSUMED|DRAFTING DEFAULT)\]/.test(text),
  "a disclosure must be identifiable as one; an unlabelled paragraph at the end of a " +
  "contract reads as a term of it");
assert.ok(text.includes("not part of the agreement between the parties"),
  "the disclosure must say it is not part of the bargain");
checks += 4;

const docx = asString(await draftToDocx(generated.draft));
const pdf = asString(await draftToPdf(generated.draft));
const bare = await generateDocument({ document_type: "CONSULTANCY_AGREEMENT", variables: BASE, answers: {} });
bare.draft.metadata = { ...bare.draft.metadata, assumptions: [] };
const docxBare = asString(await draftToDocx(bare.draft));
const pdfBare = asString(await draftToPdf(bare.draft));

assert.ok(docx.length > docxBare.length + 200,
  `the DOCX is not materially larger with ${block.entries.length} disclosures than without ` +
  `(${docx.length} vs ${docxBare.length}). The block is not reaching the signed file.`);
assert.ok(pdf.length > pdfBare.length + 200,
  `the PDF is not materially larger with the disclosure than without ` +
  `(${pdf.length} vs ${pdfBare.length}).`);
checks += 2;

// ── 4. Substantive clauses are untouched ────────────────────────────────────
assert.deepStrictEqual(
  generated.draft.clauses.map((c) => c.clause_id),
  bare.draft.clauses.map((c) => c.clause_id),
  "adding a disclosure must not change which clauses the agreement contains"
);
for (const clause of generated.draft.clauses) {
  assert.ok(!String(clause.text || "").includes(DISCLOSURE_HEADING),
    `${clause.clause_id} has absorbed the disclosure into its own text`);
  checks += 1;
}
checks += 1;

// ── 5. Nothing to disclose produces no section ──────────────────────────────
assert.strictEqual(buildDisclosureBlock(bare.draft), null,
  "an empty assumption list must produce no block, not an empty heading");
assert.ok(!draftToText(bare.draft).includes(DISCLOSURE_HEADING),
  "a document with nothing to disclose must not carry an empty disclosure section");
assert.strictEqual(buildDisclosureBlock({ metadata: {} }), null,
  "a draft with no assumptions key at all must produce no block");
checks += 3;

// ── 6. The assumed side is disclosed when the draft rests on one ────────────
const assumedSide = resolvePositions({ documentType: "CONSULTANCY_AGREEMENT", variables: BASE, answers: {} });
assert.ok(Object.values(assumedSide.positions).some((p) => p.restsOnAssumedSide),
  "with no drafting_for answer, positions must be marked as resting on an assumed side");
assert.ok(assumedSide.assumptions.some((a) => a.provenance === "assumed_counterparty"),
  "a draft resting on an assumed side must disclose that assumption");
const statedSide = resolvePositions({
  documentType: "CONSULTANCY_AGREEMENT",
  variables: { ...BASE, drafting_for: "Client" }, answers: {},
});
assert.ok(!statedSide.assumptions.some((a) => a.provenance === "assumed_counterparty"),
  "where the user said which side they are on, nothing may be disclosed as assumed about it");
checks += 3;

// ── 7. DEFAULT_AND_DISCLOSE produces its disclosure ─────────────────────────
const defaulted = assumedSide.outcomes.filter((o) => o.outcome === "DEFAULTED");
assert.ok(defaulted.length >= 1, "at least one position must be defaulted on a bare intake");
for (const outcome of defaulted) {
  assert.ok(assumedSide.assumptions.some((a) => a.text === outcome.disclosure),
    `${outcome.mechanism} was defaulted but its disclosure never reached the document. A ` +
    `position adopted without being disclosed is the defect this phase exists to prevent.`);
  checks += 1;
}

// ── 8. Malformed answers never become fabricated disclosures ────────────────
const malformed = resolvePositions({
  documentType: "CONSULTANCY_AGREEMENT", variables: BASE,
  answers: { NOT_A_FACT: "Yes", THIRD_PARTY_EXPOSURE: "Perhaps" },
});
assert.ok(malformed.unmatched.length >= 2, "malformed answers must be reported as unmatched");
for (const entry of malformed.unmatched) {
  const invented = malformed.assumptions.find((a) => String(a.text).includes(String(entry.answer)));
  assert.ok(!invented,
    `an unplaceable answer ("${entry.answer}") produced a disclosure. The disclosure layer ` +
    `must state what the engine knows, never manufacture an explanation for input it could ` +
    `not read -- a fabricated disclosure is indistinguishable from a real one.`);
  checks += 1;
}
console.log(
  `PASS  disclosure reaches text, DOCX and PDF; ${block.entries.length} entries, ` +
  `clauses unchanged, nothing fabricated`
);
console.log(`\nALL GREEN (${checks} checks)`);
