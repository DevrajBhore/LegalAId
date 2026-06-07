/**
 * clauseSearch.js
 *
 * Lightweight in-memory full-text search over the production clause library.
 * Builds a TF-based inverted index lazily on first query (the library is small,
 * ~150 clauses, so this is fast and needs no external search infrastructure).
 * Scoped to clause_library — the corpus that actually drives drafting.
 */
import { getAllClauses } from "./clauseAssembler.js";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "by", "with",
  "as", "at", "is", "are", "be", "shall", "such", "any", "this", "that", "which",
  "all", "from", "not", "no", "may", "其", "其他",
]);

let index = null; // { docs: Map<clause_id, doc>, postings: Map<term, Map<clause_id, tf>> }

function tokenize(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function buildIndex() {
  const docs = new Map();
  const postings = new Map();

  for (const clause of getAllClauses()) {
    const id = clause.clause_id;
    if (!id) continue;

    const fields = [
      clause.name,
      clause.title,
      clause.category,
      (clause.document_types || []).join(" "),
      clause.text,
    ].join(" ");

    docs.set(id, {
      clause_id: id,
      name: clause.name || clause.title || id,
      category: clause.category || null,
      document_types: clause.document_types || [],
      risk_level: clause.risk_level || null,
      enforceability: clause.enforceability || null,
      text: clause.text || "",
    });

    const termFreq = new Map();
    for (const token of tokenize(fields)) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }
    for (const [term, tf] of termFreq) {
      if (!postings.has(term)) postings.set(term, new Map());
      postings.get(term).set(id, tf);
    }
  }

  index = { docs, postings };
  return index;
}

function getIndex() {
  return index || buildIndex();
}

function snippet(text, queryTokens, length = 220) {
  if (!text) return "";
  const lower = text.toLowerCase();
  let pos = -1;
  for (const token of queryTokens) {
    const at = lower.indexOf(token);
    if (at !== -1 && (pos === -1 || at < pos)) pos = at;
  }
  const start = pos === -1 ? 0 : Math.max(0, pos - 40);
  const text2 = text.slice(start, start + length).trim();
  return (start > 0 ? "…" : "") + text2 + (start + length < text.length ? "…" : "");
}

export function searchClauses(query, { limit = 20, documentType = null } = {}) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { query, count: 0, results: [] };

  const { docs, postings } = getIndex();
  const totalDocs = docs.size || 1;
  const scores = new Map();

  for (const token of queryTokens) {
    const posting = postings.get(token);
    if (!posting) continue;
    // idf damps very common terms.
    const idf = Math.log(1 + totalDocs / posting.size);
    for (const [id, tf] of posting) {
      // Weight name/category matches higher than body via a small boost.
      const doc = docs.get(id);
      const boost =
        (doc.name && doc.name.toLowerCase().includes(token)) ||
        (doc.category && doc.category.toLowerCase().includes(token))
          ? 2.5
          : 1;
      scores.set(id, (scores.get(id) || 0) + tf * idf * boost);
    }
  }

  let ranked = [...scores.entries()]
    .map(([id, score]) => ({ ...docs.get(id), score: Number(score.toFixed(3)) }));

  if (documentType) {
    const wanted = String(documentType).toUpperCase();
    ranked = ranked.filter(
      (doc) =>
        doc.document_types.includes("ALL") ||
        doc.document_types.map((t) => t.toUpperCase()).includes(wanted)
    );
  }

  ranked.sort((a, b) => b.score - a.score);
  const results = ranked.slice(0, limit).map((doc) => ({
    clause_id: doc.clause_id,
    name: doc.name,
    category: doc.category,
    document_types: doc.document_types,
    risk_level: doc.risk_level,
    enforceability: doc.enforceability,
    score: doc.score,
    snippet: snippet(doc.text, queryTokens),
  }));

  return { query, count: ranked.length, results };
}

export function clearSearchIndex() {
  index = null;
}
