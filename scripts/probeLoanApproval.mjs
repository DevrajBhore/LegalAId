/**
 * probeLoanApproval.mjs
 *
 * CAN THIS SYSTEM TELL "AN APPROVAL IS REQUIRED" FROM "THE APPROVAL WAS
 * OBTAINED"?
 *
 * Matrix before implementation. Nothing here is authored into the product: the
 * requirements file below is written, run and deleted, and the question is what
 * the model AS IT STANDS can and cannot represent.
 *
 * The case is real. Every ECB loan the product can generate carries
 * LOAN_FEMA_ECB_001, which says:
 *
 *     "...the obtaining of a Loan Registration Number (LRN) and filing of Form
 *      ECB and monthly ECB-2 returns through the authorised dealer bank.
 *      DRAWDOWN SHALL NOT OCCUR UNTIL ALL APPLICABLE APPROVALS AND
 *      REGISTRATIONS ARE IN PLACE."
 *
 * Three propositions hide in that sentence and the architecture has names for at
 * most two:
 *
 *     approval_required   this transaction needs an LRN        (a rule)
 *     approval_obtained   the LRN has actually been issued      (a world fact)
 *     approval_subject    who issues it — the Reserve Bank,
 *                         through the authorised dealer bank    (NOT A PARTY)
 *
 * The third is what makes this different from the shareholders' agreement. There
 * the external instrument was the articles OF THE CONTRACTING COMPANY, and
 * subject binding tied the evidence to a party's own fields. Here the actor is
 * outside the agreement entirely, and nothing in `variables` names it.
 *
 * The control that matters:  required=YES obtained=UNKNOWN
 *                    versus  required=YES obtained=YES
 * If those two produce the same certification outcome, the system cannot tell a
 * drafted obligation from a discharged one, and that is the architectural
 * failure — not a missing field.
 *
 * Run: node scripts/probeLoanApproval.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  assessRequirements, loadDocumentRequirements,
} from "../backend/services/documentRequirements.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const PROBE = path.join(ROOT, "knowledge-base/documents/requirements/__loanapproval.requirements.json");

const CLAUSES = [
  "CORE_IDENTITY_001", "CORE_PURPOSE_001", "LOAN_AMOUNT_001", "LOAN_INTEREST_001",
  "LOAN_REPAYMENT_001", "LOAN_COVENANTS_001", "LOAN_DEFAULT_001", "LOAN_SECURITY_001",
  "LOAN_FEMA_ECB_001", "CORE_GOVERNING_LAW_001", "CORE_SIGNATURE_BLOCK_001",
];

// Two ways of asking, both expressible today, run side by side.
// Probe-only document type: written under the real one this replaces that
// family's authored requirements while the probe runs.
fs.writeFileSync(PROBE, JSON.stringify({
  document_type: "__LOAN_APPROVAL_PROBE",
  requirements: [
    {
      // (a) CONTENT — the only shape most families use.
      id: "APPROVALS_ADDRESSED",
      kind: "CONTENT",
      statement: "The approvals a cross-border loan depends on are addressed in the instrument.",
      identity_test:
        "Remove it and an ECB agreement says nothing about the registration the drawdown " +
        "depends on.",
      applicability: { always: true },
      satisfied_by: { any_of: ["LOAN_FEMA_ECB_001"] },
      when_unsatisfied: "ESCALATE",
      review_status: "probe-only",
    },
    {
      // (b) EXTERNAL_COHERENCE — the nearest existing shape for a fact outside
      // the document. Note what subject_binding can name: only fields of THIS
      // transaction. There is no way to say "the Reserve Bank".
      id: "ECB_REGISTRATION_OBTAINED",
      kind: "EXTERNAL_COHERENCE",
      statement: "The Loan Registration Number this drawdown depends on has actually been issued.",
      identity_test:
        "Remove it and the agreement's own promise that drawdown waits for approvals is the only " +
        "thing standing between the parties and an unregistered ECB.",
      applicability: { always: true },
      satisfied_by: { any_of: ["LOAN_FEMA_ECB_001"] },
      external_instrument: "loan registration record",
      external_provision: "loan_registration_number_issued",
      subject_binding: ["party_1_name", "loan_amount"],
      requires: "ISSUED",
      when_unsatisfied: "ESCALATE",
      review_status: "probe-only",
    },
  ],
}, null, 1));

const VARIABLES = {
  party_1_name: "Meridian Capital Advisors Private Limited",
  party_2_name: "Kalpesh Enterprises Private Limited",
  loan_amount: "5000000",
};
const record = (provisions, subject = { party_1_name: VARIABLES.party_1_name, loan_amount: VARIABLES.loan_amount }) =>
  [{ instrument: "loan registration record", subject, provisions }];

const CASES = [
  ["1  required=YES  obtained=UNKNOWN   (nothing supplied)", []],
  ["2  required=YES  obtained=YES", record({ loan_registration_number_issued: "ISSUED" })],
  ["3  required=YES  obtained=NO        (refused)", record({ loan_registration_number_issued: "REFUSED" })],
  ["4  required=YES  evidence silent", record({ loan_registration_number_issued: "SILENT" })],
  ["5  evidence about a DIFFERENT transaction",
   record({ loan_registration_number_issued: "ISSUED" },
          { party_1_name: "Sundry Holdings Private Limited", loan_amount: "9000000" })],
  // THE DIMENSION THE OTHER SIX DO NOT TOUCH. Same transaction, same provision,
  // same value — and the approval was issued by somebody with no power to issue
  // it. subject_binding ties a record to THIS DEAL; nothing ties it to the
  // authority competent to grant the thing.
  ["7  issued — by an incompetent authority",
   [{ instrument: "loan registration record",
      subject: { party_1_name: VARIABLES.party_1_name, loan_amount: VARIABLES.loan_amount },
      provisions: { loan_registration_number_issued: "ISSUED" },
      issued_by: "the Borrower's own compliance team" }]],
  ["6  records disagree",
   [...record({ loan_registration_number_issued: "ISSUED" }),
    ...record({ loan_registration_number_issued: "REFUSED" })]],
];

try {
  loadDocumentRequirements({ refresh: true });
  console.log("case".padEnd(46) + "CONTENT (a)".padEnd(22) + "EXTERNAL_COHERENCE (b)");
  console.log("-".repeat(104));
  const seen = new Map();
  for (const [label, instruments] of CASES) {
    const assessment = assessRequirements("__LOAN_APPROVAL_PROBE", CLAUSES, {}, VARIABLES, instruments);
    const content = assessment.results.find((r) => r.id === "APPROVALS_ADDRESSED");
    const external = assessment.results.find((r) => r.id === "ECB_REGISTRATION_OBTAINED");
    console.log(
      label.padEnd(46) +
      `${content.coverage}`.padEnd(22) +
      `${external.coverage} / ${external.finding}`
    );
    seen.set(label.slice(0, 2).trim(), {
      content: content.coverage, external: `${external.coverage}/${external.finding}`,
    });
  }

  console.log("\n" + "=".repeat(104));
  console.log("THE CONTROL");
  console.log("=".repeat(104));
  const one = seen.get("1"), two = seen.get("2"), seven = seen.get("7");
  console.log(
    `  CONTENT:             required=YES obtained=UNKNOWN -> ${one.content}` +
    `   |   obtained=YES -> ${two.content}`
  );
  console.log(
    one.content === two.content
      ? "  IDENTICAL. A requirement satisfied by clause presence cannot tell a drafted obligation\n" +
        "  from a discharged one. The document PROMISES drawdown waits for approvals, and the\n" +
        "  promise is what satisfies the requirement."
      : "  They differ."
  );
  console.log(
    `\n  EXTERNAL_COHERENCE:  required=YES obtained=UNKNOWN -> ${one.external}` +
    `   |   obtained=YES -> ${two.external}`
  );
  console.log(
    one.external === two.external
      ? "  IDENTICAL — the external shape does not separate them either."
      : "  THEY DIFFER. The existing external-coherence shape already separates required from\n" +
        "  obtained, without any new abstraction."
  );
  console.log("\n" + "=".repeat(104));
  console.log("THE DIMENSION THAT IS NOT COVERED");
  console.log("=".repeat(104));
  console.log(`  genuinely issued        -> ${two.external}`);
  console.log(`  'issued' by the Borrower's own compliance team -> ${seven.external}`);
  console.log(
    two.external === seven.external
      ? "  IDENTICAL. subject_binding ties a record to THIS TRANSACTION, and there is no way to\n" +
        "  say who is competent to grant the approval. A Loan Registration Number is issued by\n" +
        "  the Reserve Bank through an authorised dealer bank; a record asserting one, about the\n" +
        "  right deal, from anybody at all, is accepted.\n\n" +
        "  This is NOT the required-vs-obtained gap — that one is already covered. It is a third\n" +
        "  binding: evidence is bound to a transaction and is not bound to an AUTHORITY."
      : "  They differ — competence is already represented."
  );
  // ── Is this actually a MISSING capability, or a capability in the wrong
  // mechanism? Asked before proposing anything, because the two are different
  // problems and only one of them needs new architecture.
  const { establish, EVIDENCE } = await import("../backend/services/evidencePropositions.js");
  const subject = { lender_name: "Meridian Capital Advisors Private Limited" };
  const variables = { lender_name: "Meridian Capital Advisors Private Limited" };
  const asOf = new Date().toISOString().slice(0, 10);
  const fromRegister = establish("lender_is_nbfc", [{
    proposition: "lender_is_nbfc", subject, state: "TRUE",
    provenance: "public_register", authority: "RBI list of registered NBFCs", as_of: asOf,
  }], variables);
  const fromTheParty = establish("lender_is_nbfc", [{
    proposition: "lender_is_nbfc", subject, state: "TRUE",
    provenance: "operator_declaration", authority: "the lender itself", as_of: asOf,
  }], variables);
  console.log("\n" + "=".repeat(104));
  console.log("THE SAME QUESTION, ASKED OF THE PROPOSITION LAYER");
  console.log("=".repeat(104));
  console.log(`  lender_is_nbfc, on a public register        -> ${fromRegister.evidence}`);
  console.log(`  lender_is_nbfc, on the lender's own say-so  -> ${fromTheParty.evidence}`);
  console.log(
    fromRegister.evidence !== fromTheParty.evidence
      ? "  The proposition layer ALREADY constrains who may establish a proposition -- that is what\n" +
        "  admissible_provenance is. So authority-competence is not a missing capability in the\n" +
        "  architecture. It is a capability present in one mechanism and absent from the other:\n\n" +
        "      evidencePropositions   binds to a subject AND to an admissible source\n" +
        "      EXTERNAL_COHERENCE     binds to a subject only\n\n" +
        "  Which is a smaller and more tractable finding than 'third-party consent needs a new\n" +
        "  abstraction', and it is NOT a licence to author a requirement onto the EVIDENCE source\n" +
        "  to demonstrate it. Whether an LRN belongs there is a question about the Loan family's\n" +
        "  real requirements, and this probe authored none."
      : "  The proposition layer does not constrain it either."
  );
} finally {
  fs.unlinkSync(PROBE);
  loadDocumentRequirements({ refresh: true });
}
