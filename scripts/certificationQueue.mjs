/**
 * certificationQueue.mjs — PHASE D.1 / D.5
 *
 * WHICH FAMILY TEACHES US THE MOST?
 *
 * Certifying alphabetically processes families; it does not find failure modes.
 * The eight already-passed families each established a DIFFERENT shape of
 * defect, and their value now is as a permanent regression corpus. So the next
 * family should be the one least like all eight — the one whose legal structure
 * the existing corpus cannot already break.
 *
 * This scores STRUCTURAL DISTANCE from the anchors on dimensions taken from the
 * artifacts (shape, party model, statutory density, external dependence), not
 * from an opinion about which family feels interesting. The ranking is evidence
 * for a choice; it does not make the choice.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { DOCUMENT_CONFIG } from "../backend/config/documentConfig.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { getBlueprintForDocumentType, getClauseById } from "../backend/services/clauseAssembler.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { documentShape } from "../shared/documentShape.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = ROOT_DIR;
// THE ANCHORS, READ FROM THE LADDER rather than listed here.
//
// A hardcoded list drifts the moment a family advances, and this queue's whole
// job is to measure distance FROM the anchors — so a stale list would rank
// against a corpus that no longer exists. Derived from the certification report,
// which derives it from evidence.
const CERTIFICATION = path.resolve(ROOT_DIR, "docs/audit/FAMILY_CERTIFICATION.txt");
function readAnchors() {
  const report = fs.readFileSync(CERTIFICATION, "utf8");
  const section = report.slice(report.indexOf("FALSIFICATION_PASSED"));
  const end = section.search(/\n[A-Z_]+\s+\(\d+\)/);
  const body = end > 0 ? section.slice(0, end) : section;
  return new Set(
    body.split("\n")
      .map((line) => line.match(/^ {2}([A-Z][A-Z0-9_]+)$/))
      .filter(Boolean)
      .map((m) => m[1])
  );
}
const ANCHORS = readAnchors();
if (ANCHORS.size < 2) {
  throw new Error(
    `Only ${ANCHORS.size} anchor(s) read from ${CERTIFICATION}. Regenerate it with ` +
    `scripts/reportFamilyCertification.mjs before ranking — a queue measured against an empty ` +
    `corpus ranks nothing and would look like it worked.`
  );
}

// WHAT THE SYSTEM HAS ALREADY LEARNED — which is not the same as what has been
// certified.
//
// The first version measured distance from the FALSIFICATION_PASSED families
// only, and ranked ARBITRATION_NOTICE top on "document shape NOTICE unseen".
// CHEQUE_BOUNCE_NOTICE is a NOTICE, carries eleven authored requirements
// including three TIMING, and the entire timing model — UNVERIFIABLE,
// OUT_OF_TIME, calendar-month arithmetic, legal trigger versus proxy field —
// was built for it. It is simply not certified, having been withheld
// deliberately.
//
// A family teaches less if the system has already authored its shape, whatever
// rung it sits on. Measuring against certification status rather than against
// authored knowledge inflated a score by exactly the thing the ranking exists to
// find. Seventh measurement correction in this work, and the same shape as the
// others: the population measured against was the wrong one.
const LEARNED = new Set([...ANCHORS, ...loadDocumentRequirements().keys()]);

function clauseIdsFor(documentType) {
  const blueprint = getBlueprintForDocumentType(documentType);
  const ids = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if (typeof node.clause === "string") ids.add(node.clause);
      Object.values(node).forEach(walk);
    } else if (typeof node === "string" && /^[A-Z][A-Z0-9_]*_\d+$/.test(node)) ids.add(node);
  };
  walk(blueprint);
  return [...ids];
}

/** The dimensions, each read off an artifact rather than asserted. */
function profile(documentType) {
  const config = DOCUMENT_CONFIG[documentType] || {};
  const schema = getVariables(documentType) || {};
  const ids = clauseIdsFor(documentType);
  const clauses = ids.map((id) => getClauseById(id)).filter(Boolean);
  const acts = new Set();
  for (const clause of clauses) {
    for (const basis of clause.legal_basis || []) if (basis.act) acts.add(basis.act);
  }
  const fields = Object.keys(schema);
  return {
    documentType,
    // A bargain has two sides that sign. A policy or sworn statement does not.
    signature: config.signatureType || "?",
    // The registry has no `shape` field — it is computed. Reading a key that does
    // not exist gave every family the same empty shape, so the dimension scored
    // nothing at all while appearing to work.
    shape: documentShape(documentType) || "",
    // Party count is NOT measured. The obvious proxy — fields matching
    // /^party_\d_name$/ — returns 0 for a partnership deed, whose parties are
    // called partner_1_name, and 0 for a policy, which names a company and no
    // counterparty. A dimension that reports "0 named parties" for a two-partner
    // deed is measuring the regex, not the family, and it dominated the first
    // ranking. Dropped rather than patched: signature model already carries the
    // same information from an authored field.
    clauses: ids.length,
    // Statutory density: a family whose clauses rest on many Acts is governed by
    // law rather than by what the parties agreed.
    acts: acts.size,
    actNames: [...acts],
    // Does any clause point at an instrument this system never sees?
    externalInstrument: clauses.some((c) =>
      /articles of association|principal (?:contract|debt|agreement)|underlying (?:agreement|financing)|the Scheme|scheme document/i
        .test(c.text || "")),
    requirements: (loadDocumentRequirements().get(documentType) || []).length,
  };
}

