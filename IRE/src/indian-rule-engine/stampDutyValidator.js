/**
 * stampDutyValidator.js
 *
 * Validates stamp duty compliance based on Indian Stamp Act 1899
 * and state-specific stamp duty schedules.
 *
 * All rates, document types, and severity mappings are loaded from:
 *   knowledge-base/rules/stamp_duty.rules.json
 *
 * To update rates or add new document types — edit that JSON file. No code changes needed.
 */

import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Load stamp duty config from KB ───────────────────────────────────────────

function findStampFile() {
  const candidates = [
    path.resolve(__dirname, "../../../../knowledge-base/rules/stamp_duty.rules.json"),
    path.resolve(__dirname, "../../../knowledge-base/rules/stamp_duty.rules.json"),
    path.resolve(__dirname, "../../../../knowledge-base/knowledge-base/rules/stamp_duty.rules.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadStampConfig() {
  const file = findStampFile();
  if (!file) {
    console.warn("[IRE] stamp_duty.rules.json not found — stamp duty validation disabled");
    return { mandatory_stamp_doctypes: [], high_severity_doctypes: [], low_severity_doctypes: [], rates: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    console.error("[IRE] Failed to load stamp_duty.rules.json:", err.message);
    return { mandatory_stamp_doctypes: [], high_severity_doctypes: [], low_severity_doctypes: [], rates: {} };
  }
}

const STAMP_CONFIG = loadStampConfig();
const MANDATORY_STAMP_DOCTYPES = new Set(STAMP_CONFIG.mandatory_stamp_doctypes || []);
const HIGH_SEVERITY_DOCTYPES   = new Set(STAMP_CONFIG.high_severity_doctypes   || []);
const LOW_SEVERITY_DOCTYPES    = new Set(STAMP_CONFIG.low_severity_doctypes    || []);
const STAMP_DUTY_RATES         = STAMP_CONFIG.rates || {};

// ── Validator ─────────────────────────────────────────────────────────────────

export function stampDutyValidate(draft, meta = {}) {
  if (!draft?.clauses) return [];

  const issues  = [];
  const docType = draft.document_type || "";
  const text    = draft.clauses.map(c => c.text || "").join(" ").toLowerCase();

  // ── 1. Stamp duty acknowledgement check ──────────────────────────────────
  const hasStampAcknowledgement =
    text.includes("stamp duty")         ||
    text.includes("non-judicial stamp") ||
    text.includes("stamped on")         ||
    text.includes("stamp paper")        ||
    /executed on.*stamp/i.test(text);

  const stampSeverity =
    HIGH_SEVERITY_DOCTYPES.has(docType) ? "HIGH"  :
    LOW_SEVERITY_DOCTYPES.has(docType)  ? "LOW"   : "MEDIUM";

  if (MANDATORY_STAMP_DOCTYPES.has(docType) && !hasStampAcknowledgement) {
    issues.push({
      rule_id             : "STAMP_ACT_S17_NO_ACKNOWLEDGEMENT",
      severity            : stampSeverity,
      message             : `No stamp duty acknowledgement found. Instruments must be stamped under the Indian Stamp Act 1899 – S.17.`,
      statutory_reference : "Indian Stamp Act 1899 – S.17",
      suggestion          : "Add a statement specifying the stamp paper value used, e.g. 'This agreement is executed on a non-judicial stamp paper of ₹[amount].'",
    });
  }

  // ── 2. Adequacy check (only if state + financials provided) ──────────────
  const state      = meta.state      || draft.metadata?.state;
  const stampPaid  = meta.stampDutyPaid ?? draft.metadata?.stampDutyPaid;
  const financials = meta.financials  || draft.financials || {};

  const rateTable = STAMP_DUTY_RATES[docType];
  if (!rateTable || stampPaid === undefined || stampPaid === null) return issues;

  const stateRate = (state && rateTable[state]) || rateTable["default"];
  if (!stateRate) return issues;

  let required;
  if (stateRate.basis === "fixed") {
    required = stateRate.amount;
  } else if (stateRate.basis === "percent") {
    const base = financials[stateRate.on] || 0;
    required = Math.max(stateRate.min || 0, (base * stateRate.rate) / 100);
  }

  if (required !== undefined && stampPaid < required) {
    issues.push({
      rule_id             : "STAMP_ACT_INSUFFICIENT_DUTY",
      severity            : "CRITICAL",
      message             : `Stamp duty paid (₹${stampPaid}) is less than the required amount (₹${required}) for ${state || "this state"}. Under-stamped documents are inadmissible as evidence (Stamp Act S.35).`,
      statutory_reference : "Indian Stamp Act 1899 – S.35",
      suggestion          : `Pay a minimum stamp duty of ₹${required}. The document may need to be impounded if under-stamped.`,
      meta                : { declared: stampPaid, required, state },
    });
  }

  return issues;
}
