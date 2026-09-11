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

const { families, counts, approved, total } = certify({ generates });

// A family with authored requirements that the registry does not list at all.
// CHEQUE_BOUNCE_NOTICE generates perfectly well and appears in no enumeration of
// supported document types, which means it is neither certifiable nor visible.
const unlisted = Object.keys(
  JSON.parse(fs.readFileSync(path.resolve(HERE, "../tests/baseline/clause-baseline.json"), "utf8")).types || {}
);

for (const rung of [...RUNG].reverse()) {
  const members = Object.entries(families).filter(([, f]) => f.status === rung);
  if (!members.length) continue;
  console.log(`\n${rung}  (${members.length})`);
  for (const [documentType, family] of members) {
    console.log(`  ${documentType}`);
    if (rung !== "NOT_ASSESSED") for (const reason of family.reasons) console.log(`      · ${reason}`);
  }
}
console.log(`\n${approved} of ${total} registered families are approved.`);
console.log(
  Object.entries(counts).filter(([, n]) => n).map(([r, n]) => `${r}=${n}`).join("  ")
);
