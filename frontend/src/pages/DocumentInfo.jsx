import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getDocumentInfo,
  INFORMATIONAL_DISCLAIMER,
} from "../data/documentInfo";
import { getDocumentFormPath } from "../utils/documentCatalog";
import { Icons } from "../utils/icons";
import MobileActionBar from "../components/MobileActionBar";
import "./DocumentInfo.css";

function normalizeDocumentType(type = "") {
  return decodeURIComponent(type).trim().toUpperCase();
}

function humanizeType(type = "") {
  return String(type || "Legal Document")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildFallbackInfo(type) {
  const title = humanizeType(type);

  return {
    title,
    tagline: "Review the purpose, key clauses, and intake steps before drafting.",
    whatIsIt:
      "This document type is available for drafting, but its editorial explainer content has not been customized yet.",
    whyNeeded:
      "The explainer page helps you understand what information the form will ask for and why those details matter before the draft is generated.",
    commonUses: [
      "Preparing a structured legal draft",
      "Understanding the form inputs before generation",
      "Reviewing key commercial and legal terms",
    ],
    keyClauses: [
      "Party identification",
      "Commercial terms",
      "Risk allocation",
      "Termination",
      "Dispute resolution",
      "Signature blocks",
    ],
    howToGenerate: [
      "Continue to the form.",
      "Fill each required field with complete and accurate details.",
      "Review the generated clauses and validation results before export.",
    ],
    informationNeeded: [
      "Party names, addresses, and legal status",
      "Commercial terms, dates, amounts, and duration",
      "Any special obligations, protections, or risk terms",
    ],
    legalNotes: [
      "The generated draft should be reviewed against the actual transaction facts.",
      "Stamping, registration, and local compliance can depend on state and document type.",
    ],
    commonMistakes: [
      "Using incomplete party details",
      "Leaving dates, amounts, or obligations vague",
      "Exporting before validation issues are resolved",
    ],
    reviewChecklist: [
      "All required fields are filled",
      "No placeholder text remains",
      "Party names, dates, and amounts are consistent",
      "The document has been validated before export",
    ],
    timeEstimate: "5 to 10 minutes",
    faqs: [
      {
        q: "Can I still generate this document?",
        a: "Yes. This page is informational only. The form and drafting pipeline can still run for the selected document type if it is configured in LegalAId.",
      },
      {
        q: "Is this page legal advice?",
        a: "No. It is general product guidance and should not replace review by a qualified lawyer.",
      },
    ],
    disclaimer: INFORMATIONAL_DISCLAIMER,
  };
}

function InfoList({ items = [], ordered = false }) {
  const Tag = ordered ? "ol" : "ul";

  return (
    <Tag className={`document-info-list${ordered ? " document-info-list--ordered" : ""}`}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </Tag>
  );
}

function ContentSection({ title, kicker, children }) {
  return (
    <section className="document-info-section">
      <span className="document-info-section-kicker">{kicker}</span>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function DocumentInfo() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const documentType = normalizeDocumentType(type);
  const content = getDocumentInfo(documentType) || buildFallbackInfo(documentType);
  const generateLabel = `Generate ${content.title}`;

  const goToForm = () => {
    const formPath = getDocumentFormPath(documentType);

    if (user) {
      navigate(formPath, { state: { document_type: documentType } });
      return;
    }

    navigate("/login", {
      state: { from: formPath, document_type: documentType },
    });
  };

  return (
    <div className="document-info-page has-mobile-action-bar">
      <section className="document-info-hero">
        <div className="document-info-hero-inner">
          <Link to="/library" className="document-info-back">
            {Icons.arrowLeft} Back to documents
          </Link>

          <span className="document-info-eyebrow animate-in">
            DOCUMENT GUIDE
          </span>
          <h1 className="document-info-title animate-in-d1">
            {content.title}
          </h1>
          <p className="document-info-tagline animate-in-d2">
            {content.tagline}
          </p>

          <div className="document-info-quick animate-in-d3">
            <div>
              <span>Estimated time</span>
              <strong>{content.timeEstimate}</strong>
            </div>
            <div>
              <span>Jurisdiction focus</span>
              <strong>India</strong>
            </div>
            <div>
              <span>Drafting path</span>
              <strong>Guide, form, validation, export</strong>
            </div>
          </div>
        </div>
      </section>

      <main className="document-info-main">
        <div className="document-info-layout">
          <article className="document-info-reader animate-in">
            <ContentSection title="What this document is" kicker="Overview">
              <p>{content.whatIsIt}</p>
            </ContentSection>

            <ContentSection title="Why it is needed" kicker="Purpose">
              <p>{content.whyNeeded}</p>
            </ContentSection>

            <ContentSection title="Common use cases" kicker="Use cases">
              <InfoList items={content.commonUses} />
            </ContentSection>

            <ContentSection title="Information you should keep ready" kicker="Inputs">
              <InfoList items={content.informationNeeded || []} />
            </ContentSection>

            <ContentSection title="Key clauses LegalAId will focus on" kicker="Clauses">
              <InfoList items={content.keyClauses} />
            </ContentSection>

            <ContentSection title="India-specific legal notes" kicker="Legal context">
              <InfoList items={content.legalNotes || []} />
            </ContentSection>

            <ContentSection title="Common mistakes to avoid" kicker="Quality">
              <InfoList items={content.commonMistakes || []} />
            </ContentSection>

            <ContentSection title="How to generate it" kicker="Next steps">
              <InfoList items={content.howToGenerate} ordered />
            </ContentSection>

            <ContentSection title="Review checklist before export" kicker="Checklist">
              <InfoList items={content.reviewChecklist || []} />
            </ContentSection>

            <section className="document-info-section">
              <span className="document-info-section-kicker">FAQs</span>
              <h2>Before you start</h2>
              <div className="document-info-faq-list">
                {content.faqs.map((faq) => (
                  <details key={faq.q} className="document-info-faq-item">
                    <summary>{faq.q}</summary>
                    <p>{faq.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="document-info-disclaimer">
              <span className="document-info-disclaimer-icon">{Icons.info}</span>
              <p>{content.disclaimer || INFORMATIONAL_DISCLAIMER}</p>
            </section>
          </article>

          <aside className="document-info-side animate-in-d1">
            <div className="document-info-side-box">
              <span className="document-info-section-kicker">Start drafting</span>
              <h2>{content.title}</h2>
              <p>
                Read the guide, then continue to the structured intake form for
                this document.
              </p>
              <button
                type="button"
                className="document-info-primary"
                onClick={goToForm}
              >
                {generateLabel} {Icons.arrowRight}
              </button>
              <Link to="/library" className="document-info-secondary">
                Back to documents
              </Link>
            </div>
          </aside>
        </div>
      </main>

      <MobileActionBar
        label={generateLabel}
        onClick={goToForm}
        hint="Guide · form · export"
        trailing={Icons.arrowRight}
      />
    </div>
  );
}
