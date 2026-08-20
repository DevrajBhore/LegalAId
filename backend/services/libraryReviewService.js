/**
 * libraryReviewService.js
 *
 * Advocate review of the LIVE clause library.
 *
 * The existing clause-review queue (clauseReviewService.js) handles *candidate*
 * clauses — mined or AI-proposed text waiting to be promoted into the library.
 * This module handles the other half: the clauses already shipping in generated
 * documents, none of which carried a reviewer.
 *
 * Ordering matters more than completeness here. Reviewing 191 clauses in file
 * order is a poor use of an advocate's time when a fifth of them account for
 * most of what users actually receive, so clauses are ranked by how many
 * document types render them, weighted by risk. A partly-reviewed library is a
 * legitimate state — per-document review coverage is already surfaced to users.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { clauseReviewState, REVIEW_STATE } from "../../shared/clauseProvenance.js";
import { clearClauseCache } from "./clauseAssembler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLAUSE_LIB = path.resolve(__dirname, "../../knowledge-base/clause_library");
const BLUEPRINT_DIR = path.join(CLAUSE_LIB, "blueprints");

const PLACEHOLDER_REVIEWERS = new Set(["", "pending", "tbd", "todo", "none", "n/a", "unknown"]);
const DECISIONS = new Set(["approve", "amend", "reject", "discuss", "reset"]);
const RISK_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * How many document types list each clause. Read from the blueprints rather
 * than by generating 22 documents, so the admin list stays cheap to load.
 */
function buildReachIndex() {
  const reach = new Map();
  if (!fs.existsSync(BLUEPRINT_DIR)) return reach;

  for (const file of fs.readdirSync(BLUEPRINT_DIR)) {
    if (!file.endsWith(".json")) continue;
    let blueprint;
    try {
      blueprint = JSON.parse(fs.readFileSync(path.join(BLUEPRINT_DIR, file), "utf8"));
    } catch {
      continue;
    }
    if (blueprint?.deprecated) continue;

    const docType = blueprint.document_type || file.replace(/\.blueprint\.json$/, "");
    const ids = new Set([
      ...(blueprint.clauses || []),
      ...(blueprint.required_clauses || []),
      ...(blueprint.conditional_clauses || []).map((entry) => entry?.clause).filter(Boolean),
      ...(blueprint.variant_clauses || []).flatMap((slot) => [
        slot?.default,
        ...(slot?.select_first_match || slot?.variants || []).map((v) => v?.clause),
      ]),
    ].filter(Boolean));

    for (const id of ids) {
      const entry = reach.get(id) || new Set();
      entry.add(docType);
      reach.set(id, entry);
    }
  }
  return reach;
}

function walkClauseFiles() {
  const files = [];
  for (const dir of fs.readdirSync(CLAUSE_LIB, { withFileTypes: true })) {
    if (!dir.isDirectory() || dir.name === "blueprints") continue;
    for (const file of fs.readdirSync(path.join(CLAUSE_LIB, dir.name))) {
      if (file.endsWith(".json")) files.push(path.join(CLAUSE_LIB, dir.name, file));
    }
  }
  return files;
}

