/**
 * documentQualityStandard.test.mjs — D4.45
 *
 * Keeps the 100-level standard honest as a record: every level is present once,
 * every status is from the closed set, every file it cites exists, and a level
 * may claim EXISTS only with a test in the suite that can fail. A map that can
 * drift from the code it describes is worse than none, because it is believed.
 */
import assert from "node:assert";
import fs from "fs";

const ROOT = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), "utf8");
const S = JSON.parse(read("knowledge-base/governance/document-quality-standard.json"));
const suite = JSON.parse(read("package.json")).scripts.test;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log(`PASS  ${m}`); };

const G = S.generation_levels, Q = S.quality_levels;
ok(G.length === 60 && Q.length === 40, "60 generation levels and 40 quality levels");
ok(G.every((l, i) => l.id === `G${String(i + 1).padStart(2, "0")}`) && Q.every((l, i) => l.id === `Q${String(i + 1).padStart(2, "0")}`),
  "level ids are complete and in order");
const STATUSES = Object.keys(S.statuses);
ok([...G, ...Q].every((l) => STATUSES.includes(l.status)), `every status is one of ${STATUSES.join(", ")}`);

const missing = [];
for (const l of [...G, ...Q]) for (const p of [...l.evidence, ...l.verification]) if (!fs.existsSync(new URL(p, ROOT))) missing.push(`${l.id}: ${p}`);
ok(missing.length === 0, `every cited file exists${missing.length ? ` (missing: ${missing.join("; ")})` : ""}`);

const unproven = [...G, ...Q].filter((l) => l.status === "EXISTS" && !l.verification.some((t) => suite.includes(t)));
ok(unproven.length === 0, `no level claims EXISTS without a test in the suite${unproven.length ? ` (${unproven.map((l) => l.id).join(", ")})` : ""}`);

ok([...G, ...Q].every((l) => l.record && Object.keys(l.record).sort().join() === S.per_level_record.fields.slice().sort().join()),
  "every level carries the six-field record (input, decision, output, provenance, failure, verification)");
ok(S.release_outcomes.target.map((o) => o.outcome).join("|") === "Blocked|Requires information|Requires legal review|Automated checks passed|Advocate approved",
  "the five release outcomes, in order of precedence");
const ids = new Set([...G, ...Q].map((l) => l.id));
ok(S.defects_found_by_the_mapping.every((d) => d.level.every((x) => ids.has(x))), "every defect the mapping found points at real levels");
ok(Q.find((l) => l.id === "Q39").status === "NEEDS_LEGAL_JUDGMENT", "advocate review is recorded as needing legal judgment, not as built");

console.log(`\ndocumentQualityStandard: ${checks} checks passed`);
