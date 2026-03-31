import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDocumentConfig, generateDocument } from "../services/api";
import { Icons } from "../utils/icons";
import "./Form.css";

const STEP_LABELS = ["Fill details", "Review inputs", "Generate draft"];
const GEN_MESSAGES = [
  "Assembling legal knowledge...",
  "Drafting with AI...",
  "Running legal validation...",
  "Preparing your workspace...",
];

function FormField({ field, value, onChange }) {
  const id = `field-${field.name}`;
  const props = {
    id,
    name: field.name,
    value: value ?? "",
    onChange,
    className: "field-input",
  };

  if (field.type === "textarea") {
    return (
      <textarea
        {...props}
        className="field-input field-textarea"
        placeholder={`Enter ${field.label.toLowerCase()}...`}
        rows={4}
      />
    );
  }

  if (field.type === "date") {
    return <input {...props} type="date" />;
  }

  if (field.type === "number") {
    return <input {...props} type="number" placeholder={`Enter ${field.label.toLowerCase()}...`} />;
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <select {...props} className={`field-input field-select${!value ? " field-select--empty" : ""}`}>
        <option value="">Select {field.label}...</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      {...props}
      type="text"
      placeholder={`Enter ${field.label.toLowerCase()}...`}
      autoComplete="off"
    />
  );
}

function FieldGroup({ field, value, onChange }) {
  if (!field?.name) return null;

  return (
    <div className={`field-group${field.type === "textarea" ? " field-group--full" : ""}`}>
      <label className="field-label" htmlFor={`field-${field.name}`}>
        {field.label}
        {field.required && <span className="req-star">*</span>}
      </label>
      <FormField field={field} value={value} onChange={onChange} />
    </div>
  );
}

