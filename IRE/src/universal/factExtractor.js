export function extractFacts(document) {
  const text = document.clauses
    .map((c) => c.text)
    .join(" ")
    .toLowerCase();

  return {
    partiesCount:
      document.clauses.filter((c) => c.category === "IDENTITY").length > 0
        ? 2
        : 0,

    // hasConsideration: true if there is actual monetary consideration OR
    // mutual exchange language (NDA consideration = mutual disclosure obligations)
    hasConsideration:
      text.includes("salary") ||
      text.includes("fee") ||
      text.includes("payment") ||
      text.includes("loan amount") ||
      text.includes("rent") ||
      text.includes("capital contribution") ||
      /inr\s?[\d,]+/.test(text) ||           // actual INR amount
      /₹\s?[\d,]+/.test(text) ||             // ₹ amount
      /\d+\s*(lakh|crore|thousand)/.test(text), // written amounts

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
  };
}

function extractMoney(text) {
  const match = text.match(/inr\s?([\d,]+)/);
  return match ? parseInt(match[1].replace(/,/g, "")) : null;
}

function extractDuration(text) {
  // Look for explicit month durations in non-compete context only
  const nonCompeteSection = text.match(/non.?compete[\s\S]{0,300}/i)?.[0] || "";
  const match = nonCompeteSection.match(/(\d+)\s?(month|months|year|years)/i);
  if (match) {
    const val = parseInt(match[1]);
    return match[2].toLowerCase().startsWith("year") ? val * 12 : val;
  }
  return null;
}

function extractSeat(text) {
  const match = text.match(/seat.*?([a-z\s]+),\s?india/);
  return match ? match[1].trim() : null;
}

function extractNoticePeriod(text) {
  const m1 = text.match(/(\d+)\s*days?\s*(?:written|prior|clear)?\s*notice/i);
  if (m1) { const v = parseInt(m1[1]); if (v > 0 && v <= 365) return v; }

  const m2 = text.match(/notice\s+(?:period\s+of\s+)?(\d+)\s*days?/i);
  if (m2) { const v = parseInt(m2[1]); if (v > 0 && v <= 365) return v; }

  const m3 = text.match(/terminat[\w\s,]{0,30}?(\d+)\s*days?\s*notice/i);
  if (m3) { const v = parseInt(m3[1]); if (v > 0 && v <= 365) return v; }

  return null;
}