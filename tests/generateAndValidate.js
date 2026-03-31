import { DOCUMENT_CONFIG } from "../backend/config/documentConfig.js";
import { getVariables } from "../backend/config/variableConfig.js";
import { buildDocumentSections } from "../backend/services/documentIntakeConfig.js";
import { generateDocument } from "../backend/services/documentService.js";
import { getDisallowedProtections } from "../backend/services/documentHardening.js";

function pickOption(options = [], fallback = "") {
  if (!Array.isArray(options) || options.length === 0) return fallback;
  return options.find((option) => !/^na$/i.test(String(option).trim())) || options[0];
}

function sampleValue(documentType, field, definition = {}) {
  const lower = field.toLowerCase();
  const type = definition.type || "text";
  const exact = {
    effective_date: "2026-06-10",
    start_date: "2026-07-01",
    delivery_date: "2026-09-15",
    repayment_start_date: "2026-08-01",
    arbitration_city: "Mumbai",
    governing_law_state: "Maharashtra",
    operating_state: "Maharashtra",
    party_1_name: "AlphaTech Solutions Private Limited",
    party_2_name: "Beta Innovations Private Limited",
    party_1_address:
      "702 Business Tower, Bandra Kurla Complex, Mumbai, Maharashtra 400051",
    party_2_address:
      "301 Tech Park, Hinjewadi Phase 2, Pune, Maharashtra 411057",
    party_1_type: "Private Limited Company",
    party_2_type: "Private Limited Company",
    employer_name: "Northstar Systems Private Limited",
    employer_address: "14 Corporate Avenue, Bengaluru, Karnataka 560001",
    employer_cin: "U72200KA2020PTC123456",
    employee_name: "Riya Sharma",
    employee_address: "22 Lake View Residency, Pune, Maharashtra 411014",
    employee_pan: "ABCDE1234F",
    partner_1_name: "Arjun Mehta",
    partner_1_address: "19 Sunrise Apartments, Ahmedabad, Gujarat 380015",
    partner_2_name: "Neha Kapoor",
    partner_2_address: "44 Green Enclave, Jaipur, Rajasthan 302019",
    shareholder_1_name: "Apex Ventures LLP",
    shareholder_1_address: "11 Capital House, Nariman Point, Mumbai 400021",
    shareholder_2_name: "Blue River Holdings Private Limited",
    shareholder_2_address: "88 Residency Road, Bengaluru, Karnataka 560025",
    shareholder_1_type: "LLP",
    shareholder_2_type: "Private Limited Company",
    company_name: "Vertex Labs Private Limited",
    company_cin: "U72900MH2021PTC654321",
    company_address: "5 Innovation Plaza, Powai, Mumbai 400076",
    jv_name: "Helios Mobility Ventures",
    partnership_name: "Cedar Advisory Partners",
    business_address: "23 Market Road, Chennai, Tamil Nadu 600002",
    business_purpose:
      "to operate a lawful consulting and advisory practice in India",
    jv_purpose:
      "to develop and commercialize electric mobility solutions in India",
    profit_sharing_ratio: "50:50",
    capital_contribution_1: "2500000",
    capital_contribution_2: "2500000",
    shareholding_percentage_1: "60",
    shareholding_percentage_2: "40",
    board_structure: "A five-member board with proportional nomination rights",
    reserved_matters:
      "issuance of securities, borrowing above threshold, related party transactions",
    rofr_period: "30",
    drag_threshold: "75",
    goods_description: "industrial automation components and control panels",
    product_description: "cloud-enabled diagnostic devices for hospitals",
    territory: "India",
    exclusivity: "Non-Exclusive",
    min_purchase: "100 units per quarter",
    price_terms:
      "Uniform distributor transfer pricing agreed in writing, exclusive of GST",
    payment_terms: "50% advance and balance within 30 days of invoice",
    delivery_terms: "FOB Mumbai with delivery within 15 business days",
    delivery_location: "Mumbai, Maharashtra",
    warranty_period: "12 months",
    contract_duration: "24 months",
    consulting_services:
      "strategic business, compliance, and operational advisory services",
    services_description:
      "software development, implementation, training, and support services",
    deliverables:
      "source code, documentation, deployment support, and training materials",
    contract_value: "1200000",
    consulting_fee: "300000",
    job_title: "Senior Product Analyst",
    department: "Product Strategy",
    work_location: "Bengaluru, Karnataka",
    salary: "1800000",
    salary_components: "Basic 40%, HRA 20%, Special Allowance 40%",
    probation_period: "6 months",
    working_hours: "40",
    notice_period_days: "60",
    party_1_gstin: "27ABCDE1234F1Z5",
    party_2_gstin: "29ABCDE1234F1Z5",
    price: "850000",
    quantity: "100",
    gst_rate: "18",
    property_address: "18 Commerce Street, Lower Parel, Mumbai 400013",
    property_description:
      "a fully furnished commercial office premises admeasuring 2500 square feet",
    rent_amount: "150000",
    license_fee: "90000",
    security_deposit: "450000",
    lease_term: "36",
    license_term: "11",
    permitted_use: "lawful office and administrative use",
    rent_escalation: "5",
    lock_in_period: "6",
    maintenance_party: "Split equally",
    loan_amount: "5000000",
    interest_rate: "12",
    repayment_schedule: "24 equal monthly instalments",
    security_collateral: "a first ranking charge over receivables and equipment",
    prepayment_terms: "Permitted with 30 days prior written notice",
    default_interest_rate: "18",
    guaranteed_amount: "5000000",
    guarantor_name: "Sanjay Rao",
    guarantor_address: "9 Orchard Lane, Hyderabad, Telangana 500081",
    guarantor_type: "Individual",
    guarantee_type: "Continuing Guarantee",
    guarantee_period: "36 months",
    project_description:
      "design and development of a multi-tenant SaaS operations platform",
    total_fee: "2400000",
    tech_stack: "React, Node.js, PostgreSQL, and AWS",
    escrow_required: "No",
    ip_ownership: "Client owns all IP",
    purpose:
      "to evaluate and pursue a confidential strategic technology partnership",
    confidentiality_period: "5 years",
    agreement_term: "24 months",
    non_compete_period: "12 months",
    mou_purpose:
      "to collaborate on an AI-powered telemedicine platform for rural healthcare delivery",
    mou_scope:
      "Party 1 will provide domain expertise and validation while Party 2 will provide technology, implementation, and go-to-market support",
    mou_duration: "18 months",
    organisation_address: "88 Residency Road, Bengaluru, Karnataka 560025",
  };

  if (Object.prototype.hasOwnProperty.call(exact, field)) {
    return exact[field];
  }

  if (type === "select") return pickOption(definition.options, "Yes");
  if (type === "date") return "2026-06-10";
  if (type === "number") return "100000";
  if (lower.includes("address")) {
    return "101 Sample Street, Mumbai, Maharashtra 400001";
  }
  if (lower.includes("city")) return "Mumbai";
  if (lower.includes("state")) return "Maharashtra";
  if (lower.includes("name")) return `${documentType} Sample Name`;
  if (lower.includes("purpose")) {
    return "for a lawful commercial relationship under Indian law";
  }
  if (
    lower.includes("duration") ||
    lower.includes("term") ||
    lower.includes("period")
  ) {
    return "12 months";
  }
  if (lower.includes("rate")) return "18%";
  if (
    lower.includes("amount") ||
    lower.includes("fee") ||
    lower.includes("value") ||
    lower.includes("salary") ||
    lower.includes("price")
  ) {
    return "100000";
  }

  return `Sample ${field.replace(/_/g, " ")}`;
}

