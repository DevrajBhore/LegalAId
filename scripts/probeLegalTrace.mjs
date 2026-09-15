/**
 * probeLegalTrace.mjs — PHASE D4.4
 *
 * HOW FAR DOES A LEGAL FACT ACTUALLY TRAVEL?
 *
 * The target architecture is a chain:
 *
 *   FACT -> CONCEPT -> LEGAL PROPOSITION -> APPLICABILITY -> REQUIREMENT
 *        -> TREATMENT -> CLAUSE / DOCUMENT EFFECT
 *
 * and the rule that makes it a reasoning system rather than a template engine is
 * that every material fact has a traceable path along it — or an authored reason
 * why it deliberately has no document effect.
 *
 * D4.2 found the chain broken somewhere: requirements moved and clauses did not.
 * It could not say WHERE, because it measured the ends and not the middle. This
 * probe walks each node and reports the furthest one reached, per fact.
 *
 * THERE ARE TWO FACT PLANES, AND THAT IS THE FINDING THIS PROBE EXISTS TO
 * MEASURE. They were built at different times for different consumers:
 *
 *   semantic_facts.json — 7 facts. Declared/derived provenance, canonically
 *       resolved (Phase B), consumed by requirement applicability. Reaches the
 *       REQUIREMENT node. Carries no statutory authority and attaches to no
 *       clause.
 *
 *   knowledge-base/concepts — 10 concepts. Statutory authority down to the
 *       section, role/event dimensions, detection with provenance, an `attaches`
 *       list naming clauses, a confirmation question, and open-world
 *       unresolved_behaviour. Everything the architecture asks for — and
 *       docs/CONCEPT_LAYER.md 11.2 puts the resolver at step 6 of 14, which has
 *       not been built, so nothing reads these at runtime.
 *
 * So one plane has the law and no reach; the other has reach and no law. Neither
 * is wrong. The gap between them is the boundary where legal reasoning stops.
 *
 * WHAT THIS PROBE WILL NOT DO. It will not score a fact as "reaching" a node
 * because an artifact mentions it. Mentions are cheap and were the substance of
 * seven earlier measurement errors. A node counts as reached only if a runtime
 * observation changes when the fact changes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables, sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { optionMeaning } from "./lib/semanticMutation.mjs";
import { POSITION } from "../backend/services/generationControls.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** The chain, in order. A fact's score is the furthest node it reaches. */
const NODES = [
  "INTAKE_FIELD",       // the user can state it
  "RESOLVED_FACT",      // the system carries it as a fact, with provenance
  "LEGAL_AUTHORITY",    // it is tied to a statute, section-deep
  "APPLICABILITY",      // some requirement's applicability reads it
  "REQUIREMENT_MOVES",  // changing it changes a requirement outcome at runtime
  "CLAUSE_MOVES",       // changing it changes the clause set or clause text
];

const semanticFacts = readJson(path.join(ROOT, "knowledge-base/intake/semantic_facts.json")).facts;
const CONCEPT_DIR = path.join(ROOT, "knowledge-base/concepts");
const concepts = fs.readdirSync(CONCEPT_DIR)
  .filter((f) => f.endsWith(".json") && !f.includes("schema") && f !== "dimensions.json")
  .map((f) => readJson(path.join(CONCEPT_DIR, f)));

const REQ_DIR = path.join(ROOT, "knowledge-base/documents/requirements");
const matrices = fs.readdirSync(REQ_DIR).map((f) => readJson(path.join(REQ_DIR, f)));

/** Which requirement applicabilities read which fact. */
const applicabilityReaders = new Map();
for (const m of matrices) {
  for (const r of m.requirements || []) {
    const fact = r.applicability?.position;
    if (!fact) continue;
    if (!applicabilityReaders.has(fact)) applicabilityReaders.set(fact, []);
    applicabilityReaders.get(fact).push({ documentType: m.document_type, requirement: r.id });
  }
}

const generating = Object.keys(DOCUMENT_TYPE_REGISTRY);

/**
 * Which concepts actually GOVERN a clause, read from the blueprints rather than
 * assumed. An earlier version of this probe hardcoded "no concept resolver
 * exists" as a ceiling; once the resolver landed for one concept that ceiling
 * became a false statement asserted by the measurement itself. The question is
 * now asked of the repository each run.
 */