function readClauseFile(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function priorityOf(clause, reachCount) {
  const risk = RISK_WEIGHT[String(clause.risk_level || "").toUpperCase()] || 1;
  return reachCount * risk + (clause.mandatory === true ? 5 : 0);
}

/**
 * @param {object} options
 * @param {string} [options.state] - "approved" | "draft-needs-legal-review" | "unmarked" | "outstanding"
 * @param {string} [options.search]
 * @param {string} [options.documentType]
 */
export function listLibraryClauses({ state = null, search = null, documentType = null } = {}) {
  const reach = buildReachIndex();
  const needle = String(search || "").trim().toLowerCase();
  const rows = [];

  for (const file of walkClauseFiles()) {
    for (const clause of readClauseFile(file)) {
      if (!clause?.clause_id) continue;

      const docTypes = [...(reach.get(clause.clause_id) || [])].sort();
      const provenance = clauseReviewState(clause);

      if (state === "outstanding" && provenance.reviewed) continue;
      if (state && state !== "outstanding" && provenance.state !== state) continue;
      if (documentType && !docTypes.includes(documentType)) continue;
      if (
        needle &&
        !`${clause.clause_id} ${clause.title || clause.name || ""} ${clause.text || ""}`
          .toLowerCase()
          .includes(needle)
      ) {
        continue;
      }

      rows.push({
        clause_id: clause.clause_id,
        title: clause.title || clause.name || clause.clause_id,
        category: clause.category || "",
        domain: path.basename(path.dirname(file)),
        text: clause.text || "",
        risk_level: clause.risk_level || "",
        enforceability: clause.enforceability || "",
        mandatory: clause.mandatory === true,
        legal_basis: clause.legal_basis || [],
        document_types: docTypes,
        reach: docTypes.length,
        review_state: provenance.state,
        reviewed: provenance.reviewed,
        reviewed_by: provenance.reviewed_by,
        reviewed_on: provenance.reviewed_on,
        review_note: clause.review_note || "",
        priority: priorityOf(clause, docTypes.length),
      });
    }
  }

  rows.sort((a, b) => b.priority - a.priority || a.clause_id.localeCompare(b.clause_id));
  return rows;
}

export function summariseLibraryReview() {
  const rows = listLibraryClauses();
  const total = rows.length;
  const reviewed = rows.filter((row) => row.reviewed).length;
  const placements = rows.reduce((sum, row) => sum + row.reach, 0);
  const reviewedPlacements = rows
    .filter((row) => row.reviewed)
    .reduce((sum, row) => sum + row.reach, 0);

  return {
    total,
    reviewed,
    outstanding: total - reviewed,
    unused: rows.filter((row) => row.reach === 0).length,
    // The honest progress number: how much of what users actually receive has
    // been signed off, not how many files have been ticked.
    placements,
    reviewed_placements: reviewedPlacements,
    coverage_percent: placements ? Math.round((reviewedPlacements / placements) * 100) : 0,
  };
}

function locateClause(clauseId) {
  for (const file of walkClauseFiles()) {
    const parsed = readClauseFile(file);
    const index = parsed.findIndex((entry) => entry?.clause_id === clauseId);
    if (index !== -1) return { file, parsed, index };
  }
  return null;
}

/**
 * Records an advocate's decision against a live clause.
 *
 * A clause only counts as reviewed once it carries a real reviewer name and a
 * status that is no longer "draft-needs-legal-review" (see clauseProvenance.js),
 * so both are written together or not at all.
 */
export function recordLibraryReview({
  clauseId,
  decision,
  revisedText = "",
  note = "",
  reviewer,
  enrolment = "",
  reviewedOn = null,
} = {}) {
  const action = String(decision || "").trim().toLowerCase();
  if (!DECISIONS.has(action)) {
    throw httpError(
      `decision must be one of: ${[...DECISIONS].join(", ")}`,
      400
    );
  }

  // The reviewer comes from the authenticated session, so an empty value here
  // means the request arrived without one rather than that someone forgot to
  // type it.
  const name = String(reviewer || "").trim();
  if (action !== "reset" && PLACEHOLDER_REVIEWERS.has(name.toLowerCase())) {
    throw httpError(
      "Could not identify the reviewer from the session. Sign in again and retry.",
      400
    );
  }
  if (action === "amend" && !String(revisedText || "").trim()) {
    throw httpError("Amending a clause requires the revised text.", 400);
  }

  const found = locateClause(clauseId);
  if (!found) throw httpError(`Unknown clause_id "${clauseId}".`, 404);

  const { file, parsed, index } = found;
  const clause = parsed[index];
  const date = String(reviewedOn || "").slice(0, 10) || new Date().toISOString().slice(0, 10);

  if (action === "reset") {
    delete clause.reviewed_by;
    delete clause.reviewed_on;
    delete clause.reviewer_enrolment;
    delete clause.review_note;
    clause.review_status = REVIEW_STATE.DRAFT;
  } else if (action === "approve" || action === "amend") {
    if (action === "amend") clause.text = String(revisedText).trim();
    clause.reviewed_by = name;
    clause.reviewed_on = date;
    clause.review_status = "approved";
    if (enrolment) clause.reviewer_enrolment = String(enrolment).trim();
    if (note) clause.review_note = String(note).trim();
    else delete clause.review_note;
  } else {
    // reject / discuss: record the outcome without marking the clause reviewed,
    // because "this is wrong" is not a sign-off and must not read as one.
    clause.review_status = REVIEW_STATE.DRAFT;
    clause.review_note = String(note || "").trim() ||
      (action === "reject" ? "Rejected on review." : "Flagged for discussion.");
    clause.review_outcome = action;
    clause.review_flagged_by = name;
    clause.review_flagged_on = date;
    delete clause.reviewed_by;
    delete clause.reviewed_on;
  }

  const payload = Array.isArray(JSON.parse(fs.readFileSync(file, "utf8"))) ? parsed : parsed[0];
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  // The library is cached at bootstrap; without this the edit would not reach
  // generation until the process restarted.
  clearClauseCache();

  return {
    clause_id: clauseId,
    decision: action,
    review_state: clauseReviewState(clause).state,
    reviewed: clauseReviewState(clause).reviewed,
    reviewed_by: clause.reviewed_by || null,
    reviewed_on: clause.reviewed_on || null,
    summary: summariseLibraryReview(),
  };
}
