import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDocumentTypes } from "../services/api";
import { Icons } from "../utils/icons";
import { getFeaturedDocumentTypes } from "../utils/documentCatalog";
import "./Home.css";

const FEATURES = [
  {
    icon: Icons.sparkles,
    title: "AI-Drafted Clauses",
    body: "AI drafts every clause using your exact inputs. No blanks and no placeholders.",
  },
  {
    icon: Icons.shieldCheck,
    title: "Legal Validation",
    body: "Built-in Indian legal validation checks structure, key terms, and drafting quality before you download.",
  },
  {
    icon: Icons.scroll,
    title: "Browser Editing",
    body: "Edit any clause directly in the workspace. AI helps refine flagged issues.",
  },
  {
    icon: Icons.download,
    title: "DOCX Export",
    body: "Execution-ready Word documents with signature blocks and clean formatting.",
  },
];

const HOW_STEPS = [
  {
    icon: Icons.fileText,
    title: "Choose a document",
    body: "Start from the library and select the Indian legal document that matches your transaction.",
  },
  {
    icon: Icons.settings,
    title: "Fill the intake form",
    body: "Enter the legal, commercial, and party details needed for that document type.",
  },
  {
    icon: Icons.scroll,
    title: "Review in workspace",
    body: "Read through the draft, edit clauses, and use AI assistance where you need refinement.",
  },
  {
    icon: Icons.download,
    title: "Validate and export",
    body: "Run the final validation, review the result, and then export the DOCX when it is ready.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDocumentTypes()
      .then((response) => setDocTypes(response.data?.types || []))
      .catch(() => setError("Could not connect. Make sure the backend is running."))
      .finally(() => setLoading(false));
  }, []);

  const featuredDocs = useMemo(
    () => getFeaturedDocumentTypes(docTypes, 6),
    [docTypes]
  );

  const goToDocument = (type) =>
    user
      ? navigate("/form", { state: { document_type: type } })
      : navigate("/login", { state: { from: "/form", document_type: type } });

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-noise" />
        </div>
        <div className="hero-inner">
          <div className="hero-eyebrow animate-in">
            <span className="hero-eyebrow-dot" />
            AI DRAFTING | INDIAN LEGAL KNOWLEDGE | LEGAL VALIDATION
          </div>
          <h1 className="hero-title animate-in-d1">
            Draft legally sound
            <em className="hero-title-line2"> Indian documents</em>
            <span className="hero-title-line2"> in minutes</span>
          </h1>
          <p className="hero-sub animate-in-d2">
            AI-drafted contracts built with Indian legal knowledge and validated before export.
            Edit clauses in your browser, then export a clean DOCX.
          </p>
          <div className="hero-cta animate-in-d3">
            <button
              className="hero-btn-primary"
              onClick={() => navigate("/library")}
            >
              Browse documents {Icons.arrowRight}
            </button>
            <Link to="/about" className="hero-btn-ghost">
              How it works
            </Link>
          </div>
          <div className="hero-stats animate-in-d4">
            <div className="hero-stat">
              <span className="hero-stat-num">{docTypes.length || 17}+</span>
              <span className="hero-stat-label">Document types</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">100%</span>
              <span className="hero-stat-label">India-focused drafting</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-num">LIVE</span>
              <span className="hero-stat-label">Browser workspace</span>
            </div>
          </div>
        </div>
      </section>

      <section className="features-strip">
        <div className="features-inner">
          <div className="features-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <div className="feature-title">{feature.title}</div>
                <div className="feature-body">{feature.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-showcase">
        <div className="home-showcase-inner">
          <div className="home-showcase-head animate-in">
            <div>
              <span className="section-eyebrow">Featured Documents</span>
              <h2 className="section-title">Start with the most-used drafting flows</h2>
              <p className="section-body">
                Keep Home focused. Use the full library when you need the complete catalog.
              </p>
            </div>

            <Link to="/library" className="home-showcase-link">
              View full library {Icons.arrowRight}
            </Link>
          </div>

          {loading ? (
            <div className="home-showcase-state">
              <div className="spinner" />
              <span>Loading featured documents...</span>
            </div>
          ) : error ? (
            <div className="home-showcase-state home-showcase-state--error">
              <span className="home-showcase-state-icon">{Icons.warning}</span>
              <span>{error}</span>
            </div>
          ) : (
            <div className="home-showcase-grid">
              {featuredDocs.map((type) => (
                <button
                  key={type.type}
                  className="home-showcase-card"
                  onClick={() => goToDocument(type.type)}
                >
                  <div className="home-showcase-card-icon">{Icons.fileText}</div>
                  <div className="home-showcase-card-copy">
                    <span className="home-showcase-card-title">{type.displayName}</span>
                    <span className="home-showcase-card-subtitle">
                      {type.family || "Legal"} | {type.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="home-showcase-card-arrow">{Icons.arrowRight}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="how-section">
        <div className="how-inner">
          <div className="section-head animate-in">
            <span className="section-eyebrow">Workflow</span>
            <h2 className="section-title">From intake to execution</h2>
            <p className="section-body">
              Four steps from blank page to a validated, downloadable Indian legal document.
            </p>
          </div>
          <div className="how-grid">
            {HOW_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="how-card animate-in"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <span className="how-num">{String(index + 1).padStart(2, "0")}</span>
                <div className="how-icon">{step.icon}</div>
                <div className="how-title">{step.title}</div>
                <div className="how-body">{step.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cta-banner animate-in">
        <h2 className="cta-banner-title">Ready to draft your first document?</h2>
        <p className="cta-banner-sub">
          Browse the full library, choose the right template, and move into the drafting workspace.
        </p>
        <div className="cta-banner-actions">
          {user ? (
            <button
              className="hero-btn-primary"
              onClick={() => navigate("/library")}
            >
              Browse documents {Icons.arrowRight}
            </button>
          ) : (
            <Link to="/register" className="hero-btn-primary">
              Create free account {Icons.arrowRight}
            </Link>
          )}
          <Link to="/help" className="hero-btn-ghost">
            Learn more
          </Link>
        </div>
      </div>
    </div>
  );
}
