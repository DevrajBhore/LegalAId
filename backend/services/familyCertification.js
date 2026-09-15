/**
 * familyCertification.js
 *
 * WHAT HAS THIS DOCUMENT FAMILY ACTUALLY BEEN THROUGH?
 *
 * The dangerous state this exists to prevent:
 *
 *     40 document types
 *     40 generators that run
 *     40 documents called "supported"
 *
 * when perhaps five have been substantively tested. "It generates" and "it has
 * been shown to do the legal work it claims" are different sentences, and only
 * one of them is true of most families here.
 *
 * The ladder:
 *
 *   NOT_ASSESSED              nothing has been said about what this document must do
 *   IDENTITY_AUTHORED         someone has written down what makes it that document
 *   REQUIREMENTS_ADMITTED     those requirements clear the admission gate
 *   GENERATION_COVERAGE_TESTED it generates, and the assessment runs against it
 *   FALSIFICATION_PASSED      someone deliberately tried to make it report green
 *                             while legally unfinished, and named what they tried
 *   ADVOCATE_REVIEW           a lawyer is looking at it
 *   APPROVED                  a lawyer has signed it off
 *
 * STATUS IS DERIVED, NEVER DECLARED. A family cannot be promoted by writing a
 * better word in a file: every rung is computed from evidence that exists
 * independently of the claim. The one rung with an authored component --
 * falsification -- requires naming the specific attack attempted and the false
 * green it produced, because "we tested it" is not evidence and "we fed it a
 * boilerplate façade and it reported 1 of 13" is.
 */
import { loadDocumentRequirements } from "./documentRequirements.js";
import { DOCUMENT_TYPE_REGISTRY } from "../../shared/documentRegistry.js";

/**
 * THREE DIMENSIONS, DELIBERATELY INDEPENDENT.
 *
 * The single ladder conflated two things that the D4.3 trace proved are not the
 * same: what a family has been PUT THROUGH as an implementation, and whether the
 * legal knowledge underneath it has been validated. 3 of 17 facts reach the
 * document, 10 carry statutory authority, and NONE does both — so a family can
 * survive every falsification attack ever written for it while no fact reaching
 * its clauses is tied to a statute.
 *
 * Folding "rule validated -> applicability validated -> consequence validated"
 * into FALSIFICATION_PASSED would therefore have rewritten the meaning of ten
 * existing results retroactively, turning a true statement ("this family
 * survived the falsification corpus applicable to the current implementation")
 * into a false one ("the legal reasoning underneath this family is validated").
 *
 * So the axes are kept apart. FALSIFICATION_PASSED keeps exactly the meaning it
 * had when it was earned. LEGAL_KNOWLEDGE_STATUS starts at NOT_ASSESSED for
 * every family, which is the honest reading of the trace, and APPROVED comes to
 * require all three axes rather than one.
 */
export const LEGAL_KNOWLEDGE_STATUS = [
  "NOT_ASSESSED",            // nothing said about the law underneath this family
  "SOURCE_AUTHORED",         // a concept names Acts and sections for its facts
  "RULE_VALIDATED",          // the representation has been checked against the authority
  "APPLICABILITY_VALIDATED", // the rule fires for the right facts and not others
  "CONSEQUENCE_VALIDATED",   // the legal consequence reaches the document
];

export const GENERATION_STATUS = [
  "NOT_ASSESSED",
  "IDENTITY_AUTHORED",
  "REQUIREMENTS_ADMITTED",
  "GENERATION_COVERAGE_TESTED",
  "FALSIFICATION_PASSED",
];

export const HUMAN_STATUS = ["NOT_REVIEWED", "ADVOCATE_REVIEW", "APPROVED"];

/**
 * SPECIFICITY IS TRACKED BESIDE THE GENERATION LADDER, NOT INSIDE IT.
 *
 * The obvious placement is a rung between coverage and falsification. It is
 * wrong, and D4.2 is the proof: requirement outcomes moved ZERO between opposite
 * worlds for NDA and Distribution, so those families pass falsification and fail
 * specificity. Ordering one beneath the other asserts a prerequisite that does
 * not exist, and would demote the ten families this split was created to
 * protect.
 *
 * Independent evidence gets an independent axis. APPROVED requires it; the
 * ladder does not order it.
 */

export const RUNG = [
  "NOT_ASSESSED",
  "IDENTITY_AUTHORED",
  "REQUIREMENTS_ADMITTED",
  "GENERATION_COVERAGE_TESTED",
  "FALSIFICATION_PASSED",
  "ADVOCATE_REVIEW",
  "APPROVED",
];

