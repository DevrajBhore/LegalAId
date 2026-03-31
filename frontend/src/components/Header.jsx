import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Header.css";
import { Icons } from "../utils/icons";

const EDITOR_SESSION_KEY = "legalaid_editor_draft";

function hasSavedDraft() {
  try {
    const saved = sessionStorage.getItem(EDITOR_SESSION_KEY);
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    return Boolean(parsed?.draft);
  } catch {
    return Boolean(sessionStorage.getItem(EDITOR_SESSION_KEY));
  }
}

export default function Header() {
  const location = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const resumeDraftAvailable = useMemo(
    () => hasSavedDraft(),
    [location.pathname]
  );

  const isActive = (path) => location.pathname === path;
  const close = () => setMenuOpen(false);
  const primaryLinks = [
    { label: "Home", path: "/" },
    { label: "Library", path: "/library" },
    { label: "Help", path: "/help" },
    { label: "About", path: "/about" },
  ];
  const secondaryLinks = [
    { label: "Contact", path: "/contact" },
    ...(user
      ? [
          { label: "Documents", path: "/documents" },
          { label: "Profile", path: "/profile" },
        ]
      : []),
  ];

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo" onClick={close}>
          <span className="header-logo-mark">{Icons.gavel}</span>
          <span className="header-logo-text">
            Legal<em>AI</em>d
          </span>
        </Link>

        <div className="header-pill">
          <span className="header-pill-dot" />
          AI drafting | Indian legal knowledge
        </div>

        <nav className="header-nav">
          {primaryLinks.map(({ label, path }) => (
            <Link
              key={path}
              to={path}
              className={`nav-link${isActive(path) ? " nav-link--active" : ""}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {user ? (
            <div className="header-user">
              {resumeDraftAvailable && (
                <Link
                  to="/editor"
                  className="header-resume"
                  title="Resume current draft"
                >
                  <span className="header-resume-icon">{Icons.scroll}</span>
                  Resume draft
                </Link>
              )}
              <Link to="/profile" className="header-avatar" title="View profile">
                {user.name.charAt(0).toUpperCase()}
              </Link>
              <div className="header-user-info">
                <div className="header-user-name">{user.name.split(" ")[0]}</div>
                <div className="header-user-role">Workspace ready</div>
              </div>
            </div>
          ) : (
            <div className="header-auth">
              <Link to="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary">
                Start drafting
              </Link>
            </div>
          )}
        </div>

        <button
          className={`header-hamburger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="header-drawer">
          <div className="header-pill" style={{ marginBottom: 8 }}>
            <span className="header-pill-dot" />
            AI drafting | Indian legal knowledge
          </div>

          {primaryLinks.map(({ label, path }) => (
            <Link key={path} to={path} className="drawer-link" onClick={close}>
              {label}
            </Link>
          ))}

          {secondaryLinks.map(({ label, path }) => (
            <Link key={path} to={path} className="drawer-link" onClick={close}>
              {label}
            </Link>
          ))}

          {user && resumeDraftAvailable && (
            <Link
              to="/editor"
              className="drawer-link drawer-link--accent"
              onClick={close}
            >
              Resume draft
            </Link>
          )}
          <div className="drawer-divider" />

          {user ? (
            <div className="drawer-user">
              <div className="drawer-avatar">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="drawer-user-name">{user.name}</div>
                <div className="drawer-user-sub">Workspace ready</div>
              </div>
            </div>
          ) : (
            <div className="drawer-auth">
              <Link to="/login" className="btn-ghost w-full" onClick={close}>
                Sign in
              </Link>
              <Link
                to="/register"
                className="btn-primary w-full"
                onClick={close}
              >
                Start drafting
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
