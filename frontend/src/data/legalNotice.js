// The one legal notice. Shown on the form, the editor, the footer, sign-up, and
// printed into every export. The backend keeps an identical copy in
// backend/services/legalNotice.js (the frontend deploys on its own, so it cannot
// import from the backend); tests/legalNotice.test.mjs fails if the two differ.
//
// Wording is a placeholder for the reviewing advocate to settle. It states facts
// about the product; it makes no claim about the documents' legal effect.

export const LEGAL_NOTICE_TITLE = "Not legal advice";

export const LEGAL_NOTICE =
  "LegalAId is software, not a law firm, and does not provide legal advice. Documents are drafted from a clause library and user answers, with AI used to tailor wording. The clause library has not yet been reviewed by an advocate, and a draft may contain errors or omissions. Have a qualified advocate review any document before you sign or rely on it.";

export const LEGAL_NOTICE_SHORT =
  "LegalAId is software, not a law firm, and does not give legal advice. Have an advocate review any document before you rely on it.";

export const AI_PROCESSING_NOTICE =
  "What you enter here is sent to our AI provider (Google Gemini, or Groq as a fallback), which processes it outside India to draft your document. It will include details about the other parties to the document, so only enter information you are entitled to share.";

export const MINIMUM_AGE = 18;
