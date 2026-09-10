/**
 * materialityAnalysis.js
 *
 * Phase 3. Given an intake, decide which of the open positions are worth
 * raising with the user and which are not.
 *
 * An UNKNOWN position is not a question. It becomes one only after two separate
 * tests, in this order:
 *
 *   1. LEGAL CONSEQUENCE. Would resolving this materially alter rights,
 *      obligations, risk allocation, remedies or enforceability? If not, it is
 *      BENIGN and is never raised, however visible the gap looks.
 *
 *   2. DEFAULT OR CHOICE. A legally-material unknown is still not automatically
 *      a question. Where the document must carry a mechanism anyway, the engine
 *      may adopt a neutral, conservative position and DISCLOSE that it was not
 *      specifically selected. Only where the law supplies no default, or where
 *      the choice allocates a benefit between the parties, must the user decide.
 *
 * The second test is what keeps a gap check from degenerating into another
 * questionnaire. There is a real difference between "this agreement needs a
 * dispute-resolution mechanism", which a document can supply and label as
 * supplied, and "the user chose arbitration", which it must never claim on
 * their behalf.
 *
 * Nothing here is hand-listed per document type. Materiality is read off the
 * clauses a flag actually gates in this document's blueprint, using the
 * category, risk level and statutory basis those clauses already declare.
 */
import { positionOf, POSITION, deriveGenerationControls, isAffirmative } from "./generationControls.js";
import { getBlueprintForDocumentType, getClauseById } from "./clauseAssembler.js";
import { buildDocumentSections } from "./documentIntakeConfig.js";

export const CLASSIFICATION = {
  BENIGN: "BENIGN",
  DRAFTING_MATERIAL: "DRAFTING_MATERIAL",
  LEGALLY_MATERIAL: "LEGALLY_MATERIAL",
};

// Why the position is open. These are legally different states and must not be
// collapsed: one is a product defect, one is a gap, one is a genuine election.
export const PROVENANCE = {
  // No field anywhere in this document type feeds the flag, so it can never be
  // anything but unknown. This is a BUG, not a gap -- it is how every rental
  // agreement came to assert that the tenant pays all utilities.
  NOT_COLLECTED: "NOT_COLLECTED",
  // A field exists; this intake did not put an answer in it.
  NOT_ASKED: "NOT_ASKED",
  // An answer was given that does not resolve to a position.
  AMBIGUOUS: "AMBIGUOUS",
  // The law supplies no default. The parties have to elect.
  REQUIRES_CHOICE: "REQUIRES_CHOICE",
};

// Categories where a change in position changes rights, risk allocation,
// remedies or enforceability rather than mechanics. Kept as categories rather
// than clause ids so a new clause inherits the classification from the slot it
// occupies instead of needing to be listed here.
const LEGALLY_SIGNIFICANT_CATEGORIES = new Set([
  "RISK", "LIABILITY", "INDEMNITY", "INDEMNITY_COVENANT", "INSURANCE",
  "RESTRAINT", "IP", "INTELLECTUAL_PROPERTY", "CONFIDENTIALITY",
  "DISPUTE_RESOLUTION", "ARBITRATION", "JURISDICTION", "GOVERNING_LAW",
  "PRIVACY", "DATA_PROCESSING", "REGULATORY", "COMPLIANCE",
  "TERMINATION", "REMEDIES", "ENFORCEABILITY", "RELEASE", "SURVIVAL",
  "WARRANTY", "EXECUTION_FORMALITIES",
]);

// Positions the law will not choose for the parties. Declared rather than
// derived, because "no lawful default exists" is a legal judgment about the
// mechanism and not a property of any clause record. Each entry states why.
const REQUIRES_CHOICE = new Map([
  ["include_non_compete",
    "Section 27 of the Indian Contract Act, 1872 makes a restraint of trade void " +
    "unless it falls within a recognised exception. There is no conservative default: " +
    "imposing a restraint nobody asked for is a void term, and omitting one the client " +
    "needed leaves a real risk unaddressed. The client has to elect."],
  ["include_non_solicit",
    "A non-solicitation covenant binds the counterparty after the engagement ends. " +
    "It cannot be supplied as a neutral default because it takes something from one " +
    "side and gives it to the other."],
  ["processes_personal_data",
    "Whether personal data is processed is a question of fact about the engagement, " +
    "not a drafting preference, and it decides whether the DPDP Act, 2023 obligations " +
    "attach at all. Guessing it wrong is a compliance failure in either direction."],
  ["include_ip_assignment",
    "Who owns work product is the substance of the bargain. Assigning it by default " +
    "would hand the client something it may not have paid for; withholding it by " +
    "default would leave a client who did pay without the rights."],
]);

