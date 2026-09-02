/**
 * conceptRecords.test.mjs
 *
 * Enforces the traceability invariant from docs/CONCEPT_LAYER.md 4.3:
 *
 *   CONCEPT_ID -> definition -> resolution evidence -> provenance
 *              -> attributes -> applicable rules -> applicable clauses
 *
 * A concept that cannot answer that chain does not ship. The chain is only
 * auditable if every link is checkable by machine, so this file checks them:
 * the schema covers shape, and the assertions below cover the parts a JSON
 * Schema cannot express -- that cited clause and rule ids actually exist, that
 * detection sources name real intake fields, and that a concept which attaches
 * nothing says so out loud instead of pretending to work.
 *
 * Nothing here reads the concept records at runtime yet. That is deliberate:
 * step 3 of the sequence is "author the records", and this test is what makes
 * that step safe to do before the resolver exists.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { getVariables } from "../backend/config/variableConfig.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const CONCEPT_DIR = path.join(ROOT, "knowledge-base", "concepts");
const CLAUSE_DIR = path.join(ROOT, "knowledge-base", "clause_library");
const CONSTRAINT_DIR = path.join(ROOT, "knowledge-base", "constraints");

const failures = [];
const passes = [];

function check(label, condition, detail = "") {
  if (condition) passes.push(label);
  else failures.push(`${label}${detail ? `\n    ${detail}` : ""}`);
}

// ── Load the world ──────────────────────────────────────────────────────────

const schema = JSON.parse(
  fs.readFileSync(path.join(CONCEPT_DIR, "concept.schema.json"), "utf8")
);
const dimensions = JSON.parse(
  fs.readFileSync(path.join(CONCEPT_DIR, "dimensions.json"), "utf8")
);

const conceptFiles = fs
  .readdirSync(CONCEPT_DIR)
  .filter((f) => f.endsWith(".json") && f !== "concept.schema.json" && f !== "dimensions.json");

const concepts = conceptFiles.map((f) => ({
  file: f,
  record: JSON.parse(fs.readFileSync(path.join(CONCEPT_DIR, f), "utf8")),
}));

function loadClauseIds() {
  const ids = new Set();
  for (const entry of fs.readdirSync(CLAUSE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "blueprints") continue;
    const dir = path.join(CLAUSE_DIR, entry.name);
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      for (const clause of Array.isArray(parsed) ? parsed : [parsed]) {
        if (clause?.clause_id) ids.add(clause.clause_id);
      }
    }
  }
  return ids;
}

function loadRuleIds() {
  const ids = new Set();
  for (const file of fs.readdirSync(CONSTRAINT_DIR).filter((f) => f.endsWith(".json"))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(CONSTRAINT_DIR, file), "utf8"));
    const rules = Array.isArray(parsed)
      ? parsed
      : parsed.rules || parsed.constraints || Object.values(parsed).flat();
    for (const rule of rules) if (rule?.rule_id) ids.add(rule.rule_id);
  }
  return ids;
}

const clauseIds = loadClauseIds();
const ruleIds = loadRuleIds();

// Every intake field the system knows about, across all document types.
const knownFields = new Set();
for (const docType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  for (const field of Object.keys(getVariables(docType) || {})) knownFields.add(field);
}

// ── Shape ───────────────────────────────────────────────────────────────────

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

check("at least ten concepts are authored", concepts.length >= 10, `found ${concepts.length}`);

for (const { file, record } of concepts) {
  check(
    `${file} matches concept.schema.json`,
    validate(record),
    (validate.errors || []).map((e) => `${e.instancePath || "/"} ${e.message}`).join("; ")
  );

  check(
    `${file} filename matches concept_id`,
    file === `${record.concept_id}.json`,
    `file ${file} vs id ${record.concept_id}`
  );
}

// ── The traceability chain ──────────────────────────────────────────────────

for (const { file, record } of concepts) {
  // -> applicable clauses: every id must exist, or be declared as not yet written.
  const attached = record.attaches?.clauses || [];
  const missingClauses = attached.filter((id) => !clauseIds.has(id));
  check(
    `${file} attaches only clauses that exist`,
    missingClauses.length === 0,
    missingClauses.join(", ")
  );

  // -> applicable rules
  const attachedRules = record.attaches?.rules || [];
  const missingRules = attachedRules.filter((id) => !ruleIds.has(id));
  check(
    `${file} attaches only rules that exist`,
    missingRules.length === 0,
    missingRules.join(", ")
  );

  // A clause listed as still-to-author must NOT already exist -- otherwise the
  // record is understating what the concept can already do.
  const toAuthor = record.attaches?.clauses_to_author || [];
  const alreadyThere = toAuthor.filter((id) => clauseIds.has(id));
  check(
    `${file} does not list existing clauses as still-to-author`,
    alreadyThere.length === 0,
    alreadyThere.join(", ")
  );

  // A concept that attaches nothing and declares nothing to author is inert:
  // it would resolve, change no document, and mislead a reviewer into thinking
  // it did something.
  const doesSomething =
    attached.length > 0 ||
    attachedRules.length > 0 ||
    toAuthor.length > 0 ||
    (record.attaches?.disclosures || []).length > 0;
  check(`${file} has some consequence`, doesSomething);

  // A concept whose clauses do not exist yet must disclose rather than assert.
  if (toAuthor.length > 0 && attached.length === 0) {
    check(
      `${file} discloses rather than asserts while its clauses are unwritten`,
      record.unresolved_behaviour?.assume === "none" &&
        record.unresolved_behaviour?.disclose === true,
      `assume=${record.unresolved_behaviour?.assume} disclose=${record.unresolved_behaviour?.disclose}`
    );
  }

  // -> provenance: every structured detection entry declares one.
  for (const entry of record.detection?.a_structured || []) {
    check(
      `${file} detection ${entry.source} declares provenance`,
      entry.provenance === "declared" || entry.provenance === "derived"
    );
  }

  // -> resolution evidence: a `field:` source must name a real intake field, or
  // say plainly that it does not exist yet. Silently referencing a field that
  // was never added is how a concept ships looking wired and resolves never.
  for (const entry of record.detection?.a_structured || []) {
    if (!entry.source?.startsWith("field:")) continue;
    const fieldName = entry.source.slice("field:".length);
    const exists = knownFields.has(fieldName);
    const declaredMissing = /DOES NOT EXIST YET/i.test(entry.note || "");
    check(
      `${file} field:${fieldName} either exists or is flagged as missing`,
      exists || declaredMissing,
      exists ? "" : "not in any document type's intake, and the note does not say so"
    );
    if (exists && declaredMissing) {
      failures.push(
        `${file} field:${fieldName} is flagged DOES NOT EXIST YET but the intake has it`
      );
    }
  }

  // -> authority: an imported enumeration, not an invented one.
  check(
    `${file} cites at least one statutory authority`,
    (record.authority || []).length > 0
  );

  // The dimension gate: concept attachment is (thing x event x role), so a
  // record that constrains nothing would fire on a noun alone.
  const dims = record.requires_dimensions || {};
  const roleVocab = new Set(dimensions.role.vocabulary);
  const eventVocab = new Set(dimensions.event.vocabulary);
  const badRoles = (dims.role || []).filter((r) => !roleVocab.has(r));
  const badEvents = (dims.event || []).filter((e) => !eventVocab.has(e));
  check(`${file} uses only known roles`, badRoles.length === 0, badRoles.join(", "));
  check(`${file} uses only known events`, badEvents.length === 0, badEvents.join(", "));
  check(
    `${file} constrains at least one dimension`,
    (dims.role || []).length > 0 ||
      (dims.event || []).length > 0 ||
      (dims.entity_type || []).length > 0
  );

  // An LLM-driven concept must be advisory. Provenance controls authority, and
  // a classifier that could confirm its own conclusion would defeat that.
  if (record.detection?.d_classifier?.enabled) {
    check(
      `${file} classifier-detected concept still asks for confirmation`,
      Boolean(record.confirmation?.question)
    );
  }
}

// ── Vocabulary hygiene ──────────────────────────────────────────────────────
// The failure this whole design guards against is every noun becoming a
// concept. Ten to fifteen is the reviewable ceiling; past that, the growth is
// the problem rather than the coverage.

check(
  "concept vocabulary stays within the reviewable ceiling",
  concepts.length <= 15,
  `${concepts.length} concepts -- past 15 this stops being reviewable, which is the failure mode the design exists to prevent`
);

const conceptIds = new Set(concepts.map((c) => c.record.concept_id));
check("concept ids are unique", conceptIds.size === concepts.length);

// Two concepts attaching an identical treatment ARE one concept.
const signatures = new Map();
for (const { file, record } of concepts) {
  const signature = JSON.stringify([
    [...(record.attaches?.clauses || [])].sort(),
    [...(record.attaches?.rules || [])].sort(),
  ]);
  if (signature === JSON.stringify([[], []])) continue;
  if (signatures.has(signature)) {
    failures.push(
      `${file} attaches exactly what ${signatures.get(signature)} attaches -- if the treatment is identical they are one concept`
    );
  } else signatures.set(signature, file);
}
check("no two concepts attach an identical treatment", true);

// ── Report ──────────────────────────────────────────────────────────────────

const signed = concepts.filter((c) => c.record.review_status === "reviewed").length;
console.log(
  `concept records: ${concepts.length} authored, ${signed} signed by an advocate, ` +
    `${concepts.length - signed} awaiting review`
);
const needClauses = concepts.filter((c) => (c.record.attaches?.clauses_to_author || []).length);
if (needClauses.length) {
  console.log(
    `concepts blocked on unwritten clauses: ${needClauses
      .map((c) => `${c.record.concept_id} (${c.record.attaches.clauses_to_author.length})`)
      .join(", ")}`
  );
}

if (failures.length) {
  console.error(`\nFAIL ${failures.length} of ${failures.length + passes.length} checks\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS  all ${passes.length} concept-record checks`);