/**
 * Five kinds of review evidence, and they are NOT interchangeable.
 *
 *   requirement review  an advocate read what the document must accomplish
 *   clause review       an advocate read the words that would be emitted
 *   family review       an advocate examined this family as a whole
 *   artifact review     an advocate read an actual generated document
 *   approval            an advocate signed the family off
 *
 * An earlier version derived the top two rungs from requirement-level
 * `review_status` alone. That is too permissive: enough lower-level flags would
 * eventually accumulate into APPROVED without anyone ever having approved
 * anything. The four statements below are all different, and none implies the
 * next:
 *
 *     all requirements reviewed
 *         != all emitted clauses reviewed
 *         != the family reviewed
 *         != a generated artifact reviewed
 *         != the family approved
 *
 * So each rung above FALSIFICATION_PASSED needs evidence of its own kind, from
 * a source that cannot be manufactured by adding fields to the layer below.
 */
export const REVIEW_EVIDENCE = [
  "requirement_review", "clause_review", "family_review", "artifact_review", "approval",
];

/**
 * @param {object} evidence
 * @param {Set<string>} evidence.generates        types with a recorded generation baseline
 * @param {Map<string,string[]>} evidence.emits   type -> clause ids it emits
 * @param {Set<string>} evidence.reviewedClauses  clause ids carrying advocate sign-off
 * @param {Map<string,object>} evidence.signOff   type -> { family_review, artifact_review, approval }
 * @param {Map<string,string[]>} evidence.defects type -> coherence relationships its own
 *        generated document breaks. NOT a rung input: see the approval bar below.
 */
/**
 * Project the evidence onto the three axes.
 *
 * The generation axis is the existing ladder, truncated at FALSIFICATION_PASSED
 * so that the review rungs no longer live on it. Nothing about how a family
 * earned its generation status changes here — that is the point of the split.
 */
function dimensions(documentType, rung, evidence, broken, legalKnowledge, specificity) {
  const generation = GENERATION_STATUS.includes(rung)
    ? rung
    : "FALSIFICATION_PASSED"; // ADVOCATE_REVIEW / APPROVED imply it was reached

  const human = evidence.approval && !broken.length ? "APPROVED"
    : (evidence.family_review || evidence.artifact_review) ? "ADVOCATE_REVIEW"
      : "NOT_REVIEWED";

  const legal = legalKnowledge.get(documentType) || "NOT_ASSESSED";

  /*
   * APPROVED on the combined reading needs all three axes at their top AND the
   * specificity evidence, because none of the three implies it: a family can be
   * legally validated, adversarially attacked and advocate-signed while still
   * emitting the same clause set for two unlike transactions.
   *
   * Every family fails this today. That is the correct reading of the trace and
   * is reported, not smoothed.
   */
  const fully = legal === "CONSEQUENCE_VALIDATED"
    && generation === "FALSIFICATION_PASSED"
    && human === "APPROVED"
    && specificity.has(documentType);

  return {
    legal_knowledge_status: legal,
    generation_status: generation,
    human_status: human,
    specificity_tested: specificity.has(documentType),
    fully_certified: fully,
  };
}

