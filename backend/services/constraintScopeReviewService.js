/**
 * constraintScopeReviewService.js
 *
 * Advocate review of CONSTRAINT SCOPE, as opposed to clause text.
 *
 * libraryReviewService.js handles the clauses. This module handles the other
 * thing an advocate has to settle: which instruments a constraint is a rule
 * ABOUT. Thirteen rules in contract.constraints.json and
 * employment.constraints.json state their scope in prose — "Every contract
 * must…", "Employment contract must…" — and declare none as data. The evaluator
 * reads an undeclared scope as universal, so every one of them is currently
 * applied to every document the system produces.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO.
 *
 * It does not write applies_to_doc_types. Recording a decision must not change
 * what the product generates: the chain is advocate decision -> executable scope
 * -> applicability -> generation consequence, and collapsing the first two steps
 * would let a legal answer alter live documents before anyone re-measured. The
 * decision is stored; encoding it is a separate, deliberate act.
 *
 * It does not compute the consequence on request. The measured effect of each
 * candidate answer is read from knowledge-base/governance/constraint-scope.json,
 * where it was recorded with the date and population it was measured against —
 * the same discipline libraryReviewService uses in reading reach from
 * configuration rather than generating every document to load a page.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KB = path.resolve(__dirname, "../../knowledge-base");
const CONSTRAINT_DIR = path.join(KB, "constraints");
const SCOPE_RECORD = path.join(KB, "governance/constraint-scope.json");

const PLACEHOLDER_REVIEWERS = new Set(["", "pending", "tbd", "todo", "none", "n/a", "unknown"]);
const DECISIONS = new Set(["decide", "not_representable", "discuss", "reset"]);

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readScopeRecord() {
  try {
    return JSON.parse(fs.readFileSync(SCOPE_RECORD, "utf8"));
  } catch {
    throw httpError("constraint-scope.json is unreadable; the survey it holds is what this panel lists.", 500);
  }
}

/** Every constraint file, so a rule can be located and written back. */
function constraintFiles() {
  return fs
    .readdirSync(CONSTRAINT_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(CONSTRAINT_DIR, name));
}

function locateRule(ruleId) {
  for (const file of constraintFiles()) {
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(file, "utf8")); } catch { continue; }
    const rules = parsed?.rules;
    if (!Array.isArray(rules)) continue;
    const index = rules.findIndex((r) => r?.rule_id === ruleId);
    if (index !== -1) return { file, parsed, index };
  }
  return null;
}

/** A decision exists only when it carries an authority and a named decider. */
function decisionState(rule) {
  const d = rule?.scope_decision;
  if (!d || !d.scope) return { state: "outstanding", decided: false };
  if (!d.authority || !d.decided_by) return { state: "incomplete", decided: false };
  return { state: d.outcome === "not_representable" ? "not_representable" : "decided", decided: true };
}

export function listConstraintScopes({ state = null } = {}) {
  const record = readScopeRecord();
  const rows = record.rules.map((surveyed) => {
    const found = locateRule(surveyed.rule_id);
    const rule = found ? found.parsed.rules[found.index] : null;
    const status = decisionState(rule);
    return {
      rule_id: surveyed.rule_id,
      proposition: surveyed.proposition,
      authority_recorded: surveyed.statute,
      authored_scope: surveyed.scope_stated_in_its_own_prose,
      severity: surveyed.severity,
      constraint_set: surveyed.set,
      satisfied_by_count: (surveyed.satisfied_by || []).length,
      measured_consequence: surveyed.measured_consequence || null,
      // Declared scope as it stands in the file — empty for all thirteen today.
      declared_scope: rule
        ? {
            applies_to_doc_types: rule.applies_to_doc_types || null,
            excludes_doc_types: rule.excludes_doc_types || null,
            excludes_shapes: rule.excludes_shapes || null,
          }
        : null,
      scope_decision: rule?.scope_decision || null,
      review_state: status.state,
      decided: status.decided,
      // True once a decision exists and the declaration still does not reflect
      // it. The panel says so rather than implying the answer is live.
      awaiting_encoding:
        status.decided &&
        !(rule.applies_to_doc_types || rule.excludes_doc_types || rule.excludes_shapes),
    };
  });

  if (!state) return rows;
  return rows.filter((row) => (state === "outstanding" ? !row.decided : row.review_state === state));
}

