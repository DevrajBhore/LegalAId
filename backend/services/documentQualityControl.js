import { getVariables } from "../config/variableConfig.js";
import { getForbiddenPartyTerms, getParticipantExpectations } from "./draftingPolicy.js";
import {
  formatFormalDate,
  formatIndianAmount,
  normalizeCurrencyText,
  parseNumberish,
} from "./formattingEngine.js";
import { hasMeaningfulValue, isAffirmative } from "./generationControls.js";
import { partyNameAppears } from "./partyNameMatcher.js";

const INTERNAL_NOTE_PATTERN =
  /\b(TODO|FIXME|\?\?\?|Reviewer Notes?|Draft Comments?|Internal Notes?)\b/i;
const PLACEHOLDER_PATTERN =
  /{{[^}]+}}|<<[^>]+>>|\[[A-Z0-9_]{2,}\]|_{4,}|(?:PAN|GST|GSTIN|CIN|LLPIN)\s*_+/i;

const OPTIONAL_PROTECTION_CLAUSES = new Map([
  ["NDA_NON_COMPETE_001", "include_non_compete"],
  ["EMP_NON_COMPETE_001", "include_non_compete"],
  ["NDA_NON_SOLICITATION_001", "include_non_solicit"],
  ["EMP_NON_SOLICITATION_001", "include_non_solicit"],
  ["SERVICE_SLA_001", "include_sla"],
]);

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIssue(ruleId, severity, message, suggestion, clauseId = null) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    offending_clause_id: clauseId,
    blocks_generation: severity === "CRITICAL",
    auto_fixable: false,
  };
}

