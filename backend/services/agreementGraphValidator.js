/**
 * agreementGraphValidator.js
 *
 * Validates the agreement as a graph rather than as a bag of clauses.
 *
 * The clause-level checks elsewhere ask "is this clause well drafted?". They
 * cannot see the failure that matters most in an assembled document: a clause
 * that is perfectly drafted in itself but refers to a provision, a party
 * capacity, or a place that the rest of the document does not contain.
 *
 * A guarantee that survives "ownership of intellectual property" it never
 * granted, defaults on breach of "representations" it never took, seats its
 * arbitration in a city that is not in the state whose law it chooses, or
 * describes an LLP as a company incorporated under the Companies Act, is not a
 * document with a cosmetic defect. Each of those changes what the instrument
 * means, and none of them is visible from any single clause.
 *
 * These findings are reported as HIGH and do NOT block generation by default.
 * They are new, they are heuristics, and a heuristic that stops a user getting
 * their document has to earn that power on real traffic first. Set
 * LEGALAID_GRAPH_BLOCKS=1 once the findings have been watched for a while and
 * are trusted; every check then becomes CRITICAL and refuses the document
 * rather than shipping a PDF that reads as though a lawyer approved it.
 */

const BLOCKING = process.env.LEGALAID_GRAPH_BLOCKS === "1";

function buildIssue(ruleId, message, suggestion, clauseId = null) {
  return {
    rule_id: ruleId,
    severity: BLOCKING ? "CRITICAL" : "HIGH",
    message,
    suggestion,
    offending_clause_id: clauseId,
    blocks_generation: BLOCKING,
  };
}

function clauseText(clause) {
  return String(clause?.text || "");
}

/* ── 1. Concepts a clause claims the document contains ─────────────────────
 *
 * Only a genuine cross-reference counts. "You are responsible for maintaining
 * the confidentiality of your account credentials" is an obligation about a
 * password, not a reference to a confidentiality clause, and a check that
 * cannot tell the two apart gets switched off within a week.
 *
 * So claims are read out of the two places a document really does point at its
 * own other provisions: an enumeration of what survives or continues, and a
 * default or breach limb predicated on another clause existing.
 */

// Sentences that enumerate provisions of the agreement by name.
const ENUMERATION_CONTEXT =
  /[^.]*(?:shall survive|intended to survive|shall continue to bind|survive (?:any )?(?:expiry|termination)|provisions of this Agreement relating to)[^.]*\./gi;

const CONCEPT_REQUIREMENTS = [
  {
    concept: "confidentiality",
    label: "confidentiality",
    enumerated: /\bconfidentiality\b/i,
    providedById: /CONFIDENTIAL/i,
    providedByCategory: /CONFIDENTIAL/i,
  },
  {
    concept: "intellectual_property",
    label: "ownership of intellectual property",
    enumerated: /ownership of intellectual property|intellectual property ownership/i,
    providedById: /(?:^|_)IP(?:_|$)|INTELLECTUAL/i,
    providedByCategory: /^IP$|INTELLECTUAL/i,
  },
  {
    concept: "liability_cap",
    label: "limitation of liability",
    enumerated: /limitation of liability|liability cap/i,
    providedById: /LIABILITY/i,
    providedByCategory: /LIABILITY/i,
  },
  {
    concept: "indemnity",
    label: "indemnity",
    enumerated: /\bindemnit(?:y|ies)\b/i,
    providedById: /INDEMNIT/i,
    providedByCategory: /INDEMNIT/i,
  },
  {
    concept: "representations",
    label: "representations and warranties",
    // Not enumerated in a survival list; claimed by a default limb that
    // predicates on representations the document may never have taken.
    claim: /breach[^.]{0,60}\bof (?:any |a )?representation|representations and warranties (?:given|set out|contained|made) (?:in|under) this Agreement/i,
    providedById: /REPRESENTATION|WARRANT/i,
    providedByCategory: /REPRESENTATION|WARRANT/i,
  },
  {
    concept: "security",
    label: "security",
    claim: /security (?:created|granted|constituted) under (?:or in connection with )?this Agreement/i,
    providedById: /SECURITY|PLEDGE|MORTGAGE|HYPOTHEC|COLLATERAL/i,
    providedByCategory: /SECURITY|COLLATERAL/i,
  },
];

