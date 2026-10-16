/**
 * requirementRelease.js — D4.46
 *
 * The document-requirement model, made to decide release. Before D4.46 it ran
 * only in the response builder: 34 requirements declared BLOCK and none could
 * block, an MOU whose own model said CONTRADICTED shipped as "Automated checks
 * passed", and an NDA stating 24 months and three years beside each other was
 * certified with a score of 100.
 *
 * This module adds no evaluator. It calls assessRequirements, the one that
 * already exists, and maps each outcome to exactly one of five states and the
 * release effect of that state:
 *
 *   VIOLATED                   applicable and not met, or contradicted.
 *                              Blocks only where the requirement is an audited
 *                              hard constraint (ACTIVE_BLOCK in
 *                              governance/block-requirements-audit.json);
 *                              otherwise Requires legal review.
 *   EVIDENCE_MISSING           applicable, but what would show it met is absent
 *                              or unclear: Requires information (evidence not
 *                              supplied or out of date) or Requires legal review
 *                              (evidence present but ambiguous or conflicting).
 *   APPLICABILITY_UNRESOLVED   nobody established whether it applies: Requires
 *                              information. Never treated as met or as not
 *                              applicable.
 *   NOT_APPLICABLE             recorded with the condition that was not met.
 *   SATISFIED                  recorded with the clauses that satisfy it.
 *
 * A relationship between clauses (two clauses answering one question) that is
 * CONTRADICTED blocks: the document states two different answers to a material
 * term, which is a determined defect of the text, not a legal judgment. One that
 * could not be read is Requires legal review.
 */
import fs from "fs";
import { assessRequirements, loadDocumentRequirements } from "./documentRequirements.js";
import { resolveCanonicalFacts } from "./canonicalFacts.js";

export const RELEASE = Object.freeze({
  BLOCKED: "BLOCKED",
  REQUIRES_INFORMATION: "REQUIRES_INFORMATION",
  REQUIRES_LEGAL_REVIEW: "REQUIRES_LEGAL_REVIEW",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  AUTOMATED_CHECKS_PASSED: "AUTOMATED_CHECKS_PASSED",
});

export const RELEASE_LABEL = Object.freeze({
  BLOCKED: "Blocked",
  REQUIRES_INFORMATION: "Requires information",
  REQUIRES_LEGAL_REVIEW: "Requires legal review",
  REVIEW_REQUIRED: "Review Required",
  AUTOMATED_CHECKS_PASSED: "Automated checks passed",
});

export const REQUIREMENT_STATE = Object.freeze({
  VIOLATED: "VIOLATED",
  EVIDENCE_MISSING: "EVIDENCE_MISSING",
  APPLICABILITY_UNRESOLVED: "APPLICABILITY_UNRESOLVED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
  SATISFIED: "SATISFIED",
});

const AUDIT_FILE = new URL("../../knowledge-base/governance/block-requirements-audit.json", import.meta.url);
let auditCache = null;
export function enforcementOf(documentType, id) {
  if (auditCache === null) {
    try {
      const record = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf8"));
      auditCache = new Map(record.requirements.map((r) => [`${r.document_type}:${r.id}`, r.enforcement]));
    } catch {
      auditCache = new Map();
    }
  }
  // A BLOCK requirement absent from the audit has not been audited, and is held.
  return auditCache.get(`${documentType}:${id}`) || "HELD_FOR_LEGAL_REVIEW";
}

const SATISFIED = new Set(["RESOLVED", "DEFAULTED", "PROVIDED_FOR"]);
const VIOLATED = new Set(["ESCALATED", "UNRESOLVED", "CONTRADICTED", "OUT_OF_TIME"]);
const EVIDENCE_FOR_INFORMATION = new Set(["UNVERIFIABLE", "STALE_EVIDENCE"]);
const EVIDENCE_FOR_REVIEW = new Set(["AMBIGUOUS_EVIDENCE", "EVIDENCE_MISMATCHED", "CONFLICTING_EVIDENCE"]);

/** The assessment, from the draft as rendered and the answers it was drafted from. */
export function assessDraftRequirements(draft, { documentType, variables = {} } = {}) {
  const type = documentType || draft?.document_type;
  const clauses = draft?.clauses || [];
  const facts = resolveCanonicalFacts(type, variables, variables.__resolved_positions || {}).facts;
  return assessRequirements(
    type,
    clauses.map((c) => c.clause_id),
    facts,
    variables,
    [],
    Object.fromEntries(clauses.map((c) => [c.clause_id, c.text || ""]))
  );
}

