import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../services/api";
import { Icons } from "../../utils/icons";
import AuthShowcase from "./AuthShowcase";
import "./Auth.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault(); setError(null); setLoading(true);
    try { await forgotPassword(email); setSent(true); }
    catch(err) { setError(err.response?.data?.error||"Failed to send reset email."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <AuthShowcase
          eyebrow="Account recovery"
          headline="Recover your"
          emphasis="workspace access"
          description="Request a secure reset link and be back in your drafting workspace within minutes."
          highlights={[
            { icon:Icons.keyRound, title:"Secure reset link", text:"A time-limited link sent directly to your inbox." },
            { icon:Icons.mail, title:"Inbox delivery", text:"Recovery emails reach the address tied to your account." },
            { icon:Icons.shieldCheck, title:"Protected workflow", text:"The reset path doesn't touch your saved drafts." },
            { icon:Icons.sparkles, title:"Fast return", text:"Back to drafting without restarting from scratch." },
          ]}
          footerTitle="Recovery steps"
          footerPoints={["Request a reset link using your account email.","Open the secure link and choose a new password.","Sign back in and continue from your workspace."]}
        />
      </div>
      <div className="auth-right">
        <div className="auth-form-logo">
          <span className="auth-form-logo-icon">{Icons.gavel}</span>
          <span className="auth-form-logo-text">Legal<em>AI</em>d</span>
        </div>
        {sent ? (
          <div className="auth-success">
            <div className="auth-success-icon">{Icons.mail}</div>
            <h2>Reset link sent</h2>
            <p>If an account exists for <strong style={{color:"var(--text-primary)"}}>{email}</strong>, a password reset link has been sent.</p>
            <p className="auth-success-sub">The link expires in one hour. Check spam if you don't see it.</p>
            <Link to="/login" className="auth-btn" style={{textDecoration:"none",display:"flex"}}>Back to Sign In</Link>
          </div>
        ) : (
          <>
            <div className="auth-form-header">
              <h1 className="auth-title">Forgot password?</h1>
              <p className="auth-subtitle">Enter your email and we'll send you a secure reset link.</p>
            </div>
            <div className="auth-inline-panel">
              <span className="auth-inline-icon">{Icons.keyRound}</span>
              <div>
                <div className="auth-inline-title">One-hour recovery window</div>
                <div className="auth-inline-text">Use the link promptly — it expires after 60 minutes.</div>
              </div>
            </div>
            {error && <div className="auth-error">{Icons.warning} {error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label">Email Address</label>
                <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/>
              </div>
              <button className={`auth-btn${loading?" auth-btn--loading":""}`} type="submit" disabled={loading}>
                {loading ? <><span className="btn-spinner"/> Sending…</> : "Send Reset Link →"}
              </button>
            </form>
            <p className="auth-switch">Remembered it? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