function buildVariables(documentType) {
  const visibleFieldNames = new Set(
    buildDocumentSections(documentType)
      .flatMap((section) => section.fields || [])
      .map((field) => field.name)
  );

  return Object.fromEntries(
    Object.entries(getVariables(documentType))
      .filter(([field]) => visibleFieldNames.has(field))
      .map(([field, definition]) => [
        field,
        sampleValue(documentType, field, definition),
      ])
  );
}

async function runTests() {
  const results = [];
  const schedulePattern =
    /\b(?:specified|set out|described|contained|included|recorded)\s+in\s+(?:the\s+)?(?:schedule|annexure|appendix)\s*[a-z0-9-]*\b|\b(?:schedule|annexure|appendix)\s+(?:[0-9]+|[A-Z]|[IVXLCM]+)\b/i;

  for (const documentType of Object.keys(DOCUMENT_CONFIG)) {
    const result = await generateDocument({
      document_type: documentType,
      jurisdiction: "India",
      variables: buildVariables(documentType),
    });
    const clauses = result?.draft?.clauses || [];
    const scheduleRefs = clauses
      .filter((clause) => schedulePattern.test(clause.text || ""))
      .map((clause) => clause.clause_id);
    const disallowedProtections = getDisallowedProtections(documentType);
    const disallowedGenericClauses = clauses
      .filter((clause) => {
        const clauseId = String(clause?.clause_id || "");
        return (
          (disallowedProtections.has("LIABILITY_CAP") &&
            (clauseId === "AUTO-LIAB-001" || clauseId === "CORE_LIABILITY_CAP_001")) ||
          (disallowedProtections.has("INDEMNITY") &&
            (clauseId === "AUTO-INDEM-001" || clauseId === "CORE_INDEMNITY_001")) ||
          (disallowedProtections.has("FORCE_MAJEURE") &&
            (clauseId === "AUTO-FM-001" || clauseId === "CORE_FORCE_MAJEURE_001"))
        );
      })
      .map((clause) => clause.clause_id);

    results.push({
      documentType,
      hasDraft: Boolean(result?.draft),
      statusCode: result?.statusCode || 200,
      certified: result?.validation?.certified ?? null,
      risk: result?.validation?.risk ?? null,
      totalIssues: result?.validation?.summary?.total ?? null,
      blockingIssues: (result?.validation?.blockingIssues || []).map(
        (issue) => issue.rule_id
      ),
      advisoryIssues: (result?.validation?.advisoryIssues || []).map(
        (issue) => issue.rule_id
      ),
      notices: (result?.validation?.notices || []).map(
        (issue) => issue.rule_id
      ),
      scheduleRefs,
      disallowedGenericClauses,
      error: result?.error || null,
    });
  }

  console.log(JSON.stringify(results, null, 2));

  const failures = results.filter(
    (result) =>
      !result.hasDraft ||
      result.totalIssues !== 0 ||
      result.scheduleRefs.length > 0 ||
      result.disallowedGenericClauses.length > 0
  );

  if (failures.length > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
