import { getVariables } from "../config/variableConfig.js";
import {
  getDocumentDraftingPolicy,
  getDocumentRoleContext,
  getParticipantExpectations,
} from "./draftingPolicy.js";

const GROUP_TARGETS = {
  "Agreement Basics":
    "recitals, commencement, term, renewal, and expiry clauses",
  "Termination & Remedies":
    "termination, cure, survival, and remedies clauses",
  "Jurisdiction & Dispute":
    "governing law, venue, arbitration, and dispute resolution clauses",
  "Commercial & Tax":
    "consideration, invoicing, taxes, and payment clauses",
  "Risk Allocation": "liability, indemnity, and risk-allocation clauses",
  "Optional Protections": "optional protections and restraint clauses",
  "Confidentiality & Use":
    "confidentiality, permitted use, access, exclusion, and return/destruction clauses",
  "Employment Terms":
    "employment role, duties, compensation, benefits, confidentiality, and IP clauses",
  "Consulting Controls":
    "scope, deliverables, milestones, acceptance, support, and performance clauses",
  "Delivery & Acceptance":
    "delivery, acceptance, source-code, support, and completion clauses",
  "Governance & Control":
    "governance, voting, transfer, deadlock, exit, and management clauses",
  "Supply & Delivery Controls":
    "delivery, inspection, warranty, risk-transfer, and title clauses",
  "Property Compliance":
    "property use, deposit, maintenance, registration, police verification, and society-compliance clauses",
  "Finance & Security":
    "loan, repayment, security, default, and invocation clauses",
  "Technology Delivery":
    "technology scope, change control, source code, escrow, and support clauses",
  "MOU Positioning":
    "binding-effect, cooperation, scope, and non-binding/binding clauses",
};

const GROUP_ORDER = [
  "Agreement Basics",
  "Termination & Remedies",
  "Jurisdiction & Dispute",
  "Commercial & Tax",
  "Risk Allocation",
  "Optional Protections",
  "Confidentiality & Use",
  "Employment Terms",
  "Consulting Controls",
  "Delivery & Acceptance",
  "Governance & Control",
  "Supply & Delivery Controls",
  "Property Compliance",
  "Finance & Security",
  "Technology Delivery",
  "MOU Positioning",
];

function normalizeText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBlank(value) {
  return value === undefined || value === null || normalizeText(value) === "";
}

function hasMeaningfulValue(value) {
  const normalized = normalizeText(value).toLowerCase();
  return (
    Boolean(normalized) &&
    !["na", "n/a", "none", "nil", "not applicable"].includes(normalized)
  );
}