const anchorProfiles = [...LEARNED].map(profile);
const anchorSignatures = new Set(anchorProfiles.map((p) => p.signature));
const anchorShapes = new Set(anchorProfiles.map((p) => p.shape));
const anchorActs = new Set(anchorProfiles.flatMap((p) => p.actNames));
const anchorExternal = anchorProfiles.some((p) => p.externalInstrument);

const rows = [];
for (const documentType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  if (LEARNED.has(documentType)) continue;
  const p = profile(documentType);
  const novelActs = p.actNames.filter((a) => !anchorActs.has(a));
  // Distance, with each point traceable to the artifact that produced it.
  const reasons = [];
  let score = 0;
  if (!anchorSignatures.has(p.signature)) { score += 3; reasons.push(`signature model "${p.signature}" unseen`); }
  if (!anchorShapes.has(p.shape)) { score += 3; reasons.push(`document shape "${p.shape}" unseen`); }
  if (p.externalInstrument && !anchorExternal) { score += 3; reasons.push("obligations defined by an instrument the system never sees"); }
  if (novelActs.length >= 3) { score += 2; reasons.push(`${novelActs.length} statutes no anchor family touches`); }
  else if (novelActs.length) { score += 1; reasons.push(`${novelActs.length} statute(s) no anchor touches`); }
  // Statutory-content families: the Act prescribes what the document must say,
  // so the requirement set is not negotiated between parties. Nothing in the
  // anchor set works this way.
  if (/POLICY/.test(p.shape)) { score += 3; reasons.push("content prescribed by statute rather than negotiated"); }
  rows.push({ ...p, score, reasons, novelActs });
}
rows.sort((a, b) => b.score - a.score || b.acts - a.acts);

const lines = [];
lines.push("# Phase D.1 — the certification queue\n");
lines.push(`Falsification-passed anchors (${ANCHORS.size}): ${[...ANCHORS].join(", ")}\n`);
lines.push(`Also authored, and therefore also already teaching the system: ${[...LEARNED].filter((f) => !ANCHORS.has(f)).join(", ") || "none"}\n`);
lines.push("Ranked by STRUCTURAL DISTANCE from those eight. A high score means the existing");
lines.push("corpus is least able to break this family, so certifying it is most likely to");
lines.push("expose a failure mode we have not already seen. It is not a defect score.\n");
lines.push("| rank | family | score | clauses | acts | why it is unlike the anchors |");
lines.push("|---|---|---|---|---|---|");
rows.forEach((r, i) => lines.push(
  `| ${i + 1} | ${r.documentType} | ${r.score} | ${r.clauses} | ${r.acts} | ${r.reasons.join("; ") || "—"} |`));
fs.writeFileSync(path.join(ROOT, "docs/audit/CERTIFICATION_QUEUE.md"), lines.join("\n") + "\n");

console.log(`${rows.length} families ranked by distance from the ${LEARNED.size} the system has authored ` +
  `(${ANCHORS.size} of them falsification-passed)\n`);
for (const r of rows.slice(0, 8)) {
  console.log(`  ${String(r.score).padStart(2)}  ${r.documentType.padEnd(34)} ${r.reasons.join("; ")}`);
}
