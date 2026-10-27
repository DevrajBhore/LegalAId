import { contractDoctrineApplies } from "./instrumentClass.js";

export function injectDoctrine(draft, documentType = draft?.document_type) {
  // D4.48. The warranty is about a contract: consideration, free consent and
  // capacity to contract. It was added to every document, so a Privacy Policy
  // and a Refund Policy told their readers that "the Parties represent and
  // warrant" their consideration was lawful. Only an instrument whose class is
  // a contract between parties carries it (knowledge-base/metadata/instrument_classes.json).
  if (!contractDoctrineApplies(documentType)) return draft;
  const doctrineText = `
The Parties represent and warrant that:
(a) The object and consideration of this Agreement are lawful under Section 23 of the Indian Contract Act, 1872;
(b) This Agreement is entered into with free consent under Sections 13–19 of the Indian Contract Act, 1872;
(c) Each Party is competent to contract under applicable law.`;

  // Try ENFORCEABILITY clause first; fall back to PURPOSE, then IDENTITY
  // None of the active blueprints include ENFORCEABILITY so the fallback
  // ensures doctrine is always physically present in the document.
  const priority = ["ENFORCEABILITY", "PURPOSE", "IDENTITY"];
  let injected = false;

  draft.clauses = draft.clauses.map(c => {
    if (!injected && priority.includes(c.category)) {
      c.text += "\n\n" + doctrineText;
      injected = true;
    }
    return c;
  });

  return draft;
}
