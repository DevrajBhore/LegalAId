import assert from "node:assert";
import { parseIdentityClause, buildDocumentStructure } from "../backend/services/documentStructure.js";

const DEED = [
  'THIS AGREEMENT ("Agreement") is made and executed at Pune on this 1st day of September, 2026.',
  "", "BY AND BETWEEN", "",
  'Rajput Estates Private Limited, a private limited company, having its address at 12 Market Road (hereinafter the "Landlord") of the First Part;',
  "", "AND", "",
  'Sharma Textiles LLP, a Limited Liability Partnership (hereinafter the "Tenant") of the Second Part.',
  "",
  'The Landlord and the Tenant are hereinafter collectively referred to as the "Parties".',
  "", "A. WHEREAS, the Parties intend to lease the premises;",
  "", "B. AND WHEREAS, the Parties wish to record the terms; and",
  "", "C. AND WHEREAS, the transaction is for a lawful object;",
  "", "NOW, THEREFORE, in consideration of the mutual covenants, the Parties agree as follows:",
].join("\n");

// ── 1. The anatomy comes out as data ────────────────────────────────────────
const s = parseIdentityClause(DEED);
assert.strictEqual(s.parsed, true);
assert.ok(s.opening.startsWith("THIS AGREEMENT"));
assert.deepStrictEqual(s.connectives, ["BY AND BETWEEN", "AND"]);
assert.strictEqual(s.parties.length, 2);
assert.deepStrictEqual(s.parties.map((p) => p.part), ["First", "Second"]);
assert.strictEqual(s.recitals.length, 3);
// The fixture feeds uppercase letters; recitals are lettered lower case on the
// page, so the parser normalises whatever case the source clause carried.
assert.deepStrictEqual(s.recitals.map((r) => r.label.trim()), ["a.", "b.", "c."]);
assert.deepStrictEqual(s.recitals.map((r) => r.lead.trim()), ["WHEREAS,", "AND WHEREAS,", "AND WHEREAS,"]);
assert.ok(s.testatum.startsWith("NOW, THEREFORE"));
assert.ok(s.collective.includes("collectively referred to"));
assert.strictEqual(s.other.length, 0, "nothing should fall through unrecognised");
console.log("PASS  deed anatomy parsed into structure");

// ── 2. Order is preserved ───────────────────────────────────────────────────
assert.deepStrictEqual(
  s.blocks.map((b) => b.type),
  ["opening","connective","party","connective","party","collective","recital","recital","recital","testatum"]
);
console.log("PASS  block order preserved for renderers");

// ── 3. A comma-mangled label still parses ───────────────────────────────────
// clauseQualityNormalizer used to rewrite "B. AND WHEREAS" as "B, AND WHEREAS";
// that is fixed at source, but text already generated must still parse.
const mangled = parseIdentityClause(DEED.replace("B. AND WHEREAS", "B, AND WHEREAS"));
assert.strictEqual(mangled.recitals.length, 3, "comma-delimited label must still be read as a recital");
console.log("PASS  tolerant of the historic comma-mangled label");

// ── 4. Non-deed text is preserved, not dropped ──────────────────────────────
const prose = parseIdentityClause(
  "These Terms of Service govern your access to the Services provided by Rockodile Technologies Private Limited."
);
assert.strictEqual(prose.parsed, false, "unilateral prose is not a formal deed opening");
assert.ok(prose.lines.length > 0, "raw lines must survive so a renderer can fall back");
console.log("PASS  non-deed opening flagged, raw lines preserved");

// ── 5. A party with an initialled name is not mistaken for a recital ────────
const initials = parseIdentityClause(
  ['THIS AGREEMENT ("Agreement") is made at Pune.', "", "BY AND BETWEEN", "",
   "A. K. Sharma & Co, a partnership firm, of the First Part;"].join("\n")
);
assert.strictEqual(initials.parties.length, 1, '"A. K. Sharma & Co" is a party, not recital A');
assert.strictEqual(initials.recitals.length, 0);
console.log("PASS  initialled party name not misread as a lettered recital");

// ── 6. Document-level grouping ──────────────────────────────────────────────
const draft = { document_type: "SERVICE_AGREEMENT", clauses: [
  { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Parties", text: DEED },
  { clause_id: "OP1", category: "PAYMENT", title: "Fees", text: "The Client shall pay." },
  { clause_id: "SCH1", category: "SCHEDULE", title: "Schedule 1 — Statement of Work", text: "Deliverables." },
  { clause_id: "SIG", category: "SIGNATURE_BLOCK", title: "Execution", text: "IN WITNESS WHEREOF..." },
]};
const doc = buildDocumentStructure(draft);
assert.strictEqual(doc.operative.length, 1);
assert.strictEqual(doc.execution.length, 1);
assert.strictEqual(doc.schedules.length, 1);
assert.strictEqual(doc.identity.parsed, true);
console.log("PASS  operative / execution / schedules grouped correctly");

console.log("\nALL GREEN");

// ── 7. No clause category may fall outside the canonical order ──────────────
// A category the order does not know sorts to the slot just before the
// signature block. EMPLOYMENT was in that state: all 18 employment clauses --
// probation, duties, hours, leave, benefits, termination consequences --
// printed AFTER governing law and stamp duty in every employment contract.
// This guard fails the build if a new unknown category is introduced.
import fsNode from "node:fs";
import pathNode from "node:path";
import { fileURLToPath as toPath } from "node:url";
import { CLAUSE_ORDER, normalizeClauseCategory } from "../backend/config/clauseOrder.js";

const LIB = pathNode.resolve(
  pathNode.dirname(toPath(import.meta.url)),
  "..", "knowledge-base", "clause_library"
);
const known = new Set(CLAUSE_ORDER);
const unknown = new Map();

for (const folder of fsNode.readdirSync(LIB, { withFileTypes: true })) {
  if (!folder.isDirectory() || folder.name === "blueprints") continue;
  for (const file of fsNode.readdirSync(pathNode.join(LIB, folder.name))) {
    if (!file.endsWith(".json")) continue;
    const clause = JSON.parse(
      fsNode.readFileSync(pathNode.join(LIB, folder.name, file), "utf8")
    );
    if (!clause?.clause_id || !clause.category) continue;
    const resolved = normalizeClauseCategory(clause.category);
    if (!known.has(resolved)) {
      if (!unknown.has(resolved)) unknown.set(resolved, []);
      unknown.get(resolved).push(clause.clause_id);
    }
  }
}

assert.deepStrictEqual(
  [...unknown.keys()],
  [],
  `Clause category not in CANONICAL_ORDER — these clauses will sort to the end of every ` +
  `document that uses them: ${[...unknown.entries()].map(([c, ids]) => `${c} (${ids.length})`).join(", ")}`
);
console.log(`PASS  every clause category resolves into the canonical order`);
