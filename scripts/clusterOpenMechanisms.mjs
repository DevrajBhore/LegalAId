/**
 * clusterOpenMechanisms.mjs
 *
 * Which missing facts have the highest semantic leverage?
 *
 * The raw list of open mechanisms per document family is not useful evidence --
 * it is forty lists. What decides where the fact registry should grow next is
 * the CLUSTERING: a mechanism left open across fifteen families points at one
 * missing circumstance worth formalising; a mechanism open in one family points
 * at that family's intake.
 *
 * The discipline this is meant to serve: do not add a fact because it is
 * common. Add it when its presence or absence creates a materially different
 * treatment that no existing fact can carry. Otherwise the registry becomes a
 * second generationControls.js with better manners.
 *
 * Run: node scripts/clusterOpenMechanisms.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { analyseOpenPositions, CLASSIFICATION } from "../backend/services/materialityAnalysis.js";
import { buildVariables } from "./freezeClauseBaseline.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(
  fs.readFileSync(path.resolve(HERE, "../knowledge-base/intake/legal_facts.json"), "utf8")
);

// Mechanisms the registry can already resolve, read off the treatments table.
const served = new Set(FACTS.treatments.flatMap((t) => Object.keys(t.positions || {})));

const types = Object.keys(DOCUMENT_TYPE_REGISTRY).sort();
const openIn = new Map();       // mechanism -> Set(document types)
const askedIn = new Map();      // mechanism -> Set(types where it would be ASKED)
const classOf = new Map();
let analysed = 0;

for (const documentType of types) {
  let analysis;
  try {
    analysis = analyseOpenPositions({
      documentType,
      variables: buildVariables(documentType, "minimal"),
    });
  } catch {
    continue;
  }
  if (!analysis.positions.length) continue;
  analysed += 1;
  for (const position of analysis.positions) {
    if (!openIn.has(position.flag)) openIn.set(position.flag, new Set());
    openIn.get(position.flag).add(documentType);
    classOf.set(position.flag, position.classification);
    if (position.disposition === "ASK") {
      if (!askedIn.has(position.flag)) askedIn.set(position.flag, new Set());
      askedIn.get(position.flag).add(documentType);
    }
  }
}

const rows = [...openIn.entries()]
  .map(([mechanism, families]) => ({
    mechanism,
    families: families.size,
    asked: askedIn.get(mechanism)?.size || 0,
    legallyMaterial: classOf.get(mechanism) === CLASSIFICATION.LEGALLY_MATERIAL,
    served: served.has(mechanism),
  }))
  .sort((a, b) => b.asked - a.asked || b.families - a.families || a.mechanism.localeCompare(b.mechanism));

console.log(`\n${analysed} of ${types.length} document families analysed at minimal intake.\n`);
console.log("  fam  ask  material  served   mechanism");
console.log("  ───  ───  ────────  ──────   ─────────");
for (const row of rows) {
  console.log(
    `  ${String(row.families).padStart(3)}  ${String(row.asked).padStart(3)}  ` +
    `${(row.legallyMaterial ? "LEGAL" : "draft").padEnd(8)}  ` +
    `${(row.served ? "yes" : "NO").padEnd(6)}   ${row.mechanism}`
  );
}

const unservedAsked = rows.filter((r) => !r.served && r.asked > 0);
console.log(
  `\nHighest leverage — asked for, and no fact can resolve them:\n` +
  (unservedAsked.length
    ? unservedAsked
        .map((r) => `  ${String(r.asked).padStart(2)} families   ${r.mechanism}`)
        .join("\n")
    : "  (none)")
);
const servedTotal = rows.filter((r) => r.served).reduce((n, r) => n + r.families, 0);
const total = rows.reduce((n, r) => n + r.families, 0);
console.log(
  `\nCoverage: the registry can resolve ${servedTotal} of ${total} open positions ` +
  `across all families (${Math.round((servedTotal / total) * 100)}%).`
);
