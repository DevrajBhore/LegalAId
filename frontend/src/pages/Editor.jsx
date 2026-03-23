import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import ClauseEditor from "../components/ClauseEditor";
import RiskPanel from "../components/RiskPanel";
import {
  validateDocument,
  downloadDocx,
  chatWithDocument,
  fixIssue,
} from "../services/api";
import "./Editor.css";

const SESSION_KEY = "legalaid_editor_draft";

const DOC_DISPLAY_NAMES = {
  NDA: "Non-Disclosure Agreement",
  EMPLOYMENT_CONTRACT: "Employment Contract",
  SERVICE_AGREEMENT: "Service Agreement",
  CONSULTANCY_AGREEMENT: "Consultancy Agreement",
  PARTNERSHIP_DEED: "Partnership Deed",
  SHAREHOLDERS_AGREEMENT: "Shareholders Agreement",
  JOINT_VENTURE_AGREEMENT: "Joint Venture Agreement",
  SUPPLY_AGREEMENT: "Supply Agreement",
  DISTRIBUTION_AGREEMENT: "Distribution Agreement",
  SALES_OF_GOODS_AGREEMENT: "Sale of Goods Agreement",
  INDEPENDENT_CONTRACTOR_AGREEMENT: "Independent Contractor Agreement",
  COMMERCIAL_LEASE_AGREEMENT: "Commercial Lease Agreement",
  LEAVE_AND_LICENSE_AGREEMENT: "Leave and License Agreement",
  LOAN_AGREEMENT: "Loan Agreement",
  GUARANTEE_AGREEMENT: "Guarantee Agreement",
  SOFTWARE_DEVELOPMENT_AGREEMENT: "Software Development Agreement",
};

