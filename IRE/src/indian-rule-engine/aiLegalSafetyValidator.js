/**
 * aiLegalSafetyValidator.js
 *
 * Layer 6 — AI Clause Integrity + Legal Safety Check
 *
 * Two separate AI calls with two completely different questions:
 *
 * Call 1 — INTEGRITY CHECK (universal, language-agnostic):
 *   "Is every sentence in this clause genuine legal drafting language?"
 *   This catches anything that doesn't belong — profanity, gibberish, threats,
 *   abuse in any language — without needing to know what the bad content is.
 *   If a sentence can't be explained as intentional legal drafting, it fails.
 *
 * Call 2 — LEGAL SAFETY CHECK:
 *   "Does this clause violate Indian law by meaning or intent?"
 *   This catches disguised illegal clauses no regex can find.
 */

import { callGeminiSafety } from "../../../backend/ai/geminiClient.js";

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
    statute: "Indian Contract Act 1872 S.23 (immoral/unlawful object)",
    severity: "CRITICAL",
    blocks_generation: true,
  },
];

const CATEGORY_MAP = Object.fromEntries(LEGAL_CATEGORIES.map((c) => [c.id, c]));

// ── Call 1: Integrity check ───────────────────────────────────────────────────
// Asks Gemini to read each clause as a legal professional would and identify
// any sentence that could NOT have been written by a legal drafter.
// This is language-agnostic — it doesn't need to know what's wrong,
// only that a sentence doesn't belong in a legal document.
async function checkClauseIntegrity(clauses) {
  const clauseList = clauses
    .map((c) => `[${c.clause_id}]\n${(c.text || "").slice(0, 800)}`)
    .join("\n\n---\n\n");

  const prompt = `You are a senior Indian legal professional reviewing a contract draft.

Read each clause below as a legal professional. For each clause, ask yourself:
"Could every single sentence in this clause have been written by a qualified legal drafter as part of a genuine contract?"

A genuine legal drafter writes:
- Obligations, rights, conditions, definitions, procedures
- Formal legal language in any language (English, Hindi, regional languages)
- References to statutes, parties, amounts, dates, places

A genuine legal drafter NEVER writes:
- Words or sentences that serve no legal purpose whatsoever
- Content that is clearly not part of any contract (regardless of language or script)
- Text that a reasonable person would consider out of place in a legal document

You do not need to identify WHAT the problematic text is or WHY it is wrong.
You only need to determine: does this clause contain any text that could not
plausibly be intentional legal drafting?

CLAUSES TO REVIEW:
${clauseList}

Respond ONLY with valid JSON:
{
  "integrity_failures": [
    {
      "clause_id": "exact clause_id from input",
      "reason": "one sentence: what about this clause cannot be explained as intentional legal drafting"
    }
  ]
}

Return { "integrity_failures": [] } if all clauses appear to be genuine legal text.`;

  const result = await callGeminiSafety(prompt);
  return result?.integrity_failures || [];
}

// ── Call 2: Legal safety check ────────────────────────────────────────────────
// Asks Gemini whether any clause violates Indian law by meaning or intent.
async function checkLegalSafety(clauses, documentType) {
  const clauseList = clauses
    .map(
      (c) =>
        `[${c.clause_id}] ${c.title || c.category}:\n${(c.text || "").slice(
          0,
          800
        )}`
    )
    .join("\n\n---\n\n");

  const categoryList = LEGAL_CATEGORIES.map(
    (c) => `- ${c.id}: ${c.statute}`
  ).join("\n");

  const prompt = `You are an expert Indian legal compliance engine.

Analyze these contract clauses for violations of Indian law — focus on MEANING and INTENT, not keywords.
Flag disguised violations like "training bond" (bonded labour), "trainee under 14" (child labour),
"disputes resolved internally only" (ouster of courts), "coordinated market pricing" (price fixing).

VIOLATION CATEGORIES:
${categoryList}

DOCUMENT TYPE: ${documentType}

CLAUSES:
${clauseList}

Respond ONLY with valid JSON:
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

Return { "violations": [] } if no violations found.
Only HIGH or MEDIUM confidence.
Do NOT flag standard clauses: arbitration, non-compete with confidentiality carve-out, termination notices.`;

  const result = await callGeminiSafety(prompt);
  return result?.violations || [];
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function aiLegalSafetyValidate(
  draft,
  { isUserEdit = false } = {}
) {
  if (!isUserEdit) return [];
  if (!draft?.clauses?.length) return [];

  const clauses = draft.clauses.filter((c) => c.category !== "SIGNATURE_BLOCK");
  const issues = [];

  console.log(
    `[aiLegalSafetyValidator] Running deep check on ${clauses.length} clauses...`
  );

  // Run both checks in parallel
  let integrityFailures = [];
  let legalViolations = [];

  try {
    [integrityFailures, legalViolations] = await Promise.all([
      checkClauseIntegrity(clauses),
      checkLegalSafety(clauses, draft.document_type),
    ]);
  } catch (err) {
    console.error("[aiLegalSafetyValidator] AI check failed:", err.message);
    // Surface as a warning rather than silently passing
    return [
      {
        rule_id: "AI_CHECK_UNAVAILABLE",
        severity: "MEDIUM",
        message:
          "AI safety check could not complete. Manual review recommended before downloading.",
        suggestion: "Re-run validation to retry the AI check.",
        blocks_generation: false,
        ai_detected: true,
      },
    ];
  }

  // Map integrity failures → IRE issues
  for (const failure of integrityFailures) {
    issues.push({
      rule_id: "AI_INTEGRITY_VIOLATION",
      severity: "CRITICAL",
      message: `Clause "${failure.clause_id}" contains text that is not genuine legal drafting: ${failure.reason}`,
      suggestion:
        "Remove the non-legal text and restore the clause to valid legal language.",
      statutory_reference: "Indian Contract Act 1872 S.23",
      blocks_generation: true,
      offending_clause_id: failure.clause_id,
      ai_detected: true,
    });
  }

  // Map legal violations → IRE issues
  for (const v of legalViolations) {
    if (v.confidence !== "HIGH" && v.confidence !== "MEDIUM") continue;
    const category = CATEGORY_MAP[v.category_id];
    issues.push({
      rule_id: `AI_SEMANTIC_${v.category_id}`,
      severity: category?.severity || "CRITICAL",
      message: v.explanation,
      statutory_reference: category?.statute || "Indian Law",
      suggestion:
        "Review and remove or rephrase this clause to comply with Indian law.",
      blocks_generation: category?.blocks_generation ?? true,
      offending_clause_id: v.clause_id || null,
      ai_detected: true,
      confidence: v.confidence,
    });
  }

  console.log(
    `[aiLegalSafetyValidator] Found ${issues.length} issue(s) — ${integrityFailures.length} integrity, ${legalViolations.length} legal`
  );
  return issues;
}
