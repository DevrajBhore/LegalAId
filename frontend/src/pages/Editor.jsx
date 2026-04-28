import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ClauseEditor from "../components/ClauseEditor";
import RiskPanel from "../components/RiskPanel";
import {
  chatWithDocument,
  downloadDocument,
  fixIssue,
  saveDocumentHistory,
  validateDocument,
} from "../services/api";
import { Icons } from "../utils/icons";
import "./Editor.css";

const SESSION_KEY = "legalaid_editor_draft";
const EXPORT_FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "docx", label: "DOCX" },
  { value: "txt", label: "TXT" },
];
const LEGAL_DISCLAIMER =
  "LegalAId generates contracts based on established Indian legal principles and standard drafting practices. The documents are designed to be enforceable and commercially usable. Like any legal document, final enforceability depends on execution and specific circumstances, so review is recommended for complex or high-value cases.";

function formatExportLabel(format = "docx") {
  return String(format || "docx").toUpperCase();
}

function markDraftEdited(nextDraft, { aiTouched = false } = {}) {
  if (!nextDraft) return nextDraft;

  return {
    ...nextDraft,
    metadata: {
      ...(nextDraft.metadata || {}),
      user_edited: true,
      review_state: "edited",
      ai_touched:
        aiTouched === true || nextDraft?.metadata?.ai_touched === true,
    },
  };
}

function resolveHistoryChangeType(
  history,
  draft,
  { hasEdited = false, changeType } = {}
) {
  if (changeType) return changeType;
  if (!history?.draftId) return "generated";
  if (draft?.metadata?.ai_touched) return "ai_edit";
  if (hasEdited || draft?.metadata?.user_edited) return "manual_edit";
  return "autosave";
}

