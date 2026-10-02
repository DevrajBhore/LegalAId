import { Link } from "react-router-dom";
import { Icons } from "../utils/icons";
import { LEGAL_NOTICE } from "../data/legalNotice";
import "./LegalPage.css";

// Factual corrections from the 26 Sep 2026 launch-compliance audit. The full
// Terms are being drafted for legal review (docs/legal/TERMS_OF_SERVICE_DRAFT.md).
const TERMS = [
  {
    title: "Not legal advice",
    body: LEGAL_NOTICE,
  },
  {
    title: "Who can use LegalAId",
    body: "You must be 18 or older and able to enter into a binding contract to create an account.",
  },
  {
    title: "How documents are produced",
    body:
      "Documents are assembled from a clause library according to your answers, and an AI model (Google Gemini, or Groq as a fallback) tailors the wording. Automated checks review the structure and some statutory requirements; they are not a legal review, and some document types may be unavailable.",
  },
  {
    title: "Use of the platform",
    body:
      "LegalAId provides a software platform for generating, reviewing, validating, editing, and exporting Indian legal document drafts. Access to protected drafting features requires a valid account.",
  },
  {
    title: "User responsibility",
    body:
      "You are responsible for the information you enter into the system, for ensuring that you are authorized to use that information, and for reviewing final documents before use, execution, or delivery.",
  },
  {
    title: "Acceptable use",
    body:
      "You may not use LegalAId to submit unlawful material, misuse another person’s information, interfere with the platform, or attempt to bypass security, access controls, validation gates, or usage safeguards.",
  },
  {
    title: "Saved drafts and document history",
    body:
      "LegalAId stores the latest saved draft for each supported document type in your account workspace. You may remove saved drafts through the product, and deleted history will no longer remain available in your account.",
  },
  {
    title: "Availability and changes",
    body:
      "We may improve, modify, or refine platform behavior, supported document types, and workflow steps over time. Temporary interruptions may occur during maintenance, deployment, or infrastructure issues.",
  },
  {
    title: "Limitation of platform role",
    body:
      "LegalAId is a drafting and validation platform. It is designed to automate document preparation workflows, but users remain responsible for the final use, approval, and execution context of generated documents.",
  },
];

export default function TermsOfService() {
  return (
    <div className="legal-page">
      <section className="legal-hero">
        <div className="legal-hero-inner">
          <span className="legal-eyebrow">LEGAL</span>
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">
            These terms govern access to LegalAId and the use of its drafting,
            validation, document history, and export workflows.
          </p>
          <div className="legal-meta">Last updated | 26 September 2026</div>
        </div>
      </section>

      <section className="legal-content">
        <div className="legal-grid">
          {TERMS.map((term) => (
            <article key={term.title} className="legal-card">
              <h2>{term.title}</h2>
              <p>{term.body}</p>
            </article>
          ))}

          <article className="legal-card">
            <h2>Key expectations</h2>
            <ul>
              <li>Use accurate party, date, and commercial details when generating documents.</li>
              <li>Review validation results before export or execution.</li>
              <li>Keep account access credentials secure.</li>
              <li>Do not use the platform for unauthorized or unlawful drafting activity.</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="legal-footer-cta">
        <div className="legal-footer-box">
          <div>
            <h3>Ready to keep drafting?</h3>
            <p>
              Move back into the document library or continue working with your
              saved drafts from the workspace.
            </p>
          </div>
          <div className="legal-footer-actions">
            <Link to="/library" className="legal-btn legal-btn--primary">
              Browse library {Icons.arrowRight}
            </Link>
            <Link to="/documents" className="legal-btn legal-btn--ghost">
              My documents
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
