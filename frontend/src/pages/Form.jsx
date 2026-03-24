import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDocumentConfig, generateDocument } from "../services/api";
import "./Form.css";

export default function Form() {
  const location = useLocation();
  const navigate = useNavigate();
  const documentType = location.state?.document_type;

  const [fields, setFields] = useState([]);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Load form fields from backend
  useEffect(() => {
    if (!documentType) {
      navigate("/");
      return;
    }
    setLoading(true);
    getDocumentConfig(documentType)
      .then((res) => {
        setFields(res.data.fields || []);
        // Pre-fill arbitration_city with Mumbai as sensible default
        const defaults = {};
        (res.data.fields || []).forEach((f) => {
          if (f.name === "arbitration_city") defaults[f.name] = "Mumbai";
        });
        setForm(defaults);
      })
      .catch(() => setError("Failed to load form configuration."))
      .finally(() => setLoading(false));
  }, [documentType]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    // Validate required fields
    const missing = fields
      .filter((f) => f.required && !form[f.name]?.trim())
      .map((f) => f.label);

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const res = await generateDocument({
        document_type: documentType,
        jurisdiction: "India",
        variables: form,
      });
      navigate("/editor", { state: res.data });
    } catch (err) {
      setError(
        err.response?.data?.details ||
          err.response?.data?.error ||
          "Generation failed. Check that the backend is running."
      );
    } finally {
      setGenerating(false);
    }
  };

  const displayName = documentType
    ?.replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="form-page">
      <div className="form-container">
        <div className="form-header">
          <button className="back-btn" onClick={() => navigate("/")}>
            ← Back
          </button>
          <div>
            <h2 className="form-title">{displayName}</h2>
            <p className="form-subtitle">
              Fill in the details to generate your document
            </p>
          </div>
        </div>

        {loading && (
          <div className="form-loading">
            <div className="spinner"></div>
            <p>Loading form…</p>
          </div>
        )}

        {error && (
          <div className="form-error">
            <span>⚠</span> {error}
          </div>
        )}

        {!loading && (
          <>
            <div className="fields-grid">
              {fields.map((field) => (
                <div key={field.name} className="field-group">
                  <label className="field-label">
                    {field.label}
                    {field.required && (
                      <span className="required-star"> *</span>
                    )}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      className="field-input field-textarea"
                      name={field.name}
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                      value={form[field.name] || ""}
                      onChange={handleChange}
                      rows={3}
                    />
                  ) : field.type === "date" ? (
                    <input
                      className="field-input"
                      type="date"
                      name={field.name}
                      value={form[field.name] || ""}
                      onChange={handleChange}
                    />
                  ) : field.type === "select" ? (
                    <select
                      className="field-input field-select"
                      name={field.name}
                      value={form[field.name] || ""}
                      onChange={handleChange}
                    >
                      <option value="">— Select —</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "number" ? (
                    <input
                      className="field-input"
                      type="number"
                      name={field.name}
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                      value={form[field.name] || ""}
                      onChange={handleChange}
                      min={0}
                    />
                  ) : (
                    <input
                      className="field-input"
                      type="text"
                      name={field.name}
                      placeholder={`Enter ${field.label.toLowerCase()}…`}
                      value={form[field.name] || ""}
                      onChange={handleChange}
                    />
                  )}
                </div>
              ))}
            </div>

            <button
              className={`generate-btn${generating ? " generating" : ""}`}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? "Generating document…" : "Generate Document →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
