/**
 * proveUniversality.mjs
 *
 * The claim under test:
 *
 *   Adding legal knowledge changes the system's behaviour.
 *   Adding legal knowledge does not require changing the system that executes it.
 *
 * It creates an entirely artificial document family whose names appear nowhere
 * in the JavaScript -- a "Zorvic Custody Arrangement" between a Bailor and a
 * Keeper -- using knowledge-base artifacts only, and walks the whole chain:
 *
 *   discovery -> intake -> question -> answer -> position -> treatment
 *             -> applicability -> clause -> conservation -> disclosure -> artifact
 *
 * Every link it cannot cross without a code change is reported by name. That
 * list is the honest measure of how universal the engine actually is, and it is
 * a better acceptance criterion than "we currently support 40 types".
 *
 * It then removes every artifact and confirms the engine is unchanged, so the
 * proof includes the negative requirement.
 *
 * Run: node scripts/proveUniversality.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KB = path.resolve(HERE, "../knowledge-base");
const TYPE = "ZORVIC_CUSTODY_ARRANGEMENT";

const artifacts = [
  [path.join(KB, "clause_library/commercial/zorvic_custody.json"), {
    clause_id: "ZORVIC_CUSTODY_TERMS_001",
    name: "Custody of the Zorvic",
    title: "Custody and Care",
    category: "OBLIGATIONS",
    document_types: [TYPE],
    jurisdiction: "India",
    text: "The Keeper shall hold the Zorvic in safe custody, shall not part with possession of it, and shall return it to the Bailor on demand in the condition in which it was received, fair wear and tear excepted.",
    legal_basis: [{ act: "Indian Contract Act, 1872", section: "151", note: "A bailee must take as much care of the goods bailed as a person of ordinary prudence would take of his own." }],
    mandatory: false, enforceability: "HIGH", risk_level: "MEDIUM",
    invalid_if: [], depends_on: [], conflicts_with: [], required_with: [], suggested_with: [],
    review_status: "draft-needs-legal-review", source: "Universality probe", version: "1.0",
  }],
  [path.join(KB, "clause_library/commercial/zorvic_insurance.json"), {
    clause_id: "ZORVIC_LOSS_COVER_001",
    name: "Cover Against Loss of the Zorvic",
    title: "Cover Against Loss",
    category: "INSURANCE",
    document_types: [TYPE],
    jurisdiction: "India",
    text: "The Keeper shall maintain cover against loss of or damage to the Zorvic for its full replacement value throughout the period of custody, and shall produce evidence of that cover to the Bailor on request.",
    legal_basis: [{ act: "Indian Contract Act, 1872", section: "152", note: "A bailee is not liable for loss without negligence where the goods were kept with ordinary prudence; cover is the commercial answer to that gap." }],
    mandatory: false, enforceability: "HIGH", risk_level: "MEDIUM", materiality: "LEGAL",
    invalid_if: [], depends_on: [], conflicts_with: [], required_with: [], suggested_with: [],
    review_status: "draft-needs-legal-review", source: "Universality probe", version: "1.0",
  }],
  [path.join(KB, "documents/zorvic_custody_arrangement.document.json"), {
    document_type: TYPE,
    display_name: "Zorvic Custody Arrangement",
    family: "Quorral Holdings",
    blueprint: "zorvic_custody_arrangement",
    signature_type: "BILATERAL",
    common_fields: ["party_1_name", "party_2_name", "party_1_type", "party_2_type", "effective_date", "operating_state", "execution_city"],
    required_fields: ["party_1_name", "party_2_name", "zorvic_description", "custody_window"],
    variables: {
      zorvic_description: {
        label: "What is being placed in custody?", type: "textarea", required: true,
        description: "Identify the Zorvic precisely enough that it can be told apart from anything else the Keeper holds.",
      },
      custody_window: {
        label: "For how long?", type: "text", required: true,
        example: "9 months",
        description: "The period the Keeper holds it for.",
      },
      quorral_exposure: {
        label: "Could the Zorvic be lost, damaged or destroyed while the Keeper has it?",
        type: "select", required: false, options: ["Yes", "No"],
        description: "Answer yes if it is fragile, valuable, or kept somewhere you do not control.",
      },
    },
    sections: [
      { title: "Parties", fields: ["party_1_name", "party_2_name"] },
      { title: "The Zorvic", fields: ["zorvic_description", "custody_window"] },
      { title: "Risk", fields: ["quorral_exposure"] },
    ],
  }],
  [path.join(KB, "intake/facts/zorvic_custody.facts.json"), {
    facts: [{
      id: "QUORRAL_EXPOSURE",
      question: "Could the item {counterparty} is holding be lost, damaged or destroyed while it is with them?",
      why: "Whether the thing can come to harm in the Keeper's hands decides whether the arrangement needs to say who carries that loss. Section 152 of the Indian Contract Act, 1872 leaves a bailee off the hook where they kept the goods with ordinary prudence, so silence here leaves the Bailor bearing a loss they may not expect to.",
      type: "select",
      legal_proposition: "Whether the bailed item can come to harm in the Keeper's hands, which decides whether the arrangement must say who carries that loss.",
      scope: "Arrangements where one party holds another's property.",
      jurisdiction: "India",
      unknown_behaviour: "No allocation of loss is drafted and the position is disclosed as unsettled.",
      review_status: "draft-needs-legal-review",
      established_by: { fields: ["quorral_exposure"] },
      options: [
        { label: "Yes — it could be lost or damaged", establishes: { QUORRAL_EXPOSURE: true } },
        { label: "No — it is robust and stays put", establishes: { QUORRAL_EXPOSURE: false } },
      ],
    }],
    treatments: [
      { fact: "QUORRAL_EXPOSURE", value: true, positions: { quorral_cover_required: true },
        basis: "A bailee is not liable for loss without negligence, so cover is the commercial answer to the gap that leaves.",
        authority: [{ act: "Indian Contract Act, 1872", section: "152" }],
        review_status: "draft-needs-legal-review" },
      { fact: "QUORRAL_EXPOSURE", value: false, positions: { quorral_cover_required: false },
        basis: "Where the item cannot realistically come to harm there is no loss to provide against.",
        authority: "commercial", review_status: "draft-needs-legal-review" },
    ],
    defaults: {},
  }],
  [path.join(KB, "clause_library/blueprints/zorvic_custody_arrangement.blueprint.json"), {
    document_type: TYPE,
    family: "custody",
    clauses: [
      "CORE_IDENTITY_001", "CORE_PURPOSE_001", "ZORVIC_CUSTODY_TERMS_001",
      "CORE_TERM_001", "CORE_DISPUTE_RESOLUTION_001", "CORE_GOVERNING_LAW_001",
      "CORE_SIGNATURE_BLOCK_001",
    ],
    conditional_clauses: [
      { clause: "ZORVIC_LOSS_COVER_001", include_if: "quorral_cover_required == true",
        note: "Cover is included where the Bailor's answers show a real risk of loss." },
    ],
  }],
];

function install() {
  for (const [file, body] of artifacts) fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`);
}
function remove() {
  for (const [file] of artifacts) if (fs.existsSync(file)) fs.unlinkSync(file);
}

export async function proveUniversality() {
const blocked = [];
const crossed = [];

install();
try {
  const { clearClauseCache, getClauseById, getBlueprintForDocumentType } =
    await import("../backend/services/clauseAssembler.js");
  const { clearKnowledgeDocumentCache } = await import("../shared/knowledgeDocuments.js");
  const { clearFactRegistryCache } = await import("../backend/services/factRegistry.js");
  clearClauseCache();
  clearKnowledgeDocumentCache();
  clearFactRegistryCache();

  // 1. discovery — does the knowledge base find the family at all?
  getClauseById("ZORVIC_CUSTODY_TERMS_001")
    ? crossed.push("clauses load from the knowledge base")
    : blocked.push("clause loading");
  getBlueprintForDocumentType(TYPE)
    ? crossed.push("blueprint resolves for an unknown document type")
    : blocked.push("blueprint resolution");

  // 2. registry — is the type visible to the product?
  const { DOCUMENT_TYPE_REGISTRY } = await import("../shared/documentRegistry.js");
  DOCUMENT_TYPE_REGISTRY[TYPE]
    ? crossed.push("document type is discovered")
    : blocked.push("shared/documentRegistry.js — the type list is JavaScript");

  // 3. intake — can the form be built without a code change?
  // Deliberately checks for a TYPE-SPECIFIC field, not merely that some
  // variables resolve. COMMON variables come back for any string, so "an intake
  // exists" was passing for a family that had no intake of its own -- a probe
  // flattering itself.
  const { getVariables } = await import("../backend/config/variableConfig.js");
  getVariables(TYPE)?.zorvic_description
    ? crossed.push("the family's own intake schema resolves")
    : blocked.push("backend/config/variableConfig.js — the intake schema is JavaScript");
  const { DOCUMENT_CONFIG } = await import("../backend/config/documentConfig.js");
  DOCUMENT_CONFIG[TYPE]?.sections?.length
    ? crossed.push("intake sections resolve")
    : blocked.push("backend/config/documentConfig.js — form sections are JavaScript");

  // 4. analysis — do the generic layers work on a family they have never seen?
  const { analyseOpenPositions } = await import("../backend/services/materialityAnalysis.js");
  const analysis = analyseOpenPositions({ documentType: TYPE, variables: {} });
  analysis.positions.some((p) => p.flag === "quorral_cover_required")
    ? crossed.push("materiality analysis reads the new blueprint's gates")
    : blocked.push("materiality analysis");

  // 5. question -> answer -> position -> treatment, on the new family
  const { planGapQuestions } = await import("../backend/services/factQuestionPlanner.js");
  const plan = planGapQuestions({ documentType: TYPE, variables: {} });
  plan.questions.length
    ? crossed.push(`gap check produced ${plan.questions.length} question(s) for it`)
    : blocked.push(
        `gap-check planning (open: ${plan.openMechanisms.join(",") || "none"}; ` +
        `unserved: ${plan.unserved.join(",") || "none"})`
      );

  const { resolvePositions } = await import("../backend/services/positionResolution.js");
  const resolved = resolvePositions({
    documentType: TYPE, variables: {},
    answers: { QUORRAL_EXPOSURE: "Yes — it could be lost or damaged" },
  });
  resolved.positions.quorral_cover_required?.value === true
    ? crossed.push("an answer resolved a position on the new family")
    : blocked.push("position resolution");
  resolved.conservation.leaked.length === 0
    ? crossed.push("conservation holds on a family the engine has never seen")
    : blocked.push("conservation");

  // 6. clause selection through the deterministic engine
  const { assembleDocument } = await import("../backend/services/clauseAssembler.js");
  let ids = [];
  try {
    ids = (assembleDocument(TYPE, { party_1_name: "A", party_2_name: "B", quorral_cover_required: true })?.clauses || [])
      .map((c) => c.clause_id);
  } catch (error) {
    blocked.push(`clause assembly (${String(error.message).slice(0, 60)})`);
  }
  ids.includes("ZORVIC_CUSTODY_TERMS_001")
    ? crossed.push("the deterministic engine selected the new clauses")
    : blocked.push("clause selection");
  ids.includes("ZORVIC_LOSS_COVER_001")
    ? crossed.push("a conditional gate on the new blueprint fired from a resolved position")
    : blocked.push("conditional gating on the new family");
} finally {
  remove();
  const { clearFactRegistryCache: resetFacts } = await import("../backend/services/factRegistry.js");
  const { clearKnowledgeDocumentCache: resetDocs } = await import("../shared/knowledgeDocuments.js");
  resetFacts();
  resetDocs();
  const { clearClauseCache } = await import("../backend/services/clauseAssembler.js");
  clearClauseCache();
}

  // The negative requirement: every artifact is gone, so a later run of the
  // engine must be indistinguishable from one that never saw this family.
  const residue = artifacts.filter(([file]) => fs.existsSync(file)).map(([file]) => file);
  return { crossed, blocked, residue };
}

const result = await proveUniversality();
if (String(process.argv[1] || "").endsWith("proveUniversality.mjs")) {
  console.log("\nCrossed without touching engine code:");
  for (const step of result.crossed) console.log(`  ✓ ${step}`);
  console.log("\nRequired a code change:");
  for (const step of result.blocked) console.log(`  ✗ ${step}`);
  console.log(
    `\n${result.crossed.length} of ${result.crossed.length + result.blocked.length} links of the ` +
    `chain are knowledge-driven. The rest are where "universal" is still aspirational.`
  );
}
