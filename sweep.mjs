import fs from "fs";
import { DOCUMENT_TYPE_REGISTRY } from "./shared/documentRegistry.js";
import { VARIABLE_CONFIG } from "./backend/config/variableConfig.js";
import { generateDocument } from "./backend/services/documentService.js";
import { gstinChecksum } from "./backend/services/partyIdentityValidator.js";

// Numeric samples are DERIVED from the plausibility bounds rather than guessed,
// so the fixture cannot drift away from what the validator will accept. A single
// shared "500000" across every numeric field is what made an earlier review read
// the fixture as evidence of cross-template contamination in the generator.
const NUMERIC_BOUNDS = JSON.parse(
  fs.readFileSync(new URL("./knowledge-base/rules/numeric_bounds.rules.json", import.meta.url), "utf8")
);

// A value inside every band the field declares: above each floor, below each
// ceiling, and a whole number where the field counts things.
function sampleWithinBounds(field) {
  const spec = NUMERIC_BOUNDS.fields?.[field];
  if (!spec) return null;
  if (Array.isArray(spec.allowed) && spec.allowed.length) return String(spec.allowed[spec.allowed.length - 1]);

  const floor = Math.max(
    Number.isFinite(spec.impossible?.min) ? spec.impossible.min : -Infinity,
    Number.isFinite(spec.implausible?.min) ? spec.implausible.min : -Infinity,
    Number.isFinite(spec.statutory?.min) ? spec.statutory.min : -Infinity
  );
  const ceiling = Math.min(
    Number.isFinite(spec.impossible?.max) ? spec.impossible.max : Infinity,
    Number.isFinite(spec.implausible?.max) ? spec.implausible.max : Infinity,
    Number.isFinite(spec.statutory?.max) ? spec.statutory.max : Infinity
  );

  const low = Number.isFinite(floor) ? floor : 1;
  const high = Number.isFinite(ceiling) ? ceiling : low * 10;
  // Sit near the bottom of the band rather than the middle: a mid-point between
  // 1 and a trillion is not a figure any real agreement carries.
  let value = Math.min(high, Math.max(low, low > 0 ? low * 3 : 3));
  if (!(value >= low && value <= high)) value = (low + high) / 2;
  if (spec.impossible?.integer) value = Math.round(value);
  return String(Number.isInteger(value) ? value : Number(value.toFixed(2)));
}

// One coherent identity per party slot: the PAN holder code matches the entity
// the slot is named after, and the GSTIN embeds that PAN and carries a real
// check digit. Sharing one PAN across parties is itself a blocking defect.
function gstinFor(stateCode, pan) {
  const body = `${stateCode}${pan}1Z`;
  return `${body}${gstinChecksum(`${body}0`)}`;
}

const PARTY_PANS = ["AAACA1234C", "AABFB2345F", "AAACG3456C"];
const PERSON_PANS = ["ABCPK1234P", "ABDPL2345P", "ABEPM3456P"];
const PARTY_CINS = [
  "U74999MH2015PTC123456",
  "U72900MH2018PTC234567",
  "U65999MH2020PTC345678",
];
const PARTY_LLPINS = ["AAB-1234", "AAC-2345", "AAD-3456"];

// Fill every declared field with a plausible value of the right shape, so a
// blocked result means a real defect rather than a lazy fixture.
const SAMPLES = {
  name: "Alpha Industries Private Limited",
  address: "1 First Road, Mumbai, Maharashtra 400001",
  email: "contact@alpha.example",
  url: "https://alpha.example",
  city: "Pune",
  state: "Maharashtra",
  date: "2026-09-01",
};

