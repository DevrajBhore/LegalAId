import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icons } from "../utils/icons";
import "./Profile.css";

const FEATURES = [
  { icon: Icons.fileText, label: "16+ document types", active: true },
  { icon: Icons.shieldCheck, label: "Legal validation", active: true },
  { icon: Icons.sparkles, label: "AI drafting assistant", active: true },
  { icon: Icons.download, label: "DOCX export", active: true },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!user) navigate("/login");
  }, [navigate, user]);

  if (!user) return null;

  const initials = useMemo(
    () =>
      user.name
        ? user.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
        : "LA",
    [user.name]
  );

  const joined = new Date(user.createdAt || Date.now()).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" }
  );

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="profile-page">
      <div className="profile-inner">
        <div className="profile-hero animate-in">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-hero-info">
            <div className="profile-eyebrow">Workspace profile</div>
            <h1 className="profile-name">{user.name}</h1>
            <p className="profile-email-row">{user.email}</p>
            <div className="profile-badges">
              <span className="profile-badge profile-badge--green">
                {Icons.check} Verified
              </span>
              <span className="profile-badge">Member since {joined}</span>
            </div>
          </div>
          {/* <div className="profile-hero-actions">
            <button
              className="profile-signout"
              onClick={() => setShowConfirm(true)}
            >
              {Icons.logOut} Sign out
            </button>
          </div> */}
        </div>

        <div className="profile-grid animate-in-d1">
          <div className="profile-card">
            <h3 className="profile-card-title">Account Information</h3>
            <div className="profile-fields">
              {[
                ["Full Name", user.name],
                ["Email Address", user.email],
                ["Account Status", null],
              ].map(([label, value]) => (
                <div key={label} className="profile-field">
                  <span className="profile-field-label">{label}</span>
                  {label === "Account Status" ? (
                    <span className="profile-field-value profile-field-green">
                      <span className="status-dot" />
                      Active &amp; Verified
                    </span>
                  ) : (
                    <span className="profile-field-value">{value}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="profile-card">
            <h3 className="profile-card-title">Platform Access</h3>
            <div className="profile-features">
              {FEATURES.map((feature) => (
                <div key={feature.label} className="profile-feature">
                  <span className="profile-feature-icon">{feature.icon}</span>
                  <span className="profile-feature-label">{feature.label}</span>
                  <span className="profile-feature-check">{Icons.check}</span>
                </div>
              ))}
            </div>
          </div>

          {/* <div className="profile-card">
            <h3 className="profile-card-title">Current Session</h3>
            <p className="profile-card-sub">
              Password recovery is available only from the sign-in flow through
              Forgot password.
            </p>
            <div className="profile-session">
              <div className="profile-session-dot" />
              <div>
                <div className="profile-session-label">
                  Current browser session
                </div>
                <div className="profile-session-sub">
                  JWT token | expires in 7 days
                </div>
              </div>
              <button
                className="profile-session-revoke"
                onClick={handleLogout}
              >
                Sign out
              </button>
            </div>
          </div> */}

          <div className="profile-card profile-card--actions">
            <h3 className="profile-card-title">Quick actions</h3>
            <div className="profile-actions">
              <button
                className="profile-action-btn profile-action-btn--primary"
                onClick={() => navigate("/library")}
              >
                {Icons.fileText} Browse library
              </button>
              <Link to="/documents" className="profile-action-btn">
                {Icons.scroll} My documents
              </Link>
              <Link to="/help" className="profile-action-btn">
                {Icons.info} Help center
              </Link>
              <button
                className="profile-action-btn profile-action-btn--danger"
                onClick={() => setShowConfirm(true)}
              >
                {Icons.logOut} Sign out
              </button>
            </div>
          </div>
        </div>

        {showConfirm && (
          <div
            className="profile-confirm-overlay"
            onClick={() => setShowConfirm(false)}
          >
            <div
              className="profile-confirm-box"
              onClick={(event) => event.stopPropagation()}
            >
              <h4>Sign out of LegalAId?</h4>
              <p>Your current session will end. Unsaved drafts may be lost.</p>
              <div className="profile-confirm-btns">
                <button className="profile-confirm-yes" onClick={handleLogout}>
                  Yes, sign out
                </button>
                <button
                  className="profile-confirm-no"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
