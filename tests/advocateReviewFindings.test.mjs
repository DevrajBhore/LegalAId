// Guards the six generator defects a reviewing advocate found in a generated
// VENDOR_AGREEMENT. Each one reproduced with clean, complete inputs, so none of
// them were artefacts of a half-filled form -- they were in the generator.
//
// The review also raised commercial questions (is this a one-off sale or a
// standing vendor framework, should there be a liability cap) that are product
// decisions, not defects, and are deliberately not encoded here.

import assert from "node:assert";
import fs from "node:fs";
import { generateDocument } from "../backend/services/documentService.js";
import { variablesFor } from "../sweep.mjs";

let failures = 0;
const test = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => console.log(`PASS  ${name}`),
    (e) => { failures += 1; console.log(`FAIL  ${name}\n      ${e.message}`); }
  );

async function draft(documentType, extra = {}) {
  const variables = { ...variablesFor(documentType), ...extra };
  const result = await generateDocument({ document_type: documentType, variables });
  assert.ok(result?.draft, `${documentType} did not generate: ${result?.error || "unknown"}`);
  return (result.draft.clauses || []).map((c) => c.text).join("\n");
}

const GOODS = {
  party_1_name: "Rajiv Gandhi", party_2_name: "Indira Gandhi",
  operating_state: "Maharashtra", city: "Pune",
  goods_description: "Stainless steel kitchen knives, 5-piece set",
  contract_duration: "12 months",
};

await test("a goods clause uses the party names the document defined", async () => {
  // The builder hardcoded Seller/Purchaser. The role normaliser rewrote "Seller"
  // and missed "Purchaser", so one party was renamed and the other was referred
  // to by a term the definitions clause never introduces.
  for (const type of ["VENDOR_AGREEMENT", "SUPPLY_AGREEMENT", "SALES_OF_GOODS_AGREEMENT"]) {
    let text;
    try { text = await draft(type, GOODS); } catch { continue; }   // covered elsewhere
    assert.ok(!/\bPurchaser\b/.test(text),
      `${type} still calls a party "Purchaser", which it never defines`);
  }
});

await test("a goods document does not invoice for services", async () => {
  const text = await draft("VENDOR_AGREEMENT", GOODS);
  assert.ok(!/services or deliverables/.test(text),
    'the invoice clause still asks for a "description of the relevant services or deliverables"');
});

await test("no document refers to a term it never states", async () => {
  // VENDOR_AGREEMENT requires a duration, so the dangling reference cannot arise
  // there -- it arises on the types where the field is optional and left blank.
  // Sweeping is the honest test: the invariant is "no document, anywhere, refers
  // to an initial term it does not state".
  const { DOCUMENT_TYPE_REGISTRY } = await import("../shared/documentRegistry.js");
  const offenders = [];
  for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    let text;
    try { text = await draft(type, { operating_state: "Maharashtra", city: "Pune" }); }
    catch { continue; }                      // non-generating types are covered elsewhere
    // "initial term of 12 months" is fine; a bare "initial term" is not.
    if (/initial term(?! of )/.test(text)) offenders.push(type);
  }
  assert.deepStrictEqual(offenders, [],
    `these refer to "the initial term" without stating one: ${offenders.join(", ")}`);
});

await test("a stated duration is named in the renewal sentence", async () => {
  const text = await draft("VENDOR_AGREEMENT", { ...GOODS, contract_duration: "12 months" });
  assert.ok(/initial term of 12 months/.test(text),
    "the supplied contract duration is not named where the renewal sentence refers to it");
});

await test("the seat of arbitration is a place, never a bare state", async () => {
  for (const type of ["VENDOR_AGREEMENT", "NDA", "SERVICE_AGREEMENT"]) {
    let text;
    try { text = await draft(type, { ...GOODS, operating_state: "Maharashtra" }); } catch { continue; }
    const m = text.match(/The seat of arbitration shall be ([^,.;]+)/);
    if (!m) continue;
    const seat = m[1].trim();
    // A state on its own fixes no supervisory court. Either a city is named, or
    // the clause states a rule that resolves to one.
    assert.ok(!/^(Maharashtra|Karnataka|Delhi|Gujarat|Kerala|Rajasthan|Tamil Nadu|Uttar Pradesh|Telangana|West Bengal)$/.test(seat),
      `${type} names "${seat}" as the seat, which is a State and not a forum`);
  }
});

await test("statutory provenance is not printed into the signed document", () => {
  // The exporter rendered each clause's statutory_reference as "[Ref: ...]".
  // That is our own drafting metadata; an advocate read it as an unfinished
  // annotation left in the execution copy.
  const exporter = fs.readFileSync(
    new URL("../backend/services/exportService.js", import.meta.url), "utf8");
  const renderSites = exporter.match(/if \([^)]*clause\.statutory_reference\)/g) || [];
  assert.ok(renderSites.length > 0, "the render sites moved; this guard needs updating");
  for (const site of renderSites) {
    assert.ok(/PRINT_STATUTORY_ANNOTATIONS/.test(site),
      `an unguarded [Ref:] render site is back: ${site}`);
  }
});

