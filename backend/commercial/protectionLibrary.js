// backend/commercial/protectionLibrary.js
//
// This file used to BUILD clauses. It no longer does.
//
// It held six clause definitions with AUTO-* ids, injected after hardening had
// run, and three of them reached shipped documents across seven document types.
// Nothing about them was governed: no review_status an advocate could sign, no
// structured legal_basis, no invalid_if, absent from getAllClauses() and so from
// the library counts and the unreviewed-clause ceiling, and unreachable by a
// knowledge-defined document family.
//
// A clause that can reach a signed document must come from the governed library.
// What survives here is the MAPPING from a protection the commercial engine asks
// for to the clause that provides it -- which is routing, not legal knowledge.
export const PROTECTION_CLAUSE_IDS = {
  LIABILITY_CAP: "CORE_LIABILITY_LIMIT_FALLBACK_001",
  INDEMNITY: "CORE_INDEMNITY_FULL_001",
  FORCE_MAJEURE: "CORE_FORCE_MAJEURE_FALLBACK_001",
  IP_OWNERSHIP: "CORE_IP_OWNERSHIP_FALLBACK_001",
  LATE_PAYMENT_INTEREST: "CORE_LATE_PAYMENT_INTEREST_001",
  TERMINATION_NOTICE: "CORE_TERMINATION_NOTICE_001",
};

// Retained so existing callers and the hardening tables that still name the old
// ids keep working while they are migrated. Nothing reads these to build a
// clause any more.
export const LEGACY_AUTO_IDS = {
  LIABILITY_CAP: "AUTO-LIAB-001",
  INDEMNITY: "AUTO-INDEM-001",
  FORCE_MAJEURE: "AUTO-FM-001",
  IP_OWNERSHIP: "AUTO-IP-001",
  LATE_PAYMENT_INTEREST: "AUTO-LPI-001",
  TERMINATION_NOTICE: "AUTO-TN-001",
};
