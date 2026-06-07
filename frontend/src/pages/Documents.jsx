import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  deleteDocumentHistory,
  getDocumentHistoryDetail,
  getDocumentHistoryList,
} from "../services/api";
import { Icons } from "../utils/icons";
import ErrorExplainer from "../components/ErrorExplainer";
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
      .catch(() =>
        setError({
          title: "Couldn't load your saved drafts",
          message: "LegalAId could not retrieve your document history.",
          cause:
            "The backend may be unreachable, your session may have expired, or the history service failed.",
          solution:
            "Check that you are signed in and the backend is running, then refresh this page.",
        })
      )
      .finally(() => setLoading(false));
  }, []);

  const openLatest = async (draftId) => {
    setActionId(draftId);
    try {
      const res = await getDocumentHistoryDetail(draftId);
      navigate("/editor", { state: res.data });
    } catch {
      setError({
        title: "Couldn't open that draft",
        message: "LegalAId could not load the selected document.",
        cause: "The draft may have been deleted, or the backend could not be reached.",
        solution: "Refresh the page and try again. If it persists, regenerate the document.",
      });
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
      setError({
        title: "Couldn't delete that draft",
        message: "LegalAId could not remove the saved draft.",
        cause: "The backend may be unreachable, or the draft may already be gone.",
        solution: "Refresh the page and try again.",
      });
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
          <ErrorExplainer
            variant="error"
            title={error.title}
            message={error.message}
            cause={error.cause}
            solution={error.solution}
            onClose={() => setError(null)}
          />
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
