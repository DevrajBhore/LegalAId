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

// Fallback only. The engine computes the real score and itemises every
// deduction behind it (validation.score_breakdown); this band-based estimate is
// used only for an older payload that carries no score at all.
const RISK_BASE_SCORE = { LOW: 92, MEDIUM: 76, HIGH: 52, BLOCKED: 32, UNKNOWN: 70 };

function estimateRiskScore({ overall, certified, blocking, advisory }) {
  let score = RISK_BASE_SCORE[overall] ?? 70;
  score -= blocking * 6 + advisory * 1.5;
  if (certified && blocking === 0) score = Math.max(score, 85);
  return Math.max(5, Math.min(100, Math.round(score)));
}

export default function RiskPanel({
  validation,
  onDownload,
  downloading,
  hideDownload,
  onFixIssue,
  fixingIssueId,
  gaps = [],
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
  // Informational notes -- stamp duty, registration, statutory checklists, and
  // citations the clause library has already queued for the supervising
  // advocate. The engine deliberately excludes them from the score because they
  // are not defects in this document. They were being carried into the panel
  // but never rendered, while the "Open Notes" row showed the actionable total
  // instead -- so the panel printed the advisory count twice under two labels.
  const notices = validation.notices || [];
  const noticeCount = validation.noticeCount ?? notices.length;

  const meta = RISK_META[overall] || RISK_META.UNKNOWN;
  // Show the number the engine actually computed. Re-deriving it here from the
  // coarse risk band meant the panel displayed a figure nobody had calculated on
  // the merits: a draft the engine scored 100 showed as 92, and one it scored 90
  // showed as 75, because the band -- not the findings -- set the base. A single
  // MEDIUM note therefore pinned every document in the catalogue to 73-76.
  const riskScore =
    typeof validation.score === "number"
      ? Math.max(0, Math.min(100, Math.round(validation.score)))
      : estimateRiskScore({
          overall,
          certified,
          blocking: blockingCount,
          advisory: advisoryCount,
        });

  // The engine's own wording. "Document Certified" was an overclaim the engine
  // explicitly avoids -- passing means the checks that ran found nothing, which
  // is narrower than compliance -- and "Needs Review" was shown for any finding
  // at all, so a clean draft with two informational notes screamed "Needs
  // Review" directly above the words "No blocking issues".
  const certification =
    validation.certification ||
    (blockingCount > 0 ? "Blocked" : certified ? "No issues detected" : "Review required");
  const certificationClass =
    blockingCount > 0 ? "certified-blocked" : certified ? "certified-yes" : "certified-review";
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

      <div className={`certified-badge ${certificationClass}`}>
        <span className="certified-icon">
          {blockingCount > 0
            ? Icons.x
            : certified
              ? Icons.checkCircle
              : Icons.info}
        </span>
        <span>{certification}</span>
      </div>

      <div className={`risk-badge ${meta.cls}`}>
        <span className="risk-icon">{meta.icon}</span>
        <span>{meta.label}</span>
      </div>

      <div className={`risk-score ${meta.cls}`}>
        <div className="risk-score-num">{riskScore}<span>/100</span></div>
        <div className="risk-score-bar">
          <div
            className="risk-score-fill"
            style={{ width: `${riskScore}%` }}
          />
        </div>
        <div className="risk-score-label">Document health score</div>
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
        {noticeCount > 0 && (
          <div className="risk-row">
            <span className="risk-row-label">Information Notes</span>
            <span className="risk-row-val issue-count">{noticeCount}</span>
          </div>
        )}
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

      {noticeCount > 0 && (
        <details className="advisory-section notices-section">
          <summary className="advisory-title">
            <span>Information Notes</span>
            <span className="advisory-count">{noticeCount}</span>
          </summary>

          <p className="notices-intro">
            Context for this document type. These do not affect the health score
            and there is nothing to fix in the draft.
          </p>

          <div className="advisory-list">
            {notices.map((issue, index) => (
              <div key={`${issue.rule_id}-${index}`} className="advisory-item">
                <span className="advisory-rule">{issue.rule_id}</span>
                <p className="advisory-message">
                  {issue.message || issue.suggestion}
                </p>
              </div>
            ))}
          </div>
        </details>
      )}

      {gaps.length > 0 && (
        <div className="gaps-section">
          <div className="gaps-title-row">
            <p className="gaps-title">Recommended additions</p>
            <span className="gaps-count">{gaps.length}</span>
          </div>
          <p className="gaps-subtitle">
            Common protections this document doesn't currently include. Consider
            adding them via the AI assistant.
          </p>
          {gaps.map((gap) => (
            <div className="gap-item" key={gap.category}>
              <div className="gap-item-name">{gap.label}</div>
              <p className="gap-item-why">{gap.why}</p>
            </div>
          ))}
        </div>
      )}

      {/* Gated on blocking issues, not on a spotless review. Gating on `certified`
          meant a draft with nothing blocking it was told to "resolve blocking
          issues" it did not have. */}
      {!hideDownload &&
        (blockingCount === 0 ? (
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
