import { callAISafetyRaw } from "../../../backend/ai/aiClient.js";

const LEGAL_CATEGORIES = [
  {
    id: "BONDED_LABOUR",
    statute: "Bonded Labour System (Abolition) Act 1976 S.4",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "CHILD_LABOUR",
    statute: "Child Labour (Prohibition and Regulation) Act 1986 S.3",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "DISCRIMINATION",
    statute: "Constitution Art.15; Equal Remuneration Act 1976 S.4",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "OUSTER_OF_COURTS",
    statute: "Indian Contract Act 1872 S.28",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "UNLAWFUL_OBJECT",
    statute: "Indian Contract Act 1872 S.23",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "PERPETUAL_NON_COMPETE",
    statute: "Indian Contract Act 1872 S.27",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "PRICE_FIXING",
    statute: "Competition Act 2002 S.3",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "INSIDER_TRADING",
    statute: "SEBI (Prohibition of Insider Trading) Regulations 2015",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "FUNDAMENTAL_RIGHTS_WAIVER",
    statute: "Constitution of India Art.13",
    severity: "CRITICAL",
    blocks_generation: true,
  },
  {
    id: "USURIOUS_INTEREST",
    statute: "Usurious Loans Act 1918 S.3",
    severity: "HIGH",
    blocks_generation: false,
  },
  {
    id: "EXCESSIVE_PENALTY",
    statute: "Indian Contract Act 1872 S.74",
    severity: "HIGH",
    blocks_generation: false,
  },
  {
    id: "FEMA_VIOLATION",
    statute: "Foreign Exchange Management Act 1999 S.3",
    severity: "HIGH",
    blocks_generation: false,
  },
  {
    id: "NON_LEGAL_TEXT",
    statute: "Indian Contract Act 1872 S.23",
    severity: "CRITICAL",
    blocks_generation: true,
  },
];

const CATEGORY_MAP = Object.fromEntries(LEGAL_CATEGORIES.map((c) => [c.id, c]));
const REPEATED_CHARACTER_TOKEN_PATTERN = /\b([a-zA-Z]{3,})\b/g;
const CLAUSE_TAMPER_WORD_LIMIT = 8;
const INTEGRITY_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["integrity_failures"],
  properties: {
    integrity_failures: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["clause_id", "reason"],
        properties: {
          clause_id: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};
const LEGAL_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["violations"],
  properties: {
    violations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category_id", "clause_id", "confidence", "explanation"],
        properties: {
          category_id: { type: "string" },
          clause_id: { type: "string" },
          confidence: { type: "string", enum: ["HIGH", "MEDIUM"] },
          explanation: { type: "string" },
        },
      },
    },
  },
};

