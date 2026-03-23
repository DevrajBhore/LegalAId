/**
 * domainInference.js (statutes layer)
 *
 * Now powered by domainRegistry — every registered document type
 * returns its exact domain list. Unknown types fall back to heuristics.
 */

import { getDocumentTypeInfo } from "../indian-rule-engine/domainRegistry.js";

export function inferDomainRequirements(documentType = "", draft = null) {

  // Primary: use registry lookup
  const typeInfo = getDocumentTypeInfo(documentType);
  if (!typeInfo._isUnknown) {
    // Always include ARBITRATION if doc mentions it
    const domains = new Set(typeInfo.domains);
    const draftText = draft?.clauses?.map(c => c.text || "").join(" ").toLowerCase() || "";
    if (draftText.includes("arbitration")) domains.add("ARBITRATION");
    if (draftText.includes("personal data") || draftText.includes("data protection")) domains.add("DATA");
    return [...domains].map(d => d.toUpperCase());
  }

  // Fallback heuristics for completely unknown types
  const domains = new Set(["COMMERCIAL"]);
  const type = documentType.toUpperCase();
  const draftText = draft?.clauses?.map(c => c.text || "").join(" ").toLowerCase() || "";

  if (type.includes("EMPLOY") || draftText.includes("employee") || draftText.includes("salary")) domains.add("LABOUR");
  if (type.includes("LEASE") || type.includes("RENT") || type.includes("PROPERTY") || draftText.includes("premises")) domains.add("PROPERTY");
  if (type.includes("LOAN") || type.includes("FINANCE") || draftText.includes("repayment")) domains.add("FINANCE");
  if (draftText.includes("arbitration")) domains.add("ARBITRATION");
  if (type.includes("IP") || type.includes("COPYRIGHT") || type.includes("PATENT")) domains.add("IP");
  if (type.includes("COMPANY") || type.includes("SHAREHOLDER") || type.includes("PARTNER")) domains.add("CORPORATE");
  if (draftText.includes("personal data") || type.includes("PRIVACY")) domains.add("DATA");

  return [...domains];
}
