/**
 * Measures which clauses each document type actually renders, and writes
 * reviewpack.json for scripts/buildReviewPack.py.
 *
 * Run from the repository root:   node scripts/reviewpack.mjs
 *
 * Self-contained by design. This script used to read its sample-value generator
 * out of a sweep.mjs sitting in the repository root, which meant it could not be
 * run from a clean checkout at all. The sampler is inlined below instead.
 */
import { DOCUMENT_TYPE_REGISTRY } from "../shared/documentRegistry.js";
import { VARIABLE_CONFIG } from "../backend/config/variableConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const SAMPLES = { name:"Alpha Industries Private Limited", address:"1 First Road, Mumbai, Maharashtra 400001",
  email:"contact@alpha.example", url:"https://alpha.example", city:"Pune", state:"Maharashtra",
  date:"2026-09-01", number:"500000", pan:"AAACA1234A", gstin:"27AAACA1234A1Z5",
  cin:"U74999MH2015PTC123456", llpin:"AAB-1234" };

/* ── Sample-value generator ──────────────────────────────────────────────── */
const ENTITY_NAMES = [
  "Alpha Industries Private Limited",
  "Beta Consulting LLP",
  "Gamma Ventures Private Limited",
];
const PERSON_NAMES = ["Ramesh Kulkarni", "Sunita Deshmukh", "Arjun Nair"];
// Which of the two pools each party slot draws from.
const ENTITY_OR_PERSON = [ENTITY_NAMES[0], ENTITY_NAMES[1], ENTITY_NAMES[2]];
const ADDRESSES = [
  "1 First Road, Mumbai, Maharashtra 400001",
  "2 Second Road, Pune, Maharashtra 411001",
  "3 Third Road, Nashik, Maharashtra 422001",
];

// Distinguish the first, second and third counterparty so the fixture doesn't
// name both sides identically (which is itself a validation failure).
function partyIndex(key) {
  if (/(_|\b)(2|second|b)\b|_2_|employee|licensee|tenant|borrower|buyer|purchaser|contractor|consultant|distributor|recipient|service_provider/i.test(key)) return 1;
  if (/(_|\b)(3|third)\b|_3_|guarantor|witness/i.test(key)) return 2;
  return 0;
}

function sampleFor(key, def) {
  const k = key.toLowerCase();
  const idx = partyIndex(k);

  if (def.type === "select" && Array.isArray(def.options) && def.options.length) {
    // A "party type" select must agree with the name we generated for that
    // party, or the entity-consistency validator rejects the pair.
    if (/_type$/.test(k) && /party|employer|employee|partner|shareholder|guarantor|lender|borrower|licensor|licensee|landlord|tenant|buyer|seller|discloser|recipient/.test(k)) {
      const paired = ENTITY_OR_PERSON[idx] || "";
      const wantsPerson = PERSON_NAMES.includes(paired);
      // The suffix on the generated name decides the type. Matching "private
      // limited|company|llp" in option order gave "Beta Consulting LLP" the type
      // "Private Limited Company", which the graph validator blocks -- rightly,
      // because that pair would describe an LLP under the Companies Act.
      const wanted = wantsPerson
        ? /individual|person|proprietor/i
        : /\bLLP\b/i.test(paired)
          ? /llp|limited liability partnership/i
          : /private limited/i;
      const match = def.options.find((o) => wanted.test(o));
      if (match) return match;
    }
    // A state field is answered with the state the sample city is actually in.
    // Taking options[0] gave every fixture "Andhra Pradesh" alongside a Pune
    // seat and Maharashtra addresses -- a contradiction the graph validator now
    // blocks, and rightly: the fixture was wrong, not the check.
    if (/state/.test(k) && def.options.includes(SAMPLES.state)) return SAMPLES.state;
    return def.options[0];
  }
  if (def.type === "date") return SAMPLES.date;

  if (/working_hours/.test(k)) return "40";
  // Free-text commercial fields must be filled with prose, not a bare number:
  // "price_terms" matches the money heuristic below and would otherwise be given
  // "500000", which the specificity check rejects for having no words in it.
  if (/price_terms|pricing|payment_terms|prepayment_terms|repayment_terms/.test(k))
    return "list price less a 15 percent trade discount, invoiced monthly and payable within 30 days of a valid tax invoice";
  if (/signatory_name/.test(k)) return PERSON_NAMES[idx];
  if (/signatory_designation|designation/.test(k)) return "Director";
  if (/board_resolution_date|authorisation_date/.test(k)) return SAMPLES.date;

  // Bounded numerics first — a percentage field given 500000 fails its range
  // check and blocks generation for a reason that has nothing to do with drafting.
  // Shareholdings must sum to 100 across the two shareholders, or the validator
  // rejects the pair before any drafting happens.
  if (/^shareholding_percentage_1$/.test(k)) return "60";
  if (/^shareholding_percentage_2$/.test(k)) return "40";
  if (/percent|percentage|_rate$|rate_|escalation|share_of|margin|discount/.test(k)) return "10";
  if (/notice_period|_days$|days_/.test(k)) return "30";
  if (/_months$|months_/.test(k)) return "24";
  if (/_years$|years_/.test(k)) return "3";
  if (/age$/.test(k)) return "18";
  if (/headcount|number_of|count$|quantity/.test(k)) return "25";
  if (def.type === "number") return SAMPLES.number;

  if (/_pan$|^pan$/.test(k)) return SAMPLES.pan;
  if (/gstin/.test(k)) return SAMPLES.gstin;
  if (/\bcin\b|_cin$/.test(k)) return SAMPLES.cin;
  if (/llpin/.test(k)) return SAMPLES.llpin;
  if (/email/.test(k)) return SAMPLES.email;
  if (/url|website|domain/.test(k)) return SAMPLES.url;
  if (/city/.test(k)) return SAMPLES.city;
  if (/state/.test(k)) return SAMPLES.state;
  if (/address|premises|property|registered_office|location/.test(k)) return ADDRESSES[idx];
  if (/date/.test(k)) return SAMPLES.date;
  if (/amount|value|fee|rent|salary|deposit|price|capital|loan|consideration|turnover|revenue/.test(k))
    return SAMPLES.number;
  if (/term|duration|period|tenure/.test(k)) return "24 months";
  if (/employee_name|individual_name|partner_\d_name|witness/.test(k)) return PERSON_NAMES[idx];
  if (/name$/.test(k)) return ENTITY_NAMES[idx];

  // Deliberately concrete: the vagueness check rejects "as agreed" style answers,
  // and rightly so -- the object of a contract must be certain.
  return "wholesale supply, installation and maintenance of industrial pumps and spare parts across western India, performed to the standards and timelines recorded in this Agreement";
}
/* ── end sampler ─────────────────────────────────────────────────────────── */

