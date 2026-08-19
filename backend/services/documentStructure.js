/**
 * documentStructure.js
 *
 * The anatomy of a deed, as data.
 *
 * The export layer used to reconstruct the shape of the instrument by testing
 * each line of the identity clause against regexes -- `/^BY AND BETWEEN$/i`,
 * `/^WHEREAS[,:\s]/i`, `/of the (First|Second) Part/i` -- and it did this THREE
 * times, once in the DOCX renderer, once in the PDF renderer and once (by
 * omission) in the plain-text renderer. Three parsers meant three places to fix
 * a bug and three chances to disagree, and the whole scheme depended on prose
 * that a different module happened to have written in a particular layout.
 *
 * Parsing happens once, here, into an explicit structure:
 *
 *   { title, testatum, parties[], recitals[], operative[], testimonium,
 *     execution, schedules[] }
 *
 * Renderers consume the structure. When the identity clause is NOT in the
 * expected shape -- a document type with no formal opening, or text supplied by
 * a model -- `parsed` is false and the raw lines are preserved, so a renderer
 * can fall back rather than silently emitting a blank opening.
 */

import { normalizeClauseCategory } from "../config/clauseOrder.js";

const SCHEDULE_CATEGORIES = new Set(["SCHEDULE", "ANNEXURE", "SPECIFICATIONS"]);
const SCHEDULE_TITLE_PATTERN =
  /\b(schedule|annexure|appendix|specification|approved materials)\b/i;

// "A. WHEREAS, x" / "(B) AND WHEREAS, y" / "WHEREAS, z"
const RECITAL_PATTERN =
  /^(?:(?:\(([A-Z])\)|([A-Z])[.,)])\s+)?((?:AND\s+)?WHEREAS[,:]?\s+)(.*)$/i;
const LETTERED_RECITAL_PATTERN = /^\(([A-Z])\)\s+(.*)$/;
const PARTY_LINE_PATTERN = /of the\s+(First|Second|Third|Fourth|Other)\s+Part[;.]?$/i;
const OPENING_PATTERN = /^THIS\s+[A-Z][A-Z\s]*\(?/;
const TESTATUM_PATTERN = /^NOW[,\s]+(THEREFORE|WITNESSETH)/i;
const CONNECTIVE_PATTERN = /^(BY AND BETWEEN|AND|BETWEEN)$/i;

function isScheduleLikeClause(clause = {}) {
  return (
    SCHEDULE_CATEGORIES.has(normalizeClauseCategory(clause?.category)) ||
    SCHEDULE_TITLE_PATTERN.test(String(clause?.title || "").trim())
  );
}

/**
 * Splits the identity clause into its constituent parts. Returns
 * `{ parsed: false, lines }` when the text does not look like a formal opening,
 * so the caller can render it as an ordinary paragraph instead of dropping it.
 */
export function parseIdentityClause(text = "") {
  const lines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim());

  const structure = {
    parsed: false,
    opening: null,      // "THIS AGREEMENT ... is made and executed at Pune on ..."
    connectives: [],    // BY AND BETWEEN / AND, in the order they appeared
    parties: [],        // { text, part }
    collective: null,   // 'The X and the Y are collectively referred to as ...'
    recitals: [],       // { label, lead, text }
    testatum: null,     // NOW, THEREFORE ...
    other: [],          // anything unrecognised, preserved in order
    // The same content as an ORDERED list, so a renderer can walk it without
    // having to reconstruct the sequence (opening, BY AND BETWEEN, first party,
    // AND, second party, collective, recitals, testatum).
    blocks: [],
    lines,
  };

  for (const line of lines) {
    if (!line) continue;

    if (!structure.opening && OPENING_PATTERN.test(line)) {
      structure.opening = line;
      structure.blocks.push({ type: "opening", text: line });
      continue;
    }

    if (CONNECTIVE_PATTERN.test(line)) {
      structure.connectives.push(line.toUpperCase());
      structure.blocks.push({ type: "connective", text: line.toUpperCase() });
      continue;
    }

    // Bare "WHEREAS" on its own line is a heading with no content.
    if (/^WHEREAS[,:.]*$/i.test(line)) continue;

    const partyMatch = line.match(PARTY_LINE_PATTERN);
    if (partyMatch) {
      structure.parties.push({ text: line, part: partyMatch[1] });
      structure.blocks.push({ type: "party", text: line, part: partyMatch[1] });
      continue;
    }

    const recital = line.match(RECITAL_PATTERN);
    if (recital) {
      const letter = recital[1] || recital[2];
      const parsedRecital = {
        label: letter ? `${letter.toUpperCase()}. ` : "",
        lead: recital[3],
        text: recital[4] || "",
      };
      structure.recitals.push(parsedRecital);
      structure.blocks.push({ type: "recital", ...parsedRecital });
      continue;
    }

    // A lettered recital that does not spell out WHEREAS. Parenthesised form
    // only: a bare "A. " would swallow a party line for an initialled name such
    // as "A. K. Sharma & Co, ... of the First Part;".
    const lettered = line.match(LETTERED_RECITAL_PATTERN);
    if (lettered) {
      const letteredRecital = {
        label: `${lettered[1].toUpperCase()}. `,
        lead: "WHEREAS, ",
        text: lettered[2] || "",
      };
      structure.recitals.push(letteredRecital);
      structure.blocks.push({ type: "recital", ...letteredRecital });
      continue;
    }

    if (TESTATUM_PATTERN.test(line)) {
      structure.testatum = line;
      structure.blocks.push({ type: "testatum", text: line });
      continue;
    }

    if (/collectively referred to as/i.test(line)) {
      structure.collective = line;
      structure.blocks.push({ type: "collective", text: line });
      continue;
    }

    structure.other.push(line);
    structure.blocks.push({ type: "text", text: line });
  }

  // "Formal opening" means it at least introduces the parties in the deed form.
  structure.parsed = Boolean(
    structure.opening && (structure.parties.length > 0 || structure.connectives.length > 0)
  );

  return structure;
}

/**
 * The whole instrument as data. `identity` is the parsed opening; `operative`,
 * `execution` and `schedules` are the clause groups in the order they belong.
 */
export function buildDocumentStructure(draft, { sortClauses } = {}) {
  const rawClauses = (draft?.clauses || []).filter((clause) => clause?.text?.trim());
  const clauses = typeof sortClauses === "function" ? sortClauses(rawClauses) : rawClauses;

  const identityClause =
    clauses.find((clause) => normalizeClauseCategory(clause.category) === "IDENTITY") || null;
  const executionClauses = clauses.filter(
    (clause) => normalizeClauseCategory(clause.category) === "SIGNATURE_BLOCK"
  );
  const scheduleClauses = clauses.filter((clause) => isScheduleLikeClause(clause));
  const operativeClauses = clauses.filter((clause) => {
    const category = normalizeClauseCategory(clause.category);
    return (
      category !== "IDENTITY" &&
      category !== "SIGNATURE_BLOCK" &&
      !isScheduleLikeClause(clause)
    );
  });

  return {
    documentType: draft?.document_type || null,
    identityClause,
    identity: identityClause ? parseIdentityClause(identityClause.text) : null,
    operative: operativeClauses,
    execution: executionClauses,
    schedules: scheduleClauses,
  };
}

export { isScheduleLikeClause };
