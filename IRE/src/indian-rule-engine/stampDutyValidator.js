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

// ── Validator ─────────────────────────────────────────────────────────────────

export function stampDutyValidate(draft, meta = {}) {
  if (!draft?.clauses) return [];

  const issues = [];
  const docType = draft.document_type || "";
  const text = draft.clauses
    .map((c) => c.text || "")
    .join(" ")
    .toLowerCase();

  if (!MANDATORY_STAMP_DOCTYPES.has(docType)) return [];

  // ── 1. Stamp acknowledgement check ───────────────────────────────────────
  const hasStampAcknowledgement =
    text.includes("stamp duty") ||
    text.includes("non-judicial stamp") ||
    text.includes("stamped on") ||
    text.includes("stamp paper") ||
    /executed on.*stamp/i.test(text);

  if (!hasStampAcknowledgement) {
    issues.push({
      rule_id: "STAMP_ACT_S17_NOTICE",
      severity: "MEDIUM", // ADVISORY — never blocks
      blocks_generation: false, // explicit flag: does NOT block
      message: `This document type (${docType.replace(
        /_/g,
        " "
      )}) requires stamp duty under the Indian Stamp Act, 1899. The document is valid between parties but must be stamped before use as evidence in court (S.35). Stamp paper of appropriate value must be procured.`,
      statutory_reference: "Indian Stamp Act, 1899 – S.17, S.35",
      suggestion:
        "Obtain non-judicial stamp paper of appropriate value from a licensed stamp vendor. The required denomination depends on your state — check your State Stamp Act schedule.",
      stamp_advisory: true, // frontend flag to show special notice
    });
  }

  // ── 2. Adequacy check (only if state + financials provided) ──────────────
  const state = meta.state || draft.metadata?.state;
  const stampPaid = meta.stampDutyPaid ?? draft.metadata?.stampDutyPaid;
  const financials = meta.financials || draft.financials || {};

  const rateTable = STAMP_DUTY_RATES[docType];
  if (!rateTable || stampPaid === undefined || stampPaid === null)
    return issues;

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
      rule_id: "STAMP_ACT_INSUFFICIENT_DUTY",
      severity: "MEDIUM", // ADVISORY
      blocks_generation: false, // does NOT block
      message: `Stamp duty declared (₹${stampPaid}) appears lower than the estimated requirement (₹${required}) for ${
        state || "your state"
      }. Under-stamped documents may be impounded (Stamp Act S.33) and are inadmissible until deficit duty + penalty is paid (S.35).`,
      statutory_reference: "Indian Stamp Act, 1899 – S.33, S.35",
      suggestion: `Ensure stamp duty of at least ₹${required} is paid. Consult your state's stamp schedule or a stamp vendor for the exact amount.`,
      stamp_advisory: true,
      meta: { declared: stampPaid, required, state },
    });
  }

  return issues;
}