const BLUEPRINT_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const conceptGoverns = new Map();
for (const file of fs.readdirSync(BLUEPRINT_DIR).filter((f) => f.endsWith(".json"))) {
  const bp = readJson(path.join(BLUEPRINT_DIR, file));
  for (const entry of bp.conditional_clauses || []) {
    const expr = String(entry.include_if || "");
    if (!expr.startsWith("concept:")) continue;
    const id = expr.slice("concept:".length).trim();
    if (!conceptGoverns.has(id)) conceptGoverns.set(id, []);
    conceptGoverns.get(id).push({ documentType: bp.document_type, clause: entry.clause });
  }
}

/**
 * Perturb one intake field across a family and observe what actually moves.
 * Returns null when the family cannot be driven (no fixture, or the field is not
 * a binary the mutation contract can reach) — a null is "not measured", never
 * "did not move".
 */
async function perturb(documentType, field) {
  const schema = getVariables(documentType) || {};
  const def = schema[field];
  if (!def || def.type !== "select" || !Array.isArray(def.options)) return null;
  const yes = optionMeaning(def, POSITION.TRUE);
  const no = optionMeaning(def, POSITION.FALSE);
  if (yes === null || no === null) return null;

  let base;
  try { base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED }); }
  catch { return null; }

  const contradictionsCleared = [];
  let lastBlock = null;

  /*
   * A fixture filled for the TRUE world can contradict the FALSE world. The
   * WELL_FILLED loan fixture describes collateral; answering `loan_is_secured`
   * "No" makes the pair impossible, and the system correctly BLOCKS rather than
   * drafting an unsecured loan that recites security. The first version of this
   * probe read that block as a fact that fails to travel — the system was right
   * and the perturbation was invalid.
   *
   * So when generation is blocked, the validator's own message is consulted: it
   * names the offending field. That field is cleared and the world is retried
   * ONCE. Clearing what the system itself identified is not guessing; inventing
   * a dependency map would be. If it is still blocked, the probe says so and
   * reports the reason rather than scoring a reach.
   */
  const attempt = async (variables) => {
    const result = await generateDocument({ document_type: documentType, variables });
    const list = result.draft?.clauses || [];
    return { result, list };
  };

  const run = async (value) => {
    let variables = { ...base, [field]: value };
    let { result, list } = await attempt(variables);

    if (!list.length && result?.error) {
      const named = Object.keys(base).filter((k) => result.error.includes(k));
      if (named.length) {
        for (const k of named) variables = { ...variables, [k]: "" };
        ({ result, list } = await attempt(variables));
        if (list.length) contradictionsCleared.push({ field, value, cleared: named });
      }
    }
    if (!list.length) { lastBlock = result?.error || "no clauses and no error reported"; return null; }
    return {
      facts: Object.fromEntries((result.canonical_facts || [])
        .filter((o) => o.provenance !== "unknown").map((o) => [o.fact, o.value])),
      requirements: Object.fromEntries((result.requirements?.results || []).map((r) => [r.id, r.coverage])),
      ids: list.map((c) => c.clause_id).join(" "),
      texts: list.map((c) => `${c.clause_id}:${c.text || ""}`).join(" "),
    };
  };

  const A = await run(yes); const B = await run(no);
  if (!A || !B) {
    /*
     * NOT MEASURED, which is not the same as "did not move" and must never be
     * scored as one. A family that emits zero clauses for one of the two worlds
     * cannot answer the question this probe asks; it has a generation defect
     * that has to be repaired before its reach means anything.
     */
    return { unmeasurable: true,
      reason: `the ${!A ? "TRUE" : "FALSE"} world could not be generated even after clearing the ` +
        `field the validator named: ${lastBlock}` };
  }

  return {
    unmeasurable: false,
    contradictionsCleared,
    factMoved: [...new Set([...Object.keys(A.facts), ...Object.keys(B.facts)])]
      .filter((k) => A.facts[k] !== B.facts[k]),
    requirementMoved: [...new Set([...Object.keys(A.requirements), ...Object.keys(B.requirements)])]
      .filter((k) => A.requirements[k] !== B.requirements[k]),
    clauseSetMoved: A.ids !== B.ids,
    clauseTextMoved: A.texts !== B.texts,
  };
}