// Per-field fixture answers. Every free-text field gets its own, so a rendered
// sample can never read as one document's content leaking into another. The old
// single fallback made an external review report cross-template contamination
// that did not exist in the generator.
const FIELD_SAMPLES = {
  // ── Notices, sworn instruments and settlements ──
  admitted_facts:
    "That an agreement dated 12 March 2026 was entered into between the parties, and that two consignments were delivered under it.",
  denied_facts:
    "That any consignment was defective, that any complaint was made within the contractual window, and that any sum remains due.",
  reply_facts:
    "The goods were inspected on delivery and accepted without protest. The first complaint was made four months later, after the contractual inspection window had closed, and only once payment fell due.",
  notice_facts:
    "1. By an agreement dated 12 March 2026 my client agreed to supply goods to you on thirty days' credit.\n2. My client delivered the goods on 5 May 2026 and raised invoice 44/2026 for Rs. 4,50,000 on the same day.\n3. You acknowledged receipt of the goods in writing on 6 May 2026 and raised no complaint.\n4. The invoice fell due on 4 June 2026 and remains wholly unpaid.",
  breached_obligation:
    "clause 6 of the agreement dated 12 March 2026, which requires payment within thirty days of a valid tax invoice",
  loss_description:
    "the loss of the use of Rs. 4,50,000 since 4 June 2026, and the cost of financing the shortfall in working capital",
  notice_demand:
    "pay my client Rs. 4,50,000 towards invoice 44/2026, together with interest at 12 per cent per annum from 4 June 2026 to the date of payment",
  notice_demand_summary: "PAY Rs. 4,50,000 DUE UNDER INVOICE 44/2026",
  cheque_number: "004521",
  cheque_amount_words: "Rupees Four Lakh Fifty Thousand",
  drawee_bank: "HDFC Bank Limited",
  drawee_branch: "Camp Branch, Pune",
  payee_bank: "State Bank of India",
  payee_branch: "Deccan Gymkhana Branch, Pune",
  return_reason: "Funds Insufficient",
  underlying_liability:
    "the price of stainless steel kitchen equipment supplied under invoice 44/2026 dated 5 May 2026",
  original_notice_reference: "AKS/2026/318",
  underlying_agreement_description:
    "the Supply Agreement for stainless steel kitchen equipment",
  arbitration_clause_number: "18.2",
  disputes_description:
    "whether the consignment delivered on 5 May 2026 conformed to the agreed specification, whether the sum of Rs. 4,50,000 is due, and whether the agreement was validly terminated on 20 July 2026.",
  claims_description:
    "Rs. 4,50,000 as the price of goods sold and delivered, interest at 12 per cent per annum from 4 June 2026, and the costs of the arbitration.",
  dispute_description:
    "the quality of goods supplied under invoice 44/2026 and the sum said to be due for them",
  proceedings_description:
    "Commercial Suit 214 of 2026, pending before the Commercial Court at Pune",
  settlement_amount_words: "Rupees Three Lakh",
  settlement_payment_schedule:
    "in three equal monthly instalments, the first falling due thirty days after this Agreement",
  affidavit_purpose:
    "filing before the Registrar of Companies in support of an application for the change of registered office",
  deponent_id_number: "4213 8867 1290",
  obligor_description:
    "a company incorporated under the Companies Act, 2013 and having its registered office at the address below",
  beneficiary_description:
    "a company incorporated under the Companies Act, 2013 and having its registered office at the address below",
  bond_occasion:
    "The Beneficiary has been asked to release consignment 44/2026 from its warehouse without production of the original delivery order, the original having been lost in transit.",
  indemnified_risk:
    "the release of consignment 44/2026 without production of the original delivery order, including any claim brought by a person presenting that original at a later date",
  acceptance_criteria:
    "Each deliverable is accepted when it passes the agreed test cases in a staging environment and acceptance is confirmed in writing within ten working days of delivery.",
  additional_protection_clauses:
    "A twelve-month non-solicitation of the disclosing party's employees and a prohibition on reverse engineering any disclosed prototype.",
  assigned_work_description:
    "The source code, database schema, user interface designs and technical documentation of the inventory management application developed by the Assignor between January and July 2026.",
  audit_rights:
    "Compliance may be audited once in any twelve-month period, on fifteen days' written notice, during business hours and at the auditing party's own cost.",
  board_structure:
    "A board of five directors: two nominated by the promoters, one by the incoming subscriber, and two independent directors appointed by mutual agreement.",
  branding_rights:
    "The word mark and logo may be used solely on packaging, point-of-sale material and the receiving party's website, in the form supplied and without alteration.",
  business_purpose:
    "Designing and operating a subscription-based inventory management platform for small and medium retailers.",
  change_request_process:
    "Either party may raise a written change request; no change takes effect until both parties have signed a change note recording the revised scope, price and timeline.",
  confidential_information_definition:
    "Client lists, pricing models, unreleased product designs, source code, financial statements and any material marked confidential at the time of disclosure.",
  confidentiality_access_scope:
    "Only those directors, employees and professional advisers of the receiving party who need the information for the Purpose and are bound by equivalent obligations.",
  confidentiality_exclusions:
    "Information already in the public domain otherwise than by breach, independently developed without reference to the disclosure, or required to be disclosed by law or by a court of competent jurisdiction.",
  consultant_availability:
    "Up to sixty hours a month, ordinarily between 10:00 a.m. and 6:00 p.m. on working days, with the schedule agreed a week in advance.",
  consulting_services:
    "Reviewing the go-to-market strategy, preparing a quarterly market analysis and advising the board on pricing.",
  data_categories:
    "Name, email address, telephone number, delivery address, order history and payment reference numbers of end customers.",
  deadlock_resolution:
    "A deadlock is first referred to the chief executives of each party for thirty days; failing resolution, either party may issue a buy-sell notice at a stated price per share.",
  decision_making_rules:
    "Ordinary business is decided by simple majority of the board; the reserved matters require the affirmative vote of the nominee director.",
  delay_remedies:
    "A service credit of two per cent of the monthly fee for each full day of delay, capped at fifteen per cent of the monthly fee.",
  deliverables:
    "A working web application, its source code repository, deployment scripts, administrator documentation and two training sessions for operational staff.",
  department: "Product Engineering",
  dividend_policy:
    "No dividend is to be declared for the first three financial years; thereafter the board may recommend a dividend of up to thirty per cent of distributable profits.",
  employee_confidentiality_scope:
    "All client data, source code, commercial terms and internal financial information accessed in the course of employment, during and after the term.",
  events_of_default:
    "Failure to pay an instalment within fifteen days of its due date, the commencement of insolvency proceedings, or any material misstatement in the information supplied to obtain the facility.",
  exercise_window:
    "Ninety days from the date of vesting, or until the date the option lapses under the Scheme, whichever is earlier.",
  exit_rights:
    "A listing or trade sale may be required after five years, with a tag-along right on any transfer by the promoters.",
  expenses_policy:
    "Travel, accommodation and client entertainment approved in advance, reimbursed against original receipts within thirty days of a claim.",
  founder_equity_split:
    "Sixty per cent to the first Founder and forty per cent to the second Founder, in each case vesting monthly over four years with a twelve-month cliff.",
  founder_roles:
    "The first Founder is responsible for product and engineering; the second Founder is responsible for sales, finance and compliance.",
  goods_description:
    "Stainless steel commercial kitchen equipment: 1800mm x 600mm work tables, four-tier storage racks and 300-litre undercounter refrigeration units, all in 304-grade brushed finish.",
  goods_or_services_description:
    "Subscription access to a cloud-hosted inventory management platform, with onboarding, data migration and email support.",
  grievance_officer: "Priya Menon",
  information_rights:
    "Monthly management accounts within twenty-one days of month end, audited accounts within ninety days of the financial year end, and an annual budget before the year begins.",
  invocation_conditions:
    "The Guarantee may be invoked only after a sum that has fallen due remains unpaid and that failure has not been cured within fifteen days of written demand.",
  invocation_procedure:
    "A written demand delivered to the registered address, stating the amount claimed and enclosing a certified statement of account.",
  ip_ownership:
    "All intellectual property created in performing this Agreement vests in the commissioning party on full payment; each party retains its own pre-existing tools and libraries and grants the other a perpetual, non-exclusive licence to use them so far as they are embedded in what is delivered.",
  job_title: "Senior Software Engineer",
  jv_purpose:
    "Jointly developing and operating a network of cold storage facilities across Maharashtra and Gujarat.",
  jv_structure:
    "A private limited company incorporated in India, held sixty per cent by the first party and forty per cent by the second.",
  learning_objectives:
    "Exposure to production software development practices, code review, testing and release management, under the supervision of a named mentor.",
  leave_policy:
    "Eighteen days of earned leave and eight days of casual leave in a calendar year, in addition to the public holidays notified each year.",
  management_control:
    "Day-to-day management vests in a chief executive appointed by the first party; the second party appoints the chief financial officer.",
  milestone_plan:
    "Discovery and design by 30 September 2026; a working beta by 15 December 2026; production release and handover by 28 February 2027.",
  min_purchase:
    "Goods to the value of Rs. 25,00,000 in each contract year, measured on invoiced value net of returns.",
  mou_purpose:
    "Recording the parties' shared intention to explore a joint distribution arrangement for their respective products in southern India.",
  mou_scope:
    "Exchanging market data, running a three-month pilot in two cities, and negotiating in good faith towards a definitive agreement.",
  partner_dispute_resolution:
    "A dispute between partners is first referred to a meeting of all partners; failing agreement within thirty days, to a sole arbitrator appointed by mutual consent.",
  partner_exit_mechanism:
    "A retiring partner gives ninety days' written notice; the continuing partners buy the outgoing share at a value certified by the firm's auditor.",
  partner_roles:
    "The first Partner manages procurement and supplier relationships; the second Partner manages accounts, statutory compliance and banking.",
  party_1_authority_reference:
    "Board resolution dated 12 August 2026, a certified copy of which is annexed to this Agreement.",
  party_2_authority_reference:
    "Board resolution dated 14 August 2026, a certified copy of which is annexed to this Agreement.",
  permitted_use:
    "Evaluating whether to enter into a commercial supply arrangement with the disclosing party, and for no other purpose.",
  posh_committee_contact: "ic@alpha.example",
  posh_district: "Pune",
  posh_external_member: "Advocate Meera Joshi, Pune District Legal Services Authority panel",
  posh_presiding_officer: "Anjali Rane, Vice President - Operations",
  powers_granted:
    "To operate the principal's bank account numbered 001234567890 at the Pune branch, to sign cheques on it up to Rs. 5,00,000, and to file and receive documents from the Registrar of Companies.",
  processing_purpose:
    "Fulfilling customer orders, issuing invoices, arranging delivery and handling returns.",
  product_description:
    "A cloud-hosted inventory management platform with barcode scanning, stock reconciliation, purchase order management and GST-compliant invoicing.",
  profit_sharing_ratio: "60:40",
  project_description:
    "Building a customer-facing web and mobile ordering application integrated with an existing warehouse management system.",
  purpose:
    "Evaluating a possible investment by the receiving party in the disclosing party's business.",
  repayment_schedule:
    "Twenty-four equal monthly instalments payable on the fifth day of each month, the first falling due one month after disbursement.",
  reporting_to: "Head of Engineering",
  reserved_matters:
    "Altering the share capital, approving a budget above the agreed threshold, incurring borrowing above Rs. 1,00,00,000, and any related party transaction.",
  role_responsibilities:
    "Designing, building and maintaining backend services, reviewing colleagues' code, and taking part in the on-call rota one week in four.",
  securities_subscribed:
    "1,00,000 Compulsorily Convertible Preference Shares of face value Rs. 10 each, issued at a premium of Rs. 490 each, converting to equity on a one-for-one basis.",
  security_collateral:
    "A first charge over the plant and machinery at the Pune facility, registered with the Registrar of Companies.",
  service_description:
    "A hosted platform that tracks stock levels across a retailer's outlets, raises replenishment orders and issues GST-compliant invoices.",
  service_levels:
    "99.5 per cent monthly uptime measured excluding scheduled maintenance, with a first response to a critical incident within one hour.",
  services_description:
    "Design, development, testing, deployment and twelve months of maintenance of a customer-facing ordering application.",
  society_rules:
    "The rules of the Sunrise Co-operative Housing Society regarding visitor entry, parking allotment, use of the terrace and quiet hours between 10:00 p.m. and 7:00 a.m.",
  support_maintenance:
    "Bug fixes and security patches for twelve months from acceptance, with support available on working days between 9:00 a.m. and 6:00 p.m.",
  tag_along_rights:
    "If a promoter transfers shares to a third party, the remaining holders may require that purchaser to buy their shares on the same terms and in the same proportion.",
  tax_responsibility:
    "Each party bears its own income tax. GST, where chargeable, is payable against a valid tax invoice, and tax deducted at source is remitted by the paying party with a certificate issued within the statutory period.",
  tech_stack: "React, Node.js, PostgreSQL, hosted on AWS in the Mumbai region",
  territory: "The states of Maharashtra, Gujarat and Goa",
  use_of_proceeds:
    "Hiring engineering and sales staff, funding a twelve-month marketing programme, and meeting working capital requirements.",
  vesting_cliff: "Twelve months from the grant date",
  voting_rights:
    "One vote per equity share on a poll; the preference shares carry votes only on matters directly affecting their rights.",
};

