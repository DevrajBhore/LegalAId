import { Link } from "react-router-dom";
import { Icons } from "../utils/icons";
import "./LegalPage.css";

const SECTIONS = [
  {
    title: "Information we collect",
    body:
      "We collect the account information you provide to access LegalAId, along with the document inputs, draft content, validation results, and workspace activity required to generate, save, review, and export legal documents within the product.",
  },
  {
    title: "How we use your information",
    body:
      "We use your information to operate the drafting workflow, improve document quality, maintain your saved drafts, deliver validation results, and support account security, support requests, and product reliability.",
  },
  {
    title: "Document content and retention",
    body:
      "Document inputs and saved drafts are stored to power your workspace, document history, validation flow, and exports. We retain this information for as long as it is needed to provide the service, subject to your account activity and deletion actions inside the product.",
  },
  {
    title: "Sharing and disclosures",
    body:
      "We do not publish your private drafts. Information may be processed by service providers that help operate the platform infrastructure, authentication, storage, and communications, but only to the extent needed to provide LegalAId.",
  },
  {
    title: "Security",
    body:
      "We use reasonable technical and operational safeguards to protect account and document data, but no online service can guarantee absolute security. Users should avoid uploading information they are not authorized to process through the platform.",
  },
  {
    title: "Your choices",
    body:
      "You can update account details through your profile, delete saved drafts through the documents area, and use account recovery through the sign-in flow if you lose access to your password.",
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <section className="legal-hero">
        <div className="legal-hero-inner">
          <span className="legal-eyebrow">LEGAL</span>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">
            This page explains how LegalAId handles account information, draft
            content, and workspace data across the drafting, validation, and
            export workflow.
          </p>
          <div className="legal-meta">Last updated | 30 March 2026</div>
        </div>
      </section>

      <section className="legal-content">
        <div className="legal-grid">
          {SECTIONS.map((section) => (
            <article key={section.title} className="legal-card">
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="legal-footer-cta">
        <div className="legal-footer-box">
          <div>
            <h3>Need help with your account or data?</h3>
            <p>
              If you need support around account access, saved drafts, or
              platform usage, you can reach the support flow from Help or Contact.
            </p>
          </div>
          <div className="legal-footer-actions">
            <Link to="/help" className="legal-btn legal-btn--primary">
              Help center {Icons.arrowRight}
            </Link>
            <Link to="/contact" className="legal-btn legal-btn--ghost">
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
