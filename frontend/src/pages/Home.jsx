import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDocumentTypes } from "../services/api";
import "./Home.css";

const FAMILY_ORDER = [
  "Contracts & Commercial",
  "Employment",
  "Property",
  "Corporate",
  "Finance",
];

const FAMILY_MAP = {
  NDA: "Contracts & Commercial",
  SERVICE_AGREEMENT: "Contracts & Commercial",
  CONSULTANCY_AGREEMENT: "Contracts & Commercial",
  SUPPLY_AGREEMENT: "Contracts & Commercial",
  DISTRIBUTION_AGREEMENT: "Contracts & Commercial",
  SALES_OF_GOODS_AGREEMENT: "Contracts & Commercial",
  INDEPENDENT_CONTRACTOR_AGREEMENT: "Contracts & Commercial",
  SOFTWARE_DEVELOPMENT_AGREEMENT: "Contracts & Commercial",
  EMPLOYMENT_CONTRACT: "Employment",
  COMMERCIAL_LEASE_AGREEMENT: "Property",
  LEAVE_AND_LICENSE_AGREEMENT: "Property",
  PARTNERSHIP_DEED: "Corporate",
  SHAREHOLDERS_AGREEMENT: "Corporate",
  JOINT_VENTURE_AGREEMENT: "Corporate",
  LOAN_AGREEMENT: "Finance",
  GUARANTEE_AGREEMENT: "Finance",
};

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDocumentTypes()
      .then((res) => setDocTypes(res.data.types || []))
      .catch(() =>
        setError(
          "Could not connect to backend. Make sure it's running on port 5000."
        )
      )
      .finally(() => setLoading(false));
  }, []);

  const grouped = docTypes.reduce((acc, t) => {
    const family = FAMILY_MAP[t.type] || "Other";
    if (!acc[family]) acc[family] = [];
    acc[family].push(t);
    return acc;
  }, {});

  const families = [
    ...FAMILY_ORDER.filter((f) => grouped[f]),
    ...Object.keys(grouped).filter((f) => !FAMILY_ORDER.includes(f)),
  ];

  return (
    <div className="home-container">
      <div className="home-hero">
        <div className="home-hero-badge">Powered by IndiaCode + IRE</div>
        <h1 className="home-title">
          Legal<em>AI</em>d
        </h1>
        <p className="home-subtitle">
          AI-generated Indian legal documents — validated against 804 Acts in
          real time
        </p>
      </div>

      {loading && (
        <div className="home-loading">
          <div className="spinner"></div>
          <p>Connecting to backend…</p>
        </div>
      )}

      {error && (
        <div className="home-error">
          <span className="error-icon">⚠</span> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="home-families">
          {families.map((family) => (
            <div key={family} className="family-section">
              <h2 className="family-title">{family}</h2>
              <div className="doc-grid">
                {grouped[family].map((t) => (
                  <button
                    key={t.type}
                    className="doc-card"
                    onClick={() => {
                      if (user) {
                        navigate("/form", { state: { document_type: t.type } });
                      } else {
                        navigate("/login", {
                          state: { from: "/form", document_type: t.type },
                        });
                      }
                    }}
                  >
                    <span className="doc-card-name">{t.displayName}</span>
                    <span className="doc-card-arrow">{user ? "→" : "🔒"}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
