import { useState } from "react";
import { Icons } from "../utils/icons";
import "./Contact.css";

export default function Contact() {
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", subject:"", message:"" });
  const [status, setStatus] = useState("idle"); // idle|submitting|success

  const handleChange = e => setForm(p=>({...p,[e.target.name]:e.target.value}));
  const handleSubmit = e => {
    e.preventDefault();
    setStatus("submitting");
    setTimeout(()=>setStatus("success"), 1600);
  };

  return (
    <div className="contact-page">
      <div className="contact-hero animate-in">
        <span className="contact-eyebrow">CONTACT US</span>
        <h1 className="contact-title">Let's talk <em>legal tech</em></h1>
        <p className="contact-sub">Whether you need enterprise access, have a feature request, or just want to say hello — we read every message.</p>
      </div>

      <div className="contact-shell">
        <div className="contact-left animate-in-d1">
          <div className="contact-info-card">
            <div className="contact-info-icon">{Icons.mail}</div>
            <div>
              <div className="contact-info-label">General Support</div>
              <div className="contact-info-value">support@legalaid.in</div>
            </div>
          </div>
          <div className="contact-info-card">
            <div className="contact-info-icon">{Icons.briefcase}</div>
            <div>
              <div className="contact-info-label">Enterprise Sales</div>
              <div className="contact-info-value">enterprise@legalaid.in</div>
            </div>
          </div>
          <div className="contact-info-card">
            <div className="contact-info-icon">{Icons.shieldCheck}</div>
            <div>
              <div className="contact-info-label">Security & Privacy</div>
              <div className="contact-info-value">security@legalaid.in</div>
            </div>
          </div>
          <div className="contact-response-note">
            <span className="contact-response-dot"/>
            We typically respond within one business day.
          </div>
        </div>

        <div className="contact-right animate-in-d2">
          {status === "success" ? (
            <div className="contact-success">
              <div className="contact-success-icon">{Icons.checkCircle}</div>
              <h3>Message sent</h3>
              <p>We've received your message and will get back to you within one business day.</p>
              <button className="contact-success-reset" onClick={()=>{ setStatus("idle"); setForm({firstName:"",lastName:"",email:"",subject:"",message:""}); }}>Send another</button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit}>
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
                  <option value="enterprise">Enterprise enquiry</option>
                  <option value="feature">Feature request</option>
                  <option value="bug">Report a bug</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="contact-form-group">
                <label>Message</label>
                <textarea name="message" rows={5} required placeholder="Tell us how we can help…" value={form.message} onChange={handleChange}/>
              </div>
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
