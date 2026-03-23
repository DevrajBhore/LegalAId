/**
 * promptBuilder.js
 *
 * Builds the AI prompt for document drafting.
 * Injects: base draft structure, user variables, regeneration feedback.
 */

export function buildPrompt(input) {
  const {
    document_type,
    variables = {},
    baseDraft,
    regenerationContext,
  } = input;

  // ── Regeneration block ──────────────────────────────────────────────────
  const regenerationBlock = regenerationContext
    ? `
## IMPORTANT: PREVIOUS DRAFT FAILED LEGAL VALIDATION

The following compliance issues were detected. You MUST fix ALL of these in your revised draft:

${JSON.stringify(regenerationContext.previousIssues, null, 2)}

Do NOT repeat these mistakes. Every CRITICAL issue must be corrected.
`
    : "";

  // ── Variables summary for AI context ────────────────────────────────────
  const variableLines = Object.entries(variables)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  const variableBlock = variableLines
    ? `\n## DOCUMENT VARIABLES (use these exact values — do not invent alternatives)\n\n${variableLines}\n`
    : "";

  // ── Base draft ───────────────────────────────────────────────────────────
  const baseDraftBlock = `
## BASE DRAFT (from verified Indian legal clause library)

${JSON.stringify(baseDraft, null, 2)}
`;

  return `You are a professional Indian legal drafting engine. You draft contracts that are valid, precise, and enforceable under Indian law.

${regenerationBlock}
${variableBlock}
${baseDraftBlock}

## YOUR TASK

Improve the base draft into a polished, professional Indian legal document. Use the variable values provided above — embed them naturally into the clause text.

## MANDATORY COMPLIANCE RULES

1. The document MUST contain "lawful consideration" and "lawful object" (required by Indian Contract Act 1872, S.10)
2. Include the execution date in the IDENTITY clause
3. If an arbitration clause is present, specify the seat of arbitration (e.g., "The seat of arbitration shall be ${
    variables.arbitration_city || "Mumbai"
  }")
4. Identify parties correctly based on their type:
   - Individual: use full name followed by "an individual residing at [address]"
   - Private Limited Company: use company name followed by "a company incorporated under the Companies Act, 2013, having its registered office at [address]" and reference CIN if provided
   - LLP: use name followed by "a Limited Liability Partnership registered under the LLP Act, 2008"
   - Partnership Firm: use name followed by "a partnership firm registered under the Indian Partnership Act, 1932"
5. Use "duly authorized signatory" for company/LLP parties; use full name for individuals
6. Governing law MUST be "laws of India"
7. Every termination clause MUST specify a notice period in days
8. Include this exact stamp duty line in the IDENTITY clause: "This Agreement is executed on a non-judicial stamp paper of appropriate value as required under the Indian Stamp Act, 1899 and shall be duly stamped before execution."
9. The document_type in your JSON output MUST be in UPPERCASE exactly as given (e.g., "NDA" not "Nda")
10. Party descriptions must be legally precise — never use vague terms like "a business" or "a shop"

## DRAFTING STYLE

- Use formal Indian legal drafting style
- Include WHEREAS recitals in the IDENTITY clause
- Use NOW, THEREFORE phrasing before the operative clauses
- Write in complete sentences with numbered sub-clauses
- Reference applicable Indian statutes where relevant (ICA 1872, TPA 1882, etc.)
- Do NOT use placeholder text like [INSERT] or {{variable}} in the final output

## OUTPUT FORMAT

Return ONLY valid JSON. No markdown. No code blocks. No explanations.

{
  "document_type": "${document_type}",
  "jurisdiction": "India",
  "clauses": [
    {
      "clause_id": "string (preserve exactly from base draft)",
      "category": "string (preserve exactly from base draft)",
      "title": "string (can improve)",
      "text": "string (full polished clause text)",
      "statutory_reference": "string (cite relevant Indian statute)"
    }
  ]
}

## FORBIDDEN

- Do NOT change clause_id values
- Do NOT add or remove clauses
- Do NOT change clause categories
- Do NOT invent party names, addresses, or amounts not provided in variables
- Do NOT leave any {{placeholder}} tokens in the output
- Do NOT use deferred language like "to be mutually decided later", "as may be agreed", "to be determined", "TBD" — all terms must be concrete and specific
- Do NOT use "at the sole discretion of" without defining the limits of that discretion
- Do NOT use vague quantities like "reasonable amount" — use the actual values from variables
`;
}
