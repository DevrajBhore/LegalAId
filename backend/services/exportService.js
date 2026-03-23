/**
 * exportService.js
 *
 * Converts a generated draft document into downloadable formats.
 * Supports: DOCX, plain text.
 *
 * Uses the `docx` npm package for Word export.
 * Install: npm install docx
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  NumberFormat,
  convertInchesToTwip,
  LevelFormat,
  Footer,
} from "docx";

// ── DOCX export ───────────────────────────────────────────────────────────────

/**
 * Convert a draft object to a DOCX Buffer.
 * @param {Object} draft  - { document_type, clauses: [{title, text, category}] }
 * @param {Object} validation - IRE validation result { certified, risk_level, issues }
 * @returns {Buffer}
 */
// ── Identity clause renderer ──────────────────────────────────────────────────
// Renders the IDENTITY clause as a formal Indian legal party block:
//   TITLE (underlined)
//   "This Agreement is made and executed on this ___ day of ___..."
//   Party 1 block  →  AND  →  Party 2 block
//   WHEREAS recitals
//   NOW THEREFORE preamble
// The raw clause text from the AI contains all this — we parse it into
// structured paragraphs with proper formatting instead of dumping it as body.

function renderIdentityClause(children, text, docTitle) {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const upper = line.toUpperCase();

    // "AND" separator between parties — bold, centered
    if (/^AND$/.test(line.trim())) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 160, after: 160 },
          children: [
            new TextRun({
              text: "AND",
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      continue;
    }

    // WHEREAS heading
    if (/^WHEREAS[,:.]?$/.test(line.trim())) {
      children.push(
        new Paragraph({
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: "WHEREAS,",
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      continue;
    }

    // NOW THEREFORE preamble
    if (/^NOW[,\s]+(THEREFORE|WITNESSETH)/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 280, after: 200 },
          children: [
            new TextRun({
              text: line,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
      continue;
    }

    // Opening recital line — "This Agreement is made and executed..."
    if (/^This\s+/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: line, size: 24, font: "Times New Roman" }),
          ],
        })
      );
      continue;
    }

    // "by and between:" or "between:" — regular body
    if (/^(by and between|between)[:\s]/i.test(line)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 200 },
          children: [
            new TextRun({ text: line, size: 24, font: "Times New Roman" }),
          ],
        })
      );
      continue;
    }

    // Everything else in IDENTITY — justified body text, no indent
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 160, line: 360 },
        children: [
          new TextRun({ text: line, size: 24, font: "Times New Roman" }),
        ],
      })
    );
  }

  // Divider before operative clauses
  children.push(
    new Paragraph({
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 4,
          color: "333333",
          space: 1,
        },
      },
      spacing: { before: 200, after: 320 },
      children: [],
    })
  );
}

