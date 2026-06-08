/**
 * clauseRecommendationService.js  —  the Level-3 unlock.
 *
 * Given a free-text description of the user's situation and the document type,
 * an AI selects which OPTIONAL clauses (from the real clause library) should be
 * added to the document. This lets every document type adapt to intent, not
 * just the few with hand-authored variant slots.
 *
 * Safety: the AI can only choose from clause_ids that already exist and are
 * valid for the document type. Anything it returns outside that set is rejected.
 * Required/blueprint clauses are never removed; the deterministic pipeline and
 * the export gate still validate the final draft.
 */
import { getAllClauses } from "./clauseAssembler.js";
import { getCanonicalDocumentType } from "../../shared/documentRegistry.js";
import { callAISafetyRaw } from "../ai/aiClient.js";

const RECOMMENDATION_SCHEMA = {
  type: "object",
  required: ["recommended"],
  properties: {
    recommended: {
      type: "array",
      items: {
        type: "object",
        required: ["clause_id", "reason"],
        properties: {
          clause_id: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
  },
};

const MAX_CANDIDATES = 60;
const MAX_RECOMMENDED = 12;

// Candidate = clauses valid for this document type that are NOT already in the
// base (required/variant/conditional) set — i.e. optional add-ons.
function buildCandidates(documentType, baseClauseIds = []) {
  const canonical = String(getCanonicalDocumentType(documentType) || "").toUpperCase();
  const baseSet = new Set(baseClauseIds);

  return getAllClauses()
    .filter((clause) => {
      if (!clause?.clause_id || baseSet.has(clause.clause_id)) return false;
      const types = (clause.document_types || []).map((t) => String(t).toUpperCase());
      return types.includes("ALL") || types.includes(canonical);
    })
    .slice(0, MAX_CANDIDATES)
    .map((clause) => ({
      clause_id: clause.clause_id,
      name: clause.name || clause.title || clause.clause_id,
      category: clause.category || "",
      risk_level: clause.risk_level || "",
      summary: String(clause.text || "").replace(/\s+/g, " ").slice(0, 140),
    }));
}

export async function recommendClauses({ documentType, situation, baseClauseIds = [] }) {
  const trimmed = String(situation || "").trim();
  if (!documentType || !trimmed) {
    return { recommended: [], available: false };
  }

  const candidates = buildCandidates(documentType, baseClauseIds);
  if (candidates.length === 0) {
    return { recommended: [], available: true };
  }
  const candidateById = new Map(candidates.map((c) => [c.clause_id, c]));

  const catalog = candidates
    .map(
      (c) =>
        `- ${c.clause_id} | ${c.name} | ${c.category} | risk:${c.risk_level} | ${c.summary}`
    )
    .join("\n");

  const prompt = `You are a senior Indian transactional lawyer assembling a contract.
The document's mandatory clauses are already included. From the OPTIONAL clause
catalog below, choose ONLY the clauses that the user's situation genuinely warrants.

Rules:
- Choose clause_id values EXACTLY from the catalog. Never invent a clause_id.
- Add a clause only if the situation supports it. Fewer, well-justified clauses
  are better than many. If nothing extra is warranted, return an empty list.
- confidence is 0..1.

DOCUMENT TYPE: ${documentType}

USER SITUATION:
${trimmed}

OPTIONAL CLAUSE CATALOG:
${catalog}

Return strict JSON only:
{ "recommended": [ { "clause_id": "EXACT_ID", "reason": "why it fits", "confidence": 0.0 } ] }`;

  const response = await callAISafetyRaw(prompt, {
    schemaName: "clause_recommendation_response",
    schema: RECOMMENDATION_SCHEMA,
  });

  if (!response?.success) {
    return { recommended: [], available: false };
  }

  // Validate: keep only ids that are real candidates; dedupe; cap.
  const seen = new Set();
  const recommended = (Array.isArray(response.data?.recommended) ? response.data.recommended : [])
    .map((item) => ({
      clause_id: String(item?.clause_id || "").trim(),
      reason: String(item?.reason || "").trim(),
      confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
    }))
    .filter((item) => {
      if (!candidateById.has(item.clause_id) || seen.has(item.clause_id)) return false;
      seen.add(item.clause_id);
      return true;
    })
    .slice(0, MAX_RECOMMENDED);

  return { recommended, available: true };
}

// Exported for unit-testing the safety guarantee without the AI.
export { buildCandidates as _buildCandidatesForTest };
