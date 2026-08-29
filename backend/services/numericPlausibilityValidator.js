import fs from "fs";
import { getVariables } from "../config/variableConfig.js";

// Numeric plausibility. This layer runs against the figures the user typed into
// the intake form, not against the assembled prose, because that is the only
// point at which a wrong number can still be corrected cheaply. Once a figure is
// in a clause it has usually been repeated in three places and cross-referenced
// in a schedule.
//
// The bounds live in knowledge-base/rules/numeric_bounds.rules.json so an
// advocate can read and revise them without touching code.

const RULES_FILE = new URL(
  "../../knowledge-base/rules/numeric_bounds.rules.json",
  import.meta.url
);

let rulesCache = null;

function loadRules() {
  if (rulesCache === null) {
    try {
      rulesCache = JSON.parse(fs.readFileSync(RULES_FILE, "utf8"));
    } catch {
      rulesCache = { fields: {}, cross_field: [] };
    }
  }
  return rulesCache;
}

// Intake values arrive as strings, and users type them the way they say them:
// "Rs. 12,00,000", "18%", "₹45,000/-". Strip the decoration, keep the number.
// A value that still is not a number after that is left to the required-field
// checks; it is not this layer's business.
export function parseNumericInput(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  const text = String(raw).trim();
  if (!text) return null;

  // Reject anything carrying prose - "as mutually agreed", "12 to 15 days".
  // A range is a real answer, but it is not a single figure and cannot be bounded.
  const cleaned = text
    .replace(/[₹]/g, "")
    // "Rs." must lose its full stop with it, or the stop is read as a decimal point.
    .replace(/\bRs\.?/gi, "")
    .replace(/\bINR\b/gi, "")
    .replace(/\/-/g, "")
    .replace(/%/g, "")
    .replace(/[,\s]/g, "");

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function buildIssue(ruleId, severity, message, suggestion) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    blocks_generation: severity === "CRITICAL",
    auto_fixable: false,
  };
}

function fieldLabel(definitions, name) {
  return definitions?.[name]?.label || name;
}

// Rendered into the message so the drafter sees the figure as they typed it
// rather than a normalised one they will not recognise.
function showValue(value) {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value) ? String(value) : String(value);
}

// "8 count" and "3 multiple" read as noise; the label already says what is
// being counted, so those units are carried as metadata but not printed.
const SILENT_UNITS = new Set(["count", "multiple"]);

function checkField(name, value, spec, definitions) {
  const issues = [];
  const label = fieldLabel(definitions, name);
  const unit = spec.unit && !SILENT_UNITS.has(spec.unit) ? ` ${spec.unit}` : "";
  const idBase = `IMPLAUSIBLE_${name.toUpperCase()}`;

  const impossible = spec.impossible || {};

  if (impossible.integer === true && !Number.isInteger(value)) {
    issues.push(
      buildIssue(
        `${idBase}_NOT_WHOLE`,
        "CRITICAL",
        `${label} is ${showValue(value)}, but this field counts whole units.`,
        `Enter a whole number for ${label.toLowerCase()}.`
      )
    );
  }

  if (Number.isFinite(impossible.min) && value < impossible.min) {
    issues.push(
      buildIssue(
        `${idBase}_BELOW_MINIMUM`,
        "CRITICAL",
        `${label} is ${showValue(value)}${unit}, which is below the least this field can take (${impossible.min}).`,
        `Enter a ${label.toLowerCase()} of at least ${impossible.min}${unit}.`
      )
    );
  }

  if (Number.isFinite(impossible.max) && value > impossible.max) {
    issues.push(
      buildIssue(
        `${idBase}_ABOVE_MAXIMUM`,
        "CRITICAL",
        `${label} is ${showValue(value)}${unit}, which is beyond anything this field can mean (the ceiling is ${impossible.max}).`,
        spec.note
          ? `${spec.note} Correct the figure before generating.`
          : `Check the units and correct the figure before generating.`
      )
    );
  }

  // A value that contradicts a named provision. Separated from the plausibility
  // band because the drafter is entitled to see which section is engaged.
  const statutory = spec.statutory;
  if (statutory) {
    const breachesMax = Number.isFinite(statutory.max) && value > statutory.max;
    const breachesMin = Number.isFinite(statutory.min) && value < statutory.min;
    if (breachesMax || breachesMin) {
      issues.push(
        buildIssue(
          `STATUTORY_LIMIT_${name.toUpperCase()}`,
          statutory.severity || "HIGH",
          `${label} is ${showValue(value)}${unit}. ${statutory.message}`,
          `Reference: ${statutory.citation}.`
        )
      );
    }
  }

  if (Array.isArray(spec.allowed) && spec.allowed.length && !spec.allowed.includes(value)) {
    issues.push(
      buildIssue(
        `${idBase}_NOT_A_NOTIFIED_VALUE`,
        spec.allowed_severity || "MEDIUM",
        `${label} is ${showValue(value)}${unit}, which is not one of the recognised values (${spec.allowed.join(", ")}).`,
        spec.note || `Confirm the figure before generating.`
      )
    );
  }

  // Only raise the soft band where the hard band has not already fired, so a
  // single wrong figure produces one notice rather than three.
  const alreadyFlagged = issues.some((issue) => issue.severity === "CRITICAL");
  const implausible = spec.implausible || {};
  if (!alreadyFlagged) {
    if (Number.isFinite(implausible.max) && value > implausible.max) {
      issues.push(
        buildIssue(
          `${idBase}_UNUSUALLY_HIGH`,
          "MEDIUM",
          `${label} is ${showValue(value)}${unit}, which is well above what this field ordinarily carries.`,
          spec.note || `Confirm the figure and the units are what you intend.`
        )
      );
    }
    if (Number.isFinite(implausible.min) && value < implausible.min) {
      issues.push(
        buildIssue(
          `${idBase}_UNUSUALLY_LOW`,
          "MEDIUM",
          `${label} is ${showValue(value)}${unit}, which is well below what this field ordinarily carries.`,
          spec.note || `Confirm the figure and the units are what you intend.`
        )
      );
    }
  }

  return issues;
}