// Free-text fields with no dedicated sample. Reported at the end of a run so the
// fixture can be kept honest as the intake grows.
const UNCOVERED_FREE_TEXT = new Set();

const ENTITY_NAMES = [
  "Alpha Industries Private Limited",
  "Beta Consulting LLP",
  "Gamma Ventures Private Limited",
];
const PERSON_NAMES = ["Ramesh Kulkarni", "Sunita Deshmukh", "Arjun Nair"];
// Which of the two pools each party slot draws from.
const ENTITY_OR_PERSON = [ENTITY_NAMES[0], ENTITY_NAMES[1], ENTITY_NAMES[2]];
const ADDRESSES = [
  "1 First Road, Mumbai, Maharashtra 400001",
  "2 Second Road, Pune, Maharashtra 411001",
  "3 Third Road, Nashik, Maharashtra 422001",
];

// Distinguish the first, second and third counterparty so the fixture doesn't
// name both sides identically (which is itself a validation failure).
function partyIndex(key) {
  if (/(_|\b)(2|second|b)\b|_2_|employee|licensee|tenant|borrower|buyer|purchaser|contractor|consultant|distributor|recipient|service_provider/i.test(key)) return 1;
  if (/(_|\b)(3|third)\b|_3_|guarantor|witness/i.test(key)) return 2;
  return 0;
}

