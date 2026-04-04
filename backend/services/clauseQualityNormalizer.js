import {
  getForbiddenPartyTerms,
  getPartyNamingRule,
} from "./partyNaming.js";

const SUPERSEDED_CLAUSE_RULES = [
  {
    preferred: "SERVICE_TERMINATION_001",
    remove: ["CORE_TERMINATION_001"],
  },
  {
    preferred: "EMPLOYMENT_TERMINATION_001",
    remove: ["CORE_TERMINATION_001"],
  },
  {
    preferred: "RENTAL_TERMINATION_001",
    remove: ["CORE_TERMINATION_001"],
  },
  {
    preferred: "CORE_DISPUTE_RESOLUTION_001",
    remove: ["CORE_ARBITRATION_001"],
  },
];

function normalizeRoleCapitalization(text = "", roleRule = null) {
  if (!roleRule) return text;

  const roleTerms = (roleRule.participants || [])
    .flatMap((participant) => [participant.canonical, ...(participant.aliases || [])])
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  let result = text;
  for (const role of roleTerms) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`\\b(the|a|an)\\s+${escaped}\\b`, "gi"),
      (match, article) => `${article.toLowerCase()} ${role}`
    );
  }
  return result;
}

function replaceRoleAliases(text = "", roleRule = null) {
  if (!roleRule) return text;

  let result = text;
  const aliasEntries = (roleRule.participants || [])
    .flatMap((participant) =>
      (participant.aliases || []).map((alias) => ({
        alias,
        canonical: participant.canonical,
      }))
    )
    .sort((left, right) => right.alias.length - left.alias.length);

  for (const { alias, canonical } of aliasEntries) {

    if (!canonical) continue;

    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "g"), canonical);
  }

  return result;
}

function normalizeGrammar(text = "") {
  return String(text || "")
    .replace(/\s+([)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\b(the|a|an)\s+\1\b/gi, "$1")
    .replace(/\b(shall|must|will|is|are|was|were|has|have)\s+\1\b/gi, "$1")
    .replace(/\b([A-Za-z]+)\s+\1\b/gi, "$1");
}

function findForbiddenRoleTerm(text = "", documentType = "") {
  const terms = getForbiddenPartyTerms(documentType);
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      `\\bthe\\s+${escaped}\\b`,
      `\\b${escaped}\\s+(?:shall|may|must|agrees?|is|are|was|were|has|have|will)\\b`,
      `(?:^|[\\n.;:])\\s*${escaped}\\b`,
      `\\b${escaped}\\s*,\\s*(?:a|an|having|residing|of)\\b`,
      `\\bfor\\s+and\\s+on\\s+behalf\\s+of\\s+${escaped}\\b`,
    ];

    if (patterns.some((pattern) => new RegExp(pattern).test(text))) {
      return term;
    }
  }
  return null;
}

