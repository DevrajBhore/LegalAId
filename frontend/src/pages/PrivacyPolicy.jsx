import { Link } from "react-router-dom";
import { Icons } from "../utils/icons";
import "./LegalPage.css";

// Factual corrections from the 26 Sep 2026 launch-compliance audit. Every line
// here describes what the code does today. The full policy is being drafted for
// legal review (docs/legal/PRIVACY_POLICY_DRAFT.md) and will replace this page.
const SECTIONS = [
  {
    title: "Information we collect",
    body:
      "Account details: your name, email address, optional mobile number, and a securely hashed password. Document details: the answers you give in the intake form, which usually include details about other people (the other parties to your document, such as names, addresses, PAN, GSTIN or CIN numbers, and salary or loan amounts), the drafts produced from them, their check results, and messages you send to the drafting assistant.",
  },
  {
    title: "Why we collect it",
    body:
      "Account details let you sign in, verify your email and reset your password. Intake answers are needed to draft your document. Drafts and versions let you return to, edit and export your work. Assistant messages are needed to answer them. We use aggregate counts of missing clauses, with no personal data, to improve the clause library.",
  },
  {
    title: "Who processes it, and where",
    body:
      "To draft and edit documents, your intake answers, drafts and assistant messages are sent to Google (Gemini API) and, if Gemini is unavailable, to Groq. Stored data is kept in MongoDB Atlas. Emails are sent through Resend. The service is hosted on Render and Vercel. These providers process data outside India, including in the United States. We do not sell your data or use it for advertising.",
  },
  {
    title: "How long we keep it",
    body:
      "Your account and saved documents are kept until you delete them or delete your account. We keep up to 20 versions of each saved document. Our AI providers may keep what we send them for a limited time to detect abuse: Google up to 55 days and Groq up to 30 days.",
  },
  {
    title: "Your rights and choices",
    body:
      "From your Profile you can correct your name and mobile number, download everything we hold about you, and delete your account together with all saved documents and versions. You can delete individual drafts from My documents. For anything else, including a complaint about how your data is handled, use the Contact page.",
  },
  {
    title: "Cookies",
    body:
      "We use one cookie: a secure, HTTP-only sign-in cookie that keeps you logged in for up to seven days. The editor keeps your open draft in your browser's session storage until you close the tab. We use no analytics, advertising or tracking cookies. Fonts are served from our own site.",
  },
  {
    title: "Who can use LegalAId",
    body: "You must be 18 or older to create an account.",
  },
  {
    title: "Security",
    body:
      "Passwords are hashed, sessions use a secure HTTP-only cookie, and each account can only reach its own documents. No online service can guarantee absolute security, so only enter information you are entitled to share.",
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
          <div className="legal-meta">Last updated | 26 September 2026</div>
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