function sampleFor(key, def) {
  const k = key.toLowerCase();
  const idx = partyIndex(k);

  if (def.type === "select" && Array.isArray(def.options) && def.options.length) {
    // A "party type" select must agree with the name we generated for that
    // party, or the entity-consistency validator rejects the pair.
    if (/_type$/.test(k) && /party|employer|employee|partner|shareholder|guarantor|lender|borrower|licensor|licensee|landlord|tenant|buyer|seller|discloser|recipient/.test(k)) {
      const paired = ENTITY_OR_PERSON[idx] || "";
      const wantsPerson = PERSON_NAMES.includes(paired);
      // The suffix on the generated name decides the type. Matching "private
      // limited|company|llp" in option order gave "Beta Consulting LLP" the type
      // "Private Limited Company", which the graph validator blocks -- rightly,
      // because that pair would describe an LLP under the Companies Act.
      const wanted = wantsPerson
        ? /individual|person|proprietor/i
        : /\bLLP\b/i.test(paired)
          ? /llp|limited liability partnership/i
          : /private limited/i;
      const match = def.options.find((o) => wanted.test(o));
      if (match) return match;
    }
    // A state field is answered with the state the sample city is actually in.
    // Taking options[0] gave every fixture "Andhra Pradesh" alongside a Pune
    // seat and Maharashtra addresses -- a contradiction the graph validator now
    // blocks, and rightly: the fixture was wrong, not the check.
    if (/state/.test(k) && def.options.includes(SAMPLES.state)) return SAMPLES.state;
    return def.options[0];
  }
  if (def.type === "date") return SAMPLES.date;

  // Slots that can only be a natural person. A deponent swears an affidavit and
  // an advocate signs a notice; neither can be a company, and the entity-type
  // validator rightly rejects a company name in either.
  // Guarded on the field being a name. "deponent" alone also matches
  // deponent_age and deponent_id_number, and handing those a person's name is
  // just the previous bug pointing the other way.
  const NAMES_A_PERSON =
    /^(nominated_arbitrator|posh_presiding_officer|posh_external_member|grievance_officer|deponent_relation)$/;
  if (
    def.type !== "number" &&
    def.type !== "date" &&
    (NAMES_A_PERSON.test(k) ||
      (/name$/.test(k) && /deponent|advocate|parent|arbitrator|witness/.test(k)))
  ) {
    return k === "deponent_relation" ? "son" : PERSON_NAMES[idx];
  }
  if (/working_hours/.test(k)) return "40";
  // Free-text commercial fields must be filled with prose, not a bare number:
  // "price_terms" matches the money heuristic below and would otherwise be given
  // "500000", which the specificity check rejects for having no words in it.
  if (/price_terms|pricing|payment_terms|prepayment_terms|repayment_terms/.test(k))
    return "list price less a 15 percent trade discount, invoiced monthly and payable within 30 days of a valid tax invoice";
  if (/signatory_name/.test(k)) return PERSON_NAMES[idx];
  if (/signatory_designation|designation/.test(k)) return "Director";
  if (/board_resolution_date|authorisation_date/.test(k)) return SAMPLES.date;

  // Bounded numerics first — a percentage field given 500000 fails its range
  // check and blocks generation for a reason that has nothing to do with drafting.
  // Shareholdings must sum to 100 across the two shareholders, or the validator
  // rejects the pair before any drafting happens.
  // A field with declared bounds answers for itself, before any name heuristic
  // gets a chance to give a GST rate the generic "10 per cent".
  if (def.type === "number") {
    const bounded = sampleWithinBounds(key);
    if (bounded !== null && !/^shareholding_percentage_[12]$/.test(k)) return bounded;
  }
  if (/^shareholding_percentage_1$/.test(k)) return "60";
  if (/^shareholding_percentage_2$/.test(k)) return "40";
  if (/percent|percentage|_rate$|rate_|escalation|share_of|margin|discount/.test(k)) return "10";
  if (/notice_period|_days$|days_/.test(k)) return "30";
  if (/_months$|months_/.test(k)) return "24";
  if (/_years$|years_/.test(k)) return "3";
  if (/age$/.test(k)) return "18";
  if (/headcount|number_of|count$|quantity/.test(k)) return "25";
  // Every numeric field takes a value derived from its own declared bounds. If a
  // field has no bounds the coverage test fails, so this cannot silently fall
  // back to a shared figure again.
  if (def.type === "number") {
    const bounded = sampleWithinBounds(key);
    if (bounded !== null) return bounded;
    return "25";
  }

  // Identifiers belong to a party, not to the fixture. Each slot gets its own,
  // with the PAN holder code matching the entity the slot is named for.
  if (/_pan$|^pan$/.test(k)) {
    const wantsPerson = /employee|individual|signatory|witness|proprietor/.test(k);
    return (wantsPerson ? PERSON_PANS : PARTY_PANS)[idx];
  }
  if (/gstin/.test(k)) return gstinFor("27", PARTY_PANS[idx]);
  // An LLP is allotted an LLPIN, not a CIN, and giving it both is a defect the
  // identity validator now catches - correctly. The fixture must not commit it.
  if (/\bcin\b|_cin$/.test(k)) {
    return /\bLLP\b/i.test(ENTITY_OR_PERSON[idx] || "") ? "" : PARTY_CINS[idx];
  }
  if (/llpin/.test(k)) {
    return /\bLLP\b/i.test(ENTITY_OR_PERSON[idx] || "") ? PARTY_LLPINS[idx] : "";
  }
  if (/email/.test(k)) return SAMPLES.email;
  if (/url|website|domain/.test(k)) return SAMPLES.url;
  if (/city/.test(k)) return SAMPLES.city;
  if (/state/.test(k)) return SAMPLES.state;
  if (/address|premises|property|registered_office|location/.test(k)) return ADDRESSES[idx];
  if (/date/.test(k)) return SAMPLES.date;
  // Word-anchored. Unanchored, "rent" matched deponent_pa[rent]_name and handed a
  // money value to a person-name field; "value" and "fee" have the same hazard.
  if (/\b(amount|value|fee|rent|salary|deposit|price|capital|loan|consideration|turnover|revenue)\b/.test(k))
    return sampleWithinBounds(key) ?? "250000";
  if (/term|duration|period|tenure/.test(k)) return "24 months";
  if (/employee_name|individual_name|partner_\d_name|witness/.test(k)) return PERSON_NAMES[idx];
  if (/name$/.test(k)) return ENTITY_NAMES[idx];

  // Deliberately concrete: the vagueness check rejects "as agreed" style answers,
  // and rightly so -- the object of a contract must be certain. Deliberately
  // DISTINCT per field too: one shared fallback string is what made an external
  // review read the fixture as cross-template contamination in the generator.
  if (FIELD_SAMPLES[key]) return FIELD_SAMPLES[key];

  UNCOVERED_FREE_TEXT.add(key);
  return `${def.label}: the arrangement agreed between the parties in writing before performance begins, recorded here in full and not by reference to any other document.`;
}

