import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteDocumentHistory,
  getDocumentHistoryDetail,
  getDocumentHistoryList,
} from "../services/api";
import { Icons } from "../utils/icons";
import "./Documents.css";

function formatDate(value) {
  if (!value) return "Just now";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Documents() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    getDocumentHistoryList()
      .then((res) => setDocuments(res.data?.documents || []))
      .catch(() => setError("Could not load your saved drafts."))
      .finally(() => setLoading(false));
  }, []);

  const openLatest = async (draftId) => {
    setActionId(draftId);
    try {
      const res = await getDocumentHistoryDetail(draftId);
      navigate("/editor", { state: res.data });
    } catch {
      setError("Could not open that draft.");
    } finally {
      setActionId(null);
    }
  };

  const removeDraft = async (draftId, title) => {
    const confirmed = window.confirm(
      `Delete the saved draft for ${title}? This removes it from your account history.`
    );

    if (!confirmed) {
      return;
    }

    setDeleteId(draftId);
    setError(null);

    try {
      await deleteDocumentHistory(draftId);
      setDocuments((current) =>
        current.filter((document) => document.draftId !== draftId)
      );
    } catch {
      setError("Could not delete that saved draft.");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="documents-page">
      <section className="documents-hero">
        <div className="documents-hero-copy">
          <span className="documents-eyebrow">MY DOCUMENTS</span>
          <h1 className="documents-title">Latest saved draft for each document type</h1>
          <p className="documents-sub">
            LegalAId now keeps only the latest saved draft for each document type, so your workspace stays simple and storage stays lean.
          </p>
        </div>

        <button
          className="documents-library-btn"
          onClick={() => navigate("/library")}
        >
          <span>{Icons.fileText}</span>
          Go to library
        </button>
      </section>

      <section className="documents-shell">
        {loading ? (
          <div className="documents-state">
            <div className="spinner" />
            <span>Loading saved drafts...</span>
          </div>
        ) : error ? (
          <div className="documents-state documents-state--error">
            <span className="documents-state-icon">{Icons.warning}</span>
            <span>{error}</span>
          </div>
        ) : documents.length === 0 ? (
          <div className="documents-state">
            <span className="documents-state-icon">{Icons.scroll}</span>
            <span>No saved drafts yet. Generate a document and it will appear here automatically.</span>
          </div>
        ) : (
          <div className="documents-grid">
            {documents.map((document) => {
              const validation = document.validation || {};
              const issueCount = validation.issueCount || 0;
              const draftReady = validation.certified && issueCount === 0;

              return (
                <article key={document.draftId} className="documents-card">
                  <div className="documents-card-top">
                    <div>
                      <div className="documents-card-kicker">
                        {document.documentMeta?.family || "Legal"}
                      </div>
                      <h2 className="documents-card-title">
                        {document.documentMeta?.displayName || document.title}
                      </h2>
                    </div>

                    <div className="documents-card-badges">
                      <span className={`documents-badge documents-badge--${document.status}`}>
                        {document.status}
                      </span>
                      {validation.risk && (
                        <span
                          className={`documents-badge documents-badge--risk-${validation.risk.toLowerCase()}`}
                        >
                          {validation.risk}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="documents-card-meta">
                    <span>{document.documentType.replace(/_/g, " ")}</span>
                    <span>Saved {formatDate(document.updatedAt)}</span>
                    <span>{draftReady ? "Ready to export" : "Needs review"}</span>
                  </div>

                  <div className="documents-card-summary">
                    <div className="documents-summary-item">
                      <span className="documents-summary-label">Validation</span>
                      <span className="documents-summary-value">
                        {validation.mode ? validation.mode : "pending"}
                      </span>
                    </div>
                    <div className="documents-summary-item">
                      <span className="documents-summary-label">Open issues</span>
                      <span className="documents-summary-value">
                        {issueCount}
                      </span>
                    </div>
                    <div className="documents-summary-item">
                      <span className="documents-summary-label">Last export</span>
                      <span className="documents-summary-value">
                        {document.lastExportedAt ? formatDate(document.lastExportedAt) : "Not exported"}
                      </span>
                    </div>
                  </div>

                  <div className="documents-card-actions">
                    <button
                      className="documents-btn documents-btn--secondary"
                      onClick={() => navigate("/library")}
                    >
                      New draft
                    </button>
                    <button
                      className="documents-btn documents-btn--danger"
                      onClick={() =>
                        removeDraft(
                          document.draftId,
                          document.documentMeta?.displayName || document.title
                        )
                      }
                      disabled={deleteId === document.draftId}
                    >
                      {deleteId === document.draftId ? "Deleting..." : "Delete"}
                    </button>
                    <button
                      className="documents-btn documents-btn--primary"
                      onClick={() => openLatest(document.draftId)}
                      disabled={
                        actionId === document.draftId ||
                        deleteId === document.draftId
                      }
                    >
                      {actionId === document.draftId ? "Opening..." : "Open draft"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
