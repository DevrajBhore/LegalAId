import { useEffect, useState } from "react";
import {
  getClauseReviews,
  importMinedClauses,
  setClauseReviewStatus,
  promoteClauseReview,
  proposeClauseAuthoring,
  getDocumentTypes,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Scales, ArrowRight } from "../utils/icons";
import "./AdminClauses.css";

const STATUS_FILTERS = ["pending", "approved", "rejected", "promoted"];

export default function AdminClauses() {
  const { user } = useAuth();
  const [docTypes, setDocTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");
  const [proposing, setProposing] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [proposeNote, setProposeNote] = useState("");

  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    getDocumentTypes()
      .then((res) => {
        const types = res.data?.types || [];
        setDocTypes(types);
        if (types[0]) setSelectedType(types[0].type);
      })
      .catch(() => {});
  }, []);

  const loadReviews = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getClauseReviews({ status: statusFilter });
      setReviews(res.data?.reviews || []);
    } catch (err) {
      setError(
        err?.response?.status === 403
          ? "Administrator access required to view the clause review queue."
          : "Could not load the review queue."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const propose = async () => {
    if (!selectedType || proposing) return;
    setProposing(true);
    setProposeNote("");
    setProposals([]);
    try {
      const res = await proposeClauseAuthoring(selectedType);
      const data = res.data || {};
      setProposals(data.proposals || []);
      setProposeNote(
        data.available === false
          ? "The AI is temporarily unavailable. Try again shortly."
          : `${data.proposals?.length || 0} proposal(s); ${data.queuedForReview || 0} new draft(s) queued for review.`
      );
      if (statusFilter === "pending") loadReviews();
    } catch (err) {
      setProposeNote(
        err?.response?.data?.error || "Proposal request failed. Check you are an admin."
      );
    } finally {
      setProposing(false);
    }
  };

  const runAction = async (id, fn) => {
    setActionId(id);
    try {
      await fn();
      await loadReviews();
    } catch (err) {
      setError(err?.response?.data?.error || "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  const importMined = () =>
    runAction("import", async () => {
      await importMinedClauses();
    });

  if (user && user.isAdmin === false) {
    return (
      <div className="admin-clauses">
        <div className="admin-error">Administrator access required.</div>
      </div>
    );
  }

  return (
    <div className="admin-clauses">
      <header className="admin-head">
        <span className="admin-kicker">Admin · Clause governance</span>
        <h1 className="admin-title">Clause authoring &amp; review</h1>
        <p className="admin-sub">
          AI proposes missing protections; you approve. Nothing reaches the
          production clause library without sign-off here.
        </p>
      </header>

      {/* AI authoring */}
      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>AI gap analysis</h2>
          <p>Ask the AI which protections a document type is missing.</p>
        </div>
        <div className="admin-propose-row">
          <select
            className="admin-select"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            {docTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.displayName || t.type}
              </option>
            ))}
          </select>
          <button className="admin-btn admin-btn--primary" onClick={propose} disabled={proposing}>
            {proposing ? "Analyzing…" : "Propose missing protections"}
          </button>
        </div>
        {proposeNote && <p className="admin-note">{proposeNote}</p>}
        {proposals.length > 0 && (
          <ul className="admin-proposals">
            {proposals.map((p, i) => (
              <li key={i} className="admin-proposal">
                <div className="admin-proposal-top">
                  <span className="admin-proposal-name">{p.protection}</span>
                  <span className={`admin-kind admin-kind--${p.kind}`}>
                    {p.kind === "reuse" ? `reuse ${p.clause_id}` : "new draft"}
                  </span>
                </div>
                <p className="admin-proposal-why">{p.why}</p>
                <div className="admin-proposal-meta">
                  {p.legal_basis && (
                    <span className="admin-meta-item">
                      <Scales size={12} /> {p.legal_basis}
                    </span>
                  )}
                  <span>when: {p.rule_when}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Review queue */}
      <section className="admin-panel">
        <div className="admin-panel-head admin-panel-head--row">
          <div>
            <h2>Review queue</h2>
            <p>Mined + AI-proposed clauses awaiting decision.</p>
          </div>
          <button
            className="admin-btn"
            onClick={importMined}
            disabled={actionId === "import"}
          >
            {actionId === "import" ? "Importing…" : "Import mined clauses"}
          </button>
        </div>

        <div className="admin-filters">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              className={`admin-chip${statusFilter === s ? " admin-chip--active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {error && <div className="admin-error">{error}</div>}
        {loading ? (
          <div className="admin-empty">Loading…</div>
        ) : reviews.length === 0 ? (
          <div className="admin-empty">No {statusFilter} clauses.</div>
        ) : (
          <ul className="admin-reviews">
            {reviews.map((r) => (
              <li key={r.id} className="admin-review">
                <div className="admin-review-main">
                  <div className="admin-review-top">
                    <span className="admin-review-cat">{r.category}</span>
                    {r.clauseName && <span className="admin-review-name">{r.clauseName}</span>}
                    <span className={`admin-status admin-status--${r.status}`}>{r.status}</span>
                  </div>
                  <p className={`admin-review-preview${expanded.has(r.id) ? " admin-review-preview--full" : ""}`}>
                    {expanded.has(r.id) ? r.text : r.textPreview}
                  </p>
                  {(r.text || "").length > 240 && (
                    <button
                      type="button"
                      className="admin-readmore"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          next.has(r.id) ? next.delete(r.id) : next.add(r.id);
                          return next;
                        })
                      }
                    >
                      {expanded.has(r.id) ? "Show less" : "Read full clause"}
                    </button>
                  )}
                  {r.sourceDocumentName && (
                    <span className="admin-review-src">{r.sourceDocumentName}</span>
                  )}
                </div>
                <div className="admin-review-actions">
                  {r.status === "pending" && (
                    <>
                      <button
                        className="admin-btn admin-btn--ok"
                        disabled={actionId === r.id}
                        onClick={() =>
                          runAction(r.id, () => setClauseReviewStatus(r.id, { status: "approved" }))
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="admin-btn admin-btn--no"
                        disabled={actionId === r.id}
                        onClick={() =>
                          runAction(r.id, () => setClauseReviewStatus(r.id, { status: "rejected" }))
                        }
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <button
                      className="admin-btn admin-btn--primary"
                      disabled={actionId === r.id}
                      onClick={() => runAction(r.id, () => promoteClauseReview(r.id))}
                    >
                      Promote
                    </button>
                  )}
                  {r.status === "promoted" && r.promotedClauseId && (
                    <span className="admin-promoted">
                      <ArrowRight size={12} /> {r.promotedClauseId}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
