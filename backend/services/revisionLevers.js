/**
 * revisionLevers.js
 *
 * The concept→variable reverse map for the revision loop. The pipeline only runs
 * forward (variable → flag → clause); this derives the inverse PURELY from
 * blueprint data (the same blueprint the assembler uses), so a revision request
 * ("drop the indemnity", "stricter confidentiality") can be resolved to the
 * variable lever that drives it — never a direct clause edit.
 *
 * Two lever kinds, both reducing to a variable assignment:
 *  - toggle_clause: a conditional clause gated by `include_if: "<flag> == <v>"`.
 *    The flag's explicit same-named variable is the lever (deriveGenerationControls
 *    honours the explicit variable first), so setting it includes/excludes the clause.
 *  - set_variant: a variant slot whose options are `when: "<variable> == <value>"`.
 *    Setting that variable to an option's value selects the matching variant.
 *
 * Required (non-conditional, non-variant) clauses are reported separately: they
 * cannot be removed by a revision, so "drop it" is unsatisfiable, not a no-op.
 */
import { getBlueprintForDocumentType } from "./clauseAssembler.js";

// Parse "<variable> == <value>" (value may be true/false, quoted, or a bareword).
function parseEquality(expr) {
  const match = String(expr || "").match(
    /^\s*([a-z][a-z0-9_]+)\s*==\s*('[^']*'|"[^"]*"|[A-Za-z0-9_]+)\s*$/
  );
  if (!match) return null;
  const variable = match[1];
  const value = match[2].replace(/^['"]|['"]$/g, "");
  return { variable, value };
}

function humanize(token = "") {
  return String(token).replace(/_/g, " ").replace(/_?\d+$/, "").trim();
}

// A short human concept label so the classifier can match user words to a lever.
function conceptFromClause(clauseId = "", note = "") {
  const base = String(clauseId)
    .replace(/^(CORE|SERVICE|EMPLOYMENT|NDA|LOAN|GUARANTEE|SUPPLY|DIST|JV|MOU|IP|CORP)_/i, "")
    .replace(/_\d+$/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .trim();
  return base || humanize(clauseId);
}

function clauseIdOf(entry) {
  return typeof entry === "string" ? entry : entry?.clause || entry?.clause_id || null;
}

/**
 * @returns {{
 *   levers: Array<object>,          // toggle_clause + set_variant levers
 *   requiredClauseIds: string[],    // structurally required → cannot be removed
 *   conditionalClauseIds: string[],
 *   variantClauseIds: string[],
 * }}
 */
export function buildConceptLeverMap(documentType) {
  const blueprint = getBlueprintForDocumentType(documentType);
  if (!blueprint) {
    return { levers: [], requiredClauseIds: [], conditionalClauseIds: [], variantClauseIds: [] };
  }

  const levers = [];
  const conditionalClauseIds = new Set();
  const variantClauseIds = new Set();

  // Conditional clauses → toggle the gating flag (explicit same-named variable).
  for (const entry of blueprint.conditional_clauses || []) {
    const clauseId = entry?.clause;
    const parsed = parseEquality(entry?.include_if);
    if (!clauseId || !parsed) continue;
    conditionalClauseIds.add(clauseId);
    levers.push({
      kind: "toggle_clause",
      clause_id: clauseId,
      concept: conceptFromClause(clauseId, entry.note),
      note: entry.note || "",
      variable: parsed.variable,
      // The value that INCLUDES the clause, and its inverse to drop it.
      include_value: parsed.value,
      exclude_value: parsed.value === "true" ? "false" : "true",
    });
  }

  // Variant clauses → set the slot variable to an option's value.
  for (const slot of blueprint.variant_clauses || []) {
    const options = [];
    let variable = null;
    for (const match of slot.select_first_match || []) {
      const parsed = parseEquality(match?.when);
      if (!parsed || !match?.clause) continue;
      variable = variable || parsed.variable;
      options.push({ clause_id: match.clause, value: parsed.value });
      variantClauseIds.add(match.clause);
    }
    if (slot.default) variantClauseIds.add(slot.default);
    if (!variable || options.length === 0) continue;
    levers.push({
      kind: "set_variant",
      slot: slot.slot || null,
      concept: humanize(slot.slot || variable),
      note: slot.note || "",
      replaces: slot.replaces || null,
      variable,
      options, // [{ clause_id, value }]
      default_clause_id: slot.default || null,
    });
  }

  // Required = listed clauses that are neither conditional nor variant-managed.
  const requiredClauseIds = (blueprint.required_clauses || blueprint.clauses || [])
    .map(clauseIdOf)
    .filter(Boolean)
    .filter((id) => !conditionalClauseIds.has(id) && !variantClauseIds.has(id));

  return {
    levers,
    requiredClauseIds,
    conditionalClauseIds: [...conditionalClauseIds],
    variantClauseIds: [...variantClauseIds],
  };
}