function normalizeComparableText(text = "") {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getBaselineClauseMap(draft) {
  return draft?.metadata?.baseline_clause_map || {};
}

function getRelevantClauses(draft) {
  const baselineMap = getBaselineClauseMap(draft);
  const clauses = (draft?.clauses || []).filter(
    (clause) => clause?.category !== "SIGNATURE_BLOCK"
  );

  if (!Object.keys(baselineMap).length) {
    return clauses;
  }

  const changedClauses = clauses.filter((clause) => {
    const baseline = baselineMap?.[clause.clause_id];
    if (!baseline) return true;
    return normalizeComparableText(clause.text) !== normalizeComparableText(baseline.text);
  });

  return changedClauses.length ? changedClauses : clauses;
}

function firstAlphabeticCharacter(text = "") {
  const match = String(text).match(/[A-Za-z]/);
  return match ? match[0] : null;
}

function collectRepeatedCharacterToken(text = "") {
  const matches = String(text).matchAll(REPEATED_CHARACTER_TOKEN_PATTERN);
  for (const match of matches) {
    const token = match[1];
    if (/(.)\1{2,}/i.test(token)) {
      return token;
    }
  }
  return null;
}

function extractContiguousChange(previous = "", current = "") {
  if (previous === current) {
    return null;
  }

  let start = 0;
  while (
    start < previous.length &&
    start < current.length &&
    previous[start] === current[start]
  ) {
    start += 1;
  }

  let previousEnd = previous.length - 1;
  let currentEnd = current.length - 1;
  while (
    previousEnd >= start &&
    currentEnd >= start &&
    previous[previousEnd] === current[currentEnd]
  ) {
    previousEnd -= 1;
    currentEnd -= 1;
  }

  return {
    start,
    removed: previous.slice(start, previousEnd + 1),
    added: current.slice(start, currentEnd + 1),
    previousLength: previous.length,
    currentLength: current.length,
  };
}

function describeFragment(fragment = "") {
  const compact = normalizeComparableText(fragment);
  if (!compact) return "a suspicious inserted fragment";
  return `"${compact.slice(0, 80)}${compact.length > 80 ? "..." : ""}"`;
}

function looksLikeStandaloneTamper(fragment = "", change = {}) {
  const compact = normalizeComparableText(fragment);
  if (!compact) return false;
  if (normalizeComparableText(change.removed)) return false;
  if (compact.length > 60) return false;
  if (/[0-9]/.test(compact)) return false;
  if (/[.;:]/.test(compact)) return false;

  const words = compact.match(/[A-Za-z]+/g) || [];
  if (!words.length || words.length > CLAUSE_TAMPER_WORD_LIMIT) return false;

  const allLowercase = words.every((word) => word === word.toLowerCase());
  const boundaryInsert =
    change.start === 0 ||
    change.start === change.previousLength ||
    /^[\s"'([{_-]*$/.test(change.removed || "");

  return allLowercase && boundaryInsert;
}

function detectDeterministicIntegrityFailures(clauses = [], baselineMap = {}) {
  const failures = [];

  for (const clause of clauses) {
    const clauseId = clause?.clause_id;
    const text = String(clause?.text || "").trim();
    if (!text) continue;

    const baseline = clauseId ? baselineMap?.[clauseId] : null;
    const firstAlpha = firstAlphabeticCharacter(text);
    if (firstAlpha && firstAlpha === firstAlpha.toLowerCase()) {
      failures.push({
        clause_id: clauseId,
        reason:
          "the clause begins with a malformed lowercase fragment instead of formal legal drafting",
      });
      continue;
    }

    const repeatedToken = collectRepeatedCharacterToken(text);
    if (repeatedToken) {
      failures.push({
        clause_id: clauseId,
        reason: `the clause contains the malformed token "${repeatedToken}" with no clear legal purpose`,
      });
      continue;
    }

    if (!baseline?.text) continue;

    const change = extractContiguousChange(
      normalizeComparableText(baseline.text),
      normalizeComparableText(text)
    );

    if (!change || !change.added) continue;

    if (looksLikeStandaloneTamper(change.added, change)) {
      failures.push({
        clause_id: clauseId,
        reason: `${describeFragment(
          change.added
        )} was inserted into a validated clause and does not read like legal drafting`,
        rule_id: "CLAUSE_TAMPER_DETECTED",
      });
    }
  }

  return failures;
}

async function runSafetyPrompt(prompt, key) {
  const responseSchema =
    key === "integrity_failures"
      ? INTEGRITY_RESPONSE_SCHEMA
      : LEGAL_RESPONSE_SCHEMA;
  const result = await callAISafetyRaw(prompt, {
    schemaName: key,
    schema: responseSchema,
  });
  if (!result.success) {
    throw new Error(result.details || result.error || "AI_PROVIDER_ERROR");
  }
  return result.data?.[key] || [];
}

async function checkClauseIntegrity(clauses) {
  const clauseList = clauses
    .map((clause) => `[${clause.clause_id}]\n${(clause.text || "").slice(0, 1000)}`)
    .join("\n\n---\n\n");

  const prompt = `You are a senior Indian legal professional reviewing edited contract clauses.

For each clause below, determine whether every sentence still reads like genuine legal drafting.
Flag text that is conversational, malicious, abusive, random, stray, or clearly not intended for a legal instrument.

Return JSON only:
{
  "integrity_failures": [
    {
      "clause_id": "exact clause_id from input",
      "reason": "one sentence explaining why the text cannot be explained as intentional legal drafting"
    }
  ]
}

Return { "integrity_failures": [] } if all clauses remain genuine legal drafting.

CLAUSES:
${clauseList}`;

  return runSafetyPrompt(prompt, "integrity_failures");
}

async function checkLegalSafety(clauses, documentType) {
  const clauseList = clauses
    .map(
      (clause) =>
        `[${clause.clause_id}] ${clause.title || clause.category}:\n${(
          clause.text || ""
        ).slice(0, 1000)}`
    )
    .join("\n\n---\n\n");

  const categoryList = LEGAL_CATEGORIES.map(
    (category) => `- ${category.id}: ${category.statute}`
  ).join("\n");

  const prompt = `You are an expert Indian legal compliance engine.

Analyze these edited contract clauses for violations of Indian law by meaning or intent.
Focus on disguised or newly introduced risk, not just keywords.

VIOLATION CATEGORIES:
${categoryList}

DOCUMENT TYPE: ${documentType}

CLAUSES:
${clauseList}

Return JSON only:
{
  "violations": [
    {
      "category_id": "ID from the list above",
      "clause_id": "exact clause_id",
      "confidence": "HIGH" | "MEDIUM",
      "explanation": "what was found and why it violates the law (max 60 words)"
    }
  ]
}

Return { "violations": [] } if no violations are found.`;

  return runSafetyPrompt(prompt, "violations");
}

function buildAIUnavailableIssue(reasons = []) {
  const suffix = reasons.length
    ? ` (${reasons.join("; ")})`
    : "";

  return {
    rule_id: "AI_CHECK_UNAVAILABLE",
    severity: "HIGH",
    message: `AI safety review could not complete for the edited clauses${suffix}.`,
    suggestion:
      "Re-run validation once the AI safety layer is available, or manually restore the affected clause to the last validated text.",
    blocks_generation: false,
    ai_detected: true,
    manual_review_required: true,
  };
}

export async function aiLegalSafetyValidate(
  draft,
  { isUserEdit = false } = {}
) {
  if (!isUserEdit) return [];
  if (!draft?.clauses?.length) return [];

  const baselineMap = getBaselineClauseMap(draft);
  const clauses = getRelevantClauses(draft);
  if (!clauses.length) return [];

  const issues = [];
  const deterministicFailures = detectDeterministicIntegrityFailures(
    clauses,
    baselineMap
  );

  let integrityFailures = [...deterministicFailures];
  let legalViolations = [];

  const [integrityResult, legalResult] = await Promise.allSettled([
    checkClauseIntegrity(clauses),
    checkLegalSafety(clauses, draft.document_type),
  ]);

  const aiFailures = [];

  if (integrityResult.status === "fulfilled") {
    integrityFailures = [...integrityFailures, ...(integrityResult.value || [])];
  } else {
    aiFailures.push(`integrity check unavailable: ${integrityResult.reason?.message || "unknown error"}`);
  }

  if (legalResult.status === "fulfilled") {
    legalViolations = legalResult.value || [];
  } else {
    aiFailures.push(`legal safety check unavailable: ${legalResult.reason?.message || "unknown error"}`);
  }

  for (const failure of integrityFailures) {
    issues.push({
      rule_id: failure.rule_id || "AI_INTEGRITY_VIOLATION",
      severity: "CRITICAL",
      message: `Clause "${failure.clause_id}" contains text that is not genuine legal drafting: ${failure.reason}`,
      suggestion:
        "Remove the non-legal insertion or restore the clause to the last validated wording.",
      statutory_reference: "Indian Contract Act 1872 S.23",
      blocks_generation: true,
      offending_clause_id: failure.clause_id,
      ai_detected: true,
    });
  }

  for (const violation of legalViolations) {
    if (violation.confidence !== "HIGH" && violation.confidence !== "MEDIUM") {
      continue;
    }

    const category = CATEGORY_MAP[violation.category_id];
    issues.push({
      rule_id: `AI_SEMANTIC_${violation.category_id}`,
      severity: category?.severity || "CRITICAL",
      message: violation.explanation,
      statutory_reference: category?.statute || "Indian Law",
      suggestion:
        "Review and remove or rephrase this clause so it complies with Indian law.",
      blocks_generation: category?.blocks_generation ?? true,
      offending_clause_id: violation.clause_id || null,
      ai_detected: true,
      confidence: violation.confidence,
    });
  }

  if (aiFailures.length > 0 && issues.length === 0) {
    issues.push(buildAIUnavailableIssue(aiFailures));
  }

  return issues;
}
