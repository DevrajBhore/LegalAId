/**
 * probeProvenanceClaim.mjs
 *
 * CAN THIS SYSTEM TELL A PROPOSITION SUPPORTED BY AN AUTHORITATIVE SOURCE FROM
 * ONE MERELY ACCOMPANIED BY A CLAIM OF AUTHORITY?
 *
 * The source-constraint probe stopped at a harder question. If a record can say
 * where it came from, and the system believes it, then:
 *
 *     untrusted record -> claims a trusted source -> system trusts the claim
 *                      -> evidence accepted
 *
 * which is a self-authenticating evidence system. Two different questions hide
 * inside "who produced this":
 *
 *     1. what source does this evidence CLAIM to come from?      (metadata)
 *     2. what independently establishes that claim?              (evidence
 *                                                                 about evidence)
 *
 * The substantive proposition is held constant throughout — every record below
 * says the same true thing about the same subject. Only how its provenance is
 * established varies. Both mechanisms are asked, because they read provenance
 * from different places and the difference matters:
 *
 *     EXTERNAL_COHERENCE      reads record.provisions  — the record's CONTENT
 *     EVIDENCE_PROPOSITIONS   reads record.provenance  — the record's METADATA
 *
 * Run: node scripts/probeProvenanceClaim.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { assessRequirements, loadDocumentRequirements }
  from "../backend/services/documentRequirements.js";
import { establish, loadPropositions } from "../backend/services/evidencePropositions.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROBE = path.join(ROOT, "knowledge-base/documents/requirements/__provenance.requirements.json");
const TODAY = new Date().toISOString().slice(0, 10);

// ── Six ways a provenance claim might be backed, or not ─────────────────────
const MODES = [
  ["A  the record merely claims its source",
   { claimed: "public_register" }],
  ["B  claim + system metadata naming the source",
   { claimed: "public_register", retrieved_by: "LegalAId ingestion" }],
  ["C  independently retrieved from the authority",
   { claimed: "public_register", retrieval: { channel: "rbi-public-register", verified: true } }],
  ["D  independently retrieved, bound to the transaction",
   { claimed: "public_register", retrieval: { channel: "rbi-public-register", verified: true },
     bound: true }],
  ["E  CONFLICTING: claims the register, arrived by email from the party",
   { claimed: "public_register", retrieval: { channel: "email attachment from the lender",
     verified: false } }],
  ["F  no provenance stated at all",
   {}],
];

// ── Mechanism 1: EXTERNAL_COHERENCE ─────────────────────────────────────────
fs.writeFileSync(PROBE, JSON.stringify({
  document_type: "__PROVENANCE_PROBE",
  requirements: [{
    id: "SUBSTANCE", kind: "EXTERNAL_COHERENCE",
    statement: "The external record establishes what this Agreement requires of it.",
    identity_test: "Remove it and the document is assessed only against itself.",
    applicability: { always: true }, satisfied_by: { any_of: ["LOAN_FEMA_ECB_001"] },
    external_instrument: "loan registration record",
    external_provision: "loan_registration_number_issued",
    subject_binding: ["party_1_name"], requires: "ISSUED",
    when_unsatisfied: "ESCALATE", review_status: "probe-only",
  }],
}));

const VARIABLES = { party_1_name: "Meridian Capital Advisors Private Limited", lender_name: "Meridian Capital Advisors Private Limited" };

console.log("=".repeat(104));
console.log("THE SAME TRUE PROPOSITION, ABOUT THE SAME SUBJECT. ONLY PROVENANCE VARIES.");
console.log("=".repeat(104));
console.log("mode".padEnd(56) + "EXTERNAL_COHERENCE".padEnd(24) + "EVIDENCE_PROPOSITION");
console.log("-".repeat(104));

const results = [];
try {
  loadDocumentRequirements({ refresh: true });
  loadPropositions({ refresh: true });
  for (const [label, provenance] of MODES) {
    // EXTERNAL_COHERENCE: provenance can only live in the record's own content.
    const externalRecord = [{
      instrument: "loan registration record",
      subject: { party_1_name: VARIABLES.party_1_name },
      provisions: {
        loan_registration_number_issued: "ISSUED",
        ...(provenance.claimed ? { source: provenance.claimed } : {}),
      },
      as_of: TODAY,
      ...provenance,
    }];
    const external = assessRequirements(
      "__PROVENANCE_PROBE", ["LOAN_FEMA_ECB_001"], {}, VARIABLES, externalRecord
    ).results.find((r) => r.id === "SUBSTANCE");

    // EVIDENCE_PROPOSITION: provenance is a first-class metadata field.
    const proposition = establish("lender_is_nbfc", [{
      proposition: "lender_is_nbfc",
      subject: { lender_name: VARIABLES.lender_name },
      state: "TRUE", as_of: TODAY,
      ...(provenance.claimed ? { provenance: provenance.claimed } : {}),
      authority: "as stated on the record",
      ...provenance,
    }], VARIABLES);

    results.push({ label, external: external.coverage, proposition: proposition.evidence });
    console.log(label.padEnd(56) + external.coverage.padEnd(24) + proposition.evidence);
  }
} finally {
  fs.unlinkSync(PROBE);
  loadDocumentRequirements({ refresh: true });
}

// ── The verdict ─────────────────────────────────────────────────────────────
const byMode = Object.fromEntries(results.map((r) => [r.label.slice(0, 1), r]));
console.log("\n" + "=".repeat(104));
console.log("CAN EITHER MECHANISM TELL A CLAIM OF AUTHORITY FROM AUTHORITY?");
console.log("=".repeat(104));

const claimVsRetrieved = (key) => byMode.A[key] === byMode.C[key];
const acceptsConflict = (key) => byMode.E[key] === byMode.C[key];

console.log(`
  EXTERNAL_COHERENCE
      A (bare claim) -> ${byMode.A.external}      C (independently retrieved) -> ${byMode.C.external}
      ${claimVsRetrieved("external")
        ? "IDENTICAL. The mechanism reads `provisions` and nothing else; every other field on the\n" +
          "      record — how it arrived, whether anyone verified it — is invisible to it. It cannot\n" +
          "      see provenance at all, so it cannot be fooled about provenance either. It simply\n" +
          "      never asks."
        : "They differ."}

  EVIDENCE_PROPOSITION
      A (bare claim) -> ${byMode.A.proposition}   C (independently retrieved) -> ${byMode.C.proposition}
      E (claims the register, arrived by email from the party) -> ${byMode.E.proposition}
      F (no provenance stated) -> ${byMode.F.proposition}
`);
console.log(
  claimVsRetrieved("proposition") && acceptsConflict("proposition")
    ? `  THIS IS THE FINDING, AND IT IS ABOUT A MECHANISM I BUILT AND DEFENDED.\n\n` +
      `  admissible_provenance checks a CLAIM ABOUT PROVENANCE, not provenance. The record says\n` +
      `  provenance: "public_register" and the layer believes it. A record that arrived as an email\n` +
      `  attachment from the very party whose status is in question is accepted on identical terms\n` +
      `  as one retrieved from the register, because the only thing distinguishing them is a field\n` +
      `  the mechanism does not read.\n\n` +
      `  So the two defences in evidencePropositions are not what they appeared to be:\n` +
      `      the absolute rule (an inference is never an authority)  — holds, it is about a\n` +
      `          provenance VALUE the system itself would have to assert\n` +
      `      the declaration's own list (lender_is_nbfc excludes operator_declaration) — is only\n` +
      `          as good as the record's honesty about which of those it is\n\n` +
      `  tests/evidencePropositions.test.mjs asserts that a record labelled ai_inference is refused.\n` +
      `  It does NOT assert — and cannot — that a record labelled public_register came from one.\n` +
      `  The test is true and the security property I claimed for it is narrower than I said.\n\n` +
      `  WHAT THIS MEANS FOR THE OPEN QUESTION. Adding a source constraint to EXTERNAL_COHERENCE\n` +
      `  would give it the same property: a check on what the record says about itself. That is\n` +
      `  worth having — it stops honest mislabelling and makes the requirement state who should\n` +
      `  have produced the record — but it must not be described as establishing authority, and\n` +
      `  a certification state must not read as though it does.\n\n` +
      `  The missing primitive is therefore NOT "a source predicate". It is a distinction the\n` +
      `  evidence model does not yet draw at all:\n\n` +
      `      SELF-ASSERTED     the record says where it came from\n` +
      `      SYSTEM-OBSERVED   the system recorded where it got it\n\n` +
      `  Only the second can support a claim about authority, and nothing in the record shape\n` +
      `  distinguishes them today. Both mechanisms take the record's word for it — one by reading\n` +
      `  a content field, the other by reading a metadata field, neither by knowing anything.`
    : `  At least one mechanism distinguishes them.`
);