function variablesFor(docType, { requiredOnly } = {}) {
  const vars = {};
  for (const group of [VARIABLE_CONFIG.COMMON, VARIABLE_CONFIG[docType]]) {
    for (const [key, def] of Object.entries(group || {})) {
      if (Array.isArray(def.excludeDocuments) && def.excludeDocuments.includes(docType)) continue;
      if (requiredOnly && !def.required) continue;
      vars[key] = sampleFor(key, def);
    }
  }
  return vars;
}

const MODE = process.argv[2] || "required";
const types = Object.keys(DOCUMENT_TYPE_REGISTRY);
console.log(`mode: ${MODE === "required" ? "REQUIRED FIELDS ONLY (what a user must answer)" : "EVERY FIELD FILLED (stress test)"}`);
console.log(`${types.length} registered document types\n`);
const rows = [];
const UNDECLARED = new Map();

for (const docType of types) {
  const vars = variablesFor(docType, { requiredOnly: MODE === "required" });
  const allDefs = { ...(VARIABLE_CONFIG.COMMON || {}), ...(VARIABLE_CONFIG[docType] || {}) };
  const undeclared = [];

  let r;
  // The form config marks a field required or not; the generation validator has
  // its own view. Where the validator demands a field the config says is
  // optional, supply it and record the mismatch -- that gap is itself a finding.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      r = await generateDocument({ document_type: docType, variables: vars });
    } catch (err) {
      r = null;
      rows.push({ docType, status: "THREW", detail: err.message.slice(0, 240) });
      break;
    }
    if (r?.draft) break;
    const missing = String(r?.error || "").match(/Missing required field: (\w+)/);
    if (!missing) break;
    const key = missing[1];
    if (vars[key] !== undefined) break;
    if (MODE === "required" && !allDefs[key]?.required) undeclared.push(key);
    vars[key] = sampleFor(key, allDefs[key] || { type: "text" });
  }
  if (r === null) continue;
  if (!r?.draft) {
    rows.push({ docType, status: "BLOCKED", detail: String(r?.error || "").slice(0, 240) });
    continue;
  }
  if (undeclared.length) UNDECLARED.set(docType, undeclared);
  const clauses = r.draft.clauses || [];
  const words = clauses.reduce((n, c) => n + String(c.text || "").split(/\s+/).filter(Boolean).length, 0);
  const subs = clauses.reduce(
    (n, c) => n + String(c.text || "").split("\n").filter((l) => /^\s*\(?[a-z0-9ivx]{1,4}[).]\s+/i.test(l)).length,
    0
  );
  const stubs = clauses.filter((c) => String(c.text || "").split(/\s+/).filter(Boolean).length < 40).length;
  rows.push({
    docType, status: "OK", score: r.validation?.score,
    clauses: clauses.length, words, subs, stubs,
    issues: (r.validation?.score_breakdown?.deductions || []).map(
      (i) => `-${i.points} ${i.severity} ${i.rule_id}: ${String(i.message || "").slice(0, 120)}`
    ),
  });
}

