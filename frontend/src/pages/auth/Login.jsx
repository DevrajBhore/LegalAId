import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import "./Auth.css";

const API = axios.create({ baseURL: "http://localhost:5000" });

export default function Login() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const [form,    setForm]    = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const from = location.state?.from || "/";

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await API.post("/auth/login", form);
      login(res.data.token, res.data.user);
      if (from === "/form" && docType) {
        navigate("/form", { state: { document_type: docType }, replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.unverified) {
        setError("Your email is not verified. ");
        return;
      }
      setError(data?.error || "Login failed. Please try again.");
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

        <div className="auth-header">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        {error && (
          <div className="auth-error">
            <span>⚠</span> {error}
            {error.includes("not verified") && (
              <Link
                to="/resend-verification"
                state={{ email: form.email }}
                className="auth-error-link"
              >
                Resend verification email
              </Link>
            )}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input
              className="auth-input"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              name="password"
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            className={`auth-btn${loading ? " auth-btn--loading" : ""}`}
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/register">Create one</Link>
        </p>

      </div>
    </div>
  );
}