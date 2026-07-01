// Per-document-type example descriptions, shared by both intake surfaces
// (the free-text interview and the prompt-first conversational mode) so the
// hints always match the document the user actually chose.

export const EXAMPLE_PROMPTS_BY_TYPE = {
  NDA: [
    "A SaaS startup sharing source code with an investor for due diligence; trade secrets are involved.",
    "A manufacturer sharing confidential pricing with a new supplier.",
    "Mutual NDA between two companies exploring a partnership; personal data may be shared.",
  ],
  EMPLOYMENT_CONTRACT: [
    "Hiring a senior engineer who will handle sensitive IP; we want a non-compete.",
    "Onboarding a junior sales executive on a 6-month probation.",
    "A leadership hire with garden leave and confidentiality over trade secrets.",
  ],
  SERVICE_AGREEMENT: [
    "Engaging a marketing consultant on a monthly retainer for an Indian client.",
    "A software vendor delivering a fixed-fee project with milestone payments.",
    "Ongoing IT support where the client can terminate for convenience on notice.",
  ],
  CONSULTANCY_AGREEMENT: [
    "A management consultant advising a startup for three months on a fixed fee.",
    "A financial advisory engagement where personal data of customers is processed.",
    "An independent consultant with deliverables, SLAs, and an indemnity clause.",
  ],
  PARTNERSHIP_DEED: [
    "Two founders starting a firm with equal profit sharing and joint management.",
    "A partnership where one partner contributes capital and the other runs operations.",
    "Adding a new partner with defined exit and dissolution terms.",
  ],
  SHAREHOLDERS_AGREEMENT: [
    "Founders and an angel investor agreeing on board seats and reserved matters.",
    "A startup raising a seed round with tag-along and anti-dilution rights.",
    "Two corporate shareholders setting voting rights and exit/deadlock terms.",
  ],
  JOINT_VENTURE_AGREEMENT: [
    "Two companies forming a 50:50 JV for a manufacturing project in India.",
    "An Indian firm and a foreign partner sharing IP and profits in a new venture.",
    "A JV with defined capital contributions and management control.",
  ],
  SUPPLY_AGREEMENT: [
    "A factory agreeing to supply components monthly with quality and shortage terms.",
    "A long-term supply deal with price revision and return policy.",
    "Supplying goods where personal data of end customers is handled.",
  ],
  DISTRIBUTION_AGREEMENT: [
    "Appointing an exclusive distributor for a product in South India.",
    "A non-exclusive distribution deal with sales reporting and targets.",
    "A distributor with territory restrictions and a non-compete.",
  ],
  SALES_OF_GOODS_AGREEMENT: [
    "A one-time sale of machinery with delivery, inspection, and warranty terms.",
    "Selling goods with a force majeure clause for supply disruptions.",
    "A bulk sale where title passes on delivery and payment is on credit.",
  ],
  INDEPENDENT_CONTRACTOR_AGREEMENT: [
    "Hiring a freelance designer for a project; IP must transfer to us.",
    "A contractor handling source code; we want confidentiality and non-solicit.",
    "An independent contractor on milestone-based pay with deliverables.",
  ],
  COMMERCIAL_LEASE_AGREEMENT: [
    "Leasing office space for 3 years with a lock-in and rent escalation.",
    "A retail shop lease with a security deposit and maintenance terms.",
    "Leasing a warehouse with a force majeure clause.",
  ],
  LEAVE_AND_LICENSE_AGREEMENT: [
    "Licensing a flat to a tenant for 11 months in Maharashtra.",
    "A leave and license for office space with a refundable deposit.",
    "Licensing residential premises with an entire-agreement clause.",
  ],
  LOAN_AGREEMENT: [
    "A company lending working capital to a vendor with monthly repayment.",
    "An unsecured personal loan between two parties with interest.",
    "A loan from an NBFC with security and prepayment terms.",
  ],
  GUARANTEE_AGREEMENT: [
    "A director personally guaranteeing a company's loan repayment.",
    "A corporate guarantee for a subsidiary's supply obligations.",
    "A guarantee with defined limits and an entire-agreement clause.",
  ],
  SOFTWARE_DEVELOPMENT_AGREEMENT: [
    "Building a mobile app for a client; source code IP transfers on payment.",
    "A SaaS development deal with milestones, warranty, and support.",
    "Custom software where the developer handles client personal data.",
  ],
  MOU: [
    "Two companies recording intent to collaborate before a formal contract.",
    "An MOU between a startup and a university for a research pilot.",
    "A non-binding MOU outlining scope, with confidentiality of shared data.",
  ],
};

const DEFAULT_EXAMPLE_PROMPTS = [
  "Describe who the parties are and what the agreement is for.",
  "Mention anything sensitive — source code, trade secrets, or personal data.",
  "Note any special terms, like exclusivity, a non-compete, or termination rights.",
];

export function getExamplePrompts(documentType) {
  const key = String(documentType || "").toUpperCase();
  return EXAMPLE_PROMPTS_BY_TYPE[key] || DEFAULT_EXAMPLE_PROMPTS;
}
