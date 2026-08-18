import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
  convertInchesToTwip,
} from "docx";
import PDFDocument from "pdfkit";
import { getDocumentDisplayName } from "../../shared/documentRegistry.js";
import {
  normalizeClauseCategory,
  sortClausesByOrder,
} from "../config/clauseOrder.js";

const BODY_FONT = "Times New Roman";
const BODY_SIZE = 24;
const TITLE_SIZE = 28;
const SECTION_HEADING_SIZE = 24;
const FOOTER_SIZE = 18;
const BODY_LINE_SPACING = 276;
const BODY_AFTER_SPACING = 90;
const SECTION_AFTER_SPACING = 140;
const RECITAL_LEFT = 360;
const OPERATIVE_LEFT = 360;
const CLAUSE_HEADING_LEFT = 360;
const CLAUSE_HEADING_HANGING = 360;
const CLAUSE_ITEM_LEFT = 720;
const CLAUSE_ITEM_HANGING = 360;
const SIGNATURE_LEFT = 360;
const PDF_MARGIN = 72;
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

// Parses a recital line, with or without a letter label:
//   "A. WHEREAS, x"  /  "(B) AND WHEREAS, y"  /  "WHEREAS, z"
// The label is PRESERVED (recitals get cross-referred as Recital A/B/C) and is
// emphasised together with the WHEREAS / AND WHEREAS lead-in.
function matchRecitalLine(line = "") {
  const source = String(line || "").trim();
  const match = source.match(
    /^(?:(?:\(([A-Z])\)|([A-Z])[.)])\s+)?((?:AND\s+)?WHEREAS[,:]?\s+)(.*)$/i
  );
  if (match) {
    const letter = match[1] || match[2];
    return {
      label: letter ? `${letter.toUpperCase()}. ` : "",
      lead: match[3],
      rest: match[4] || "",
    };
  }

  // A lettered recital that does not spell out WHEREAS. Restricted to the
  // PARENTHESISED form "(A) ..." on purpose: a bare "A. ..." would swallow a
  // party line for an initialled name such as "A. K. Sharma & Co, ... of the
  // First Part;", which is rendered by the party branch further down.
  const lettered = source.match(/^\(([A-Z])\)\s+(.*)$/);
  if (lettered) {
    return { label: `${lettered[1].toUpperCase()}. `, lead: "WHEREAS, ", rest: lettered[2] || "" };
  }

  return null;
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

function isStructuredSubpartLine(line = "") {
  return (
    /^\(?[a-z0-9ivxlcdm]+\)?[.)-]\s+/i.test(line) ||
    /^[-*•]\s+/.test(line)
  );
}

function tokenizeClauseText(text = "") {
  const paragraphs = String(text || "")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const blocks = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) continue;

    if (lines.length === 1) {
      blocks.push({
        type: isStructuredSubpartLine(lines[0]) ? "item" : "paragraph",
        text: lines[0],
      });
      continue;
    }

    for (const line of lines) {
      blocks.push({
        type: isStructuredSubpartLine(line) ? "item" : "paragraph",
        text: line,
      });
    }
  }

  return blocks;
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

function renderIdentityClause(children, text) {
  const lines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim());

  for (const line of lines) {
    if (!line) {
      children.push(buildBlankParagraph({ spacing: { after: BODY_AFTER_SPACING } }));
      continue;
    }

    if (/^THIS\s+AGREEMENT/i.test(line)) {
      children.push(
        new Paragraph({
          style: STYLE_ID.body,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: OPERATIVE_LEFT },
          children: buildOpeningLineRuns(line),
        })
      );
      continue;
    }

    if (/^BY AND BETWEEN$/i.test(line)) {
      children.push(
        new Paragraph({
          style: STYLE_ID.body,
          alignment: AlignmentType.CENTER,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          children: [buildBodyRun("BY AND BETWEEN", { bold: true })],
        })
      );
      continue;
    }

    if (/^AND$/i.test(line)) {
      children.push(
        new Paragraph({
          style: STYLE_ID.body,
          alignment: AlignmentType.CENTER,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          children: [buildBodyRun("AND", { bold: true })],
        })
      );
      continue;
    }

    if (/^WHEREAS[,:.]*$/i.test(line)) {
      continue;
    }

    const recital = matchRecitalLine(line);
    if (recital) {
      children.push(
        new Paragraph({
          style: STYLE_ID.recital,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: RECITAL_LEFT },
          children: [
            buildBodyRun(`${recital.label}${recital.lead}`, { bold: true }),
            ...buildRunsWithSuperscriptOrdinals(recital.rest),
          ],
        })
      );
      continue;
    }

    if (/^NOW[,\s]+(THEREFORE|WITNESSETH)/i.test(line)) {
      children.push(
        new Paragraph({
          style: STYLE_ID.body,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: OPERATIVE_LEFT },
          children: buildLeadInRuns(line, /^(NOW,\s*(?:THEREFORE|WITNESSETH),?\s*)/i),
        })
      );
      continue;
    }

    if (/of the\s+(?:First|Second|Third|Other)\s+Part[;.]?$/i.test(line)) {
      children.push(
        new Paragraph({
          style: STYLE_ID.recital,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: RECITAL_LEFT },
          children: buildPartyParagraphRuns(line),
        })
      );
      continue;
    }

    children.push(
      buildBodyParagraph(line, {
        style: STYLE_ID.recital,
        indent: { left: RECITAL_LEFT },
      })
    );
  }
}

