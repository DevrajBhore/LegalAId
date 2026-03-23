import { detectSignals } from "./signalDetector.js";
import { detectProtections } from "./protectionDetector.js";
import { injectProtection } from "./injector.js";
import { sortClausesByOrder } from "../config/clauseOrder.js";

// Doc types that always need commercial protections regardless of signal detection
const BILATERAL_COMMERCIAL_DOCS = new Set([
  "NDA",
  "SERVICE_AGREEMENT",
  "CONSULTANCY_AGREEMENT",
  "SUPPLY_AGREEMENT",
  "DISTRIBUTION_AGREEMENT",
  "SALES_OF_GOODS_AGREEMENT",
  "INDEPENDENT_CONTRACTOR_AGREEMENT",
  "EMPLOYMENT_CONTRACT",
  "COMMERCIAL_LEASE_AGREEMENT",
  "LEAVE_AND_LICENSE_AGREEMENT",
  "SHAREHOLDERS_AGREEMENT",
  "JOINT_VENTURE_AGREEMENT",
  "PARTNERSHIP_DEED",
  "LOAN_AGREEMENT",
  "GUARANTEE_AGREEMENT",
  "SOFTWARE_DEVELOPMENT_AGREEMENT",
]);

export function enhanceCommercially(draft) {
  const docType = (draft.document_type || "").toUpperCase();
  const text = draft.clauses.map((c) => c.text || "").join(" ");
  const signals = detectSignals(text);
  const protects = detectProtections(text);

  const isBilateral = BILATERAL_COMMERCIAL_DOCS.has(docType);

  // Inject liability cap for all bilateral commercial docs (not just payment-bearing)
  if (isBilateral && !protects.hasLiabilityCap) {
    draft = injectProtection(draft, "LIABILITY_CAP");
  }

  // Inject indemnity for all bilateral commercial docs
  if (isBilateral && !protects.hasIndemnity) {
    draft = injectProtection(draft, "INDEMNITY");
  }

  // Inject force majeure for all bilateral commercial docs
  if (isBilateral && !protects.hasForceMajeure) {
    draft = injectProtection(draft, "FORCE_MAJEURE");
  }

  draft.clauses = sortClausesByOrder(draft.clauses);
  return draft;
}