export default function Editor() {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialState = () => {
    if (location.state?.draft) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(location.state));
      return {
        draft: location.state.draft,
        validation: location.state.validation || null,
        documentMeta: location.state.documentMeta || null,
        history: location.state.history || null,
      };
    }

    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          draft: parsed.draft || null,
          validation: parsed.validation || null,
          documentMeta: parsed.documentMeta || null,
          history: parsed.history || null,
        };
      } catch {
        return {
          draft: null,
          validation: null,
          documentMeta: null,
          history: null,
        };
      }
    }

    return {
      draft: null,
      validation: null,
      documentMeta: null,
      history: null,
    };
  };

  const [initialState] = useState(getInitialState);
  const [draft, setDraft] = useState(initialState.draft);
  const [validation, setValidation] = useState(initialState.validation);
  const [documentMeta] = useState(initialState.documentMeta);
  const [history, setHistory] = useState(initialState.history);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [hasEdited, setHasEdited] = useState(false);
  const [needsValidation, setNeedsValidation] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saveState, setSaveState] = useState(
    initialState.history?.draftId ? "saved" : "pending"
  );
  const [activeTab, setActiveTab] = useState("validation");
  const [editedClauses, setEditedClauses] = useState(new Set());
  const [fixingIssueId, setFixingIssueId] = useState(null);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I can help you refine clauses, explain risks, or rewrite specific sections in this draft.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!draft) {
      sessionStorage.removeItem(SESSION_KEY);
      return;
    }

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        draft,
        validation,
        documentMeta,
        history,
      })
    );
  }, [documentMeta, draft, history, validation]);

  useEffect(() => {
    if (!draft?.document_type || !draft?.clauses?.length) return;

    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await saveDocumentHistory({
          draftId: history?.draftId || null,
          draft,
          validation,
          documentMeta,
          changeType: resolveHistoryChangeType(history, draft, { hasEdited }),
        });
        if (res.data?.history) {
          setHistory(res.data.history);
        }
        setSaveState("saved");
      } catch (error) {
        console.error("History save failed:", error);
        setSaveState("error");
      }
    }, history?.draftId ? 1500 : 450);

    return () => clearTimeout(timer);
  }, [documentMeta, draft, hasEdited, history?.draftId, validation]);

  useEffect(() => {
    if (!draft?.document_type || !draft?.clauses?.length || !hasEdited) return;

    const timer = setTimeout(async () => {
      try {
        const res = await validateDocument(draft, "background");
        const nextValidation = res.data?.validation;
        if (!nextValidation?.risk) return;

        setValidation((prev) => {
          const riskRank = { LOW: 0, MEDIUM: 1, HIGH: 2, BLOCKED: 3 };
          const previousRisk = prev?.risk || prev?.overall_risk || "LOW";
          const nextRisk =
            nextValidation.risk || nextValidation.overall_risk || "LOW";

          return (riskRank[nextRisk] ?? 0) >= (riskRank[previousRisk] ?? 0)
            ? nextValidation
            : prev;
        });
      } catch {
        // Manual validate remains available from the action button.
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [draft, hasEdited]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClauseChange = (updatedClause) => {
    setDraft((prev) =>
      markDraftEdited({
        ...prev,
        clauses: prev.clauses.map((clause) =>
          clause.clause_id === updatedClause.clause_id ? updatedClause : clause
        ),
      })
    );
    setEditedClauses((prev) => new Set([...prev, updatedClause.clause_id]));
    setHasEdited(true);
    setNeedsValidation(true);
  };

  const handleDownload = async (format = exportFormat) => {
    const resolvedFormat = String(format || exportFormat).toLowerCase();
    setDownloadingFormat(resolvedFormat);
    try {
      await downloadDocument(draft, validation, resolvedFormat);
      setSaveState("saving");

      try {
        const res = await saveDocumentHistory({
          draftId: history?.draftId || null,
          draft,
          validation,
          documentMeta,
          changeType: "exported",
        });
        if (res.data?.history) {
          setHistory(res.data.history);
        }
        setSaveState("saved");
      } catch (error) {
        console.error("History export save failed:", error);
        setSaveState("error");
      }
    } catch {
      alert(`Export failed for ${formatExportLabel(resolvedFormat)}. Please check that the backend is running.`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleValidate = async () => {
    setValidating(true);

    try {
      const res = await validateDocument(draft, "final");
      const nextValidation = res.data?.validation;

      if (nextValidation?.risk) {
        setValidation(nextValidation);
      }

      setSaveState("saving");
      try {
        const historyResponse = await saveDocumentHistory({
          draftId: history?.draftId || null,
          draft,
          validation: nextValidation || validation,
          documentMeta,
          changeType: "validated",
        });
        if (historyResponse.data?.history) {
          setHistory(historyResponse.data.history);
        }
        setSaveState("saved");
      } catch (error) {
        console.error("History validation save failed:", error);
        setSaveState("error");
      }

      setNeedsValidation(false);
      setActiveTab("validation");
    } catch (error) {
      console.error("Validation failed:", error);
      alert("Validation failed. Please try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleSendMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);

    try {
      const res = await chatWithDocument(draft, text);
      const result = res.data;

      if (result.type === "edit" && result.edits?.length > 0) {
        const editedIds = new Set(result.edits.map((edit) => edit.clause_id));

        setDraft((prev) =>
          markDraftEdited(
            {
              ...prev,
              clauses: prev.clauses.map((clause) => {
                const edit = result.edits.find(
                  (item) => item.clause_id === clause.clause_id
                );
                return edit ? { ...clause, text: edit.new_text } : clause;
              }),
            },
            { aiTouched: true }
          )
        );

        setEditedClauses((prev) => new Set([...prev, ...editedIds]));
        setHasEdited(true);
        setNeedsValidation(true);

        const clauseNames = result.edits
          .map((edit) => {
            const clause = draft.clauses.find(
              (item) => item.clause_id === edit.clause_id
            );
            return clause?.title || edit.clause_id;
          })
          .join(", ");

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.reply,
            editSummary: `Updated: ${clauseNames}`,
          },
        ]);

        setTimeout(() => setEditedClauses(new Set()), 4000);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: result.reply || result },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I couldn't complete that request. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleFixIssue = async (issue) => {
    setFixingIssueId(issue.rule_id);

    try {
      const res = await fixIssue(draft, issue);
      const result = res.data;

      if (result.draft?.clauses?.length) {
        const nextDraft = markDraftEdited(result.draft, {
          aiTouched: result.source === "ai",
        });
        const editedIds = new Set(
          (result.edits || []).map((edit) => edit.clause_id)
        );

        setDraft(nextDraft);
        setEditedClauses((prev) => new Set([...prev, ...editedIds]));
        setHasEdited(true);
        setNeedsValidation(false);
        setTimeout(() => setEditedClauses(new Set()), 4000);
      }

      if (result.validation) {
        setValidation(result.validation);
      }

      if (result.explanation) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Applied fix for "${issue.rule_id}". ${result.explanation}`,
            editSummary:
              result.edits?.length > 0
                ? `Updated ${result.edits.length} clause(s)`
                : null,
          },
        ]);
        setActiveTab("validation");
      }
    } catch (error) {
      const result = error?.response?.data;

      if (result?.validation) {
        setValidation(result.validation);
        setNeedsValidation(false);
      }

      if (result?.explanation) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.explanation,
          },
        ]);
        setActiveTab("validation");
        return;
      }

      alert("Fix failed. Please try again.");
    } finally {
      setFixingIssueId(null);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (!draft) {
    return (
      <div className="editor-empty">
        <div style={{ fontSize: 48, opacity: 0.2 }}>{Icons.scale}</div>
        <p>No document loaded.</p>
        <button onClick={() => navigate("/library")}>Go to Library</button>
      </div>
    );
  }

  const displayName =
    documentMeta?.displayName ||
    draft.document_type
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const blockingIssues = validation?.blockingIssues || validation?.issues || [];
  const advisoryIssues =
    validation?.advisoryIssues || validation?.advisory_issues || [];
  const issueCount =
    validation?.summary?.total ??
    validation?.issueCount ??
    validation?.issue_count ??
    blockingIssues.length + advisoryIssues.length;
  const riskLevel =
    validation?.risk || validation?.overall_risk || validation?.risk_level;
  const workspaceStatus = needsValidation
    ? "Edited - re-validate"
    : validation?.certified && issueCount === 0
      ? "Certified"
      : validation
        ? "In review"
        : "Draft loaded";
  const validationMode = validation?.mode
    ? validation.mode.charAt(0).toUpperCase() + validation.mode.slice(1)
    : "Pending";
  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "error"
        ? "Save failed"
        : history?.draftId
          ? "Saved"
          : "Saving soon";
  const isCertified =
    validation?.certified === true &&
    riskLevel !== "BLOCKED" &&
    issueCount === 0 &&
    !needsValidation;
  const isExporting = Boolean(downloadingFormat);
  const workspaceLinks = [
    { label: "Library", path: "/library" },
    { label: "Documents", path: "/documents" },
    { label: "Profile", path: "/profile" },
  ];

  const statusItems = [
    { icon: Icons.fileText, label: "Status", value: workspaceStatus },
    { icon: Icons.shieldCheck, label: "Validation", value: validationMode },
    {
      icon: Icons.warning,
      label: "Open items",
      value: `${issueCount} item${issueCount === 1 ? "" : "s"}`,
    },
    { icon: Icons.scroll, label: "History", value: saveLabel },
  ];

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <div className="editor-topbar-inner">
          <div className="editor-topbar-left">
            <button
              className="back-btn"
              onClick={() => navigate("/library")}
            >
              {Icons.arrowLeft} Library
            </button>

            <div className="topbar-divider" />

            <div className="editor-doc-info">
              <h2 className="editor-title">{displayName}</h2>
              <p className="editor-subtitle">
                <span>{draft.clauses?.length || 0} clauses</span>
                <span>Indian law</span>
                <span>{saveLabel}</span>
                {needsValidation && !validating && (
                  <span className="edited-dot">Edited since last review</span>
                )}
                {validating && (
                  <span className="validating-dot">Validating</span>
                )}
              </p>
            </div>
          </div>

          <div className="editor-topbar-right">
            <div className="editor-workspace-links">
              {workspaceLinks.map((link) => (
                <button
                  key={link.path}
                  className="editor-workspace-link"
                  onClick={() => navigate(link.path)}
                >
                  {link.label}
                </button>
              ))}
            </div>

            {riskLevel && (
              <span
                className={`risk-pill risk-pill--${riskLevel.toLowerCase()}`}
              >
                {riskLevel}
              </span>
            )}

            {isCertified ? (
              <div className="export-controls">
                <label className="export-format-label" htmlFor="editor-export-format">
                  Export as
                </label>
                <select
                  id="editor-export-format"
                  className="export-format-select"
                  value={exportFormat}
                  onChange={(event) => setExportFormat(event.target.value)}
                  disabled={isExporting}
                >
                  {EXPORT_FORMATS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  className={`download-btn-top${
                    isExporting ? " downloading" : ""
                  }`}
                  onClick={() => handleDownload(exportFormat)}
                  disabled={isExporting}
                >
                  <span className="btn-icon">{Icons.download}</span>
                  {isExporting
                    ? `Preparing ${formatExportLabel(downloadingFormat)}...`
                    : `Export ${formatExportLabel(exportFormat)}`}
                </button>
              </div>
            ) : (
              <button
                className={`validate-download-btn${
                  validating ? " loading" : ""
                }`}
                onClick={handleValidate}
                disabled={validating}
              >
                {validating ? (
                  <>
                    <span className="btn-spinner" /> Validating...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">{Icons.shieldCheck}</span>
                    Validate
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="editor-shell">
        <div className="editor-status-strip">
          {statusItems.map((item) => (
            <div key={item.label} className="editor-status-item">
              <div className="editor-status-icon">{item.icon}</div>
              <div>
                <div className="editor-status-lbl">{item.label}</div>
                <div className="editor-status-val">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="editor-disclaimer">
          <div className="editor-disclaimer__label">Legal disclaimer</div>
          <p>{LEGAL_DISCLAIMER}</p>
        </div>

        <div className="editor-body">
          <div className="editor-left">
            <div className="editor-doc-shell">
              <div className="editor-doc-shell-bar">
                <div className="editor-doc-shell-label">
                  Live drafting surface
                </div>
                <div className="editor-doc-shell-chips">
                  <span className="editor-doc-chip">
                    {draft.clauses?.length || 0} clauses
                  </span>
                  {riskLevel && (
                    <span className="editor-doc-chip">{riskLevel} risk</span>
                  )}
                </div>
              </div>

              <div className="doc-paper">
                {needsValidation && (
                  <div className="doc-edited-notice">
                    <span className="doc-edited-icon">{Icons.warning}</span>
                    <span>
                      This draft was edited after the last review. Validate
                      again before downloading.
                    </span>
                  </div>
                )}

                <div className="doc-header">
                  <div className="doc-type-label">Legal document workspace</div>
                  <div className="doc-title-main">{displayName}</div>
                  <div className="doc-jurisdiction">
                    Governed by Indian law and ready for clause-by-clause
                    review.
                  </div>
                </div>

                {draft.clauses?.map((clause, index) => (
                  <ClauseEditor
                    key={clause.clause_id || index}
                    clause={clause}
                    onChange={handleClauseChange}
                    index={index}
                    recentlyEdited={editedClauses.has(clause.clause_id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="editor-right">
            <div className="sidebar-tabs">
              <button
                className={`sidebar-tab${
                  activeTab === "validation" ? " sidebar-tab--active" : ""
                }`}
                onClick={() => setActiveTab("validation")}
              >
                Validation {issueCount > 0 ? `(${issueCount})` : ""}
              </button>
              <button
                className={`sidebar-tab${
                  activeTab === "chat" ? " sidebar-tab--active" : ""
                }`}
                onClick={() => setActiveTab("chat")}
              >
                AI Assistant
              </button>
            </div>

            {activeTab === "validation" && (
              <div className="sidebar-panel">
                <RiskPanel
                  validation={validation}
                  onDownload={handleDownload}
                  downloading={isExporting}
                  hideDownload
                  onFixIssue={handleFixIssue}
                  fixingIssueId={fixingIssueId}
                />
              </div>
            )}

            {activeTab === "chat" && (
              <div className="sidebar-panel ai-chat">
                <div className="ai-chat-header">
                  <span className="ai-chat-dot" />
                  <span className="ai-chat-title">AI assistant</span>
                </div>

                <div className="ai-chat-messages">
                  {messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      className={`chat-msg chat-msg--${message.role}`}
                    >
                      {message.role === "assistant" && (
                        <span className="chat-avatar">AI</span>
                      )}
                      {message.role === "user" && (
                        <span className="chat-avatar">You</span>
                      )}
                      <div className="chat-bubble">
                        <p className="chat-text">{message.text}</p>
                        {message.editSummary && (
                          <span className="chat-edit-badge">
                            {message.editSummary}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="chat-msg chat-msg--assistant">
                      <span className="chat-avatar">AI</span>
                      <div className="chat-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                <div className="ai-chat-input-row">
                  <textarea
                    className="ai-chat-input"
                    placeholder="Ask for a clause edit or explanation..."
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    disabled={chatLoading}
                  />
                  <button
                    className="ai-chat-send"
                    onClick={handleSendMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    title="Send"
                  >
                    {Icons.arrowRight}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
