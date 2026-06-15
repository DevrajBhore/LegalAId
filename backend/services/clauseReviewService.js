/**
 * clauseReviewService.js
 *
 * The governance bridge from mined clause variants (knowledge-base/clauses/,
 * produced by scripts/auditTemplates.cjs) to the production clause_library.
 * Mined variants are imported as `pending` review rows; an admin approves /
 * rejects; approved rows can be `promoted` to a production-schema clause stub
 * written to knowledge-base/clauses/_promoted/ (NOT auto-loaded by the engine)
 * so a human can fill legal_basis and move it into clause_library deliberately.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import ClauseReview from "../models/ClauseReview.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINED_DIR = path.resolve(__dirname, "../../knowledge-base/clauses");
const PROMOTED_DIR = path.join(MINED_DIR, "_promoted");

function fingerprint(text) {
  return crypto
    .createHash("sha256")
    .update(String(text).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 600))
    .digest("hex")
    .slice(0, 32);
}

function readMinedFamilies() {
  if (!fs.existsSync(MINED_DIR)) return [];
  const families = [];
  for (const file of fs.readdirSync(MINED_DIR)) {
    if (!file.endsWith(".json") || file === "index.json" || file.startsWith("_")) {
      continue;
    }
    try {
      const data = JSON.parse(fs.readFileSync(path.join(MINED_DIR, file), "utf8"));
      if (Array.isArray(data.variants)) families.push(data);
    } catch {
      /* skip unreadable */
    }
  }
  return families;
}

// Import (idempotent) mined variants into the review queue.
export async function importMinedClauses() {
  const families = readMinedFamilies();
  let imported = 0;
  let skipped = 0;

  for (const family of families) {
    for (const variant of family.variants) {
      const fp = fingerprint(variant.text);
      const existing = await ClauseReview.findOne({
        category: family.category,
        fingerprint: fp,
      }).lean();
      if (existing) {
        skipped += 1;
        continue;
      }
      await ClauseReview.create({
        category: family.category,
        fingerprint: fp,
        clauseName: variant.clause_name || family.clause_name || null,
        text: variant.text,
        charLength: variant.char_length || variant.text.length,
        riskLevel: variant.risk_level || family.risk_level || "medium",
        sourceTemplate: variant.source_template || null,
        sourceDocumentName: variant.source_document_name || null,
        status: "pending",
      });
      imported += 1;
    }
  }

  return { imported, skipped, families: families.length };
}

export async function listClauseReviews({ status, category } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  const rows = await ClauseReview.find(filter)
    .sort({ category: 1, charLength: -1 })
    .lean();
  return rows.map(serialize);
}

export async function setReviewStatus({ id, status, notes, userId }) {
  if (!["approved", "rejected", "pending"].includes(status)) {
    const error = new Error("status must be approved, rejected, or pending.");
    error.statusCode = 400;
    throw error;
  }
  const row = await ClauseReview.findById(id);
  if (!row) {
    const error = new Error("Clause review not found.");
    error.statusCode = 404;
    throw error;
  }
  row.status = status;
  row.reviewNotes = notes ?? row.reviewNotes;
  row.reviewedBy = userId || null;
  row.reviewedAt = new Date();
  await row.save();
  return serialize(row.toObject());
}

// Promote an approved variant to a production-schema clause stub.
export async function promoteClause({ id }) {
  const row = await ClauseReview.findById(id);
  if (!row) {
    const error = new Error("Clause review not found.");
    error.statusCode = 404;
    throw error;
  }
  if (row.status !== "approved") {
    const error = new Error("Only approved clauses can be promoted.");
    error.statusCode = 409;
    throw error;
  }

  const clauseId = `${row.category.toUpperCase()}_REVIEWED_${row.fingerprint
    .slice(0, 8)
    .toUpperCase()}`;

  const stub = {
    clause_id: clauseId,
    name: row.clauseName || row.category,
    category: row.category.toUpperCase(),
    document_types: ["ALL"],
    jurisdiction: "India",
    text: row.text,
    legal_basis: [{ act: "REVIEW REQUIRED", section: "TBD", note: "Fill before production use" }],
    mandatory: false,
    enforceability: "MEDIUM",
    risk_level: String(row.riskLevel || "medium").toUpperCase(),
    invalid_if: [],
    source: row.sourceDocumentName || "scraped template (reviewed)",
    version: "0.1.0-draft",
    needs_legal_basis: true,
    promoted_from_review: String(row._id),
  };

  fs.mkdirSync(PROMOTED_DIR, { recursive: true });
  const outPath = path.join(PROMOTED_DIR, `${clauseId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(stub, null, 2) + "\n");

  row.status = "promoted";
  row.promotedClauseId = clauseId;
  await row.save();

  return {
    promoted: true,
    clause_id: clauseId,
    staged_path: path.relative(path.resolve(__dirname, "../.."), outPath),
    note: "Stub written to a staging folder (not auto-loaded). Fill legal_basis and move into clause_library/ to activate.",
    stub,
  };
}

function serialize(row) {
  return {
    id: String(row._id),
    category: row.category,
    clauseName: row.clauseName,
    charLength: row.charLength,
    riskLevel: row.riskLevel,
    status: row.status,
    reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt,
    promotedClauseId: row.promotedClauseId,
    sourceDocumentName: row.sourceDocumentName,
    textPreview: String(row.text || "").slice(0, 240),
    text: String(row.text || ""),
  };
}
