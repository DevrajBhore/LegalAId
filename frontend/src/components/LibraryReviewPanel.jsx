import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getLibraryReview,
  recordLibraryReview,
} from "../services/api";
import { Scales, Search } from "../utils/icons";
import "./LibraryReviewPanel.css";

/**
 * Advocate review of the clauses already shipping in generated documents.
 *
 * Distinct from the candidate queue on this page, which handles text waiting to
 * be promoted INTO the library. Clauses here are live, and none of them carried
 * a reviewer.
 *
 * Rows are ordered by how many document types render each clause, so a partial
 * review still covers what users actually receive. Progress is reported the same
 * way — as a share of clause placements, not as a count of files ticked.
 */

const STATE_FILTERS = [
  { key: "outstanding", label: "Outstanding" },
  { key: "approved", label: "Approved" },
  { key: "", label: "All" },
];

const DECISIONS = [
  { key: "approve", label: "Approve", tone: "approve" },
  { key: "amend", label: "Approve with amendment", tone: "amend" },
  { key: "reject", label: "Reject", tone: "reject" },
  { key: "discuss", label: "Needs discussion", tone: "discuss" },
];

export default function LibraryReviewPanel() {
  const [clauses, setClauses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stateFilter, setStateFilter] = useState("outstanding");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getLibraryReview({
        state: stateFilter || undefined,
        search: search.trim() || undefined,
      });
      setClauses(res.data?.clauses || []);
      setSummary(res.data?.summary || null);
    } catch (err) {
      setError(
        err?.response?.status === 403
          ? "Administrator access required to review the clause library."
          : "Could not load the clause library."
      );
    } finally {
      setLoading(false);
    }
  }, [stateFilter, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const draftFor = (clauseId) => drafts[clauseId] || { revised_text: "", note: "" };
  const setDraft = (clauseId, patch) =>
    setDrafts((prev) => ({ ...prev, [clauseId]: { ...draftFor(clauseId), ...patch } }));

  const decide = async (clause, decision) => {
    if (busyId) return;
    const draft = draftFor(clause.clause_id);

    if (decision === "amend" && !draft.revised_text.trim()) {
      setError("Approving with an amendment needs the revised clause text.");
      return;
    }

    setBusyId(clause.clause_id);
    setError("");
    try {
      const res = await recordLibraryReview(clause.clause_id, {
        decision,
        revised_text: draft.revised_text,
        note: draft.note,
      });
      setSummary(res.data?.summary || summary);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[clause.clause_id];
        return next;
      });
      setExpanded(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not record that decision.");
    } finally {
      setBusyId(null);
    }
  };

  // How far a reviewer gets for a given number of clauses, so the size of the
  // task is visible before starting rather than after.
  const milestones = useMemo(() => {
    if (!clauses.length) return [];
    const total = summary?.placements || 0;
    if (!total) return [];
    let running = 0;
    const marks = [];
    clauses.forEach((clause, index) => {
      running += clause.reach;
      if ([9, 19, 49].includes(index)) {
        marks.push({ n: index + 1, percent: Math.round((running / total) * 100) });
      }
    });
    return marks;
  }, [clauses, summary]);

  return (
    <section className="admin-panel lib-review">
      <div className="admin-panel-head admin-panel-head--row">
        <div>
          <h2>Clause library review</h2>
          <p>
            The clauses already shipping in generated documents. Ordered by how
            much of the product each one touches.
          </p>
        </div>
        <button className="admin-btn" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {summary && (
        <div className="lib-coverage">
          <div className="lib-coverage-bar">
            <div
              className="lib-coverage-fill"
              style={{ width: `${summary.coverage_percent}%` }}
            />
          </div>
          <div className="lib-coverage-stats">
            <strong>{summary.coverage_percent}%</strong> of clause usage reviewed
            <span>
              {summary.reviewed} of {summary.total} clauses signed off
              {summary.unused > 0 && ` · ${summary.unused} unused`}
            </span>
          </div>
          {milestones.length > 0 && summary.coverage_percent === 0 && (
            <p className="lib-hint">
              {milestones
                .map((m) => `first ${m.n} clauses cover ${m.percent}%`)
                .join(" · ")}
            </p>
          )}
        </div>
      )}

      <div className="lib-controls">
        <div className="lib-filters">
          {STATE_FILTERS.map((f) => (
            <button
              key={f.key || "all"}
              className={`admin-chip${stateFilter === f.key ? " admin-chip--on" : ""}`}
              onClick={() => setStateFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="lib-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clause id, title or text"
          />
        </div>
      </div>

      {error && <div className="admin-error">{error}</div>}

      {!loading && clauses.length === 0 && (
        <p className="admin-note">
          {stateFilter === "outstanding"
            ? "Nothing outstanding — every clause in this view has been signed off."
            : "No clauses match."}
        </p>
      )}

      <ul className="lib-list">
        {clauses.map((clause) => {
          const open = expanded === clause.clause_id;
          const draft = draftFor(clause.clause_id);
          const busy = busyId === clause.clause_id;

          return (
            <li key={clause.clause_id} className="lib-row">
              <button
                className="lib-row-head"
                onClick={() => setExpanded(open ? null : clause.clause_id)}
              >
                <span className="lib-row-title">
                  {clause.title}
                  <code>{clause.clause_id}</code>
                </span>
                <span className="lib-row-meta">
                  <span className="lib-reach" title="Document types rendering this clause">
                    {clause.reach} doc{clause.reach === 1 ? "" : "s"}
                  </span>
                  {clause.risk_level && (
                    <span className={`lib-risk lib-risk--${clause.risk_level.toLowerCase()}`}>
                      {clause.risk_level}
                    </span>
                  )}
                  {clause.mandatory && <span className="lib-mandatory">mandatory</span>}
                  <span className={`lib-state lib-state--${clause.reviewed ? "ok" : "open"}`}>
                    {clause.reviewed ? `signed ${clause.reviewed_by}` : clause.review_state}
                  </span>
                </span>
              </button>

              {open && (
                <div className="lib-row-body">
                  {clause.document_types.length > 0 && (
                    <p className="lib-docs">
                      Appears in: {clause.document_types.join(", ")}
                    </p>
                  )}
                  {clause.legal_basis?.length > 0 && (
                    <p className="lib-basis">
                      <Scales size={12} />{" "}
                      {clause.legal_basis
                        .map((b) => `${b.act || ""}${b.section ? ` s.${b.section}` : ""}`)
                        .join("; ")}
                    </p>
                  )}

                  <pre className="lib-text">{clause.text}</pre>

                  {clause.review_note && (
                    <p className="lib-prior-note">Previous note: {clause.review_note}</p>
                  )}

                  <label className="lib-field">
                    Revised text
                    <span className="lib-optional">
                      only when approving with an amendment · blank line between
                      sub-clauses, they are renumbered automatically
                    </span>
                    <textarea
                      rows={6}
                      value={draft.revised_text}
                      onChange={(e) =>
                        setDraft(clause.clause_id, { revised_text: e.target.value })
                      }
                      placeholder="Paste the clause as it should read"
                    />
                  </label>

                  <label className="lib-field">
                    Note <span className="lib-optional">optional</span>
                    <input
                      value={draft.note}
                      onChange={(e) => setDraft(clause.clause_id, { note: e.target.value })}
                      placeholder="Why, or what needs changing elsewhere"
                    />
                  </label>

                  <div className="lib-actions">
                    {DECISIONS.map((d) => (
                      <button
                        key={d.key}
                        className={`admin-btn lib-btn--${d.tone}`}
                        disabled={busy}
                        onClick={() => decide(clause, d.key)}
                      >
                        {busy ? "Saving…" : d.label}
                      </button>
                    ))}
                    {clause.reviewed && (
                      <button
                        className="admin-btn lib-btn--reset"
                        disabled={busy}
                        onClick={() => decide(clause, "reset")}
                      >
                        Withdraw sign-off
                      </button>
                    )}
                  </div>

                  <p className="lib-caveat">
                    Rejecting or flagging records the outcome but does not mark the
                    clause reviewed — it stays in the outstanding list.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
