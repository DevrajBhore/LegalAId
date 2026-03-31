import "./RiskPanel.css";
import { Icons } from "../utils/icons";

const RISK_META = {
  LOW: { label: "Low Risk", cls: "risk-low", icon: Icons.checkCircle },
  MEDIUM: { label: "Medium Risk", cls: "risk-medium", icon: Icons.info },
  HIGH: { label: "High Risk", cls: "risk-high", icon: Icons.warning },
  BLOCKED: { label: "Blocked", cls: "risk-blocked", icon: Icons.x },
  UNKNOWN: { label: "Pending", cls: "risk-unknown", icon: Icons.loader },
};

const SEVERITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const SEVERITY_META = {
  CRITICAL: { cls: "sev-critical", label: "Critical" },
  HIGH: { cls: "sev-high", label: "High" },
  MEDIUM: { cls: "sev-medium", label: "Medium" },
  LOW: { cls: "sev-low", label: "Low" },
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
        <div className="risk-panel-head">
          <h3 className="risk-panel-title">Validation</h3>
          <p className="risk-panel-subtitle">
            The latest review will appear here.
          </p>
        </div>
        <div className="risk-empty">
          <div className="risk-empty-icon">{Icons.loader}</div>
          <p>Validation pending...</p>
        </div>
      </div>
    );
  }

  const overall =
    validation.risk || validation.overall_risk || validation.risk_level || "UNKNOWN";
  const certified = Boolean(validation.certified);
  const blockingIssues = validation.blockingIssues || validation.issues || [];
  const advisoryIssues =
    validation.advisoryIssues || validation.advisory_issues || [];
  const blockingCount =
    validation.summary?.blocking ??
    validation.blockingIssueCount ??
    blockingIssues.length;
  const advisoryCount =
    validation.summary?.advisory ??
    validation.advisoryIssueCount ??
    advisoryIssues.length;
  const totalCount =
    validation.summary?.total ??
    validation.issueCount ??
    validation.issue_count ??
    blockingCount + advisoryCount;

  const meta = RISK_META[overall] || RISK_META.UNKNOWN;
  const sortedBlockingIssues = [...blockingIssues].sort(
    (a, b) =>
      (SEVERITY_ORDER[a?.severity] ?? 99) - (SEVERITY_ORDER[b?.severity] ?? 99)
  );

  return (
    <div className="risk-panel">
      <div className="risk-panel-head">
        <h3 className="risk-panel-title">Validation</h3>
        <p className="risk-panel-subtitle">
          Review issues here before exporting the final draft.
        </p>
      </div>

      <div
        className={`certified-badge ${
          certified ? "certified-yes" : "certified-no"
        }`}
      >
        <span className="certified-icon">
          {certified ? Icons.checkCircle : Icons.warning}
        </span>
        <span>{certified ? "Document Certified" : "Needs Review"}</span>
      </div>

      <div className={`risk-badge ${meta.cls}`}>
        <span className="risk-icon">{meta.icon}</span>
        <span>{meta.label}</span>
      </div>

      <div className="risk-breakdown">
        <div className="risk-row">
          <span className="risk-row-label">Blocking Issues</span>
          <span className="risk-row-val issue-count">{blockingCount}</span>
        </div>
        <div className="risk-row">
          <span className="risk-row-label">Advisory Notes</span>
          <span className="risk-row-val issue-count">{advisoryCount}</span>
        </div>
        <div className="risk-row">
          <span className="risk-row-label">Open Notes</span>
          <span className="risk-row-val issue-count">{totalCount}</span>
        </div>
        {validation.mode && (
          <div className="risk-row">
            <span className="risk-row-label">Mode</span>
            <span className="risk-row-val">{validation.mode}</span>
          </div>
        )}
      </div>

      {blockingCount === 0 ? (
        <div className="no-issues">
          <span className="no-issues-icon">{Icons.checkCircle}</span>
          <div>
            <div className="no-issues-title">
              {certified ? "Ready for export" : "No blocking issues"}
            </div>
            <p className="no-issues-text">
              {advisoryCount > 0
                ? "Only advisory notes remain in this review."
                : "No open issues were found in the latest validation."}
            </p>
          </div>
        </div>
      ) : (
        <div className="issues-list">
          <div className="issues-title-row">
            <p className="issues-title">Issues to fix</p>
            <span className="issues-count">{blockingCount}</span>
          </div>

          {sortedBlockingIssues.map((issue, index) => {
            const severity = SEVERITY_META[issue.severity] || SEVERITY_META.LOW;
            const isFixing = fixingIssueId === issue.rule_id;

            return (
              <div
                key={`${issue.rule_id}-${index}`}
                className={`issue-item ${severity.cls}`}
              >
                <div className="issue-top">
                  <span className={`issue-badge ${severity.cls}`}>
                    {severity.label}
                  </span>
                  <span className="issue-rule">{issue.rule_id}</span>
                </div>

                {issue.message && <p className="issue-message">{issue.message}</p>}
                {issue.suggestion && (
                  <p className="issue-suggestion">{issue.suggestion}</p>
                )}

                {onFixIssue && (
                  <button
                    className={`issue-fix-btn${isFixing ? " fixing" : ""}`}
                    onClick={() => onFixIssue(issue)}
                    disabled={Boolean(fixingIssueId)}
                  >
                    {isFixing ? (
                      <>
                        <span className="fix-spinner" />
                        Fixing...
                      </>
                    ) : (
                      <>
                        <span className="issue-fix-icon">{Icons.zap}</span>
                        AI Fix
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {advisoryCount > 0 && (
        <details className="advisory-section">
          <summary className="advisory-title">
            <span>Advisory Notes</span>
            <span className="advisory-count">{advisoryCount}</span>
          </summary>

          <div className="advisory-list">
            {advisoryIssues.map((issue, index) => (
              <div key={`${issue.rule_id}-${index}`} className="advisory-item">
                <span className="advisory-rule">{issue.rule_id}</span>
                <p className="advisory-message">
                  {issue.suggestion || issue.message}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {!hideDownload &&
        (certified ? (
          <button
            className={`download-btn${downloading ? " downloading" : ""}`}
            onClick={onDownload}
            disabled={downloading}
          >
            <span className="download-btn-icon">{Icons.download}</span>
            {downloading ? "Preparing DOCX..." : "Download DOCX"}
          </button>
        ) : (
          <div className="download-blocked-notice">
            Validate and resolve blocking issues before downloading.
          </div>
        ))}
    </div>
  );
}
