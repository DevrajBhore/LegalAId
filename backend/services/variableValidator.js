import { DOCUMENT_CONFIG } from "../config/documentConfig.js";

const COMPANY_MARKERS =
  /\b(private limited|public limited|pvt\.?\s*ltd|limited|llp|partnership|trust|government body|sole proprietorship)\b/i;
const EXTERNAL_REFERENCE_PATTERN =
  /\b(schedule|annexure|appendix|appendices|exhibit)\b/i;

const TEXT_RULES = {
  purpose: { minChars: 12, minWords: 3 },
  mou_purpose: { minChars: 12, minWords: 3 },
  mou_scope: { minChars: 12, minWords: 4 },
  business_purpose: { minChars: 12, minWords: 3 },
  jv_purpose: { minChars: 12, minWords: 3 },
  consulting_services: { minChars: 12, minWords: 3 },
  services_description: { minChars: 12, minWords: 3 },
  deliverables: { minChars: 8, minWords: 2 },
  payment_terms: { minChars: 6, minWords: 2 },
  price_terms: { minChars: 6, minWords: 2 },
  repayment_schedule: { minChars: 6, minWords: 2 },
  prepayment_terms: { minChars: 6, minWords: 2 },
  security_collateral: { minChars: 3, minWords: 1 },
  project_description: { minChars: 12, minWords: 3 },
  goods_description: { minChars: 12, minWords: 2 },
  product_description: { minChars: 12, minWords: 2 },
  property_description: { minChars: 10, minWords: 3 },
  permitted_use: { minChars: 4, minWords: 2 },
  board_structure: { minChars: 6, minWords: 2 },
  reserved_matters: { minChars: 6, minWords: 2 },
  min_purchase: { minChars: 4, minWords: 2 },
  territory: { minChars: 2, minWords: 1 },
  work_location: { minChars: 2, minWords: 1 },
  delivery_location: { minChars: 2, minWords: 1 },
};

const DURATION_FIELDS = new Set([
  "agreement_term",
  "confidentiality_period",
  "non_compete_period",
  "contract_duration",
  "probation_period",
  "warranty_period",
  "mou_duration",
  "guarantee_period",
  "jv_duration",
]);

const POSITIVE_NUMBER_FIELDS = new Set([
  "salary",
  "contract_value",
  "consulting_fee",
  "price",
  "rent_amount",
  "license_fee",
  "loan_amount",
  "guaranteed_amount",
  "total_fee",
  "capital_contribution_1",
  "capital_contribution_2",
  "security_deposit",
]);

const PERCENT_FIELDS = new Set([
  "interest_rate",
  "default_interest_rate",
  "gst_rate",
  "rent_escalation",
  "shareholding_percentage_1",
  "shareholding_percentage_2",
  "drag_threshold",
]);

const INTEGER_FIELDS = new Set([
  "notice_period_days",
  "working_hours",
  "lease_term",
  "license_term",
  "lock_in_period",
  "rofr_period",
]);

function addError(errors, message) {
  if (!errors.includes(message)) {
    errors.push(message);
  }
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function normalizeName(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value = "") {
  return String(value)
    .trim()
    .replace(/\s+/g, " ");
}

function wordCount(value = "") {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean).length;
}

function parseNumberish(value) {
  if (isBlank(value)) return null;
  const normalized = String(value).replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value) {
  if (isBlank(value)) return null;
  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const parsed = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const ddmmyyyy = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDurationToMonths(value) {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) return null;
  if (["na", "n/a", "none", "nil", "not applicable"].includes(normalized)) {
    return null;
  }
  if (["perpetual", "continuing", "continuing guarantee"].includes(normalized)) {
    return 9999;
  }

  const match = normalized.match(
    /(\d+(?:\.\d+)?)\s*(year|years|yr|yrs|month|months|mo|mos)\b/
  );
  if (!match) {
    const numericOnly = parseNumberish(normalized);
    return numericOnly !== null ? Math.round(numericOnly) : null;
  }

  const quantity = Number(match[1]);
  if (Number.isNaN(quantity)) return null;

  if (match[2].startsWith("year") || match[2] === "yr" || match[2] === "yrs") {
    return Math.round(quantity * 12);
  }

  return Math.round(quantity);
}

function hasMeaningfulText(value, { minChars = 2, minWords = 1 } = {}) {
  const normalized = normalizeText(value);
  if (normalized.length < minChars) return false;

  const alphaCount = (normalized.match(/[A-Za-z]/g) || []).length;
  if (alphaCount < Math.min(3, minChars)) return false;

  return wordCount(normalized) >= minWords;
}

function normalizeOption(value = "") {
  return normalizeText(value).toLowerCase();
}

function validateNameField(errors, key, value) {
  const normalized = normalizeText(value);
  if (!/[A-Za-z]/.test(normalized) || normalized.length < 2) {
    addError(errors, `${key} must contain a valid person or entity name.`);
  }
}

