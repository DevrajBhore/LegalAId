import { useState, useRef, useEffect } from "react";
import "./ClauseEditor.css";

const CATEGORY_LABELS = {
  IDENTITY: "Parties & Recitals",
  PURPOSE: "Purpose & Scope",
  CONSIDERATION: "Consideration",
  CONFIDENTIALITY: "Confidentiality",
  EXCLUSIONS: "Exclusions",
  NDA: "Non-Disclosure",
  TERM: "Term",
  TERMINATION: "Termination",
  DISPUTE_RESOLUTION: "Dispute Resolution",
  GOVERNING_LAW: "Governing Law",
  ENFORCEABILITY: "Enforceability",
  SIGNATURE_BLOCK: "Signatures",
  SERVICE: "Services",
  IP: "Intellectual Property",
  WARRANTY: "Warranties",
  RISK: "Risk & Liability",
  PRIVACY: "Privacy & Data",
  REGULATORY: "Regulatory",
  FINANCE: "Financial Terms",
  CORPORATE: "Corporate Governance",
  COMMERCIAL: "Commercial Terms",
  OBLIGATIONS: "Obligations",
  REPRESENTATIONS: "Representations",
};

export default function ClauseEditor({
  clause,
  onChange,
  index,
  recentlyEdited,
}) {
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef(null);

  const label =
    CATEGORY_LABELS[clause.category] ||
    clause.category?.replace(/_/g, " ") ||
    "Clause";
  const isSignature = clause.category === "SIGNATURE_BLOCK";

  useEffect(() => {
    if (editing && textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [editing, clause.text]);

  const handleDone = () => setEditing(false);
  const wordCount =
    editing && clause.text
      ? clause.text.trim().split(/\s+/).filter(Boolean).length
      : 0;

  return (
    <div
      className={`clause-block${editing ? " clause-block--editing" : ""}${
        isSignature ? " clause-block--sig" : ""
      }${recentlyEdited ? " clause-block--edited" : ""}`}
    >
      <div className="clause-head">
        <div className="clause-head-left">
          {index !== undefined && (
            <span className="clause-number">{index + 1}.</span>
          )}
          {clause.title && clause.title !== clause.category ? (
            <span className="clause-head-title">{clause.title}</span>
          ) : (
            <span className="clause-cat-pill">{label}</span>
          )}
          {clause.title && clause.title !== clause.category && (
            <span className="clause-cat-pill">{label}</span>
          )}
        </div>

        <div className="clause-head-right">
          {clause.statutory_reference && !editing && (
            <span
              className="clause-stat-ref"
              title={clause.statutory_reference}
            >
              {clause.statutory_reference}
            </span>
          )}
          {editing && (
            <span className="clause-word-count">{wordCount} words</span>
          )}
          <button
            className={`clause-edit-btn${
              editing ? " clause-edit-btn--active" : ""
            }`}
            onClick={() => (editing ? handleDone() : setEditing(true))}
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="clause-edit-wrap">
          <textarea
            ref={textareaRef}
            className="clause-textarea"
            value={clause.text || ""}
            onChange={(event) => {
              onChange({ ...clause, text: event.target.value });
              event.target.style.height = "auto";
              event.target.style.height = `${event.target.scrollHeight}px`;
            }}
            autoFocus
          />
          <div className="clause-edit-footer">
            <span className="clause-edit-hint">
              Plain text | Changes auto-saved to draft
            </span>
            <button className="clause-done-btn" onClick={handleDone}>
              Done editing
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`clause-text${isSignature ? " clause-text--sig" : ""}`}
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {clause.text || (
            <span className="clause-empty">No content - click to add</span>
          )}
        </div>
      )}
    </div>
  );
}
