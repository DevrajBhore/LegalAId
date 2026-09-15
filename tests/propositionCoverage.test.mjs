/**
 * propositionCoverage.test.mjs — MUST THIS CLAUSE BE SPLIT?
 *
 * D4.5-B established that a clause can implement several legally distinct
 * propositions, and that the model handles ALTERNATIVE implementations (variant
 * slots) but not CONCURRENT ones with independent applicability. That left an
 * open question with real consequences: which composite clauses actually have to
 * be split, and which are composite but harmless?
 *
 * The criterion is not "the clause implements more than one proposition". A
 * clause may carry three propositions perfectly safely if they are applicable in
 * exactly the circumstances the clause is selected. The criterion is narrower and
 * checkable:
 *
 *     A proposition is LOST when there is a world in which it is applicable and
 *     no clause in the emitted document implements it.
 *
 * That is a runtime question, not a static one, so it is asked by generating the
 * worlds and reading the documents. A proposition can be carried by a clause that
 * was not selected and still be safe, because the variant default or another
 * clause implements it instead — which is exactly why static reasoning over
 * gates gets this wrong.
 *
 * WHAT THIS FOUND. `PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED` — Code on Wages 2019
 * s.43 and EPF Act 1952 s.8A, the allocation that keeps the client from being
 * treated as principal employer of the provider's staff — is applicable to every
 * services engagement and is implemented only by `SERVICE_KEY_PERSONNEL_001`,
 * which is gated on `include_sla`. So an MSA with no agreed service levels
 * ALREADY ships without it. This is not a hypothetical consequence of a proposed
 * repair. It is live, in the current gate, today.
 *
 * The same test clears `NDA_CONFIDENTIALITY_TRADE_SECRET_001`, which is equally
 * composite: its broad proposition is picked up by the variant default when it is
 * not selected, so nothing is lost. Composite is not the defect. Divergent
 * applicability with no other implementer is.
 *
 * D4.6 — THE CEILING. The first version of this test was binary: covered, or
 * lost. Annotating a registration proposition exposed the conflation that hides
 * behind that. `INSTRUMENT_REGISTERED` — a lease over a year takes effect only if
 * made by a registered instrument, Registration Act s.17(1)(d) and s.49 — was
 * reported COVERED and the suite went green, while the document had registered
 * nothing. A clause can require registration, allocate its cost and state the
 * consequence of failing to do it. Nothing a document says can accomplish it.
 *
 * "A clause implementing this proposition is present" and "the legal consequence
 * is achieved" are different sentences, and the requirement layer already knew
 * that — `kind: FORMALITY` with `outside_the_document` caps such a requirement at
 * PROVIDED_FOR. The proposition layer was new and bypassed it, re-introducing a
 * conflation the system had already solved one layer up. So the vocabulary is
 * reused rather than reinvented: a proposition declares its `satisfaction`, and
 * an OUTSIDE_THE_DOCUMENT one can never be reported as implemented.
 *
 *     IMPLEMENTED    the document does the thing
 *     PROVIDED_FOR   the document provides for an act performed elsewhere — the
 *                    ceiling for a formality, and reported as a ceiling
 *     LOST           applicable, and nothing in the document even provides for it
 */
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocument } from "../backend/services/documentService.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { variablesFor, FIXTURE_PROFILE } from "../sweep.mjs";
import { optionMeaning } from "../scripts/lib/semanticMutation.mjs";
import { POSITION } from "../backend/services/generationControls.js";
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const propositions = new Map(
  readJson(path.join(ROOT, "knowledge-base/propositions/propositions.json"))
    .propositions.map((p) => [p.proposition_id, p]));

const implementers = new Map();
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== "blueprints") walk(p); continue; }
    if (!entry.name.endsWith(".json") || entry.name.includes("schema")) continue;
    let doc; try { doc = readJson(p); } catch { continue; }
    for (const c of Array.isArray(doc) ? doc : [doc]) {
      for (const id of c?.implements || []) {
        if (!implementers.has(id)) implementers.set(id, new Set());
        implementers.get(id).add(c.clause_id);
      }
    }
  }
})(path.join(ROOT, "knowledge-base/clause_library"));

const BPDIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
const blueprints = fs.readdirSync(BPDIR).filter((f) => f.endsWith(".json"))
  .map((f) => readJson(path.join(BPDIR, f)));

/**
 * DERIVED, never listed.
 *
 * Every family whose blueprint can emit a clause carrying an `implements`
 * annotation. Listing the three families that happened to expose the problem
 * would scope an ENGINE property — a legal proposition must not vanish from a
 * document that needs it — to the knowledge that revealed it, and the next
 * family to annotate a clause would be silently unguarded.
 */
const SUBJECTS = Object.keys(DOCUMENT_TYPE_REGISTRY).filter((dt) => {
  const bp = blueprints.find((b) => b.document_type === dt);
  if (!bp) return false;
  const ids = new Set([...(bp.clauses || []),
    ...(bp.conditional_clauses || []).map((e) => e.clause),
    ...(bp.variant_clauses || []).flatMap((v) => [v.default, v.replaces,
      ...(v.select_first_match || []).map((o) => o.clause)])].filter(Boolean));
  return [...implementers.values()].some((set) => [...set].some((id) => ids.has(id)));
}).sort();

/**
 * Worlds to examine: the baseline, plus each material binary answered FALSE.
 * Answering things false is where propositions go missing — a world with
 * everything switched on hides exactly the defect being looked for.
 */
async function worlds(documentType) {
  const schema = getVariables(documentType) || {};
  const base = variablesFor(documentType, { profile: FIXTURE_PROFILE.WELL_FILLED });
  const cases = [{ label: "baseline", variables: base }];
  for (const [field, def] of Object.entries(schema)) {
    if (def.type !== "select" || !Array.isArray(def.options)) continue;
    const no = optionMeaning(def, POSITION.FALSE);
    if (no === null) continue;
    cases.push({ label: `${field}=no`, variables: { ...base, [field]: no } });
  }

  const out = [];
  for (const c of cases) {
    let result;
    try { result = await generateDocument({ document_type: documentType, variables: c.variables }); }
    catch { continue; }
    const clauses = result.draft?.clauses || [];
    if (!clauses.length) continue;  // blocked or contradictory: not a measurement
    out.push({ ...c, ids: clauses.map((x) => x.clause_id),
      controls: result.draft?.metadata?.resolved_generation_controls || {} });
  }
  return out;
}

/** Is the proposition applicable in this world? */
function applicable(proposition, world) {
  const a = proposition.applicability || {};
  if (a.always === true) return true;
  if (!a.position) return false;
  const actual = world.controls[a.position] ?? world.variables[a.position];
  const text = String(actual ?? "").trim().toLowerCase();
  const truthy = ["yes", "true", "y"].includes(text) || actual === true;
  return a.value === false ? !truthy : truthy;
}

let checks = 0;
const lost = [];
const providedFor = [];

for (const documentType of SUBJECTS) {
  const all = await worlds(documentType);
  if (!all.length) continue;

  /* Only propositions some clause in this family can implement are in scope. */
  const inScope = [...propositions.values()].filter((p) =>
    all.some((w) => w.ids.some((id) => implementers.get(p.proposition_id)?.has(id))));

  for (const proposition of inScope) {
    for (const world of all) {
      if (!applicable(proposition, world)) continue;
      const covered = world.ids.some((id) => implementers.get(proposition.proposition_id)?.has(id));
      if (covered) {
        /*
         * Covered is not the same as achieved. A proposition satisfiable only
         * outside the document is recorded at its ceiling so the distinction
         * survives into the report instead of being flattened into a pass.
         */
        if (proposition.satisfaction === "OUTSIDE_THE_DOCUMENT") {
          providedFor.push({ documentType, world: world.label,
            proposition_id: proposition.proposition_id });
        }
        continue;
      }
      lost.push({
        documentType, world: world.label,
        proposition_id: proposition.proposition_id,
        authority: (proposition.authority || []).map((x) => `${x.act}${x.section ? ` s.${x.section}` : ""}`),
        implementers: [...(implementers.get(proposition.proposition_id) || [])],
      });
    }
    checks += 1;
  }
}

