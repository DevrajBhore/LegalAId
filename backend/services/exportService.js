import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  Tab,
  TabStopPosition,
  TabStopType,
  TextRun,
  convertInchesToTwip,
} from "docx";
import fs from "fs";
import PDFDocument from "pdfkit";
import { parseIdentityClause } from "./documentStructure.js";
import { getDocumentDisplayName } from "../../shared/documentRegistry.js";
import {
  normalizeClauseCategory,
  sortClausesByOrder,
} from "../config/clauseOrder.js";

// ── Typography (Indian transactional-drafting convention) ───────────────────
// Body 11-12 pt, section headings 12-14 pt, title 14-16 pt, all Times New
// Roman, justified, 1.15 line spacing. Paragraph separation is carried by
// space-after rather than empty paragraphs: a blank paragraph is a gap an
// unauthorised party can type into after execution, and it makes the gaps
// between clauses uneven, which pushes text onto extra pages and complicates
// stamp-duty page counts and registry binding.
const BODY_FONT = "Times New Roman";
const BODY_SIZE = 24; // 12 pt (half-points)
const TITLE_SIZE = 30; // 15 pt
const SECTION_HEADING_SIZE = 26; // 13 pt
const FOOTER_SIZE = 18; // 9 pt
const BODY_LINE_SPACING = 276; // 1.15 lines (276 / 240)
const QUOTE_LINE_SPACING = 240; // single — statutory quotes and citations
const BODY_AFTER_SPACING = 120; // 6 pt after each paragraph
const SECTION_AFTER_SPACING = 160; // 8 pt
const RECITAL_LEFT = 360;
const OPERATIVE_LEFT = 360;
const CLAUSE_HEADING_LEFT = 360;
const CLAUSE_HEADING_HANGING = 360;
const CLAUSE_ITEM_LEFT = 720;
const CLAUSE_ITEM_HANGING = 360;
const SIGNATURE_LEFT = 360;

// ── PDF geometry ────────────────────────────────────────────────────────────
// Mirrors the DOCX grid exactly so the same draft lays out identically in both
// formats. DOCX indents are twips, PDF indents are points: 20 twips = 1 pt, so
// RECITAL_LEFT (360 tw) is PDF_L1 (18 pt) — the same quarter inch.
const PDF_MARGIN = 72; // 1 in
const PDF_PAGE_WIDTH = 595.28; // A4
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const PDF_TITLE_SIZE = 15;
const PDF_HEADING_SIZE = 13;
const PDF_BODY_SIZE = 12;
const PDF_REF_SIZE = 9;
const PDF_L1 = 18; // 0.25 in — recitals, parties, clause body
const PDF_L2 = 36; // 0.50 in — lettered sub-items
const PDF_HANGING = 18; // 0.25 in — hanging indent for numbered leads
const PDF_ITEM_HANGING = 28.8; // 0.40 in — label column for decimal sub-clauses
const PDF_LINE_GAP = 1.8; // 12 pt x 1.15 line spacing
const PDF_PARA_GAP = 6; // 6 pt after each paragraph
const PDF_BLOCK_GAP = 10; // between structural blocks

// The first page of a stampable instrument must leave the top of the sheet
// clear for physical stamp paper or the e-stamp certificate header block.
const STAMP_HEADER_RESERVE_IN = 3;
const SCHEDULE_CATEGORIES = new Set(["SCHEDULE", "ANNEXURE", "SPECIFICATIONS"]);
const STYLE_ID = {
  title: "LegalTitle",
  sectionHeading: "LegalSectionHeading",
  body: "LegalBody",
  recital: "LegalRecital",
  heading: "LegalClauseHeading",
  item: "LegalClauseItem",
  signature: "LegalSignature",
};

export const SUPPORTED_EXPORT_FORMATS = new Set(["docx", "pdf", "txt"]);

function formatDocTitle(docType) {
  return getDocumentDisplayName((docType || "").toUpperCase());
}

export function normalizeExportFormat(format = "docx") {
  const normalized = String(format || "docx")
    .trim()
    .toLowerCase();
  return SUPPORTED_EXPORT_FORMATS.has(normalized) ? normalized : null;
}

// Document types that attract stamp duty need the top of page 1 kept clear for
// the stamp paper / e-stamp certificate. Read from the same rules file the
// stamp validator uses so the two never drift apart.
let stampDocTypesCache = null;

function stampableDocTypes() {
  if (stampDocTypesCache === null) {
    try {
      const raw = fs.readFileSync(
        new URL("../../knowledge-base/rules/stamp_duty.rules.json", import.meta.url),
        "utf8"
      );
      const parsed = JSON.parse(raw);
      stampDocTypesCache = new Set(
        (parsed.mandatory_stamp_doctypes || []).map((entry) =>
          String(entry).toUpperCase()
        )
      );
    } catch {
      stampDocTypesCache = new Set();
    }
  }
  return stampDocTypesCache;
}

function requiresStampHeader(docType) {
  return stampableDocTypes().has(String(docType || "").toUpperCase());
}

// ── PDF text sanitising ─────────────────────────────────────────────────────
//
// pdfkit's built-in Times faces are WinAnsi (CP1252) encoded, and CP1252 has no
// Indian Rupee sign (U+20B9). Every "₹" in a generated PDF was therefore
// rendering as a superscript "¹" — so the consideration clause of a contract
// silently lost its currency symbol, while the DOCX of the same draft was fine.
// Rather than embed a Unicode face (which would mean shipping a font, or
// depending on one being installed on whatever host runs this), the PDF path
// uses "Rs." — the long-standing and equally correct form in Indian
// instruments, and one that keeps the mandated Times New Roman typeface.
const PDF_TEXT_SUBSTITUTIONS = [
  [/\u20B9\s*/g, "Rs. "], // ₹ Indian Rupee sign
  [/\u20A8\s*/g, "Rs. "], // ₨ legacy rupee sign
  [/[\u2010\u2011\u2212]/g, "-"], // hyphen / non-breaking hyphen / minus
  [/\u00A0/g, " "], // non-breaking space
];

