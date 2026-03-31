import { Link } from "react-router-dom";
import { Icons } from "../utils/icons";
import "./About.css";

const PILLARS = [
  {
    icon: Icons.sparkles,
    title: "AI-First Drafting",
    body: "AI drafts every clause from your exact inputs. No blanks, no lorem ipsum, and no placeholder language.",
  },
  {
    icon: Icons.shieldCheck,
    title: "Legal Validation",
    body: "Every document passes through layered Indian legal validation that checks structure, variable correctness, and drafting quality before export.",
  },
  {
    icon: Icons.scroll,
    title: "Browser-Native Editing",
    body: "Edit clauses directly in the workspace. Ask AI to strengthen language, adjust terms, or fix flagged issues.",
  },
  {
    icon: Icons.download,
    title: "Export-Ready Output",
    body: "When everything passes, download a court-ready DOCX with signature blocks, stamp duty notices, and Indian legal formatting baked in.",
  },
];

const ACTS = [
  "Indian Contract Act, 1872",
  "Transfer of Property Act, 1882",
  "Companies Act, 2013",
  "Arbitration & Conciliation Act, 1996",
  "IT Act, 2000",
  "Digital Personal Data Protection Act, 2023",
  "Registration Act, 1908",
  "Indian Stamp Act, 1899",
  "Shops & Establishments Act",
  "Payment of Wages Act, 1936",
  "Maternity Benefit Act, 1961",
  "Bonded Labour (Abolition) Act, 1976",
];

const TEAM_VALUES = [
  {
    title: "Accuracy first",
    body: "Every output is grounded in document rules, validation checks, and Indian legal drafting standards. We do not guess.",
  },
  {
    title: "Lawyers-first design",
    body: "Built for practitioners who review serious documents, not for generic copy generation.",
  },
  {
    title: "Open by default",
    body: "Free for individuals. Core drafting stays accessible, while teams can expand with enterprise workflows when needed.",
  },
];

export default function About() {
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-hero-inner">
          <span className="about-eyebrow animate-in">ABOUT LEGALAID</span>
          <h1 className="about-hero-title animate-in-d1">
            Intelligent drafting for
            <br />
            <em>Indian legal practice</em>
          </h1>
          <p className="about-hero-sub animate-in-d2">
            LegalAId is a drafting workspace built exclusively for Indian law - not adapted from a foreign template and not a generic document generator. Every blueprint, every rule, and every validation layer is shaped for Indian legal work.
          </p>
        </div>
      </section>

      <section className="about-pillars">
        <div className="about-inner">
          <div className="about-pillars-grid">
            {PILLARS.map((pillar, index) => (
              <div
                key={pillar.title}
                className="about-pillar animate-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="about-pillar-icon">{pillar.icon}</div>
                <h3 className="about-pillar-title">{pillar.title}</h3>
                <p className="about-pillar-body">{pillar.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-acts">
        <div className="about-inner">
          <div className="about-acts-grid">
            <div className="about-acts-copy animate-in">
              <span className="about-section-eyebrow">Legal Coverage</span>
              <h2 className="about-section-title">Built for Indian law.</h2>
              <p className="about-section-body">
                LegalAId does more than check formatting. It uses Indian legal knowledge, document-specific rules, and validation checks to keep every draft grounded in Indian legal practice.
              </p>
              <div className="about-acts-stat">
                <span className="about-acts-num">India-first</span>
                <span className="about-acts-label">
                  Drafting and validation built specifically for Indian legal work
                </span>
              </div>
            </div>
            <div className="about-acts-tags animate-in-d2">
              {ACTS.map((act) => (
                <span key={act} className="about-act-tag">{act}</span>
              ))}
              <span className="about-act-tag about-act-more">And other applicable Indian laws</span>
            </div>
          </div>
        </div>
      </section>

      <section className="about-values">
        <div className="about-inner">
          <span className="about-section-eyebrow animate-in">Our Principles</span>
          <h2 className="about-section-title animate-in-d1">How we build</h2>
          <div className="about-values-grid animate-in-d2">
            {TEAM_VALUES.map((value) => (
              <div key={value.title} className="about-value-card">
                <div className="about-value-check">{Icons.check}</div>
                <h4>{value.title}</h4>
                <p>{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="about-cta">
        <div className="about-inner">
          <div className="about-cta-box animate-in">
            <h2 className="about-cta-title">Ready to start drafting?</h2>
            <p className="about-cta-sub">Free to use. No credit card. 16+ document types.</p>
            <div className="about-cta-actions">
              <Link to="/register" className="about-cta-btn-primary">
                Create free account {Icons.arrowRight}
              </Link>
              <Link to="/library" className="about-cta-btn-ghost">Browse documents</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
