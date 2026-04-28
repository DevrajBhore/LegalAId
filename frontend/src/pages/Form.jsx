import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  chatWithIntakeAssistant,
  getDocumentConfig,
  generateDocument,
} from "../services/api";
import { Icons } from "../utils/icons";
import "./Form.css";

const STEP_LABELS = ["Fill Details", "Review Inputs", "Generate Draft"];
const GEN_MESSAGES = [
  "Assembling legal knowledge...",
  "Translating your inputs into legal drafting language...",
  "Running legal validation...",
  "Preparing your workspace...",
];
const LEGAL_DISCLAIMER =
  "LegalAId generates contracts based on established Indian legal principles and standard drafting practices. The documents are designed to be enforceable and commercially usable. Like any legal document, final enforceability depends on execution and specific circumstances, so review is recommended for complex or high-value cases.";
const INTAKE_ASSISTANT_WELCOME =
  "Ask me what to write in any field, and I will suggest practical wording you can apply directly to the form.";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFieldPlaceholder(field) {
  if (field?.placeholder) return field.placeholder;
  if (field?.example) return `Example: ${field.example}`;
  return `Enter ${field?.label?.toLowerCase() || "details"}...`;
}

function formatReviewValue(field, rawValue) {
  const value = rawValue ?? "";
  if (!String(value).trim()) return null;

  if (field?.type === "date") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  if (field?.type === "textarea") {
    return String(value).trim();
  }

  return String(value).trim();
}

function buildFieldErrorMap(fields, { missingFields = [], apiError, validation } = {}) {
  const map = {};

  missingFields.forEach((field) => {
    map[field.name] = `${field.label} is required.`;
  });

  const messages = [
    apiError,
    ...(validation?.blockingIssues || []).map((issue) => issue?.message),
    ...(validation?.advisoryIssues || []).map((issue) => issue?.message),
  ]
    .filter(Boolean)
    .map((message) => String(message).trim());

  for (const message of messages) {
    const normalizedMessage = normalizeText(message);

    for (const field of fields) {
      const fieldNamePattern = new RegExp(
        `\\b${escapeRegex(field.name.toLowerCase())}\\b`,
        "i"
      );
      const labelPattern = new RegExp(
        `\\b${escapeRegex(field.label.toLowerCase())}\\b`,
        "i"
      );

      if (
        fieldNamePattern.test(message.toLowerCase()) ||
        labelPattern.test(message.toLowerCase())
      ) {
        map[field.name] = message;
        break;
      }

      const normalizedLabel = normalizeText(field.label);
      if (normalizedLabel && normalizedMessage.includes(normalizedLabel)) {
        map[field.name] = message;
        break;
      }
    }
  }

  return map;
}

function findFirstErroredField(fields, fieldErrors) {
  return fields.find((field) => fieldErrors[field.name]);
}

