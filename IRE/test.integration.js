/**
 * IRE Full Integration Test Suite
 * Covers all 9 document families — 40 tests total
 */

import { validateDocument } from "./engine.js";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

function allIssueIds(report) {
  return report.issues.map(i => i.rule_id);
}

// ── Reusable clause builders ──────────────────────────────────────────────────

function coreParties(text) {
  return { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Parties", text };
}
function coreGoverningLaw() {
  return { clause_id: "CORE_GOVERNING_LAW_001", category: "GOVERNING_LAW", title: "Governing Law",
    text: "This Agreement shall be governed by and construed in accordance with the laws of India." };
}
function coreSignature() {
  return { clause_id: "CORE_SIGNATURE_BLOCK_001", category: "SIGNATURE_BLOCK", title: "Signatures",
    text: "IN WITNESS WHEREOF the parties have executed this Agreement on the date first written above. Signed by: Party 1 ________ Signed by: Party 2 ________" };
}
function coreArbitration() {
  return { clause_id: "CORE_DISPUTE_RESOLUTION_001", category: "DISPUTE_RESOLUTION", title: "Dispute Resolution",
    text: "Any dispute arising out of or in connection with this Agreement shall be referred to and finally resolved by arbitration in accordance with the Arbitration and Conciliation Act, 1996. The seat of arbitration shall be Mumbai, Maharashtra. A sole arbitrator shall be appointed by mutual consent of the Parties." };
}
function corePurpose(text) {
  return { clause_id: "CORE_PURPOSE_001", category: "PURPOSE", title: "Purpose",
    text: text + " This Agreement is entered into for a lawful object and purpose." };
}
function coreConsideration(text) {
  return { clause_id: "SERVICE_PAYMENT_001", category: "CONSIDERATION", title: "Consideration",
    text: text + " This constitutes lawful consideration under the Indian Contract Act, 1872." };
}
function coreTerm() {
  return { clause_id: "CORE_TERM_001", category: "TERM", title: "Term",
    text: "This Agreement shall commence on 1st April 2024 (Effective Date) and continue for a period of twelve (12) months, unless earlier terminated in accordance with its terms." };
}
function coreTermination() {
  return { clause_id: "CORE_TERMINATION_001", category: "TERMINATION", title: "Termination",
    text: "Either party may terminate this Agreement by providing thirty (30) days written notice to the other party." };
}

// ── FAMILY 1: CONTRACTS & COMMERCIAL ─────────────────────────────────────────

const NDA_CLAUSES = [
  coreParties("This NDA is between Acme Pvt Ltd (Disclosing Party) and Beta Ltd (Receiving Party)."),
  { clause_id: "CORE_DEFINITIONS_001", category: "IDENTITY", title: "Definitions",
    text: "'Confidential Information' shall mean all non-public information disclosed by either party." },
  { clause_id: "CORE_CONFIDENTIALITY_001", category: "CONFIDENTIALITY", title: "Confidentiality",
    text: "The Receiving Party shall maintain strict confidentiality of all Confidential Information." },
  { clause_id: "NDA_EXCLUSIONS_001", category: "EXCLUSIONS", title: "Exclusions",
    text: "Obligations do not apply to information that is publicly available, independently developed, or required by law." },
  { clause_id: "NDA_TERM_SURVIVAL_001", category: "TERM", title: "Term",
    text: "This Agreement is effective from 1st April 2024 for a period of two (2) years." },
  coreArbitration(), coreGoverningLaw(), coreSignature(),
  { clause_id: "CORE_ENFORCEABILITY_001", category: "ENFORCEABILITY", title: "Enforceability",
    text: "This Agreement constitutes a valid contract formed by free consent for lawful consideration under the Indian Contract Act, 1872." },
];

const SERVICE_CLAUSES = [
  coreParties("This Service Agreement is entered into on 1st April 2024 between TechCorp Pvt Ltd, a company incorporated under the Companies Act 2013, represented by its authorized signatory (hereinafter 'Client') and DevStudio Ltd, represented by its authorized signatory (hereinafter 'Service Provider'). This Agreement is for a lawful purpose and constitutes a valid contract under the Indian Contract Act, 1872."),
  corePurpose("The Service Provider shall provide software development services as detailed in Schedule 1."),
  coreConsideration("The Client shall pay INR 5,00,000 per month within 30 days of invoice."),
  coreTerm(), coreTermination(), coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const EMPLOYMENT_CLAUSES = [
  coreParties("This Employment Agreement is entered into on 1st June 2024 between Innovative Tech Ltd, a company incorporated under the Companies Act 2013, duly represented by its authorized signatory (hereinafter 'Employer') and Rahul Sharma, aged 28 years (hereinafter 'Employee'). This Agreement constitutes a lawful contract."),
  corePurpose("The Employee is appointed as Senior Software Engineer effective 1st June 2024 for a lawful purpose."),
  { clause_id: "EMPLOYMENT_COMPENSATION_001", category: "CONSIDERATION", title: "Compensation",
    text: "The Employee shall receive a gross annual CTC of INR 12,00,000 payable monthly as lawful consideration per the Payment of Wages Act, 1936. TDS shall be deducted under Income Tax Act 1961." },
  { clause_id: "EMPLOYMENT_ROLE_001", category: "PURPOSE", title: "Role",
    text: "The Employee shall perform duties as Senior Software Engineer and report to the CTO." },
  { clause_id: "EMPLOYMENT_TERMINATION_001", category: "TERMINATION", title: "Termination",
    text: "Either party may terminate by providing 30 days written notice or payment in lieu thereof per Industrial Disputes Act 1947." },
  { clause_id: "CORE_CONFIDENTIALITY_001", category: "CONFIDENTIALITY", title: "Confidentiality",
    text: "The Employee shall maintain strict confidentiality of all proprietary and confidential information of the Employer during and after employment. This obligation survives termination." },
  coreTerm(), coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const RENTAL_CLAUSES = [
  coreParties("This Rental Agreement is executed on 1st May 2024 between Suresh Mehta, residing at 10 Hill Road, Mumbai (hereinafter 'Landlord'/Lessor) and Priya Singh, residing at 22 Carter Road, Mumbai (hereinafter 'Tenant'/Lessee). This Agreement is for a lawful purpose."),
  { clause_id: "RENTAL_PROPERTY_DESCRIPTION_001", category: "PURPOSE", title: "Premises",
    text: "The Landlord hereby lets to the Tenant the premises situated at Flat 3B, Sunshine Apartments, Bandra West, Mumbai 400050 for residential use as lawful consideration." },
  { clause_id: "RENTAL_RENT_PAYMENT_001", category: "CONSIDERATION", title: "Rent",
    text: "The monthly rent shall be INR 35,000 payable on or before the 5th of each calendar month by bank transfer. This constitutes the lawful consideration for this lease." },
  { clause_id: "RENTAL_SECURITY_DEPOSIT_001", category: "CONSIDERATION", title: "Deposit",
    text: "A refundable security deposit of INR 70,000 (two months rent) shall be paid on signing and refunded within 30 days of vacation." },
  { clause_id: "RENTAL_TERM_001", category: "TERM", title: "Term",
    text: "The lease shall be for a period of eleven (11) months commencing 1st May 2024 and ending 31st March 2025." },
  { clause_id: "RENTAL_TERMINATION_001", category: "TERMINATION", title: "Termination",
    text: "Either party may terminate this Agreement by providing fifteen (15) days written notice to the other party after expiry of the lock-in period." },
  coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const LOAN_CLAUSES = [
  coreParties("This Loan Agreement is entered into on 1st April 2024 between Capital Finance Ltd, a duly authorized NBFC (hereinafter 'Lender') and Rajesh Enterprises Pvt Ltd (CIN: U12345MH2020PTC123456), represented by its authorized signatory (hereinafter 'Borrower'). This Agreement constitutes a valid and lawful contract."),
  corePurpose("The Lender agrees to advance a term loan to the Borrower for the purpose of working capital requirements and business expansion, being a lawful object."),
  { clause_id: "LOAN_AMOUNT_001", category: "CONSIDERATION", title: "Loan Amount",
    text: "The Lender agrees to lend a principal amount of INR 50,00,000 (Rupees Fifty Lakhs only) to the Borrower, to be disbursed within 7 Business Days of satisfaction of Conditions Precedent." },
  { clause_id: "LOAN_INTEREST_001", category: "CONSIDERATION", title: "Interest",
    text: "Interest at 14% per annum shall accrue on the outstanding principal from the date of disbursement. TDS shall be deducted under Income Tax Act 1961, Section 194A." },
  { clause_id: "LOAN_REPAYMENT_001", category: "TERM", title: "Repayment",
    text: "The Borrower shall repay the Loan in 24 equal monthly instalments of INR 2,08,333 commencing 1st July 2024 as per the Repayment Schedule in Schedule 1." },
  { clause_id: "LOAN_DEFAULT_001", category: "TERMINATION", title: "Events of Default",
    text: "Events of Default include: (a) non-payment within 5 Business Days; (b) insolvency proceedings under IBC 2016; (c) material breach unremedied for 30 days; (d) cross-default." },
  coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const SHAREHOLDERS_CLAUSES = [
  coreParties("This Shareholders Agreement is entered into as of 1st April 2024 between Founder A, Founder B, and Investor X (duly authorized representatives), collectively the Shareholders of TechStartup Pvt Ltd (CIN: U12345MH2024PTC123456)."),
  corePurpose("This Agreement governs the rights and obligations of Shareholders under the Companies Act, 2013."),
  coreConsideration("Investor X shall subscribe to 20% equity at INR 2,00,00,000 valuing the company at INR 10,00,00,000."),
  coreTerm(), coreTermination(), coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const PARTNERSHIP_CLAUSES = [
  coreParties("This Partnership Deed is executed on 1st April 2024 between Amit Kumar (Address: 12 MG Road, Mumbai) and Vijay Sharma (Address: 45 Park Street, Delhi), hereinafter collectively referred to as Partners, for a lawful business purpose."),
  corePurpose("The partnership is formed for the business of wholesale trading of electronic goods."),
  coreConsideration("Profit and loss shall be shared equally (50:50) between the partners."),
  coreTerm(), coreTermination(), coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const IP_ASSIGNMENT_CLAUSES = [
  coreParties("This IP Assignment Agreement is executed on 1st April 2024 between Creator Labs Pvt Ltd, represented by its authorized signatory (hereinafter 'Assignor') and Tech Giant Ltd, represented by its authorized signatory (hereinafter 'Assignee')."),
  corePurpose("The Assignor assigns all intellectual property rights in the Software described in Schedule 1 to the Assignee for a lawful purpose."),
  { clause_id: "IP_ASSIGNMENT_001", category: "PURPOSE", title: "Assignment",
    text: "The Assignor hereby assigns absolutely and with full title guarantee all IP rights including copyright under Copyright Act 1957 and patents under Patents Act 1970 to the Assignee." },
  coreConsideration("Consideration of INR 25,00,000 shall be paid by the Assignee to the Assignor upon execution as lawful consideration for this assignment."),
  coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const AFFIDAVIT_CLAUSES = [
  { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Deponent",
    text: "I, Ramesh Kumar, son of Suresh Kumar, aged 35 years, residing at 12 MG Road, Mumbai 400001, do hereby solemnly affirm and state as follows on this 1st day of April 2024." },
  { clause_id: "CORE_PURPOSE_001", category: "PURPOSE", title: "Declaration",
    text: "I solemnly affirm and declare that I am the lawful owner of the property at 45 Park Street, Mumbai and the facts stated herein are true and correct to the best of my knowledge and belief." },
  { clause_id: "CORE_SIGNATURE_BLOCK_001", category: "SIGNATURE_BLOCK", title: "Deponent",
    text: "Deponent: Ramesh Kumar. Solemnly affirmed and signed before me on this 1st day of April 2024. Notary Public: ________ Seal: ________" },
];

const POA_CLAUSES = [
  { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Principal",
    text: "I, Anita Sharma, daughter of Vijay Sharma, aged 45 years, residing at 7 Lodi Road, New Delhi, do hereby appoint Ravi Kumar as my lawful Attorney on this 1st day of April 2024." },
  { clause_id: "CORE_PURPOSE_001", category: "PURPOSE", title: "Powers Granted",
    text: "My Attorney is hereby authorised to manage, sell, transfer, and deal with my property at 45 Park Street, New Delhi in any lawful manner as I myself could do." },
  { clause_id: "CORE_SIGNATURE_BLOCK_001", category: "SIGNATURE_BLOCK", title: "Execution",
    text: "IN WITNESS WHEREOF I have hereunto signed this Power of Attorney on 1st April 2024 at New Delhi. Signed by Principal: Anita Sharma. Witnessed by: _______ Notarised before Notary Public: ________" },
];

const MOU_CLAUSES = [
  coreParties("This MOU is entered into on 1st April 2024 between University of Mumbai, represented by its Registrar (duly authorized), and TechCorp Pvt Ltd, represented by its authorized signatory."),
  corePurpose("The parties intend to collaborate on research and development in artificial intelligence for a lawful purpose."),
  coreTerm(), coreArbitration(), coreGoverningLaw(), coreSignature(),
];

const SOFTWARE_DEV_CLAUSES = [
  coreParties("This Agreement is between BuildFast Ltd (Client) and CodeCraft Pvt Ltd (Developer)."),
  corePurpose("Developer shall build a mobile application as per specifications in Schedule 1."),
  coreConsideration("Client shall pay INR 8,00,000 in milestones as per Schedule 2."),
  { clause_id: "IP_OWNERSHIP_001", category: "PURPOSE", title: "IP Ownership",
    text: "All IP in the developed software shall vest exclusively in the Client under Copyright Act 1957." },
  coreTerm(), coreTermination(), coreArbitration(), coreGoverningLaw(), coreSignature(),
];

// ── ILLEGAL CLAUSE TEST DOCUMENTS ────────────────────────────────────────────

const ILLEGAL_EMPLOYMENT = [
  coreParties("Agreement between ABC Ltd and John Doe."),
  corePurpose("Employment as Developer."),
  { clause_id: "EMP_WAGES_001", category: "CONSIDERATION", title: "Wages",
    text: "Employee shall work without pay for the first 6 months as bonded labour to repay training costs." },
  coreGoverningLaw(), coreSignature(),
];

const ILLEGAL_NDA = [
  coreParties("Agreement between X Ltd and Y Ltd."),
  { clause_id: "CORE_CONFIDENTIALITY_001", category: "CONFIDENTIALITY", title: "Confidentiality",
    text: "Party A shall never compete with Party B in any business for life — lifetime non-compete applies forever." },
  { clause_id: "CORE_GOVERNING_LAW_001", category: "GOVERNING_LAW", title: "Governing Law",
    text: "This Agreement is governed by the laws of England and Wales." },
  coreSignature(),
];

// ── TEST SUITE ────────────────────────────────────────────────────────────────

console.log("\n🏛️  IRE Full Test Suite — All Document Families\n");
console.log("═".repeat(55));

// ── FAMILY 1: CONTRACTS ───────────────────────────────────────────────────────
console.log("\n📋 CONTRACTS & COMMERCIAL");

await test("NDA — certified with no critical issues", async () => {
  const r = await validateDocument("NDA", NDA_CLAUSES);
  assert(r.certified === true, `Not certified. Critical: ${r.issues.filter(i=>i.severity==="CRITICAL").map(i=>i.rule_id)}`);
});

await test("Service Agreement — certified", async () => {
  const r = await validateDocument("SERVICE_AGREEMENT", SERVICE_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("MOU — certified", async () => {
  const r = await validateDocument("MOU", MOU_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Software Development Agreement — certified", async () => {
  const r = await validateDocument("SOFTWARE_DEVELOPMENT_AGREEMENT", SOFTWARE_DEV_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

// ── FAMILY 2: EMPLOYMENT ──────────────────────────────────────────────────────
console.log("\n👔 EMPLOYMENT & LABOUR");

await test("Employment Agreement — certified", async () => {
  // Use a complete employment agreement with all required clause IDs
  const fullEmpClauses = [
    coreParties("This Employment Agreement is entered into on 1st June 2024 between Innovative Tech Ltd, duly represented by its authorized signatory (hereinafter Employer) and Rahul Sharma, aged 28 years (hereinafter Employee). This constitutes a lawful contract."),
    corePurpose("Employee is appointed as Senior Software Engineer effective 1st June 2024 for a lawful purpose."),
    { clause_id: "EMPLOYMENT_ROLE_001",          category: "PURPOSE",       title: "Role",
      text: "Employee shall perform duties as Senior Software Engineer and report to the CTO." },
    { clause_id: "EMPLOYMENT_COMPENSATION_001",  category: "CONSIDERATION", title: "Compensation",
      text: "Gross annual CTC of INR 12,00,000 payable monthly per the Payment of Wages Act 1936. Lawful consideration." },
    { clause_id: "EMPLOYMENT_TERMINATION_001",   category: "TERMINATION",   title: "Termination",
      text: "Either party may terminate by providing 30 days written notice or payment in lieu thereof." },
    { clause_id: "EMPLOYMENT_CONFIDENTIALITY_001", category: "CONFIDENTIALITY", title: "Confidentiality",
      text: "Employee shall maintain strict confidentiality of all Employer information." },
    coreTerm(), coreArbitration(), coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("EMPLOYMENT_AGREEMENT", fullEmpClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Employment Agreement — detects bonded labour clause", async () => {
  const r = await validateDocument("EMPLOYMENT_AGREEMENT", ILLEGAL_EMPLOYMENT);
  const ids = allIssueIds(r);
  assert(ids.some(id => id.includes("BONDED") || id.includes("LABOUR")),
    `Expected bonded labour issue. Got: ${ids}`);
});

await test("Employment Agreement — blocked when bonded labour present", async () => {
  const r = await validateDocument("EMPLOYMENT_AGREEMENT", ILLEGAL_EMPLOYMENT);
  assert(r.certified === false, "Should not be certified with bonded labour clause");
});

// ── FAMILY 3: PROPERTY ────────────────────────────────────────────────────────
console.log("\n🏠 PROPERTY & REAL ESTATE");

await test("Rental Agreement — certified", async () => {
  const r = await validateDocument("RENTAL_AGREEMENT", RENTAL_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Rental Agreement — short notice triggers TPA S.106 / notice violation", async () => {
  const shortNotice = RENTAL_CLAUSES.map(c =>
    c.clause_id === "RENTAL_TERMINATION_001"
      ? { ...c, text: "Either party may terminate by giving 5 days notice." }
      : c
  );
  const r = await validateDocument("LEAVE_AND_LICENSE_AGREEMENT", shortNotice);
  const ids = allIssueIds(r);
  assert(
    ids.some(id =>
      id.includes("TPA") || id.includes("NOTICE") ||
      id.includes("THRESHOLD") || id.includes("UNREASONABLE")
    ),
    `Expected notice violation. Got: ${ids}`
  );
});

await test("Leave and License — certified", async () => {
  const r = await validateDocument("LEAVE_AND_LICENSE_AGREEMENT", RENTAL_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Sale Deed — flags mandatory registration missing", async () => {
  const saleDeed = [
    coreParties("Seller: Ramesh Kumar. Buyer: Priya Sharma."),
    corePurpose("Sale of property at Survey No. 123, Pune."),
    coreConsideration("Sale consideration INR 75,00,000."),
    coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("SALE_DEED", saleDeed);
  const ids = allIssueIds(r);
  assert(ids.some(id => id.includes("REGISTRATION")),
    `Expected mandatory registration issue. Got: ${ids}`);
});

// ── FAMILY 4: CORPORATE ───────────────────────────────────────────────────────
console.log("\n🏢 CORPORATE & BUSINESS");

await test("Shareholders Agreement — certified", async () => {
  const r = await validateDocument("SHAREHOLDERS_AGREEMENT", SHAREHOLDERS_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Partnership Deed — certified", async () => {
  const r = await validateDocument("PARTNERSHIP_DEED", PARTNERSHIP_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Joint Venture Agreement — certified", async () => {
  const r = await validateDocument("JOINT_VENTURE_AGREEMENT", SHAREHOLDERS_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Founders Agreement — certified", async () => {
  const r = await validateDocument("FOUNDERS_AGREEMENT", SHAREHOLDERS_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

// ── FAMILY 5: FINANCIAL ───────────────────────────────────────────────────────
console.log("\n💰 FINANCIAL INSTRUMENTS");

await test("Loan Agreement — certified", async () => {
  const r = await validateDocument("LOAN_AGREEMENT", LOAN_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Guarantee Agreement — certified", async () => {
  const guaranteeClauses = [
    coreParties("This Guarantee Agreement is executed on 1st April 2024 by Rajesh Kumar, residing at 12 MG Road, Mumbai (hereinafter 'Guarantor') in favour of Capital Bank Ltd, a scheduled commercial bank (hereinafter 'Lender'). The Principal Debtor is XYZ Pvt Ltd (hereinafter 'Borrower'). This Agreement constitutes a lawful contract under Indian Contract Act 1872."),
    corePurpose("The Guarantor provides this continuing guarantee as security for the Loan Agreement dated 1st April 2024 between the Lender and Borrower, for a lawful purpose."),
    { clause_id: "GUARANTEE_OBLIGATION_001", category: "CONSIDERATION", title: "Guarantee Obligation",
      text: "In consideration of the Lender advancing the Loan to the Borrower, the Guarantor hereby unconditionally and irrevocably guarantees to the Lender the due and punctual payment of all principal, interest, fees and costs payable by the Borrower (Guaranteed Obligations). This constitutes lawful consideration under ICA 1872 S.126." },
    coreTerm(), coreArbitration(), coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("GUARANTEE_AGREEMENT", guaranteeClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Loan Agreement — detects usurious interest (45%)", async () => {
  const usurious = LOAN_CLAUSES.map(c =>
    c.clause_id === "LOAN_INTEREST_001"
      ? { ...c, text: "Interest at 45% per annum shall apply on the outstanding amount." }
      : c
  );
  const r = await validateDocument("LOAN_AGREEMENT", usurious);
  const ids = allIssueIds(r);
  assert(ids.some(id => id.includes("USURI") || id.includes("INTEREST") || id.includes("PENALTY")),
    `Expected usury issue. Got: ${ids}`);
});

// ── FAMILY 6: INTELLECTUAL PROPERTY ──────────────────────────────────────────
console.log("\n💡 INTELLECTUAL PROPERTY");

await test("IP Assignment Agreement — certified", async () => {
  const r = await validateDocument("IP_ASSIGNMENT_AGREEMENT", IP_ASSIGNMENT_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("SaaS Agreement — certified", async () => {
  const saasClauses = [
    coreParties("This SaaS Agreement is executed on 1st April 2024 between CloudTech Ltd, represented by its authorized signatory (Provider) and Enterprise Co, represented by its authorized signatory (Customer)."),
    corePurpose("Provider grants Customer a limited, non-exclusive licence to access and use the LegalAId SaaS platform for a lawful purpose."),
    { clause_id: "IP_OWNERSHIP_001", category: "PURPOSE", title: "IP Ownership",
      text: "All intellectual property rights in the SaaS platform remain exclusively vested in the Provider under Copyright Act 1957. Customer receives only a limited licence to use." },
    coreConsideration("Customer shall pay INR 50,000 per month subscription fee as lawful consideration for the licence granted hereunder."),
    coreTerm(), coreTermination(), coreArbitration(), coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("SAAS_AGREEMENT", saasClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("IP License Agreement — certified", async () => {
  const ipLicenseClauses = [
    coreParties("Licensor: Patent Holdings Ltd. Licensee: Manufacturing Co Pvt Ltd."),
    { clause_id: "IP_LICENSE_001", category: "PURPOSE", title: "Licence Grant",
      text: "Licensor grants a non-exclusive licence to use Patent No. IN123456 for manufacturing in India." },
    coreConsideration("Royalty of 3% of net sales shall be payable quarterly."),
    coreTerm(), coreTermination(), coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("IP_LICENSE_AGREEMENT", ipLicenseClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

// ── FAMILY 7: FAMILY & PERSONAL ──────────────────────────────────────────────
console.log("\n👨‍👩‍👧 FAMILY & PERSONAL");

await test("Will — certified", async () => {
  const willClauses = [
    { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Testator",
      text: "I, Suresh Kumar, aged 65, son of Ramesh Kumar, residing at 12 MG Road, Mumbai, being of sound mind and memory, do hereby make and declare this my Last Will and Testament on this 1st day of April 2024, revoking all previous Wills and codicils made by me." },
    { clause_id: "CORE_PURPOSE_001", category: "PURPOSE", title: "Bequests",
      text: "I give, bequeath and devise all my properties, both movable and immovable, including the property at 12 MG Road, Mumbai to my son Rahul Kumar absolutely and forever. This Will is for a lawful purpose." },
    { clause_id: "CORE_SIGNATURE_BLOCK_001", category: "SIGNATURE_BLOCK", title: "Testator Signature",
      text: "IN WITNESS WHEREOF I subscribe my name to this my Last Will and Testament on this 1st day of April 2024 at Mumbai. Signed by Testator: Suresh Kumar. Witness 1: ________ Witness 2: ________" },
  ];
  const r = await validateDocument("WILL", willClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Maintenance Agreement — certified", async () => {
  const maintClauses = [
    coreParties("This Maintenance Agreement is executed on 1st April 2024 between Rajesh Sharma (hereinafter 'Husband') and Meena Sharma (hereinafter 'Wife'). This Agreement is for a lawful purpose."),
    corePurpose("The Husband agrees to pay maintenance for the welfare and upkeep of the minor children and the Wife as agreed herein."),
    coreConsideration("Monthly maintenance of INR 25,000 shall be paid by the Husband to the Wife by the 1st of each month as lawful maintenance under applicable law."),
    coreArbitration(), coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("MAINTENANCE_AGREEMENT", maintClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

// ── FAMILY 8: LITIGATION & COURT ─────────────────────────────────────────────
console.log("\n⚖️  LITIGATION & COURT");

await test("Affidavit — certified", async () => {
  const r = await validateDocument("AFFIDAVIT", AFFIDAVIT_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Legal Notice — certified", async () => {
  const noticeClauses = [
    { clause_id: "CORE_IDENTITY_001", category: "IDENTITY", title: "Parties",
      text: "From: Advocate Ravi Kumar (Bar Council No. MH/12345/2010) on behalf of and instructed by Client A, residing at 12 MG Road, Mumbai. To: Respondent B, residing at 45 Park Street, Mumbai. Date: 1st April 2024." },
    { clause_id: "CORE_PURPOSE_001", category: "PURPOSE", title: "Notice",
      text: "I hereby call upon you to forthwith pay to my client a sum of INR 10,00,000 (Rupees Ten Lakhs only) due and payable under the Agreement dated 1st January 2024 within fifteen (15) days of receipt of this notice, failing which my client will be constrained to initiate appropriate legal proceedings." },
    coreSignature(),
  ];
  const r = await validateDocument("LEGAL_NOTICE", noticeClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("Indemnity Bond — certified", async () => {
  const bondClauses = [
    coreParties("I, Rajesh Kumar, hereby execute this Indemnity Bond in favour of State Bank of India."),
    corePurpose("I undertake to indemnify the Bank against all losses arising from issuance of duplicate passbook."),
    coreConsideration("This Bond is executed for lawful consideration."),
    coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("INDEMNITY_BOND", bondClauses);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

// ── FAMILY 9: GOVERNMENT & REGULATORY ────────────────────────────────────────
console.log("\n🏛️  GOVERNMENT & REGULATORY");

await test("Power of Attorney — certified", async () => {
  const r = await validateDocument("POWER_OF_ATTORNEY", POA_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

await test("General POA — certified", async () => {
  const r = await validateDocument("GENERAL_POWER_OF_ATTORNEY", POA_CLAUSES);
  assert(r.certified === true, `Not certified. Issues: ${allIssueIds(r)}`);
});

// ── ILLEGAL CLAUSE DETECTION ACROSS ALL TYPES ────────────────────────────────
console.log("\n🚫 ILLEGAL CLAUSE DETECTION");

await test("Detects lifetime non-compete in any document", async () => {
  const r = await validateDocument("NDA", ILLEGAL_NDA);
  const ids = allIssueIds(r);
  assert(ids.some(id => id.includes("S27") || id.includes("NON_COMPETE") || id.includes("RESTRAINT")),
    `Expected non-compete issue. Got: ${ids}`);
});

await test("Detects foreign governing law in any document", async () => {
  const r = await validateDocument("SERVICE_AGREEMENT", ILLEGAL_NDA);
  const ids = allIssueIds(r);
  assert(ids.some(id => id.includes("FOREIGN") || id.includes("GOVERNING")),
    `Expected foreign law issue. Got: ${ids}`);
});

await test("Detects ouster of jurisdiction", async () => {
  const oustedClauses = [
    coreParties("Party A and Party B."),
    { clause_id: "CORE_CONFIDENTIALITY_001", category: "CONFIDENTIALITY", title: "Clause",
      text: "No court shall have jurisdiction over any dispute under this agreement whatsoever." },
    coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("NDA", oustedClauses);
  const ids = allIssueIds(r);
  assert(ids.some(id => id.includes("S28") || id.includes("OUSTER") || id.includes("JURISDICTION")),
    `Expected ouster issue. Got: ${ids}`);
});

await test("Detects unfilled placeholders", async () => {
  const unfilledClauses = [
    coreParties("Agreement between [PARTY_A_NAME] and [PARTY_B_NAME]."),
    coreGoverningLaw(), coreSignature(),
  ];
  const r = await validateDocument("NDA", unfilledClauses);
  assert(allIssueIds(r).some(id => id.includes("PLACEHOLDER") || id.includes("UNFILLED")),
    "Expected placeholder issue");
});

// ── ENGINE BEHAVIOUR ──────────────────────────────────────────────────────────
console.log("\n⚙️  ENGINE BEHAVIOUR");

await test("Empty document returns CRITICAL issues", async () => {
  const r = await validateDocument("NDA", []);
  assert(r.issues.filter(i => i.severity === "CRITICAL").length > 0,
    "Expected critical issues for empty document");
});

await test("Unknown document type still validates (universal fallback)", async () => {
  const r = await validateDocument("SOME_CUSTOM_AGREEMENT", [
    coreParties("Party A and Party B."),
    corePurpose("Custom agreement for specific purpose."),
    coreGoverningLaw(), coreSignature(),
  ]);
  assert(Array.isArray(r.issues), "Expected issues array");
  assert(typeof r.certified === "boolean", "Expected certified boolean");
});

await test("_layers breakdown present on all validations", async () => {
  const r = await validateDocument("EMPLOYMENT_AGREEMENT", EMPLOYMENT_CLAUSES);
  assert(r._layers !== undefined, "Expected _layers");
  assert(typeof r._layers.statutory_issues === "number", "Expected statutory_issues count");
});

await test("risk_level is always one of the four valid values", async () => {
  const validLevels = ["LOW", "MEDIUM", "HIGH", "BLOCKED"];
  const r = await validateDocument("LOAN_AGREEMENT", LOAN_CLAUSES);
  assert(validLevels.includes(r.risk_level), `Invalid risk_level: ${r.risk_level}`);
});

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log("\n" + "═".repeat(55));
console.log(`  Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log(`  Coverage: Contracts · Employment · Property · Corporate`);
console.log(`            Financial · IP · Family · Litigation · Regulatory`);
console.log("═".repeat(55) + "\n");

if (failed > 0) process.exit(1);