function checkCrossField(rule, numbers, definitions) {
  const label = (name) => fieldLabel(definitions, name);
  const present = (name) => Object.prototype.hasOwnProperty.call(numbers, name);

  switch (rule.kind) {
    case "sum_at_most": {
      const fields = (rule.fields || []).filter(present);
      if (fields.length < (rule.fields || []).length) return [];
      const total = fields.reduce((sum, name) => sum + numbers[name], 0);
      if (total <= rule.limit) return [];
      return [
        buildIssue(
          rule.id,
          rule.severity || "HIGH",
          `${rule.message} They total ${showValue(total)} against a limit of ${rule.limit}.`,
          rule.suggestion
        ),
      ];
    }

    case "not_all_zero": {
      const fields = (rule.fields || []).filter(present);
      if (!fields.length) return [];
      if (fields.some((name) => numbers[name] !== 0)) return [];
      return [buildIssue(rule.id, rule.severity || "MEDIUM", rule.message, rule.suggestion)];
    }

    case "at_most_field": {
      if (!present(rule.field) || !present(rule.reference)) return [];
      if (numbers[rule.field] <= numbers[rule.reference]) return [];
      return [
        buildIssue(
          rule.id,
          rule.severity || "HIGH",
          `${rule.message} ${label(rule.field)} is ${showValue(numbers[rule.field])} against ${label(
            rule.reference
          )} of ${showValue(numbers[rule.reference])}.`,
          rule.suggestion
        ),
      ];
    }

    case "ratio_at_most": {
      if (!present(rule.field) || !present(rule.reference)) return [];
      const reference = numbers[rule.reference];
      if (!(reference > 0)) return [];
      const ratio = numbers[rule.field] / reference;
      if (ratio <= rule.limit) return [];
      return [
        buildIssue(
          rule.id,
          rule.severity || "MEDIUM",
          `${rule.message} It is ${ratio.toFixed(1)} times the ${label(rule.reference).toLowerCase()}.`,
          rule.suggestion
        ),
      ];
    }

    // The signature of a form filled from a template or a fixture: one figure
    // repeated across fields that have nothing to do with one another.
    case "repeated_value": {
      const buckets = new Map();
      for (const [name, value] of Object.entries(numbers)) {
        if (Math.abs(value) < (rule.ignore_below ?? 0)) continue;
        if (!buckets.has(value)) buckets.set(value, []);
        buckets.get(value).push(name);
      }
      const issues = [];
      for (const [value, names] of buckets) {
        if (names.length < (rule.min_distinct_fields ?? 3)) continue;
        issues.push(
          buildIssue(
            rule.id,
            rule.severity || "MEDIUM",
            `${rule.message} ${showValue(value)} appears in ${names.length} fields: ${names
              .map((name) => label(name))
              .join(", ")}.`,
            rule.suggestion
          )
        );
      }
      return issues;
    }

    default:
      return [];
  }
}

export function validateNumericPlausibility({ documentType, variables = {} } = {}) {
  if (!documentType || !variables || typeof variables !== "object") return [];

  const rules = loadRules();
  const definitions = getVariables(documentType) || {};
  const issues = [];

  // Only the numeric fields this document actually asks for. A stray value left
  // over from a different document type is not this layer's problem.
  const numbers = {};
  for (const [name, definition] of Object.entries(definitions)) {
    if (definition?.type !== "number") continue;
    const value = parseNumericInput(variables[name]);
    if (value === null) continue;
    numbers[name] = value;

    const spec = rules.fields?.[name];
    if (!spec) continue;
    issues.push(...checkField(name, value, spec, definitions));
  }

  for (const rule of rules.cross_field || []) {
    issues.push(...checkCrossField(rule, numbers, definitions));
  }

  return issues;
}

// Exposed so the coverage test can assert that every numeric intake field has a
// bound. A new field with no entry is a silent gap, which is how 500000
// delivery attempts reached a rendered document in the first place.
export function listBoundedFields() {
  return Object.keys(loadRules().fields || {});
}
