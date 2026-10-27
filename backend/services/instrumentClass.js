/**
 * instrumentClass.js — D4.48
 *
 * The engine half of knowledge-base/metadata/instrument_classes.json: what kind
 * of instrument a document type is, and what that permits it to contain.
 *
 * Every layer that used to assume a bilateral contract asks this module instead:
 *   - doctrineInjector.js       whether the Indian Contract Act warranty applies;
 *   - documentHardening.js      which general provisions are a baseline for it,
 *                               and how its opening names it;
 *   - instrumentKnowledge.js    the noun it uses for itself ("this Policy");
 *   - documentService.js        the last stage on every generation path removes
 *                               any clause the class forbids, whichever stage
 *                               added it (blueprint, baseline, dependency,
 *                               commercial protection), and records why;
 *   - validationService.js      reports a forbidden clause in a saved draft.
 *
 * A document type with no entry is treated as an AGREEMENT, which is exactly what
 * the engine did before this module existed.
 */
import fs from "fs";
import { getCanonicalDocumentType } from "../../shared/documentRegistry.js";

const FILE = new URL("../../knowledge-base/metadata/instrument_classes.json", import.meta.url);
const MODEL = JSON.parse(fs.readFileSync(FILE, "utf8"));

export const INSTRUMENT_CLASSES = Object.freeze(Object.keys(MODEL.classes));
export const DEFAULT_INSTRUMENT_CLASS = "AGREEMENT";

// The alias table has mixed-case keys ("PrivacyPolicy", "TOS"), and a saved draft
// or an API caller may send "privacy_policy". getCanonicalDocumentType returns
// its input when no alias matches, so that result is upper-cased and looked up
// again; documentShape.js upper-cases the same way, and the two must agree.
function canonical(documentType) {
  const type = String(documentType || "").trim();
  if (!type) return "";
  const aliased = String(getCanonicalDocumentType(type) || type).toUpperCase();
  return String(getCanonicalDocumentType(aliased) || aliased).toUpperCase();
}

export function getInstrumentClassName(documentType) {
  return MODEL.document_types[canonical(documentType)]?.class || DEFAULT_INSTRUMENT_CLASS;
}

export function getInstrumentClass(documentType) {
  const name = getInstrumentClassName(documentType);
  return { name, ...MODEL.classes[name] };
}

/** { noun, opening } the type uses for itself, or null to keep "Agreement". */
export function getInstrumentSelfName(documentType) {
  const own = MODEL.document_types[canonical(documentType)]?.self_name;
  return own && typeof own === "object" && own.noun ? own : null;
}

export function contractDoctrineApplies(documentType) {
  return getInstrumentClass(documentType).contract_doctrine !== false;
}

export function instrumentLayout(documentType) {
  return getInstrumentClass(documentType).layout || "clauses";
}

/**
 * Why the class forbids this clause, or null if it may carry it. A class that is
 * not enforced in this phase forbids nothing.
 */
export function forbiddenByInstrumentClass(documentType, clauseOrId) {
  const id = String(typeof clauseOrId === "string" ? clauseOrId : clauseOrId?.clause_id || "");
  if (!id) return null;
  const cls = getInstrumentClass(documentType);
  if (!cls.enforced) return null;
  // A type may be classified but held out of enforcement for this phase.
  if (MODEL.document_types[canonical(documentType)]?.enforced === false) return null;
  const rule = cls.clause_rule || {};
  if ((rule.allow_ids || []).includes(id)) return null;
  if ((rule.forbid_ids || []).includes(id)) {
    return `${cls.label} does not carry ${id}`;
  }
  const prefix = (rule.forbid_prefixes || []).find((p) => id.startsWith(p));
  if (prefix) {
    return `${cls.label} carries none of the general clauses of an agreement (${prefix}*)`;
  }
  return null;
}

/**
 * Remove every clause the class forbids, and record what was removed and why on
 * draft.metadata.instrument_class. Idempotent. Never removes anything from a
 * type whose class allows everything, so an agreement is returned unchanged.
 */
export function enforceInstrumentClass(draft, documentType = draft?.document_type) {
  if (!draft || !Array.isArray(draft.clauses)) return draft;
  const cls = getInstrumentClass(documentType);
  const removed = [];
  const clauses = draft.clauses.filter((clause) => {
    const reason = forbiddenByInstrumentClass(documentType, clause);
    if (reason) removed.push({ clause_id: clause.clause_id, reason });
    return !reason;
  });
  const prior = draft.metadata?.instrument_class?.excluded || [];
  const excluded = [...prior, ...removed.filter((r) => !prior.some((p) => p.clause_id === r.clause_id))];
  return {
    ...draft,
    clauses: removed.length ? clauses : draft.clauses,
    metadata: {
      ...(draft.metadata || {}),
      instrument_class: { name: cls.name, version: MODEL.version, excluded },
    },
  };
}

/** Clauses in a draft that its class forbids (for validation of saved drafts). */
export function instrumentClassViolations(draft, documentType = draft?.document_type) {
  return (draft?.clauses || [])
    .map((clause) => ({ clause_id: clause.clause_id, reason: forbiddenByInstrumentClass(documentType, clause) }))
    .filter((v) => v.reason);
}

const CONTRACT_WARRANTY = /lawful under Section 23 of the Indian Contract Act/;

/**
 * Validation layer. The engine removes forbidden clauses itself, so a draft it
 * produced is clean by construction; this fires on a draft saved before D4.48,
 * and on edits. It asks for legal review and never blocks: a check that blocked
 * here would refuse the download of every Privacy Policy saved before today,
 * which is the defect D4.47 fixed (export refused on findings the user could not
 * see or act on).
 */
export function verifyInstrumentClass(draft, documentType = draft?.document_type) {
  const cls = getInstrumentClass(documentType);
  const issues = instrumentClassViolations(draft, documentType).map((v) => {
    const clause = (draft.clauses || []).find((c) => c.clause_id === v.clause_id) || {};
    return {
      rule_id: "INSTRUMENT_CLASS_MISMATCH",
      severity: "HIGH",
      release_outcome: "REQUIRES_LEGAL_REVIEW",
      manual_review_required: true,
      layer: "instrument_class",
      offending_clause_id: v.clause_id,
      message: `${clause.title || v.clause_id} is a provision of an agreement, and this document is a ${cls.label.toLowerCase()}: ${v.reason}.`,
      suggestion: "Regenerate the document, or have a lawyer confirm the provision is intended here.",
    };
  });
  if (!contractDoctrineApplies(documentType)) {
    const carrier = (draft?.clauses || []).find((c) => CONTRACT_WARRANTY.test(String(c.text || "")));
    if (carrier) {
      issues.push({
        rule_id: "INSTRUMENT_CLASS_CONTRACT_WARRANTY",
        severity: "HIGH",
        release_outcome: "REQUIRES_LEGAL_REVIEW",
        manual_review_required: true,
        layer: "instrument_class",
        offending_clause_id: carrier.clause_id,
        message: `${carrier.title || carrier.clause_id} contains a warranty by "the Parties" about lawful consideration under the Indian Contract Act, 1872, and this document is a ${cls.label.toLowerCase()}, not a contract between parties.`,
        suggestion: "Regenerate the document, or remove the warranty.",
      });
    }
  }
  return issues;
}

export function instrumentClassModel() {
  return MODEL;
}