await test("a term is defined only if the document goes on to use it", async () => {
  // The vendor blueprint carries no confidentiality clause and no IP clause, yet
  // the document defined both terms -- inviting the reader to look for an
  // obligation nobody drafted.
  const text = await draft("VENDOR_AGREEMENT", GOODS);
  const definitions = [...text.matchAll(/\([a-z]\)\s*"([^"]+)"\s+means\b/g)].map((m) => m[1]);
  assert.ok(definitions.length > 0, "no definitions were parsed; the format changed");

  const STRUCTURAL = new Set(["Agreement", "Effective Date", "Party", "Parties", "Term", "Business Day", "Applicable Law"]);
  const orphans = definitions.filter((term) => {
    if (STRUCTURAL.has(term)) return false;
    // Count uses outside the definitions clause itself.
    const uses = (text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    return uses <= 1;
  });
  assert.deepStrictEqual(orphans, [],
    `defined but never used: ${orphans.join(", ")}`);
});

await test("the definition list is lettered without gaps", async () => {
  const text = await draft("VENDOR_AGREEMENT", GOODS);
  const letters = [...text.matchAll(/^\s*\(([a-z])\)\s*"[^"]+"\s+means\b/gm)].map((m) => m[1]);
  if (letters.length < 2) return;
  const expected = letters.map((_, i) => String.fromCharCode(97 + i));
  assert.deepStrictEqual(letters, expected,
    `pruning left a gap in the lettering: ${letters.join("")}`);
});

// ── Second review round ────────────────────────────────────────────────────
// A reviewing advocate read a document generated AFTER the fixes above and found
// four more. Three of them shared one upstream cause: a variable named
// `arbitration_city` was being filled with a State.

const NO_CITY = {
  party_1_name: "rajiv gandhi", party_2_name: "Rahul mandhi",
  party_1_address: "", party_2_address: "",
  operating_state: "Maharashtra", city: "", execution_city: "", arbitration_city: "",
  contract_duration: "12 months",
  delivery_location: "Plot 21, MIDC Bhosari, Pune 411026",
};

const STATES = "Maharashtra|Karnataka|Delhi|Gujarat|Kerala|Rajasthan|Tamil Nadu|Uttar Pradesh|Telangana|West Bengal|Punjab|Haryana|Bihar|Odisha|Assam";

await test("no clause names a bare State as a forum", async () => {
  // "the seat of arbitration shall be Maharashtra" and "the competent courts at
  // Maharashtra" both name somewhere nobody can file. The first fix for this
  // failed silently because injectJurisdictionRules had already replaced the
  // missing city with the State before the guard ran.
  const offenders = [];
  const { DOCUMENT_TYPE_REGISTRY } = await import("../shared/documentRegistry.js");
  for (const type of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
    let text;
    try { text = await draft(type, NO_CITY); } catch { continue; }
    const bad = new RegExp(`(?:seat of arbitration shall be|competent courts at|courts at) (?:${STATES})\\b`);
    const m = text.match(bad);
    if (m) offenders.push(`${type}: "${m[0]}"`);
  }
  assert.deepStrictEqual(offenders, [], `\n  ${offenders.join("\n  ")}`);
});

await test("a field named _city never holds a State", async () => {
  const { buildInjectedVariables } = await import("../backend/services/variableInjector.js")
    .then((m) => ({ buildInjectedVariables: m.buildInjectedVariables || m.default }))
    .catch(() => ({}));
  // The public surface varies; assert through a generated document instead.
  const text = await draft("VENDOR_AGREEMENT", NO_CITY);
  assert.ok(!/seat of arbitration shall be Maharashtra[,.]/.test(text),
    "the seat is still being set to a State");
});

await test("the notices clause never promises an address block it omits", async () => {
  // Clause 18 said notices go to "the address set out in this clause" and then
  // set none out, leaving no valid way to serve notice at all.
  const text = await draft("VENDOR_AGREEMENT", NO_CITY);
  if (/set out in this clause/.test(text)) {
    assert.ok(/The addresses for notices are/.test(text),
      "the clause points at an address block that was never emitted");
  }
});

await test("party names are rendered as proper names", async () => {
  const text = await draft("VENDOR_AGREEMENT", NO_CITY);
  assert.ok(!/rajiv gandhi/.test(text), 'a party is still named "rajiv gandhi"');
  assert.ok(!/Rahul mandhi/.test(text), 'a party is still named "Rahul mandhi"');
  assert.ok(/Rajiv Gandhi/.test(text) && /Rahul Mandhi/.test(text),
    "the normalised names are not on the page");
});

await test("normalising names leaves deliberate capitals alone", async () => {
  const { getParticipantExpectations } = await import("../backend/services/draftingPolicy.js");
  const name = (value) =>
    getParticipantExpectations("NDA", { party_1_name: value, party_1_address: "x" })[0]?.name;
  // Rewriting a real name wrongly costs far more than leaving one alone, so the
  // rule only ever touches an entirely-lowercase word.
  assert.strictEqual(name("McDonald Foods"), "McDonald Foods");
  assert.strictEqual(name("ABC PVT LTD"), "ABC PVT LTD");
  assert.strictEqual(name("johannes van der berg"), "Johannes van der Berg");
  assert.strictEqual(name("o'brien"), "O'Brien");
  assert.strictEqual(name("smith-jones"), "Smith-Jones");
});

await test("unit spacing is normalised without touching statutory citations", async () => {
  // The unit list must exclude single letters: a case-insensitive rule including
  // "a" rewrites "Section 143A" as "Section 143 A", and s.143A of the
  // Arbitration and Conciliation Act is a provision this product cites.
  const text = await draft("VENDOR_AGREEMENT", {
    ...NO_CITY,
    goods_description: "Stainless steel bolts, 10mm diameter, 5kg net",
  });
  assert.ok(!/\d(?:mm|kg)\b/.test(text), "a measurement is still run together with its unit");
  assert.ok(!/Section 143 A|Section 12 A|s\. ?143 A/.test(text),
    "a statutory citation was split by the unit-spacing rule");
});

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
