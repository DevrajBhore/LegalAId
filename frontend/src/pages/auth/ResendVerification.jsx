import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import "./Auth.css";

const API = axios.create({ baseURL: "http://localhost:5000" });

export default function ResendVerification() {
  const location = useLocation();
  const [email,   setEmail]   = useState(location.state?.email || "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await API.post("/auth/resend-verification", { email });
      setSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          <span className="auth-logo-text">Legal<em>AI</em>d</span>
          <span className="auth-logo-tag">Indian Legal Document Engine</span>
        </div>

        {success ? (
          <div className="auth-success">
            <div className="auth-success-icon">✉</div>
            <h2>Email sent!</h2>
            <p>{success}</p>
            <p className="auth-success-sub">Check your inbox and click the verification link.</p>
            <Link to="/login" className="auth-btn" style={{ textDecoration: "none" }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Resend verification</h1>
              <p className="auth-subtitle">We'll send a new verification link to your email</p>
            </div>

            {error && <div className="auth-error"><span>⚠</span> {error}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label">Email Address</label>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                className={`auth-btn${loading ? " auth-btn--loading" : ""}`}
                type="submit"
                disabled={loading}
              >
                {loading ? "Sending…" : "Send Verification Email →"}
              </button>
            </form>

            <p className="auth-switch">
              <Link to="/login">Back to Login</Link>
            </p>
          </>
        )}

      </div>
    </div>
  );
}