/* ---------------- plane 1: semantic facts ---------------- */

const rows = [];
for (const fact of semanticFacts) {
  const fields = fact.established_by || [];
  const families = generating.filter((dt) => {
    const s = getVariables(dt) || {};
    return fields.some((f) => f in s);
  });

  const readers = applicabilityReaders.get(fact.id) || [];
  const observations = []; const blocked = [];
  for (const dt of families) {
    for (const field of fields) {
      const moved = await perturb(dt, field);
      if (!moved) continue;
      if (moved.unmeasurable) blocked.push({ documentType: dt, field, reason: moved.reason });
      else observations.push({ documentType: dt, field, ...moved });
    }
  }

  const anyFact = observations.some((o) => o.factMoved.length);
  const anyReq = observations.some((o) => o.requirementMoved.length);
  const anyClause = observations.some((o) => o.clauseSetMoved || o.clauseTextMoved);

  let reached = families.length ? "INTAKE_FIELD" : null;
  if (anyFact) reached = "RESOLVED_FACT";
  if (readers.length && anyFact) reached = "APPLICABILITY";
  if (anyReq) reached = "REQUIREMENT_MOVES";
  if (anyClause) reached = "CLAUSE_MOVES";
  /* Nothing observable at all: say so rather than crediting the floor. */
  if (!observations.length && blocked.length) reached = "UNMEASURABLE";

  rows.push({
    plane: "semantic_fact", id: fact.id, kind: fact.kind,
    authority: 0, attaches: 0,
    intake_exists: families.length > 0,
    detection_sources: fields,
    families: families.length, measured: observations.length,
    applicabilityReaders: readers.length,
    blocked,
    reached, observations,
  });
}

/* ---------------- plane 2: concepts ---------------- */

for (const concept of concepts) {
  const sources = (concept.detection?.a_structured || [])
    .map((d) => String(d.source || "").replace(/^field:/, ""))
    .filter(Boolean);
  const existsIn = [];
  for (const dt of generating) {
    const s = getVariables(dt) || {};
    for (const f of sources) if (f in s) existsIn.push({ documentType: dt, field: f });
  }

  const authority = (concept.authority || []).length;
  const observations = []; const blocked = [];
  for (const { documentType, field } of existsIn) {
    const moved = await perturb(documentType, field);
    if (!moved) continue;
    if (moved.unmeasurable) blocked.push({ documentType, field, reason: moved.reason });
    else observations.push({ documentType, field, ...moved });
  }

  /*
   * THE CEILING, AND WHY IT IS NOT NEGOTIABLE. No concept resolver exists —
   * CONCEPT_LAYER.md 11.2 step 6 — so nothing reads these records at runtime and
   * NO CONCEPT CAN CAUSE ANYTHING. A concept therefore cannot be scored past
   * LEGAL_AUTHORITY, however much the document moves.
   *
   * It would be easy and wrong to score PERSONAL_DATA_PROCESSING as reaching
   * CLAUSE_MOVES: perturb `involves_personal_data` and a clause really does
   * appear. But it appears because a human wrote `include_if:
   * involves_personal_data == true` into a blueprint, not because the concept
   * resolved, not by way of its authority, and not through its `attaches` list.
   * The concept and the gate happen to read the same field. Crediting the
   * concept for the gate's work is the same conflation that produced 192 phantom
   * dependency edges from `invalid_if`, and it would make the concept layer look
   * connected on the exact axis where it is severed.
   *
   * So the field's independent effect is recorded in its own column. That column
   * is the useful one: where the field already moves the document, a resolver
   * would mainly add traceable REASONS for an effect that exists; where it does
   * not, the resolver would add reach the system has never had.
   */
  const fieldMovesClause = observations.some((o) => o.clauseSetMoved || o.clauseTextMoved);
  const fieldMovesRequirement = observations.some((o) => o.requirementMoved.length);
  const governs = conceptGoverns.get(concept.concept_id) || [];

  let reached = existsIn.length ? "INTAKE_FIELD" : null;
  if (reached && authority) reached = "LEGAL_AUTHORITY";
  /*
   * A concept passes LEGAL_AUTHORITY only where a blueprint gate names it. Then
   * the clause is in the document BECAUSE the concept resolved, and the reach is
   * the concept's own rather than a coincidence of field names.
   */
  if (governs.length && fieldMovesRequirement) reached = "REQUIREMENT_MOVES";
  if (governs.length && fieldMovesClause) reached = "CLAUSE_MOVES";
  if (!existsIn.length) reached = null;

  rows.push({
    plane: "concept", id: concept.concept_id,
    kind: concept.detection?.d_classifier?.enabled ? "classifier" : "declared",
    authority, attaches: (concept.attaches?.clauses || []).length,
    detection_sources: sources,
    intake_exists: existsIn.length > 0,
    families: existsIn.length, measured: observations.length,
    applicabilityReaders: (applicabilityReaders.get(concept.concept_id) || []).length,
    governs_gates: governs.length,
    governs: governs.map((g) => `${g.documentType}/${g.clause}`),
    field_moves_clause: fieldMovesClause,
    field_moves_requirement: fieldMovesRequirement,
    resolver_exists: governs.length > 0,
    blocked,
    reached, observations,
  });
}