// Can any answer the user could give move this flag off UNKNOWN?
//
// Derived by probing rather than declared. An earlier version carried a table
// mapping each flag to the fields that feed it, and the table's own gaps were
// then reported as product defects -- sixteen of them, most of which were
// reachable through the objectives checklist the table did not know about.
// Probing cannot be wrong in that direction: deriveGenerationControls is pure,
// so setting each collectable field to each plausible answer and watching the
// flag is an exact test of reachability.
const PROBES = [
  "Yes", "No", "12 months", "500000", "2026-09-01",
  "Monthly written reports covering progress and spend.",
  // The objectives checklist stores a comma-separated list of its own labels,
  // and several flags are reachable only through it.
  "Late or missed delivery, Defective or poor-quality goods, Price increases during the term, " +
  "Confidentiality breaches, Third-party or regulatory claims, The vendor walking away early, " +
  "Missed deadlines or slow delivery, Work not meeting the agreed standard, " +
  "Losing ownership of what I pay for, The consultant working for a competitor, " +
  "The consultant leaving mid-project, Costs creeping beyond the quoted fee",
];

function reachableFlags(documentType, variables, collectableFields) {
  const reachable = new Set();
  const baseline = deriveGenerationControls(documentType, variables);
  for (const field of collectableFields) {
    for (const probe of PROBES) {
      let probed;
      try {
        probed = deriveGenerationControls(documentType, { ...variables, [field]: probe });
      } catch {
        continue;
      }
      for (const flag of Object.keys(baseline)) {
        if (positionOf(baseline[flag]) === POSITION.UNKNOWN &&
            positionOf(probed[flag]) !== POSITION.UNKNOWN) {
          reachable.add(flag);
        }
      }
      // A flag the blueprint gates but the derivation never writes at baseline.
      for (const flag of Object.keys(probed)) {
        if (!(flag in baseline) && positionOf(probed[flag]) !== POSITION.UNKNOWN) {
          reachable.add(flag);
        }
      }
    }
  }
  return reachable;
}

// Which flags a blueprint actually gates a clause on, and on which clauses.
// Parsed from the blueprint rather than declared, so a gate added tomorrow is
// analysed tomorrow without anyone remembering to register it.
function gatesFromBlueprint(blueprint) {
  const gates = new Map();
  const record = (expression, clauseId) => {
    const match = String(expression || "").trim().match(/^([A-Za-z0-9_]+)\s*(?:==|!=)/);
    const flag = match ? match[1] : String(expression || "").trim();
    if (!flag || !/^[A-Za-z0-9_]+$/.test(flag)) return;
    if (!gates.has(flag)) gates.set(flag, new Set());
    gates.get(flag).add(clauseId);
  };
  for (const entry of blueprint?.conditional_clauses || []) {
    record(entry.include_if ?? entry.when, entry.clause);
  }
  for (const variant of blueprint?.variant_clauses || []) {
    for (const candidate of variant.select_first_match || variant.variants || []) {
      record(candidate.when ?? candidate.include_if, candidate.clause);
    }
  }
  return gates;
}

function classify(clauseIds) {
  if (!clauseIds.length) return CLASSIFICATION.BENIGN;
  for (const id of clauseIds) {
    const clause = getClauseById(id);
    if (!clause) continue;
    const category = String(clause.category || "").toUpperCase();
    // A clause may state its own materiality. Category is only a proxy: the
    // library's categories were assigned to order a document, not to describe
    // what a provision does, so a few clauses sit in a category that understates
    // them. Where that is true the clause says so and the declaration wins.
    const declared = String(clause.materiality || "").toUpperCase();
    if (declared === "LEGAL") return CLASSIFICATION.LEGALLY_MATERIAL;
    if (declared === "DRAFTING") return CLASSIFICATION.DRAFTING_MATERIAL;
    if (declared === "BENIGN") continue;
    if (LEGALLY_SIGNIFICANT_CATEGORIES.has(category)) return CLASSIFICATION.LEGALLY_MATERIAL;
    // risk_level is deliberately NOT consulted. It records how likely the clause
    // is to be struck down, not how much it moves between the parties: both
    // CORE_CONFIDENTIALITY_001 and RENT_UTILITIES_001 are tagged LOW. It is a
    // different axis and using it here produced nonsense in both directions.
    // The presence of a legal_basis is NOT a materiality signal. Nearly every
    // clause in the library cites a statute, because citing one is good drafting
    // -- a definitions clause resting on section 29 of the Contract Act is well
    // drafted, not legally material. Using it as a test classified 21 of 21 open
    // positions as legally material, which is the same as classifying none.
  }
  return CLASSIFICATION.DRAFTING_MATERIAL;
}