// Anything still outside CP1252 after substitution cannot be drawn by the
// built-in faces and would render as a wrong glyph rather than as nothing, so
// it is dropped deliberately instead of corrupting the text silently.
const PDF_UNSUPPORTED = /[^\u0000-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]/g;

function pdfSafeText(value) {
  let text = String(value ?? "");
  for (const [pattern, replacement] of PDF_TEXT_SUBSTITUTIONS) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(PDF_UNSUPPORTED, "");
}

// ── PDF paragraph primitive ─────────────────────────────────────────────────
//
// pdfkit's `indent` option shifts only the FIRST line of a paragraph. The
// renderer previously passed `{ indent: 54 }`, which inset the opening line by
// three quarters of an inch and let every wrapped line fall back to the margin
// — so party descriptions, recitals and lettered sub-items all appeared to
// start in the wrong place and their continuations ran ragged against the body
// text. Passing an explicit x and width instead indents the whole block, and a
// negative `indent` on top of that produces a true hanging indent, so "(a)"
// sits proud of the text it introduces and the wrapped lines align beneath it.
function pdfParagraph(doc, segments, options = {}) {
  const runs = (Array.isArray(segments) ? segments : [{ text: segments }]).filter(
    (run) => run && String(run.text ?? "").length > 0
  );
  if (!runs.length) return;

  const left = options.left ?? 0;
  const hanging = options.hanging ?? 0;
  const x = PDF_MARGIN + left;
  const width = PDF_CONTENT_WIDTH - left;
  const align = options.align || "justify";
  const size = options.size ?? PDF_BODY_SIZE;
  const lineGap = options.lineGap ?? PDF_LINE_GAP;

  // Don't open a paragraph in the last sliver of a page.
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y >= bottom - size * 2) doc.addPage();

  runs.forEach((run, index) => {
    const isFirst = index === 0;
    const isLast = index === runs.length - 1;
    const font = run.bold
      ? "Times-Bold"
      : run.italic
        ? "Times-Italic"
        : "Times-Roman";

    doc.font(font).fontSize(run.size ?? size);
    if (run.color) doc.fillColor(run.color);

    const textOptions = {
      width,
      align,
      lineGap,
      indent: isFirst && hanging ? -hanging : 0,
      continued: !isLast,
    };

    // pdfkit only honours the options object in the 4-argument form, so x and y
    // must both be passed explicitly even though y is just the current cursor.
    const safe = pdfSafeText(run.text);
    if (isFirst) doc.text(safe, x, doc.y, textOptions);
    else doc.text(safe, textOptions);

    if (run.color) doc.fillColor("black");
  });

  doc.y += options.after ?? PDF_PARA_GAP;
  doc.x = PDF_MARGIN;
}

// Splits "THIS AGREEMENT (...)" style openings into a bold lead-in plus the
// remainder, matching how the DOCX renderer builds the same line.
function pdfLeadRuns(text, leadPattern, fallbackLead = "") {
  const source = String(text || "").trim();
  const match = source.match(leadPattern);
  if (!match) {
    return fallbackLead
      ? [{ text: fallbackLead, bold: true }, { text: source }]
      : [{ text: source }];
  }
  // pdfkit drops leading whitespace on a `continued` fragment, so a space that
  // separates the bold lead-in from what follows disappears at render time and
  // the page reads "THIS AGREEMENT("Agreement")". Move that space onto the end
  // of the lead, where it survives.
  const remainder = source.slice(match[1].length);
  const gap = /^\s/.test(remainder) ? " " : "";
  return [
    { text: `${match[1]}${gap}`, bold: true },
    { text: remainder.replace(/^\s+/, "") },
  ];
}

function buildBodyRun(text, options = {}) {
  return new TextRun({
    text,
    font: BODY_FONT,
    size: BODY_SIZE,
    ...options,
  });
}

function buildSectionHeading(text, options = {}) {
  return new Paragraph({
    style: STYLE_ID.sectionHeading,
    alignment: AlignmentType.CENTER,
    spacing: {
      before: options.before ?? 260,
      after: options.after ?? SECTION_AFTER_SPACING,
      line: BODY_LINE_SPACING,
    },
    children: [
      buildBodyRun(String(text || "").toUpperCase(), {
        bold: true,
        size: SECTION_HEADING_SIZE,
      }),
    ],
  });
}

function buildBlankParagraph(options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? BODY_AFTER_SPACING },
    children: [],
    style: options.style || STYLE_ID.body,
    ...options,
  });
}

function buildRunsWithSuperscriptOrdinals(text, options = {}) {
  const source = String(text || "");
  const runs = [];
  const ordinalPattern = /(\d+)(st|nd|rd|th)\b/g;
  let cursor = 0;

  for (const match of source.matchAll(ordinalPattern)) {
    const [fullMatch, digits, suffix] = match;
    const index = match.index ?? 0;
    const before = source.slice(cursor, index);
    if (before) {
      runs.push(buildBodyRun(before, options));
    }

    runs.push(buildBodyRun(digits, options));
    runs.push(
      buildBodyRun(suffix, {
        ...options,
        size: Math.max((options.size || BODY_SIZE) - 4, 18),
        superScript: true,
      })
    );

    cursor = index + fullMatch.length;
  }

  const after = source.slice(cursor);
  if (after || runs.length === 0) {
    runs.push(buildBodyRun(after, options));
  }

  return runs;
}

