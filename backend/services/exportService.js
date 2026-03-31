import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";
import { getDocumentDisplayName } from "../../shared/documentRegistry.js";
import {
  normalizeClauseCategory,
  sortClausesByOrder,
} from "../config/clauseOrder.js";

const BODY_FONT = "Times New Roman";
const BODY_SIZE = 24;
const TITLE_SIZE = 32;

function formatDocTitle(docType) {
  return getDocumentDisplayName((docType || "").toUpperCase());
}

function buildBodyRun(text, options = {}) {
  return new TextRun({
    text,
    font: BODY_FONT,
    size: BODY_SIZE,
    ...options,
  });
}

function buildBodyParagraph(text, options = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 360 },
    children: [buildBodyRun(text)],
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
      return category !== "IDENTITY" && category !== "SIGNATURE_BLOCK";
    }),
    signatureClauses: orderedClauses.filter(
      (clause) => normalizeClauseCategory(clause.category) === "SIGNATURE_BLOCK"
    ),
  };
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
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^AND$/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 180 },
          children: [buildBodyRun("AND", { bold: true })],
        })
      );
      continue;
    }

    if (/^WHEREAS[,:.]*$/i.test(line)) {
      children.push(
        new Paragraph({
          spacing: { before: 260, after: 120 },
          children: [buildBodyRun("WHEREAS,", { bold: true })],
        })
      );
      continue;
    }

    if (/^NOW[,\s]+(THEREFORE|WITNESSETH)/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 260, after: 180 },
          children: [buildBodyRun(line, { bold: true })],
        })
      );
      continue;
    }

    children.push(buildBodyParagraph(line));
  }

  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: "444444",
          space: 1,
        },
      },
      spacing: { before: 220, after: 320 },
      children: [],
    })
  );
}

function renderBodyClause(children, clause, clauseNumber) {
  const heading = resolveFallbackHeading(clause, clauseNumber);

  children.push(
    new Paragraph({
      spacing: { before: 320, after: 120 },
      children: [
        buildBodyRun(`${clauseNumber}. ${heading.toUpperCase()}`, { bold: true }),
      ],
    })
  );

  const paragraphs = String(clause.text || "")
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    children.push(buildBodyParagraph(paragraph));
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
    new Paragraph({
      border: {
        top: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: "444444",
          space: 1,
        },
      },
      spacing: { before: 420, after: 260 },
      children: [],
    })
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
        spacing: { after: /^IN WITNESS WHEREOF/i.test(line) ? 220 : 90 },
        children: [
          buildBodyRun(
            line,
            /^IN WITNESS WHEREOF/i.test(line) ? { bold: true } : {}
          ),
        ],
      })
    );
  }
}

export async function draftToDocx(draft) {
  const docType = draft?.document_type || "LEGAL DOCUMENT";
  const title = formatDocTitle(docType);
  const { identityClause, bodyClauses, signatureClauses } = splitDocumentClauses(
    draft?.clauses || []
  );

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
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
  ];

  if (identityClause?.text?.trim()) {
    renderIdentityClause(children, identityClause.text);
  }

  bodyClauses.forEach((clause, index) => {
    renderBodyClause(children, clause, index + 1);
  });

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
              right: convertInchesToTwip(1.2),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

export function draftToText(draft) {
  const title = formatDocTitle(draft?.document_type || "LEGAL DOCUMENT");
  const { identityClause, bodyClauses, signatureClauses } = splitDocumentClauses(
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

  return lines.join("\n");
}
