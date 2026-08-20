/**
 * riskProfile.js
 *
 * Derives the commercial magnitude of a deal from the intake, so that the
 * risk-allocation clauses can respond to it.
 *
 * Why this exists: a measurement across two Service Agreements -- one at
 * Rs. 12 lakh over 12 months, one at Rs. 4.5 crore over 36 months -- found that
 * 24 of 31 clauses came out byte-identical. Everything that described WHAT the
 * parties exchange (fees, scope, deliverables, timelines, term) responded to the
 * data. Everything that allocated RISK between them -- liability cap, indemnity,
 * termination notice, force majeure, dispute resolution -- did not. A 37x
 * difference in contract value produced the same protections.
 *
 * This module does the arithmetic only. It deliberately does NOT decide the
 * substantive terms: the bands below are commercial classifications, and what
 * each band should mean for a cap or a notice period is a drafting judgement
 * for the supervising advocate. Where the engine cannot justify a choice it
 * raises an advisory instead of silently picking one.
 */

import { parseNumberish } from "./formattingEngine.js";

// Rupee thresholds. Expressed in plain numerals rather than lakh/crore words so
// the comparison is unambiguous.
const DEAL_SIZE_BANDS = [
  { band: "small", upTo: 1_000_000 }, // up to Rs. 10 lakh
  { band: "mid", upTo: 10_000_000 }, // up to Rs. 1 crore
  { band: "large", upTo: 100_000_000 }, // up to Rs. 10 crore
  { band: "major", upTo: Infinity },
];

const TERM_BANDS = [
  { band: "short", upTo: 12 },
  { band: "medium", upTo: 36 },
  { band: "long", upTo: Infinity },
];

// Intake fields that may carry the headline consideration, most specific first.
const VALUE_FIELDS = [
  "contract_value",
  "total_fee",
  "consulting_fee",
  "project_value",
  "purchase_price",
  "order_value",
  "loan_amount",
  "guaranteed_amount",
  "capital_contribution",
  "investment_amount",
  "annual_value",
];

const TERM_FIELDS = [
  "contract_duration",
  "lease_term",
  "occupancy_term",
  "license_term",
  "rental_term",
  "agreement_term",
  "jv_duration",
  "mou_duration",
  "guarantee_period",
  "term_months",
];

const ENTITY_TYPE_PATTERN =
  /(company|llp|limited|corporation|body corporate|partnership|trust|government)/i;

function toAmount(value) {
  const parsed = parseNumberish(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Reads a duration in months. "2 years" and "24 months" are the same term, and
 * a bare number is read as months.
 */
export function toMonths(value) {
  const raw = String(value ?? "");
  const match = raw.replace(/[\s,]/g, "").match(/\d+(?:\.\d+)?/);
  if (!match) return null;

  const amount = Number(match[0]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (/year/i.test(raw)) return amount * 12;
  if (/week/i.test(raw)) return Math.round((amount * 7) / 30);
  if (/day/i.test(raw)) return Math.round(amount / 30);
  return amount;
}

function firstOf(fields, variables, reader) {
  for (const field of fields) {
    const value = reader(variables[field]);
    if (value !== null) return { field, value };
  }
  return { field: null, value: null };
}

function bandFor(value, bands) {
  if (value === null) return null;
  return bands.find((entry) => value <= entry.upTo)?.band ?? null;
}

// Exposure is the higher of the two dimensions: a small but very long
// engagement and a large but short one both warrant more than the floor.
const RANK = { small: 0, mid: 1, large: 2, major: 3 };
const TERM_RANK = { short: 0, medium: 1, long: 2 };
const EXPOSURE_BY_RANK = ["low", "moderate", "elevated", "high"];

// Conventional minimum notice, scaled to exposure. Used only where the user has
// not stated a notice period of their own.
const NOTICE_DAYS_BY_EXPOSURE = { low: 30, moderate: 30, elevated: 60, high: 90 };

export function deriveRiskProfile(documentType, variables = {}) {
  const value = firstOf(VALUE_FIELDS, variables, toAmount);
  const term = firstOf(TERM_FIELDS, variables, toMonths);

  const dealSizeBand = bandFor(value.value, DEAL_SIZE_BANDS);
  const termBand = bandFor(term.value, TERM_BANDS);

  const valueRank = dealSizeBand ? RANK[dealSizeBand] : 0;
  const termRank = termBand ? TERM_RANK[termBand] : 0;
  const exposure = EXPOSURE_BY_RANK[Math.max(valueRank, termRank)] || "low";

  const counterpartyType = [
    variables.party_2_type,
    variables.party_1_type,
    variables.counterparty_type,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    contract_value: value.value,
    contract_value_field: value.field,
    term_months: term.value,
    term_field: term.field,
    deal_size_band: dealSizeBand,
    term_band: termBand,
    exposure,
    counterparty_is_entity: ENTITY_TYPE_PATTERN.test(counterpartyType),
    is_cross_border: /foreign|overseas|cross[- ]border|non[- ]resident/i.test(
      `${variables.lender_type || ""} ${variables.counterparty_type || ""} ${
        variables.governing_law_state || ""
      }`
    ),
    default_termination_notice_days: NOTICE_DAYS_BY_EXPOSURE[exposure] || 30,
    // True when the deal is big or long enough that leaving every protection at
    // its default is a decision someone should make deliberately.
    warrants_risk_review: exposure === "elevated" || exposure === "high",
  };
}

/**
 * The subset of the profile exposed to blueprint conditions and clause
 * builders as ordinary generation variables.
 */
export function riskProfileControls(documentType, variables = {}) {
  const profile = deriveRiskProfile(documentType, variables);

  return {
    deal_size_band: profile.deal_size_band,
    term_band: profile.term_band,
    risk_exposure: profile.exposure,
    contract_value_inr: profile.contract_value,
    term_months: profile.term_months,
    counterparty_is_entity: profile.counterparty_is_entity,
    is_high_value: profile.deal_size_band === "large" || profile.deal_size_band === "major",
    is_long_engagement: profile.term_band === "long",
    // An insurance covenant is conventional once an engagement is large enough
    // or long enough for an uninsured loss to matter. There is no insurance
    // clause anywhere in the library today, at any deal size.
    include_insurance: profile.exposure === "elevated" || profile.exposure === "high",
    default_termination_notice_days: profile.default_termination_notice_days,
    warrants_risk_review: profile.warrants_risk_review,
  };
}
