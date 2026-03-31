/**
 * promptBuilder.js — optimised
 *
 * Compact prompt: ~60% fewer tokens than the full JSON.stringify version.
 * Clause text truncated to 400 chars each for context — AI writes the full text.
 */

export function buildPrompt(input) {
  const {
    document_type,
    variables = {},
    baseDraft,
    regenerationContext,
  } = input;

  const regenBlock = regenerationContext
    ? `\n⚠ PREVIOUS DRAFT FAILED — fix ALL these issues:\n${regenerationContext.previousIssues
        .map((i) => `• [${i.severity}] ${i.rule_id}: ${i.message}`)
        .join("\n")}\n`
    : "";

  const vars = Object.entries(variables)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const varBlock = vars
    ? `\nVARIABLES (embed exactly — never invent):\n${vars}\n`
    : "";

  const clauseList = (baseDraft?.clauses || [])
    .map(
      (c) =>
        `[${c.clause_id}] ${c.category} | ${c.title || ""}\n${(
          c.text || ""
        ).slice(0, 400)}`
    )
    .join("\n\n");

  const arbCity = variables.arbitration_city || "Mumbai";

  return `Indian legal drafting engine. Draft complete, valid, enforceable ${document_type} under Indian law.
${regenBlock}${varBlock}
CLAUSES (preserve clause_id + category exactly — write full polished text):
${clauseList}

RULES:
1. Embed all variable values — zero {{placeholders}} in output
2. IDENTITY: execution date + WHEREAS recitals + NOW THEREFORE + stamp duty line ("executed on non-judicial stamp paper of appropriate value under Indian Stamp Act 1899")
3. Lawful consideration + lawful object (ICA 1872 §10)
4. Arbitration seat = ${arbCity} (Arbitration and Conciliation Act 1996)
5. Party types: Individual → "residing at [addr]"; Pvt Ltd → "Companies Act 2013, CIN [X]"; LLP → "LLP Act 2008"; Firm → "Partnership Act 1932"
6. Termination clause: state notice period in days
7. Governing law = "laws of India"
8. document_type in output = "${document_type}" exactly
9. Formal style: numbered sub-clauses, cite relevant Indian statutes

Output as JSON matching this exact shape:
{"document_type":"${document_type}","jurisdiction":"India","clauses":[{"clause_id":"exact","category":"exact","title":"string","text":"full text","statutory_reference":"string"}]}`;
}
