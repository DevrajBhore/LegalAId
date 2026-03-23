/**
 * ruleComparator.js – v2
 *
 * PREVIOUS PROBLEM: switch/case on rule_type used very loose text patterns
 * that fired on almost every document. NUMERIC_THRESHOLD extracted notice
 * periods from TERMINATION/TERM clauses and compared them to statutory
 * thresholds without knowing the unit. PROHIBITION scanned for "waive"
 * anywhere in the document. MANDATORY only checked for "notice/registration/
 * compensation".
 *
 * v2 APPROACH:
 * Rules now carry their own `check(text)` function (compiled in ruleCompiler).
 * compareDraftAgainstRules simply runs each rule's check against the full
 * draft text and reports failures. No switch/case, no loose keyword lists.
 */

export function compareDraftAgainstRules(draft, compiledRules) {

  const issues = [];

  if (!draft?.clauses || !Array.isArray(draft.clauses)) {
    return issues;
  }

  const fullText = draft.clauses
    .map(c => c.text || "")
    .join(" ");

  for (const rule of compiledRules) {

    // Skip rules with no check function
    if (typeof rule.check !== "function") continue;

    // Skip rules scoped to other document types
    if (
      rule.applicableTo &&
      Array.isArray(rule.applicableTo) &&
      !rule.applicableTo.some(t => {
        const ruleType = t.toUpperCase().replace(/[_\s]+/g, "");
        const docType  = (draft.document_type || "").toUpperCase().replace(/[_\s]+/g, "");
        // Match if either contains the other (handles _AGREEMENT suffix)
        return docType.startsWith(ruleType) || ruleType.startsWith(docType) ||
               docType.includes(ruleType)   || ruleType.includes(docType);
      })
    ) continue;

    let passes = false;
    try {
      passes = rule.check(fullText.toLowerCase());
    } catch (err) {
      console.warn(`[IRE] Rule check threw: ${rule.rule_id} – ${err.message}`);
      continue;
    }

    if (!passes && rule.fail_message) {
      issues.push({
        rule_id      : rule.rule_id,
        severity     : rule.severity,
        message      : rule.fail_message,
        statutory_ref: `${rule.act} – Section ${rule.section}`,
        source       : "StatutoryEngine",
      });
    }
  }

  return issues;
}
