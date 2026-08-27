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

// Some statutory defined terms contain a word that is elsewhere a party role.
// "Data Principal" is the Digital Personal Data Protection Act, 2023 term for the
// individual whose data is processed; it is not the agency role "Principal", and
// the individual is not a party to the agreement at all. Left unmasked, the
// role-consistency check reads "the Data Principal has withdrawn consent" as a
// stray "Principal" and refuses the draft as CRITICAL.
const STATUTORY_COMPOUND_TERMS = [
  /\bData\s+Principals?\b/gi,
  /\bPrincipal\s+Debtors?\b/gi,
  /\bPrincipal\s+Amounts?\b/gi,
  /\bPrincipal\s+Place\s+of\s+Business\b/gi,
];

function maskStatutoryCompoundTerms(text = "") {
  let value = String(text);
  for (const rx of STATUTORY_COMPOUND_TERMS) value = value.replace(rx, "\u0000defined-term\u0000");
  return value;
}

function findForbiddenRoleTerm(rawText = "", documentType = "") {
  const text = maskStatutoryCompoundTerms(rawText);
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

/**
 * A URL or an email address is not prose, and the normalisation rules below
 * mangle it: the punctuation-spacing rule opens "https:" into "https: " and
 * splits "alpha.example" into "alpha. example", and the sentence-capitalisation
 * rule then turns that into "Example". The result shipped in every privacy
 * policy, terms of service, refund policy and data processing agreement --
 * "https: //alpha. Example", "contact@alpha. Example" -- so the one contact
 * route a consumer is entitled to use was broken in the document.
 *
 * Guarding each rule with another lookahead does not hold: the next rule added
 * to this pipeline would break it again. The addresses are masked out of the
 * text before any rule runs and restored afterwards, so no rule can see them.
 */
const WEB_ADDRESS = new RegExp(
  [
    "https?://[^\\s<>\"')\\]]+",                 // scheme-qualified URL
    "www\\.[^\\s<>\"')\\]]+",                   // bare www host
    "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", // email address
  ].join("|"),
  "g"
);

function maskWebAddresses(text) {
  const held = [];
  const masked = String(text).replace(WEB_ADDRESS, (match) => {
    // A trailing stop belongs to the sentence, not to the address.
    const trailing = match.match(/[.,;:!?)\]]+$/);
    const core = trailing ? match.slice(0, -trailing[0].length) : match;
    held.push(core);
    return `\u0000W${held.length - 1}\u0000${trailing ? trailing[0] : ""}`;
  });
  return { masked, held };
}

function restoreWebAddresses(text, held) {
  return String(text).replace(/\u0000W(\d+)\u0000/g, (_, i) => held[Number(i)] ?? "");
}

export function normalizeClauseBody(text = "", { documentType } = {}) {
  let value = String(text || "");
  const roleRule = getPartyNamingRule(documentType);

  // Hold every URL and email aside for the duration of this function.
  const { masked, held } = maskWebAddresses(value);
  value = masked;

  value = value
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ");

  value = value.replace(/\.{2,}/g, ".");
  // Join a stray full stop before a conjunction ("...the instrument. and the")
  // into a comma. Requires at least TWO letters before the stop, so a lettered
  // recital label is left alone: this rule was rewriting "B. AND WHEREAS" as
  // "B, AND WHEREAS" in every deed that used lettered recitals.
  value = value.replace(/(^|[^A-Za-z])([A-Za-z]{2,})\.\s+(and|or)\b/gi, "$1$2, $3");
  value = value.replace(/([,;:!?])\1+/g, "$1");
  value = value.replace(/\s+([,;:.!?])/g, "$1");
  // Insert a space after punctuation that runs straight into the next word, but
  // never when a digit follows. Without that guard this rule rewrote every
  // Indian-format amount ("30,000" -> "30, 000"), every numeric date
  // ("21.08.2026" -> "21. 08. 2026"), every decimal ("1.5%" -> "1. 5%") and
  // every short statutory citation ("s.74" -> "s. 74").
  value = value.replace(/([,;:.!?])(?![\s"')\]\d])/g, (match, mark, offset, source) => {
    // "5:00 p.m." and "e.g." are single-letter abbreviations, not two sentences:
    // the stop belongs to the abbreviation and must not be opened up into
    // "5:00 p. m.". Same guard as the one that protects "30,000" and "s.74".
    if (
      mark === "." &&
      /(?:^|[^A-Za-z])[A-Za-z]$/.test(source.slice(0, offset)) &&
      /^[A-Za-z]\./.test(source.slice(offset + 1))
    ) {
      return match;
    }
    return `${mark} `;
  });
  value = value.replace(/[ \t]{2,}/g, " ");
  value = value.replace(/\n{3,}/g, "\n\n");

  value = replaceRoleAliases(value, roleRule);
  value = normalizeGrammar(value);
  value = normalizeRoleCapitalization(value, roleRule);
  // Capitalise the opening of a sentence, but never a lone list letter: recitals
  // are lettered "a." / "b." / "c.", and this rule was rewriting them to "A." on
  // the way to the renderer, undoing the lettering the drafting convention asks
  // for. A single letter followed by a stop or bracket is a marker, not a word.
  value = value.replace(/(^|[.!?]\s+|\n)([a-z])(?![.)]\s)/g, (match, prefix, letter) => {
    return `${prefix}${letter.toUpperCase()}`;
  });
  return restoreWebAddresses(value, held).trim();
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
