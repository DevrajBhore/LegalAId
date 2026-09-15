/**
 * probeEvidenceAuthority.mjs
 *
 * IS AUTHORITY INTRINSIC TO EXTERNAL-COHERENCE EVIDENCE, OR SPECIFIC TO CERTAIN
 * PROPOSITIONS?
 *
 * The Loan matrix rejected its own hypothesis. Third-party consent needs no new
 * architecture: EXTERNAL_COHERENCE already separates "an approval is required"
 * from "the approval was obtained" and handles all six evidence states. What it
 * exposed instead was narrower — a record naming the right transaction, the
 * right provision and the right value is accepted whoever produced it:
 *
 *     LRN issued by the Reserve Bank                  -> ESTABLISHED_POSITIVE
 *     LRN "issued" by the borrower's compliance team  -> ESTABLISHED_POSITIVE
 *
 * Before that becomes a mechanism-wide change, two questions have to be answered
 * across families rather than inside one:
 *
 *   1. Does every external-coherence user need authority binding, or only some?
 *      If the shareholders' agreement cares about IDENTITY (are these the
 *      articles of THIS company?) and the loan cares about COMPETENCE (is this
 *      body able to issue an LRN at all?), they are not the same semantics and
 *      one flag should not pretend they are.
 *   2. Is there a single reusable representation of
 *      subject + source authority + proposition + evidence state that expresses
 *      all of them WITHOUT family-specific logic? If the answer is yes the
 *      smallest fix may be to share one concern rather than merge two
 *      mechanisms.
 *
 * Nothing is authored here. No requirements file survives this script.
 *
 * Run: node scripts/probeEvidenceAuthority.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  assessRequirements, loadDocumentRequirements, COVERAGE,
} from "../backend/services/documentRequirements.js";
import { loadPropositions } from "../backend/services/evidencePropositions.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

// ── Part 1: is the gap uniform across every external-coherence user? ────────
//
// Same attack the loan exposed, run against the requirements the product
// actually declares: right subject, right provision, right value, and a source
// with no standing to say it.
const requirements = loadDocumentRequirements({ refresh: true });
const external = [];
for (const [family, list] of requirements) {
  for (const r of list) {
    if (r.kind === "EXTERNAL_COHERENCE") external.push({ family, requirement: r });
  }
}

// Clause fixtures come from the requirement's OWN satisfied_by, never from a
// list that looks right. Invented ones left both families reporting ESCALATED --
// applicable and unsatisfied -- so the external assessment never ran at all and
// the probe "proved" a uniformity it had not tested.
const satisfyingClauses = (requirement) =>
  requirement.satisfied_by?.all_of || requirement.satisfied_by?.any_of || [];

const FIXTURES = {
  SHAREHOLDERS_AGREEMENT: {
    variables: { company_cin: "U72900MH2019PTC123456", company_name: "Acme Technologies Private Limited" },
    impostor: "the company's own secretarial team, from an unfiled draft",
    competent: "the Registrar of Companies, from the filed articles",
  },
  POWER_OF_ATTORNEY: {
    variables: { donor_identity_number: "AAAPZ1234C", donor_name: "Ramesh Iyer" },
    impostor: "the donee, who benefits from the answer",
    competent: "a registered medical practitioner",
  },
};

console.log("=".repeat(100));
console.log("PART 1 — IS THE GAP UNIFORM?  right subject, right value, no standing to say it");
console.log("=".repeat(100));
for (const { family, requirement } of external) {
  const fixture = FIXTURES[family];
  if (!fixture) { console.log(`  ${family}: no fixture`); continue; }
  const record = (extra) => [{
    instrument: requirement.external_instrument,
    subject: Object.fromEntries(requirement.subject_binding.map((f) => [f, fixture.variables[f]])),
    provisions: { [requirement.external_provision]: requirement.requires },
    as_of: new Date().toISOString().slice(0, 10),
    ...extra,
  }];
  const clauses = satisfyingClauses(requirement);
  const assess = (extra) => assessRequirements(
    family, clauses, {}, fixture.variables, record(extra)
  ).results.find((r) => r.id === requirement.id);

  const competent = assess({ source: fixture.competent });
  const impostor = assess({ source: fixture.impostor });
  console.log(`\n  ${family} / ${requirement.id}   (satisfied by ${clauses.join(", ")})`);
  console.log(`    from ${fixture.competent.padEnd(48)} ${competent.coverage}`);
  console.log(`    from ${fixture.impostor.padEnd(48)} ${impostor.coverage}`);
  console.log(
    competent.coverage === impostor.coverage
      ? `    SAME. Authority is not represented for this requirement either.`
      : `    They differ.`
  );
}

// ── Part 2: can ONE representation express all of them? ─────────────────────
//
// The evidence-proposition shape already carries subject binding AND admissible
// provenance. The question is whether it can carry what external coherence
// carries, or whether routing everything through it would LOSE something.
console.log("\n" + "=".repeat(100));
console.log("PART 2 — WOULD ONE REPRESENTATION COVER BOTH, OR LOSE SOMETHING?");
console.log("=".repeat(100));
const propositions = loadPropositions({ refresh: true });
const sample = [...propositions.values()][0];
console.log(`
  EXTERNAL_COHERENCE carries          EVIDENCE_PROPOSITION carries
  ----------------------------------  ----------------------------------
  external_instrument                 (implicit in the proposition id)
  external_provision                  (implicit in the proposition id)
  subject_binding  ${String(Boolean(external[0]?.requirement.subject_binding)).padEnd(18)} subject_binding  ${Boolean(sample?.subject_binding)}
  requires: "${external[0]?.requirement.requires}"${" ".repeat(Math.max(0, 22 - String(external[0]?.requirement.requires).length))}state: TRUE | FALSE
  evidence_valid_for_days             evidence_valid_for_days
  (no source constraint)              admissible_provenance
`);
const valued = external.filter((e) => !["TRUE", "FALSE"].includes(String(e.requirement.requires).toUpperCase()));
console.log(
  valued.length
    ? `  ${valued.length} of ${external.length} external requirements compare a NAMED VALUE, not a boolean:\n` +
      valued.map((e) => `      ${e.family}/${e.requirement.id}: requires "${e.requirement.requires}" ` +
        `for "${e.requirement.external_provision}"`).join("\n") +
      `\n\n  A proposition is TRUE or FALSE. Routing these through it would turn\n` +
      `  "the articles record PERMITTED where this Agreement requires RESTRICTED"\n` +
      `  into "the proposition is false", losing WHAT THE INSTRUMENT ACTUALLY SAYS —\n` +
      `  which is the sentence an advocate needs and the reason AMBIGUOUS_EVIDENCE and\n` +
      `  CONTRADICTED are different states.\n\n` +
      `  So neither mechanism is a superset of the other:\n` +
      `      external coherence has the value comparison and no source constraint\n` +
      `      propositions have the source constraint and no value comparison\n` +
      `  Merging them would lose one or duplicate the other. The smallest reusable thing is\n` +
      `  the SOURCE ADMISSIBILITY CHECK itself, shared by both — not a merged mechanism.`
    : "  Every external requirement is boolean; propositions could express them all."
);

// ── Part 3: do the two families want the same thing from authority? ─────────
console.log("\n" + "=".repeat(100));
console.log("PART 3 — SAME FLAG, OR DIFFERENT SEMANTICS?");
console.log("=".repeat(100));
console.log(`
  These are the questions each family's evidence actually raises. They are
  authorial judgements, printed for a person rather than decided here:

  SHAREHOLDERS_AGREEMENT / ARTICLES_OF_ASSOCIATION
      the concern is IDENTITY — are these the articles of THIS company, and are
      they the filed version rather than a draft? The articles are what they are;
      no third party "grants" them. A source constraint here would be about
      PROVENANCE OF A COPY.

  POWER_OF_ATTORNEY / DONOR_STATUS_EVIDENCE
      the concern is COMPETENCE and INTEREST — a donor's capacity attested by the
      donee is worth nothing, whoever holds the paper. Closest to
      admissible_provenance as it already exists.

  LOAN / regulatory approval (not authored)
      the concern is POWER TO GRANT — an LRN is issued by the Reserve Bank
      through an authorised dealer bank, and nobody else can issue one at all.

  Three different reasons a source might not count. Whether one declaration
  serves all three is the question to answer BEFORE adding a field, because a
  flag that means three things is how "risk_level" stopped meaning anything.
`);
