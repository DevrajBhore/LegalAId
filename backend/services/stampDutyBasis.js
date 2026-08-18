/**
 * stampDutyBasis.js
 *
 * Derives the financial value that stamp duty is computed on, from the intake
 * form the user already filled in.
 *
 * Why this exists: the stamp rate table in knowledge-base/rules/stamp_duty.rules.json
 * computes duty as a percentage of `totalRent`, `loanAmount` or `guaranteedAmount`,
 * and the validator read those from `draft.metadata.financials` -- which nothing
 * in the codebase ever populated. The adequacy branch therefore returned early on
 * every document and no duty was ever calculated. The mapping from intake fields
 * to each basis lives in the rules JSON so it stays reviewable.
 */

import fs from "fs";

import { parseDurationMonths } from "../../IRE/src/indian-rule-engine/constraintEngine.js";

const RULES_FILE = new URL(
  "../../knowledge-base/rules/stamp_duty.rules.json",
  import.meta.url
);

let rulesCache = null;

function loadRules() {
  if (rulesCache === null) {
    try {
      rulesCache = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
    } catch {
      rulesCache = { rates: {}, financial_bases: {} };
    }
  }
  return rulesCache;
}

function toAmount(value) {
  if (value === undefined || value === null || value === "") return null;
  const match = String(value).replace(/[\s,]/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstAmount(fields = [], variables = {}) {
  for (const field of fields) {
    const amount = toAmount(variables[field]);
    if (amount !== null) return amount;
  }
  return null;
}

function firstDurationMonths(fields = [], variables = {}) {
  for (const field of fields) {
    const months = parseDurationMonths(variables[field]);
    if (months !== null && months > 0) return months;
  }
  return null;
}

/**
 * @returns {{totalRent?: number, loanAmount?: number, guaranteedAmount?: number,
 *            _derivation: object}} the bases that could be derived, plus a record
 *            of how each was reached so the advisory can explain itself.
 */
export function resolveStampFinancials(variables = {}) {
  const { financial_bases: bases = {} } = loadRules();
  const financials = {};
  const derivation = {};

  for (const [basis, spec] of Object.entries(bases)) {
    if (Array.isArray(spec.amount_fields)) {
      const amount = firstAmount(spec.amount_fields, variables);
      if (amount !== null) {
        financials[basis] = amount;
        derivation[basis] = "taken directly from the submitted amount";
      }
      continue;
    }

    if (Array.isArray(spec.periodic_fields)) {
      const periodic = firstAmount(spec.periodic_fields, variables);
      const months = firstDurationMonths(spec.term_fields || [], variables);
      if (periodic !== null && months !== null) {
        financials[basis] = Math.round(periodic * months);
        derivation[basis] =
          `${periodic} per month over ${Math.round(months)} month(s)`;
      }
    }
  }

  return { ...financials, _derivation: derivation };
}
