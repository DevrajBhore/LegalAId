import "./MobileActionBar.css";

/**
 * A phone-only sticky action bar pinned to the bottom (thumb zone). Keeps the
 * primary action reachable no matter how long the page is, instead of buried at
 * the end of a scroll. Hidden on desktop (the page's own CTA is used there).
 *
 * Props:
 *   label      string            — primary button text
 *   onClick    () => void
 *   hint       string (optional) — small progress/context line on the left
 *   disabled   bool (optional)
 *   trailing   node (optional)   — e.g. an arrow icon inside the button
 */
export default function MobileActionBar({ label, onClick, hint, disabled = false, trailing = null }) {
  return (
    <div className="mobile-action-bar" role="region" aria-label="Primary action">
      {hint && <span className="mobile-action-bar__hint">{hint}</span>}
      <button
        type="button"
        className="mobile-action-bar__btn"
        onClick={onClick}
        disabled={disabled}
      >
        {label}
        {trailing}
      </button>
    </div>
  );
}
