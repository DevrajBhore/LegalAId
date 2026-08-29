/**
 * documentShape.js
 *
 * Not every legal document is an agreement, and the checks that are right for an
 * agreement are wrong for the others. A privacy policy has no counterparty. A
 * legal notice has a sender and an addressee, not two parties, and no governing
 * law clause because it is not a bargain. An affidavit is sworn by one person.
 *
 * Before this file existed, each validator carried its own set of exceptions and
 * they drifted apart: the execution validator exempted policies from four checks
 * but a fifth still fired, and adding a new instrument meant finding every set.
 * One classification, imported everywhere, so a new document type is exempted
 * from the right checks once.
 */

export const DOCUMENT_SHAPES = {
  // Two or more parties, a bargain, recitals, an operative part and a
  // testimonium. Everything not listed below.
  AGREEMENT: "AGREEMENT",
  // Promulgated by one organisation for the world to read.
  POLICY: "POLICY",
  // Sent by one person to another, demanding something by a date.
  NOTICE: "NOTICE",
  // Sworn or unilaterally executed: one signature, nobody opposite.
  SWORN: "SWORN",
};

/**
 * Why each shape needs its own questions.
 *
 * POLICY: promulgated by one organisation, not agreed between parties. Asking it
 * to identify "contracting parties" is not a check it can pass. For a long time
 * the PoSH policy passed the party regex only by accident, through a commercial
 * dispute-resolution clause that a dependency had pulled in and that had no
 * business being in a statutory policy. Removing that clause exposed the real
 * defect in the check. What a policy must instead say is whose it is.
 *
 * NOTICE: has a sender and an addressee rather than two parties; carries no
 * governing-law clause, because it is not a bargain whose construction could be
 * governed by anything; and carries no dispute-resolution clause, because it IS
 * the opening move in a dispute. What it must have instead is a deadline and a
 * stated consequence - under the Negotiable Instruments Act, a demand notice
 * that omits the fifteen-day period destroys the complaint that would follow it.
 *
 * SWORN: one person swears or binds; nobody signs opposite. What it must have
 * instead is a named deponent, obligor or executant, and - for an affidavit -
 * the verification that Order XIX and Order VI Rule 15 of the Civil Procedure
 * Code require.
 */
const BY_TYPE = {
  PRIVACY_POLICY: DOCUMENT_SHAPES.POLICY,
  TERMS_OF_SERVICE: DOCUMENT_SHAPES.POLICY,
  POSH_POLICY: DOCUMENT_SHAPES.POLICY,
  REFUND_AND_CANCELLATION_POLICY: DOCUMENT_SHAPES.POLICY,
  SHIPPING_AND_DELIVERY_POLICY: DOCUMENT_SHAPES.POLICY,

  LEGAL_NOTICE: DOCUMENT_SHAPES.NOTICE,
  CHEQUE_BOUNCE_NOTICE: DOCUMENT_SHAPES.NOTICE,
  REPLY_TO_LEGAL_NOTICE: DOCUMENT_SHAPES.NOTICE,
  ARBITRATION_NOTICE: DOCUMENT_SHAPES.NOTICE,

  AFFIDAVIT: DOCUMENT_SHAPES.SWORN,
  INDEMNITY_BOND: DOCUMENT_SHAPES.SWORN,
  POWER_OF_ATTORNEY: DOCUMENT_SHAPES.SWORN,
};

// A reply answers a demand and makes none of its own, so the deadline and
// consequence a demand notice must carry are not required of it.
const RESPONSIVE = new Set(["REPLY_TO_LEGAL_NOTICE"]);

export function documentShape(documentType) {
  return BY_TYPE[String(documentType || "").toUpperCase()] || DOCUMENT_SHAPES.AGREEMENT;
}

export function isAgreement(documentType) {
  return documentShape(documentType) === DOCUMENT_SHAPES.AGREEMENT;
}

export function isPolicy(documentType) {
  return documentShape(documentType) === DOCUMENT_SHAPES.POLICY;
}

export function isNotice(documentType) {
  return documentShape(documentType) === DOCUMENT_SHAPES.NOTICE;
}

export function isSworn(documentType) {
  return documentShape(documentType) === DOCUMENT_SHAPES.SWORN;
}

/** A notice that demands something, as against one that answers a demand. */
export function isDemandNotice(documentType) {
  return isNotice(documentType) && !RESPONSIVE.has(String(documentType || "").toUpperCase());
}

/**
 * The five checks that only make sense for a bargain between parties: a
 * governing-law clause, a dispute-resolution clause, a termination notice
 * period, consideration, and two identified contracting parties.
 */
export function expectsAgreementBoilerplate(documentType) {
  return isAgreement(documentType);
}