const ok = rows.filter((x) => x.status === "OK");
const bad = rows.filter((x) => x.status !== "OK");
console.log("TYPE                                  SCORE  CLAUSES  WORDS  SUBS  STUBS");
for (const x of ok.sort((a, b) => a.words - b.words)) {
  console.log(
    `${x.docType.padEnd(36)} ${String(x.score).padStart(5)} ${String(x.clauses).padStart(8)} ${String(x.words).padStart(6)} ${String(x.subs).padStart(5)} ${String(x.stubs).padStart(6)}`
  );
}
if (bad.length) {
  console.log(`\n${bad.length} NOT GENERATED:`);
  for (const x of bad) console.log(`  ${x.status.padEnd(8)} ${x.docType.padEnd(36)} ${x.detail}`);
}
if (UNDECLARED.size) {
  console.log("\nfields the validator demanded but the form config marks optional:");
  for (const [t, keys] of UNDECLARED) console.log(`  ${t.padEnd(36)} ${[...new Set(keys)].join(", ")}`);
}
const imperfect = ok.filter((x) => (x.score ?? 100) < 100);
if (imperfect.length) {
  console.log(`\n${imperfect.length} types scoring below 100:`);
  for (const x of imperfect) {
    console.log(`\n  ${x.docType} — ${x.score}`);
    for (const i of x.issues) console.log(`      ${i}`);
  }
}
if (UNCOVERED_FREE_TEXT.size) {
  console.log(
    `\n${UNCOVERED_FREE_TEXT.size} free-text fields answered by the generic fallback (give each its own sample in FIELD_SAMPLES):`
  );
  console.log(`  ${[...UNCOVERED_FREE_TEXT].sort().join(", ")}`);
}
console.log(`\ngenerated ${ok.length}/${types.length}`);
if (ok.length) {
  console.log(`  median words: ${ok.map(x=>x.words).sort((a,b)=>a-b)[Math.floor(ok.length/2)]}`);
  console.log(`  total stub clauses (<40w) across all types: ${ok.reduce((n,x)=>n+x.stubs,0)}`);
}
