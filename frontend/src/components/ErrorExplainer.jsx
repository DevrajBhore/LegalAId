import { useState } from "react";
import { Icons } from "../utils/icons";
import "./ErrorExplainer.css";

/**
 * Shared failure-explanation surface used across Form, Editor, Documents, Auth,
 * and Export flows. Every failure is shown as: what happened, why it happened,
 * how to fix it, plus optional specific items and collapsible technical detail.
 *
 * Props:
 *   variant         "error" | "blocked" | "warning"
 *   title           short headline
 *   message         one-line plain-English summary of what happened
 *   cause           why it happened
 *   solution        how to fix it
 *   items           [{ title, detail, suggestion }] — specific blocking issues
 *   onItemAction    (item, index) => void — optional per-item action (e.g. jump)
 *   itemActionLabel label for the per-item action button
 *   technicalDetail raw error string (collapsed by default)
 *   onClose         optional dismiss handler
 */
export default function ErrorExplainer({
  variant = "error",
  title,
  message,
  cause,
  solution,
  items = [],
  onItemAction,
  itemActionLabel = "Go to clause",
  technicalDetail,
  onClose,
}) {
  const [showTechnical, setShowTechnical] = useState(false);

  if (!title && !message) return null;

  return (
    <div className={`error-explainer error-explainer--${variant}`} role="alert">
      <div className="error-explainer__head">
        <span className="error-explainer__icon">{Icons.warning}</span>
        <div className="error-explainer__headtext">
          {title && <h3 className="error-explainer__title">{title}</h3>}
          {message && <p className="error-explainer__message">{message}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            className="error-explainer__close"
            onClick={onClose}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      <div className="error-explainer__body">
        {cause && (
          <div className="error-explainer__row">
            <span className="error-explainer__label">Why it happened</span>
            <span className="error-explainer__value">{cause}</span>
          </div>
        )}
        {solution && (
          <div className="error-explainer__row">
            <span className="error-explainer__label">How to fix it</span>
            <span className="error-explainer__value">{solution}</span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <ul className="error-explainer__items">
          {items.map((item, index) => (
            <li className="error-explainer__item" key={item.title || index}>
              <div className="error-explainer__item-main">
                <span className="error-explainer__item-title">
                  {item.title || `Issue ${index + 1}`}
                </span>
                {item.detail && (
                  <span className="error-explainer__item-detail">
                    {item.detail}
                  </span>
                )}
                {item.suggestion && (
                  <span className="error-explainer__item-suggestion">
                    Suggested fix: {item.suggestion}
                  </span>
                )}
              </div>
              {onItemAction && (
                <button
                  type="button"
                  className="error-explainer__item-action"
                  onClick={() => onItemAction(item, index)}
                >
                  {itemActionLabel}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {technicalDetail && (
        <div className="error-explainer__technical">
          <button
            type="button"
            className="error-explainer__technical-toggle"
            onClick={() => setShowTechnical((value) => !value)}
            aria-expanded={showTechnical}
          >
            {showTechnical ? "Hide technical detail" : "Show technical detail"}
          </button>
          {showTechnical && (
            <pre className="error-explainer__technical-body">
              {technicalDetail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
