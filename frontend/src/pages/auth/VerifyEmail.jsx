import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { verifyEmailToken } from "../../services/api";
import { Icons } from "../../utils/icons";
import AuthShowcase from "./AuthShowcase";
import "./Auth.css";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  useEffect(()=>{
    const token = searchParams.get("token");
    if (!token) { setStatus("error"); setMessage("No verification token found in the link."); return; }
    verifyEmailToken(token)
      .then(res=>{ login(res.data.token, res.data.user); setStatus("success"); setMessage(res.data.message); setTimeout(()=>navigate("/"), 3000); })
      .catch(err=>{ setStatus("error"); setMessage(err.response?.data?.error||"Verification failed. Please try again."); });
  }, [login, navigate, searchParams]);

  return (
    <div className="auth-page">
      <div className="auth-left">
        <AuthShowcase
          eyebrow="Email verification"
          headline="Activate your"
          emphasis="drafting workspace"
          description="Verify your email to unlock the full workflow: AI drafting, editing, validation, and export."
          highlights={[
            { icon:Icons.mail, title:"Verified access", text:"Email confirmation protects the workspace tied to your account." },
            { icon:Icons.fileText, title:"Document workflows", text:"Access intake, editor, and export once verification is complete." },
            { icon:Icons.shieldCheck, title:"Safer account actions", text:"Verification protects sign in, recovery, and saved sessions." },
            { icon:Icons.sparkles, title:"Ready for first draft", text:"Complete this once, then go straight to drafting." },
          ]}
          footerTitle="Activation flow"
          footerPoints={["Open the link sent to your inbox.","Verify the account in one step.","Start using the workspace immediately."]}
        />
      </div>
      <div className="auth-right">
        <div className="auth-form-logo">
          <span className="auth-form-logo-icon">{Icons.gavel}</span>
          <span className="auth-form-logo-text">Legal<em>AI</em>d</span>
        </div>
        {status === "verifying" && (
          <div className="auth-verifying">
            <div className="auth-spinner"/>
            <h2>Verifying your email…</h2>
            <p>Please wait a moment.</p>
          </div>
        )}
        {status === "success" && (
          <div className="auth-success">
            <div className="auth-success-icon">{Icons.checkCircle}</div>
            <h2>Email verified!</h2>
            <p>{message}</p>
            <p className="auth-success-sub">Redirecting you to the app…</p>
            <button className="auth-btn" onClick={()=>navigate("/")}>Go to App →</button>
          </div>
        )}
        {status === "error" && (
          <div className="auth-error-state">
            <div className="auth-error-icon">{Icons.x}</div>
            <h2>Verification failed</h2>
            <p>{message}</p>
            <Link to="/resend-verification" className="auth-btn" style={{textDecoration:"none",display:"flex"}}>Resend Verification Email</Link>
            <p className="auth-switch" style={{marginTop:12}}><Link to="/login">Back to Sign In</Link></p>
          </div>
        )}
      </div>
    </div>
  );
}