function validateAddressField(errors, key, value) {
  if (!hasMeaningfulText(value, { minChars: 10, minWords: 3 })) {
    addError(errors, `${key} must contain a complete address.`);
  }
}

function validateMeaningfulTextField(errors, key, value) {
  const rule = TEXT_RULES[key];
  if (!rule) return;
  if (!hasMeaningfulText(value, rule)) {
    addError(errors, `${key} must contain a sufficiently specific response.`);
  }
}

function validateIdentifierFormats(errors, key, value) {
  const normalized = normalizeText(value).toUpperCase();

  if (key.endsWith("_gstin")) {
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(normalized)) {
      addError(errors, `${key} must be a valid GSTIN.`);
    }
  }

  if (key.endsWith("_pan") && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized)) {
    addError(errors, `${key} must be a valid PAN.`);
  }

  if (key.endsWith("_cin") && !/^[A-Z][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(normalized)) {
    addError(errors, `${key} must be a valid CIN / registration number.`);
  }
}

function validateInlineDetailsOnly(errors, key, value, definition = {}) {
  if (definition.type === "select" || definition.type === "date" || definition.type === "number") {
    return;
  }

  if (
    key.endsWith("_name") ||
    key.endsWith("_address") ||
    key.endsWith("_gstin") ||
    key.endsWith("_pan") ||
    key.endsWith("_cin")
  ) {
    return;
  }

  if (EXTERNAL_REFERENCE_PATTERN.test(normalizeText(value))) {
    addError(
      errors,
      `${key} must state the operative details directly and must not refer to schedules, annexures, or appendices.`
    );
  }
}

function validateTypeConsistency(errors, input) {
  const pairs = [
    ["party_1_name", "party_1_type", "Party 1"],
    ["party_2_name", "party_2_type", "Party 2"],
    ["shareholder_1_name", "shareholder_1_type", "Shareholder 1"],
    ["shareholder_2_name", "shareholder_2_type", "Shareholder 2"],
    ["guarantor_name", "guarantor_type", "Guarantor"],
  ];

  for (const [nameKey, typeKey, label] of pairs) {
    const name = normalizeText(input[nameKey]);
    const type = normalizeText(input[typeKey]).toLowerCase();
    if (!name || !type) continue;

    if (type.includes("individual") && COMPANY_MARKERS.test(name)) {
      addError(
        errors,
        `${label} type conflicts with the entity name. Choose a company/entity type instead of Individual.`
      );
    }
  }
}

function addDistinctPartyChecks(errors, input) {
  const partyPairs = [
    ["party_1_name", "party_2_name", "The two parties"],
    ["employer_name", "employee_name", "Employer and employee"],
    ["shareholder_1_name", "shareholder_2_name", "Both shareholders"],
    ["partner_1_name", "partner_2_name", "Both partners"],
    ["party_1_name", "guarantor_name", "Creditor and guarantor"],
    ["party_2_name", "guarantor_name", "Principal debtor and guarantor"],
  ];

  for (const [leftKey, rightKey, label] of partyPairs) {
    const left = normalizeName(input[leftKey]);
    const right = normalizeName(input[rightKey]);

    if (left && right && left === right) {
      addError(errors, `${label} must be different legal persons or entities.`);
    }
  }
}

function addFieldLevelChecks(errors, schema, input) {
  for (const [key, definition] of Object.entries(schema)) {
    const value = input[key];
    if (isBlank(value)) continue;

    if (definition.type === "select" && Array.isArray(definition.options)) {
      const allowed = definition.options.map((option) => normalizeOption(option));
      if (!allowed.includes(normalizeOption(value))) {
        addError(
          errors,
          `${key} must be one of the supported options: ${definition.options.join(", ")}.`
        );
      }
    }

    if (definition.type === "date" && !parseDateValue(value)) {
      addError(errors, `${key} must be a valid date.`);
    }

    if (definition.type === "number" && parseNumberish(value) === null) {
      addError(errors, `${key} must be a valid number.`);
    }

    if (key.endsWith("_name") || ["company_name", "partnership_name", "jv_name"].includes(key)) {
      validateNameField(errors, key, value);
    }

    if (key.endsWith("_address") || ["company_address", "business_address", "property_address"].includes(key)) {
      validateAddressField(errors, key, value);
    }

    validateMeaningfulTextField(errors, key, value);
    validateIdentifierFormats(errors, key, value);
    validateInlineDetailsOnly(errors, key, value, definition);

    if (DURATION_FIELDS.has(key) && parseDurationToMonths(value) === null) {
      addError(errors, `${key} must be a valid duration such as "12 months" or "2 years".`);
    }

    if (POSITIVE_NUMBER_FIELDS.has(key)) {
      const numeric = parseNumberish(value);
      if (numeric === null || numeric <= 0) {
        addError(errors, `${key} must be greater than zero.`);
      }
    }

    if (PERCENT_FIELDS.has(key)) {
      const numeric = parseNumberish(value);
      if (numeric === null || numeric < 0 || numeric > 100) {
        addError(errors, `${key} must be between 0 and 100.`);
      }
    }

    if (INTEGER_FIELDS.has(key)) {
      const numeric = parseNumberish(value);
      if (numeric === null || !Number.isInteger(numeric) || numeric <= 0) {
        addError(errors, `${key} must be a positive whole number.`);
      }
    }
  }
}