function buildOpeningLineRuns(line) {
  const source = String(line || "").trim();
  const match = source.match(/^(THIS\s+[A-Z\s]+?)(\s*\(.*)$/);

  if (!match) {
    return buildRunsWithSuperscriptOrdinals(source);
  }

  return [
    ...buildRunsWithSuperscriptOrdinals(match[1], { bold: true }),
    ...buildRunsWithSuperscriptOrdinals(match[2]),
  ];
}

function buildLeadInRuns(line, leadPattern) {
  const source = String(line || "").trim();
  const match = source.match(leadPattern);
  if (!match) {
    return [buildBodyRun(source)];
  }

  const lead = match[1];
  const remainder = source.slice(lead.length);
  const runs = [buildBodyRun(lead, { bold: true })];
  if (remainder) {
    runs.push(...buildRunsWithSuperscriptOrdinals(remainder));
  }
  return runs;
}

function buildPartyParagraphRuns(line) {
  let remainder = String(line || "").trim();
  const runs = [];

  const roleMatch = remainder.match(/^(.*?referred to as the\s+[“"])([^"”]+)([”"].*)$/i);
  if (roleMatch) {
    runs.push(...buildRunsWithSuperscriptOrdinals(roleMatch[1]));
    runs.push(...buildRunsWithSuperscriptOrdinals(roleMatch[2], { bold: true }));
    remainder = roleMatch[3];
  }

  const partMatch = remainder.match(/^(.*?)(of the\s+(?:First|Second|Third|Other)\s+Part[;.]?)$/i);
  if (partMatch) {
    if (partMatch[1]) {
      runs.push(...buildRunsWithSuperscriptOrdinals(partMatch[1]));
    }
    runs.push(...buildRunsWithSuperscriptOrdinals(partMatch[2], { bold: true }));
    return runs;
  }

  if (remainder) {
    runs.push(...buildRunsWithSuperscriptOrdinals(remainder));
  }

  return runs;
}

function buildBodyParagraph(text, options = {}) {
  return new Paragraph({
    style: options.style || STYLE_ID.body,
    alignment: AlignmentType.JUSTIFIED,
    spacing: {
      after: options.after ?? BODY_AFTER_SPACING,
      line: BODY_LINE_SPACING,
    },
    children: buildRunsWithSuperscriptOrdinals(text),
    indent: options.indent || undefined,
    keepLines: options.keepLines || undefined,
    ...options,
  });
}

function splitDocumentClauses(clauses = []) {
  const orderedClauses = sortClausesByOrder(
    clauses.filter((clause) => clause?.text?.trim())
  );

  return {
    identityClause:
      orderedClauses.find(
        (clause) => normalizeClauseCategory(clause.category) === "IDENTITY"
      ) || null,
    bodyClauses: orderedClauses.filter((clause) => {
      const category = normalizeClauseCategory(clause.category);
      return (
        category !== "IDENTITY" &&
        category !== "SIGNATURE_BLOCK" &&
        !isScheduleLikeClause(clause)
      );
    }),
    scheduleClauses: orderedClauses.filter((clause) => isScheduleLikeClause(clause)),
    signatureClauses: orderedClauses.filter(
      (clause) => normalizeClauseCategory(clause.category) === "SIGNATURE_BLOCK"
    ),
  };
}

function isScheduleLikeClause(clause = {}) {
  const category = normalizeClauseCategory(clause?.category);
  const title = String(clause?.title || "").trim();
  return (
    SCHEDULE_CATEGORIES.has(category) ||
    /\b(schedule|annexure|appendix|specification|approved materials)\b/i.test(title)
  );
}

const SUBPART_MARKER =
  /^(\(?[a-zA-Z0-9ivxlcdmIVXLCDM]{1,5}\)|\(?[a-zA-Z0-9ivxlcdmIVXLCDM]{1,5}[.)]|[-*\u2022])\s+/;

function isStructuredSubpartLine(line = "") {
  return SUBPART_MARKER.test(String(line || ""));
}

// Splits a clause into renderable blocks and records the outline depth of each,
// so the renderers can apply decimal sub-clause numbering (5.1, 5.2, 5.2.1) in
// place of whatever ad-hoc "(a)" / "(i)" markers the clause text carries.
// Depth is taken from leading indentation: a limb indented by two or more
// spaces is a sub-limb of the one above it.
function tokenizeClauseText(text = "") {
  const blocks = [];

  for (const paragraph of String(text || "")
    .trim()
    .split(/\n{2,}/)) {
    const lines = paragraph.split(/\n/).filter((line) => line.trim());
    if (!lines.length) continue;

    const soleLine = lines.length === 1;

    for (const line of lines) {
      const indent = (line.match(/^[ \t]*/) || [""])[0].replace(/\t/g, "  ").length;
      const trimmed = line.trim();
      const marker = trimmed.match(SUBPART_MARKER);
      const isItem = Boolean(marker) || (!soleLine && indent >= 2);

      const body = marker ? trimmed.slice(marker[0].length) : trimmed;

      blocks.push({
        type: isItem ? "item" : "paragraph",
        depth: indent >= 2 ? 2 : 1,
        text: isItem ? toSentenceLimb(body) : toSentenceParagraph(trimmed),
        body: isItem ? toSentenceLimb(body) : toSentenceParagraph(body),
      });
    }
  }

  return blocks;
}

// Every enumerated limb is set as one sentence: initial capital, terminal full
// stop. Limbs arrive in three different conventions -- library clause text
// writes them lower-case with no terminator, the hardening builders write them
// in sentence case, and limbs derived from what the user typed keep whatever
// case the user typed -- so a single agreement could show "4.1 neither Party
// shall", "6.1 Provide strategic advisory" and "7.2 quarterly workshops" on
// facing pages. Normalising at this seam rather than at each source means one
// convention reaches both renderers whatever the limb was built from.
const SENTENCE_END = /[.!?]["'\u2019\u201d)\]]?$/;
const TRAILING_CONJUNCTION = /[,;]\s*(?:and|or)\s*$/i;
// "s. 74 of the Act" must not become "S. 74"; a statutory reference opening a
// limb is a citation, not a sentence.
const STATUTE_LEAD = /^s{1,2}\.\s*\d/i;

function toSentenceLimb(value = "") {
  let text = String(value || "").trim();
  if (!text) return text;

  // A limb written for a semicolon-style list carries its conjunction in the
  // terminator. Decimal sub-numbering already makes the list structure
  // explicit, so a trailing "; and" is dropped rather than left stranded at the
  // end of what is now a sentence.
  text = text.replace(TRAILING_CONJUNCTION, "").replace(/[,;:]\s*$/, "").trim();
  if (!text) return text;

  const index = text.search(/[A-Za-z]/);
  // Only capitalise when nothing but punctuation precedes the first letter, so
  // an opening quote on a defined term is stepped over but "18% shall" is left
  // alone rather than becoming "18% Shall".
  if (
    index !== -1 &&
    /[a-z]/.test(text[index]) &&
    !/[0-9]/.test(text.slice(0, index)) &&
    !STATUTE_LEAD.test(text)
  ) {
    text = text.slice(0, index) + text[index].toUpperCase() + text.slice(index + 1);
  }

  return SENTENCE_END.test(text) ? text : `${text}.`;
}

// Body paragraphs get the terminator but keep their case: a lead-in ending in a
// colon is introducing the limbs beneath it and must stay open.
function toSentenceParagraph(value = "") {
  const text = String(value || "").trim();
  if (!text) return text;
  if (SENTENCE_END.test(text) || /[:;,\u2014-]$/.test(text)) return text;
  return /[A-Za-z0-9"'\u2019\u201d)\]%]$/.test(text) ? `${text}.` : text;
}

// The label column has to be wide enough for the widest label in the clause, or
// "11.1" overhangs the grid that "4.1" sits on. Measured from Times metrics
// (digits are a half em, the full stop a quarter) rather than from pdfkit, so
// the DOCX tab stop and the PDF label box are computed identically and the two
// exports lay out on the same grid.
function labelColumnWidth(labels = []) {
  const widest = labels.reduce((max, label) => {
    const width = [...String(label || "")].reduce(
      (sum, ch) => sum + PDF_BODY_SIZE * (ch === "." ? 0.25 : 0.5),
      0
    );
    return Math.max(max, width);
  }, 0);
  return Math.max(PDF_ITEM_HANGING, widest + PDF_BODY_SIZE * 0.6);
}

// Assigns decimal outline labels within a clause. Indian firm drafting numbers
// sub-clauses "11.1", "11.1.1" rather than lettering them, and a cross-reference
// elsewhere in the instrument is only meaningful if those numbers exist.
function numberClauseBlocks(blocks, clauseNumber) {
  let first = 0;
  let second = 0;

  return blocks.map((block) => {
    if (block.type !== "item") return { ...block, label: null };

    if (block.depth >= 2 && first > 0) {
      second += 1;
      return { ...block, label: `${clauseNumber}.${first}.${second}` };
    }

    first += 1;
    second = 0;
    return { ...block, label: `${clauseNumber}.${first}` };
  });
}

// Indian deeds head a schedule "THE FIRST SCHEDULE ABOVE REFERRED TO" rather
// than "SCHEDULE 1", and place schedules AFTER the testimonium and signatures.
const SCHEDULE_ORDINALS = [
  "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH",
  "SIXTH", "SEVENTH", "EIGHTH", "NINTH", "TENTH",
];

function scheduleHeadingPrefix(index) {
  const ordinal = SCHEDULE_ORDINALS[index - 1];
  return ordinal
    ? `THE ${ordinal} SCHEDULE ABOVE REFERRED TO — `
    : `SCHEDULE ${index} — `;
}

function resolveFallbackHeading(clause, clauseNumber) {
  const explicitTitle = String(clause?.title || "").trim();
  if (explicitTitle) return explicitTitle;

  const category = normalizeClauseCategory(clause?.category);
  if (category) {
    return category
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return `Clause ${clauseNumber}`;
}

// Renders the deed opening from the PARSED structure. The line-by-line regex
// that used to live here (and again in the PDF renderer) is now in
// documentStructure.js, parsed once. When the clause is not in deed form,
// `parsed` is false and the raw lines are rendered as ordinary paragraphs
// rather than silently dropped.
function renderIdentityClause(children, text) {
  const structure = parseIdentityClause(text);

  // Separation between blocks is carried by each paragraph's space-after, not by
  // empty paragraphs. An empty paragraph is a blank line an unauthorised party
  // can type into after execution, and stacking them produces the uneven gaps
  // that push a contract onto an extra page.
  if (!structure.parsed) {
    for (const line of structure.lines) {
      if (!line) continue;
      children.push(
        buildBodyParagraph(line, { style: STYLE_ID.recital, indent: { left: RECITAL_LEFT } })
      );
    }
    return;
  }

  structure.blocks.forEach((block) => {

    switch (block.type) {
      case "opening":
        children.push(
          new Paragraph({
            style: STYLE_ID.body,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            indent: { left: OPERATIVE_LEFT },
            children: buildOpeningLineRuns(block.text),
          })
        );
        return;

      case "connective":
        children.push(
          new Paragraph({
            style: STYLE_ID.body,
            alignment: AlignmentType.CENTER,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            children: [buildBodyRun(block.text, { bold: true })],
          })
        );
        return;

      case "party":
        children.push(
          new Paragraph({
            style: STYLE_ID.recital,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            indent: { left: RECITAL_LEFT },
            children: buildPartyParagraphRuns(block.text),
          })
        );
        return;

      case "recital":
        children.push(
          new Paragraph({
            style: STYLE_ID.recital,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            indent: { left: RECITAL_LEFT },
            children: [
              buildBodyRun(`${block.label}${block.lead}`, { bold: true }),
              ...buildRunsWithSuperscriptOrdinals(block.text),
            ],
          })
        );
        return;

      case "testatum":
        children.push(
          new Paragraph({
            style: STYLE_ID.body,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            indent: { left: OPERATIVE_LEFT },
            children: buildLeadInRuns(
              block.text,
              /^(NOW,\s*(?:THEREFORE|WITNESSETH),?\s*)/i
            ),
          })
        );
        return;

      default:
        children.push(
          buildBodyParagraph(block.text, {
            style: STYLE_ID.recital,
            indent: { left: RECITAL_LEFT },
          })
        );
    }
  });
}

function renderBodyClause(children, clause, clauseNumber, options = {}) {
  const heading = resolveFallbackHeading(clause, clauseNumber);
  const prefix = options.scheduleMode ? `SCHEDULE ${clauseNumber}. ` : `${clauseNumber}. `;

  children.push(
    new Paragraph({
      style: STYLE_ID.heading,
      spacing: {
        before: SECTION_AFTER_SPACING,
        after: BODY_AFTER_SPACING,
        line: BODY_LINE_SPACING,
      },
      indent: { left: CLAUSE_HEADING_LEFT, hanging: CLAUSE_HEADING_HANGING },
      keepNext: true,
      children: [
        buildBodyRun(prefix),
        buildBodyRun(heading, { bold: true }),
      ],
    })
  );

  const blocks = numberClauseBlocks(
    tokenizeClauseText(clause.text || ""),
    clauseNumber
  );

  // One label column for the whole clause, wide enough for its longest label, so
  // "4.1" and "11.1" open their text on the same vertical line. A tab carries
  // the first line across to that column rather than two literal spaces, which
  // land wherever the label happens to end.
  const itemHangingTwips = Math.round(
    labelColumnWidth(blocks.map((block) => block.label).filter(Boolean)) * 20
  );

  for (const block of blocks) {
    if (block.type === "item") {
      const nested = block.depth >= 2;
      const bodyLeft = RECITAL_LEFT + itemHangingTwips * (nested ? 2 : 1);
      children.push(
        new Paragraph({
          style: STYLE_ID.item,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: bodyLeft, hanging: itemHangingTwips },
          tabStops: [{ type: TabStopType.LEFT, position: bodyLeft }],
          children: block.label
            ? [
                buildBodyRun(block.label),
                // A real <w:tab/>, not a literal tab character: a tab inside
                // <w:t> is not a tab stop instruction and Word simply swallows
                // it, which put the limb text hard against its own number.
                new TextRun({ children: [new Tab()], font: BODY_FONT, size: BODY_SIZE }),
                buildBodyRun(block.body),
              ]
            : [buildBodyRun(block.text)],
        })
      );
      continue;
    }

    children.push(
      buildBodyParagraph(block.text, {
        style: STYLE_ID.body,
        indent: { left: OPERATIVE_LEFT },
      })
    );
  }

  if (clause.statutory_reference) {
    children.push(
      new Paragraph({
        style: STYLE_ID.body,
        // A citation to external material is set single-spaced, per the
        // convention for quoted or referenced statutory text.
        spacing: { after: SECTION_AFTER_SPACING, line: QUOTE_LINE_SPACING },
        indent: { left: OPERATIVE_LEFT },
        children: [
          new TextRun({
            text: `[Ref: ${clause.statutory_reference}]`,
            italics: true,
            size: 18,
            color: "888888",
            font: BODY_FONT,
          }),
        ],
      })
    );
  }
}

function renderSignatureBlock(children, text) {
  const EMPHASISED =
    /^IN WITNESS WHEREOF|^Witnesses:|^IN THE PRESENCE OF|^FOR AND ON BEHALF OF|^PARTNER\s+\d|^WITNESS(?:ES)?\b/i;
  const SECTION_LEAD = /^FOR AND ON BEHALF OF|^PARTNER\s+\d|^WITNESS(?:ES)?\b|^IN THE PRESENCE OF/i;

  // Blank source lines are folded into the preceding paragraph's space-after
  // rather than emitted as empty paragraphs: the same visible gap, but no
  // editable blank line sitting in the executed document. Signature rules still
  // get their clear space, they just get it from spacing rather than from
  // stacked empty paragraphs.
  const entries = [];
  let pendingBefore = 320; // 16 pt of clear space before the execution block

  for (const raw of String(text || "").split(/\n/)) {
    const line = raw.trim();

    if (!line) {
      if (entries.length) entries[entries.length - 1].after += 160;
      else pendingBefore += 160;
      continue;
    }

    const emphasised = EMPHASISED.test(line);
    entries.push({
      line,
      emphasised,
      before: pendingBefore + (SECTION_LEAD.test(line) ? 120 : 0),
      after: emphasised ? 180 : BODY_AFTER_SPACING,
    });
    pendingBefore = 0;
  }

  for (const entry of entries) {
    children.push(
      new Paragraph({
        style: STYLE_ID.signature,
        spacing: {
          before: entry.before,
          after: entry.after,
          line: BODY_LINE_SPACING,
        },
        indent: { left: SIGNATURE_LEFT },
        children: [buildBodyRun(entry.line, entry.emphasised ? { bold: true } : {})],
      })
    );
  }
}

// Running footer. The document reference sits on the left and the page count on
// the right, so a detached sheet of a long contract can be placed back into the
// right instrument and a missing page is visible on the face of the paper.
function buildPageFooter(label = "") {
  const footerRun = (text) => new TextRun({ text, font: BODY_FONT, size: FOOTER_SIZE });
  const fieldRun = (field) =>
    new TextRun({ children: [field], font: BODY_FONT, size: FOOTER_SIZE });

  const children = [];
  if (label) children.push(footerRun(label));
  children.push(
    new TextRun({ children: [new Tab()], font: BODY_FONT, size: FOOTER_SIZE }),
    footerRun("Page "),
    fieldRun(PageNumber.CURRENT),
    footerRun(" of "),
    fieldRun(PageNumber.TOTAL_PAGES)
  );

  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 80, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 2,
            color: "B7B7B7",
            space: 4,
          },
        },
        children,
      }),
    ],
  });
}

