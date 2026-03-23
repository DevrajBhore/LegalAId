// const UNIVERSAL_REQUIRED_CATEGORIES = [
//   "IDENTITY",
//   "PURPOSE",
//   "CONSIDERATION",
//   "TERM",
//   "TERMINATION",
//   "DISPUTE_RESOLUTION",
//   "GOVERNING_LAW",
//   "ENFORCEABILITY",
//   "SIGNATURE_BLOCK"
// ];

export function buildStructuredDraft(aiContent, baseDraft) {

  if (!aiContent || !aiContent.clauses) {
    throw new Error("Invalid AI content structure");
  }

  const clauses = baseDraft.clauses.map(baseClause => {

    // Never overwrite SIGNATURE_BLOCK with AI text —
    // signatureResolver always builds this from user-provided variables
    if (baseClause.category === "SIGNATURE_BLOCK") {
      return baseClause;
    }

    const aiClause = aiContent.clauses.find(
      c => c.clause_id === baseClause.clause_id
    );

    if (aiClause && aiClause.text && aiClause.text.trim() !== "") {
      return {
        ...baseClause,
        title: aiClause.title || baseClause.title,
        text: aiClause.text
      };
    }

    return baseClause;

  });

  return {
    document_type: baseDraft.document_type,
    jurisdiction: "India",
    clauses
  };

}