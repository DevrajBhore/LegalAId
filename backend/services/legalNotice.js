// The one legal notice, printed into every export. The frontend keeps an identical
// copy in frontend/src/data/legalNotice.js (it deploys on its own and cannot
// import from here); tests/legalNotice.test.mjs fails if the two differ.
//
// Wording is a placeholder for the reviewing advocate to settle. It states facts
// about the product; it makes no claim about the documents' legal effect.

export const LEGAL_NOTICE_TITLE = "Not legal advice";

export const LEGAL_NOTICE =
  "LegalAId is software, not a law firm, and does not provide legal advice. Documents are drafted from a clause library and user answers, with AI used to tailor wording. The clause library has not yet been reviewed by an advocate, and a draft may contain errors or omissions. Have a qualified advocate review any document before you sign or rely on it.";

// Versions of the live Terms and Privacy pages a user accepts at sign-up. Bump
// when either page changes; the value is stored on the user with the time.
export const TERMS_VERSION = "2026-09-26";
export const PRIVACY_VERSION = "2026-09-26";

export const MINIMUM_AGE = 18;