export default function Form() {
  const location = useLocation();
  const navigate = useNavigate();
  const documentType = location.state?.document_type;

  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [form, setForm] = useState({});
  const [documentMeta, setDocumentMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [error, setError] = useState(null);
  const [generationValidation, setGenerationValidation] = useState(null);

  useEffect(() => {
    if (!documentType) {
      navigate("/library");
      return;
    }

    getDocumentConfig(documentType)
      .then((res) => {
        const rawFields = res.data.fields || [];
        const rawSections = res.data.sections || [];
        setFields(rawFields);
        setSections(rawSections);
        setDocumentMeta({
          displayName: res.data.displayName,
          family: res.data.family,
          type: res.data.type,
        });

        const defaults = {};
        rawFields.forEach((field) => {
          if (field.name === "arbitration_city") defaults[field.name] = "Mumbai";
          if (field.name === "operating_state") defaults[field.name] = "";
        });
        setForm(defaults);
      })
      .catch(() => setError("Failed to load the document form. Please try again."))
      .finally(() => setLoading(false));
  }, [documentType, navigate]);

  useEffect(() => {
    if (!generating) {
      setGenStep(0);
      return;
    }

    const id = setInterval(() => setGenStep((count) => (count + 1) % GEN_MESSAGES.length), 2400);
    return () => clearInterval(id);
  }, [generating]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (generationValidation) setGenerationValidation(null);
  };

  const handleGenerate = async () => {
    const missing = fields
      .filter((field) => field.required && !form[field.name]?.toString().trim())
      .map((field) => field.label);

    if (missing.length > 0) {
      setGenerationValidation(null);
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setError(null);
    setGenerationValidation(null);
    setGenerating(true);

    try {
      const res = await generateDocument({
        document_type: documentType,
        jurisdiction: "India",
        variables: form,
      });
      navigate("/editor", { state: res.data });
    } catch (err) {
      const apiError = err.response?.data;
      setError(apiError?.error || "Generation failed. Please try again.");
      setGenerationValidation(apiError?.validation || null);
    } finally {
      setGenerating(false);
    }
  };

  const displayName =
    documentMeta?.displayName ||
    documentType?.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const required = fields.filter((field) => field.required);
  const filled = required.filter((field) => form[field.name]?.toString().trim());
  const progress = required.length ? Math.round((filled.length / required.length) * 100) : 100;
  const currentStep = progress < 100 ? 0 : generating ? 2 : 1;
  const family = documentMeta?.family || "Legal";

  const visibleSections = useMemo(
    () => (sections.length > 0 ? sections : [{ title: "Document details", fields }]),
    [fields, sections]
  );
  const resolveField = useCallback(
    (item) => (typeof item === "string" ? fields.find((field) => field.name === item) : item),
    [fields]
  );
  const scrollToSection = (index) =>
    document.getElementById(`form-section-${index}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  const validationGroups = useMemo(() => {
    if (!generationValidation) return [];
    return [
      { key: "blocking", label: "Blocking issues", items: generationValidation.blockingIssues || [] },
      { key: "advisory", label: "Advisory issues", items: generationValidation.advisoryIssues || [] },
      { key: "notices", label: "Legal notices", items: generationValidation.notices || [] },
    ].filter((group) => group.items.length > 0);
  }, [generationValidation]);

  return (
    <div className="form-page">
      <div className="form-topbar">
        <div className="form-topbar-inner">
          <button className="form-back" onClick={() => navigate("/library")}>
            {Icons.arrowLeft} Back to library
          </button>
          <div className="form-topbar-sep" />
          <span className="form-topbar-type">{displayName}</span>
          <span className="form-topbar-tag">AI DRAFT</span>
        </div>
        <div className="form-progress-bar">
          <div className="form-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {generating && (
        <div className="generating-overlay">
          <div className="gen-ring" />
          <div className="gen-title">Generating your document</div>
          <div className="gen-message">{GEN_MESSAGES[genStep]}</div>
          <div
            className="gen-dots"
            style={{ color: "rgba(255,255,255,0.25)", fontSize: 20, letterSpacing: 4 }}
          >
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </div>
        </div>
      )}

      <div className="form-layout">
        <aside className="form-sidebar">
          <div className="form-sidebar-doc">
            <span className="form-sidebar-family">{family}</span>
            <div className="form-sidebar-name">{displayName}</div>
            <div className="form-sidebar-progress">
              <div className="form-sidebar-pbar">
                <div className="form-sidebar-pfill" style={{ width: `${progress}%` }} />
              </div>
              <span>{progress}%</span>
            </div>
          </div>

          <div className="form-steps">
            {STEP_LABELS.map((label, index) => (
              <div
                key={label}
                className={`form-step${index < currentStep ? " done" : index === currentStep ? " active" : ""}`}
              >
                <div className="form-step-dot">
                  {index < currentStep ? Icons.check : <span>{index + 1}</span>}
                </div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="form-sidebar-tip">
            <strong>Before you generate</strong>
            Have party names, addresses, dates, and commercial amounts ready. You can refine the draft inside the editor.
          </div>
        </aside>

        <main className="form-main">
          <div className="form-header animate-in">
            <span className="form-header-kicker">{family} - Indian Law</span>
            <h1 className="form-header-title">{displayName}</h1>
            <p className="form-header-sub">Fill the intake form to generate your editable first draft.</p>
          </div>

          {visibleSections.length > 1 && (
            <div className="form-section-nav animate-in-d1">
              <span className="form-section-nav-label">Jump to:</span>
              {visibleSections.map((section, index) => (
                <button
                  key={`${section.title}-${index}`}
                  type="button"
                  className="form-section-chip"
                  onClick={() => scrollToSection(index)}
                >
                  {section.title}
                </button>
              ))}
            </div>
          )}

          {error && <div className="form-error">{Icons.warning} {error}</div>}

          {validationGroups.length > 0 && (
            <div className="form-validation-review">
              <div className="form-validation-review__title">Generation review</div>
              <div className="form-validation-review__subtitle">
                The first draft was blocked because final validation still found issues. Fix the inputs below and try again.
              </div>
              <div className="form-validation-groups">
                {validationGroups.map((group) => (
                  <div key={group.key} className={`form-validation-group form-validation-group--${group.key}`}>
                    <div className="form-validation-group__label">
                      {group.label} <span>({group.items.length})</span>
                    </div>
                    <div className="form-validation-group__list">
                      {group.items.slice(0, 6).map((issue) => (
                        <div key={issue.rule_id || issue.message} className="form-validation-issue">
                          <div className="form-validation-issue__message">{issue.message}</div>
                          {issue.suggestion && (
                            <div className="form-validation-issue__suggestion">{issue.suggestion}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="form-loading">
              <div className="spinner" />
              <span>Loading form...</span>
            </div>
          ) : (
            <>
              {visibleSections.map((section, sectionIndex) => (
                <section
                  key={`${section.title}-${sectionIndex}`}
                  className="form-section animate-in"
                  id={`form-section-${sectionIndex}`}
                  style={{ animationDelay: `${sectionIndex * 60}ms` }}
                >
                  <div className="form-section-header">
                    <span className="form-section-num">{String(sectionIndex + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="form-section-title">{section.title}</div>
                      <div className="form-section-sub">Fill in the details for this section</div>
                    </div>
                  </div>
                  <div className="fields-grid">
                    {(section.fields || []).map((item) => {
                      const field = resolveField(item);
                      return field ? (
                        <FieldGroup
                          key={field.name}
                          field={field}
                          value={form[field.name] ?? ""}
                          onChange={handleChange}
                        />
                      ) : null;
                    })}
                  </div>
                </section>
              ))}

              <div className="form-footer">
                <button
                  className={`generate-btn${generating ? " generating" : ""}`}
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  <span className="gen-label">Generate document {Icons.arrowRight}</span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
