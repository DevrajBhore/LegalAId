import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { loginUser } from "../../services/api";
import { Icons } from "../../utils/icons";
import AuthShowcase from "./AuthShowcase";
import "./Auth.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email:"", password:"" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const from = location.state?.from || "/";
  const docType = location.state?.document_type;

  const handleChange = e => setForm(p=>({...p,[e.target.name]:e.target.value}));

  const handleSubmit = async e => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const res = await loginUser(form);
      login(res.data.token, res.data.user);
      if (from==="/form" && docType) { navigate("/form",{state:{document_type:docType},replace:true}); return; }
      navigate(from, {replace:true});
    } catch(err) {
      const d = err.response?.data;
      if (d?.unverified) { setError("Your email is not verified."); return; }
      setError(d?.error||"Login failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <AuthShowcase
          eyebrow="Workspace access"
          headline="Back to your legal"
          emphasis="drafting workspace"
          description="Continue with AI-assisted drafting, clause editing, legal validation, and one-click DOCX export."
          highlights={[
            { icon:Icons.fileText, title:"16+ document types", text:"Access every Indian legal document type in the library." },
            { icon:Icons.sparkles, title:"AI drafting support", text:"Generate a complete first draft from your intake form." },
            { icon:Icons.shieldCheck, title:"Legal validation", text:"Built-in checks review structure, key terms, and drafting quality before export." },
            { icon:Icons.download, title:"DOCX export", text:"Download court-ready Word documents in one click." },
          ]}
          footerTitle="After signing in"
          footerPoints={["Pick a document type and fill the guided intake form.","Review, edit, and refine clauses in the browser workspace.","Validate and export your certified DOCX."]}
        />
      </div>
      <div className="auth-right">
        <div className="auth-form-logo">
          <span className="auth-form-logo-icon">{Icons.gavel}</span>
          <span className="auth-form-logo-text">Legal<em>AI</em>d</span>
        </div>
        <div className="auth-form-header">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to continue drafting with AI and Indian legal knowledge.</p>
        </div>
        <div className="auth-inline-panel">
          <span className="auth-inline-icon">{Icons.shieldCheck}</span>
          <div>
            <div className="auth-inline-title">Secure account access</div>
            <div className="auth-inline-text">Verification protects your drafting workspace and sessions.</div>
          </div>
        </div>
        {error && (
          <div className="auth-error">
            {Icons.warning} {error}
            {error.includes("not verified") && (
              <Link to="/resend-verification" state={{email:form.email}} className="auth-error-link">Resend email</Link>
            )}
          </div>
        )}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input className="auth-input" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoFocus/>
          </div>
          <div className="auth-field">
            <div className="auth-label-row">
              <label className="auth-label">Password</label>
              <Link to="/forgot-password" className="auth-forgot-link">Forgot password?</Link>
            </div>
            <div className="auth-input-wrap">
              <input className="auth-input" type={showPw?"text":"password"} name="password" placeholder="Your password" value={form.password} onChange={handleChange} required/>
              <button type="button" className="auth-eye-btn" onClick={()=>setShowPw(p=>!p)}>{showPw?Icons.eyeOff:Icons.eye}</button>
            </div>
          </div>
          <button className={`auth-btn${loading?" auth-btn--loading":""}`} type="submit" disabled={loading}>
            {loading ? <><span className="btn-spinner"/> Signing in…</> : "Sign In →"}
          </button>
        </form>
        <p className="auth-switch">Don't have an account? <Link to="/register">Create one</Link></p>
      </div>
    </div>
  );
}
