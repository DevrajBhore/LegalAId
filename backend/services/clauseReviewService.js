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

  const { clauseId, stub, wiringRule } = buildPromotedArtifacts(row);

  fs.mkdirSync(PROMOTED_DIR, { recursive: true });
  const outPath = path.join(PROMOTED_DIR, `${clauseId}.json`);
  fs.writeFileSync(
    outPath,
    JSON.stringify(wiringRule ? { ...stub, _wiring_rule: wiringRule } : stub, null, 2) + "\n"
  );

  row.status = "promoted";
  row.promotedClauseId = clauseId;
  await row.save();

  return {
    promoted: true,
    clause_id: clauseId,
    staged_path: path.relative(path.resolve(__dirname, "../.."), outPath),
    wiring_rule: wiringRule,
    note: row.source === "ai-proposed"
      ? "Reviewed clause + wiring rule staged in knowledge-base/clauses/_promoted/ (not auto-loaded). Move the clause file into clause_library/<family>/ and add _wiring_rule to the blueprint (or ruleset) to activate."
      : "Stub written to a staging folder (not auto-loaded). Fill legal_basis and move into clause_library/ to activate.",
    stub,
  };
}

// Pure: build the staged clause file + wiring rule from a review row.
// Exported for unit testing without Mongo / the filesystem.
export function buildPromotedArtifacts(row) {
  const clauseId = `${String(row.category).toUpperCase()}_REVIEWED_${String(row.fingerprint)
    .slice(0, 8)
    .toUpperCase()}`;
  const isAi = row.source === "ai-proposed";
  // For AI proposals the lawyer-reviewed legal basis is already present; parse the
  // free-text "Act – Section" into the structured legal_basis the engine expects.
  const legalBasis = isAi && row.legalBasis
    ? parseLegalBasis(row.legalBasis)
    : [{ act: "REVIEW REQUIRED", section: "TBD", note: "Fill before production use" }];

  const stub = {
    clause_id: clauseId,
    name: row.clauseName || row.category,
    category: String(row.category).toUpperCase(),
    document_types: isAi && row.documentType ? [row.documentType] : ["ALL"],
    jurisdiction: "India",
    text: row.text,
    legal_basis: legalBasis,
    mandatory: false,
    enforceability: "MEDIUM",
    risk_level: String(row.riskLevel || "medium").toUpperCase(),
    invalid_if: [],
    source: row.sourceDocumentName || "scraped template (reviewed)",
    version: "0.1.0-draft",
    review_status: "approved-pending-activation",
    needs_legal_basis: !(isAi && row.legalBasis),
    promoted_from_review: String(row._id),
  };

  // The blueprint rule needed to wire this clause in — so activation is a copy,
  // not a re-derivation. (AI proposals carry the when/action; mined ones don't.)
  const wiringRule = isAi && row.ruleWhen
    ? {
        document_type: row.documentType,
        action: row.ruleAction || "add",
        clause: clauseId,
        ...(String(row.ruleAction) === "replace"
          ? { slot: `${String(row.category).toLowerCase()}_variant`, replaces: "REVIEW_TARGET_CLAUSE_ID" }
          : { include_if: row.ruleWhen }),
        why: row.proposalWhy || undefined,
        review_status: "draft-needs-legal-review",
      }
    : null;

  return { clauseId, stub, wiringRule };
}

// Parse a free-text legal basis like "Indian Contract Act, 1872 – S.27; IT Act 2000 – S.43A"
// into the structured [{act, section, note}] form the clause schema uses.
function parseLegalBasis(raw) {
  return String(raw)
    .split(/;|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      // Require an explicit section marker (S. / Sec. / Section) so we don't
      // mistake a year ("...Act, 1872") for a section number.
      const m = part.match(
        /^(.+?)[\s,]*(?:–|-|—)?\s*(?:S\.?|Sec\.?|Section)\s*([0-9][0-9A-Za-z().]*)\s*$/i
      );
      const stripTail = (s) => s.replace(/[–\-—,\s]+$/, "").trim();
      if (m) return { act: stripTail(m[1]), section: m[2].trim(), note: "" };
      return { act: stripTail(part), section: "", note: "" };
    })
    .slice(0, 6);
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
    source: row.source || "mined",
    documentType: row.documentType || null,
    legalBasis: row.legalBasis || null,
    ruleWhen: row.ruleWhen || null,
    ruleAction: row.ruleAction || null,
    proposalWhy: row.proposalWhy || null,
    textPreview: String(row.text || "").slice(0, 240),
    text: String(row.text || ""),
  };
}
