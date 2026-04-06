import { getPartyNamingPrompt } from "../services/partyNaming.js";
import { getDocumentStyleProfile } from "../services/draftingPolicy.js";

function formatVariableEntries(variables = {}) {
  return Object.entries(variables)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `- ${key}: ${value}`)
    .join("\n");
}

function formatClauseBlueprint(baseDraft) {
  return (baseDraft?.clauses || [])
    .map((clause) => {
      const snippet = String(clause.text || "").slice(0, 500).trim();
      return [
        `[${clause.clause_id}]`,
        `category: ${clause.category || ""}`,
        `title: ${clause.title || ""}`,
        `baseline: ${snippet || "(no baseline text provided)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function formatRegenerationContext(regenerationContext) {
  if (!regenerationContext?.previousIssues?.length) {
    return "";
  }

  const issues = regenerationContext.previousIssues
    .map((issue) => `- [${issue.severity}] ${issue.rule_id}: ${issue.message}`)
    .join("\n");

  return `\nREPAIR TARGETS:\n${issues}\n`;
}

function formatSemanticParticipants(semanticContext = {}) {
  const participants = Array.isArray(semanticContext?.participants)
    ? semanticContext.participants
    : [];

  if (!participants.length) {
    return "";
  }

  return participants
    .map((participant) => {
      const descriptor =
        participant.descriptor ||
        participant.name ||
        participant.label ||
        "Unnamed participant";
      return `- ${participant.label || participant.id || "Party"}: ${descriptor}`;
    })
    .join("\n");
}

function formatSemanticSections(semanticContext = {}) {
  const sections = [
    ["Objective Summary", semanticContext?.objective_summary],
    ["Participant Understanding", formatSemanticParticipants(semanticContext)],
    ["Term And Lifecycle", semanticContext?.term?.summary],
    ["Commercial Understanding", semanticContext?.commercial?.summary],
    ["Risk Allocation Understanding", semanticContext?.risk?.summary],
    ["Operational Understanding", semanticContext?.operational?.summary],
    ["Governance Understanding", semanticContext?.governance?.summary],
  ].filter(([, value]) => value && String(value).trim());

  if (!sections.length) {
    return "";
  }

  return sections
    .map(([label, value]) => `${label}:\n${value}`)
    .join("\n\n");
}

function formatClauseGuidance(semanticContext = {}) {
  const guidance = Array.isArray(semanticContext?.clause_guidance)
    ? semanticContext.clause_guidance
    : [];

  if (!guidance.length) {
    return "";
  }

  return guidance
    .map((entry) => `- ${entry.section}: ${entry.guidance}`)
    .join("\n");
}

function formatDraftingDirectives(semanticContext = {}) {
  const directives = Array.isArray(semanticContext?.drafting_directives)
    ? semanticContext.drafting_directives
    : [];

  if (!directives.length) {
    return "";
  }

  return directives.map((directive) => `- ${directive}`).join("\n");
}

function formatFieldInsights(semanticContext = {}) {
  const insights = Array.isArray(semanticContext?.field_insights)
    ? semanticContext.field_insights
    : [];

  if (!insights.length) {
    return "";
  }

  return insights
    .map(
      (insight) =>
        `- ${insight.label}: ${insight.value} -> use in ${insight.draftingTarget}`
    )
    .join("\n");
}

function formatStylePreferences(semanticContext = {}) {
  const style = semanticContext?.style_preferences || {};
  const preferences = [];

  if (style.density === "lawyer_formal_dense") {
    preferences.push(
      "Make the document read like a full lawyer-prepared agreement, with substantive clause bodies rather than thin summaries."
    );
  }

  if (style.openingStyle === "formal_execution_block") {
    preferences.push(
      "Use a formal opening structure: title, execution line, party introduction, and recitals where appropriate."
    );
  }

  if (style.recitalStyle === "whereas_recitals") {
    preferences.push(
      "Use short but meaningful recitals to frame the transaction and business background."
    );
  }

  if (style.bodyStyle === "substantive_numbered_clauses") {
    preferences.push(
      "Draft numbered clauses that contain complete legal mechanics, and use itemized subparts where the facts call for breakdowns."
    );
  }

  if (style.preferDefinitions) {
    preferences.push(
      "Where suitable, define key commercial or legal terms before using them repeatedly later in the document."
    );
  }

  if (style.preferSchedules) {
    preferences.push(
      "Where the intake includes technical, commercial, or specification-heavy detail, present that detail in schedule-style or clearly itemized language."
    );
  }

  if (style.preferDetailedExecution) {
    preferences.push(
      "Use a complete execution block with formal signatory wording and capacity references."
    );
  }

  return preferences.map((entry) => `- ${entry}`).join("\n");
}

export function buildPrompt(input) {
  const {
    document_type,
    variables = {},
    baseDraft,
    regenerationContext,
    semanticContext,
  } = input;

  const variableBlock = formatVariableEntries(variables);
  const clauseBlueprint = formatClauseBlueprint(baseDraft);
  const regenerationBlock = formatRegenerationContext(regenerationContext);
  const arbitrationCity = variables.arbitration_city || "Mumbai";
  const partyNamingBlock = getPartyNamingPrompt(document_type);
  const semanticBlock = formatSemanticSections(semanticContext);
  const clauseGuidanceBlock = formatClauseGuidance(semanticContext);
  const directivesBlock = formatDraftingDirectives(semanticContext);
  const fieldInsightsBlock = formatFieldInsights(semanticContext);
  const stylePreferencesBlock =
    formatStylePreferences(semanticContext) ||
    formatStylePreferences({ style_preferences: getDocumentStyleProfile(document_type) });

  return `You are a senior Indian transactional lawyer drafting a complete ${document_type}.

Your job is to interpret the user's intake as legal facts and commercial intent, then draft a polished, coherent, enforceable document.
Do not mechanically paste field values into placeholder-looking sentences.
Instead, understand what the user means and infuse those details naturally into the correct legal clauses, party descriptions, recitals, payment mechanics, operative obligations, and signature language.

NON-NEGOTIABLE RULES:
1. Preserve every clause_id exactly as provided.
2. Preserve every category exactly as provided.
3. Keep document_type exactly "${document_type}".
4. Use the clause blueprint as the required structure and subject-matter map.
5. Convert short, messy, or informal user inputs into formal legal drafting.
6. Use only the facts supplied by the user or already present in the clause blueprint. Do not invent parties, dates, money amounts, addresses, notice periods, cities, or commercial obligations.
7. If a fact is missing, draft cautiously and generically rather than hallucinating specifics.
8. Output zero unresolved placeholders, merge markers, bracket tokens, or template syntax.
9. Keep the document internally consistent across names, dates, amounts, durations, and obligations.
10. Governing law must be the laws of India.
11. If the document contains dispute resolution, use ${arbitrationCity} as the arbitration seat/city unless the intake clearly requires otherwise.
12. Draft in professional Indian legal style, with complete clause text, not notes or summaries.
13. Maintain formal grammar, consistent legal terminology, subject-verb agreement, and clean punctuation throughout the draft.
14. If the intake includes renewal mechanics, termination notice, termination grounds, cure periods, dispute method, GST/tax handling, liability caps, indemnity scope, confidentiality access limits, residual knowledge treatment, support obligations, milestones, acceptance criteria, inspection timelines, risk-transfer stages, source-code delivery, change-request process, repayment mechanics, invocation procedure, deadlock or exit rights, or binding nature, reflect them in the legally correct clauses instead of ignoring them.
15. Use the interpreted legal facts below as the primary explanation of what the user means. The raw intake remains the source material, but the interpreted facts tell you how those inputs should legally operate.
16. Make the draft feel complete and professionally prepared. Prefer fuller clause text, well-formed recitals, definitions where useful, and properly structured operative language over sparse or skeletal drafting.
17. Do not pad the document with generic filler. Add depth only where it is legally justified by the blueprint, the intake, or the interpreted facts.

PARTY-DRAFTING GUIDANCE:
- For an individual, describe the party in natural legal style such as an individual residing at the stated address.
- For a private limited company, refer to the company in corporate style and use CIN if supplied.
- For an LLP or firm, use the correct entity description if the intake indicates that status.
- If the user's field value is only a fragment, normalize it into complete legal wording.
- ${partyNamingBlock || "Once the parties are introduced, keep the party labels consistent throughout the document."}

HOW TO USE THE USER INPUTS:
- Treat each intake value as a factual instruction, not as a literal string that must be pasted everywhere.
- Merge the inputs where they legally belong. Example: dates belong in commencement/effective clauses, commercial figures belong in consideration/payment clauses, addresses belong in party descriptions or notice clauses, and purpose/scope inputs belong in recitals or scope clauses.
- Renewal and termination inputs belong in term and termination clauses. Dispute method and governing-law inputs belong in dispute resolution and governing-law clauses. Tax/GST inputs belong in invoice and payment clauses. Liability and indemnity inputs belong in risk-allocation clauses. Confidentiality access and residual knowledge inputs belong in confidentiality clauses. Support, milestone, acceptance, inspection, risk-transfer, change-request, and source-code inputs belong in delivery and technology clauses. Repayment and invocation inputs belong in finance clauses. Deadlock, transfer, and exit inputs belong in governance and exit clauses.
- When the intake implies business context, restate it in precise contract language.
- Keep the output user-focused: the final draft should read like a lawyer drafted it for the user's situation.
${regenerationBlock}
INTERPRETED LEGAL FACTS:
${semanticBlock || "- No interpreted facts supplied."}

INPUT-TO-CLAUSE GUIDANCE:
${clauseGuidanceBlock || "- Use each input in the legally appropriate clause family."}

DRAFTING DIRECTIVES:
${directivesBlock || "- Understand the user's intent before drafting."}

DOCUMENT PRESENTATION STYLE:
${stylePreferencesBlock || "- Use a formal, complete, lawyer-style presentation."}

FIELD-BY-FIELD LEGAL MEANING:
${fieldInsightsBlock || "- No field insights supplied."}

USER INTAKE:
${variableBlock || "- No user variables supplied."}

CLAUSE BLUEPRINT:
${clauseBlueprint}

Return strict JSON only in this exact shape:
{"document_type":"${document_type}","jurisdiction":"India","clauses":[{"clause_id":"exact","category":"exact","title":"string","text":"full clause text","statutory_reference":"string"}]}`;
}
