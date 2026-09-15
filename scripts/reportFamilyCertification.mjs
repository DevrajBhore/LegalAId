/**
 * Where does each document family actually stand?
 * Run: node scripts/reportFamilyCertification.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { certify, RUNG } from "../backend/services/familyCertification.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const baseline = JSON.parse(
  fs.readFileSync(path.resolve(HERE, "../tests/baseline/clause-baseline.json"), "utf8")
);
const generates = new Set(
  Object.entries(baseline.types || {})
    .filter(([, record]) => (record?.full?.clauses || []).length)
    .map(([documentType]) => documentType)
);

// Clause-level review evidence, read from the library rather than asserted.
const { getAllClauses } = await import("../backend/services/clauseAssembler.js");
const reviewedClauses = new Set(
  getAllClauses()
    .filter((c) => c.review_status && !/draft|needs/i.test(c.review_status))
    .map((c) => c.clause_id)
);
const emits = new Map(
  Object.entries(baseline.types || {}).map(([type, record]) => [type, record?.full?.clauses || []])
);



// A family with authored requirements that the registry does not list at all.
// CHEQUE_BOUNCE_NOTICE generates perfectly well and appears in no enumeration of
// supported document types, which means it is neither certifiable nor visible.
const unlisted = Object.keys(
  JSON.parse(fs.readFileSync(path.resolve(HERE, "../tests/baseline/clause-baseline.json"), "utf8")).types || {}
);

// ── Coherence, reported BESIDE the rung and never folded into it ────────────
//
// The ladder measures what a family has been PUT THROUGH. Coherence measures
// what the family SHIPS. They are different questions and a high rung must
// never be able to conceal a live defect: the NDA reaches FALSIFICATION_PASSED
// precisely BECAUSE someone found that every NDA it generates states two
// different confidentiality periods, and that document is still going out.
const { assessRequirements } = await import("../backend/services/documentRequirements.js");
const TEXT = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c.text || ""]));
const defects = new Map();
for (const [documentType, record] of Object.entries(baseline.types || {})) {
  const clauses = record?.full?.clauses || record?.minimal?.clauses || [];
  if (!clauses.length) continue;
  const assessment = assessRequirements(documentType, clauses, {}, {}, [], TEXT);
  if (!assessment.assessed) continue;
  const broken = (assessment.relationships || []).filter(
    (r) => r.coverage !== "NOT_APPLICABLE" && r.finding !== "ESTABLISHED_POSITIVE"
  );
  if (broken.length) defects.set(documentType, broken);
}

const { families, counts, approved, total } = certify({
  generates, emits, reviewedClauses,
  // Not a rung input. It cannot promote or demote a family; it can only bar
  // approval, because a document whose own clauses disagree is not something
  // review evidence can make sound.
  defects: new Map([...defects].map(([type, broken]) => [type, broken.map((b) => b.id)])),
});

for (const rung of [...RUNG].reverse()) {
  const members = Object.entries(families).filter(([, f]) => f.status === rung);
  if (!members.length) continue;
  console.log(`\n${rung}  (${members.length})`);
  for (const [documentType, family] of members) {
    console.log(`  ${documentType}`);
    if (rung !== "NOT_ASSESSED") for (const reason of family.reasons) console.log(`      · ${reason}`);
    for (const broken of defects.get(documentType) || []) {
      console.log(`      ! SHIPS A DEFECT — ${broken.id}: ${broken.coverage}`);
      console.log(`        ${broken.detail}`);
    }
  }
}
if (defects.size) {
  console.log(
    `\n${defects.size} famil${defects.size === 1 ? "y generates" : "ies generate"} a document whose own ` +
    `clauses do not agree with one another. A rung is not a clean bill of health.`
  );
}
console.log(`\n${approved} of ${total} registered families are approved.`);
console.log(
  Object.entries(counts).filter(([, n]) => n).map(([r, n]) => `${r}=${n}`).join("  ")
);