function claimsConcept(text, requirement) {
  if (requirement.claim && requirement.claim.test(text)) return true;
  if (!requirement.enumerated) return false;

  ENUMERATION_CONTEXT.lastIndex = 0;
  let sentence;
  while ((sentence = ENUMERATION_CONTEXT.exec(text)) !== null) {
    if (requirement.enumerated.test(sentence[0])) return true;
  }
  return false;
}

function findUnresolvedConceptIssues(draft) {
  const clauses = draft?.clauses || [];
  if (!clauses.length) return [];

  const issues = [];

  for (const requirement of CONCEPT_REQUIREMENTS) {
    const provider = clauses.find(
      (clause) =>
        requirement.providedById.test(String(clause?.clause_id || "")) ||
        requirement.providedByCategory.test(String(clause?.category || ""))
    );
    if (provider) continue;

    // The claiming clause is reported by name, so the fix is obvious: either the
    // provision is missing from the blueprint or the reference should not be
    // there.
    const claimant = clauses.find((clause) => claimsConcept(clauseText(clause), requirement));
    if (!claimant) continue;

    issues.push(
      buildIssue(
        `UNRESOLVED_CONCEPT_${requirement.concept.toUpperCase()}`,
        `"${claimant.title || claimant.clause_id}" refers to ${requirement.label}, but this document contains no ${requirement.label} provision.`,
        `Add a ${requirement.label} clause to the blueprint for this document type, or remove the reference from "${claimant.title || claimant.clause_id}".`,
        claimant.clause_id || null
      )
    );
  }

  return issues;
}

/* ── 2. Instructions written for the generator ─────────────────────────────── */

// Phrasing that describes what the document should be, rather than stating a
// term of it. These reached the page through a semantic summary that was built
// for the drafting engine's own use and then rendered as Clause 1.
const INSTRUCTION_LEAK = [
  /\bshould read as\b/i,
  /\bcoherent (?:indian )?legal document\b/i,
  /\bdescribed consistently in their correct legal capacities\b/i,
  /\b(?:draft|generate|write|produce) (?:this|the) (?:document|agreement|clause)\b/i,
  /\bensure (?:consistency|that the document)\b/i,
  /\bthe user (?:wants|has|selected|entered)\b/i,
  /\baccording to the prompt\b/i,
  /\bplaceholder text\b/i,
  /\bas an ai\b/i,
];

function findInstructionLeakIssues(draft) {
  const issues = [];

  for (const clause of draft?.clauses || []) {
    const text = clauseText(clause);
    const leak = INSTRUCTION_LEAK.find((pattern) => pattern.test(text));
    if (!leak) continue;

    issues.push(
      buildIssue(
        "GENERATOR_INSTRUCTION_LEAK",
        `"${clause.title || clause.clause_id}" contains text written for the document generator rather than a term of the agreement.`,
        "Render the clause from its own builder or from the clause library. Internal summaries describing what the document should look like must never be used as clause text.",
        clause.clause_id || null
      )
    );
  }

  return issues;
}

/* ── 3. A seat has to be a place that is in the state whose law applies ───── */

