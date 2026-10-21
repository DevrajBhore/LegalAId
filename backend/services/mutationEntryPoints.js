/**
 * mutationEntryPoints.js — D4.47
 *
 * The two request-time paths that change clause text after generation, kept
 * here so the HTTP handlers stay thin and the guard on each can be tested:
 *
 *   prepareExportDraft  POST /export   quality controls run again at export
 *   guardChatEdits      POST /chat     AI edits requested in the chat panel
 *
 * The other mutation paths are guarded where they live: deterministic repair
 * and AI tailoring (documentService), /fix-issue (issueRepairService). The
 * complete list, and the test that covers each, is in
 * knowledge-base/governance/mutation-paths.json.
 */
import { applyDocumentQualityControls } from "./documentQualityControl.js";
import { guardDraftMutation, userValueFigures, figuresIn } from "./mutationGuard.js";
import { getVariables as getSchemaVariables } from "../config/variableConfig.js";

const figuresFor = (draft, variables) => userValueFigures(variables || {}, getSchemaVariables(draft?.document_type) || {});

/**
 * Export-time quality controls. On engine drafts they are a fixed point
 * (measured on the corpus); on edited text they normalise. They may not remove a
 * value the user entered or change a locked clause: such a change is refused
 * and the export carries the text the user saw.
 */
export function prepareExportDraft(draft, variables = draft?.metadata?.source_variables || {}) {
  return guardDraftMutation(
    draft,
    applyDocumentQualityControls(draft, { document_type: draft.document_type, variables }),
    { userFigures: figuresFor(draft, variables), source: "export_quality_controls" }
  );
}

/**
 * Chat edits used to be applied in the browser with no check at all. They pass
 * the same guard as every other AI change. A figure the user typed in the
 * request is theirs to introduce; a locked clause stays locked, and the meaning
 * markers (negation, obligation, conditions, remedies, parties) must survive.
 */
export function guardChatEdits(draft, result, message = "") {
  if (result?.type !== "edit" || !Array.isArray(result.edits) || !draft?.clauses) return result;
  const after = {
    ...draft,
    clauses: draft.clauses.map((clause) => {
      const edit = result.edits.find((e) => e.clause_id === clause.clause_id);
      return edit ? { ...clause, text: String(edit.new_text ?? "") } : clause;
    }),
  };
  const { refused } = guardDraftMutation(draft, after, {
    userFigures: figuresFor(draft, draft?.metadata?.source_variables),
    source: "ai_chat",
    introducedFiguresForbidden: true,
    authorisedFigures: figuresIn(message),
  });
  if (!refused.length) return result;
  const refusedIds = new Set(refused.map((r) => r.clause_id));
  const edits = result.edits.filter((e) => !refusedIds.has(e.clause_id));
  return {
    ...result,
    type: edits.length ? "edit" : "reply",
    edits,
    refused,
    reply: `${result.reply || ""}\n\nNot applied to ${refused.map((r) => r.clause_id).join(", ")}: ${refused
      .flatMap((r) => r.reasons.map((x) => x.detail)).join("; ")}. Edit the clause yourself if that change is what you want.`.trim(),
  };
}