export function certify({
  generates = new Set(),
  emits = new Map(),
  reviewedClauses = new Set(),
  signOff = new Map(),
  defects = new Map(),
  /**
   * type -> LEGAL_KNOWLEDGE_STATUS. Supplied by the caller from concept-layer
   * evidence rather than computed here, because this module must not become the
   * place where a family is promoted by adding a field to it. Absent means
   * NOT_ASSESSED, which is the honest default while the concept resolver reaches
   * one concept.
   */
  legalKnowledge = new Map(),
  /** Types with a recorded differential-specificity result. */
  specificity = new Set(),
  // The families to assess. Defaults to every registered type, which is what
  // the product asks for. A caller may name a subset — a probe testing what the
  // ladder does with a particular shape of evidence needs to name the type it
  // authored, and the requirements loader now refuses a probe fixture that
  // borrows a real family's name to get itself iterated.
  families: only = null,
} = {}) {
  const requirements = loadDocumentRequirements();
  const families = {};

  for (const documentType of (only || Object.keys(DOCUMENT_TYPE_REGISTRY)).slice().sort()) {
    const list = requirements.get(documentType);
    const reasons = [];
    const evidence = Object.fromEntries(REVIEW_EVIDENCE.map((kind) => [kind, false]));
    let rung = "NOT_ASSESSED";

    if (!list || !list.length) {
      reasons.push("no identity requirements authored");
      families[documentType] = { status: rung, reasons, evidence, requirements: 0,
        ...dimensions(documentType, rung, evidence, [], legalKnowledge, specificity) };
      continue;
    }
    // Reaching here means the admission gate passed: loadDocumentRequirements
    // throws on an inadmissible source, so an unadmitted family cannot be listed.
    rung = "REQUIREMENTS_ADMITTED";
    reasons.push(`${list.length} requirements authored and admitted`);

    if (!generates.has(documentType)) {
      reasons.push("no recorded generation baseline, so coverage has never been measured");
      families[documentType] = { status: rung, reasons, evidence, requirements: list.length,
        ...dimensions(documentType, rung, evidence, [], legalKnowledge, specificity) };
      continue;
    }
    rung = "GENERATION_COVERAGE_TESTED";
    reasons.push("generates, and the assessment runs against the emitted clause set");

    // Falsification: a NAMED attack and the false green it found. A family that
    // says only "tested" stays where it is.
    const attacked = list.find((r) => r.falsification?.attack && r.falsification?.false_green);
    if (!attacked) {
      reasons.push(
        "no named falsification — nobody has recorded an attempt to make this family report " +
        "green while legally unfinished"
      );
      families[documentType] = { status: rung, reasons, evidence, requirements: list.length,
        ...dimensions(documentType, rung, evidence, [], legalKnowledge, specificity) };
      continue;
    }
    rung = "FALSIFICATION_PASSED";
    reasons.push(`adversarially attacked: ${attacked.falsification.false_green}`);

    // ── Review evidence, gathered independently ──────────────────────────────
    const reviewedRequirements = list.filter(
      (r) => r.review_status && !/draft|needs/i.test(r.review_status)
    ).length;
    evidence.requirement_review = reviewedRequirements === list.length;
    reasons.push(`${reviewedRequirements} of ${list.length} requirements reviewed`);

    const emitted = emits.get(documentType) || [];
    const reviewedEmitted = emitted.filter((id) => reviewedClauses.has(id)).length;
    evidence.clause_review = emitted.length > 0 && reviewedEmitted === emitted.length;
    reasons.push(`${reviewedEmitted} of ${emitted.length} emitted clauses carry advocate sign-off`);

    const record = signOff.get(documentType) || {};
    evidence.family_review = Boolean(record.family_review);
    evidence.artifact_review = Boolean(record.artifact_review);
    evidence.approval = Boolean(record.approval);

    // ADVOCATE_REVIEW means an advocate is looking at the FAMILY, not that
    // enough fields elsewhere have been ticked.
    if (evidence.family_review || evidence.artifact_review) {
      rung = "ADVOCATE_REVIEW";
      reasons.push("an advocate has examined this family");
    } else {
      reasons.push("no family-level advocate review on record");
    }

    // A family whose own generated document contradicts itself cannot be
    // APPROVED, however complete the review evidence is.
    //
    // Everything above this point measures what the family has been PUT THROUGH.
    // This measures what it SHIPS, and the two must not be allowed to merge: a
    // family can be under advocate review WITH a live defect -- that is exactly
    // what an advocate should be looking at -- but it cannot come out the other
    // side approved while the defect stands. Without this bar, the five review
    // flags could all be ticked on the NDA that tells its reader confidentiality
    // runs for five years in one clause and three in the next, and the ladder
    // would say APPROVED.
    //
    // The only exit is that the relationship holds. There is deliberately no
    // waiver: a mechanism for an advocate to accept a contradiction would be the
    // shortest route back to fixing the report instead of the document, and
    // nothing has yet demonstrated the need for one.
    const broken = defects.get(documentType) || [];
    // APPROVED needs all five, from four independent sources. No amount of
    // requirement-level metadata reaches it on its own.
    const missing = REVIEW_EVIDENCE.filter((kind) => !evidence[kind]);
    if (broken.length) {
      reasons.push(
        `approval barred: the document this family generates breaks ${broken.length} coherence ` +
        `relationship${broken.length === 1 ? "" : "s"} (${broken.join(", ")})`
      );
    } else if (!missing.length) {
      rung = "APPROVED";
      reasons.push("requirements, clauses, family and artifact all reviewed, and signed off");
    } else if (rung === "ADVOCATE_REVIEW") {
      reasons.push(`approval withheld, missing: ${missing.join(", ")}`);
    }

    families[documentType] = {
      status: rung, reasons, evidence, requirements: list.length,
      // Reported beside the rung, never inside it.
      ships_defects: broken,
      ...dimensions(documentType, rung, evidence, broken, legalKnowledge, specificity),
    };
  }

  const counts = {};
  for (const rung of RUNG) counts[rung] = 0;
  for (const family of Object.values(families)) counts[family.status] += 1;

  const byDimension = {
    legal_knowledge: Object.fromEntries(LEGAL_KNOWLEDGE_STATUS.map((k) => [k, 0])),
    generation: Object.fromEntries(GENERATION_STATUS.map((k) => [k, 0])),
    human: Object.fromEntries(HUMAN_STATUS.map((k) => [k, 0])),
  };
  for (const f of Object.values(families)) {
    byDimension.legal_knowledge[f.legal_knowledge_status] += 1;
    byDimension.generation[f.generation_status] += 1;
    byDimension.human[f.human_status] += 1;
  }

  return {
    families,
    counts,
    byDimension,
    fully_certified: Object.values(families).filter((f) => f.fully_certified).length,
    // The only number that should ever be put in front of a user as "supported".
    approved: counts.APPROVED,
    total: Object.keys(families).length,
  };
}