function provenanceOf(flag, variables, reachable, collectableFields) {
  if (REQUIRES_CHOICE.has(flag)) return PROVENANCE.REQUIRES_CHOICE;
  if (!reachable.has(flag)) return PROVENANCE.NOT_COLLECTED;
  // A same-named field was filled in and still did not produce a position: the
  // answer does not read as one. That is legally distinct from silence.
  if (collectableFields.has(flag) && String(variables?.[flag] ?? "").trim()) {
    return PROVENANCE.AMBIGUOUS;
  }
  return PROVENANCE.NOT_ASKED;
}

/**
 * The disposition. A legally-material unknown is a question only where the
 * engine cannot take a conservative position without misrepresenting the
 * bargain as negotiated.
 */
function decide({ classification, provenance, gatedClauses, alreadyProvided }) {
  if (classification === CLASSIFICATION.BENIGN) {
    return { disposition: "IGNORE", reason: "Resolving it changes no provision of this document." };
  }
  if (provenance === PROVENANCE.NOT_COLLECTED) {
    return {
      disposition: "DEFECT",
      reason:
        "This flag gates a clause and no field in this document type collects it, so it can " +
        "never hold a position. Until a field exists, the gate is decided by silence.",
    };
  }
  if (provenance === PROVENANCE.REQUIRES_CHOICE) {
    return {
      disposition: "ASK",
      reason: REQUIRES_CHOICE.get(gatedClauses.flag) || "The law supplies no default; the parties must elect.",
    };
  }
  if (classification === CLASSIFICATION.DRAFTING_MATERIAL) {
    return {
      disposition: "ASK_IF_NEEDED",
      reason:
        "It changes the mechanics of the bargain rather than its legal effect. Raise it only " +
        "if the missing detail prevents a sensible provision from being drafted.",
    };
  }
  if (alreadyProvided) {
    return {
      disposition: "DEFAULT_AND_DISCLOSE",
      reason:
        "The document already carries a mechanism for this, so the open question is which " +
        "form it takes rather than whether it exists. A neutral position can be adopted, " +
        "provided the draft discloses that it was not specifically selected.",
    };
  }
  return {
    disposition: "ASK",
    reason:
      "It alters rights, risk allocation or enforceability, and the document supplies no " +
      "mechanism to fall back on, so there is no conservative position to adopt.",
  };
}

export function analyseOpenPositions({ documentType, variables = {} }) {
  const blueprint = getBlueprintForDocumentType(documentType);
  if (!blueprint) return { documentType, positions: [], unreachable: [] };

  const derived = deriveGenerationControls(documentType, variables);
  const gates = gatesFromBlueprint(blueprint);

  const collectableFields = new Set(
    buildDocumentSections(documentType)
      .flatMap((section) => section.fields || [])
      .map((field) => field?.name)
      .filter(Boolean)
  );

  // Clauses the document carries regardless of any position -- the fallback the
  // "default and disclose" branch depends on existing.
  const unconditional = new Set(blueprint.clauses || []);

  const reachable = reachableFlags(documentType, variables, collectableFields);

  const positions = [];
  for (const [flag, clauseIdSet] of gates) {
    if (positionOf(derived[flag]) !== POSITION.UNKNOWN) continue;
    const clauseIds = [...clauseIdSet];
    const classification = classify(clauseIds);
    const provenance = provenanceOf(flag, variables, reachable, collectableFields);
    // Does the document already provide this kind of mechanism unconditionally?
    const categories = new Set(
      clauseIds.map((id) => String(getClauseById(id)?.category || "").toUpperCase()).filter(Boolean)
    );
    const alreadyProvided = [...unconditional].some((id) =>
      categories.has(String(getClauseById(id)?.category || "").toUpperCase())
    );
    const { disposition, reason } = decide({
      classification,
      provenance,
      gatedClauses: { flag, clauseIds },
      alreadyProvided,
    });
    positions.push({ flag, clauseIds, classification, provenance, disposition, reason });
  }

  // Flags gated by a blueprint that nothing in the intake can ever set. The
  // utilities-class defect, reported as its own list because it is a bug.
  const unreachable = positions
    .filter((p) => p.disposition === "DEFECT")
    .map((p) => ({ flag: p.flag, clauseIds: p.clauseIds }));

  const order = { ASK: 0, DEFECT: 1, DEFAULT_AND_DISCLOSE: 2, ASK_IF_NEEDED: 3, IGNORE: 4 };
  positions.sort((a, b) => order[a.disposition] - order[b.disposition] || a.flag.localeCompare(b.flag));
  return { documentType, positions, unreachable };
}

export { isAffirmative };