export default function Editor() {
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialDraft = () => {
    if (location.state?.draft) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(location.state));
      return location.state.draft;
    }
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).draft || null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const getInitialValidation = () => {
    if (location.state?.validation) return location.state.validation;
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).validation || null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const [draft, setDraft] = useState(getInitialDraft);
  const [validation, setValidation] = useState(getInitialValidation);
  const [downloading, setDownloading] = useState(false);
  const [hasEdited, setHasEdited] = useState(false); // any manual edit made
  const [needsValidation, setNeedsValidation] = useState(false); // waiting for re-validate
  const [validating, setValidating] = useState(false); // validation in progress
  const [activeTab, setActiveTab] = useState("validation"); // "validation" | "chat"
  const [editedClauses, setEditedClauses] = useState(new Set());
  const [fixingIssueId, setFixingIssueId] = useState(null);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "I can help you edit this document. Try asking me to strengthen a clause, adjust terms, or explain any section.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Fast background validation after edits (regex only — catches obvious illegal content)
  // Bug fix: never let a shallow fast-validation overwrite a deeper result that found
  // more issues — only update if the fast result is equally or more severe.
  useEffect(() => {
    if (!draft?.document_type || !draft?.clauses?.length || !hasEdited) return;
    const t = setTimeout(async () => {
      try {
        const res = await validateDocument(draft, false); // fast, no AI
        const v = res.data?.validation || res.data;
        if (!v || (!v.risk_level && !v.overall_risk)) return;

        setValidation((prev) => {
          const RISK_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, BLOCKED: 3 };
          const prevRisk = prev?.overall_risk || prev?.risk_level || "LOW";
          const newRisk = v.overall_risk || v.risk_level || "LOW";
          // Only overwrite if the new result is worse or equal severity
          // This prevents a fast regex pass from clearing AI-detected BLOCKED issues
          if ((RISK_RANK[newRisk] ?? 0) >= (RISK_RANK[prevRisk] ?? 0)) {
            return v;
          }
          return prev;
        });
      } catch (e) {
        /* silent — user can still manually validate */
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [draft]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleClauseChange = (updated) => {
    setDraft((prev) => ({
      ...prev,
      clauses: prev.clauses.map((c) =>
        c.clause_id === updated.clause_id ? updated : c
      ),
    }));
    setEditedClauses((prev) => new Set([...prev, updated.clause_id]));
    setHasEdited(true);
    setNeedsValidation(true);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadDocx(draft, validation);
    } catch {
      alert("Download failed. Check the backend is running.");
    } finally {
      setDownloading(false);
    }
  };

  const handleValidateAndDownload = async () => {
    setValidating(true);
    try {
      const res = await validateDocument(draft, true); // deep=true → full AI check
      const v = res.data?.validation || res.data;
      if (v && (v.risk_level || v.overall_risk)) {
        setValidation(v);
      }
      setNeedsValidation(false);
      setActiveTab("validation");

      // Only download immediately if certified — otherwise the panel shows the issues
      const certified =
        v?.certified && (v?.overall_risk || v?.risk_level) !== "BLOCKED";
      if (certified) {
        setDownloading(true);
        try {
          await downloadDocx(draft, v);
        } catch {
          alert("Download failed. Check the backend is running.");
        } finally {
          setDownloading(false);
        }
      }
    } catch (e) {
      console.error("Validation failed:", e);
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
        const editedIds = new Set(result.edits.map((e) => e.clause_id));

        setDraft((prev) => {
          const updated = {
            ...prev,
            clauses: prev.clauses.map((clause) => {
              const edit = result.edits.find(
                (e) => e.clause_id === clause.clause_id
              );
              return edit ? { ...clause, text: edit.new_text } : clause;
            }),
          };
          const saved = sessionStorage.getItem(SESSION_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            sessionStorage.setItem(
              SESSION_KEY,
              JSON.stringify({ ...parsed, draft: updated })
            );
          }
          return updated;
        });

        setEditedClauses((prev) => new Set([...prev, ...editedIds]));
        setHasEdited(true);
        setNeedsValidation(true);

        const clauseNames = result.edits
          .map((e) => {
            const clause = draft.clauses.find(
              (c) => c.clause_id === e.clause_id
            );
            return clause?.title || e.clause_id;
          })
          .join(", ");

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.reply,
            editSummary: `✓ Updated: ${clauseNames}`,
          },
        ]);

        // Clear edit highlights after 4s
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
          text: "Sorry, I couldn't connect. Please try again.",
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

      if (result.edits?.length > 0) {
        const editedIds = new Set(result.edits.map((e) => e.clause_id));
        setDraft((prev) => {
          const updated = {
            ...prev,
            clauses: prev.clauses.map((clause) => {
              const edit = result.edits.find(
                (e) => e.clause_id === clause.clause_id
              );
              return edit ? { ...clause, text: edit.new_text } : clause;
            }),
          };
          const saved = sessionStorage.getItem(SESSION_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            sessionStorage.setItem(
              SESSION_KEY,
              JSON.stringify({ ...parsed, draft: updated })
            );
          }
          return updated;
        });
        setEditedClauses((prev) => new Set([...prev, ...editedIds]));
        setNeedsValidation(true);
        setTimeout(() => setEditedClauses(new Set()), 4000);
      }

      // Show confirmation in chat tab
      if (result.explanation) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Fixed "${issue.rule_id}": ${result.explanation}`,
            editSummary:
              result.edits?.length > 0
                ? `✓ Applied fix to ${result.edits.length} clause(s)`
                : null,
          },
        ]);
        setActiveTab("chat");
      }
    } catch {
      alert("Fix failed. Please try again.");
    } finally {
      setFixingIssueId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!draft) {
    return (
      <div className="editor-empty">
        <p>No document loaded.</p>
        <button onClick={() => navigate("/")}>← Go Home</button>
      </div>
    );
  }

  const displayName =
    DOC_DISPLAY_NAMES[draft.document_type] ||
    draft.document_type
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const issueCount = validation?.issues?.length || 0;
  const riskLevel = validation?.overall_risk || validation?.risk_level;
  // A document is only downloadable when certified, not blocked, and not needing re-validation
  const isCertified =
    validation?.certified === true &&
    riskLevel !== "BLOCKED" &&
    !needsValidation;

  return (
    <div className="editor-page">
      {/* Top bar */}
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          <button
            className="back-btn"
            onClick={() => {
              sessionStorage.removeItem(SESSION_KEY);
              navigate("/");
            }}
          >
            ← Back
          </button>
          <div className="editor-doc-info">
            <h2 className="editor-title">{displayName}</h2>
            <p className="editor-subtitle">
              <span>{draft.clauses?.length} clauses</span>
              <span>· India</span>
              {needsValidation && !validating && (
                <span
                  style={{
                    color: "var(--accent)",
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  • edited
                </span>
              )}
              {validating && <span className="validating-dot">Validating</span>}
            </p>
          </div>
        </div>
        <div className="editor-topbar-right">
          {riskLevel && (
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 6,
                background:
                  riskLevel === "LOW"
                    ? "rgba(42,107,60,0.2)"
                    : riskLevel === "BLOCKED"
                    ? "rgba(139,28,28,0.2)"
                    : "rgba(122,82,8,0.2)",
                color:
                  riskLevel === "LOW"
                    ? "#6dd88a"
                    : riskLevel === "BLOCKED"
                    ? "#f0807a"
                    : "#f5c96a",
                letterSpacing: "0.5px",
              }}
            >
              {riskLevel}
            </span>
          )}
          {isCertified && !needsValidation ? (
            // Certified + no pending edits → show Download
            <button
              className={`download-btn-top${downloading ? " downloading" : ""}`}
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? "Preparing…" : "⬇ Download DOCX"}
            </button>
          ) : (
            // Not certified, blocked, or has pending edits → must validate first
            <button
              className={`validate-download-btn${validating ? " loading" : ""}`}
              onClick={handleValidateAndDownload}
              disabled={validating}
            >
              {validating ? (
                <>
                  <span className="btn-spinner" /> Validating…
                </>
              ) : (
                <>
                  <span className="btn-icon">⚖</span> Validate & Download
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="editor-body">
        {/* LEFT — paper document */}
        <div className="editor-left">
          <div className="doc-paper">
            {needsValidation && (
              <div className="doc-edited-notice">
                <span className="doc-edited-icon">✎</span>
                <span>
                  Document has been edited — click{" "}
                  <strong>Validate & Download</strong> to re-check before
                  downloading.
                </span>
              </div>
            )}
            <div className="doc-header">
              <div className="doc-type-label">Legal Document · India</div>
              <div className="doc-title-main">{displayName}</div>
              <div className="doc-jurisdiction">
                Governed by Indian Law · {draft.jurisdiction || "India"}
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

        {/* RIGHT — tabbed sidebar */}
        <div className="editor-right">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab${
                activeTab === "validation" ? " sidebar-tab--active" : ""
              }`}
              onClick={() => setActiveTab("validation")}
            >
              Validation {issueCount > 0 && `(${issueCount})`}
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
                downloading={downloading}
                hideDownload
                onFixIssue={
                  hasEdited && !needsValidation ? handleFixIssue : null
                }
                fixingIssueId={fixingIssueId}
              />
            </div>
          )}

          {activeTab === "chat" && (
            <div className="sidebar-panel ai-chat">
              <div className="ai-chat-header">
                <span className="ai-chat-dot" />
                <span className="ai-chat-title">AI Legal Assistant</span>
              </div>

              <div className="ai-chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
                    {msg.role === "assistant" && (
                      <span className="chat-avatar">AI</span>
                    )}
                    <div className="chat-bubble">
                      <p className="chat-text">{msg.text}</p>
                      {msg.editSummary && (
                        <span className="chat-edit-badge">
                          {msg.editSummary}
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
                  placeholder="Ask me to edit a clause… (Enter to send)"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  disabled={chatLoading}
                />
                <button
                  className="ai-chat-send"
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                >
                  ↑
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
