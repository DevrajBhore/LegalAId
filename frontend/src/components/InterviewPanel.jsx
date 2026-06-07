import { useState } from "react";
import { runLegalInterview } from "../services/api";
import "./InterviewPanel.css";

const EXAMPLE_PROMPTS = [
  "A SaaS startup sharing source code with an investor for due diligence; trade secrets are involved.",
  "Hiring a senior engineer who will handle sensitive IP; we want a non-compete.",
  "Engaging a marketing consultant on a monthly retainer for an Indian client.",
  "A manufacturer sharing confidential pricing with a new supplier.",
];

/**
 * Optional first step of the intake form: the user describes their situation in
 * plain language; the backend maps it to valid, in-schema field values which the
 * user reviews and applies. It only PRE-FILLS the form — never auto-submits.
 *
 * Props:
 *   documentType   string
 *   onApply        (fieldName, value) => void   — applies one field to the form
 *   appliedValues  object                       — current form values (to show applied state)
 */
export default function InterviewPanel({
  documentType,
  onApply,
  appliedValues = {},
  pageMode = false,
  onContinue,
  onSkip,
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [appliedKeys, setAppliedKeys] = useState(() => new Set());

  const analyze = async () => {
    const text = message.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await runLegalInterview({ document_type: documentType, message: text });
      setResult(res.data);
      if (res.data?.available === false) {
        setError(res.data.summary || "The interview assistant is unavailable right now.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          "Could not analyze your description. You can fill the form manually below."
      );
    } finally {
      setLoading(false);
    }
  };

  const apply = (update) => {
    onApply(update.field, update.value);
    setAppliedKeys((prev) => new Set(prev).add(update.field));
  };

  const applyAll = () => {
    (result?.field_updates || []).forEach(apply);
  };

  const isApplied = (update) =>
    appliedKeys.has(update.field) ||
    String(appliedValues[update.field] ?? "").toLowerCase() ===
      String(update.value).toLowerCase();

  const body = (
        <div className="interview-body">
          <div className="interview-card">
            <textarea
              className="interview-textarea"
              rows={4}
              placeholder="Describe your situation in plain language — who the parties are, what's being shared or done, and anything sensitive (source code, trade secrets, personal data)…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="interview-actions">
              {!result && (
                <span className="interview-actions__hint">
                  The more context you give, the more the document adapts.
                </span>
              )}
              {result?.field_updates?.length > 0 && (
                <button type="button" className="interview-applyall" onClick={applyAll}>
                  Apply all
                </button>
              )}
              <button
                type="button"
                className="interview-analyze"
                onClick={analyze}
                disabled={loading || !message.trim()}
              >
                {loading ? "Analyzing…" : "Analyze & suggest"}
              </button>
            </div>
          </div>

          {!result && !loading && (
            <div className="interview-examples">
              <span className="interview-examples__label">Try an example</span>
              <div className="interview-examples__chips">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    type="button"
                    key={example}
                    className="interview-example-chip"
                    onClick={() => setMessage(example)}
                  >
                    {example.length > 52 ? `${example.slice(0, 52)}…` : example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="interview-error">{error}</p>}

          {result?.summary && (
            <p className="interview-summary">
              <strong>Understood:</strong> {result.summary}
            </p>
          )}

          {result?.field_updates?.length > 0 && (
            <ul className="interview-updates">
              {result.field_updates.map((update) => (
                <li className="interview-update" key={update.field}>
                  <div className="interview-update__main">
                    <span className="interview-update__field">{update.label}</span>
                    <span className="interview-update__value">{update.value}</span>
                    <span className="interview-update__reason">{update.reason}</span>
                  </div>
                  <button
                    type="button"
                    className="interview-update__apply"
                    onClick={() => apply(update)}
                    disabled={isApplied(update)}
                  >
                    {isApplied(update) ? "Applied" : "Apply"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {result?.followup_questions?.length > 0 && (
            <div className="interview-followups">
              <span className="interview-followups__label">
                To shape the document further, also consider:
              </span>
              <ul>
                {result.followup_questions.map((question, index) => (
                  <li key={index}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
  );

  // ── Full-page mode: a standalone step shown before the form ────────────────
  if (pageMode) {
    const appliedCount = (result?.field_updates || []).filter(isApplied).length;
    return (
      <section className="interview-page">
        <div className="interview-page__head">
          <div className="interview-page__badge">
            <span className="interview-page__badge-icon">✦</span>
            <span>AI-guided intake</span>
          </div>
          <h2 className="interview-page__title">Tell us about your situation</h2>
          <p className="interview-page__sub">
            Describe what you need in plain language and LegalAId will pre-fill the
            form and shape the document around your situation. This step is optional —
            you can skip straight to the form.
          </p>
        </div>
        {body}
        <div className="interview-page__footer">
          <button type="button" className="interview-skip" onClick={onSkip}>
            Skip for now
          </button>
          <button type="button" className="interview-continue" onClick={onContinue}>
            {appliedCount > 0
              ? `Continue to form (${appliedCount} applied)`
              : "Continue to form"}
          </button>
        </div>
      </section>
    );
  }

  // ── Inline collapsible mode (kept for embedding) ───────────────────────────
  return (
    <section className="interview-panel">
      <button
        type="button"
        className="interview-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="interview-toggle__title">
          ✨ Describe your situation (optional)
        </span>
        <span className="interview-toggle__hint">
          Let LegalAId pre-fill the form and shape the document around your needs
        </span>
        <span className="interview-toggle__chev">{open ? "▲" : "▼"}</span>
      </button>
      {open && body}
    </section>
  );
}
