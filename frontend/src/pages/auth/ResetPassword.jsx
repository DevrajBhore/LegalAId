import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../../services/api";
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

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [form, setForm] = useState({ password:"", confirm:"" });
  const [show, setShow] = useState({ password:false, confirm:false });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(()=>{ if (!token) setError("Invalid reset link. Please request a new one."); }, [token]);

  const handleChange = e => setForm(p=>({...p,[e.target.name]:e.target.value}));
  const toggleShow = f => setShow(p=>({...p,[f]:!p[f]}));
  const strength = getStrength(form.password);

  const handleSubmit = async e => {
    e.preventDefault(); setError(null);
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    try {
      await resetPassword(token, form.password);
      setSuccess(true);
      setTimeout(()=>navigate("/login"), 3000);
    } catch(err) {
      const d = err.response?.data;
      setError(d?.expired ? "This reset link has expired. Please request a new one." : d?.error||"Reset failed. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <AuthShowcase
          eyebrow="Secure reset"
          headline="Choose a new"
          emphasis="account password"
          description="Set fresh credentials and get your drafting workspace back under your control."
          highlights={[
            { icon:Icons.lock, title:"Strong password setup", text:"Use length and variation to keep your account secure." },
            { icon:Icons.eye, title:"Visibility toggle", text:"Check what you typed before submitting." },
            { icon:Icons.shieldCheck, title:"Secure storage", text:"Passwords are bcrypt-hashed — never stored in plaintext." },
            { icon:Icons.sparkles, title:"Back to work quickly", text:"Return to your workspace immediately after reset." },
          ]}
          footerTitle="Reset steps"
          footerPoints={["Open the reset link from your email.","Enter and confirm your new password.","Sign in again and continue drafting."]}
        />
      </div>
      <div className="auth-right">
        <div className="auth-form-logo">
          <span className="auth-form-logo-icon">{Icons.gavel}</span>
          <span className="auth-form-logo-text">Legal<em>AI</em>d</span>
        </div>
        {success ? (
          <div className="auth-success">
            <div className="auth-success-icon">{Icons.shieldCheck}</div>
            <h2>Password reset!</h2>
            <p>Your password has been changed successfully.</p>
            <p className="auth-success-sub">Redirecting you to sign in…</p>
            <Link to="/login" className="auth-btn" style={{textDecoration:"none",display:"flex"}}>Sign In Now</Link>
          </div>
        ) : (
          <>
            <div className="auth-form-header">
              <h1 className="auth-title">Reset password</h1>
              <p className="auth-subtitle">Enter your new password below.</p>
            </div>
            <div className="auth-inline-panel">
              <span className="auth-inline-icon">{Icons.lock}</span>
              <div>
                <div className="auth-inline-title">Choose a strong replacement</div>
                <div className="auth-inline-text">A strong password helps protect your saved drafts and sessions.</div>
              </div>
            </div>
            {error && (
              <div className="auth-error">
                {Icons.warning} {error}
                {error.includes("expired") && <Link to="/forgot-password" className="auth-error-link">Request new link</Link>}
              </div>
            )}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label">New Password <span>*</span></label>
                <div className="auth-input-wrap">
                  <input className="auth-input" type={show.password?"text":"password"} name="password" placeholder="At least 8 characters" value={form.password} onChange={handleChange} required autoFocus disabled={!token}/>
                  <button type="button" className="auth-eye-btn" onClick={()=>toggleShow("password")}>{show.password?Icons.eyeOff:Icons.eye}</button>
                </div>
                {strength && (
                  <div className={`password-strength password-strength--${strength}`}>
                    <div className="strength-bar"><div className="strength-fill"/></div>
                    <span>{{weak:"Weak",fair:"Fair",strong:"Strong"}[strength]}</span>
                  </div>
                )}
              </div>
              <div className="auth-field">
                <label className="auth-label">Confirm Password <span>*</span></label>
                <div className="auth-input-wrap">
                  <input className="auth-input" type={show.confirm?"text":"password"} name="confirm" placeholder="Repeat your new password" value={form.confirm} onChange={handleChange} required disabled={!token}/>
                  <button type="button" className="auth-eye-btn" onClick={()=>toggleShow("confirm")}>{show.confirm?Icons.eyeOff:Icons.eye}</button>
                </div>
                {form.confirm && form.password !== form.confirm && <p className="auth-field-error">Passwords do not match</p>}
              </div>
              <button className={`auth-btn${loading?" auth-btn--loading":""}`} type="submit" disabled={loading||!token}>
                {loading ? <><span className="btn-spinner"/> Resetting…</> : "Reset Password →"}
              </button>
            </form>
            <p className="auth-switch"><Link to="/login">Back to Sign In</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
