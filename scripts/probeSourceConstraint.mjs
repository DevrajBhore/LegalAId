/**
 * probeSourceConstraint.mjs
 *
 * CAN THE CURRENT REPRESENTATION SAY WHY A SOURCE DOES OR DOES NOT COUNT,
 * WITHOUT CHANGING THE EXTERNAL-COHERENCE MECHANISM?
 *
 * One question, nine fixtures, and the only thing that varies between them is
 * WHO produced the evidence. Same subject, same provision, same value.
 *
 * Three families, and three different reasons a source might not count:
 *
 *     SHA / articles    IDENTITY and PROVENANCE — are these the constitutional
 *                       documents of THIS company, and the filed version?
 *     POA / capacity    COMPETENCE and INTEREST — can this person speak to
 *                       capacity, and do they benefit from the answer?
 *     Loan / LRN        POWER TO GRANT — can this body issue the thing at all?
 *
 * Two encodings are attempted with today's mechanism and nothing else:
 *
 *     A. put the source in `subject` and name it in subject_binding
 *     B. assess the source as a SECOND external requirement of its own
 *
 * If either expresses all nine correctly, nothing should be added. If neither
 * does, the output names the missing property precisely rather than proposing a
 * field.
 *
 * Run: node scripts/probeSourceConstraint.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { assessRequirements, loadDocumentRequirements, COVERAGE }
  from "../backend/services/documentRequirements.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROBE = path.join(ROOT, "knowledge-base/documents/requirements/__sourceconstraint.requirements.json");

// ── The nine fixtures ───────────────────────────────────────────────────────
const CASES = [
  // family, label, the source that produced the record, should it count?
  ["SHA", "the Registrar's filed copy", { registry: "ROC", filed: "YES" }, true],
  ["SHA", "the company's own unfiled draft", { registry: "SELF", filed: "NO" }, false],
  ["SHA", "another company's filed articles", { registry: "ROC", filed: "YES" }, false, "wrongSubject"],
  ["SHA", "a filed copy, source unstated", {}, false],
  ["POA", "a registered medical practitioner", { role: "REGISTERED_MEDICAL_PRACTITIONER" }, true],
  ["POA", "the donee, who benefits", { role: "DONEE" }, false],
  ["POA", "an unrelated person", { role: "ACQUAINTANCE" }, false],
  ["LOAN", "the authorised dealer bank", { role: "AUTHORISED_DEALER_BANK" }, true],
  ["LOAN", "the borrower", { role: "BORROWER" }, false],
  ["LOAN", "an unrelated consultancy", { role: "CONSULTANT" }, false],
];

const FAMILIES = {
  SHA: {
    documentType: "SHAREHOLDERS_AGREEMENT",
    instrument: "ARTICLES_OF_ASSOCIATION", provision: "share_transfer_restrictions",
    requires: "RESTRICTED", clause: "CORP_SHARE_TRANSFER_001",
    variables: { company_cin: "U72900MH2019PTC123456" },
    bind: ["company_cin"],
    sourceProvision: "filed", sourceRequires: "YES",
  },
  POA: {
    documentType: "POWER_OF_ATTORNEY",
    instrument: "DONOR_STATUS_EVIDENCE", provision: "donor_capacity",
    requires: "SUBSISTS", clause: "POA_APPOINTMENT_001",
    variables: { donor_identity_number: "AAAPZ1234C" },
    bind: ["donor_identity_number"],
    sourceProvision: "role", sourceRequires: "REGISTERED_MEDICAL_PRACTITIONER",
  },
  LOAN: {
    documentType: "LOAN_AGREEMENT",
    instrument: "loan registration record", provision: "loan_registration_number_issued",
    requires: "ISSUED", clause: "LOAN_FEMA_ECB_001",
    variables: { party_1_name: "Meridian Capital Advisors Private Limited" },
    bind: ["party_1_name"],
    sourceProvision: "role", sourceRequires: "AUTHORISED_DEALER_BANK",
  },
};

const write = (family) => {
  const f = FAMILIES[family];
  // A probe-only document type. Writing these under the family's real type
  // silently REPLACED the authored requirements in the loader's map — last file
  // wins — so the first run assessed a document whose requirements had been
  // overwritten by the probe's own.
  fs.writeFileSync(PROBE, JSON.stringify({
    document_type: "__SOURCE_PROBE",
    requirements: [
      {
        id: "SUBSTANCE", kind: "EXTERNAL_COHERENCE",
        statement: "The external instrument records what this Agreement requires of it.",
        identity_test: "Remove it and the document is assessed only against itself.",
        applicability: { always: true }, satisfied_by: { any_of: [f.clause] },
        external_instrument: f.instrument, external_provision: f.provision,
        subject_binding: f.bind, requires: f.requires,
        when_unsatisfied: "ESCALATE", review_status: "probe-only",
      },
      {
        // ENCODING B: the source, assessed as a requirement of its own. This is
        // expressible today with no mechanism change at all.
        id: "SOURCE", kind: "EXTERNAL_COHERENCE",
        statement: "The evidence came from a source with standing to produce it.",
        identity_test: "Remove it and a record from anyone at all settles the question.",
        applicability: { always: true }, satisfied_by: { any_of: [f.clause] },
        external_instrument: f.instrument, external_provision: f.sourceProvision,
        subject_binding: f.bind, requires: f.sourceRequires,
        when_unsatisfied: "ESCALATE", review_status: "probe-only",
      },
    ],
  }));
};

console.log("=".repeat(104));
console.log("ONLY THE SOURCE VARIES.  Same subject, same provision, same value.");
console.log("=".repeat(104));
console.log("family  source".padEnd(52) + "counts?  SUBSTANCE            SOURCE");
console.log("-".repeat(104));

const rows = [];
try {
  for (const [family, label, sourceFields, shouldCount, mode] of CASES) {
    const f = FAMILIES[family];
    write(family);
    loadDocumentRequirements({ refresh: true });
    const subject = Object.fromEntries(f.bind.map((k) => [k, f.variables[k]]));
    if (mode === "wrongSubject") subject[f.bind[0]] = "SOMEBODY ELSE";
    const instruments = [{
      instrument: f.instrument, subject,
      provisions: { [f.provision]: f.requires, ...sourceFields },
      as_of: new Date().toISOString().slice(0, 10),
    }];
    const assessment = assessRequirements(
      "__SOURCE_PROBE", [f.clause], {}, f.variables, instruments
    );
    const substance = assessment.results.find((r) => r.id === "SUBSTANCE");
    const source = assessment.results.find((r) => r.id === "SOURCE");
    rows.push({ family, label, shouldCount, substance: substance.coverage, source: source.coverage });
    console.log(
      `${family.padEnd(8)}${label.padEnd(44)}${(shouldCount ? "yes" : "no").padEnd(9)}` +
      `${substance.coverage.padEnd(21)}${source.coverage}`
    );
  }
} finally {
  fs.unlinkSync(PROBE);
  loadDocumentRequirements({ refresh: true });
}

// ── The verdict ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(104));
console.log("WHAT THE TWO ENCODINGS ACTUALLY ACHIEVE");
console.log("=".repeat(104));

const shouldNot = rows.filter((r) => !r.shouldCount);
const substanceStillPositive = shouldNot.filter((r) => r.substance === COVERAGE.RESOLVED);
const sourceCaught = shouldNot.filter((r) => r.source !== COVERAGE.RESOLVED);

console.log(`
  ENCODING A — put the source in subject_binding
      Works only where the expected source is a FIELD OF THIS TRANSACTION.
      "${FAMILIES.SHA.bind.join(", ")}" is one, and it already catches another company's
      articles (below). "the Registrar of Companies", "a registered medical practitioner"
      and "an authorised dealer bank" are not transaction fields and never will be, so the
      encoding does not reach the cases this probe is about.

  ENCODING B — assess the source as a second requirement
      ${sourceCaught.length} of ${shouldNot.length} inadmissible sources are correctly NOT resolved on the SOURCE axis.
      ${substanceStillPositive.length} of ${shouldNot.length} are STILL RESOLVED on the SUBSTANCE axis.
`);
console.log(
  substanceStillPositive.length
    ? `  So the answer to the narrow question is NO, and the missing property is precise:\n\n` +
      `      a source constraint must decide whether THAT RECORD counts at all,\n` +
      `      not stand beside it as an independent finding.\n\n` +
      `  Encoding B does report the bad source. It reports it as a SECOND requirement, and the\n` +
      `  substantive requirement goes on saying ESTABLISHED_POSITIVE about a record produced by\n` +
      `  the donee, or the borrower, or a consultancy. A reader taking the substance line at face\n` +
      `  value — which is what a summary count does — still gets the false green. Two findings\n` +
      `  beside each other are not the same as one record being refused.\n\n` +
      `  What is NOT established by this probe: whether identity, competence and power-to-grant\n` +
      `  share one executable shape. All three are expressed here as "the record's own stated\n` +
      `  source must equal a declared value", which is suspiciously easy and may simply be the\n` +
      `  probe flattening them. The record ASSERTS its own source; nothing checks that assertion.\n` +
      `  A mechanism that trusts evidence about where evidence came from has moved the problem,\n` +
      `  not solved it — and that is the next thing to settle, before any field is added.`
    : `  Every inadmissible source is refused on the substance axis. Nothing needs adding.`
);
