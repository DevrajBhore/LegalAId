import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icons } from "../utils/icons";
import "./Footer.css";

export default function Footer() {
  const year = new Date().getFullYear();
  const { user } = useAuth();

  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <span className="footer-logo-mark">{Icons.gavel}</span>
            <span className="footer-logo-text">
              Legal<em>AI</em>d
            </span>
          </Link>

          <p className="footer-desc">
            AI-assisted Indian legal drafting with in-browser review, validation,
            and export-ready document workflows.
          </p>

          <div className="footer-trust">
            <span className="footer-trust-dot" />
            AI drafting | Indian legal knowledge
          </div>
        </div>

        <div className="footer-nav">
          <div className="footer-col">
            <div className="footer-col-title">Platform</div>
            <Link to="/library" className="footer-link">
              Document library
            </Link>
            <Link to="/" className="footer-link">
              Home
            </Link>
            <Link to="/documents" className="footer-link">
              Saved drafts
            </Link>
            <Link to="/help" className="footer-link">
              Help center
            </Link>
          </div>

          <div className="footer-col">
            <div className="footer-col-title">Company</div>
            <Link to="/about" className="footer-link">
              About
            </Link>
            <Link to="/contact" className="footer-link">
              Contact
            </Link>
            <Link to="/library" className="footer-link">
              Browse library
            </Link>
          </div>

          <div className="footer-col">
            <div className="footer-col-title">{user ? "Workspace" : "Account"}</div>
            {user ? (
              <>
                <Link to="/documents" className="footer-link">
                  My documents
                </Link>
                <Link to="/profile" className="footer-link">
                  Profile
                </Link>
                <Link to="/library" className="footer-link">
                  Start new draft
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="footer-link">
                  Create account
                </Link>
                <Link to="/login" className="footer-link">
                  Sign in
                </Link>
                <Link to="/forgot-password" className="footer-link">
                  Forgot password
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="footer-bottom-inner">
          <span className="footer-copy">
            &copy; {year} LegalAId. All rights reserved.
          </span>
          <div className="footer-legal">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/terms-of-service">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
