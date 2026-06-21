import { useState } from "react";
import { Scales, ShieldCheck, AlertTriangle, ChevronRight, CheckCircle, Download } from "../utils/icons";
import { downloadICS } from "../utils/ics";
import "./DocumentIntelligence.css";

function formatDate(iso) {
  if (!iso) return "recurring";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Renders the advisory "risk & explainability" report the backend attaches to a
// generated document (res.data.intelligence). Surfaces WHY each clause is there,
// what law backs it, what's been litigated, and cross-clause conflicts — the
// proof a raw chatbot's prose cannot give. Advisory only; never blocks export.
function riskTone(score) {
  if (score == null) return "neutral";
  if (score >= 90) return "ok";
  if (score >= 70) return "warn";
  return "bad";
}

export default function DocumentIntelligence({ intelligence, obligations, validation, documentTitle = "Agreement" }) {
  const [open, setOpen] = useState(() => new Set());
  if (!intelligence) {
    return (
      <div className="di-empty">
        Document insights appear here after generation — risk, the law each clause
        rests on, and any cross-clause conflicts.
      </div>
    );
  }

  const { overall = {}, clauses = [], conflicts = [] } = intelligence;
  // Keep the headline score live with the latest validation if present.
  const score = validation?.score ?? overall.risk_score;
  const certified = validation?.certified ?? overall.certified;
  const tone = riskTone(score);
  const enf = overall.enforceability || { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="di">
      {/* ── Overall ─────────────────────────────────────────────── */}
      <div className={`di-score di-score--${tone}`}>
        <div className="di-score__num">{score != null ? score : "—"}</div>
        <div className="di-score__meta">
          <span className="di-score__label">
            {certified ? (
              <>
                <ShieldCheck size={13} /> {overall.certification || "Certified"}
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> Review required
              </>
            )}
          </span>
          <span className="di-score__sub">
            {overall.clause_count} clauses · {overall.risk_level || "risk"} risk
          </span>
        </div>
      </div>

      <div className="di-stats">
        <div className="di-stat">
          <span className="di-stat__k">Enforceability</span>
          <span className="di-stat__v">
            <em className="di-pill di-pill--ok">{enf.HIGH} high</em>
            {enf.MEDIUM ? <em className="di-pill di-pill--warn">{enf.MEDIUM} med</em> : null}
            {enf.LOW ? <em className="di-pill di-pill--bad">{enf.LOW} low</em> : null}
          </span>
        </div>
        <div className="di-stat">
          <span className="di-stat__k">Grounded in</span>
          <span className="di-stat__v">{(overall.statutes_referenced || []).length} statutes</span>
        </div>
        {(overall.tax_flags?.tds || overall.tax_flags?.gst || overall.tax_flags?.msme_sensitive) && (
          <div className="di-stat">
            <span className="di-stat__k">Tax / compliance</span>
            <span className="di-stat__v">
              {overall.tax_flags.tds && <em className="di-pill">TDS</em>}
              {overall.tax_flags.gst && <em className="di-pill">GST</em>}
              {overall.tax_flags.msme_sensitive && <em className="di-pill">MSME</em>}
            </span>
          </div>
        )}
      </div>

      {/* ── Key dates & obligations (lifecycle) ─────────────────── */}
      {obligations?.obligations?.length > 0 && (
        <div className="di-section">
          <div className="di-section__head">
            <h4 className="di-section__title">
              <CheckCircle size={13} /> Key dates &amp; obligations
            </h4>
            <button
              type="button"
              className="di-ics-btn"
              onClick={() => downloadICS(obligations.obligations, documentTitle)}
              title="Download an .ics calendar file with reminders"
            >
              <Download size={12} /> Add to calendar
            </button>
          </div>
          <ul className="di-dates">
            {obligations.obligations.map((o, i) => (
              <li className={`di-date di-date--${o.severity || "info"}`} key={i}>
                <span className="di-date__when">{formatDate(o.due_date)}</span>
                <span className="di-date__body">
                  <span className="di-date__title">
                    {o.title}
                    {o.recurrence ? <em className="di-pill">{o.recurrence}</em> : null}
                  </span>
                  <span className="di-date__desc">{o.description}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="di-footnote">
            Computed from your dates &amp; the document's clauses — export or connect a
            calendar to get reminders before each deadline.
          </p>
        </div>
      )}

      {/* ── Cross-clause conflicts ──────────────────────────────── */}
      {conflicts.length > 0 && (
        <div className="di-section">
          <h4 className="di-section__title">
            <AlertTriangle size={13} /> {conflicts.length} cross-clause point
            {conflicts.length === 1 ? "" : "s"} to review
          </h4>
          <ul className="di-conflicts">
            {conflicts.map((c, i) => (
              <li className={`di-conflict di-conflict--${(c.severity || "medium").toLowerCase()}`} key={i}>
                <span className="di-conflict__msg">{c.message}</span>
                <span className="di-conflict__ids">{(c.clauses || []).join("  ·  ")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Per-clause explainability ───────────────────────────── */}
      <div className="di-section">
        <h4 className="di-section__title">
          <Scales size={13} /> Why each clause is here
        </h4>
        <ul className="di-clauses">
          {clauses.map((c) => {
            const isOpen = open.has(c.clause_id);
            const hasDetail =
              (c.legal_basis || []).length ||
              (c.dispute_hotspots || []).length ||
              (c.watch_for || []).length;
            return (
              <li className="di-clause" key={c.clause_id}>
                <button
                  type="button"
                  className="di-clause__head"
                  onClick={() => hasDetail && toggle(c.clause_id)}
                >
                  <span className={`di-clause__chev${isOpen ? " di-clause__chev--open" : ""}`}>
                    {hasDetail ? <ChevronRight size={12} /> : null}
                  </span>
                  <span className="di-clause__title">{c.title}</span>
                  {c.enforceability && (
                    <span className={`di-pill di-pill--${c.enforceability === "HIGH" ? "ok" : c.enforceability === "LOW" ? "bad" : "warn"}`}>
                      {c.enforceability.toLowerCase()}
                    </span>
                  )}
                </button>
                {c.why && <p className="di-clause__why">{c.why}</p>}
                {isOpen && (
                  <div className="di-clause__detail">
                    {(c.legal_basis || []).length > 0 && (
                      <div className="di-detail-block">
                        <span className="di-detail-block__k">Backed by</span>
                        <ul className="di-basis">
                          {c.legal_basis.map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(c.dispute_hotspots || []).length > 0 && (
                      <div className="di-detail-block">
                        <span className="di-detail-block__k">What's been litigated</span>
                        <ul className="di-hotspots">
                          {c.dispute_hotspots.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(c.watch_for || []).length > 0 && (
                      <div className="di-detail-block">
                        <span className="di-detail-block__k">Watch for</span>
                        <ul className="di-hotspots">
                          {c.watch_for.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="di-footnote">
        Advisory analysis from LegalAId's rule engine — it explains and flags, it
        does not replace a lawyer's review.
      </p>
    </div>
  );
}
