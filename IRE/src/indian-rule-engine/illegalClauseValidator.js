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

// A rule pattern like "penalty.*entire.*contract.*value" is written to mean
// "these words, near each other". Compiled literally, `.*` is unbounded and
// greedy, so the three gaps can span an entire clause and the rule fires on
// words that have nothing to do with one another. That is not hypothetical:
// "not.*employ.*women" matched "Not fewer than two members are drawn from among
// the employees, preferably committed to the cause of women" -- a sentence
// constituting a PoSH committee -- and, being CRITICAL and blocks_generation,
// refused to produce the document at all.
//
// Each `.*` is therefore compiled to a bounded window that also refuses to cross
// a sentence boundary, which is what the pattern author meant by "near".
const NEAR_WINDOW = 80;
const NEAR = `(?:(?!\\.\\s+[A-Z])[\\s\\S]){0,${NEAR_WINDOW}}`;

export function compilePattern(pattern) {
  return new RegExp(String(pattern).split(".*").join(NEAR), "i");
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
    return (data.rules || []).map((rule) => ({
      ...rule,
      patterns: (rule.patterns || []).map(compilePattern),
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

  // A clause that affirmatively requires Competition Act compliance, or disclaims
  // resale-price-maintenance / foreclosure, is the OPPOSITE of an anti-competitive
  // agreement — the over-broad price/compete patterns must not flag it.
  if (ruleId === "COMPETITION_ACT_VIOLATION") {
    return (
      /\bcomply with the competition act\b/.test(lower) ||
      /\bcompetition act,? 2002\b/.test(lower) ||
      /\bnot\b[^.]{0,80}\bresale price maintenance\b/.test(lower) ||
      /\bfree to determine its own resale price\b/.test(lower) ||
      /\bappreciable adverse effect on competition\b/.test(lower)
    );
  }

  // A clause implementing the PoSH Act, or covenanting against discrimination,
  // is the OPPOSITE of a discriminatory clause. Its vocabulary is necessarily
  // the vocabulary the patterns look for -- women, sex, gender, employment --
  // so without this the product cannot generate the very policy the law
  // requires employers to adopt.
  if (ruleId === "DISCRIMINATION_PROHIBITED") {
    return (
      /\bsexual harassment of women at workplace\b/.test(lower) ||
      /\bposh\b/.test(lower) ||
      /\binternal committee\b/.test(lower) ||
      /\blocal committee\b/.test(lower) ||
      /\baggrieved woman\b/.test(lower) ||
      /\bshall not discriminate\b/.test(lower) ||
      /\bwithout discrimination\b/.test(lower) ||
      /\bequal (?:pay|remuneration|opportunit)/.test(lower) ||
      /\bmaternity benefit\b/.test(lower) ||
      /\bcause of women\b/.test(lower)
    );
  }

  return false;
}
