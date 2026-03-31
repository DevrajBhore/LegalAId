/**
 * illegalClauseValidator.js
 *
 * Detects clauses that are void, illegal, or unenforceable under Indian law.
 * All rules are loaded from:
 *   knowledge-base/rules/illegal_clauses.rules.json
 *
 * To add a new rule or pattern — edit that JSON file. No code changes needed.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load rules from KB ────────────────────────────────────────────────────────

function findRulesFile() {
  const candidates = [
    path.resolve(
      __dirname,
      "../../../../knowledge-base/rules/illegal_clauses.rules.json"
    ),
    path.resolve(
      __dirname,
      "../../../knowledge-base/rules/illegal_clauses.rules.json"
    ),
    path.resolve(
      __dirname,
      "../../../../knowledge-base/knowledge-base/rules/illegal_clauses.rules.json"
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadRules() {
  const rulesFile = findRulesFile();
  if (!rulesFile) {
    console.warn(
      "[IRE] illegal_clauses.rules.json not found — illegal clause validation disabled"
    );
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(rulesFile, "utf8"));
    // Convert pattern strings → RegExp objects
    return (data.rules || []).map((rule) => ({
      ...rule,
      patterns: (rule.patterns || []).map((p) => new RegExp(p, "i")),
    }));
  } catch (err) {
    console.error(
      "[IRE] Failed to load illegal_clauses.rules.json:",
      err.message
    );
    return [];
  }
}

// Cache rules at module load time
const ILLEGAL_RULES = loadRules();

// ── Validator ─────────────────────────────────────────────────────────────────

export function illegalClauseValidate(draft) {
  if (!draft?.clauses) return [];

  const issues = [];

  for (const rule of ILLEGAL_RULES) {
    const offendingClause = draft.clauses.find((clause) => {
      const text = clause.text || "";
      const matched = rule.patterns.some((pattern) => pattern.test(text));
      if (!matched) return false;
      if (isProtectedReference(rule.rule_id, text)) return false;
      return true;
    });

    if (!offendingClause) continue;

    issues.push({
      rule_id: rule.rule_id,
      severity: rule.severity,
      issue: rule.message,
      explanation: `${rule.reference}: ${rule.message}`,
      fix_suggestion: rule.suggestion,
      auto_fixable: rule.severity !== "CRITICAL",
      blocks_generation: rule.blocks_generation ?? true, 
      offending_clause_id: offendingClause?.clause_id || null,
      offending_category: offendingClause?.category || null,
    });
  }

  return issues;
}

function isProtectedReference(ruleId, text = "") {
  const lower = text.toLowerCase();

  if (ruleId === "ICA_S23_UNLAWFUL_OBJECT") {
    return (
      /\bshall not\b/.test(lower) ||
      /\bmay not\b/.test(lower) ||
      /\bnot\b[^.]{0,80}\bunlawful purpose\b/.test(lower) ||
      /\billegal or immoral activity\b/.test(lower) ||
      /\bterminate\b[^.]{0,120}\bunlawful purpose\b/.test(lower)
    );
  }

  return false;
}
