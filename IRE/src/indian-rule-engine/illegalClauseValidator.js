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
  const fullText = draft.clauses.map((c) => c.text || "").join("\n");

  for (const rule of ILLEGAL_RULES) {
    const matched = rule.patterns.find((p) => p.test(fullText));
    if (!matched) continue;

    const offendingClause = draft.clauses.find((c) =>
      rule.patterns.some((p) => p.test(c.text || ""))
    );

    issues.push({
      rule_id: rule.rule_id,
      severity: rule.severity,
      message: rule.message,
      statutory_reference: rule.reference,
      suggestion: rule.suggestion,
      blocks_generation: rule.blocks_generation ?? true, // default safe: block if not specified
      offending_clause_id: offendingClause?.clause_id || null,
      offending_category: offendingClause?.category || null,
    });
  }

  return issues;
}