// Cities that plausibly appear as a seat, place of execution, or registered
// office in an Indian commercial agreement. A city that is not listed draws no
// conclusion -- the check only fires on a contradiction it is sure of.
const CITY_STATE = {
  mumbai: "Maharashtra", pune: "Maharashtra", nagpur: "Maharashtra",
  nashik: "Maharashtra", thane: "Maharashtra", aurangabad: "Maharashtra",
  solapur: "Maharashtra", kolhapur: "Maharashtra", "navi mumbai": "Maharashtra",
  delhi: "Delhi", "new delhi": "Delhi",
  gurugram: "Haryana", gurgaon: "Haryana", faridabad: "Haryana",
  panchkula: "Haryana", karnal: "Haryana",
  noida: "Uttar Pradesh", ghaziabad: "Uttar Pradesh", lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh", agra: "Uttar Pradesh", varanasi: "Uttar Pradesh",
  meerut: "Uttar Pradesh", prayagraj: "Uttar Pradesh", allahabad: "Uttar Pradesh",
  bengaluru: "Karnataka", bangalore: "Karnataka", mysuru: "Karnataka",
  mysore: "Karnataka", mangaluru: "Karnataka", mangalore: "Karnataka",
  hubballi: "Karnataka", belagavi: "Karnataka",
  chennai: "Tamil Nadu", coimbatore: "Tamil Nadu", madurai: "Tamil Nadu",
  tiruchirappalli: "Tamil Nadu", salem: "Tamil Nadu", tirunelveli: "Tamil Nadu",
  hyderabad: "Telangana", warangal: "Telangana", secunderabad: "Telangana",
  visakhapatnam: "Andhra Pradesh", vijayawada: "Andhra Pradesh",
  guntur: "Andhra Pradesh", tirupati: "Andhra Pradesh", nellore: "Andhra Pradesh",
  kolkata: "West Bengal", howrah: "West Bengal", siliguri: "West Bengal",
  durgapur: "West Bengal", asansol: "West Bengal",
  ahmedabad: "Gujarat", surat: "Gujarat", vadodara: "Gujarat",
  rajkot: "Gujarat", gandhinagar: "Gujarat", bhavnagar: "Gujarat",
  jamnagar: "Gujarat",
  jaipur: "Rajasthan", jodhpur: "Rajasthan", udaipur: "Rajasthan",
  kota: "Rajasthan", ajmer: "Rajasthan", bikaner: "Rajasthan",
  indore: "Madhya Pradesh", bhopal: "Madhya Pradesh", jabalpur: "Madhya Pradesh",
  gwalior: "Madhya Pradesh", ujjain: "Madhya Pradesh",
  kochi: "Kerala", cochin: "Kerala", thiruvananthapuram: "Kerala",
  trivandrum: "Kerala", kozhikode: "Kerala", thrissur: "Kerala",
  bhubaneswar: "Odisha", cuttack: "Odisha", rourkela: "Odisha",
  patna: "Bihar", gaya: "Bihar", muzaffarpur: "Bihar",
  ranchi: "Jharkhand", jamshedpur: "Jharkhand", dhanbad: "Jharkhand",
  raipur: "Chhattisgarh", bhilai: "Chhattisgarh", bilaspur: "Chhattisgarh",
  chandigarh: "Chandigarh",
  ludhiana: "Punjab", amritsar: "Punjab", jalandhar: "Punjab",
  mohali: "Punjab", patiala: "Punjab",
  dehradun: "Uttarakhand", haridwar: "Uttarakhand", roorkee: "Uttarakhand",
  guwahati: "Assam", dibrugarh: "Assam", silchar: "Assam",
  shimla: "Himachal Pradesh", solan: "Himachal Pradesh", baddi: "Himachal Pradesh",
  srinagar: "Jammu and Kashmir", jammu: "Jammu and Kashmir",
  panaji: "Goa", panjim: "Goa", "vasco da gama": "Goa", margao: "Goa",
  imphal: "Manipur", shillong: "Meghalaya", aizawl: "Mizoram",
  kohima: "Nagaland", agartala: "Tripura", itanagar: "Arunachal Pradesh",
  gangtok: "Sikkim", puducherry: "Puducherry", pondicherry: "Puducherry",
};

const CITY_FIELDS = [
  "execution_city",
  "arbitration_city",
  "jurisdiction_city",
  "court_city",
  "seat_city",
];

const STATE_FIELDS = ["governing_law_state", "operating_state", "jurisdiction_state"];