// Stamps a page number and a short document identifier on every page, after
// layout is complete. A detached page of a twelve-page contract is otherwise
// impossible to place, and a party cannot tell whether a page is missing.
function stampPdfFooters(doc, label = "") {
  const range = doc.bufferedPageRange();
  if (!range || range.count < 2) return;

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);

    // The footer sits inside the bottom margin, so it must be written with the
    // page's own margins temporarily relaxed or pdfkit will start a new page.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = doc.page.height - PDF_MARGIN + 18;
    doc.font("Times-Roman").fontSize(PDF_REF_SIZE).fillColor("#6b6b6b");

    if (label) {
      doc.text(pdfSafeText(label), PDF_MARGIN, y, {
        width: PDF_CONTENT_WIDTH,
        align: "left",
        lineBreak: false,
      });
    }
    doc.text(`Page ${index + 1} of ${range.count}`, PDF_MARGIN, y, {
      width: PDF_CONTENT_WIDTH,
      align: "right",
      lineBreak: false,
    });

    doc.fillColor("black");
    doc.page.margins.bottom = bottom;
  }
}

function createPdfBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      // Buffer the pages so the footer can say "Page 2 of 12" -- the total is
      // only known once pagination has actually happened, and hard-coding a
      // count before rendering is how documents end up claiming the wrong one.
      bufferPages: true,
      margins: {
        top: PDF_MARGIN,
        right: PDF_MARGIN,
        bottom: PDF_MARGIN,
        left: PDF_MARGIN,
      },
      info: {
        Author: "LegalAId",
      },
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      buildFn(doc);
      stampPdfFooters(doc, doc.__footerLabel || "");
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// A numbered limb, laid out as a true hanging indent: the label is drawn into a
// fixed-width box at the left of the grid and the body opens on the same line at
// the far edge of that box. pdfkit's own negative first-line indent starts the
// body immediately after the label instead, so a short label ("4.1") and a long
// one ("11.1") began their text in different columns.
// `left` is the BODY column, exactly as the DOCX paragraph indent is, and the
// label is drawn one label-column to its left.
function pdfHangingItem(doc, label, body, options = {}) {
  const left = options.left ?? 0;
  const hanging = options.hanging ?? PDF_ITEM_HANGING;
  const size = options.size ?? PDF_BODY_SIZE;

  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y >= bottom - size * 2) doc.addPage();

  const top = doc.y;
  doc
    .font("Times-Roman")
    .fontSize(size)
    .text(pdfSafeText(String(label)), PDF_MARGIN + left - hanging, top, {
      width: hanging,
      align: "left",
      lineBreak: false,
    });

  // Reset the cursor so the body opens alongside the label rather than beneath.
  doc.y = top;
  pdfParagraph(doc, [{ text: body }], { ...options, left, hanging: 0 });
}

