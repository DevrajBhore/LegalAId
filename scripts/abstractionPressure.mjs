/**
 * abstractionPressure.mjs
 *
 * READ THE PORTFOLIO AS ONE DATASET, THEN CHOOSE.
 *
 * Four reports exist -- the portfolio inventory, the claim-authority audit, the
 * family certification map and the proposition layer -- and each answers a
 * question about a slice. This joins them to answer the question none of them
 * answers alone:
 *
 *     Which family, of the thirty-three with no identity authored, is most
 *     likely to expose a failure class the architecture has not met?
 *
 * Not which document is popular. Not which is next alphabetically. The seven
 * families already certified were each chosen because they broke something, and
 * the eighth should be chosen the same way -- but on measured pressure rather
 * than on whichever family happened to be under review.
 *
 * ON THE INSTRUMENTS. Several signals below are lexical screens over clause
 * text. Every one of them is a FLOOR: it fires on an enumerated vocabulary and
 * misses anything phrased outside it. They are reported as pressure signals, not
 * as findings, and the residue that needs a human judgement is printed as such
 * rather than guessed at. A classifier that silently decides the cases it cannot
 * decide is the defect this codebase keeps finding.
 *
 * Run: node scripts/abstractionPressure.mjs [--evidence]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getAllClauses } from "../backend/services/clauseAssembler.js";
import { loadDocumentRequirements } from "../backend/services/documentRequirements.js";
import { loadPropositions } from "../backend/services/evidencePropositions.js";
import { reachableControlsFor } from "../backend/services/derivationAdapter.js";
import { loadFactRegistry } from "../backend/services/factRegistry.js";
import { getVariables } from "../backend/config/variableConfig.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SHOW = process.argv.includes("--evidence");

const clauses = Object.fromEntries(getAllClauses().map((c) => [c.clause_id, c]));
const requirements = loadDocumentRequirements({ refresh: true });
const propositions = loadPropositions({ refresh: true });
const baseline = JSON.parse(
  fs.readFileSync(path.join(ROOT, "tests/baseline/clause-baseline.json"), "utf8")
).types || {};

const blueprints = {};
const BP_DIR = path.join(ROOT, "knowledge-base/clause_library/blueprints");
for (const name of fs.readdirSync(BP_DIR).filter((n) => n.endsWith(".blueprint.json"))) {
  const bp = JSON.parse(fs.readFileSync(path.join(BP_DIR, name), "utf8"));
  if (bp.document_type) blueprints[bp.document_type] = bp;
}

// PER DOCUMENT, not globally. sanitizeVariablesForDocument filters intake to the
// document's OWN schema, so a field declared in another family's config is not a
// source here: it is dropped before clause selection sees it. The global set
// made three scripts disagree with one another by a few gates each — small
// enough to read as rounding, which is how the last set of numbers survived.
const askableIn = (documentType) => new Set(Object.keys(getVariables(documentType) || {}));
const registry = loadFactRegistry();
const registryFlags = new Set();
for (const fact of registry.facts || []) {
  if (fact.id) registryFlags.add(fact.id);
  for (const t of fact.treatments || []) if (t.flag) registryFlags.add(t.flag);
}
// DERIVABILITY IS PROBED WITH THE SCHEMA'S OWN FIXTURES, AND THE ARGUMENTS ARE
// IN THE RIGHT ORDER. Both halves of that sentence were wrong here once, and
// each produced a confident false measurement:
//
//   1. deriveGenerationControls(documentType, variables) -- documentType FIRST.
//      Called the other way round it silently returns almost nothing, and every
//      gate reads as resting on no source. That error reported 29 orphan
//      propositions where there are 14, and drove a whole abstraction.
//   2. The fixture must be the schema's own synthetic intake, not values I
//      invent. Probing lender_type with "Bank" and "NBFC" found nothing because
//      the declared option is "Scheduled Bank".
//
// buildVariables is the baseline's own fixture builder, so the probe measures
// what the recorded baseline measures rather than a second fixture that drifts.
const derivedCache = new Map();
// Populated eagerly for every type the script will ask about, so the lookup
// below stays synchronous and no call site has to remember to await it.
for (const documentType of Object.keys(blueprints)) {
  derivedCache.set(documentType, await reachableControlsFor(documentType));
}
const derivedFor = (documentType) => derivedCache.get(documentType) || new Set();
const emitted = (type) => baseline[type]?.full?.clauses
  || [...new Set([...(blueprints[type]?.clauses || []), ...(blueprints[type]?.required_clauses || [])])];

// ═══ PART 1: the orphan gates, classified five ways ═════════════════════════
//
// "Orphan" collapsed five different situations, and treating the set as a
// cleanup list would throw away the ones that are evidence the architecture
// needs another reusable treatment.

// Entity prefixes that make one proposition look like several. The four
// spellings of "does this party process personal data" gate DPDP clauses in
// four families and are one proposition about four subjects.
const ENTITY_PREFIX = /^(jv|firm|company|employer|lender|counterparty|partner|client|supplier|vendor)_/;
const stem = (flag) => flag.replace(ENTITY_PREFIX, "");

const orphanRows = [];
for (const [type, bp] of Object.entries(blueprints)) {
  const ships = new Set(emitted(type));
  for (const entry of bp.conditional_clauses || []) {
    const expr = String(entry.include_if || entry.when || "");
    const flag = expr.replace(/^!/, "").split(/[\s=!<>]/)[0].trim();
    if (!flag) continue;
    if (askableIn(type).has(flag) || registryFlags.has(flag) || derivedFor(type).has(flag)) continue;
    orphanRows.push({
      flag, type, clause: entry.clause, expr,
      held: Boolean(bp._unreachable),
      clauseExists: Boolean(clauses[entry.clause]),
      clauseShips: ships.has(entry.clause),
      // Does the same clause reach output in ANY family without a gate? If so
      // the orphan gate withholds something the product otherwise publishes.
      reachableElsewhere: Object.keys(blueprints).some((other) =>
        other !== type && emitted(other).includes(entry.clause)
        && !(blueprints[other].conditional_clauses || []).some((e) => e.clause === entry.clause)),
    });
  }
}

const byFlag = new Map();
for (const row of orphanRows) {
  if (!byFlag.has(row.flag)) byFlag.set(row.flag, []);
  byFlag.get(row.flag).push(row);
}
const stems = new Map();
for (const flag of byFlag.keys()) {
  const key = stem(flag);
  if (!stems.has(key)) stems.set(key, []);
  stems.get(key).push(flag);
}

const CLASS = {
  DECLARED: "already admitted as a proposition",
  ALIAS: "one proposition under several identities",
  DRAFTING: "a drafting or scope choice, not a fact",
  UNREACHABLE: "gates a clause that cannot ship",
  JUDGEMENT: "needs a human call: unsupported fact vs world dependency",
};

const classify = (flag, rows) => {
  if (propositions.has(flag)) return CLASS.DECLARED;
  // Every use of it gates a clause that does not exist, or sits on a held family.
  if (rows.every((r) => !r.clauseExists || r.held)) return CLASS.UNREACHABLE;
  // Same stem as a declared proposition, or as another orphan under a different
  // entity prefix. Not a separate problem -- the same problem, spelled again.
  const siblings = stems.get(stem(flag)) || [];
  if (siblings.length > 1 || [...propositions.keys()].some((p) => stem(p) === stem(flag))) {
    return CLASS.ALIAS;
  }
  // A scope choice reads as "put this section in". It is a preference, and its
  // unknown should DEFAULT, not escalate.
  if (/^include_/.test(flag)) return CLASS.DRAFTING;
  return CLASS.JUDGEMENT;
};

const classified = {};
for (const [flag, rows] of byFlag) {
  const kind = classify(flag, rows);
  (classified[kind] ||= []).push({ flag, rows });
}

console.log("=".repeat(100));
console.log("PART 1 — THE ORPHAN GATES, SPLIT FIVE WAYS");
console.log("=".repeat(100));
console.log(
  `${byFlag.size} distinct propositions gate a clause with no source, across ` +
  `${orphanRows.length} gate uses.\n`
);
for (const [kind, list] of Object.entries(classified)
  .sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(list.length).padStart(3)}  ${kind}`);
  for (const { flag, rows } of list.sort((a, b) => b.rows.length - a.rows.length)) {
    const families = [...new Set(rows.map((r) => r.type))];
    const notes = [];
    if (rows.some((r) => r.reachableElsewhere)) notes.push("clause ships ungated elsewhere");
    if (rows.every((r) => r.held)) notes.push("family withheld");
    if (rows.some((r) => !r.clauseExists)) notes.push("clause not in library");
    console.log(
      `       ${flag.padEnd(32)} ${String(families.length).padStart(2)} famil${families.length === 1 ? "y " : "ies"}` +
      (notes.length ? `   [${notes.join("; ")}]` : "")
    );
    if (SHOW) for (const r of rows) console.log(`           ${r.type} -> ${r.clause}  (${r.expr})`);
  }
  console.log("");
}
const judgement = classified[CLASS.JUDGEMENT] || [];
console.log(
  `${judgement.length} propositions cannot be classified mechanically. The question for each is ` +
  `whether\nthe drafting party is the natural authority (intake debt) or is not (evidence debt),\n` +
  `and that is a legal judgement, not a string match.`
);

// ── A finding that is not about evidence at all ─────────────────────────────
//
// Many orphan gates withhold a clause that ANOTHER family publishes with no
// gate at all. Whatever the gate is protecting against, the product is not
// protected from it: the same words reach a reader through a different door.
// This is an inconsistency finding, not an evidence finding, and it belongs in
// its own queue — supplying evidence for these propositions would not change
// what most readers receive.
const inconsistent = orphanRows.filter((r) => r.reachableElsewhere);
const inconsistentClauses = [...new Set(inconsistent.map((r) => r.clause))];
console.log(
  `\n${inconsistent.length} of ${orphanRows.length} orphan gate uses withhold a clause that ships ` +
  `UNGATED in another family\n(${inconsistentClauses.length} distinct clauses). For these the gate ` +
  `is not protecting the reader from anything;\nit is producing two different documents from one ` +
  `library for no recorded reason.`
);
if (SHOW) for (const id of inconsistentClauses) console.log(`    ${id}`);

// ═══ PART 2: pressure signals across the 33 unauthored families ═════════════
//
// Each signal is a FLOOR. Named so nobody reads a zero as an absence.
const SIGNALS = {
  "external instrument": {
    why: "SHA-like: the document's correctness depends on a document it is not",
    test: /\b(articles of association|memorandum of association|board resolution|shareholders'? agreement|certificate of (incorporation|registration)|register of members|partnership deed|licen[cs]e issued|no.objection certificate)\b/i,
  },
  "formal act": {
    why: "tenancy-like: a clause providing for an act is not the act",
    test: /\b(shall be (registered|stamped)|registration under|duly stamped|attested by|notaris|sub-?registrar|adjudicat)\b/i,
  },
  // A PERIOD IS PRESENT. WHOSE PERIOD IT IS CANNOT BE READ FROM THIS LIBRARY.
  //
  // Two different legal objects hide behind one shape. Missing a contractual
  // payment term is a breach the other party may sue on; missing the thirty days
  // in proviso (b) to section 138 destroys the cause of action, and there is
  // nothing left to sue on. Only the second is the dependency class the cheque
  // notice exercises.
  //
  // I tried to separate them by whether the clause carries a legal_basis. That
  // classified all fifteen as statutory, which is wrong, and it is wrong in a
  // way this codebase has already been caught by once: the materiality work
  // found legal_basis presence was the wrong signal and removed it. Nearly every
  // clause here cites an Act for SOMETHING. SERVICE_TERMINATION_001 cites
  // Contract Act ss.39 and 55 — about the consequence of a term, not about a
  // deadline. SERVICE_PAYMENT_001 cites MSMED s.15, which really does impose a
  // forty-five-day limit, beside four provisions that impose nothing temporal.
  //
  // So the discriminator is not computable from what the knowledge base records,
  // and THAT IS THE FINDING. This signal is reported for completeness and
  // EXCLUDED FROM THE PRESSURE SCORE: ranking on a number that cannot tell a
  // payment term from a jurisdictional bar would be worse than not ranking.
  "period present (class unknown)": {
    why: "a period is stated; whether the parties chose it or an Act imposed it is not recorded",
    test: /\bwithin\s+\w+\s*\(?\d*\)?\s*(days?|months?|years?)\b.{0,80}\b(of|from|after)\b.{0,60}\b(receipt|service|notice|demand|default|dishonour|breach|occurrence)\b/i,
    excludeFromScore: true,
  },
  "declared character": {
    why: "MOU-like: the instrument asserts what kind of instrument it is",
    test: /\b(shall not|is not|does not) (be |)(legally )?(binding|constitute a (binding|legally)|create any (legal|binding))/i,
  },
  "third-party consent": {
    why: "a class no certified family exercises: performance conditional on someone outside",
    test: /\b(prior written (consent|approval) of the (lender|landlord|licensor|bank|regulator|board|shareholders)|subject to (the )?approval of|no.objection|regulatory approval|approval of the (Reserve Bank|Registrar|Tribunal|Court))\b/i,
  },
  "world claim": {
    why: "privacy-like: the document asserts a fact about a running service or party",
    test: /\b(the (platform|service|website|company|firm|employer) (uses?|collects?|stores?|shares?|processes?|maintains?|has designated)|we (use|collect|store|share|process))\b/i,
  },
};

// DISTINCTIVENESS. The first run of this script reported "formal act" pressure
// in 24 families. Twenty-four of the twenty-six hits were ONE clause --
// CORE_STAMP_AND_COSTS_001, generic "duly stamped" boilerplate that ships almost
// everywhere. That is not twenty-four families exercising the formality
// dimension; it is one clause counted twenty-four times.
//
// Which is precisely the error the Master Service Agreement falsification
// found -- boilerplate coverage creating the illusion of substance -- committed
// here by the measuring instrument itself. A signal only counts when it comes
// from a clause DISTINCTIVE to the family: infrastructure that ships everywhere
// tells you nothing about what kind of reasoning a family needs.
const familyCount = Object.keys(blueprints).length;
const ubiquity = {};
for (const type of Object.keys(blueprints)) {
  for (const id of emitted(type)) ubiquity[id] = (ubiquity[id] || 0) + 1;
}
const UBIQUITY_LIMIT = Math.ceil(familyCount / 3);
const distinctive = (id) => (ubiquity[id] || 0) <= UBIQUITY_LIMIT;

const authored = new Set(requirements.keys());
const families = Object.keys(blueprints).filter((t) => !authored.has(t)).sort();
const scores = [];
for (const type of families) {
  const ids = emitted(type);
  const hits = {};
  for (const [name, signal] of Object.entries(SIGNALS)) {
    hits[name] = ids.filter((id) => {
      if (!distinctive(id) || !signal.test.test(clauses[id]?.text || "")) return false;
      if (signal.statutory === undefined) return true;
      // Rests on an Act, as declared in the clause's own legal_basis -- never
      // inferred from the prose, which is how "143A" once matched "43A".
      const statutory = Array.isArray(clauses[id]?.legal_basis)
        && clauses[id].legal_basis.some((b) => b?.act && b?.section);
      return statutory === signal.statutory;
    });
  }
  const orphans = [...new Set(orphanRows.filter((r) => r.type === type).map((r) => r.flag))];
  // Two clauses in the same family that both state a post-termination period
  // are an NDA-shaped coherence risk. Same instrument, same question, twice.
  const periodClauses = ids.filter((id) =>
    /surviv\w*[^.]{0,140}?period of [a-z-]+ \(\d+\) years/i.test(clauses[id]?.text || ""));
  scores.push({
    type, clauses: ids.length, orphans,
    hits, coherenceRisk: periodClauses.length >= 2 ? periodClauses : [],
    // Pressure counts DISTINCT dependency classes present, not total matches: a
    // family with forty deadline clauses exercises one class, and a family with
    // one deadline and one external instrument exercises two.
    pressure: Object.entries(hits)
      .filter(([name, h]) => h.length && !SIGNALS[name].excludeFromScore).length
      + (orphans.length ? 1 : 0) + (periodClauses.length >= 2 ? 1 : 0),
  });
}

console.log("\n" + "=".repeat(100));
console.log("PART 2 — ABSTRACTION PRESSURE ACROSS THE 33 FAMILIES WITH NO IDENTITY AUTHORED");
console.log("=".repeat(100));
console.log(
  `Signals count only clauses DISTINCTIVE to a family (shipping in at most ` +
  `${UBIQUITY_LIMIT} of ${familyCount}).\nWithout that filter one boilerplate stamping clause ` +
  `reads as twenty-four families exercising formality.\n`
);
for (const [name, signal] of Object.entries(SIGNALS)) {
  const n = scores.filter((s) => s.hits[name].length).length;
  const suppressed = Object.keys(ubiquity).filter(
    (id) => !distinctive(id) && signal.test.test(clauses[id]?.text || "")
  );
  console.log(
    `  ${name.padEnd(22)} ${String(n).padStart(2)} families   ${signal.why}` +
    (suppressed.length
      ? `\n  ${" ".repeat(22)} (${suppressed.length} ubiquitous clause${
          suppressed.length === 1 ? "" : "s"} excluded: ${suppressed.join(", ")})`
      : "")
  );
}
console.log("\nRanked by number of DISTINCT dependency classes present:\n");
console.log("  family".padEnd(38) + "press  classes");
for (const s of scores.sort((a, b) => b.pressure - a.pressure).slice(0, 14)) {
  const present = [
    ...Object.entries(s.hits).filter(([, h]) => h.length).map(([k]) => k),
    ...(s.orphans.length ? [`orphan gates (${s.orphans.length})`] : []),
    ...(s.coherenceRisk.length ? ["duplicate period clauses"] : []),
  ];
  console.log(`  ${s.type.padEnd(36)} ${String(s.pressure).padStart(3)}   ${present.join(", ")}`);
}

console.log("\n" + "=".repeat(100));
console.log("PART 3 — WHICH CLASSES ARE ALREADY COVERED, AND WHICH ARE NOT");
console.log("=".repeat(100));
const COVERED = {
  "external instrument": "SHAREHOLDERS_AGREEMENT, POWER_OF_ATTORNEY",
  "formal act": "RENTAL_AGREEMENT, POWER_OF_ATTORNEY",
  "period present (class unknown)": "UNMEASURABLE — the library does not record whose period it is",
  "declared character": "MOU",
  "world claim": "MASTER_SERVICE_AGREEMENT (one requirement)",
  "third-party consent": null,
};
for (const [name, by] of Object.entries(COVERED)) {
  const pressure = scores.filter((s) => s.hits[name]?.length);
  console.log(
    `  ${name.padEnd(22)} ${by ? `covered by ${by}` : "NOT COVERED BY ANY CERTIFIED FAMILY"}`
  );
  if (!by || /withheld|UNMEASURABLE/.test(by || "")) {
    console.log(
      `  ${" ".repeat(22)} pressure in ${pressure.length} uncertified families: ` +
      `${pressure.slice(0, 6).map((s) => s.type).join(", ")}${pressure.length > 6 ? ", …" : ""}`
    );
  }
}
