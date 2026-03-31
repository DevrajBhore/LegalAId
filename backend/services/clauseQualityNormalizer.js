const ROLE_TERMS = [
  "Client",
  "Service Provider",
  "Consultant",
  "Contractor",
  "Developer",
  "Supplier",
  "Buyer",
  "Distributor",
  "Principal",
  "Lender",
  "Borrower",
  "Landlord",
  "Tenant",
  "Licensor",
  "Licensee",
  "Employer",
  "Employee",
  "Guarantor",
  "Creditor",
  "Principal Debtor",
  "Shareholder",
  "Partner",
  "Party 1",
  "Party 2",
];

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

function normalizeRoleCapitalization(text = "") {
  let result = text;
  for (const role of ROLE_TERMS) {
    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`\\b(the|a|an)\\s+${escaped}\\b`, "gi"),
      (match, article) => `${article.toLowerCase()} ${role}`
    );
    result = result.replace(
      new RegExp(`\\b${escaped}\\b`, "gi"),
      role
    );
  }
  return result;
}

export function normalizeClauseBody(text = "") {
  let value = String(text || "");

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

  value = normalizeRoleCapitalization(value);
  value = value.replace(/(^|[.!?]\s+|\n)([a-z])/g, (match, prefix, letter) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
  return value.trim();
}

export function normalizeClauseTitle(title = "") {
  const normalized = normalizeClauseBody(title);
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

  const normalizedClauses = draft.clauses.map((clause) => ({
    ...clause,
    title: clause.title ? normalizeClauseTitle(clause.title) : clause.title,
    text: normalizeClauseBody(clause.text || ""),
  }));

  return {
    ...draft,
    clauses: removeSupersededClauses(normalizedClauses),
  };
}

export function normalizeSingleClause(clause = {}) {
  return {
    ...clause,
    title: clause.title ? normalizeClauseTitle(clause.title) : clause.title,
    text: normalizeClauseBody(clause.text || ""),
  };
}

export function validateClauseQuality(draft) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return [];
  }

  const issues = [];
  const presentIds = new Set(
    draft.clauses.map((clause) => String(clause?.clause_id || ""))
  );

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