function stripInternalNotes(text = "") {
  return String(text || "")
    .split(/\r?\n/)
    .filter((line) => !INTERNAL_NOTE_PATTERN.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeEffectiveDateDefinitions(text = "", variables = {}) {
  if (!hasMeaningfulValue(variables.effective_date)) return text;
  const effectiveDate = formatFormalDate(variables.effective_date);
  const definition = `"Effective Date" means ${effectiveDate}.`;

  return String(text || "")
    .replace(/"?Effective Date"?\s+means\s+[^.;\n]+[.;]?/gi, definition)
    .replace(/on\s+[^.;\n]+?\s+\(the\s+"Effective Date"\)/i, `on ${effectiveDate} (the "Effective Date")`);
}

function shouldRemoveOptionalProtection(clause, variables = {}) {
  const clauseId = String(clause?.clause_id || "");
  const control = OPTIONAL_PROTECTION_CLAUSES.get(clauseId);
  if (!control) return false;

  if (control === "include_sla") {
    return !isAffirmative(variables.include_sla) && !hasMeaningfulValue(variables.service_levels);
  }

  return !isAffirmative(variables[control]);
}

function applyConditionalClauseResolution(clauses = [], documentType, variables = {}) {
  return clauses.filter((clause) => {
    if (shouldRemoveOptionalProtection(clause, variables)) return false;

    const clauseId = String(clause?.clause_id || "");
    const guaranteeType = normalizeText(variables.guarantee_type);
    if (
      documentType === "GUARANTEE_AGREEMENT" &&
      guaranteeType.includes("continuing") &&
      /specific/i.test(`${clauseId} ${clause?.title || ""}`)
    ) {
      return false;
    }

    if (
      documentType === "GUARANTEE_AGREEMENT" &&
      !guaranteeType.includes("continuing") &&
      clauseId === "GUARANTEE_CONTINUING_001"
    ) {
      return true;
    }

    return true;
  });
}

function normalizeClauseText(clause, variables = {}) {
  const text = normalizeCurrencyText(
    normalizeEffectiveDateDefinitions(stripInternalNotes(clause.text || ""), variables),
    { includeWords: true }
  );

  return {
    ...clause,
    text,
  };
}

function scoreClause(clause = {}) {
  const text = String(clause.text || "");
  let score = text.length;
  if (/\n\([a-z]\)/i.test(text)) score += 200;
  if (/\bshall\b/i.test(text)) score += 50;
  if (PLACEHOLDER_PATTERN.test(text)) score -= 1000;
  if (INTERNAL_NOTE_PATTERN.test(text)) score -= 1000;
  return score;
}

function dedupeClauses(clauses = []) {
  const bestByKey = new Map();
  const order = [];

  clauses.forEach((clause, index) => {
    const titleKey = normalizeText(clause.title || clause.name || clause.clause_id);
    const textKey = normalizeText(clause.text || "").slice(0, 220);
    const key = titleKey || clause.clause_id || textKey;
    const semanticKey = `${titleKey}:${textKey.slice(0, 80)}`;

    for (const candidateKey of [key, semanticKey]) {
      if (!bestByKey.has(candidateKey)) {
        bestByKey.set(candidateKey, { clause, index });
        order.push(candidateKey);
        return;
      }

      const current = bestByKey.get(candidateKey);
      if (scoreClause(clause) > scoreClause(current.clause)) {
        bestByKey.set(candidateKey, { clause, index: current.index });
      }
      return;
    }
  });

  return order
    .map((key) => bestByKey.get(key))
    .filter(Boolean)
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.clause);
}

function normalizeLiabilityCap(clauses = [], variables = {}) {
  const amount = parseNumberish(variables.liability_cap_amount);
  const basis = normalizeText(variables.liability_cap_basis);
  if (amount === null || !basis.includes("specific amount")) return clauses;

  return clauses.map((clause) => {
    if (String(clause.clause_id || "") !== "CORE_LIABILITY_CAP_001") return clause;
    return {
      ...clause,
      title: clause.title || "Limitation of Liability",
      text: `Except for fraud, wilful misconduct, confidentiality breach, indemnity obligations, payment obligations, or liabilities that cannot be limited under applicable law, the aggregate liability of either Party under this Agreement shall not exceed ${formatIndianAmount(amount, { includeWords: true })}.`,
    };
  });
}

export function applyDocumentQualityControls(draft, input = {}) {
  if (!draft || !Array.isArray(draft.clauses)) return draft;
  const documentType = input.document_type || draft.document_type;
  const variables = input.variables || draft.metadata?.source_variables || {};
  let clauses = applyConditionalClauseResolution(draft.clauses, documentType, variables)
    .map((clause) => normalizeClauseText(clause, variables));
  clauses = normalizeLiabilityCap(clauses, variables);
  clauses = dedupeClauses(clauses);

  return {
    ...draft,
    clauses,
    metadata: {
      ...(draft.metadata || {}),
      quality_controls_applied: true,
    },
  };
}

function collectFullText(draft) {
  return (draft?.clauses || [])
    .map((clause) => `${clause.title || ""}\n${clause.text || ""}`)
    .join("\n\n");
}

function findDuplicateClauseIssues(draft) {
  const seen = new Map();
  const issues = [];

  for (const clause of draft?.clauses || []) {
    const key = normalizeText(clause.title || clause.clause_id || "");
    if (!key) continue;
    if (seen.has(key)) {
      issues.push(
        buildIssue(
          "FORMAT_DUPLICATE_CLAUSE",
          "HIGH",
          `Duplicate clause heading detected: "${clause.title || clause.clause_id}".`,
          "Keep the best single version of the clause and remove the repeated clause.",
          clause.clause_id
        )
      );
    }
    seen.set(key, clause);
  }

  return issues;
}

function findDuplicateDefinitionIssues(draft) {
  const definitionCounts = new Map();
  for (const clause of draft?.clauses || []) {
    const text = clause.text || "";
    for (const match of text.matchAll(/"([^"]{2,80})"\s+means\b/gi)) {
      const key = normalizeText(match[1]);
      definitionCounts.set(key, (definitionCounts.get(key) || 0) + 1);
    }
  }

  return [...definitionCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([term]) =>
      buildIssue(
        `FORMAT_DUPLICATE_DEFINITION_${term.toUpperCase().replace(/\s+/g, "_")}`,
        "HIGH",
        `The defined term "${term}" is defined more than once.`,
        "Keep a single definition and use cross-references for later mentions."
      )
    );
}

function findPlaceholderIssues(draft) {
  return (draft?.clauses || [])
    .filter((clause) => {
      const clauseId = String(clause.clause_id || "");
      const category = String(clause.category || "");
      return clauseId !== "CORE_SIGNATURE_BLOCK_001" && category !== "SIGNATURE_BLOCK";
    })
    .filter((clause) => PLACEHOLDER_PATTERN.test(clause.text || ""))
    .map((clause) =>
      buildIssue(
        "FORMAT_UNRESOLVED_PLACEHOLDER",
        "CRITICAL",
        `Clause "${clause.title || clause.clause_id}" contains an unresolved placeholder or blank identifier.`,
        "Fill the missing form value or remove the placeholder before export.",
        clause.clause_id
      )
    );
}

function findCurrencyIssues(draft) {
  return (draft?.clauses || [])
    .filter((clause) => /(?:\u20b9|\u00b9|â‚¹)\s*\d[\d,]*\s+,\s*\d/.test(clause.text || ""))
    .map((clause) =>
      buildIssue(
        "FORMAT_INVALID_CURRENCY",
        "HIGH",
        `Clause "${clause.title || clause.clause_id}" contains malformed Indian currency formatting.`,
        "Render amounts as compact Indian Rupee amounts, for example \u20b92,00,000 (Rupees Two Lakh Only).",
        clause.clause_id
      )
    );
}