export async function draftToDocx(draft, validation = null) {
  const docType = draft.document_type || "LEGAL DOCUMENT";
  const clauses = draft.clauses || [];
  const title = formatDocTitle(docType);

  const children = [];

  // ── Document title — bold + underline, centered, like the template ────────
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          underline: { type: "single" },
          size: 32,
          font: "Times New Roman",
        }),
      ],
    })
  );

  // ── Clauses ───────────────────────────────────────────────────────────────
  // The IDENTITY clause gets special treatment — rendered as a formal party
  // block matching Indian legal document conventions (the template style).
  // All other clauses render as numbered headings + body text.
  const identityClause = clauses.find((c) => c.category === "IDENTITY");
  const remainingClauses = clauses.filter((c) => c.category !== "IDENTITY");

  if (identityClause?.text?.trim()) {
    renderIdentityClause(children, identityClause.text, title);
  }

  remainingClauses.forEach((clause, index) => {
    if (!clause.text?.trim()) return;
    const clauseNum = index + 1;

    // Clause heading
    if (clause.title) {
      children.push(
        new Paragraph({
          spacing: { before: 320, after: 120 },
          children: [
            new TextRun({
              text: `${clauseNum}. ${clause.title.toUpperCase()}`,
              bold: true,
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
    }

    // Clause text — split on paragraph breaks
    const paragraphs = clause.text.trim().split(/\n{2,}/);
    paragraphs.forEach((para) => {
      if (!para.trim()) return;
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 160, line: 360 },
          children: [
            new TextRun({
              text: para.replace(/\n/g, " ").trim(),
              size: 24,
              font: "Times New Roman",
            }),
          ],
        })
      );
    });

    // Statutory reference
    if (clause.statutory_reference) {
      children.push(
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: `[Ref: ${clause.statutory_reference}]`,
              italics: true,
              size: 18,
              color: "888888",
              font: "Times New Roman",
            }),
          ],
        })
      );
    }
  });

  // ── Validation summary (if provided) ─────────────────────────────────────
  if (validation) {
    children.push(
      new Paragraph({
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: "1A3C5E",
            space: 1,
          },
        },
        spacing: { before: 600, after: 200 },
        children: [
          new TextRun({
            text: "LEGAL VALIDATION SUMMARY",
            bold: true,
            size: 24,
            font: "Calibri",
            color: "1A3C5E",
          }),
        ],
      })
    );

    const riskColor =
      {
        LOW: "2E7D32",
        MEDIUM: "F57C00",
        HIGH: "D32F2F",
        BLOCKED: "B71C1C",
      }[validation.risk_level] || "666666";

    children.push(
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: "Status: ",
            bold: true,
            size: 22,
            font: "Calibri",
          }),
          new TextRun({
            text: validation.certified ? "CERTIFIED ✓" : "NOT CERTIFIED ✗",
            bold: true,
            size: 22,
            font: "Calibri",
            color: validation.certified ? "2E7D32" : "D32F2F",
          }),
          new TextRun({
            text: "   Risk Level: ",
            bold: true,
            size: 22,
            font: "Calibri",
          }),
          new TextRun({
            text: validation.risk_level || "UNKNOWN",
            bold: true,
            size: 22,
            font: "Calibri",
            color: riskColor,
          }),
        ],
      })
    );

    // List issues
    const issues = validation.issues || [];
    const critical = issues.filter((i) => i.severity === "CRITICAL");
    const high = issues.filter((i) => i.severity === "HIGH");
    const medium = issues.filter((i) => i.severity === "MEDIUM");

    if (issues.length === 0) {
      children.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: "No validation issues found.",
              italics: true,
              size: 22,
              font: "Calibri",
              color: "2E7D32",
            }),
          ],
        })
      );
    } else {
      [
        [critical, "CRITICAL", "B71C1C"],
        [high, "HIGH", "D32F2F"],
        [medium, "MEDIUM", "F57C00"],
      ].forEach(([group, label, color]) => {
        if (!group.length) return;
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 80 },
            children: [
              new TextRun({
                text: `${label} (${group.length})`,
                bold: true,
                size: 22,
                font: "Calibri",
                color,
              }),
            ],
          })
        );
        group.slice(0, 10).forEach((issue) => {
          children.push(
            new Paragraph({
              indent: { left: convertInchesToTwip(0.3) },
              spacing: { after: 80 },
              children: [
                new TextRun({
                  text: `• ${issue.rule_id}: `,
                  bold: true,
                  size: 20,
                  font: "Calibri",
                  color,
                }),
                new TextRun({
                  text: issue.message || "",
                  size: 20,
                  font: "Calibri",
                }),
              ],
            })
          );
          if (issue.suggestion) {
            children.push(
              new Paragraph({
                indent: { left: convertInchesToTwip(0.5) },
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: `  → ${issue.suggestion}`,
                    italics: true,
                    size: 18,
                    font: "Calibri",
                    color: "555555",
                  }),
                ],
              })
            );
          }
        });
      });
    }
  }

  // ── Build document ────────────────────────────────────────────────────────
  const doc = new Document({
    creator: "LegalAId",
    title,
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1.2),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${title} — Generated by LegalAId`,
                    size: 16,
                    color: "888888",
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * Convert a draft to plain text.
 */
export function draftToText(draft) {
  const title = formatDocTitle(draft.document_type || "LEGAL DOCUMENT");
  const clauses = draft.clauses || [];
  const lines = [`${title}\n${"=".repeat(title.length)}\n`];

  clauses.forEach((clause, i) => {
    if (!clause.text?.trim()) return;
    if (clause.title)
      lines.push(
        `\n${i + 1}. ${clause.title.toUpperCase()}\n${"-".repeat(40)}`
      );
    lines.push(clause.text.trim());
    if (clause.statutory_reference)
      lines.push(`[Ref: ${clause.statutory_reference}]`);
  });

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Display names for document types
const DOC_DISPLAY_NAMES = {
  NDA: "Non-Disclosure Agreement",
  EMPLOYMENT_CONTRACT: "Employment Contract",
  SERVICE_AGREEMENT: "Service Agreement",
  CONSULTANCY_AGREEMENT: "Consultancy Agreement",
  PARTNERSHIP_DEED: "Partnership Deed",
  SHAREHOLDERS_AGREEMENT: "Shareholders Agreement",
  JOINT_VENTURE_AGREEMENT: "Joint Venture Agreement",
  SUPPLY_AGREEMENT: "Supply Agreement",
  DISTRIBUTION_AGREEMENT: "Distribution Agreement",
  SALES_OF_GOODS_AGREEMENT: "Sale of Goods Agreement",
  INDEPENDENT_CONTRACTOR_AGREEMENT: "Independent Contractor Agreement",
  COMMERCIAL_LEASE_AGREEMENT: "Commercial Lease Agreement",
  LEAVE_AND_LICENSE_AGREEMENT: "Leave and License Agreement",
  LOAN_AGREEMENT: "Loan Agreement",
  GUARANTEE_AGREEMENT: "Guarantee Agreement",
  SOFTWARE_DEVELOPMENT_AGREEMENT: "Software Development Agreement",
  MOU: "Memorandum of Understanding",
  PRIVACY_POLICY: "Privacy Policy",
};

function formatDocTitle(docType) {
  // Case-insensitive lookup
  const key = (docType || "").toUpperCase();
  if (DOC_DISPLAY_NAMES[key]) return DOC_DISPLAY_NAMES[key];
  // Fallback: capitalise each word
  return (docType || "LEGAL DOCUMENT")
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