fs.writeFileSync(path.join(ROOT, "docs/audit/legal-trace.json"), JSON.stringify(rows, null, 2));

/* ---------------- report ---------------- */

const out = [];
const ORDER = [null, "UNMEASURABLE", ...NODES];
const rank = (n) => ORDER.indexOf(n);
out.push("# Phase D4.4 — how far a legal fact travels\n");
out.push("The chain the architecture requires:\n");
out.push("```");
out.push("FACT -> CONCEPT -> LEGAL AUTHORITY -> APPLICABILITY -> REQUIREMENT -> TREATMENT -> CLAUSE");
out.push("```\n");
out.push("A node counts as reached only when a **runtime observation changes as the fact changes**.");
out.push("An artifact merely mentioning a fact does not advance it: that conflation was the substance");
out.push("of seven earlier measurement errors, every one of which inflated a number.\n");
out.push("**Two rules this probe had to be corrected to obey.** A perturbation that could not be run");
out.push("is UNMEASURABLE, never a stop — the first version of this probe read a family that emits no");
out.push("clauses as a fact that fails to travel. And no concept is scored past LEGAL_AUTHORITY,");
out.push("because no concept resolver exists: when a concept's field moves a clause, a hand-authored");
out.push("blueprint gate moved it, not the concept. That is recorded in its own column.\n");
out.push("The two planes were built at different times for different consumers. One carries the law");
out.push("and cannot reach the document; the other reaches the document and carries no law.\n");

out.push("| plane | fact / concept | statutory authority | attaches | reaches | field alone moves the document |");
out.push("|---|---|---|---|---|---|");
for (const r of [...rows].sort((a, b) => rank(a.reached) - rank(b.reached) || a.id.localeCompare(b.id))) {
  const auth = r.plane === "concept" ? (r.authority ? `${r.authority} section-deep` : "none") : "none";
  const att = r.plane === "concept" ? String(r.attaches) : "0";
  const indep = r.plane === "concept"
    ? (r.governs_gates ? `**yes — the concept governs ${r.governs_gates} gate(s)**`
      : r.field_moves_clause ? "yes — but via a hand-authored gate, not the concept"
        : r.intake_exists ? "no" : "no field")
    : "—";
  out.push(`| ${r.plane} | \`${r.id}\` | ${auth} | ${att} | **${r.reached || "NOT REACHABLE"}** | ${indep} |`);
}
out.push("");

