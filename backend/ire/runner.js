import { validateDocument } from "../../IRE/engine.js";
import { toIREDocType } from "../services/documentTypeNormalizer.js";

export async function validate(
  draft,
  { mode = "final", isUserEdit = false } = {}
) {
  if (!draft || !draft.document_type || !draft.clauses) {
    throw new Error(
      "Invalid draft passed to IRE — missing document_type or clauses"
    );
  }

  // Normalise document type to IRE naming convention
  const ireDocType = toIREDocType(draft.document_type);

  const result = await validateDocument(
    ireDocType,
    draft.clauses,
    {
      ...(draft.metadata || {}),
      state: draft.metadata?.state || draft.jurisdiction_state,
      stampDutyPaid: draft.metadata?.stampDutyPaid,
      financials: draft.metadata?.financials,
      ai_touched: draft.metadata?.ai_touched,
      user_edited: draft.metadata?.user_edited,
    },
    { mode, isUserEdit }
  );

  return result;
}
