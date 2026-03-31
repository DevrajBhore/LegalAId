import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../../services/api";
import { Icons } from "../../utils/icons";
import AuthShowcase from "./AuthShowcase";
import "./Auth.css";

function getStrength(pw) {
  if (!pw) return null;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s <= 1 ? "weak" : s <= 3 ? "fair" : "strong";
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:"", email:"", phone:"", password:"" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleChange = e => setForm(p=>({...p,[e.target.name]:e.target.value}));

  const handleSubmit = async e => {
    e.preventDefault(); setError(null);
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) return setError("Enter a valid 10-digit Indian mobile number.");
    setLoading(true);
    try {
      const res = await registerUser(form);
      setSuccess(res.data.message);
    } catch(err) {
      const d = err.response?.data;
      setError(d?.error||"Registration failed. Please try again.");
      if (d?.unverified) setTimeout(()=>navigate("/resend-verification",{state:{email:form.email}}), 2000);
    } finally { setLoading(false); }
  };

  const strength = getStrength(form.password);

  return (
    <div className="auth-page">
      <div className="auth-left">
        <AuthShowcase
          eyebrow="Create your workspace"
          headline="Start drafting Indian"
          emphasis="legal documents faster"
          description="Open a workspace with AI drafting, browser editing, legal validation, and instant DOCX export. Free forever."
          highlights={[
            { icon:Icons.fileText, title:"16+ document types", text:"NDAs, employment contracts, leases, and more." },
            { icon:Icons.sparkles, title:"AI-drafted clauses", text:"AI drafts every clause from your actual inputs." },
            { icon:Icons.shieldCheck, title:"Legal validation", text:"Built-in checks review structure, drafting quality, and key legal terms." },
            { icon:Icons.download, title:"DOCX export", text:"Court-ready Word documents in one click." },
          ]}
          footerTitle="What you unlock"
          footerPoints={["A guided intake form for every document type.","Clause-by-clause browser editing with AI assistance.","Validate and export a certified DOCX in minutes."]}
        />
      </div>
      <div className="auth-right">
        <div className="auth-form-logo">
          <span className="auth-form-logo-icon">{Icons.gavel}</span>
          <span className="auth-form-logo-text">Legal<em>AI</em>d</span>
        </div>
        {success ? (
          <div className="auth-success">
            <div className="auth-success-icon">{Icons.mail}</div>
            <h2>Check your inbox</h2>
            <p>{success}</p>
            <p className="auth-success-sub">Click the link in the email to activate your account.</p>
            <button className="auth-btn" onClick={()=>navigate("/login")}>Back to Sign In</button>
          </div>
        ) : (
          <>
            <div className="auth-form-header">
              <h1 className="auth-title">Create account</h1>
              <p className="auth-subtitle">Free forever. No credit card required.</p>
            </div>
            <div className="auth-inline-panel">
              <span className="auth-inline-icon">{Icons.mail}</span>
              <div>
                <div className="auth-inline-title">Email verification required</div>
                <div className="auth-inline-text">We verify each account before opening the workspace.</div>
              </div>
            </div>
            {error && <div className="auth-error">{Icons.warning} {error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label">Full Name <span>*</span></label>
                <input className="auth-input" type="text" name="name" placeholder="Arjun Sharma" value={form.name} onChange={handleChange} required autoFocus/>
              </div>
              <div className="auth-field">
                <label className="auth-label">Email Address <span>*</span></label>
                <input className="auth-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required/>
              </div>
              <div className="auth-field">
                <label className="auth-label">Mobile Number</label>
                <div className="auth-phone-row">
                  <span className="auth-phone-prefix">+91</span>
                  <input className="auth-input auth-phone-input" type="tel" name="phone" placeholder="9876543210" maxLength={10} value={form.phone} onChange={handleChange}/>
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Password <span>*</span></label>
                <div className="auth-input-wrap">
                  <input className="auth-input" type={showPw?"text":"password"} name="password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} required/>
                  <button type="button" className="auth-eye-btn" onClick={()=>setShowPw(p=>!p)}>{showPw?Icons.eyeOff:Icons.eye}</button>
                </div>
                {strength && (
                  <div className={`password-strength password-strength--${strength}`}>
                    <div className="strength-bar"><div className="strength-fill"/></div>
                    <span>{{weak:"Weak",fair:"Fair",strong:"Strong"}[strength]}</span>
                  </div>
                )}
              </div>
              <button className={`auth-btn${loading?" auth-btn--loading":""}`} type="submit" disabled={loading}>
                {loading ? <><span className="btn-spinner"/> Creating account…</> : "Create Account →"}
              </button>
            </form>
            <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