// How many document types each clause actually reaches.
const usage = new Map();
for (const docType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const all = { ...(VARIABLE_CONFIG.COMMON||{}), ...(VARIABLE_CONFIG[docType]||{}) };
  const vars = {};
  for (const [k, d] of Object.entries(all)) {
    if (Array.isArray(d.excludeDocuments) && d.excludeDocuments.includes(docType)) continue;
    if (!d.required) continue;
    vars[k] = sampleFor(k, d);
  }
  let r;
  for (let i = 0; i < 15; i += 1) {
    r = await generateDocument({ document_type: docType, variables: vars });
    if (r?.draft) break;
    const m = String(r?.error || "").match(/Missing required field: (\w+)/);
    if (!m || vars[m[1]] !== undefined) break;
    vars[m[1]] = sampleFor(m[1], all[m[1]] || { type: "text" });
  }
  if (!r?.draft) continue;
  for (const c of r.draft.clauses) {
    const e = usage.get(c.clause_id) || { types: [], words: 0 };
    e.types.push(docType);
    e.words = Math.max(e.words, String(c.text||"").split(/\s+/).filter(Boolean).length);
    usage.set(c.clause_id, e);
  }
}

// Every clause id a blueprint, a variant slot, or the drafting policies can
// reach -- which is a wider set than the ids that appear in the baseline sweep.
const blueprintReferenced = new Set();
{
  const BP = path.join(ROOT, "knowledge-base", "clause_library", "blueprints");
  for (const f of fs.readdirSync(BP)) {
    if (!f.endsWith(".json")) continue;
    const b = JSON.parse(fs.readFileSync(path.join(BP, f), "utf8"));
    for (const c of b.clauses || b.required_clauses || []) blueprintReferenced.add(typeof c === "string" ? c : c.clause);
    for (const e of b.conditional_clauses || []) blueprintReferenced.add(e.clause);
    for (const v of b.variant_clauses || []) {
      for (const c of v.select_first_match || v.variants || []) blueprintReferenced.add(c.clause);
      if (v.default) blueprintReferenced.add(v.default);
    }
  }
  const pol = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base", "metadata", "drafting_policies.json"), "utf8"));
  for (const id of pol?.defaults?.hardening?.baselineClauseIds || []) blueprintReferenced.add(id);
  for (const cfg of Object.values(pol?.documents || {})) {
    for (const id of cfg?.hardening?.requiredClauseIds || []) blueprintReferenced.add(id);
    for (const id of cfg?.hardening?.baselineClauseIds || []) blueprintReferenced.add(id);
  }
}