function FormField({ field, value, onChange, hasError }) {
  const id = `field-${field.name}`;
  const props = {
    id,
    name: field.name,
    value: value ?? "",
    onChange,
    className: `field-input${hasError ? " field-input--error" : ""}`,
  };

  if (field.type === "textarea") {
    return (
      <textarea
        {...props}
        className={`field-input field-textarea${hasError ? " field-input--error" : ""}`}
        placeholder={buildFieldPlaceholder(field)}
        rows={4}
      />
    );
  }

  if (field.type === "date") {
    return <input {...props} type="date" />;
  }

  if (field.type === "number") {
    return (
      <input
        {...props}
        type="number"
        placeholder={buildFieldPlaceholder(field)}
      />
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <select
        {...props}
        className={`field-input field-select${!value ? " field-select--empty" : ""}${
          hasError ? " field-input--error" : ""
        }`}
      >
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
      placeholder={buildFieldPlaceholder(field)}
      autoComplete="off"
    />
  );
}

function buildFieldAssistantPrompt(field, userPrompt) {
  const parts = [
    `Help me fill this contract form field.`,
    `Field label: ${field.label}`,
    `Field name: ${field.name}`,
  ];

  if (field.description) parts.push(`Field description: ${field.description}`);
  if (field.example) parts.push(`Field example: ${field.example}`);
  if (field.aiGuidance) parts.push(`Field AI guidance: ${field.aiGuidance}`);
  parts.push(`User request: ${userPrompt}`);

  return parts.join("\n");
}

function FieldGroup({
  field,
  value,
  onChange,
  error,
  onAskAssistant,
  onApplyAssistantSuggestion,
}) {
  if (!field?.name) return null;
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantReply, setAssistantReply] = useState("");
  const [assistantSuggestions, setAssistantSuggestions] = useState([]);

  const handleAskAssistant = async () => {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistantLoading) return;

    setAssistantLoading(true);
    try {
      const response = await onAskAssistant(field, prompt);
      setAssistantReply(response.reply || "I can help you phrase this field.");
      setAssistantSuggestions(response.suggested_updates || []);
      setAssistantOpen(true);
      setAssistantPrompt("");
    } catch {
      setAssistantReply(
        "The field assistant could not respond right now. Please try again."
      );
      setAssistantSuggestions([]);
      setAssistantOpen(true);
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div
      className={`field-group${field.type === "textarea" ? " field-group--full" : ""}${
        error ? " field-group--error" : ""
      }`}
    >
      <label className="field-label" htmlFor={`field-${field.name}`}>
        {field.label}
        {field.required && <span className="req-star">*</span>}
      </label>
      <FormField
        field={field}
        value={value}
        onChange={onChange}
        hasError={Boolean(error)}
      />
      {error && (
        <div className="field-inline-error">
          {Icons.warning} {error}
        </div>
      )}
      <div className="field-assistant">
        <button
          type="button"
          className="field-assistant__toggle"
          onClick={() => setAssistantOpen((prev) => !prev)}
        >
          {Icons.sparkles} {assistantOpen ? "Hide AI help" : `Ask AI about ${field.label}`}
        </button>

        {assistantOpen && (
          <div className="field-assistant__panel">
            <textarea
              className="field-assistant__input"
              rows={2}
              value={assistantPrompt}
              onChange={(e) => setAssistantPrompt(e.target.value)}
              placeholder={
                field.example
                  ? `Example request: help me write something like "${field.example}"`
                  : `Ask AI what to write in ${field.label.toLowerCase()}`
              }
            />
            <div className="field-assistant__actions">
              <button
                type="button"
                className="field-assistant__send"
                onClick={handleAskAssistant}
                disabled={assistantLoading || !assistantPrompt.trim()}
              >
                {assistantLoading ? "Thinking..." : "Ask AI"}
              </button>
            </div>

            {assistantReply && (
              <div className="field-assistant__reply">{assistantReply}</div>
            )}

            {assistantSuggestions.length > 0 && (
              <div className="field-assistant__suggestions">
                {assistantSuggestions.map((suggestion) => {
                  const isCurrentField = suggestion.field === field.name;
                  return (
                    <div
                      key={`${suggestion.field}-${suggestion.value}`}
                      className="field-assistant__suggestion"
                    >
                      <div className="field-assistant__suggestion-title">
                        {isCurrentField ? field.label : suggestion.field}
                      </div>
                      <div className="field-assistant__suggestion-text">
                        {suggestion.value}
                      </div>
                      <div className="field-assistant__suggestion-reason">
                        {suggestion.reason}
                      </div>
                      <button
                        type="button"
                        className="field-assistant__apply"
                        onClick={() =>
                          onApplyAssistantSuggestion(
                            suggestion.field,
                            suggestion.value
                          )
                        }
                      >
                        Apply
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {(field.description || field.example || field.aiGuidance) && (
        <div className="field-help">
          {field.description && (
            <div className="field-help__desc">{field.description}</div>
          )}
          {field.example && (
            <div className="field-help__example">Example: {field.example}</div>
          )}
          {field.aiGuidance && (
            <div className="field-help__ai">AI tip: {field.aiGuidance}</div>
          )}
        </div>
      )}
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
  const [fieldErrors, setFieldErrors] = useState({});

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

    const id = setInterval(
      () => setGenStep((count) => (count + 1) % GEN_MESSAGES.length),
      2400
    );
    return () => clearInterval(id);
  }, [generating]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (generationValidation) setGenerationValidation(null);
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleGenerate = async () => {
    const missingFields = fields.filter(
      (field) => field.required && !form[field.name]?.toString().trim()
    );

    if (missingFields.length > 0) {
      const nextFieldErrors = buildFieldErrorMap(fields, { missingFields });
      setFieldErrors(nextFieldErrors);
      setGenerationValidation(null);
      setError("Please fix the highlighted fields and try again.");
      const firstMissingField = findFirstErroredField(fields, nextFieldErrors);
      document
        .getElementById(`field-${firstMissingField?.name}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      return;
    }

    setError(null);
    setFieldErrors({});
    setGenerationValidation(null);
    setGenerating(true);

    try {
      const res = await generateDocument({
        document_type: documentType,
        jurisdiction: "India",
        variables: form,
        semantic_generation: true,
      });
      navigate("/editor", { state: res.data });
    } catch (err) {
      const apiError = err.response?.data;
      const nextFieldErrors = buildFieldErrorMap(fields, {
        apiError: apiError?.error,
        validation: apiError?.validation,
      });
      setFieldErrors(nextFieldErrors);
      setError(apiError?.error || "Generation failed. Please try again.");
      setGenerationValidation(apiError?.validation || null);

      const firstErroredField = findFirstErroredField(fields, nextFieldErrors);
      if (firstErroredField) {
        document
          .getElementById(`field-${firstErroredField.name}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }
    } finally {
      setGenerating(false);
    }
  };

  const applyAssistantSuggestion = useCallback(
    (fieldName, value) => {
      setForm((prev) => ({ ...prev, [fieldName]: value }));
      if (error) setError(null);
      if (generationValidation) setGenerationValidation(null);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
      document.getElementById(`field-${fieldName}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    },
    [error, generationValidation]
  );

  const askAssistantForField = useCallback(
    async (field, prompt) => {
      const res = await chatWithIntakeAssistant({
        document_type: documentType,
        variables: form,
        message: buildFieldAssistantPrompt(field, prompt),
      });

      return {
        reply: res.data?.reply || "I can help you phrase this field.",
        suggested_updates: Array.isArray(res.data?.suggested_updates)
          ? res.data.suggested_updates
          : [],
      };
    },
    [documentType, form]
  );

  const displayName =
    documentMeta?.displayName ||
    documentType
      ?.replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const required = fields.filter((field) => field.required);
  const filled = required.filter((field) =>
    form[field.name]?.toString().trim()
  );
  const progress = required.length
    ? Math.round((filled.length / required.length) * 100)
    : 100;
  const currentStep = progress < 100 ? 0 : generating ? 2 : 1;
  const family = documentMeta?.family || "Legal";

  const visibleSections = useMemo(
    () =>
      sections.length > 0
        ? sections
        : [{ title: "Document details", fields }],
    [fields, sections]
  );
  const resolveField = useCallback(
    (item) =>
      typeof item === "string"
        ? fields.find((field) => field.name === item)
        : item,
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
      {
        key: "blocking",
        label: "Blocking issues",
        items: generationValidation.blockingIssues || [],
      },
      {
        key: "advisory",
        label: "Advisory issues",
        items: generationValidation.advisoryIssues || [],
      },
      {
        key: "notices",
        label: "Legal notices",
        items: generationValidation.notices || [],
      },
    ].filter((group) => group.items.length > 0);
  }, [generationValidation]);

  const reviewSections = useMemo(
    () =>
      visibleSections
        .map((section) => {
          const entries = (section.fields || [])
            .map((item) => resolveField(item))
            .filter(Boolean)
            .map((field) => ({
              name: field.name,
              label: field.label,
              value: formatReviewValue(field, form[field.name]),
            }))
            .filter((entry) => entry.value);

          return {
            title: section.title,
            entries,
          };
        })
        .filter((section) => section.entries.length > 0),
    [form, resolveField, visibleSections]
  );

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
          <div
            className="form-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {generating && (
        <div className="generating-overlay">
          <div className="gen-ring" />
          <div className="gen-title">Generating your document</div>
          <div className="gen-message">{GEN_MESSAGES[genStep]}</div>
          <div
            className="gen-dots"
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: 20,
              letterSpacing: 4,
            }}
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
                <div
                  className="form-sidebar-pfill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{progress}%</span>
            </div>
          </div>

          <div className="form-steps">
            {STEP_LABELS.map((label, index) => (
              <div
                key={label}
                className={`form-step${
                  index < currentStep
                    ? " done"
                    : index === currentStep
                    ? " active"
                    : ""
                }`}
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
            Keep party names, addresses, dates, commercial terms, and the
            business objective ready. Use the examples and AI tips under the
            fields when you want a stronger first draft.
          </div>

          <div className="form-sidebar-disclaimer">
            <strong>Legal disclaimer</strong>
            <span>{LEGAL_DISCLAIMER}</span>
          </div>
        </aside>

        <main className="form-main">
          <div className="form-header animate-in">
            <span className="form-header-kicker">{family} - Indian Law</span>
            <h1 className="form-header-title">{displayName}</h1>
            <p className="form-header-sub">
              Fill the intake form to generate a polished, editable first draft
              with AI-guided drafting cues.
            </p>
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

          {error && (
            <div className="form-error">
              {Icons.warning} {error}
            </div>
          )}

          {validationGroups.length > 0 && (
            <div className="form-validation-review">
              <div className="form-validation-review__title">
                Generation review
              </div>
              <div className="form-validation-review__subtitle">
                The first draft was blocked because final validation still found
                issues. Fix the highlighted inputs below and try again.
              </div>
              <div className="form-validation-groups">
                {validationGroups.map((group) => (
                  <div
                    key={group.key}
                    className={`form-validation-group form-validation-group--${group.key}`}
                  >
                    <div className="form-validation-group__label">
                      {group.label} <span>({group.items.length})</span>
                    </div>
                    <div className="form-validation-group__list">
                      {group.items.slice(0, 6).map((issue) => (
                        <div
                          key={issue.rule_id || issue.message}
                          className="form-validation-issue"
                        >
                          <div className="form-validation-issue__message">
                            {issue.message}
                          </div>
                          {issue.suggestion && (
                            <div className="form-validation-issue__suggestion">
                              {issue.suggestion}
                            </div>
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
                    <span className="form-section-num">
                      {String(sectionIndex + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <div className="form-section-title">{section.title}</div>
                      <div className="form-section-sub">
                        Provide the details for this section. Examples and AI
                        tips are shown where useful.
                      </div>
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
                          error={fieldErrors[field.name]}
                          onAskAssistant={askAssistantForField}
                          onApplyAssistantSuggestion={applyAssistantSuggestion}
                        />
                      ) : null;
                    })}
                  </div>
                </section>
              ))}

              <section className="form-review-panel animate-in">
                <div className="form-section-header">
                  <span className="form-section-num">RV</span>
                  <div>
                    <div className="form-section-title">Review your inputs</div>
                    <div className="form-section-sub">
                      Confirm the selected values before generating the draft.
                    </div>
                  </div>
                </div>

                {reviewSections.length > 0 ? (
                  <div className="form-review-groups">
                    {reviewSections.map((section) => (
                      <div key={section.title} className="form-review-group">
                        <div className="form-review-group__title">
                          {section.title}
                        </div>
                        <div className="form-review-items">
                          {section.entries.map((entry) => (
                            <div
                              key={entry.name}
                              className="form-review-item"
                            >
                              <div className="form-review-item__label">
                                {entry.label}
                              </div>
                              <div className="form-review-item__value">
                                {entry.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="form-review-empty">
                    Your filled values will appear here as you complete the
                    form.
                  </div>
                )}
              </section>

              <div className="form-disclaimer-panel">
                <div className="form-disclaimer-panel__label">
                  Legal disclaimer
                </div>
                <p>{LEGAL_DISCLAIMER}</p>
              </div>

              <div className="form-footer">
                <button
                  className={`generate-btn${generating ? " generating" : ""}`}
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  <span className="gen-label">
                    Generate document {Icons.arrowRight}
                  </span>
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
