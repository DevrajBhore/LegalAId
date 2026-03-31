import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDocumentTypes } from "../services/api";
import { Icons } from "../utils/icons";
import { FAMILY_ICONS, getGroupedCatalog } from "../utils/documentCatalog";
import "./Library.css";

export default function Library() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFamily, setActiveFamily] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getDocumentTypes()
      .then((response) => setDocTypes(response.data?.types || []))
      .catch(() => setError("Could not load the document library right now."))
      .finally(() => setLoading(false));
  }, []);

  const { grouped, families, normalized, shownFamilies } = useMemo(
    () => getGroupedCatalog(docTypes, activeFamily, query),
    [activeFamily, docTypes, query]
  );

  const goToDocument = (type) => {
    if (user) {
      navigate("/form", { state: { document_type: type } });
      return;
    }

    navigate("/login", { state: { from: "/form", document_type: type } });
  };

  return (
    <div className="library-page">
      <section className="library-hero">
        <div className="library-hero-copy">
          <span className="library-eyebrow">DOCUMENT LIBRARY</span>
          <h1 className="library-title">Choose the right legal document with clarity</h1>
          <p className="library-sub">
            Browse the full LegalAId catalog, pick the document you need, and move
            into a structured drafting flow built for Indian legal work.
          </p>

          <div className="library-hero-actions">
            {user ? (
              <Link to="/documents" className="library-btn library-btn--primary">
                Saved drafts {Icons.arrowRight}
              </Link>
            ) : (
              <Link to="/register" className="library-btn library-btn--primary">
                Create free account {Icons.arrowRight}
              </Link>
            )}

            <Link to="/" className="library-btn library-btn--ghost">
              Back home
            </Link>
          </div>
        </div>

        <div className="library-hero-panel">
          <div className="library-hero-stat">
            <span className="library-hero-stat-label">Available now</span>
            <strong>{docTypes.length || "17"} document types</strong>
          </div>
          <div className="library-hero-stat">
            <span className="library-hero-stat-label">Drafting flow</span>
            <strong>Structured intake, review, validation, export</strong>
          </div>
          <div className="library-hero-stat">
            <span className="library-hero-stat-label">Workspace</span>
            <strong>Edit clauses in browser and validate before download</strong>
          </div>
        </div>
      </section>

      <section className="library-browser">
        <div className="library-browser-head">
          <div>
            <span className="library-browser-eyebrow">Browse all templates</span>
            <h2 className="library-browser-title">Full catalog</h2>
          </div>

          <div className="library-search-wrap">
            <span className="library-search-icon">{Icons.search}</span>
            <input
              className="library-search"
              type="text"
              placeholder="Search by document name or type"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {!loading && !error && (
          <div className="library-filters">
            <button
              className={`library-filter${!activeFamily ? " library-filter--active" : ""}`}
              onClick={() => setActiveFamily(null)}
            >
              All
            </button>
            {families.map((family) => (
              <button
                key={family}
                className={`library-filter${activeFamily === family ? " library-filter--active" : ""}`}
                onClick={() => setActiveFamily((current) => (current === family ? null : family))}
              >
                <span className="library-filter-icon">{FAMILY_ICONS[family] || Icons.fileText}</span>
                {family}
              </button>
            ))}
          </div>
        )}

        {normalized && !loading && (
          <p className="library-search-note">Results for "{query}"</p>
        )}

        {loading ? (
          <div className="library-state">
            <div className="spinner" />
            <span>Loading document library...</span>
          </div>
        ) : error ? (
          <div className="library-state library-state--error">
            <span className="library-state-icon">{Icons.warning}</span>
            <span>{error}</span>
          </div>
        ) : shownFamilies.length === 0 ? (
          <div className="library-state">
            <span className="library-state-icon">{Icons.fileText}</span>
            <span>No documents match your search yet.</span>
          </div>
        ) : (
          <div className="library-groups">
            {shownFamilies.map((family, familyIndex) => (
              <section key={family} className="library-group">
                <div className="library-group-head">
                  <span className="library-group-icon">
                    {FAMILY_ICONS[family] || Icons.fileText}
                  </span>
                  <div>
                    <div className="library-group-kicker">Category</div>
                    <h3 className="library-group-title">{family}</h3>
                  </div>
                </div>

                <div className="library-grid">
                  {(grouped[family] || []).map((type, index) => (
                    <button
                      key={type.type}
                      className="library-card"
                      onClick={() => goToDocument(type.type)}
                      style={{ animationDelay: `${familyIndex * 50 + index * 20}ms` }}
                    >
                      <div className="library-card-icon">{Icons.fileText}</div>
                      <div className="library-card-copy">
                        <span className="library-card-title">{type.displayName}</span>
                        <span className="library-card-subtitle">
                          {type.type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="library-card-arrow">{Icons.arrowRight}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
