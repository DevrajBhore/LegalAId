import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
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
const TITLE_SIZE = 24;
const BODY_LINE_SPACING = 276;
const BODY_AFTER_SPACING = 120;
const TITLE_INDENT_LEFT = 720;
const CLAUSE_HEADING_LEFT = 720;
const CLAUSE_HEADING_HANGING = 360;
const CLAUSE_ITEM_LEFT = 720;
const CLAUSE_ITEM_HANGING = 360;
const PDF_MARGIN = 72;
const SCHEDULE_CATEGORIES = new Set(["SCHEDULE", "ANNEXURE", "SPECIFICATIONS"]);

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

function buildBlankParagraph(options = {}) {
  return new Paragraph({
    spacing: { after: options.after ?? BODY_AFTER_SPACING },
    children: [],
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
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
    children: buildRunsWithSuperscriptOrdinals(text),
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
          alignment: AlignmentType.CENTER,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          children: buildOpeningLineRuns(line),
        })
      );
      continue;
    }

    if (/^BY AND BETWEEN$/i.test(line)) {
      children.push(
        new Paragraph({
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

    if (/^(?:\([A-Z]\)\s*)?WHEREAS[,:\s]/i.test(line) || /^\([A-Z]\)\s+/i.test(line)) {
      const recitalText = line.replace(/^\([A-Z]\)\s*/i, "");
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          children: buildLeadInRuns(
            /^WHEREAS[,:\s]/i.test(recitalText) ? recitalText : `WHEREAS, ${recitalText}`,
            /^(WHEREAS,?\s*)/i
          ),
        })
      );
      continue;
    }

    if (/^NOW[,\s]+(THEREFORE|WITNESSETH)/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          children: buildLeadInRuns(line, /^(NOW,\s*(?:THEREFORE|WITNESSETH),?\s*)/i),
        })
      );
      continue;
    }

    if (/of the\s+(?:First|Second|Third|Other)\s+Part[;.]?$/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          children: buildPartyParagraphRuns(line),
        })
      );
      continue;
    }

    children.push(buildBodyParagraph(line));
  }
}