function addCrossFieldChecks(errors, input) {
  const confidentialityMonths = parseDurationToMonths(input.confidentiality_period);
  const nonCompeteMonths = parseDurationToMonths(input.non_compete_period);

  if (
    confidentialityMonths !== null &&
    nonCompeteMonths !== null &&
    nonCompeteMonths > confidentialityMonths
  ) {
    addError(
      errors,
      "Non-compete period cannot exceed the confidentiality period."
    );
  }

  const defaultInterest = parseNumberish(input.default_interest_rate);
  const interestRate = parseNumberish(input.interest_rate);
  if (
    defaultInterest !== null &&
    interestRate !== null &&
    defaultInterest < interestRate
  ) {
    addError(
      errors,
      "Default interest rate cannot be lower than the regular interest rate."
    );
  }

  const shareholding1 = parseNumberish(input.shareholding_percentage_1);
  const shareholding2 = parseNumberish(input.shareholding_percentage_2);
  if (shareholding1 !== null && shareholding2 !== null) {
    const total = Math.round((shareholding1 + shareholding2) * 100) / 100;
    if (total !== 100) {
      addError(
        errors,
        "Shareholding percentages must add up to exactly 100."
      );
    }
  }

  const leaseTerm = parseNumberish(input.lease_term);
  const licenseTerm = parseNumberish(input.license_term);
  const lockIn = parseNumberish(input.lock_in_period);
  if (lockIn !== null && leaseTerm !== null && lockIn > leaseTerm) {
    addError(errors, "Lock-in period cannot exceed the lease term.");
  }
  if (lockIn !== null && licenseTerm !== null && lockIn > licenseTerm) {
    addError(errors, "Lock-in period cannot exceed the license term.");
  }

  const effectiveDate = parseDateValue(input.effective_date);
  const startDate = parseDateValue(input.start_date);
  const deliveryDate = parseDateValue(input.delivery_date);
  const repaymentStartDate = parseDateValue(input.repayment_start_date);

  if (effectiveDate && startDate && startDate < effectiveDate) {
    addError(errors, "Start date cannot be earlier than the effective date.");
  }

  if (effectiveDate && deliveryDate && deliveryDate < effectiveDate) {
    addError(errors, "Delivery date cannot be earlier than the effective date.");
  }

  if (effectiveDate && repaymentStartDate && repaymentStartDate < effectiveDate) {
    addError(
      errors,
      "Repayment start date cannot be earlier than the effective date."
    );
  }

  const workingHours = parseNumberish(input.working_hours);
  if (workingHours !== null && (workingHours < 1 || workingHours > 168)) {
    addError(errors, "working_hours must be between 1 and 168.");
  }

  const noticeDays = parseNumberish(input.notice_period_days);
  if (noticeDays !== null && (noticeDays < 1 || noticeDays > 365)) {
    addError(errors, "notice_period_days must be between 1 and 365.");
  }
}

function addDocumentSpecificChecks(errors, input, documentType) {
  if (
    documentType === "LOAN_AGREEMENT" &&
    normalizeText(input.security_collateral).toLowerCase() === "na"
  ) {
    addError(
      errors,
      "security_collateral must clearly state the collateral or explicitly say \"Unsecured\"."
    );
  }

  if (
    documentType === "MOU" &&
    normalizeName(input.party_1_name) === normalizeName(input.party_2_name) &&
    normalizeName(input.party_1_name)
  ) {
    addError(errors, "An MOU must identify two distinct parties.");
  }
}

export function validateVariables(schema, input, options = {}) {
  const errors = [];
  const documentType = options.documentType;
  const requiredFields = new Set([
    ...(DOCUMENT_CONFIG[documentType]?.requiredFields || []),
    ...Object.entries(schema)
      .filter(([, field]) => field?.required)
      .map(([key]) => key),
  ]);

  for (const key of requiredFields) {
    if (isBlank(input[key])) {
      addError(errors, `Missing required field: ${key}`);
    }
  }

  addFieldLevelChecks(errors, schema, input);
  addDistinctPartyChecks(errors, input);
  validateTypeConsistency(errors, input);
  addCrossFieldChecks(errors, input);
  addDocumentSpecificChecks(errors, input, documentType);

  return errors;
}