export function summariseConstraintScope() {
  const rows = listConstraintScopes();
  return {
    total: rows.length,
    decided: rows.filter((r) => r.decided).length,
    outstanding: rows.filter((r) => !r.decided).length,
    awaiting_encoding: rows.filter((r) => r.awaiting_encoding).length,
    // Stated plainly, because a half-answered panel must not read as progress
    // toward a working product: nothing here changes generation until it is
    // encoded, and encoding is a separate act.
    note: "Recording a decision does not change what the product generates. Encoding is a separate step.",
  };
}

/**
 * Records an advocate's scope decision against a constraint rule.
 *
 * `scope` is written as the advocate expressed it, in whatever form fits — a
 * list of document types, a description of instrument character, or a condition.
 * It is NOT translated into applies_to_doc_types here: the translation is an
 * engineering act that has to be measured, and a translation made silently at
 * the moment of decision is one nobody checked.
 */
export function recordScopeDecision({
  ruleId,
  decision,
  scope = "",
  authority = "",
  note = "",
  reviewer,
  enrolment = "",
  decidedOn = null,
} = {}) {
  const action = String(decision || "").trim().toLowerCase();
  if (!DECISIONS.has(action)) {
    throw httpError(`decision must be one of: ${[...DECISIONS].join(", ")}`, 400);
  }

  const name = String(reviewer || "").trim();
  if (action !== "reset" && PLACEHOLDER_REVIEWERS.has(name.toLowerCase())) {
    throw httpError("Could not identify the reviewer from the session. Sign in again and retry.", 400);
  }

  // AN ANSWER WITHOUT AN AUTHORITY IS NOT A DECISION. The governance record says
  // so and this is where it binds: a scope recorded with no provision behind it
  // would be indistinguishable from an engineering guess once it is in the file.
  if (action === "decide") {
    if (!String(scope || "").trim()) throw httpError("A decision requires the scope.", 400);
    if (!String(authority || "").trim()) {
      throw httpError(
        "A decision requires the authority relied on. Cite the provision or decision; an answer without an authority cannot be used.",
        400
      );
    }
  }
  if (action === "not_representable" && !String(note || "").trim()) {
    throw httpError(
      "Say what boundary the proposition actually needs. That note is the record of a vocabulary gap, and without it the gap disappears.",
      400
    );
  }

  const found = locateRule(ruleId);
  if (!found) throw httpError(`Unknown rule_id "${ruleId}".`, 404);

  const { file, parsed, index } = found;
  const rule = parsed.rules[index];
  const date = String(decidedOn || "").slice(0, 10) || new Date().toISOString().slice(0, 10);

  if (action === "reset") {
    delete rule.scope_decision;
  } else if (action === "discuss") {
    rule.scope_decision = {
      outcome: "discuss",
      note: String(note || "").trim() || "Flagged for discussion.",
      flagged_by: name,
      flagged_on: date,
      $note: "Not a decision. Recorded so the question is not asked twice.",
    };
  } else {
    rule.scope_decision = {
      outcome: action,
      scope: String(scope || "").trim() || null,
      authority: String(authority || "").trim() || null,
      decided_by: name,
      decided_on: date,
      ...(enrolment ? { enrolment: String(enrolment).trim() } : {}),
      ...(note ? { note: String(note).trim() } : {}),
      $encoding: "RECORDED, NOT ENCODED. The declaration is unchanged and generation is unaffected until an engineer encodes this and re-measures.",
    };
  }

  fs.writeFileSync(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

  // NOTE: no cache is cleared, deliberately. Nothing here alters what the
  // evaluator does, so there is nothing for generation to pick up.
  return {
    rule_id: ruleId,
    decision: action,
    scope_decision: rule.scope_decision || null,
    summary: summariseConstraintScope(),
  };
}