function renderPdfSectionHeading(doc, text, options = {}) {
  doc.y += options.before ?? PDF_BLOCK_GAP;
  pdfParagraph(doc, [{ text: String(text || "").toUpperCase(), bold: true }], {
    align: "center",
    size: PDF_HEADING_SIZE,
    after: options.after ?? PDF_BLOCK_GAP,
  });
}

// PDF counterpart, consuming the same parsed structure as the DOCX renderer and
// laid out on the same indent grid (PDF_L1 === RECITAL_LEFT, PDF_L2 ===
// CLAUSE_ITEM_LEFT), so both exports of one draft are visually identical.
function renderPdfIdentityClause(doc, text) {
  const structure = parseIdentityClause(text);

  if (!structure.parsed) {
    for (const line of structure.lines) {
      if (!line) continue;
      pdfParagraph(doc, line, { left: PDF_L1 });
    }
    return;
  }

  for (const block of structure.blocks) {
    switch (block.type) {
      case "opening":
        pdfParagraph(
          doc,
          pdfLeadRuns(block.text, /^(THIS\s+[A-Z\s]+?)(?=\s*\()/),
          { left: PDF_L1, after: PDF_BLOCK_GAP }
        );
        break;

      case "connective":
        pdfParagraph(doc, [{ text: block.text, bold: true }], {
          align: "center",
          after: PDF_BLOCK_GAP,
        });
        break;

      case "party":
        pdfParagraph(doc, block.text, { left: PDF_L1 });
        break;

      case "recital":
        pdfParagraph(
          doc,
          [
            { text: `${block.label}${block.lead}`, bold: true },
            { text: block.text },
          ],
          { left: PDF_L1 }
        );
        break;

      case "testatum":
        pdfParagraph(
          doc,
          pdfLeadRuns(
            block.text,
            /^(NOW,\s*(?:THEREFORE|WITNESSETH),?\s*)/i,
            "NOW, THEREFORE, "
          ),
          { left: PDF_L1, after: PDF_BLOCK_GAP }
        );
        break;

      default:
        pdfParagraph(doc, block.text, { left: PDF_L1 });
    }
  }
}

function renderPdfBodyClause(doc, clause, clauseNumber, options = {}) {
  const heading = resolveFallbackHeading(clause, clauseNumber);
  const prefix = options.scheduleMode
    ? `SCHEDULE ${clauseNumber}. `
    : `${clauseNumber}. `;

  doc.y += PDF_BLOCK_GAP;

  // Keep-with-next. A clause heading stranded at the foot of a page, with its
  // text starting overleaf, is the classic typesetting fault -- and the previous
  // renderer produced exactly that on page 1. Reserve room for the heading plus
  // the first two lines of its body; if that does not fit, start the page now.
  const KEEP_LINES = 2;
  const needed =
    PDF_HEADING_SIZE + (PDF_BODY_SIZE + PDF_LINE_GAP) * KEEP_LINES + PDF_PARA_GAP * 2;
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  // Hanging indent: the number sits flush at the margin and the heading text
  // starts on the same 0.25 in grid line as the clause body beneath it. The old
  // renderer indented the heading 24 pt while leaving its own body at 0, so
  // every heading hung to the right of the text it governed.
  pdfParagraph(
    doc,
    [
      { text: prefix },
      { text: heading, bold: true },
    ],
    {
      left: PDF_L1,
      hanging: PDF_HANGING,
      align: "left",
      after: PDF_PARA_GAP,
    }
  );

  const blocks = numberClauseBlocks(
    tokenizeClauseText(clause.text || ""),
    clauseNumber
  );

  const itemHanging = labelColumnWidth(
    blocks.map((block) => block.label).filter(Boolean)
  );

  for (const block of blocks) {
    if (block.type === "item") {
      // The label sits on PDF_L1, the same grid line as the clause body above
      // it, and the limb text opens one label-column further in.
      const left = PDF_L1 + itemHanging * (block.depth >= 2 ? 2 : 1);
      if (block.label) {
        pdfHangingItem(doc, block.label, block.body, { left, hanging: itemHanging });
      } else {
        pdfParagraph(doc, [{ text: block.text }], { left });
      }
      continue;
    }

    pdfParagraph(doc, block.text, { left: PDF_L1 });
  }

  if (clause.statutory_reference) {
    // A citation to external material is set single-spaced, per the convention
    // for quoted or referenced statutory text.
    pdfParagraph(
      doc,
      [
        {
          text: `[Ref: ${clause.statutory_reference}]`,
          italic: true,
          color: "#777777",
        },
      ],
      { left: PDF_L1, align: "left", size: PDF_REF_SIZE, lineGap: 0 }
    );
  }
}

function renderPdfSignatureBlock(doc, text) {
  doc.y += PDF_BLOCK_GAP;

  const emphasised =
    /^IN WITNESS WHEREOF|^Witnesses:|^IN THE PRESENCE OF|^FOR AND ON BEHALF OF|^PARTNER\s+\d|^WITNESS(?:ES)?\b/i;

  for (const raw of String(text || "").split(/\n/)) {
    const line = raw.trim();
    if (!line) {
      doc.y += PDF_PARA_GAP;
      continue;
    }

    const isHeading = emphasised.test(line);
    pdfParagraph(doc, [{ text: line, bold: isHeading }], {
      left: PDF_L1,
      align: "left",
      after: isHeading ? PDF_BLOCK_GAP : PDF_PARA_GAP,
    });
  }
}

export async function draftToDocx(draft) {
  const docType = draft?.document_type || "LEGAL DOCUMENT";
  const title = formatDocTitle(docType);
  const { identityClause, bodyClauses, scheduleClauses, signatureClauses } = splitDocumentClauses(
    draft?.clauses || []
  );

  // The title carries the page-1 stamp reserve as space-before, so a stampable
  // instrument opens roughly three inches down the sheet and leaves the head of
  // the page clear for the stamp paper or the e-stamp certificate block.
  const stampReserve = requiresStampHeader(docType)
    ? convertInchesToTwip(STAMP_HEADER_RESERVE_IN - 1) // page margin already gives 1 in
    : 0;

  const children = [
    new Paragraph({
      style: STYLE_ID.title,
      alignment: AlignmentType.CENTER,
      spacing: { before: stampReserve, after: 260, line: BODY_LINE_SPACING },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: TITLE_SIZE,
          font: BODY_FONT,
        }),
      ],
    }),
  ];

  if (identityClause?.text?.trim()) {
    renderIdentityClause(children, identityClause.text);
  }

  // A deed runs continuously from the testatum to the testimonium: no interior
  // "TERMS AND CONDITIONS" / "EXECUTION" banner headings.
  bodyClauses.forEach((clause, index) => {
    renderBodyClause(children, clause, index + 1);
  });

  signatureClauses.forEach((clause) => {
    renderSignatureBlock(children, clause.text);
  });

  // Schedules follow the execution block, each on a fresh page.
  scheduleClauses.forEach((clause, index) => {
    children.push(
      new Paragraph({
        style: STYLE_ID.body,
        pageBreakBefore: true,
        spacing: { after: 0 },
        children: [],
      })
    );
    renderBodyClause(children, clause, index + 1, { scheduleMode: true });
  });

  const doc = new Document({
    creator: "LegalAId",
    title,
    styles: {
      default: {
        document: {
          run: {
            font: BODY_FONT,
            size: BODY_SIZE,
          },
        },
      },
      paragraphStyles: [
        {
          id: STYLE_ID.title,
          name: "Legal Title",
          basedOn: "Normal",
          next: STYLE_ID.body,
          quickFormat: true,
          run: {
            font: BODY_FONT,
            size: TITLE_SIZE,
            bold: true,
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: { after: 260, line: BODY_LINE_SPACING },
          },
        },
        {
          id: STYLE_ID.sectionHeading,
          name: "Legal Section Heading",
          basedOn: "Normal",
          next: STYLE_ID.body,
          quickFormat: true,
          run: { font: BODY_FONT, size: SECTION_HEADING_SIZE, bold: true },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 260,
              after: SECTION_AFTER_SPACING,
              line: BODY_LINE_SPACING,
            },
          },
        },
        {
          id: STYLE_ID.body,
          name: "Legal Body",
          basedOn: "Normal",
          next: STYLE_ID.body,
          quickFormat: true,
          run: { font: BODY_FONT, size: BODY_SIZE },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          },
        },
        {
          id: STYLE_ID.recital,
          name: "Legal Recital",
          basedOn: STYLE_ID.body,
          next: STYLE_ID.recital,
          run: { font: BODY_FONT, size: BODY_SIZE },
          paragraph: {
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            indent: { left: RECITAL_LEFT },
          },
        },
        {
          id: STYLE_ID.heading,
          name: "Legal Clause Heading",
          basedOn: STYLE_ID.body,
          next: STYLE_ID.body,
          run: { font: BODY_FONT, size: BODY_SIZE, bold: true },
          paragraph: {
            spacing: {
              before: 240,
              after: BODY_AFTER_SPACING,
              line: BODY_LINE_SPACING,
            },
            indent: { left: CLAUSE_HEADING_LEFT, hanging: CLAUSE_HEADING_HANGING },
          },
        },
        {
          id: STYLE_ID.item,
          name: "Legal Clause Item",
          basedOn: STYLE_ID.body,
          next: STYLE_ID.item,
          run: { font: BODY_FONT, size: BODY_SIZE },
          paragraph: {
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
            indent: { left: CLAUSE_ITEM_LEFT, hanging: CLAUSE_ITEM_HANGING },
          },
        },
        {
          id: STYLE_ID.signature,
          name: "Legal Signature",
          basedOn: STYLE_ID.body,
          next: STYLE_ID.signature,
          run: { font: BODY_FONT, size: BODY_SIZE },
          paragraph: {
            spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        footers: {
          default: buildPageFooter(title),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export async function draftToPdf(draft) {
  const docType = draft?.document_type || "LEGAL DOCUMENT";
  const title = formatDocTitle(docType);
  const { identityClause, bodyClauses, scheduleClauses, signatureClauses } = splitDocumentClauses(
    draft?.clauses || []
  );

  return createPdfBuffer((doc) => {
    doc.info.Title = title;
    doc.__footerLabel = title;

    // Clear the head of page 1 for the stamp paper / e-stamp certificate.
    if (requiresStampHeader(docType)) {
      doc.y = STAMP_HEADER_RESERVE_IN * 72;
    }

    doc
      .font("Times-Bold")
      .fontSize(PDF_TITLE_SIZE)
      .text(pdfSafeText(title.toUpperCase()), PDF_MARGIN, doc.y, {
        width: PDF_CONTENT_WIDTH,
        align: "center",
      });
    doc.y += PDF_BLOCK_GAP * 1.6;
    doc.x = PDF_MARGIN;

    if (identityClause?.text?.trim()) {
      renderPdfIdentityClause(doc, identityClause.text);
    }

    bodyClauses.forEach((clause, index) => {
      renderPdfBodyClause(doc, clause, index + 1);
    });

    signatureClauses.forEach((clause) => {
      renderPdfSignatureBlock(doc, clause.text);
    });

    // Schedules follow the execution block, each on a fresh page.
    scheduleClauses.forEach((clause, index) => {
      doc.addPage();
      renderPdfBodyClause(doc, clause, index + 1, { scheduleMode: true });
    });
  });
}

export function draftToText(draft) {
  const title = formatDocTitle(draft?.document_type || "LEGAL DOCUMENT");
  const { identityClause, bodyClauses, scheduleClauses, signatureClauses } = splitDocumentClauses(
    draft?.clauses || []
  );
  const lines = [`${title}\n${"=".repeat(title.length)}\n`];

  if (identityClause?.text?.trim()) {
    lines.push(identityClause.text.trim(), "");
  }

  bodyClauses.forEach((clause, index) => {
    const heading = resolveFallbackHeading(clause, index + 1);
    lines.push(`\n${index + 1}. ${heading.toUpperCase()}\n${"-".repeat(40)}`);
    for (const block of numberClauseBlocks(
      tokenizeClauseText(clause.text || ""),
      index + 1
    )) {
      const pad = block.depth >= 2 ? "      " : "    ";
      lines.push(block.label ? `${pad}${block.label}  ${block.body}` : block.text);
    }
    if (clause.statutory_reference) {
      lines.push(`[Ref: ${clause.statutory_reference}]`);
    }
  });

  signatureClauses.forEach((clause) => {
    lines.push(`\n${"-".repeat(40)}`);
    lines.push(String(clause.text || "").trim());
  });

  // Schedules follow the execution block.
  scheduleClauses.forEach((clause, index) => {
    const heading = resolveFallbackHeading(clause, index + 1);
    lines.push(
      `\n${scheduleHeadingPrefix(index + 1)}${heading.toUpperCase()}\n${"-".repeat(40)}`
    );
    lines.push(String(clause.text || "").trim());
    if (clause.statutory_reference) {
      lines.push(`[Ref: ${clause.statutory_reference}]`);
    }
  });

  return lines.join("\n");
}
