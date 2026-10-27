/**
 * protectionDecisions.js — D4.50
 *
 * For every protection a document carries (limitation of liability, indemnity,
 * force majeure, IP ownership, late payment interest, termination notice),
 * records how it got there and whether an answer of the user's governs it, and
 * produces the disclosure the document must carry when none does.
 *
 * Measured on the D4.49 engine (tests/fixtures/injectedProtections.D4_50.json):
 * 92 of 136 protection clauses across the generated documents were governed by
 * no answer of the user's, and not one was disclosed. The commercial engine
 * alone added 20 (an indemnity and a liability cap to the NDA, the Employment
 * Contract and both leases; late payment interest to the Service and Consultancy
 * agreements), and provenance reported each as NO_PRODUCER_OBSERVED. The Founders
 * Agreement received its indemnity and cap only in the repair round, because the
 * commercial validator recommends them for a type the commercial engine does not
 * inject them into.
 *
 * What this module does NOT do: it never removes a protection because the user
 * did not choose it, never changes a clause, and never changes a validation
 * result. It makes the default visible. Whether a default should stay, change or
 * go is a commercial or legal decision, recorded in
 * knowledge-base/governance/injected-protections.json.
 *
 * Where it is used:
 *   - documentService.buildSuccess records draft.metadata.protection_decisions on
 *     every successful generation, from draft.metadata.clause_origin;
 *   - disclosureRenderer adds a DRAFTING DEFAULT entry for every protection that
 *     no answer governs and that is still in the document, so the DOCX, PDF and
 *     TXT exports say it, and an entry for a clause since deleted is not printed;
 *   - the API's `assumptions` carries the same entries.
 */
import fs from "fs";
import { PROTECTION_ROLE_CLAUSE_IDS } from "../commercial/protectionLibrary.js";
import { getVariables } from "../config/variableConfig.js";

const FILE = new URL("../../knowledge-base/metadata/protection_decisions.json", import.meta.url);
const MODEL = JSON.parse(fs.readFileSync(FILE, "utf8"));

const TREATMENTS_FILE = new URL("../../knowledge-base/metadata/protection_treatments.json", import.meta.url);
const TREATMENTS = JSON.parse(fs.readFileSync(TREATMENTS_FILE, "utf8"));

// D4.51. Five questions, kept apart, because an answer to one is not an answer to
// another: a clause that is part of the standard template (inclusion basis) is not
// thereby a term the user approved (user decision), nor one whose figures the
// user chose (value provenance), nor one an advocate has cleared (legal review).
//
//   origin_stage      which generation stage put the clause in the draft
//   inclusion_basis   what authorised its inclusion
//   value_provenance  who chose its commercial parameters
//   legal_review      whether its legal treatment has been approved
//   user_decision     whether the user accepted it, declined it, or was not asked
//
// `disclosed` is derived, by the D4.50 rule: disclosed unless an answer of the
// user's governs it (a yes to include it, or its parameters chosen), and always
// when the user declined it and it is still there.

/** What authorised the clause's inclusion. */
export const INCLUSION_BASIS = Object.freeze({
  USER_SELECTED: "USER_SELECTED",
  TEMPLATE_STANDARD: "TEMPLATE_STANDARD",
  ENGINE_DEFAULT: "ENGINE_DEFAULT",
  REPAIR_RECOMMENDATION: "REPAIR_RECOMMENDATION",
  ORIGIN_NOT_RECORDED: "ORIGIN_NOT_RECORDED",
});

/** Who chose the clause's commercial parameters. */
export const VALUE_PROVENANCE = Object.freeze({
  USER_ANSWERS: "USER_ANSWERS",
  TEMPLATE_WORDING: "TEMPLATE_WORDING",
});

/** Whether the user accepted, declined, or was never asked. Never inferred. */
export const USER_DECISION = Object.freeze({
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  NOT_ASKED: "NOT_ASKED",
});

export const PROTECTION_DISCLOSURE_PROVENANCE = "PROTECTION_DEFAULT";

const ROLE_OF = Object.fromEntries(
  Object.entries(PROTECTION_ROLE_CLAUSE_IDS).flatMap(([role, ids]) => ids.map((id) => [id, role]))
);
const TOGGLES = new Set(MODEL.toggle_controls || []);

