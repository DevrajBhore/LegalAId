/**
 * stampDutyValidator.js
 *
 * Stamp duty validation — ADVISORY ONLY.
 *
 * Stamp duty is a procedural/administrative requirement, not a substantive
 * legal defect. An un-stamped document is still valid and enforceable between
 * parties — it is only inadmissible as evidence in court until stamped (Stamp Act S.35),
 * and can be impounded and stamped later. It MUST NOT block document generation.
 *
 * All stamp issues are therefore severity: "MEDIUM" (advisory) with
 * blocks_generation: false. They appear in advisory_issues in the UI,
 * not in the blocking issues list.
 *
 * The user is shown a clear informational notice: "This document requires
 * stamp duty — see advisory notes for details."
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load stamp duty config from KB ───────────────────────────────────────────

function findStampFile() {
  const candidates = [
    path.resolve(
      __dirname,
      "../../../../knowledge-base/rules/stamp_duty.rules.json"
    ),
    path.resolve(
      __dirname,
      "../../../knowledge-base/rules/stamp_duty.rules.json"
    ),
    path.resolve(
      __dirname,
      "../../../../knowledge-base/knowledge-base/rules/stamp_duty.rules.json"
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadStampConfig() {
  const file = findStampFile();
  if (!file) {
    console.warn(
      "[IRE] stamp_duty.rules.json not found — stamp duty validation disabled"
    );
    return {
      mandatory_stamp_doctypes: [],
      high_severity_doctypes: [],
      low_severity_doctypes: [],
      rates: {},
    };
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("[IRE] Failed to load stamp_duty.rules.json:", err.message);
    return {
      mandatory_stamp_doctypes: [],
      high_severity_doctypes: [],
      low_severity_doctypes: [],
      rates: {},
    };
  }
}

const STAMP_CONFIG = loadStampConfig();
const MANDATORY_STAMP_DOCTYPES = new Set(
  STAMP_CONFIG.mandatory_stamp_doctypes || []
);
const STAMP_DUTY_RATES = STAMP_CONFIG.rates || {};

function formatRupees(amount) {
  const rounded = Math.round(Number(amount) || 0);
  return `\u20b9${rounded.toLocaleString("en-IN")}`;
}

/**
 * Computes the duty the rate table implies, or explains why it cannot.
 * Returns { amount, state, basis, reason }.
 */
function computeRequiredDuty(docType, state, financials = {}) {
  const rateTable = STAMP_DUTY_RATES[docType];
  if (!rateTable) {
    return { amount: null, reason: `no stamp rate is held for ${docType}` };
  }

  const resolvedState = state && rateTable[state] ? state : null;
  const stateRate = resolvedState ? rateTable[resolvedState] : rateTable.default;
  if (!stateRate) {
    return { amount: null, reason: "no rate is held for this state and there is no default" };
  }

  if (stateRate.basis === "fixed") {
    return {
      amount: stateRate.amount,
      state: resolvedState,
      basis: "fixed",
      reason: null,
    };
  }

  if (stateRate.basis === "percent") {
    const base = financials?.[stateRate.on];
    if (base === undefined || base === null) {
      return {
        amount: null,
        state: resolvedState,
        basis: "percent",
        reason: `the value it is charged on (${stateRate.on}) could not be derived from the form`,
      };
    }
    return {
      amount: Math.max(stateRate.min || 0, (base * stateRate.rate) / 100),
      state: resolvedState,
      basis: "percent",
      rate: stateRate.rate,
      on: stateRate.on,
      base,
      reason: null,
    };
  }

  return { amount: null, reason: "the rate entry has no recognised basis" };
}

// ── Validator ─────────────────────────────────────────────────────────────────

export function stampDutyValidate(draft, meta = {}) {
  if (!draft?.clauses) return [];

  const issues = [];
  const docType = draft.document_type || "";

  if (!MANDATORY_STAMP_DOCTYPES.has(docType)) return [];

  const state =
    meta.state ||
    draft.metadata?.state ||
    draft.metadata?.source_variables?.governing_law_state ||
    draft.metadata?.source_variables?.operating_state;
  const stampPaid = meta.stampDutyPaid ?? draft.metadata?.stampDutyPaid;
  const financials =
    meta.financials || draft.metadata?.financials || draft.financials || {};

  const required = computeRequiredDuty(docType, state, financials);

  // ── 1. Stamp duty notice ─────────────────────────────────────────────────
  // This used to fire only when the draft text did NOT mention stamp paper.
  // jurisdictionEngine.injectStampExecutionText unconditionally writes
  // "...on non-judicial stamp paper of appropriate value..." into every
  // signature clause during generation, so the phrase was always present and
  // the notice was unreachable for every generated document. The check is now
  // driven by the document TYPE and the rate table, not by prose the pipeline
  // wrote itself.
  const dutyLine =
    required.amount !== null
      ? `Estimated duty for ${required.state || "the default rate"}: ${formatRupees(required.amount)}` +
        (required.basis === "percent"
          ? ` (${required.rate}% of ${formatRupees(required.base)}).`
          : ".")
      : `The amount could not be computed here because ${required.reason}.`;

  issues.push({
    rule_id: "STAMP_ACT_S17_NOTICE",
    severity: "MEDIUM", // ADVISORY — never blocks
    blocks_generation: false, // explicit flag: does NOT block
    message:
      `This document requires stamp duty under the Indian Stamp Act, 1899. ` +
      `It is valid between the parties unstamped, but is inadmissible in evidence until ` +
      `stamped (S.35). ${dutyLine}`,
    statutory_reference: "Indian Stamp Act, 1899 – S.3, S.35",
    suggestion:
      required.amount !== null
        ? `Procure non-judicial stamp paper of at least ${formatRupees(required.amount)}, or e-stamp for the equivalent value. Confirm against the current schedule for your state.`
        : "Check the stamp schedule in force in the state of execution and stamp the instrument before relying on it in evidence.",
    stamp_advisory: true, // frontend flag to show special notice
    meta: {
      computed: required.amount,
      state: required.state || null,
      basis: required.basis || null,
      uncomputable_reason: required.reason || null,
    },
  });

  // ── 2. Adequacy check (only where a duty was declared) ───────────────────
  if (stampPaid === undefined || stampPaid === null || required.amount === null) {
    return issues;
  }

  if (stampPaid < required.amount) {
    issues.push({
      rule_id: "STAMP_ACT_INSUFFICIENT_DUTY",
      severity: "MEDIUM", // ADVISORY
      blocks_generation: false, // does NOT block
      message: `Stamp duty declared (${formatRupees(stampPaid)}) appears lower than the estimated requirement (${formatRupees(required.amount)}) for ${
        required.state || "your state"
      }. Under-stamped instruments may be impounded (Stamp Act S.33) and are inadmissible until the deficiency and any levy are made good (S.35).`,
      statutory_reference: "Indian Stamp Act, 1899 – S.33, S.35",
      suggestion: `Ensure stamp duty of at least ${formatRupees(required.amount)} is paid. Confirm against your state's stamp schedule.`,
      stamp_advisory: true,
      meta: { declared: stampPaid, required: required.amount, state: required.state },
    });
  }

  return issues;
}
