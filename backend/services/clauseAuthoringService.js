/**
 * clauseAuthoringService.js  —  build-time AI acceleration (the "more AI" lever).
 *
 * Given a document type, an AI proposes the protections it is MISSING and either
 * (a) reuses an existing library clause or (b) drafts a candidate clause, plus
 * the IF/THEN rule (with legal_basis) that should add it. Proposals are written
 * to the ClauseReview queue as `pending` — NOTHING is wired into generation
 * automatically. A lawyer approves; the generator then wires it in.
 *
 * AI here only ACCELERATES authoring and gap-detection; it never decides clauses
 * at runtime. Every proposal is schema-validated (real clause ids / non-empty
 * draft text / legal basis present) before it can reach the review queue.
 */
import crypto from "crypto";
import { getAllClauses, assembleDocument } from "./clauseAssembler.js";
import { getCanonicalDocumentType } from "../../shared/documentRegistry.js";
import { callAISafetyRaw } from "../ai/aiClient.js";
import ClauseReview from "../models/ClauseReview.js";

const AUTHORING_SCHEMA = {
  type: "object",
  required: ["proposals"],
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        required: ["protection", "why", "rule_when"],
        properties: {
          protection: { type: "string" },
          why: { type: "string" },
          legal_basis: { type: "string" },
          reuse_clause_id: { type: "string" },
          draft_clause_text: { type: "string" },
          rule_when: { type: "string" },
          rule_action: { type: "string", enum: ["add", "replace"] },
        },
      },
    },
  },
};

function currentClauseIds(documentType) {
  try {
    return assembleDocument(documentType, {}).clauses.map((c) => c.clause_id);
  } catch {
    return [];
  }
}

function fingerprint(text) {
  return crypto
    .createHash("sha256")
    .update(String(text).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 600))
    .digest("hex")
    .slice(0, 32);
}

export async function proposeProtectionsForType({ documentType, persist = true }) {
  if (!documentType) {
    const error = new Error("document_type is required.");
    error.statusCode = 400;
    throw error;
  }

  const canonical = getCanonicalDocumentType(documentType);
  const present = new Set(currentClauseIds(documentType));
  const library = getAllClauses();
  const libraryById = new Map(library.map((c) => [c.clause_id, c]));

  // Compact catalog so the AI can REUSE existing clauses (cheaper + safer than drafting).
  const catalog = library
    .filter((c) => {
      const types = (c.document_types || []).map((t) => String(t).toUpperCase());
      return types.includes("ALL") || types.includes(String(canonical).toUpperCase());
    })
    .map((c) => `${c.clause_id} | ${c.category} | ${c.name || c.title || ""}`)
    .join("\n");

  const prompt = `You are a senior Indian transactional lawyer reviewing a contract template for COMPLETENESS.

DOCUMENT TYPE: ${canonical}

CLAUSES ALREADY PRESENT (clause_ids):
${[...present].join(", ") || "(none)"}

REUSABLE CLAUSE CATALOG (prefer reusing these over drafting new ones):
${catalog}

Propose the protections/clauses this document is MISSING and genuinely should offer
(e.g. limitation of liability, indemnity, force majeure, dispute/arbitration, data
protection, sector-specific compliance). For each proposal:
- If a suitable clause already exists in the catalog, set "reuse_clause_id" to its EXACT id.
- Otherwise draft a concise, India-law-correct clause in "draft_clause_text".
- Give "legal_basis" (Act + section) and "rule_when" (the condition under which it
  should apply, e.g. "include_indemnity == true" or "involves_personal_data == true";
  use "always" for universally-needed clauses), and "rule_action" (add | replace).
- Do NOT propose clauses already present. Be concise; quality over quantity.

Return strict JSON:
{ "proposals": [ { "protection": "...", "why": "...", "legal_basis": "...", "reuse_clause_id": "EXACT_ID_or_omit", "draft_clause_text": "...or omit", "rule_when": "...", "rule_action": "add" } ] }`;

  const response = await callAISafetyRaw(prompt, {
    schemaName: "clause_authoring_proposals",
    schema: AUTHORING_SCHEMA,
  });

  if (!response?.success) {
    return { documentType: canonical, proposals: [], available: false };
  }

  // Validate + classify each proposal. Reject anything unusable.
  const proposals = (Array.isArray(response.data?.proposals) ? response.data.proposals : [])
    .map((p) => validateProposal(p, present, libraryById))
    .filter(Boolean)
    .slice(0, 12);

  let queued = 0;
  if (persist) {
    for (const p of proposals) {
      // Only NEW drafted clauses go to the review queue (reused clauses already exist).
      if (p.kind !== "draft") continue;
      try {
        const fp = fingerprint(p.draft_clause_text);
        const exists = await ClauseReview.findOne({ category: p.category, fingerprint: fp }).lean();
        if (exists) continue;
        await ClauseReview.create({
          category: p.category,
          fingerprint: fp,
          clauseName: p.protection,
          text: p.draft_clause_text,
          charLength: p.draft_clause_text.length,
          riskLevel: "medium",
          sourceDocumentName: `AI authoring proposal for ${canonical}`,
          status: "pending",
        });
        queued += 1;
      } catch {
        /* Mongo unavailable / dup — proposal still returned to caller. */
      }
    }
  }

  return { documentType: canonical, proposals, queuedForReview: queued, available: true };
}

function validateProposal(raw, present, libraryById) {
  const protection = String(raw?.protection || "").trim();
  const why = String(raw?.why || "").trim();
  const ruleWhen = String(raw?.rule_when || "").trim();
  if (!protection || !why || !ruleWhen) return null;

  const base = {
    protection,
    why,
    legal_basis: String(raw?.legal_basis || "").trim(),
    rule_when: ruleWhen,
    rule_action: raw?.rule_action === "replace" ? "replace" : "add",
    review_status: "draft-needs-legal-review",
  };

  const reuseId = String(raw?.reuse_clause_id || "").trim();
  if (reuseId) {
    const clause = libraryById.get(reuseId);
    if (!clause || present.has(reuseId)) return null; // must exist + not already present
    return { ...base, kind: "reuse", clause_id: reuseId, category: clause.category };
  }

  const draft = String(raw?.draft_clause_text || "").trim();
  if (draft.length < 40) return null; // reject empty / trivial drafts
  return { ...base, kind: "draft", draft_clause_text: draft, category: protection.toUpperCase().replace(/[^A-Z0-9]+/g, "_") };
}

// Exported for unit-testing the bounding without the AI.
export { validateProposal as _validateProposal };
