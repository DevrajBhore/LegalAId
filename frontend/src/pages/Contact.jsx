import { useState } from "react";
import { Link } from "react-router-dom";
import { Icons } from "../utils/icons";
import { sendContactMessage } from "../services/api";

// Set at build time (VITE_CONTACT_EMAIL). Until it is set the page shows no
// address, rather than one on a domain nobody receives mail for.
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL || "").trim();
import "./Contact.css";

export default function Contact() {
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", subject:"", message:"", website:"" });
  const [status, setStatus] = useState("idle"); // idle|submitting|success
  const [error, setError] = useState(null);

  const handleChange = e => setForm(p=>({...p,[e.target.name]:e.target.value}));
  // The form used to show "Message sent" after a timer and send nothing.
  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setStatus("submitting");
    try {
      await sendContactMessage({
        name: `${form.firstName} ${form.lastName}`.trim(),
        email: form.email,
        subject: form.subject,
        message: form.message,
        website: form.website,
      });
      setStatus("success");
    } catch (err) {
      setError(err.response?.data?.error || "Your message could not be sent. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="contact-page">
      <div className="contact-hero animate-in">
        <span className="contact-eyebrow">CONTACT US</span>
        <h1 className="contact-title">Let's talk <em>legal tech</em></h1>
        <p className="contact-sub">Questions, feedback, a bug, or a request about your personal data: send us a message.</p>
      </div>

      <div className="contact-shell">
        <div className="contact-left animate-in-d1">
          {CONTACT_EMAIL ? (
            <div className="contact-info-card">
              <div className="contact-info-icon">{Icons.mail}</div>
              <div>
                <div className="contact-info-label">Support, privacy and grievances</div>
                <div className="contact-info-value">{CONTACT_EMAIL}</div>
              </div>
            </div>
          ) : null}
          <div className="contact-info-card">
            <div className="contact-info-icon">{Icons.shieldCheck}</div>
            <div>
              <div className="contact-info-label">Your data</div>
              <div className="contact-info-value">
                Correct your details, download your data or delete your account from your <Link to="/profile">Profile</Link>.
              </div>
            </div>
          </div>
        </div>

        <div className="contact-right animate-in-d2">
          {status === "success" ? (
            <div className="contact-success">
              <div className="contact-success-icon">{Icons.checkCircle}</div>
              <h3>Message sent</h3>
              <p>Thanks. We will reply to the email address you gave.</p>
              <button className="contact-success-reset" onClick={()=>{ setStatus("idle"); setForm({firstName:"",lastName:"",email:"",subject:"",message:"",website:""}); }}>Send another</button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
              {error && <div className="contact-error" role="alert">{error}</div>}
              {/* Honeypot: hidden from people, filled by bots. */}
              <input className="contact-hp" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={handleChange}/>
              <div className="contact-form-row">
                <div className="contact-form-group">
                  <label>First name</label>
                  <input name="firstName" type="text" required placeholder="Varun" value={form.firstName} onChange={handleChange}/>
                </div>
                <div className="contact-form-group">
                  <label>Last name</label>
                  <input name="lastName" type="text" required placeholder="Bhore" value={form.lastName} onChange={handleChange}/>
                </div>
              </div>
              <div className="contact-form-group">
                <label>Email address</label>
                <input name="email" type="email" required placeholder="varun@firm.com" value={form.email} onChange={handleChange}/>
              </div>
              <div className="contact-form-group">
                <label>Subject</label>
                <select name="subject" required value={form.subject} onChange={handleChange} className={!form.subject?"contact-select-empty":""}>
                  <option value="">Select a topic…</option>
                  <option value="support">Technical support</option>
                  <option value="privacy">My personal data or a grievance</option>
                  <option value="feature">Feature request</option>
                  <option value="bug">Report a bug</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="contact-form-group">
                <label>Message</label>
                <textarea name="message" rows={5} required placeholder="Tell us how we can help…" value={form.message} onChange={handleChange}/>
              </div>
              <p className="contact-privacy">We use these details only to reply to you. See the <Link to="/privacy-policy">Privacy Policy</Link>.</p>
              <button type="submit" className={`contact-submit${status==="submitting"?" loading":""}`} disabled={status!=="idle"}>
                {status==="submitting"?<><span className="btn-spinner"/> Sending…</>:<>Send message {Icons.arrowRight}</>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
