import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resendVerificationEmail } from "../../services/api";
import { Icons } from "../../utils/icons";
import AuthShowcase from "./AuthShowcase";
import "./Auth.css";

export default function ResendVerification() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email||"");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async e => {
    e.preventDefault(); setError(null); setLoading(true);
    try { const res = await resendVerificationEmail(email); setSuccess(res.data.message); }
    catch(err) { setError(err.response?.data?.error||"Failed to resend. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <AuthShowcase
          eyebrow="Verification help"
          headline="Send a fresh"
          emphasis="verification link"
          description="Request a new email and finish account activation without leaving the onboarding flow."
          highlights={[
            { icon:Icons.mail, title:"Fresh link delivery", text:"Request a new verification email anytime the first is missed." },
            { icon:Icons.user, title:"Same account", text:"Verification completes access for the account you already created." },
            { icon:Icons.shieldCheck, title:"Protected onboarding", text:"Activation ties your legal drafting work to the right user." },
            { icon:Icons.sparkles, title:"Quick restart", text:"Finish verification and move directly into the product." },
          ]}
          footerTitle="Resend flow"
          footerPoints={["Enter the email used during registration.","Open the latest verification message.","Activate the account and continue drafting."]}
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
            <h2>Email sent!</h2>
            <p>{success}</p>
            <p className="auth-success-sub">Check your inbox and click the verification link.</p>
            <Link to="/login" className="auth-btn" style={{textDecoration:"none",display:"flex"}}>Back to Sign In</Link>
          </div>
        ) : (
          <>
            <div className="auth-form-header">
              <h1 className="auth-title">Resend verification</h1>
              <p className="auth-subtitle">We'll send a fresh link to your account email.</p>
            </div>
            <div className="auth-inline-panel">
              <span className="auth-inline-icon">{Icons.mail}</span>
              <div>
                <div className="auth-inline-title">Use your registration email</div>
                <div className="auth-inline-text">The new message will be sent to the same address you signed up with.</div>
              </div>
            </div>
            {error && <div className="auth-error">{Icons.warning} {error}</div>}
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label">Email Address</label>
                <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/>
              </div>
              <button className={`auth-btn${loading?" auth-btn--loading":""}`} type="submit" disabled={loading}>
                {loading ? <><span className="btn-spinner"/> Sending…</> : "Send Verification Email →"}
              </button>
            </form>
            <p className="auth-switch"><Link to="/login">Back to Sign In</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
