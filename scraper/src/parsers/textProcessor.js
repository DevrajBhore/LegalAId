// scraper/src/parsers/textProcessor.js
import WinkTokenizer from "wink-tokenizer";
const tokenizer = new WinkTokenizer();

/**
 * cleanText: normalize whitespace and remove weird control chars
 */
export function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * splitSections: try to split document into sections using common patterns.
 * This is heuristic: sections may be "Section 1", "1.", "1.1", "CHAPTER I" etc.
 */
export function splitSections(text) {
  const cleaned = cleanText(text);

  // Split on occurrences of 'Section <number>' or 'Sec. <num>' or 'CHAPTER ' (case-insensitive)
  const parts = cleaned.split(/(?:(?:Section|Sec\.?)\s*\d+)|(?:(?:CHAPTER|Chapter)\s+[IVXLC]+)|(?=\n{2,})/i);

  // fallback: split by double newline-like sequences or by long paragraphs
  const fallback = cleaned.split(/\n{2,}|\r{2,}/).map(s => s.trim());

  const result = parts
    .map(p => cleanText(p))
    .filter(p => p && p.length > 20);

  return result.length ? result : fallback.filter(p => p && p.length > 20);
}

/**
 * extractKeywords: simple high-frequency token extraction skipping stopwords.
 * Uses wink-tokenizer which is fast and pure-js.
 */
const STOPWORDS = new Set([
  "the","and","that","for","with","this","from","are","was","were","was","will","shall",
  "have","has","had","not","but","you","your","they","their","its","which","such","any",
  "all","may","been","being","can","could","would","should","may","also"
]);

export function extractKeywords(text, max = 40) {
  if (!text) return [];
  const tokens = tokenizer.tokenize(text.toLowerCase());
  // select words only (remove punctuation, numerics)
  const words = tokens
    .filter(t => t.tag === "word")
    .map(t => t.value)
    .filter(w => w.length > 3 && !STOPWORDS.has(w));

  // frequency map
  const freq = Object.create(null);
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  return Object.entries(freq)
    .sort((a,b) => b[1] - a[1])
    .slice(0, max)
    .map(e => e[0]);
}
