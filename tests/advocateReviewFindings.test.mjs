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

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
