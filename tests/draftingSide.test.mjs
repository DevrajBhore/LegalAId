/**
 * draftingSide.test.mjs
 *
 * A QUESTION THAT CHANGES NOTHING MUST NOT BE ASKED AS IF IT DID.
 *
 * The intake asks "Which side are you on?" and tells the user the answer means
 * the questions and protections "point at the right side of the table". Across
 * the four families probed — MSA, NDA, Loan, Employment — the answer changes no
 * position, no treatment, no clause and no word of the instrument. A user who
 * says Customer and a user who says Supplier receive the same document, each
 * having been told their answer shaped it.
 *
 * THE PROPERTY IS NOT "opposing sides must produce different documents." Plenty
 * of provisions should be identical whoever asked for the draft, and forcing
 * divergence would invent a legal notion of "correct perspective" this layer is
 * not entitled to. The property is:
 *
 *     If drafting_for is presented as a meaningful drafting input, its effect
 *     must be traceable to an explicit position or treatment — or the system
 *     must not present it as having affected the draft.
 *
 * So this file does NOT assert that the sides differ. It records the current
 * state as a CEILING, by name, so that:
 *
 *   - making the side effective fails here and says to update the ceiling;
 *   - making it effective through hidden logic rather than through a position
 *     fails differently, and says so;
 *   - and nobody has to rediscover that the field is decorative.
 */
import assert from "node:assert";
import { generateDocument } from "../backend/services/documentService.js";
import { buildVariables } from "../scripts/freezeClauseBaseline.mjs";
import { getPartyNamingLabels } from "../backend/services/draftingPolicy.js";
import { sanitizeVariablesForDocument } from "../backend/config/variableConfig.js";

let checks = 0;

// Families known to collect the side and do nothing with it. An entry leaving
// this list is progress and must be deliberate; an entry joining it is a new
// family shipping the same defect.
const DECORATIVE = [
  "MASTER_SERVICE_AGREEMENT", "NDA", "LOAN_AGREEMENT", "EMPLOYMENT_CONTRACT",
];

// Compared semantically. A naive JSON diff reported the MSA as effective because
// one unanswered question's wording carries a {counterparty} token — "What will
// the Service Provider have access to" versus "What will the Client have access
// to". The counterparty's NAME flipped; the position did not. A comparison that
// cannot tell a label from a drafting position would certify the rename as
// perspective working.
const semanticPositions = (out) => JSON.stringify((out.position_outcomes || [])
  .map((p) => [p.flag ?? p.id ?? p.position, p.outcome, p.provenance, p.disclosure_kind]).sort());
const substance = (out) => (out.draft?.clauses || [])
  .map((c) => `${c.clause_id}\n${c.text}`).join("\n----\n");

for (const documentType of DECORATIVE) {
  const labels = getPartyNamingLabels(documentType);
  assert.ok(labels, `${documentType} no longer declares a party role pair`);
  const base = buildVariables(documentType, "full");

  // It is collected and it does reach generation — the defect is not that the
  // field is stripped. That distinction matters: a dropped field and an ignored
  // one need different fixes.
  assert.ok(
    "drafting_for" in sanitizeVariablesForDocument(documentType, { ...base, drafting_for: labels.first }),
    `${documentType}: drafting_for no longer survives sanitisation — that is a DIFFERENT defect ` +
    `from the one recorded here, and needs its own entry`
  );

  const draft = async (side) => generateDocument({
    document_type: documentType, variables: { ...base, drafting_for: side }, answers: {},
  });
  const first = await draft(labels.first);
  const second = await draft(labels.second);
  assert.ok(first?.draft && second?.draft, `${documentType}: fixture must generate both ways`);

  const positionsMoved = semanticPositions(first) !== semanticPositions(second);
  const substanceMoved = substance(first) !== substance(second);

  assert.ok(
    !substanceMoved,
    `${documentType}: the instrument now differs between ${labels.first} and ${labels.second}. ` +
    `If that came from an authored position, remove this family from DECORATIVE and assert the ` +
    `position instead. If it came from anywhere else, the side is reaching clauses without ` +
    `passing through the reasoning chain, which is the thing that must not happen.`
  );
  assert.ok(
    !positionsMoved,
    `${documentType}: a position now moves with the side but the instrument does not. That is ` +
    `PERSPECTIVE_UNREACHABLE — the perspective reached the reasoning layer and stopped there — ` +
    `and it deserves its own record rather than passing quietly.`
  );
  checks += 4;
}

console.log(
  `PASS  drafting_for is decorative in ${DECORATIVE.length} families — recorded, not hidden`
);
console.log(`\nALL GREEN (${checks} checks)`);