export function protectionRoleOf(clauseId) {
  return ROLE_OF[String(clauseId || "")] || null;
}

const answered = (value) => value !== undefined && value !== null && String(value).trim() !== "";

function originEntry(stage) {
  return MODEL.origins[stage] || MODEL.origins.unrecorded;
}

/** The register entry for this family and protection, or NOT_REGISTERED. */
export function treatmentFor(documentType, role) {
  const entry = TREATMENTS.families?.[String(documentType || "")]?.[role];
  if (!entry) return { treatment: null, status: "NOT_REGISTERED" };
  return { treatment: entry.treatment || null, status: entry.status || "PENDING" };
}

export function protectionTreatmentRegister() {
  return TREATMENTS;
}

/**
 * One record per protection clause in the draft. `variables` are the answers the
 * document was generated from (draft.metadata.source_variables by default).
 */
export function decideProtections(draft, documentType = draft?.document_type, variables = draft?.metadata?.source_variables || {}) {
  const schema = getVariables(documentType) || {};
  const origins = draft?.metadata?.clause_origin || null;
  const decisions = [];
  for (const clause of draft?.clauses || []) {
    const role = protectionRoleOf(clause.clause_id);
    if (!role) continue;
    const roleModel = MODEL.roles[role];
    const controls = (roleModel?.intake_controls || []).filter((k) => k in schema);
    const answers = Object.fromEntries(controls.filter((k) => answered(variables?.[k])).map((k) => [k, variables[k]]));
    const stage = origins ? origins[clause.clause_id] || "unrecorded" : "unrecorded";
    const origin = originEntry(stage);
    const toggleAnswers = Object.entries(answers).filter(([k]) => TOGGLES.has(k));
    const parameters = Object.fromEntries(Object.entries(answers).filter(([k]) => !TOGGLES.has(k)));
    // A toggle answered "No" with the clause still present is not a choice the
    // clause reflects; a toggle answered "Yes" is the only acceptance there is.
    const declinedByToggle = toggleAnswers.some(([, v]) => /^no$/i.test(String(v).trim()));
    const acceptedByToggle = !declinedByToggle && toggleAnswers.some(([, v]) => /^yes$/i.test(String(v).trim()));
    const userDecision = declinedByToggle ? USER_DECISION.DECLINED : acceptedByToggle ? USER_DECISION.ACCEPTED : USER_DECISION.NOT_ASKED;
    const valueSource = Object.keys(parameters).length ? VALUE_PROVENANCE.USER_ANSWERS : VALUE_PROVENANCE.TEMPLATE_WORDING;
    const governed = Object.keys(answers).length > 0 && !declinedByToggle;
    const treatment = treatmentFor(documentType, role);
    decisions.push({
      clause_id: clause.clause_id,
      role,
      title: clause.title || null,
      origin_stage: stage,
      inclusion_basis: acceptedByToggle ? INCLUSION_BASIS.USER_SELECTED : origin.basis,
      value_provenance: { source: valueSource, parameters },
      legal_review: {
        clause_review_status: clause.review_status || null,
        treatment: treatment.treatment,
        treatment_status: treatment.status,
        // Approved only when an advocate has approved the family's treatment and
        // signed the clause off. Neither has happened for any protection yet.
        approved: treatment.status === "APPROVED" && /^(approved|reviewed)/i.test(String(clause.review_status || "")),
      },
      user_decision: userDecision,
      intake_controls: controls,
      answers,
      declined_by_toggle: declinedByToggle,
      disclosed: !governed,
    });
  }
  return decisions;
}

