import { useState } from "react";
import { runLegalInterview } from "../services/api";
import { Sparkles, ChevronRight } from "../utils/icons";
import "./InterviewPanel.css";

// Document-type-specific example prompts. Keyed by canonical document type;
// falls back to a generic set for any unmapped type.
const EXAMPLE_PROMPTS_BY_TYPE = {
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

function getExamplePrompts(documentType) {
  const key = String(documentType || "").toUpperCase();
  return EXAMPLE_PROMPTS_BY_TYPE[key] || DEFAULT_EXAMPLE_PROMPTS;
}

/**
 * Optional first step of the intake form: the user describes their situation in
 * plain language; the backend maps it to valid, in-schema field values which the
 * user reviews and applies. It only PRE-FILLS the form — never auto-submits.
 *
 * Props:
 *   documentType   string
 *   onApply        (fieldName, value) => void   — applies one field to the form
 *   appliedValues  object                       — current form values (to show applied state)
 */
export default function InterviewPanel({
  documentType,
  onApply,
  appliedValues = {},
  pageMode = false,
  onContinue,
  onSkip,
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [appliedKeys, setAppliedKeys] = useState(() => new Set());

  const analyze = async () => {
    const text = message.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await runLegalInterview({ document_type: documentType, message: text });
      setResult(res.data);
      if (res.data?.available === false) {
        setError(res.data.summary || "The interview assistant is unavailable right now.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not analyze your description. You can fill the form manually below."
      );
    } finally {
      setLoading(false);
    }
  };

  const apply = (update) => {
    onApply(update.field, update.value);
    setAppliedKeys((prev) => new Set(prev).add(update.field));
  };

  const applyAll = () => {
    (result?.field_updates || []).forEach(apply);
  };

  const isApplied = (update) =>
    appliedKeys.has(update.field) ||
    String(appliedValues[update.field] ?? "").toLowerCase() ===
      String(update.value).toLowerCase();

  const body = (
        <div className="interview-body">
          <div className="interview-card">
            <textarea
              className="interview-textarea"
              rows={4}
              placeholder="Describe your situation in plain language — who the parties are, what's being shared or done, and anything sensitive (source code, trade secrets, personal data)…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="interview-actions">
              {!result && (
                <span className="interview-actions__hint">
                  The more context you give, the more the document adapts.
                </span>
              )}
              {result?.field_updates?.length > 0 && (
                <button type="button" className="interview-applyall" onClick={applyAll}>
                  Apply all
                </button>
              )}
              <button
                type="button"
                className="interview-analyze"
                onClick={analyze}
                disabled={loading || !message.trim()}
              >
                {loading ? "Analyzing…" : "Analyze & suggest"}
              </button>
            </div>
          </div>

          {!result && !loading && (
            <div className="interview-examples">
              <span className="interview-examples__label">Try an example</span>
              <div className="interview-examples__chips">
                {getExamplePrompts(documentType).map((example) => (
                  <button
                    type="button"
                    key={example}
                    className="interview-example-chip"
                    onClick={() => setMessage(example)}
                  >
                    {example.length > 52 ? `${example.slice(0, 52)}…` : example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="interview-error">{error}</p>}

          {result?.summary && (
            <p className="interview-summary">
              <strong>Understood:</strong> {result.summary}
            </p>
          )}

          {result?.field_updates?.length > 0 && (
            <ul className="interview-updates">
              {result.field_updates.map((update) => (
                <li className="interview-update" key={update.field}>
                  <div className="interview-update__main">
                    <span className="interview-update__field">{update.label}</span>
                    <span className="interview-update__value">{update.value}</span>
                    <span className="interview-update__reason">{update.reason}</span>
                  </div>
                  <button
                    type="button"
                    className="interview-update__apply"
                    onClick={() => apply(update)}
                    disabled={isApplied(update)}
                  >
                    {isApplied(update) ? "Applied" : "Apply"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {result?.followup_questions?.length > 0 && (
            <div className="interview-followups">
              <span className="interview-followups__label">
                To shape the document further, also consider:
              </span>
              <ul>
                {result.followup_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
  );

  // ── Full-page mode: a standalone step shown before the form ────────────────
  if (pageMode) {
    const appliedCount = (result?.field_updates || []).filter(isApplied).length;
    return (
      <section className="interview-page">
        <div className="interview-page__head">
          <div className="interview-page__badge">
            <Sparkles size={11} />
            <span>AI-guided intake</span>
          </div>
          <h2 className="interview-page__title">Tell us about your situation</h2>
          <p className="interview-page__sub">
            Describe what you need in plain language and LegalAId will pre-fill the
            form and shape the document around your situation. This step is optional —
            you can skip straight to the form.
          </p>
        </div>
        {body}
        <div className="interview-page__footer">
          <button type="button" className="interview-skip" onClick={onSkip}>
            Skip for now
          </button>
          <button type="button" className="interview-continue" onClick={onContinue}>
            {appliedCount > 0
              ? `Continue to form (${appliedCount} applied)`
              : "Continue to form"}
          </button>
        </div>
      </section>
    );
  }

  // ── Inline collapsible mode (kept for embedding) ───────────────────────────
  return (
    <section className="interview-panel">
      <button
        type="button"
        className="interview-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="interview-toggle__title">
          <Sparkles size={13} /> Describe your situation (optional)
        </span>
        <span className="interview-toggle__hint">
          Let LegalAId pre-fill the form and shape the document around your needs
        </span>
        <span className={`interview-toggle__chev${open ? " interview-toggle__chev--open" : ""}`}>
          <ChevronRight size={12} />
        </span>
      </button>
      {open && body}
    </section>
  );
}
