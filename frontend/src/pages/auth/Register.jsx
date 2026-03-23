import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "./Auth.css";

const API = axios.create({ baseURL: "http://localhost:5000" });

export default function Register() {
  const navigate = useNavigate();
  const [form,    setForm]    = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) return setError("Enter a valid 10-digit Indian mobile number.");
    setLoading(true);
    try {
      const res = await API.post("/auth/register", form);
      setSuccess(res.data.message);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.error || "Registration failed. Please try again.");
      if (data?.unverified) setTimeout(() => navigate("/resend-verification", { state: { email: form.email } }), 2000);
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
            <h2>Check your inbox</h2>
            <p>{success}</p>
            <p className="auth-success-sub">Click the link in the email to activate your account.</p>
            <button className="auth-btn" onClick={() => navigate("/login")}>Back to Login</button>
          </div>
        ) : (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Create account</h1>
              <p className="auth-subtitle">Start generating legally sound Indian documents</p>
            </div>

            {error && <div className="auth-error"><span>⚠</span> {error}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>

              <div className="auth-field">
                <label className="auth-label">Full Name <span>*</span></label>
                <input className="auth-input" type="text" name="name"
                  placeholder="e.g. Arjun Sharma"
                  value={form.name} onChange={handleChange} required autoFocus />
              </div>

              <div className="auth-field">
                <label className="auth-label">Email Address <span>*</span></label>
                <input className="auth-input" type="email" name="email"
                  placeholder="you@example.com"
                  value={form.email} onChange={handleChange} required />
              </div>

              <div className="auth-field">
                <label className="auth-label">Mobile Number <span>*</span></label>
                <div className="auth-phone-row">
                  <span className="auth-phone-prefix">+91</span>
                  <input className="auth-input auth-phone-input" type="tel" name="phone"
                    placeholder="9876543210" maxLength={10}
                    value={form.phone} onChange={handleChange} required />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Password <span>*</span></label>
                <input className="auth-input" type="password" name="password"
                  placeholder="At least 8 characters"
                  value={form.password} onChange={handleChange} required />
              </div>

              <button className={`auth-btn${loading ? " auth-btn--loading" : ""}`}
                type="submit" disabled={loading}>
                {loading ? "Creating account…" : "Create Account →"}
              </button>
            </form>

            <p className="auth-switch">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}