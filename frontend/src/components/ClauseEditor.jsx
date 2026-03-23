import { useState } from "react";
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
};

export default function ClauseEditor({
  clause,
  onChange,
  index,
  recentlyEdited,
}) {
  const [editing, setEditing] = useState(false);
  const label =
    CATEGORY_LABELS[clause.category] ||
    clause.category?.replace(/_/g, " ") ||
    "Clause";
  const isSignature = clause.category === "SIGNATURE_BLOCK";

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
          {clause.statutory_reference && (
            <span
              className="clause-stat-ref"
              title={clause.statutory_reference}
            >
              {clause.statutory_reference}
            </span>
          )}
          <button
            className={`clause-edit-btn${
              editing ? " clause-edit-btn--active" : ""
            }`}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? "✓ Done" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          className="clause-textarea"
          value={clause.text || ""}
          onChange={(e) => onChange({ ...clause, text: e.target.value })}
          autoFocus
          rows={Math.max(6, Math.ceil((clause.text || "").length / 90))}
        />
      ) : (
        <div
          className={`clause-text${isSignature ? " clause-text--sig" : ""}`}
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {clause.text || (
            <span className="clause-empty">No content — click to add</span>
          )}
        </div>
      )}
    </div>
  );
}