export function normalizeClauseBody(text = "", { documentType } = {}) {
  let value = String(text || "");
  const roleRule = getPartyNamingRule(documentType);

  value = value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ");

  value = value.replace(/\.{2,}/g, ".");
  value = value.replace(/\.\s+(and|or)\b/gi, ", $1");
  value = value.replace(/([,;:!?])\1+/g, "$1");
  value = value.replace(/\s+([,;:.!?])/g, "$1");
  value = value.replace(/([,;:.!?])(?![\s"')\]])/g, "$1 ");
  value = value.replace(/[ \t]{2,}/g, " ");
  value = value.replace(/\n{3,}/g, "\n\n");

  value = replaceRoleAliases(value, roleRule);
  value = normalizeGrammar(value);
  value = normalizeRoleCapitalization(value, roleRule);
  value = value.replace(/(^|[.!?]\s+|\n)([a-z])/g, (match, prefix, letter) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
  return value.trim();
}

export function normalizeClauseTitle(title = "", { documentType } = {}) {
  const normalized = normalizeClauseBody(title, { documentType });
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function removeSupersededClauses(clauses = []) {
  const presentIds = new Set(clauses.map((clause) => String(clause.clause_id || "")));
  const suppressedIds = new Set();

  for (const rule of SUPERSEDED_CLAUSE_RULES) {
    if (!presentIds.has(rule.preferred)) continue;
    for (const clauseId of rule.remove) {
      suppressedIds.add(clauseId);
    }
  }

  return clauses.filter(
    (clause) => !suppressedIds.has(String(clause.clause_id || ""))
  );
}

function buildIssue(ruleId, severity, message, suggestion, clauseId = null) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    offending_clause_id: clauseId,
    blocks_generation: true,
  };
}

export function normalizeClauseText(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  const documentType = draft.document_type || draft.metadata?.document_type;

  const normalizedClauses = draft.clauses.map((clause) => ({
    ...clause,
    title: clause.title
      ? normalizeClauseTitle(clause.title, { documentType })
      : clause.title,
    text: normalizeClauseBody(clause.text || "", { documentType }),
  }));

  return {
    ...draft,
    clauses: removeSupersededClauses(normalizedClauses),
  };
}

export function normalizeSingleClause(clause = {}, { documentType } = {}) {
  return {
    ...clause,
    title: clause.title
      ? normalizeClauseTitle(clause.title, { documentType })
      : clause.title,
    text: normalizeClauseBody(clause.text || "", { documentType }),
  };
}

export function validateClauseQuality(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return [];
  }

  const issues = [];
  const documentType = draft.document_type || draft.metadata?.document_type;
  const namingRule = getPartyNamingRule(documentType);
  const presentIds = new Set(
    draft.clauses.map((clause) => String(clause?.clause_id || ""))
  );
  const canonicalLabels = (namingRule?.participants || []).map(
    (participant) => participant.canonical
  );
  const canonicalText =
    canonicalLabels.length > 0
      ? canonicalLabels.map((label) => `"${label}"`).join(", ")
      : '"Party 1", "Party 2"';

  for (const clause of draft.clauses) {
    const clauseId = clause?.clause_id || null;
    const text = String(clause?.text || "").trim();

    if (text && /^[a-z]/.test(text)) {
      issues.push(
        buildIssue(
          "CLAUSE_TEXT_LOWERCASE_START",
          "HIGH",
          `Clause "${clauseId}" begins with a lowercase letter instead of formal sentence case.`,
          "Normalize clause text so each clause begins with a properly capitalized sentence.",
          clauseId
        )
      );
    }

    if (/\.{2,}|([,;:!?])\1+/.test(text)) {
      issues.push(
        buildIssue(
          "CLAUSE_TEXT_REPEATED_PUNCTUATION",
          "HIGH",
          `Clause "${clauseId}" contains repeated punctuation or malformed sentence endings.`,
          "Remove repeated punctuation and normalize punctuation spacing before the draft is returned.",
          clauseId
        )
      );
    }

    const forbiddenTerm = namingRule
      ? findForbiddenRoleTerm(`${clause?.title || ""} ${text}`, documentType)
      : null;
    if (forbiddenTerm) {
      issues.push(
        buildIssue(
          "PARTY_NAMING_INCONSISTENCY",
          "CRITICAL",
          `Clause "${clauseId}" uses the conflicting role label "${forbiddenTerm}" even though this document should consistently use ${canonicalText}.`,
          `Rewrite the clause so it consistently uses ${canonicalText} throughout the document.`,
          clauseId
        )
      );
    }
  }

  for (const rule of SUPERSEDED_CLAUSE_RULES) {
    if (!presentIds.has(rule.preferred)) continue;
    const overlapping = rule.remove.filter((clauseId) => presentIds.has(clauseId));
    if (!overlapping.length) continue;
    issues.push(
      buildIssue(
        "OVERLAPPING_CLAUSE_SECTIONS",
        "CRITICAL",
        `The draft contains overlapping clause sections (${[rule.preferred, ...overlapping].join(
          ", "
        )}) that should not appear together.`,
        "Keep the document-specific clause and remove the redundant generic clause before returning the draft."
      )
    );
  }

  return issues;
}
