import { validateDocument } from "../../IRE/engine.js";
import { toIREDocType } from "../services/documentTypeNormalizer.js";

let engineReady = false;

export async function validate(draft, { isUserEdit = false } = {}) {
  if (!draft || !draft.document_type || !draft.clauses) {
    throw new Error(
      "Invalid draft passed to IRE — missing document_type or clauses"
    );
  }

  if (!engineReady) {
    console.log("[IRE Runner] Initializing Indian Rule Engine...");
    engineReady = true;
  }

  // Normalise document type to IRE naming convention
  const ireDocType = toIREDocType(draft.document_type);

  const result = await validateDocument(
    ireDocType,
    draft.clauses,
    {
      state: draft.metadata?.state || draft.jurisdiction_state,
      stampDutyPaid: draft.metadata?.stampDutyPaid,
      financials: draft.metadata?.financials,
    },
    { isUserEdit }
  );

  return result;
}
