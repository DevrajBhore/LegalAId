import { generateDocument } from "./services/documentService.js";

const intake = {
  document_type: "TERMS_OF_SERVICE",
  mode: "quick",
  variables: {
    operating_state: "Karnataka",
    company_name: "Bloom Basket Retail Pvt Ltd",
    company_address: "Unit 12, Indiranagar 100 Ft Road, Bengaluru 560038",
    service_name: "Bloom Basket, the online grocery marketplace",
    website_url: "https://www.bloombasket.in",
    service_description:
      "browse and order groceries for home delivery, manage orders, and rate products",
    grievance_officer: "Anita Rao",
    grievance_officer_email: "grievance@bloombasket.in",
    effective_date: "2026-08-01",
  },
};

const res = await generateDocument(intake, { mode: "final" });
const v = res.validation || {};
console.log(JSON.stringify({
  certified: v.certified,
  risk: v.risk,
  error: res.error || null,
  blocking: (v.blockingIssues || []).map((i) => `${i.rule_id}: ${i.message}`),
  advisory: (v.advisoryIssues || []).map((i) => `${i.rule_id}: ${i.message}`),
  clauses: (res.draft?.clauses || []).map((c) => c.clause_id),
}, null, 2));