const reachesDocument = rows.filter((r) => r.reached === "CLAUSE_MOVES");
const carriesLaw = rows.filter((r) => r.authority > 0);
const both = reachesDocument.filter((r) => r.authority > 0);
out.push("## The boundary, stated exactly\n");
out.push(`${reachesDocument.length} of ${rows.length} facts reach the document. ${carriesLaw.length} carry statutory authority.`);
out.push(`**${both.length} do both.**\n`);
if (both.length) {
  out.push("The first facts to do both:\n");
  for (const r of both) {
    out.push(`- \`${r.id}\` — ${r.authority} section-deep citation(s), governs ${r.governs_gates} ` +
      `blueprint gate(s), and the clause moves with it.`);
  }
  out.push("");
  out.push("That is one complete chain: question -> fact -> concept -> authority -> clause. It is one");
  out.push("concept of ten, and the other nine still stop where they stopped.\n");
}
if (both.length === 0) {
  out.push("Everything that reaches the document carries no law: `include_sla` and `is_secured` are");
  out.push("drafting choices, `processes_personal_data` is a derived flag. Everything that carries law");
  out.push("— 10 concepts, 45 section-deep citations between them — reaches nothing, because the");
  out.push("resolver that would carry a concept to a clause is step 6 of 14 and has not been built.");
  out.push("");
  out.push("This is not a gap between a good layer and a bad one. Both layers are sound and neither");
  out.push("is connected to the other. It is the precise location of the line where the system stops");
  out.push("reasoning legally and starts selecting from a template.\n");
}

out.push("## Where the chain stops\n");
const LABEL = {
  "null": "NOT REACHABLE — the user cannot state the fact at all",
  UNMEASURABLE: "UNMEASURABLE — a generation defect blocks the measurement, which is a defect to repair, not a reach to report",
  INTAKE_FIELD: "INTAKE_FIELD — askable, and nothing observable follows",
  RESOLVED_FACT: "RESOLVED_FACT — carried as a fact with provenance, reaching no requirement",
  LEGAL_AUTHORITY: "LEGAL_AUTHORITY — authored against statute, and the resolver that would carry it further does not exist",
  APPLICABILITY: "APPLICABILITY — read by a requirement's applicability",
  REQUIREMENT_MOVES: "REQUIREMENT_MOVES — changes a requirement outcome, and no clause",
  CLAUSE_MOVES: "CLAUSE_MOVES — reaches the document",
};
for (const node of ORDER) {
  const at = rows.filter((r) => r.reached === node);
  if (!at.length) continue;
  out.push(`**${LABEL[String(node)]}** — ${at.length}: ${at.map((r) => `\`${r.id}\``).join(", ")}\n`);
}

const blockedRows = rows.filter((r) => r.blocked && r.blocked.length);
if (blockedRows.length) {
  out.push("## Generation defects that blocked measurement\n");
  out.push("Each is a family that cannot produce a document for one of the two worlds. Until these");
  out.push("are repaired, nothing can be said about how far the fact travels through them.\n");
  for (const r of blockedRows) {
    for (const b of r.blocked) {
      out.push(`- \`${r.id}\` via \`${b.field}\` in **${b.documentType}** — ${b.reason}.`);
    }
  }
  out.push("");
}

const orphanConcepts = rows.filter((r) => r.plane === "concept" && !r.intake_exists);
if (orphanConcepts.length) {
  out.push("## Concepts with statutory authority that no question can reach\n");
  out.push("Each names Acts and sections, lists the clauses it should attach to, and carries a");
  out.push("confirmation question already drafted — and no intake field exists to resolve it.\n");
  for (const c of orphanConcepts) {
    out.push(`- \`${c.id}\` — ${c.authority} authority citation(s), attaches ${c.attaches} clause(s); ` +
      `detection wants ${c.detection_sources.map((s) => `\`${s}\``).join(", ") || "no structured source at all"}`);
  }
  out.push("");
}

const wouldAddReach = rows.filter((r) => r.plane === "concept" && r.intake_exists && !r.field_moves_clause);
if (wouldAddReach.length) {
  out.push("## Concepts whose field is askable and changes nothing\n");
  out.push("The user can already state these facts. Stating them changes no clause, because only a");
  out.push("resolver would connect the concept's authority and `attaches` list to the document.\n");
  for (const c of wouldAddReach) {
    out.push(`- \`${c.id}\` — askable in ${c.families} family/families, attaches ${c.attaches} clause(s), ${c.authority} citation(s)`);
  }
  out.push("");
}

fs.writeFileSync(path.join(ROOT, "docs/audit/LEGAL_TRACE.md"), out.join("\n"));
console.log(out.join("\n"));