function renderBodyClause(children, clause, clauseNumber, options = {}) {
  const heading = resolveFallbackHeading(clause, clauseNumber);
  const prefix = options.scheduleMode ? `SCHEDULE ${clauseNumber}. ` : `${clauseNumber}. `;

  children.push(
    new Paragraph({
      spacing: { before: 240, after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
      indent: { left: CLAUSE_HEADING_LEFT, hanging: CLAUSE_HEADING_HANGING },
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
          alignment: AlignmentType.LEFT,
          spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
          indent: { left: CLAUSE_ITEM_LEFT, hanging: CLAUSE_ITEM_HANGING },
          children: [buildBodyRun(block.text)],
        })
      );
      continue;
    }

    children.push(buildBodyParagraph(block.text));
  }

  if (clause.statutory_reference) {
    children.push(
      new Paragraph({
        spacing: { after: 180 },
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
    buildBlankParagraph({ spacing: { before: 300, after: 240 } })
  );

  const lines = String(text || "")
    .split(/\n/)
    .map((line) => line.trim());

  for (const line of lines) {
    if (!line) {
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
      continue;
    }

    children.push(
      new Paragraph({
        spacing: {
          after: /^IN WITNESS WHEREOF|^Witnesses:/i.test(line) ? 180 : BODY_AFTER_SPACING,
          line: BODY_LINE_SPACING,
        },
        children: [
          buildBodyRun(
            line,
            /^IN WITNESS WHEREOF|^Witnesses:/i.test(line) ? { bold: true } : {}
          ),
        ],
      })
    );
  }
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

function renderPdfLeadInParagraph(doc, lead, remainder, options = {}) {
  doc.font("Times-Bold").fontSize(12).text(lead, {
    align: options.align || "justify",
    lineGap: 2,
    continued: Boolean(remainder),
  });

  if (remainder) {
    doc.font("Times-Roman").fontSize(12).text(remainder, {
      align: options.align || "justify",
      lineGap: 2,
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
        renderPdfLeadInParagraph(doc, match[1], match[2], { align: "center", after: 0.35 });
      } else {
        doc.font("Times-Bold").fontSize(12).text(line, { align: "center", lineGap: 2 });
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

    if (/^(?:\([A-Z]\)\s*)?WHEREAS[,:\s]/i.test(line) || /^\([A-Z]\)\s+/i.test(line)) {
      const recitalText = line.replace(/^\([A-Z]\)\s*/i, "");
      const normalized = /^WHEREAS[,:\s]/i.test(recitalText)
        ? recitalText
        : `WHEREAS, ${recitalText}`;
      const leadMatch = normalized.match(/^(WHEREAS,?\s*)(.*)$/i);
      renderPdfLeadInParagraph(doc, leadMatch?.[1] || "WHEREAS, ", leadMatch?.[2] || "", {
        align: "justify",
        after: 0.35,
      });
      continue;
    }

    if (/^NOW[,\s]+(THEREFORE|WITNESSETH)/i.test(line)) {
      const leadMatch = line.match(/^(NOW,\s*(?:THEREFORE|WITNESSETH),?\s*)(.*)$/i);
      renderPdfLeadInParagraph(
        doc,
        leadMatch?.[1] || "NOW, THEREFORE, ",
        leadMatch?.[2] || "",
        { align: "justify", after: 0.35 }
      );
      continue;
    }

    doc.font("Times-Roman").fontSize(12).text(line, {
      align: "justify",
      lineGap: 2,
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
    .text(prefix, { align: "left", continued: true, indent: 36 });
  doc.font("Times-Bold").fontSize(12).text(heading, { align: "left", indent: 36 });
  doc.moveDown(0.25);

  const blocks = tokenizeClauseText(clause.text || "");

  for (const block of blocks) {
    if (block.type === "item") {
      doc.font("Times-Roman").fontSize(12).text(block.text, {
        align: "left",
        lineGap: 2,
        indent: 36,
      });
      doc.moveDown(0.2);
      continue;
    }

    doc.font("Times-Roman").fontSize(12).text(block.text, {
      align: "justify",
      lineGap: 2,
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
      .font(/^IN WITNESS WHEREOF|^Witnesses:/i.test(line) ? "Times-Bold" : "Times-Roman")
      .fontSize(12)
      .text(line, { align: "left", lineGap: 2 });
    doc.moveDown(/^IN WITNESS WHEREOF|^Witnesses:/i.test(line) ? 0.5 : 0.25);
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
      alignment: AlignmentType.CENTER,
      spacing: { after: BODY_AFTER_SPACING, line: BODY_LINE_SPACING },
      indent: { left: TITLE_INDENT_LEFT },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          underline: { type: "single" },
          size: TITLE_SIZE,
          font: BODY_FONT,
        }),
      ],
    }),
    buildBlankParagraph({ alignment: AlignmentType.CENTER }),
  ];

  if (identityClause?.text?.trim()) {
    renderIdentityClause(children, identityClause.text);
  }

  bodyClauses.forEach((clause, index) => {
    renderBodyClause(children, clause, index + 1);
  });

  if (scheduleClauses.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 420, after: 220 },
        children: [buildBodyRun("SCHEDULES AND SPECIFICATIONS", { bold: true })],
      })
    );

    scheduleClauses.forEach((clause, index) => {
      renderBodyClause(children, clause, index + 1, { scheduleMode: true });
    });
  }

  signatureClauses.forEach((clause) => {
    renderSignatureBlock(children, clause.text);
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
    doc.moveDown(0.4);

    if (identityClause?.text?.trim()) {
      renderPdfIdentityClause(doc, identityClause.text);
    }

    bodyClauses.forEach((clause, index) => {
      renderPdfBodyClause(doc, clause, index + 1);
    });

    if (scheduleClauses.length) {
      doc.moveDown(1);
      doc
        .font("Times-Bold")
        .fontSize(13)
        .text("SCHEDULES AND SPECIFICATIONS", { align: "center" });
      doc.moveDown(0.6);

      scheduleClauses.forEach((clause, index) => {
        renderPdfBodyClause(doc, clause, index + 1, { scheduleMode: true });
      });
    }

    signatureClauses.forEach((clause) => {
      renderPdfSignatureBlock(doc, clause.text);
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

  if (scheduleClauses.length) {
    lines.push(`\nSCHEDULES AND SPECIFICATIONS\n${"=".repeat(28)}`);
    scheduleClauses.forEach((clause, index) => {
      const heading = resolveFallbackHeading(clause, index + 1);
      lines.push(`\nSCHEDULE ${index + 1}. ${heading.toUpperCase()}\n${"-".repeat(40)}`);
      lines.push(String(clause.text || "").trim());
      if (clause.statutory_reference) {
        lines.push(`[Ref: ${clause.statutory_reference}]`);
      }
    });
  }

  signatureClauses.forEach((clause) => {
    lines.push(`\n${"-".repeat(40)}`);
    lines.push(String(clause.text || "").trim());
  });

  return lines.join("\n");
}
