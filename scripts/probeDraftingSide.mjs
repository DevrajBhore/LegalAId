/**
 * probeDraftingSide.mjs
 *
 * DOES THE SIDE THE USER PICKED DO ANYTHING?
 *
 * The intake asks "Which side are you on?" and describes the answer as telling
 * the system "whose risks to ask about, so the questions and the protections
 * point at the right side of the table". This measures whether that is true.
 *
 * THE PROPERTY BEING TESTED IS NOT "opposing sides must produce different
 * documents". Plenty of provisions should be identical whichever side asked for
 * the draft, and forcing divergence would invent a legal notion of "correct
 * perspective" that nobody here is entitled to. The property is narrower and
 * falsifiable:
 *
 *     If drafting_for is presented as a meaningful drafting input, its effect
 *     must be traceable to an explicit position or treatment — or the system
 *     must not present it as having affected the draft.
 *
 * A field that is collected, shown as a question about the user's own risk, and
 * then changes nothing is a product-level claim that the answer mattered. That
 * is a defect whatever the document says.
 *
 * Each family is probed with its OWN declared role pair, from
 * getPartyNamingLabels, not from a list of sides that seemed right.
 *
 * Run: node scripts/probeDraftingSide.mjs [--diff]
 */
import { generateDocument } from "../backend/services/documentService.js";
import { buildVariables } from "./freezeClauseBaseline.mjs";
import { getPartyNamingLabels } from "../backend/services/draftingPolicy.js";
import { getVariables, sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";
import { buildDocumentFields } from "../backend/services/documentIntakeConfig.js";
import { deriveControlsForDocument } from "../backend/services/derivationAdapter.js";

const SHOW_DIFF = process.argv.includes("--diff");
const FAMILIES = ["MASTER_SERVICE_AGREEMENT", "NDA", "LOAN_AGREEMENT", "EMPLOYMENT_CONTRACT"];

const RESULT = {
  EFFECTIVE: "PERSPECTIVE_EFFECTIVE",       // changes an authored position or treatment
  DECORATIVE: "PERSPECTIVE_DECORATIVE",     // collected, changes nothing
  UNGOVERNED: "PERSPECTIVE_UNGOVERNED",     // changes output through logic nobody authored
  ASSUMED: "PERSPECTIVE_ASSUMED",           // output depends on a side nobody confirmed
  UNREACHABLE: "PERSPECTIVE_UNREACHABLE",   // a position moves, nothing downstream does
  DROPPED: "PERSPECTIVE_DROPPED",           // stripped before generation ever sees it
  NOT_OFFERED: "NOT_OFFERED",               // the family does not ask
};

const substantive = (draft) => (draft?.clauses || [])
  .map((c) => `${c.clause_id}\n${c.text}`).join("\n----\n");

async function probe(documentType) {
  const labels = getPartyNamingLabels(documentType);
  const base = buildVariables(documentType, "full");

  // 1. Is drafting_for actually offered for this family, and admitted?
  const fields = buildDocumentFields(documentType) || [];
  const field = (Array.isArray(fields) ? fields : Object.values(fields))
    .find((f) => f?.name === "drafting_for");
  const offered = Boolean(field);
  const inSchema = "drafting_for" in (getVariables(documentType) || {});

  if (!labels || !offered) {
    return { documentType, result: RESULT.NOT_OFFERED, offered, inSchema };
  }

  // 2. Does it survive sanitisation — i.e. reach generation at all?
  const survives = "drafting_for" in
    sanitizeVariablesForDocument(documentType, { ...base, drafting_for: labels.first });

  // 3. Does it reach the derivation layer, and does the derived picture differ?
  const derivedA = deriveControlsForDocument(documentType, { ...base, drafting_for: labels.first });
  const derivedB = deriveControlsForDocument(documentType, { ...base, drafting_for: labels.second });
  const derivedDiff = Object.keys({ ...derivedA, ...derivedB })
    .filter((k) => JSON.stringify(derivedA[k]) !== JSON.stringify(derivedB[k]));

  const run = async (side) => {
    const out = await generateDocument({
      document_type: documentType, variables: { ...base, drafting_for: side }, answers: {},
    });
    return out?.draft ? out : { error: out?.error };
  };
  const a = await run(labels.first);
  const b = await run(labels.second);
  if (a.error || b.error) {
    return { documentType, result: "DID_NOT_GENERATE", detail: a.error || b.error, offered, inSchema };
  }

  // 4-7. positions, treatments, clause ids, rendered substance
  // Compared SEMANTICALLY, not as JSON. A naive string diff reported the MSA as
  // PERSPECTIVE_EFFECTIVE because one unanswered question's wording carries a
  // {counterparty} token -- "What will the Service Provider have access to"
  // versus "What will the Client have access to". The counterparty's NAME
  // flipped; the position did not. Same flag, same outcome, same provenance,
  // same disclosure. A label is not a drafting position, and a comparison that
  // cannot tell them apart would certify the rename as perspective working.
  const positions = (out) => JSON.stringify((out.position_outcomes || [])
    .map((p) => [p.flag ?? p.id ?? p.position, p.outcome, p.provenance, p.disclosure_kind])
    .sort());
  const assumptions = (out) => JSON.stringify((out.assumptions || [])
    .map((a) => [a.kind ?? a.disclosure_kind, a.flag ?? a.subject ?? null, a.outcome ?? null])
    .sort());
  const idsA = a.draft.clauses.map((c) => c.clause_id);
  const idsB = b.draft.clauses.map((c) => c.clause_id);

  const changed = {
    survives_sanitisation: survives,
    reaches_derivation: derivedDiff.length > 0,
    positions: positions(a) !== positions(b),
    assumptions: assumptions(a) !== assumptions(b),
    clause_ids: JSON.stringify(idsA) !== JSON.stringify(idsB),
    substantive_text: substantive(a.draft) !== substantive(b.draft),
  };

  // 8. Does anything in the artifact nevertheless present the side as settled?
  const presented = [
    JSON.stringify(a.draft?.metadata || {}),
    JSON.stringify(a.assumptions || []),
  ].join(" ").includes(labels.first);

  // 9. Assumed or confirmed? drafting_for is not required, so a draft produced
  // without it rests on whatever the renderer does by default.
  const withoutSide = await generateDocument({
    document_type: documentType, variables: base, answers: {},
  });
  const sameAsDefault = withoutSide?.draft
    && substantive(withoutSide.draft) === substantive(a.draft);

  // The five categories, applied as declared rather than as convenient.
  const downstream = changed.clause_ids || changed.substantive_text;
  let result;
  if (!survives) result = RESULT.DROPPED;
  else if (changed.positions && downstream) result = RESULT.EFFECTIVE;
  // A position that moves and changes nothing after it is the category worth
  // having: the perspective reached the reasoning layer and stopped there.
  else if (changed.positions && !downstream) result = RESULT.UNREACHABLE;
  // Output moved with no authored position behind it: something is reading the
  // side directly, which is the chain being bypassed.
  else if (!changed.positions && downstream) result = RESULT.UNGOVERNED;
  else result = RESULT.DECORATIVE;

  return {
    documentType, labels, result, offered, inSchema, changed, presented, sameAsDefault,
    derivedDiff, diffText: SHOW_DIFF && changed.substantive_text ? { a: substantive(a.draft), b: substantive(b.draft) } : null,
    clauseCount: idsA.length,
  };
}

console.log("=".repeat(100));
console.log("DOES THE SIDE THE USER PICKED DO ANYTHING?");
console.log("=".repeat(100));
const rows = [];
for (const family of FAMILIES) rows.push(await probe(family));

console.log("family".padEnd(28) + "sides".padEnd(30) + "result");
console.log("-".repeat(100));
for (const row of rows) {
  console.log(
    row.documentType.padEnd(28) +
    (row.labels ? `${row.labels.first} / ${row.labels.second}` : "—").padEnd(30) +
    row.result
  );
}

console.log("\n" + "-".repeat(100));
for (const row of rows) {
  if (!row.changed) { console.log(`\n${row.documentType}: ${row.result} ${row.detail || ""}`); continue; }
  console.log(`\n${row.documentType}  (${row.clauseCount} clauses either way)`);
  for (const [what, did] of Object.entries(row.changed)) {
    console.log(`    ${did ? "CHANGED " : "same    "} ${what}`);
  }
  console.log(`    ${row.sameAsDefault ? "identical to" : "differs from"} a draft where no side was given`);
}

const decorative = rows.filter((r) => r.result === RESULT.DECORATIVE);
console.log("\n" + "=".repeat(100));
console.log(
  decorative.length
    ? `${decorative.length} of ${rows.length} families collect the side and produce identical legal substance\n` +
      `either way: ${decorative.map((r) => r.documentType).join(", ")}.\n\n` +
      `The document is not wrong. The PRODUCT CLAIM is: the intake asks "Which side are you on?"\n` +
      `and says the answer points the protections at the right side of the table. It does not.\n` +
      `A user who answers Customer and a user who answers Supplier receive the same instrument,\n` +
      `having each been told their answer shaped it.\n\n` +
      `This is the assumed-side invariant in a new place. A document must never look fully\n` +
      `fact-specific while resting on a side nobody acted on -- and here nobody acted on it even\n` +
      `though the user did confirm it.\n\n` +
      `WHAT THIS DOES NOT SAY: that opposing sides ought to produce different documents. Plenty\n` +
      `of provisions should be identical whoever asked. The defect is the gap between what the\n` +
      `question promises and what the pipeline does with the answer -- fixable either by routing\n` +
      `the side into authored positions, or by not presenting it as a drafting input.`
    : "Every family that offers the side does something with it."
);
