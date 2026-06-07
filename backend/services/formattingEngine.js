const RUPEE = "\u20b9";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

export function parseNumberish(value) {
  if (value === undefined || value === null || value === "") return null;
  const match = String(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBelowHundred(value) {
  if (value < 20) return ONES[value];
  const ten = Math.floor(value / 10);
  const one = value % 10;
  return [TENS[ten], ONES[one]].filter(Boolean).join(" ");
}

function formatBelowThousand(value) {
  const hundred = Math.floor(value / 100);
  const rest = value % 100;
  return [
    hundred ? `${ONES[hundred]} Hundred` : "",
    rest ? formatBelowHundred(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function amountToIndianWords(value) {
  const numeric = Math.round(Math.abs(Number(value)));
  if (!Number.isFinite(numeric)) return "";
  if (numeric === 0) return "Zero";

  const crore = Math.floor(numeric / 10000000);
  const lakh = Math.floor((numeric % 10000000) / 100000);
  const thousand = Math.floor((numeric % 100000) / 1000);
  const rest = numeric % 1000;

  return [
    crore ? `${formatBelowThousand(crore)} Crore` : "",
    lakh ? `${formatBelowThousand(lakh)} Lakh` : "",
    thousand ? `${formatBelowThousand(thousand)} Thousand` : "",
    rest ? formatBelowThousand(rest) : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatIndianAmount(value, { includeWords = false } = {}) {
  const numeric = parseNumberish(value);
  if (numeric === null) return "the agreed amount";
  const rounded = Math.round(numeric);
  const formatted = `${RUPEE}${rounded.toLocaleString("en-IN")}`;
  if (!includeWords) return formatted;
  return `${formatted} (Rupees ${amountToIndianWords(rounded)} Only)`;
}

export function formatFormalDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "the agreed date";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = parsed.toLocaleString("en-GB", { month: "long" });
  return `${day} ${month} ${parsed.getFullYear()}`;
}

export function normalizeCurrencyText(text = "", { includeWords = false } = {}) {
  return String(text || "").replace(
    /(?:\u20b9|\u00b9|â‚¹)\s*(-?\d[\d,\s]*(?:\.\d+)?)/g,
    (_match, amount, offset, source) => {
      const numeric = parseNumberish(amount);
      if (numeric === null) return _match;
      const tail = source.slice(offset + _match.length, offset + _match.length + 24);
      return formatIndianAmount(numeric, {
        includeWords: includeWords && !/^\s*\(Rupees\b/i.test(tail),
      });
    }
  );
}
