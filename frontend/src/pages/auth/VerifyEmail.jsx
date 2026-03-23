import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import "./Auth.css";

const API = axios.create({ baseURL: "http://localhost:5000" });

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [status,  setStatus]  = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token found in the link.");
      return;
    }

    API.get(`/auth/verify-email?token=${token}`)
      .then(res => {
        login(res.data.token, res.data.user);
        setStatus("success");
        setMessage(res.data.message);
        // Auto-redirect after 3 seconds
        setTimeout(() => navigate("/"), 3000);
      })
      .catch(err => {
        setStatus("error");
        setMessage(err.response?.data?.error || "Verification failed. Please try again.");
      });
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">
          <span className="auth-logo-text">Legal<em>AI</em>d</span>
          <span className="auth-logo-tag">Indian Legal Document Engine</span>
        </div>

        {status === "verifying" && (
          <div className="auth-verifying">
            <div className="auth-spinner" />
            <h2>Verifying your email…</h2>
            <p>Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="auth-success">
            <div className="auth-success-icon">✓</div>
            <h2>Email verified!</h2>
            <p>{message}</p>
            <p className="auth-success-sub">Redirecting you to the app…</p>
            <button className="auth-btn" onClick={() => navigate("/")}>
              Go to App →
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="auth-error-state">
            <div className="auth-error-icon">✗</div>
            <h2>Verification failed</h2>
            <p>{message}</p>
            <Link to="/resend-verification" className="auth-btn" style={{ textDecoration: "none", display: "inline-block", marginTop: "16px" }}>
              Resend Verification Email
            </Link>
            <p className="auth-switch" style={{ marginTop: "16px" }}>
              <Link to="/login">Back to Login</Link>
            </p>
          </div>
        )}

      </div>
    </div>
  );
}