function renderBodyClause(children, clause, clauseNumber, options = {}) {
  const heading = resolveFallbackHeading(clause, clauseNumber);
  const prefix = options.scheduleMode ? `SCHEDULE ${clauseNumber}. ` : `${clauseNumber}. `;

  children.push(
    new Paragraph({
      style: STYLE_ID.heading,
      spacing: { before: 260, after: 90, line: BODY_LINE_SPACING },
      indent: { left: CLAUSE_HEADING_LEFT, hanging: CLAUSE_HEADING_HANGING },
      keepNext: true,
      children: [
        buildBodyRun(prefix),
        buildBodyRun(heading, { bold: true }),
      ],
    })
  );

  const blocks = tokenizeClauseText(clause.text || "");

  for (const block of blocks) {
    if (block.type === "item") {
      children.push(
        new Paragraph({
          style: STYLE_ID.item,
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: CLAUSE_ITEM_LEFT, hanging: CLAUSE_ITEM_HANGING },
          children: [buildBodyRun(block.text)],
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
        spacing: { after: 180 },
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
  children.push(
    buildBlankParagraph({ spacing: { before: 260, after: 140 } })
  );

  const lines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim());

  for (const line of lines) {
    if (!line) {
      children.push(
        new Paragraph({
          style: STYLE_ID.signature,
          spacing: { after: 80 },
          children: [],
        })
      );
      continue;
    }

    children.push(
      new Paragraph({
        style: STYLE_ID.signature,
        spacing: {
          before: /^FOR AND ON BEHALF OF|^PARTNER\s+\d|^WITNESS(?:ES)?\b|^IN THE PRESENCE OF/i.test(line)
            ? 120
            : 0,
          after: /^IN WITNESS WHEREOF|^Witnesses:|^IN THE PRESENCE OF/i.test(line) ? 180 : BODY_AFTER_SPACING,
          line: BODY_LINE_SPACING,
        },
        indent: { left: SIGNATURE_LEFT },
        children: [
          buildBodyRun(
            line,
            /^IN WITNESS WHEREOF|^Witnesses:|^IN THE PRESENCE OF|^FOR AND ON BEHALF OF|^PARTNER\s+\d|^WITNESS(?:ES)?\b/i.test(line)
              ? { bold: true }
              : {}
          ),
        ],
      })
    );
  }
}

function buildPageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 0 },
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 2,
            color: "B7B7B7",
            space: 4,
          },
        },
        children: [
          new TextRun({ text: "Page ", font: BODY_FONT, size: FOOTER_SIZE }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: BODY_FONT,
            size: FOOTER_SIZE,
          }),
          new TextRun({ text: " of ", font: BODY_FONT, size: FOOTER_SIZE }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: BODY_FONT,
            size: FOOTER_SIZE,
          }),
        ],
      }),
    ],
  });
}

function createPdfBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
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
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function renderPdfSectionHeading(doc, text, options = {}) {
  doc.moveDown(options.before ?? 0.55);
  doc
    .font("Times-Bold")
    .fontSize(12)
    .text(String(text || "").toUpperCase(), { align: "center" });
  doc.moveDown(options.after ?? 0.45);
}

function renderPdfLeadInParagraph(doc, lead, remainder, options = {}) {
  doc.font("Times-Bold").fontSize(12).text(lead, {
    align: options.align || "justify",
    lineGap: 2,
    indent: options.indent || 0,
    continued: Boolean(remainder),
  });

  if (remainder) {
    doc.font("Times-Roman").fontSize(12).text(remainder, {
      align: options.align || "justify",
      lineGap: 2,
      indent: options.indent || 0,
    });
  }

  doc.moveDown(options.after ?? 0.35);
}

