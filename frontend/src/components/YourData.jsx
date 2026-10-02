import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { updateMyDetails, downloadMyData, deleteMyAccount } from "../services/api";
import "./YourData.css";

// Correct your details, download everything we hold, or delete the account.
// These are the access, correction and erasure rights the Privacy Policy
// promises; each is a real server call, not a support ticket.
export default function YourData() {
  const navigate = useNavigate();
  const { user, updateUser, endSession } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saveState, setSaveState] = useState({ busy: false, message: null, error: null });
  const [exportState, setExportState] = useState({ busy: false, error: null });
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteState, setDeleteState] = useState({ busy: false, error: null });

  const dirty = name.trim() !== (user?.name || "") || phone.trim() !== (user?.phone || "");

  const save = async (event) => {
    event.preventDefault();
    if (phone && !/^[6-9]\d{9}$/.test(phone.trim())) {
      setSaveState({ busy: false, message: null, error: "Enter a valid 10-digit Indian mobile number, or leave it empty." });
      return;
    }
    setSaveState({ busy: true, message: null, error: null });
    try {
      const res = await updateMyDetails({ name: name.trim(), phone: phone.trim() });
      updateUser(res.data.user);
      setSaveState({ busy: false, message: "Saved.", error: null });
    } catch (err) {
      setSaveState({ busy: false, message: null, error: err.response?.data?.error || "Could not save your details." });
    }
  };

  const exportData = async () => {
    setExportState({ busy: true, error: null });
    try {
      await downloadMyData();
      setExportState({ busy: false, error: null });
    } catch {
      setExportState({ busy: false, error: "Could not prepare your data. Please try again." });
    }
  };

  const remove = async (event) => {
    event.preventDefault();
    setDeleteState({ busy: true, error: null });
    try {
      await deleteMyAccount(password);
      endSession();
      navigate("/", { replace: true, state: { accountDeleted: true } });
    } catch (err) {
      setDeleteState({ busy: false, error: err.response?.data?.error || "Could not delete your account." });
    }
  };

  return (
    <div className="profile-card your-data">
      <h3 className="profile-card-title">Your data</h3>

      <form className="your-data-form" onSubmit={save}>
        <label htmlFor="your-data-name">Full name</label>
        <input id="your-data-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="your-data-phone">Mobile number (optional)</label>
        <input id="your-data-phone" value={phone} inputMode="numeric" maxLength={10} placeholder="9876543210" onChange={(e) => setPhone(e.target.value)} />
        <p className="your-data-hint">To change your sign-in email, use the Contact page.</p>
        <div className="your-data-row">
          <button type="submit" className="profile-action-btn profile-action-btn--primary" disabled={!dirty || saveState.busy}>
            {saveState.busy ? "Saving…" : "Save details"}
          </button>
          {saveState.message && <span className="your-data-ok" role="status">{saveState.message}</span>}
        </div>
        {saveState.error && <p className="your-data-error" role="alert">{saveState.error}</p>}
      </form>

      <div className="your-data-block">
        <p>Download your account details, every saved draft and every stored version as one JSON file.</p>
        <button type="button" className="profile-action-btn" onClick={exportData} disabled={exportState.busy}>
          {exportState.busy ? "Preparing…" : "Download my data"}
        </button>
        {exportState.error && <p className="your-data-error" role="alert">{exportState.error}</p>}
      </div>

      <div className="your-data-block your-data-danger">
        <p>Delete your account and all saved documents and versions. This cannot be undone.</p>
        {!confirming ? (
          <button type="button" className="profile-action-btn profile-action-btn--danger" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
        ) : (
          <form className="your-data-form" onSubmit={remove}>
            <label htmlFor="your-data-password">Enter your password to confirm</label>
            <input id="your-data-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <div className="your-data-row">
              <button type="submit" className="profile-action-btn profile-action-btn--danger" disabled={!password || deleteState.busy}>
                {deleteState.busy ? "Deleting…" : "Delete permanently"}
              </button>
              <button type="button" className="profile-action-btn" onClick={() => { setConfirming(false); setPassword(""); setDeleteState({ busy: false, error: null }); }}>
                Cancel
              </button>
            </div>
            {deleteState.error && <p className="your-data-error" role="alert">{deleteState.error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