/* Collapse to one row per (type, proposition) — the worlds are evidence, not findings. */
const byProposition = new Map();
for (const l of lost) {
  const key = `${l.documentType}/${l.proposition_id}`;
  if (!byProposition.has(key)) byProposition.set(key, { ...l, worlds: [] });
  byProposition.get(key).worlds.push(l.world);
}

/*
 * REPAIRED IN D4.5-C, AND THE EMPTY MAP IS THE POINT.
 *
 * Both entries here were live legal losses in MASTER_SERVICE_AGREEMENT, caused by
 * SERVICE_KEY_PERSONNEL_001 carrying two propositions of different applicability
 * behind one `include_sla` gate:
 *
 *   PRINCIPAL_EMPLOYER_EXPOSURE_ALLOCATED  Code on Wages s.43, EPF s.8A —
 *       applicable to every services engagement, so an MSA without agreed service
 *       levels shipped with nothing allocating principal-employer exposure.
 *   PERSONAL_PERFORMANCE_INTENDED  ICA s.40 — applicable on key_person_dependency,
 *       so a client who said particular individuals mattered but agreed no service
 *       levels received no key-person protection at all.
 *
 * The repair severed the clause at existing sentence boundaries — no new legal
 * wording was authored — moving the employment-status sentences verbatim into
 * SERVICE_PERSONNEL_STATUS_001, which is unconditional, and re-gating the
 * continuity limb on the fact its own proposition names.
 *
 * An entry added here is a defect being tolerated, never a result being accepted.
 */
const KNOWN = new Map();

const unexpected = [...byProposition.keys()].filter((k) => !KNOWN.has(k));
assert.deepStrictEqual(unexpected, [],
  "A legal proposition is applicable in some world and implemented by no clause in the document:\n" +
  unexpected.map((k) => {
    const r = byProposition.get(k);
    return `  ${k}\n    authority: ${r.authority.join("; ")}\n` +
           `    implemented only by: ${r.implementers.join(", ")}\n` +
           `    lost in ${r.worlds.length} world(s), e.g. ${r.worlds.slice(0, 3).join(", ")}`;
  }).join("\n") +
  "\nEither another clause must implement it, or the carrying clause must be split.");

const repaired = [...KNOWN.keys()].filter((k) => !byProposition.has(k));
assert.deepStrictEqual(repaired, [],
  `Recorded proposition-loss no longer occurs. If repaired, delete from KNOWN:\n  ${repaired.join("\n  ")}`);
checks += 2;

for (const [key, record] of byProposition) {
  const worlds = record.worlds.length;
  console.log(`KNOWN  ${key} — lost in ${worlds} world(s)`);
  console.log(`       ${KNOWN.get(key).split(". ")[0]}.`);
}
/*
 * THE CEILING IS ASSERTED, NOT MERELY REPORTED. A formality proposition that
 * came back with no PROVIDED_FOR rows would mean the satisfaction field is being
 * ignored — the exact state the test was written to end.
 */
const outside = [...propositions.values()].filter((p) => p.satisfaction === "OUTSIDE_THE_DOCUMENT");
for (const p of outside) {
  const rows = providedFor.filter((r) => r.proposition_id === p.proposition_id);
  assert.ok(rows.length > 0,
    `${p.proposition_id} is satisfiable only outside the document, yet no world reported it at the ` +
    `PROVIDED_FOR ceiling. Either it is never applicable anywhere — in which case the annotation is ` +
    `inert — or the ceiling is being ignored and the proposition is silently counted as achieved.`);
  checks += 1;
}

const ceilings = new Map();
for (const r of providedFor) {
  const k = `${r.documentType}/${r.proposition_id}`;
  ceilings.set(k, (ceilings.get(k) || 0) + 1);
}
for (const [k, n] of ceilings) {
  console.log(`CEILING  ${k} — PROVIDED_FOR in ${n} world(s); the document cannot achieve it`);
}

console.log(`PASS  ${checks - 2 - outside.length} proposition/family pairs examined; ` +
  `${byProposition.size} losses, ${ceilings.size} capped at PROVIDED_FOR`);
console.log(`\nALL GREEN (${checks} checks)`);