function stateOf(coverage) {
  if (SATISFIED.has(coverage)) return REQUIREMENT_STATE.SATISFIED;
  if (coverage === "NOT_APPLICABLE") return REQUIREMENT_STATE.NOT_APPLICABLE;
  if (coverage === "APPLICABILITY_UNKNOWN") return REQUIREMENT_STATE.APPLICABILITY_UNRESOLVED;
  if (VIOLATED.has(coverage)) return REQUIREMENT_STATE.VIOLATED;
  return REQUIREMENT_STATE.EVIDENCE_MISSING;
}

function issue({ ruleId, release, severity, requirement, message, suggestion, evidence, clauseId }) {
  return {
    rule_id: ruleId,
    severity,
    blocks_generation: release === RELEASE.BLOCKED,
    manual_review_required: true,
    release_outcome: release,
    layer: "requirements",
    requirement_id: requirement,
    offending_clause_id: clauseId || null,
    message,
    suggestion,
    evidence,
  };
}

/**
 * The five-state ledger and the findings it produces. `issues` go into the
 * validation result like any other layer's; `ledger` is reported beside them so
 * that NOT_APPLICABLE and SATISFIED keep their reason and evidence.
 */
export function requirementFindings(assessment, documentType) {
  if (!assessment?.assessed) return { issues: [], ledger: null };
  const declared = new Map((loadDocumentRequirements().get(documentType) || []).map((r) => [r.id, r]));
  const issues = [];
  const entries = [];

  for (const result of assessment.results) {
    const requirement = declared.get(result.id) || {};
    const state = stateOf(result.coverage);
    const entry = { id: result.id, kind: result.kind, coverage: result.coverage, state, statement: result.statement };
    if (state === REQUIREMENT_STATE.SATISFIED) {
      entry.evidence = { satisfied_by: result.satisfied_by || [] };
      if (result.coverage === "DEFAULTED") entry.evidence.note = "satisfied by a clause included under a documented drafting default";
      if (result.coverage === "PROVIDED_FOR") entry.evidence.note = "the document provides for the act; whether it was done is outside the document";
    } else if (state === REQUIREMENT_STATE.NOT_APPLICABLE) {
      entry.reason = { applicability: requirement.applicability || null, detail: "its applicability condition is not met on the facts as resolved" };
    } else if (state === REQUIREMENT_STATE.APPLICABILITY_UNRESOLVED) {
      entry.release = RELEASE.REQUIRES_INFORMATION;
      issues.push(issue({
        ruleId: "REQUIREMENT_APPLICABILITY_UNRESOLVED", release: entry.release, severity: "MEDIUM", requirement: result.id,
        message: `Whether this document must provide that "${result.statement}" depends on ${result.undetermined_by || "a fact"}, which was not established. It has been neither treated as met nor as not applicable.`,
        suggestion: `Answer the question about ${result.undetermined_by || "this fact"} so the requirement can be decided.`,
        evidence: { undetermined_by: result.undetermined_by, source: result.undetermined_source },
      }));
    } else if (state === REQUIREMENT_STATE.EVIDENCE_MISSING) {
      entry.release = EVIDENCE_FOR_INFORMATION.has(result.coverage) ? RELEASE.REQUIRES_INFORMATION : RELEASE.REQUIRES_LEGAL_REVIEW;
      issues.push(issue({
        ruleId: "REQUIREMENT_EVIDENCE_INCOMPLETE", release: entry.release, severity: "MEDIUM", requirement: result.id,
        message: `"${result.statement}" could not be established: ${result.detail || result.coverage}.`,
        suggestion: entry.release === RELEASE.REQUIRES_INFORMATION
          ? `Supply ${result.external_instrument ? `the ${result.external_instrument}` : "the missing evidence"} so this can be checked.`
          : "Have a lawyer review the evidence against this requirement.",
        evidence: { coverage: result.coverage, external_instrument: result.external_instrument },
      }));
    } else {
      // VIOLATED
      const hard = requirement.when_unsatisfied === "BLOCK" && enforcementOf(documentType, result.id) === "ACTIVE_BLOCK";
      entry.release = hard ? RELEASE.BLOCKED : RELEASE.REQUIRES_LEGAL_REVIEW;
      entry.enforcement = requirement.when_unsatisfied === "BLOCK" ? enforcementOf(documentType, result.id) : requirement.when_unsatisfied;
      const contradicted = result.coverage === "CONTRADICTED";
      issues.push(issue({
        ruleId: contradicted ? "REQUIREMENT_CONTRADICTED" : hard ? "REQUIREMENT_NOT_MET" : "REQUIREMENT_UNMET_NEEDS_REVIEW",
        release: entry.release,
        severity: hard ? "CRITICAL" : requirement.when_unsatisfied === "DISCLOSE" ? "MEDIUM" : "HIGH",
        requirement: result.id,
        clauseId: contradicted ? result.contradicted_by?.[0] : null,
        message: contradicted
          ? `The document says "${result.statement}", and its own ${(result.contradicted_by || []).join(", ")} contradict${(result.contradicted_by || []).length === 1 ? "s" : ""} that.`
          : `This kind of document must provide that "${result.statement}", and this draft does not.`,
        suggestion: hard
          ? `Add a provision that satisfies it (${(result.would_be_satisfied_by || []).join(" or ")}); the document cannot be released without it.`
          : "Have a lawyer decide whether the document can stand without it, or add a provision that satisfies it.",
        evidence: { coverage: result.coverage, would_be_satisfied_by: result.would_be_satisfied_by, contradicted_by: result.contradicted_by, enforcement: entry.enforcement },
      }));
    }
    entries.push(entry);
  }

  for (const relationship of assessment.relationships || []) {
    const entry = { id: relationship.id, kind: "RELATIONSHIP", coverage: relationship.coverage, between: relationship.between };
    if (relationship.coverage === "RESOLVED") {
      entry.state = REQUIREMENT_STATE.SATISFIED;
      entry.evidence = { read: relationship.read, defers: relationship.defers };
    } else if (relationship.coverage === "NOT_APPLICABLE") {
      entry.state = REQUIREMENT_STATE.NOT_APPLICABLE;
      entry.reason = { detail: relationship.detail };
    } else if (relationship.coverage === "CONTRADICTED") {
      entry.state = REQUIREMENT_STATE.VIOLATED;
      entry.release = RELEASE.BLOCKED;
      issues.push(issue({
        ruleId: "MATERIAL_CONTRADICTION", release: RELEASE.BLOCKED, severity: "CRITICAL", requirement: relationship.id,
        clauseId: relationship.engaged?.[1] || relationship.between?.[1],
        message: `Material contradiction. ${relationship.detail}`,
        suggestion: "Give the answer once, and have every other clause that deals with it refer to that clause instead of stating its own.",
        evidence: { read: relationship.read, read_raw: relationship.read_raw, distinct: relationship.distinct },
      }));
    } else {
      entry.state = REQUIREMENT_STATE.EVIDENCE_MISSING;
      entry.release = RELEASE.REQUIRES_LEGAL_REVIEW;
      issues.push(issue({
        ruleId: "RELATIONSHIP_NOT_ESTABLISHED", release: RELEASE.REQUIRES_LEGAL_REVIEW, severity: "HIGH", requirement: relationship.id,
        message: `Whether the document answers ${relationship.must_agree_on} consistently could not be established: ${relationship.detail}`,
        suggestion: "Have a lawyer read the clauses named and confirm they agree.",
        evidence: { coverage: relationship.coverage, silent: relationship.silent, read: relationship.read },
      }));
    }
    entries.push(entry);
  }

  const count = (s) => entries.filter((e) => e.state === s).length;
  return {
    issues,
    ledger: {
      document_type: documentType,
      entries,
      summary: Object.fromEntries(Object.values(REQUIREMENT_STATE).map((s) => [s.toLowerCase(), count(s)])),
    },
  };
}

/** The validation layer. */
export function validateRequirements(draft, { documentType, variables = {} } = {}) {
  const assessment = assessDraftRequirements(draft, { documentType, variables });
  return { assessment, ...requirementFindings(assessment, documentType || draft?.document_type) };
}

/**
 * The release outcome of a validation result. A blocking finding always wins;
 * then missing information (nothing can be reviewed without it); then legal
 * review; then any other open finding; and only with none of those is the
 * result "Automated checks passed".
 */
export function releaseOutcomeOf(blockingIssues = [], actionableIssues = []) {
  if (blockingIssues.length) return RELEASE.BLOCKED;
  if (actionableIssues.some((i) => i?.release_outcome === RELEASE.REQUIRES_INFORMATION)) return RELEASE.REQUIRES_INFORMATION;
  if (actionableIssues.some((i) => i?.release_outcome === RELEASE.REQUIRES_LEGAL_REVIEW)) return RELEASE.REQUIRES_LEGAL_REVIEW;
  if (actionableIssues.length) return RELEASE.REVIEW_REQUIRED;
  return RELEASE.AUTOMATED_CHECKS_PASSED;
}