function normaliseCity(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findJurisdictionMismatchIssues(variables = {}) {
  const issues = [];

  for (const cityField of CITY_FIELDS) {
    const city = normaliseCity(variables[cityField]);
    const actualState = CITY_STATE[city];
    if (!actualState) continue;

    for (const stateField of STATE_FIELDS) {
      const declared = String(variables[stateField] || "").trim();
      if (!declared || declared.toLowerCase() === actualState.toLowerCase()) continue;

      issues.push(
        buildIssue(
          "JURISDICTION_CITY_STATE_MISMATCH",
          `${variables[cityField]} is in ${actualState}, but ${stateField.replace(/_/g, " ")} is set to ${declared}. The seat of arbitration, the courts named, and the governing law would point at two different states.`,
          `Set ${stateField.replace(/_/g, " ")} to ${actualState}, or choose a city in ${declared}.`
        )
      );
    }
  }

  return issues;
}

/* ── 4. A party described as something it is not ──────────────────────────── */

// What the name itself says about the entity. Only unambiguous suffixes are
// listed: a name ending "LLP" is an LLP, and no LLP is incorporated under the
// Companies Act.
const NAME_IMPLIED_TYPE = [
  { test: /\bllp\b\.?$|\bllp\b/i, type: "llp", label: "an LLP" },
  {
    test: /\b(?:private limited|pvt\.?\s*ltd\.?|pvt\.?\s*limited)\b/i,
    type: "private limited company",
    label: "a private limited company",
  },
  { test: /\b(?:public limited)\b/i, type: "public limited company", label: "a public limited company" },
];

const TYPE_FAMILY = (value = "") => {
  const type = String(value || "").toLowerCase();
  if (type.includes("llp") || type.includes("limited liability partnership")) return "llp";
  if (type.includes("private limited")) return "private limited company";
  if (type.includes("public limited")) return "public limited company";
  if (type.includes("partnership")) return "partnership firm";
  if (type.includes("proprietor")) return "sole proprietorship";
  if (type.includes("individual") || type.includes("person")) return "individual";
  if (type.includes("trust")) return "trust";
  if (type.includes("society")) return "society";
  return "";
};

function findEntityTypeContradictions(variables = {}) {
  const issues = [];

  for (const [key, value] of Object.entries(variables)) {
    if (!/_name$/.test(key)) continue;
    const base = key.replace(/_name$/, "");
    const declared = TYPE_FAMILY(variables[`${base}_type`]);
    if (!declared) continue;

    const name = String(value || "").trim();
    if (!name) continue;

    const implied = NAME_IMPLIED_TYPE.find((entry) => entry.test.test(name));
    if (!implied || implied.type === declared) continue;

    issues.push(
      buildIssue(
        "ENTITY_TYPE_CONTRADICTS_NAME",
        `"${name}" is ${implied.label} by its own name, but ${base.replace(/_/g, " ")} type is recorded as "${variables[`${base}_type`]}". The party would be described in the deed under the wrong statute.`,
        implied.type === "llp"
          ? "An LLP is registered under the Limited Liability Partnership Act, 2008, not incorporated under the Companies Act, 2013. Correct the entity type, or the name if the party is not an LLP."
          : "Correct the entity type to match the name, or the name if it is wrong."
      )
    );
  }

  return issues;
}

/**
 * @param {object} draft
 * @param {{ documentType?: string, variables?: object }} context
 * @returns {Array<object>} blocking issues, empty when the graph is sound
 */
export function validateAgreementGraph(draft, { documentType, variables = {} } = {}) {
  if (!draft?.clauses?.length || !documentType) return [];

  return [
    ...findUnresolvedConceptIssues(draft),
    ...findInstructionLeakIssues(draft),
    ...findJurisdictionMismatchIssues(variables),
    ...findEntityTypeContradictions(variables),
  ];
}

export const __testables = {
  findUnresolvedConceptIssues,
  findInstructionLeakIssues,
  findJurisdictionMismatchIssues,
  findEntityTypeContradictions,
  CITY_STATE,
};