function renderPdfIdentityClause(doc, text) {
  const lines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim());

  for (const line of lines) {
    if (!line) {
      doc.moveDown(0.25);
      continue;
    }

    if (/^THIS\s+AGREEMENT/i.test(line)) {
      const match = line.match(/^(THIS\s+[A-Z\s]+?)(\s*\(.*)$/);
      if (match) {
        renderPdfLeadInParagraph(doc, match[1], match[2], {
          align: "justify",
          after: 0.35,
          indent: 24,
        });
      } else {
        doc.font("Times-Bold").fontSize(12).text(line, {
          align: "justify",
          lineGap: 2,
          indent: 24,
        });
        doc.moveDown(0.35);
      }
      continue;
    }

    if (/^BY AND BETWEEN$/i.test(line)) {
      doc.font("Times-Bold").fontSize(12).text("BY AND BETWEEN", { align: "center" });
      doc.moveDown(0.35);
      continue;
    }

    if (/^AND$/i.test(line)) {
      doc.font("Times-Bold").fontSize(12).text("AND", { align: "center" });
      doc.moveDown(0.35);
      continue;
    }

    if (/^WHEREAS[,:.]*$/i.test(line)) {
      continue;
    }

    const pdfRecital = matchRecitalLine(line);
    if (pdfRecital) {
      renderPdfLeadInParagraph(
        doc,
        `${pdfRecital.label}${pdfRecital.lead}`,
        pdfRecital.rest,
        { align: "justify", after: 0.35, indent: 54 }
      );
      continue;
    }

    if (/^NOW[,\s]+(THEREFORE|WITNESSETH)/i.test(line)) {
      const leadMatch = line.match(/^(NOW,\s*(?:THEREFORE|WITNESSETH),?\s*)(.*)$/i);
      renderPdfLeadInParagraph(
        doc,
        leadMatch?.[1] || "NOW, THEREFORE, ",
        leadMatch?.[2] || "",
        { align: "justify", after: 0.35, indent: 24 }
      );
      continue;
    }

    doc.font("Times-Roman").fontSize(12).text(line, {
      align: "justify",
      lineGap: 2,
      indent: 54,
    });
    doc.moveDown(0.35);
  }
}

function renderPdfBodyClause(doc, clause, clauseNumber, options = {}) {
  const heading = resolveFallbackHeading(clause, clauseNumber);
  const prefix = options.scheduleMode ? `SCHEDULE ${clauseNumber}. ` : `${clauseNumber}. `;

  doc.moveDown(0.45);
  doc
    .font("Times-Roman")
    .fontSize(12)
    .text(prefix, { align: "left", continued: true, indent: 24 });
  doc.font("Times-Bold").fontSize(12).text(heading, { align: "left", indent: 24 });
  doc.moveDown(0.25);

  const blocks = tokenizeClauseText(clause.text || "");

  for (const block of blocks) {
    if (block.type === "item") {
      doc.font("Times-Roman").fontSize(12).text(block.text, {
        align: "justify",
        lineGap: 2,
        indent: 54,
      });
      doc.moveDown(0.2);
      continue;
    }

    doc.font("Times-Roman").fontSize(12).text(block.text, {
      align: "justify",
      lineGap: 2,
      indent: 24,
    });
    doc.moveDown(0.35);
  }

  if (clause.statutory_reference) {
    doc
      .font("Times-Italic")
      .fontSize(9)
      .fillColor("#777777")
      .text(`[Ref: ${clause.statutory_reference}]`, { align: "left" })
      .fillColor("black");
    doc.moveDown(0.4);
  }
}

function renderPdfSignatureBlock(doc, text) {
  doc.moveDown(0.8);

  const lines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim());

  for (const line of lines) {
    if (!line) {
      doc.moveDown(0.3);
      continue;
    }

    doc
      .font(/^IN WITNESS WHEREOF|^Witnesses:|^IN THE PRESENCE OF|^FOR AND ON BEHALF OF|^PARTNER\s+\d|^WITNESS(?:ES)?\b/i.test(line) ? "Times-Bold" : "Times-Roman")
      .fontSize(12)
      .text(line, { align: "left", lineGap: 2, indent: 24 });
    doc.moveDown(/^IN WITNESS WHEREOF|^Witnesses:|^IN THE PRESENCE OF/i.test(line) ? 0.5 : 0.25);
  }
}

export async function draftToDocx(draft) {
  const docType = draft?.document_type || "LEGAL DOCUMENT";
  const title = formatDocTitle(docType);
  const { identityClause, bodyClauses, scheduleClauses, signatureClauses } = splitDocumentClauses(
    draft?.clauses || []
  );

  const children = [
    new Paragraph({
      style: STYLE_ID.title,
      alignment: AlignmentType.CENTER,
      spacing: { after: 260, line: BODY_LINE_SPACING },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          underline: { type: UnderlineType.SINGLE },
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
            underline: { type: UnderlineType.SINGLE },
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
          default: buildPageFooter(),
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

    doc
      .font("Times-Bold")
      .fontSize(12)
      .text(title.toUpperCase(), { align: "center", underline: true });
    doc.moveDown(0.7);

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
    lines.push(String(clause.text || "").trim());
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