// Library metadata.
const LIB = path.join(ROOT, "knowledge-base", "clause_library");
const clauses = [];
for (const dir of fs.readdirSync(LIB, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === "blueprints") continue;
  for (const file of fs.readdirSync(path.join(LIB, dir.name))) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(LIB, dir.name, file);
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(full, "utf8")); } catch { continue; }
    for (const c of (Array.isArray(parsed) ? parsed : [parsed])) {
      if (!c?.clause_id) continue;
      // A deprecated clause is not loaded by the engine and can never reach a
      // document. Putting it in the review pack asks the advocate to sign off
      // text the product cannot emit.
      if (c.deprecated === true) continue;
      const u = usage.get(c.clause_id) || { types: [], words: 0 };
      clauses.push({
        clause_id: c.clause_id,
        title: c.title || c.name || "",
        domain: dir.name,
        file: full,
        doc_types_reached: u.types.length,
        doc_types: u.types.join(", "),
        rendered_words: u.words,
        risk_level: c.risk_level || "",
        enforceability: c.enforceability || "",
        mandatory: c.mandatory === true,
        review_status: c.review_status || "unmarked",
        reviewed_by: c.reviewed_by || "",
        citations: (c.legal_basis || []).map(b => `${b.act||""} s.${b.section||""}`).join("; "),
        text: c.text || "",
        // The specific judgement the clause author could not make. This is the
        // most useful column in the pack: it turns "review this text" into a
        // concrete question, and it is where every deliberate drafting choice
        // and every unverified citation was recorded.
        authoring_note: c.authoring_note || "",
        statute_currency: c.statute_currency || "",
        // Why a clause reaches nothing matters. A clause no blueprint mentions is
        // dead. A conditional clause is alive but waits on a question this
        // fixture did not answer -- it will appear the moment a user answers it,
        // so it still needs review, just not first.
        reach_status: u.types.length > 0
          ? "in every generated draft that uses it"
          : (blueprintReferenced.has(c.clause_id)
              ? "conditional or variant -- reachable, but not triggered by the baseline fixture"
              : "NOT referenced by any blueprint or policy"),
      });
    }
  }
}

// Priority: reach across document types, weighted up for high risk and for
// clauses that are mandatory in the blueprint.
const RISK_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1, "": 1 };
for (const c of clauses) {
  c.priority =
    c.doc_types_reached * (RISK_WEIGHT[c.risk_level.toUpperCase()] || 1) +
    (c.mandatory ? 5 : 0) +
    // A clause with an authoring note carries a question already framed for the
    // advocate, so it is cheaper to decide and should not sink below untouched
    // boilerplate that merely appears in many documents.
    (c.authoring_note ? 8 : 0) +
    // Repointed to the labour Codes on 21 November 2025: the substance moved,
    // not just the citation, so these need a look before anything else.
    (c.statute_currency ? 12 : 0);
}
clauses.sort((a, b) => b.priority - a.priority);

fs.writeFileSync(path.join(ROOT, "reviewpack.json"), JSON.stringify(clauses, null, 1));
const reached = clauses.filter(c => c.doc_types_reached > 0);
const typeCount = Object.keys(DOCUMENT_TYPE_REGISTRY).length;
const conditional = clauses.filter(c => c.doc_types_reached === 0 && blueprintReferenced.has(c.clause_id));
const dead = clauses.filter(c => c.doc_types_reached === 0 && !blueprintReferenced.has(c.clause_id));
console.log(`${clauses.length} live clauses, ${reached.length} appear in a baseline draft of one of the ${typeCount} types`);
console.log(`${conditional.length} are conditional or variant -- reachable, awaiting a trigger the baseline fixture does not answer`);
console.log(`${dead.length} are referenced by no blueprint or policy at all\n`);
let cum = 0;
const totalPlacements = clauses.reduce((n,c)=>n+c.doc_types_reached,0);
for (const [n] of [[10],[20],[30],[50]]) {
  cum = clauses.slice(0,n).reduce((s,c)=>s+c.doc_types_reached,0);
  console.log(`  top ${String(n).padStart(3)} clauses cover ${String(cum).padStart(4)} of ${totalPlacements} clause placements (${Math.round(100*cum/totalPlacements)}%)`);
}