function parseNumberish(value) {
  if (isBlank(value)) return null;
  const normalized = String(value).replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateForHumans(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value) {
  const numeric = parseNumberish(value);
  if (numeric === null) return normalizeText(value);
  return `INR ${numeric.toLocaleString("en-IN")}`;
}

function humanizeDocumentType(documentType = "") {
  const normalized = String(documentType || "").trim().toUpperCase();
  if (normalized === "NDA" || normalized === "MOU") {
    return normalized;
  }

  return String(documentType || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function humanizeValue(value = "") {
  return normalizeText(value)
    .replace(/\b([A-Z]{2,})\b/g, (match) => match)
    .replace(/\s+/g, " ");
}

function normalizeSubjectPhrase(value = "") {
  return normalizeText(value).replace(/^to\s+/i, "");
}

function buildParticipantDescriptor(participant = {}, variables = {}) {
  const name = normalizeText(participant.name);
  if (!name) return "";

  const explicitType = normalizeText(participant.type);
  const address = normalizeText(participant.address);
  const segments = [name];

  if (explicitType) {
    const article = /^[aeiou]/i.test(explicitType) ? "an" : "a";
    segments.push(`${article} ${explicitType.toLowerCase()}`);
  }

  if (participant.id === "employer" && hasMeaningfulValue(variables.employer_cin)) {
    segments.push(
      `bearing Corporate Identification Number ${normalizeText(variables.employer_cin)}`
    );
  }

  if (participant.id === "employee" && hasMeaningfulValue(variables.employee_pan)) {
    segments.push(`holding PAN ${normalizeText(variables.employee_pan)}`);
  }

  let descriptor = segments.join(", ");
  if (address) {
    descriptor += `, having the address at ${address}`;
  }

  return descriptor;
}

function inferDraftingTarget(fieldName, definition = {}) {
  const key = String(fieldName || "").toLowerCase();
  const group = definition.group;

  if (
    key.endsWith("_name") ||
    key.endsWith("_address") ||
    key.endsWith("_type") ||
    key.endsWith("_cin") ||
    key.endsWith("_pan") ||
    key.endsWith("_gstin")
  ) {
    return "party descriptions, capacity, notice details, and execution blocks";
  }

  if (
    key.includes("purpose") ||
    key.includes("scope") ||
    key.includes("services") ||
    key.includes("deliverables") ||
    key.includes("project_description")
  ) {
    return "recitals, scope, service descriptions, and operative obligations";
  }

  if (
    key.includes("effective_date") ||
    key.includes("term") ||
    key.includes("duration") ||
    key.includes("renewal")
  ) {
    return "commencement, term, renewal, and expiry clauses";
  }

  if (
    key.includes("termination") ||
    key.includes("notice_period") ||
    key.includes("cure_period")
  ) {
    return "termination triggers, notice mechanics, cure periods, and survival language";
  }

  if (
    key.includes("payment") ||
    key.includes("fee") ||
    key.includes("amount") ||
    key.includes("price") ||
    key.includes("salary") ||
    key.includes("rent") ||
    key.includes("interest")
  ) {
    return "consideration, pricing, invoicing, and payment mechanics";
  }

  if (key.includes("gst") || key.includes("tax")) {
    return "tax, GST, and invoice-compliance clauses";
  }

  if (
    key.includes("confidential") ||
    key.includes("permitted_use") ||
    key.includes("residual")
  ) {
    return "confidentiality scope, permitted use, exclusions, and data return/destruction clauses";
  }

  if (key.includes("liability") || key.includes("indemnity")) {
    return "liability caps, indemnity scope, and risk-allocation clauses";
  }

  if (
    key.includes("milestone") ||
    key.includes("acceptance") ||
    key.includes("delivery") ||
    key.includes("inspection") ||
    key.includes("risk_transfer") ||
    key.includes("source_code") ||
    key.includes("change_request") ||
    key.includes("support")
  ) {
    return "performance, delivery, acceptance, support, and completion mechanics";
  }

  if (
    key.includes("board") ||
    key.includes("voting") ||
    key.includes("reserved") ||
    key.includes("dividend") ||
    key.includes("tag_") ||
    key.includes("drag") ||
    key.includes("rofr") ||
    key.includes("deadlock") ||
    key.includes("exit") ||
    key.includes("partner_") ||
    key.includes("management_control")
  ) {
    return "governance, transfer restrictions, management control, and exit clauses";
  }

  if (
    key.includes("loan") ||
    key.includes("repayment") ||
    key.includes("security") ||
    key.includes("guarantee") ||
    key.includes("default") ||
    key.includes("invocation")
  ) {
    return "finance, repayment, security, default, and enforcement clauses";
  }

  if (
    key.includes("property") ||
    key.includes("lease") ||
    key.includes("license") ||
    key.includes("deposit") ||
    key.includes("maintenance") ||
    key.includes("society") ||
    key.includes("police")
  ) {
    return "property use, possession, deposits, maintenance, and compliance clauses";
  }

  if (key.includes("binding_nature") || key.startsWith("mou_")) {
    return "binding-effect, scope, cooperation, and MOU positioning clauses";
  }

  return (
    GROUP_TARGETS[group] ||
    "the clause family that best matches the legal meaning of this input"
  );
}

function normalizeInsightValue(fieldName, definition = {}, value) {
  if (definition.type === "date") {
    return formatDateForHumans(value);
  }

  if (
    definition.type === "number" &&
    /(amount|fee|value|price|salary|rent|deposit|loan|instalment)/i.test(
      fieldName
    )
  ) {
    return formatCurrency(value);
  }

  if (definition.type === "number") {
    const numeric = parseNumberish(value);
    return numeric === null ? normalizeText(value) : String(numeric);
  }

  return humanizeValue(value);
}

function buildFieldInsights(documentType, variables = {}) {
  const schema = getVariables(documentType);

  return Object.entries(variables || {})
    .filter(([key, value]) => !isBlank(value) && schema[key])
    .map(([key, value]) => {
      const definition = schema[key];
      return {
        key,
        label: definition.label || key,
        group: definition.group || "Additional Details",
        value: normalizeInsightValue(key, definition, value),
        draftingTarget: inferDraftingTarget(key, definition),
      };
    })
    .sort((left, right) => {
      const leftIndex = GROUP_ORDER.indexOf(left.group);
      const rightIndex = GROUP_ORDER.indexOf(right.group);
      const safeLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const safeRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return (
        safeLeft - safeRight ||
        left.group.localeCompare(right.group) ||
        left.label.localeCompare(right.label)
      );
    });
}

function buildClauseGuidance(fieldInsights = []) {
  const grouped = new Map();

  for (const insight of fieldInsights) {
    const group = insight.group || "Additional Details";
    if (!grouped.has(group)) {
      grouped.set(group, []);
    }

    grouped.get(group).push(insight.label);
  }

  return [...grouped.entries()].map(([group, labels]) => ({
    section: group,
    guidance: `Use ${labels.join(", ")} in ${GROUP_TARGETS[group] || "the matching operative clauses"}.`,
  }));
}

function buildParticipantFacts(documentType, variables = {}) {
  return getParticipantExpectations(documentType, variables).map((participant) => ({
    ...participant,
    descriptor: buildParticipantDescriptor(participant, variables),
  }));
}

function pickFirstMeaningful(variables = {}, keys = []) {
  for (const key of keys) {
    if (hasMeaningfulValue(variables[key])) {
      return normalizeText(variables[key]);
    }
  }

  return "";
}

function buildObjectiveSummary(documentType, variables = {}, roleContext = {}) {
  const friendlyType = humanizeDocumentType(documentType);
  const parties = roleContext.namedParties || {};
  const subject =
    normalizeSubjectPhrase(
      pickFirstMeaningful(variables, [
      "purpose",
      "mou_purpose",
      "business_purpose",
      "jv_purpose",
      "services_description",
      "consulting_services",
      "project_description",
      "goods_description",
      "product_description",
      "property_description",
      "permitted_use",
      ])
    ) || "the commercial relationship and obligations contemplated by the parties";

  return `This ${friendlyType} should read as a coherent Indian legal document in connection with ${subject}, with ${parties.first || "the first party"} and ${parties.second || "the second party"} described consistently in their correct legal capacities.`;
}

function buildTermSummary(variables = {}) {
  const statements = [];
  const effectiveDate = formatDateForHumans(variables.effective_date);
  const duration = pickFirstMeaningful(variables, [
    "agreement_term",
    "contract_duration",
    "jv_duration",
    "mou_duration",
    "guarantee_period",
  ]);
  const leaseTerm = parseNumberish(variables.lease_term);
  const licenseTerm = parseNumberish(variables.license_term);
  const renewal = pickFirstMeaningful(variables, [
    "renewal_option",
    "renewal_terms",
  ]);
  const noticeDays = parseNumberish(variables.termination_notice_period);
  const cureDays = parseNumberish(variables.cure_period_days);

  if (effectiveDate) {
    statements.push(`Effective date: ${effectiveDate}.`);
  }

  if (duration) {
    statements.push(`Intended duration: ${duration}.`);
  } else if (leaseTerm) {
    statements.push(`Lease term: ${leaseTerm} months.`);
  } else if (licenseTerm) {
    statements.push(`License period: ${licenseTerm} months.`);
  }

  if (renewal) {
    statements.push(`Renewal position: ${renewal}.`);
  }

  if (noticeDays) {
    statements.push(`Termination notice: ${noticeDays} days.`);
  }

  if (cureDays) {
    statements.push(`Cure period for remediable breach: ${cureDays} days.`);
  }

  return statements.join(" ");
}

function buildCommercialSummary(documentType, variables = {}, roleContext = {}) {
  const payer = roleContext?.payer?.label || "the paying party";
  const payee = roleContext?.payee?.label || "the receiving party";
  const amount = pickFirstMeaningful(variables, [
    "contract_value",
    "consulting_fee",
    "salary",
    "price",
    "rent_amount",
    "license_fee",
    "loan_amount",
    "guaranteed_amount",
    "total_fee",
    "instalment_amount",
  ]);
  const paymentTerms = pickFirstMeaningful(variables, ["payment_terms", "repayment_schedule"]);
  const gstRate = pickFirstMeaningful(variables, ["gst_rate"]);
  const gstApplicable = pickFirstMeaningful(variables, ["gst_applicable"]);
  const expenses = pickFirstMeaningful(variables, ["expenses_policy", "tax_responsibility"]);

  const statements = [];
  if (amount) {
    const formattedAmount =
      /salary|loan|rent|license|guaranteed|fee|value|price|instalment/i.test(amount)
        ? amount
        : formatCurrency(amount);
    statements.push(
      `Primary commercial amount: ${formatCurrency(amount) || amount}, payable by ${payer} to ${payee} where context requires.`
    );
  }

  if (paymentTerms) {
    statements.push(`Payment mechanics: ${paymentTerms}.`);
  }

  if (gstApplicable || gstRate) {
    const taxLine = [
      gstApplicable ? `GST applicability: ${gstApplicable}` : null,
      gstRate ? `GST rate: ${gstRate}%` : null,
    ]
      .filter(Boolean)
      .join("; ");
    statements.push(`${taxLine}.`);
  }

  if (expenses) {
    statements.push(`Expense/tax allocation: ${expenses}.`);
  }

  return statements.join(" ");
}

function buildRiskSummary(variables = {}) {
  const statements = [];
  const confidentiality = pickFirstMeaningful(variables, [
    "confidentiality_access_scope",
    "employee_confidentiality_scope",
  ]);
  const exclusions = pickFirstMeaningful(variables, ["confidentiality_exclusions"]);
  const permittedUse = pickFirstMeaningful(variables, ["permitted_use"]);
  const residual = pickFirstMeaningful(variables, ["residual_knowledge_treatment"]);
  const liability = pickFirstMeaningful(variables, [
    "liability_cap_basis",
    "liability_cap_amount",
  ]);
  const indemnity = pickFirstMeaningful(variables, ["indemnity_scope"]);
  const ip = pickFirstMeaningful(variables, ["ip_ownership"]);

  if (confidentiality) {
    statements.push(`Confidential information access control: ${confidentiality}.`);
  }
  if (exclusions) {
    statements.push(`Confidentiality exclusions: ${exclusions}.`);
  }
  if (permittedUse) {
    statements.push(`Permitted use: ${permittedUse}.`);
  }
  if (residual) {
    statements.push(`Residual knowledge position: ${residual}.`);
  }
  if (liability) {
    statements.push(`Liability cap position: ${liability}.`);
  }
  if (indemnity) {
    statements.push(`Indemnity scope: ${indemnity}.`);
  }
  if (ip) {
    statements.push(`IP ownership position: ${ip}.`);
  }

  return statements.join(" ");
}

function buildOperationalSummary(variables = {}) {
  const statements = [];
  const services = pickFirstMeaningful(variables, [
    "services_description",
    "consulting_services",
    "project_description",
    "goods_description",
    "product_description",
  ]);
  const deliverables = pickFirstMeaningful(variables, ["deliverables"]);
  const acceptance = pickFirstMeaningful(variables, ["acceptance_criteria"]);
  const milestones = pickFirstMeaningful(variables, ["milestone_plan"]);
  const support = pickFirstMeaningful(variables, ["support_maintenance"]);
  const delivery = pickFirstMeaningful(variables, [
    "delivery_terms",
    "delivery_location",
  ]);
  const inspection = pickFirstMeaningful(variables, [
    "inspection_acceptance_terms",
    "inspection_timeline_days",
  ]);
  const sourceCode = pickFirstMeaningful(variables, ["source_code_delivery"]);
  const changeControl = pickFirstMeaningful(variables, ["change_request_process"]);

  if (services) statements.push(`Core scope: ${services}.`);
  if (deliverables) statements.push(`Deliverables: ${deliverables}.`);
  if (acceptance) statements.push(`Acceptance standard: ${acceptance}.`);
  if (milestones) statements.push(`Milestone structure: ${milestones}.`);
  if (support) statements.push(`Support/maintenance: ${support}.`);
  if (delivery) statements.push(`Delivery arrangement: ${delivery}.`);
  if (inspection) statements.push(`Inspection/acceptance mechanics: ${inspection}.`);
  if (sourceCode) statements.push(`Source-code delivery: ${sourceCode}.`);
  if (changeControl) statements.push(`Change control: ${changeControl}.`);

  return statements.join(" ");
}

function buildGovernanceSummary(variables = {}) {
  const statements = [];
  const board = pickFirstMeaningful(variables, ["board_structure"]);
  const reserved = pickFirstMeaningful(variables, ["reserved_matters"]);
  const voting = pickFirstMeaningful(variables, ["voting_rights"]);
  const dividends = pickFirstMeaningful(variables, ["dividend_policy"]);
  const deadlock = pickFirstMeaningful(variables, ["deadlock_resolution"]);
  const exit = pickFirstMeaningful(variables, [
    "exit_rights",
    "exit_terms",
    "partner_exit_mechanism",
  ]);

  if (board) statements.push(`Governance body: ${board}.`);
  if (reserved) statements.push(`Reserved matters: ${reserved}.`);
  if (voting) statements.push(`Voting rights: ${voting}.`);
  if (dividends) statements.push(`Dividend/economic rights: ${dividends}.`);
  if (deadlock) statements.push(`Deadlock handling: ${deadlock}.`);
  if (exit) statements.push(`Exit or separation mechanics: ${exit}.`);

  return statements.join(" ");
}

function buildDraftingDirectives(context = {}) {
  const directives = [
    "Treat the intake as instructions about legal meaning and clause placement, not as placeholder text to paste mechanically.",
  ];
  const style = context.style || {};

  if (style.openingStyle === "formal_execution_block") {
    directives.push(
      "Use a formal document opening with a clear title, an execution line stating place and date where supported by the intake, and a properly introduced party block before the operative clauses."
    );
  }

  if (style.recitalStyle === "whereas_recitals") {
    directives.push(
      "Use concise but meaningful recitals where appropriate so the factual background and commercial purpose are clear before the operative clauses begin."
    );
  }

  if (style.bodyStyle === "substantive_numbered_clauses") {
    directives.push(
      "Draft substantive numbered clauses with enough legal detail to feel complete and transaction-ready, instead of producing skeletal one-line clauses."
    );
  }

  if (style.preferDefinitions) {
    directives.push(
      "Where the document type or clause structure supports it, define key business and legal terms before relying on those terms later in the document."
    );
  }

  if (style.preferSchedules) {
    directives.push(
      "Where the intake contains specifications, deliverable lists, payment breakups, technical requirements, or compliance details, present them in structured schedule-style language or clearly itemized subparts."
    );
  }

  if (style.preferDetailedExecution) {
    directives.push(
      "Use a complete execution block with proper signatory language, capacity references, and signature placeholders suited to the parties' legal form."
    );
  }

  if ((context.participants || []).length >= 2) {
    directives.push(
      "Introduce the parties once in full legal style, then keep their role labels and naming consistent throughout the document."
    );
  }

  if (context.term?.summary) {
    directives.push(
      "Reflect commencement, duration, renewal, and termination mechanics in the term and termination clauses rather than scattering them randomly."
    );
  }

  if (context.commercial?.summary) {
    directives.push(
      "Translate commercial numbers into clear payment, invoicing, tax, and consideration mechanics."
    );
  }

  if (context.risk?.summary) {
    directives.push(
      "Place confidentiality, IP, liability, and indemnity facts in the correct risk-allocation clauses and keep their wording internally consistent."
    );
  }

  if (context.operational?.summary) {
    directives.push(
      "Express scope, deliverables, milestones, acceptance, and support as operative obligations with clear completion logic."
    );
  }

  if (context.governance?.summary) {
    directives.push(
      "Draft governance, transfer, deadlock, and exit rights as enforceable control mechanics, not as loose commercial notes."
    );
  }

  return directives;
}

export function buildSemanticContext(documentType, variables = {}) {
  const roleContext = getDocumentRoleContext(documentType);
  const policy = getDocumentDraftingPolicy(documentType);
  const fieldInsights = buildFieldInsights(documentType, variables);
  const participants = buildParticipantFacts(documentType, variables);
  const termSummary = buildTermSummary(variables);
  const commercialSummary = buildCommercialSummary(documentType, variables, roleContext);
  const riskSummary = buildRiskSummary(variables);
  const operationalSummary = buildOperationalSummary(variables);
  const governanceSummary = buildGovernanceSummary(variables);

  return {
    document_type: documentType,
    objective_summary: buildObjectiveSummary(documentType, variables, roleContext),
    participants,
    style_preferences: policy?.style || {},
    term: {
      summary: termSummary,
    },
    commercial: {
      summary: commercialSummary,
    },
    risk: {
      summary: riskSummary,
    },
    operational: {
      summary: operationalSummary,
    },
    governance: {
      summary: governanceSummary,
    },
    clause_guidance: buildClauseGuidance(fieldInsights),
    field_insights: fieldInsights,
    drafting_directives: buildDraftingDirectives({
      style: policy?.style || {},
      participants,
      term: { summary: termSummary },
      commercial: { summary: commercialSummary },
      risk: { summary: riskSummary },
      operational: { summary: operationalSummary },
      governance: { summary: governanceSummary },
    }),
  };
}