export function protectionDisclosureText(decision) {
  const roleModel = MODEL.roles[decision.role] || {};
  const origin = MODEL.origins[decision.origin_stage] || MODEL.origins.unrecorded;
  // The user was asked and said no, and the clause is there anyway: say exactly
  // that. "You were not asked" would be false.
  if (decision.declined_by_toggle) {
    return MODEL.disclosure_when_declined
      .replace("{label}", roleModel.label || decision.role.toLowerCase())
      .replace("{title}", decision.title || roleModel.label || decision.clause_id)
      .replace("{origin_sentence}", origin.sentence)
      .replace("{what_it_does}", roleModel.what_it_does || "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return MODEL.disclosure
    .replace("{label}", roleModel.label || decision.role.toLowerCase())
    .replace("{title}", decision.title || roleModel.label || decision.clause_id)
    .replace("{origin_sentence}", origin.sentence)
    .replace("{what_it_does}", roleModel.what_it_does || "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The disclosure entries, in the shape positionResolution.js gives assumptions.
 * Only for decisions not governed by an answer, and only for clauses still in the
 * draft, so an edit that deletes a protection also removes its disclosure.
 */
export function protectionDisclosures(draft) {
  const decisions = draft?.metadata?.protection_decisions;
  if (!Array.isArray(decisions) || !decisions.length) return [];
  const present = new Set((draft?.clauses || []).map((c) => c?.clause_id));
  return decisions
    .filter((d) => d.disclosed && present.has(d.clause_id))
    .map((d) => ({
      mechanisms: [],
      clause_id: d.clause_id,
      text: protectionDisclosureText(d),
      kind: "DRAFTING_DEFAULT",
      provenance: PROTECTION_DISCLOSURE_PROVENANCE,
    }));
}

export function protectionDecisionModel() {
  return MODEL;
}

export const DECLINED_PROTECTION_RULE_ID = "DECLINED_PROTECTION_RETAINED";

/**
 * D4.51. A protection the user answered "No" to, still in the document. The
 * engine does not remove it on its own authority: the MOU's blueprint requires
 * force majeure, and whether the clause or the answer should stand is a decision
 * (declined-protections.json). It asks for that decision, in the editor and on
 * every validation, instead of leaving it to a line at the end of the export.
 * Never blocks: refusing the download would punish the user for an answer the
 * engine chose not to follow.
 */
export function verifyDeclinedProtections(draft, documentType = draft?.document_type, variables = draft?.metadata?.source_variables || {}) {
  return decideProtections(draft, documentType, variables)
    .filter((d) => d.user_decision === USER_DECISION.DECLINED)
    .map((d) => {
      const label = MODEL.roles[d.role]?.label || d.role.toLowerCase();
      return {
        rule_id: DECLINED_PROTECTION_RULE_ID,
        severity: "HIGH",
        release_outcome: "REQUIRES_LEGAL_REVIEW",
        manual_review_required: true,
        blocks_generation: false,
        layer: "protection_decisions",
        offending_clause_id: d.clause_id,
        message: `You answered that you did not want a ${label} provision, but this document still contains one ("${d.title || label}"). Your answer and the document disagree.`,
        suggestion: "Decide which should stand before signing: remove the clause, or change your answer if you want it. If you were told the clause is required, have a lawyer confirm that.",
      };
    });
}

/**
 * D4.51. What is wrong with a treatment register, or [] if nothing. A treatment
 * takes effect only when approved by a named advocate on a date, with one of the
 * four treatments and a rationale; anything short of that is PENDING.
 */
export function treatmentRegisterProblems(register = TREATMENTS) {
  const allowed = Object.keys(register?.treatments || {});
  const statuses = register?.statuses || [];
  const problems = [];
  for (const [family, roles] of Object.entries(register?.families || {})) {
    for (const [role, entry] of Object.entries(roles || {})) {
      const id = `${family}/${role}`;
      if (!statuses.includes(entry?.status)) problems.push(`${id}: status ${entry?.status} is not one of ${statuses.join(", ")}`);
      if (entry?.status === "APPROVED") {
        if (!allowed.includes(entry.treatment)) problems.push(`${id}: APPROVED without a treatment from ${allowed.join(", ")}`);
        if (!entry.decided_by) problems.push(`${id}: APPROVED without a named approver`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.decided_on || ""))) problems.push(`${id}: APPROVED without a date`);
        if (!entry.rationale) problems.push(`${id}: APPROVED without a rationale`);
      } else if (entry?.treatment || entry?.decided_by || entry?.decided_on) {
        problems.push(`${id}: a treatment, approver or date is recorded while the status is ${entry?.status}`);
      }
    }
  }
  return problems;
}
