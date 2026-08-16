const NON_DISTINCTIVE_NAME_TOKENS = new Set([
  "m",
  "s",
  "mr",
  "mrs",
  "ms",
  "miss",
  "dr",
  "shri",
  "smt",
  "kumari",
  "the",
  "private",
  "pvt",
  "limited",
  "ltd",
  "company",
  "llp",
  "liability",
  "partnership",
  "firm",
  "proprietorship",
  "enterprise",
  "enterprises",
  "industries",
  "services",
  "solutions",
  "trading",
  "and",
  "co",
]);

export function normalizePartyName(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function partyNameAppears(haystack = "", name = "") {
  const normalizedHaystack = normalizePartyName(haystack);
  const normalizedName = normalizePartyName(name);
  if (!normalizedName) return true;
  if (normalizedHaystack.includes(normalizedName)) return true;

  const haystackWords = new Set(normalizedHaystack.split(" ").filter(Boolean));
  const tokens = normalizedName.split(" ").filter(Boolean);
  const distinctiveTokens = tokens.filter(
    (token) => token.length > 1 && !NON_DISTINCTIVE_NAME_TOKENS.has(token)
  );
  const tokensToCheck = distinctiveTokens.length ? distinctiveTokens : tokens;

  return tokensToCheck.every((token) => haystackWords.has(token));
}
