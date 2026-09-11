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
 * @param {object} evidence
 * @param {Set<string>} evidence.generates  types with a recorded clause baseline
 */
export function certify({ generates = new Set() } = {}) {
  const requirements = loadDocumentRequirements();
  const families = {};

  for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY).sort()) {
    const list = requirements.get(documentType);
    const reasons = [];
    let rung = "NOT_ASSESSED";

    if (!list || !list.length) {
      reasons.push("no identity requirements authored");
      families[documentType] = { status: rung, reasons, requirements: 0 };
      continue;
    }
    // Reaching here means the admission gate already passed: loadDocumentRequirements
    // throws on an inadmissible source, so an unadmitted family cannot be listed.
    rung = "REQUIREMENTS_ADMITTED";
    reasons.push(`${list.length} requirements authored and admitted`);

    if (generates.has(documentType)) {
      rung = "GENERATION_COVERAGE_TESTED";
      reasons.push("generates, and the assessment runs against the emitted clause set");
    } else {
      reasons.push("no recorded generation baseline, so coverage has never been measured");
      families[documentType] = { status: rung, reasons, requirements: list.length };
      continue;
    }

    // Falsification: a NAMED attack and the false green it found. A family that
    // says only "tested" stays where it is.
    const attacked = list.find((r) => r.falsification?.attack && r.falsification?.false_green);
    if (attacked) {
      rung = "FALSIFICATION_PASSED";
      reasons.push(`adversarially attacked: ${attacked.falsification.false_green}`);
    } else {
      reasons.push(
        "no named falsification — nobody has recorded an attempt to make this family report " +
        "green while legally unfinished"
      );
    }

    const reviewed = list.filter((r) => r.review_status && !/draft|needs/i.test(r.review_status));
    if (reviewed.length === list.length) {
      rung = "APPROVED";
      reasons.push("every requirement carries advocate sign-off");
    } else if (reviewed.length) {
      rung = "ADVOCATE_REVIEW";
      reasons.push(`${reviewed.length} of ${list.length} requirements reviewed`);
    } else {
      reasons.push("zero advocate sign-off");
    }

    families[documentType] = { status: rung, reasons, requirements: list.length };
  }

  const counts = {};
  for (const rung of RUNG) counts[rung] = 0;
  for (const family of Object.values(families)) counts[family.status] += 1;

  return {
    families,
    counts,
    // The only number that should ever be put in front of a user as "supported".
    approved: counts.APPROVED,
    total: Object.keys(families).length,
  };
}
