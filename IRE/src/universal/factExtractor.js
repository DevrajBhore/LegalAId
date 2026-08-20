export function extractFacts(document) {
  const clauses = document?.clauses || [];
  const text = clauses
    .map((c) => c.text)
    .join(" ")
    .toLowerCase();
  const sourceVariables =
    document?.metadata?.source_variables || document?.source_variables || {};
  const identityText = clauses
    .filter((clause) => clause.category === "IDENTITY")
    .map((clause) => clause.text || "")
    .join(" ");
  const signatureText = clauses
    .filter((clause) => clause.category === "SIGNATURE_BLOCK")
    .map((clause) => clause.text || "")
    .join(" ");

  const hasNegativeConsiderationLanguage =
    /without consideration|no consideration|nil consideration/.test(text);

  const hasNonMonetaryConsiderationLanguage =
    !hasNegativeConsiderationLanguage &&
    (/in consideration of/.test(text) ||
      /lawful consideration/.test(text) ||
      /good and valuable consideration/.test(text) ||
      /mutual covenants/.test(text) ||
      /mutual promises/.test(text) ||
      /mutual obligations/.test(text) ||
      /receipt and sufficiency/.test(text));

  return {
    partiesCount: clauses.filter((c) => c.category === "IDENTITY").length > 0 ? 2 : 0,

    // Monetary consideration or standard contract exchange language.
    hasConsideration:
      text.includes("salary") ||
      text.includes("fee") ||
      text.includes("payment") ||
      text.includes("loan amount") ||
      text.includes("rent") ||
      text.includes("capital contribution") ||
      hasNonMonetaryConsiderationLanguage ||
      /inr\s?[\d,]+/.test(text) ||
      /â‚¹\s?[\d,]+/.test(text) ||
      /\d+\s*(lakh|crore|thousand)/.test(text),

    considerationValue: extractMoney(text),

    hasNonCompete:
      text.includes("non-compete") ||
      text.includes("restraint of trade") ||
      text.includes("shall not engage") ||
      text.includes("shall not directly or indirectly engage"),

    nonCompeteDurationMonths: extractDuration(text),

    hasArbitration: text.includes("arbitration") || text.includes("arbitrator"),

    arbitrationSeat: extractSeat(text),

    terminationNoticeDays: extractNoticePeriod(text),

    hasIndemnity: text.includes("indemnify") || text.includes("indemnity"),
    corporatePartyDetected: detectCorporateParty({
      sourceVariables,
      identityText,
      signatureText,
    }),
    authorityEstablished: detectAuthorityEstablished({
      sourceVariables,
      identityText,
      signatureText,
    }),
  };
}

// Every entity-type field the intake may carry, whatever the document type names
// its parties. The list used to be hardcoded to party_1/party_2/shareholder/
// guarantor, so a partnership deed (partner_1_type) or an employment contract
// (employer_type) was never recognised as having a corporate party at all.
function collectPartyTypes(sourceVariables = {}) {
  return Object.entries(sourceVariables)
    .filter(([key, value]) => /_type$/.test(key) && value)
    .filter(([key]) =>
      /^(?:party_\d+|partner_\d+|shareholder_\d+|employer|employee|guarantor|lender|borrower|licensor|licensee|landlord|tenant|buyer|seller|purchaser|vendor|supplier|discloser|recipient|distributor|principal|creditor|contractor|consultant|client)_type$/.test(
        key
      )
    )
    .map(([, value]) => String(value).toLowerCase());
}

function detectCorporateParty({ sourceVariables = {}, identityText = "", signatureText = "" }) {
  const partyTypes = collectPartyTypes(sourceVariables);

  if (
    partyTypes.some(
      (value) =>
        !value.includes("individual") &&
        !value.includes("sole proprietor") &&
        !value.includes("sole proprietorship")
    )
  ) {
    return true;
  }

  const partyContext = `${identityText} ${signatureText}`.toLowerCase();
  return /\b(private limited|pvt\.?\s*ltd|public limited|limited liability partnership|llp|company|corporation|body corporate)\b/i.test(
    partyContext
  );
}

function detectAuthorityEstablished({
  sourceVariables = {},
  identityText = "",
  signatureText = "",
}) {
  const partyContext = `${identityText} ${signatureText}`.toLowerCase();

  if (collectPartyTypes(sourceVariables).length) {
    if (
      /\b(for and on behalf of|authorized signatory|authorised signatory|authorized representative|authorised representative|represented by|duly authorized|duly authorised)\b/i.test(
        partyContext
      )
    ) {
      return true;
    }
  }

  return /\b(board resolution|power of attorney|authorized signatory|authorised signatory|authorized representative|authorised representative|represented by|duly authorized|duly authorised|for and on behalf of)\b/i.test(
    partyContext
  );
}

function extractMoney(text) {
  const match = text.match(/inr\s?([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, ""), 10) : null;
}

function extractDuration(text) {
  const nonCompeteSection = text.match(/non.?compete[\s\S]{0,300}/i)?.[0] || "";
  const match = nonCompeteSection.match(/(\d+)\s?(month|months|year|years)/i);
  if (match) {
    const value = parseInt(match[1], 10);
    return match[2].toLowerCase().startsWith("year") ? value * 12 : value;
  }
  return null;
}

function extractSeat(text) {
  const match = text.match(/seat.*?([a-z\s]+),\s?india/);
  return match ? match[1].trim() : null;
}

function extractNoticePeriod(text) {
  const m1 = text.match(/\(?(\d+)\)?\s*days?(?:['’])?\s*(?:written|prior|clear)?\s*notice/i);
  if (m1) {
    const value = parseInt(m1[1], 10);
    if (value > 0 && value <= 365) return value;
  }

  const m2 = text.match(/notice\s+(?:period\s+of\s+)?(\d+)\s*days?/i);
  if (m2) {
    const value = parseInt(m2[1], 10);
    if (value > 0 && value <= 365) return value;
  }

  const m3 = text.match(/terminat[\w\s,]{0,30}?\(?(\d+)\)?\s*days?\s*notice/i);
  if (m3) {
    const value = parseInt(m3[1], 10);
    if (value > 0 && value <= 365) return value;
  }

  return null;
}