// A forbidden party term is only a real defect when the draft uses it as a
// PARTY LABEL — i.e. the capitalized role noun in label context ("the Employee",
// `"Employee"`, "Employee shall…", "(the "Employee")"). The same word appearing
// lowercase as an ordinary noun — e.g. "...customer, vendor, employee, and other
// information..." inside an NDA's confidential-information scope — is not a party
// label and must not be flagged. Matching case-sensitively on the capitalized
// form in label context removes that false positive.
function usesTermAsPartyLabel(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const labelContext = new RegExp(
    // quoted label, or preceded by an article/quantifier, or followed by an
    // operative verb / possessive that only a party label would take.
    `(?:"\\s*${escaped}\\s*"` +
      `|\\b(?:the|each|any|such|said|a|an)\\s+${escaped}\\b` +
      `|\\b${escaped}\\b\\s+(?:shall|agrees?|hereby|represents?|warrants?|undertakes?|acknowledges?|covenants?|may|must|will|is|are|'s|s')` +
      `)`,
    // case-sensitive: the genuine party label is always the capitalized role noun.
    ""
  );
  return labelContext.test(text);
}

function findPartyReferenceIssues(draft, documentType, variables = {}) {
  const text = collectFullText(draft);
  const issues = [];
  const forbidden = getForbiddenPartyTerms(documentType);
  for (const term of forbidden) {
    if (usesTermAsPartyLabel(text, term)) {
      issues.push(
        buildIssue(
          `FORMAT_FORBIDDEN_PARTY_TERM_${normalizeText(term).toUpperCase().replace(/\s+/g, "_")}`,
          "HIGH",
          `The draft mixes party label "${term}" with the required document-specific party labels.`,
          "Use one consistent set of role labels throughout the document."
        )
      );
    }
  }

  for (const participant of getParticipantExpectations(documentType, variables)) {
    if (participant.name && !partyNameAppears(text, participant.name)) {
      issues.push(
        buildIssue(
          `FORMAT_MISSING_PARTY_${participant.id.toUpperCase()}`,
          "CRITICAL",
          `${participant.label} name is missing from the final draft.`,
          "Regenerate the identity and signature blocks using the submitted party details."
        )
      );
    }
  }

  return issues;
}

function findCrossReferenceIssues(draft) {
  const text = collectFullText(draft);
  const headings = new Set(
    (draft?.clauses || [])
      .map((clause, index) => String(index + 1))
      .filter(Boolean)
  );

  const issues = [];
  for (const match of text.matchAll(/\bClause\s+(\d{1,2})(?:\.\d+)?\b/gi)) {
    if (!headings.has(match[1])) {
      issues.push(
        buildIssue(
          "FORMAT_BROKEN_CROSS_REFERENCE",
          "MEDIUM",
          `The draft refers to Clause ${match[1]}, but that clause number is not present in the generated structure.`,
          "Update the cross-reference or regenerate numbering before export."
        )
      );
    }
  }
  return issues;
}

function findMissingRequiredFieldIssues(draft, documentType, variables = {}) {
  const schema = getVariables(documentType);
  const fullText = collectFullText(draft);

  return Object.entries(variables)
    .filter(([fieldName, value]) => schema[fieldName] && hasMeaningfulValue(value))
    .filter(([fieldName]) => /_(pan|gstin|cin|llpin)$/.test(fieldName))
    .filter(([fieldName, value]) => {
      if (/include_|_basis$|_type$|_option$|_method$/.test(fieldName)) return false;
      const digits = String(value).replace(/\D+/g, "");
      if (digits && fullText.replace(/\D+/g, "").includes(digits)) return false;
      return !normalizeText(fullText).includes(normalizeText(value));
    })
    .slice(0, 12)
    .map(([fieldName, value]) =>
      buildIssue(
        `FORM_VALUE_NOT_REFLECTED_${fieldName.toUpperCase()}`,
        "HIGH",
        `The submitted form value for "${fieldName}" is not clearly reflected in the final draft.`,
        `Ensure the final draft incorporates "${value}" in the appropriate clause.`
      )
    );
}

export function validateDocumentQuality(draft, { documentType, variables = {} } = {}) {
  if (!draft?.clauses?.length || !documentType) return [];

  return [
    ...findDuplicateClauseIssues(draft),
    ...findDuplicateDefinitionIssues(draft),
    ...findPlaceholderIssues(draft),
    ...findCurrencyIssues(draft),
    ...findPartyReferenceIssues(draft, documentType, variables),
    ...findCrossReferenceIssues(draft),
    ...findMissingRequiredFieldIssues(draft, documentType, variables),
  ];
}
