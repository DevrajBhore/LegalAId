import "./RiskPanel.css";

const RISK_META = {
  LOW: { label: "Low Risk", cls: "risk-low", icon: "✓" },
  MEDIUM: { label: "Medium Risk", cls: "risk-medium", icon: "!" },
  HIGH: { label: "High Risk", cls: "risk-high", icon: "!!" },
  BLOCKED: { label: "Blocked", cls: "risk-blocked", icon: "✗" },
  UNKNOWN: { label: "Unknown", cls: "risk-unknown", icon: "?" },
};

const SEVERITY_META = {
  CRITICAL: { cls: "sev-critical", label: "CRITICAL" },
  HIGH: { cls: "sev-high", label: "HIGH" },
  MEDIUM: { cls: "sev-medium", label: "MEDIUM" },
  LOW: { cls: "sev-low", label: "LOW" },
};

export default function RiskPanel({
  validation,
  onDownload,
  downloading,
  hideDownload,
  onFixIssue,
  fixingIssueId,
}) {
  if (!validation) {
    return (
      <div className="risk-panel">
        <h3 className="risk-panel-title">Validation</h3>
        <div className="risk-empty">
          <div className="risk-empty-icon">⏳</div>
          <p>Validating document…</p>
        </div>
      </div>
    );
  }

  const overall = validation.overall_risk || validation.risk_level || "UNKNOWN";
  const certified = validation.certified;
  const issues = validation.issues || [];
  const advisory = validation.advisory_issues || [];
  const isGenerated = validation.is_generated;
  const layers = validation.layers || null;

  const meta = RISK_META[overall] || RISK_META.UNKNOWN;

  const critical = issues.filter((i) => i.severity === "CRITICAL");
  const high = issues.filter((i) => i.severity === "HIGH");
  const medium = issues.filter((i) => i.severity === "MEDIUM");
  const low = issues.filter((i) => i.severity === "LOW");

  return (
    <div className="risk-panel">
      <h3 className="risk-panel-title">Validation</h3>

      {/* Certified badge */}
      <div
        className={`certified-badge ${
          certified ? "certified-yes" : "certified-no"
        }`}
      >
        <span className="certified-icon">{certified ? "✓" : "✗"}</span>
        <span>{certified ? "Document Certified" : "Not Certified"}</span>
      </div>

      {/* Overall risk */}
      <div className={`risk-badge ${meta.cls}`}>
        <span className="risk-icon">{meta.icon}</span>
        <span>{meta.label}</span>
      </div>

      {/* Risk breakdown */}
      <div className="risk-breakdown">
        <div className="risk-row">
          <span className="risk-row-label">Legal Risk</span>
          <span
            className={`risk-row-val ${
              (RISK_META[validation.legal_risk] || RISK_META.UNKNOWN).cls
            }`}
          >
            {validation.legal_risk || "—"}
          </span>
        </div>
        <div className="risk-row">
          <span className="risk-row-label">Commercial Risk</span>
          <span
            className={`risk-row-val ${
              (RISK_META[validation.commercial_risk] || RISK_META.UNKNOWN).cls
            }`}
          >
            {validation.commercial_risk || "—"}
          </span>
        </div>
        <div className="risk-row">
          <span className="risk-row-label">Blocking Issues</span>
          <span className="risk-row-val issue-count">{issues.length}</span>
        </div>
        {advisory.length > 0 && (
          <div className="risk-row">
            <span className="risk-row-label">Advisory Notes</span>
            <span className="risk-row-val issue-count">{advisory.length}</span>
          </div>
        )}
      </div>

      {/* No issues — clean state */}
      {issues.length === 0 && (
        <div className="no-issues">
          <span>✓</span>{" "}
          {isGenerated ? "Document generated clean" : "All issues resolved"}
        </div>
      )}

      {/* Blocking issues with Fix buttons */}
      {issues.length > 0 && (
        <div className="issues-list">
          <div className="issues-title">
            Issues to fix ({issues.length})
            {onFixIssue && (
              <span className="issues-title-hint">
                {" "}
                — click AI Fix to auto-repair
              </span>
            )}
          </div>

          {[
            [critical, "CRITICAL"],
            [high, "HIGH"],
            [medium, "MEDIUM"],
            [low, "LOW"],
          ].map(
            ([group, sev]) =>
              group.length > 0 && (
                <div key={sev} className="issue-group">
                  {group.map((issue, i) => {
                    const sm =
                      SEVERITY_META[issue.severity] || SEVERITY_META.LOW;
                    const iid = issue.rule_id;
                    const isFixing = fixingIssueId === iid;
                    return (
                      <div key={i} className={`issue-item ${sm.cls}`}>
                        <div className="issue-header">
                          <span className={`issue-badge ${sm.cls}`}>
                            {sm.label}
                          </span>
                          <span className="issue-rule">{issue.rule_id}</span>
                        </div>
                        {issue.message && (
                          <p className="issue-message">{issue.message}</p>
                        )}
                        {issue.suggestion && (
                          <p className="issue-suggestion">
                            → {issue.suggestion}
                          </p>
                        )}

                        {/* AI Fix button — only shown after user edits (not on generated) */}
                        {onFixIssue && !isGenerated && (
                          <button
                            className={`issue-fix-btn${
                              isFixing ? " fixing" : ""
                            }`}
                            onClick={() => onFixIssue(issue)}
                            disabled={!!fixingIssueId}
                          >
                            {isFixing ? (
                              <>
                                <span className="fix-spinner" /> Fixing…
                              </>
                            ) : (
                              <>⚡ AI Fix</>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
          )}
        </div>
      )}

      {/* Advisory notes (collapsible, not scary) */}
      {advisory.length > 0 && (
        <details className="advisory-section">
          <summary className="advisory-title">
            Advisory notes ({advisory.length}) — not blocking
          </summary>
          <div className="advisory-list">
            {advisory.map((issue, i) => (
              <div key={i} className="advisory-item">
                <span className="advisory-rule">{issue.rule_id}</span>
                <p className="advisory-message">
                  {issue.suggestion || issue.message}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Download button */}
      {!hideDownload &&
        (certified ? (
          <button
            className={`download-btn${downloading ? " downloading" : ""}`}
            onClick={onDownload}
            disabled={downloading}
          >
            {downloading ? "Preparing DOCX…" : "⬇ Download as DOCX"}
          </button>
        ) : (
          <div className="download-blocked-notice">
            ✗ Fix all issues before downloading
          </div>
        ))}
    </div>
  );
}
