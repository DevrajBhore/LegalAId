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

function humanizeFieldName(name = "") {
  return String(name || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function buildFieldDefinitionText(field = {}) {
  if (field.description) return field.description;

  const label = field.label || humanizeFieldName(field.name) || "This input";
  const lowerName = String(field.name || "").toLowerCase();
  const lowerLabel = String(label || "").toLowerCase();

  if (lowerName.includes("effective_date")) {
    return "The date from which the agreement should start applying to the parties.";
  }
  if (lowerName.includes("operating_state")) {
    return "The Indian state or union territory most closely connected to the transaction or performance of the agreement.";
  }
  if (lowerName.includes("governing_law")) {
    return "The Indian state whose law and local legal context should guide interpretation of the agreement.";
  }
  if (lowerName.includes("arbitration") || lowerLabel.includes("arbitration")) {
    return "The city or process used for resolving disputes outside regular court proceedings.";
  }
  if (lowerName.includes("party") && lowerName.includes("name")) {
    return "The full legal name of the person, company, firm, LLP, trust, or other entity signing this document.";
  }
  if (lowerName.includes("address")) {
    return "The complete address used to identify the party and send formal notices under the agreement.";
  }
  if (lowerName.includes("amount") || lowerName.includes("fee") || lowerName.includes("rent") || lowerName.includes("salary")) {
    return "The commercial value to be inserted into the document, entered as a clear number or amount.";
  }
  if (lowerName.includes("notice") || lowerName.includes("period") || lowerName.includes("days")) {
    return "The time period the parties must follow before a right, obligation, renewal, or termination takes effect.";
  }
  if (lowerName.includes("scope") || lowerName.includes("services") || lowerName.includes("deliverables")) {
    return "A practical description of the work, goods, services, or obligations covered by this agreement.";
  }
  if (field.type === "select" && field.options?.length) {
    return `Choose the option that best matches the transaction. Available choices: ${field.options.join(", ")}.`;
  }
  if (field.type === "date") {
    return `The date LegalAId should place in the document for ${label.toLowerCase()}.`;
  }
  if (field.type === "number") {
    return `A numeric value needed for ${label.toLowerCase()}.`;
  }
  if (field.type === "textarea") {
    return `A short, specific explanation of ${label.toLowerCase()} so the draft can use accurate clause language.`;
  }

  return `The value LegalAId needs for ${label.toLowerCase()} while preparing this document.`;
}

function buildFormIssue({
  title,
  message,
  cause,
  solution,
  technicalDetail,
} = {}) {
  return {
    title: title || "We found an issue before generating",
    message:
      message ||
      "LegalAId could not generate the document from the current form state.",
    cause:
      cause ||
      "The form, backend, or AI drafting service did not return a complete draft.",
    solution:
      solution ||
      "Review the highlighted items, correct the inputs, and generate the document again.",
    technicalDetail: technicalDetail || "",
  };
}

function summarizeValidation(validation) {
  const issues = [
    ...(validation?.blockingIssues || []),
    ...(validation?.advisoryIssues || []),
  ].filter(Boolean);
  const firstIssue = issues[0];

  if (!firstIssue) return "";

  return firstIssue.suggestion
    ? `${firstIssue.message} Suggested fix: ${firstIssue.suggestion}`
    : firstIssue.message;
}

function buildGenerationIssue(err, { fieldErrorCount = 0 } = {}) {
  const apiError = err?.response?.data || {};
  const status = err?.response?.status;
  const backendIssue = apiError.issue;
  const backendMessage = apiError.error || apiError.message;
  const details = apiError.details || apiError.detail || "";
  const validationSummary = summarizeValidation(apiError.validation);
  const rawText = `${backendMessage || ""} ${details || ""}`.toLowerCase();

  if (backendIssue?.category && !apiError.validation) {
    return buildFormIssue({
      title:
        backendIssue.category === "AI_RATE_LIMITED"
          ? "AI service is temporarily busy"
          : backendIssue.category === "AI_PROVIDER_UNAVAILABLE"
          ? "AI drafting service could not complete"
          : backendIssue.category === "INPUT_ERROR"
          ? "Some inputs need correction"
          : "Document could not be generated",
      message:
        backendMessage ||
        "The backend could not generate a complete draft from this request.",
      cause: backendIssue.cause,
      solution: backendIssue.solution,
      technicalDetail: details,
    });
  }

  if (!err?.response) {
    return buildFormIssue({
      title: "Backend is not reachable",
      message:
        "The form was submitted, but the app could not reach the document-generation server.",
      cause:
        "This usually happens when the backend is stopped, restarting, blocked by the network, or the API URL is incorrect.",
      solution:
        "Start or restart the backend server, confirm it is available, then click Generate document again. Your form values are still on this page.",
      technicalDetail: err?.message,
    });
  }

  if (status === 401 || status === 403) {
    return buildFormIssue({
      title: "Sign-in is required",
      message:
        "LegalAId could not generate the document because your session is missing, expired, or not verified.",
      cause:
        status === 403
          ? "The backend rejected the request because the account must be verified before drafting."
          : "The backend rejected the request because it could not confirm your login session.",
      solution:
        "Sign in again, verify your email if prompted, return to the form, and generate the document again.",
      technicalDetail: backendMessage,
    });
  }

  if (status === 413) {
    return buildFormIssue({
      title: "Form data is too large",
      message:
        "The backend refused the request because one or more inputs made the payload too large.",
      cause:
        "Very long pasted text can exceed the server request limit before generation starts.",
      solution:
        "Shorten large textarea responses, remove pasted documents from form fields, and try again.",
      technicalDetail: backendMessage || details,
    });
  }

  if (status === 429 || rawText.includes("rate_limited") || rawText.includes("rate limited")) {
    return buildFormIssue({
      title: "AI service is temporarily busy",
      message:
        "LegalAId reached the AI drafting service, but the provider is rate limiting requests right now.",
      cause:
        "AI providers sometimes throttle traffic when too many requests arrive in a short time.",
      solution:
        "Wait a minute, keep the form open, and generate again. If the issue repeats, try a shorter set of inputs.",
      technicalDetail: backendMessage || details,
    });
  }

  if (
    rawText.includes("ai_provider_error") ||
    rawText.includes("no_model_available") ||
    rawText.includes("timeout") ||
    rawText.includes("ai")
  ) {
    return buildFormIssue({
      title: "AI drafting service could not complete",
      message:
        "The backend could not get a usable drafting response from the AI service.",
      cause:
        rawText.includes("timeout")
          ? "The AI request took too long and timed out before a complete draft came back."
          : "The configured AI provider rejected, failed, or could not complete the drafting request.",
      solution:
        "Try again after a short wait. If it keeps happening, simplify very long inputs and check that the AI provider keys/models are configured on the backend.",
      technicalDetail: backendMessage || details,
    });
  }

  if (status === 400 || status === 422 || apiError.validation || fieldErrorCount > 0) {
    return buildFormIssue({
      title: "Some inputs need correction",
      message:
        fieldErrorCount > 0
          ? "Generation was blocked because LegalAId found form values that need attention."
          : backendMessage || "Generation was blocked by validation.",
      cause:
        validationSummary ||
        "The backend could not safely use one or more inputs to assemble a legally coherent first draft.",
      solution:
        "Use the field links below, read the highlighted explanation beside each input, correct the values, and generate again.",
      technicalDetail: details,
    });
  }

  if (status >= 500) {
    return buildFormIssue({
      title: "Backend generation failed",
      message:
        backendMessage ||
        "The backend started generation but failed before it could return a draft.",
      cause:
        details ||
        "A server-side generation, validation, database, export, or drafting dependency failed unexpectedly.",
      solution:
        "Try again once. If it repeats, check the backend logs for the technical detail shown here and fix the failing service or configuration.",
      technicalDetail: details,
    });
  }

  return buildFormIssue({
    title: "Document could not be generated",
    message:
      backendMessage ||
      "LegalAId could not generate this document from the current request.",
    cause:
      details ||
      validationSummary ||
      "The backend returned an error that did not include a more specific cause.",
    solution:
      "Review the highlighted fields if any are shown, then try again. If there are no highlighted fields, refresh the page and retry.",
    technicalDetail: details,
  });
}

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

function buildFieldFix(field) {
  if (!field) return "Review this input and correct the highlighted value.";

  if (field.type === "select" && field.options?.length) {
    return `Choose one of the available options: ${field.options.join(", ")}.`;
  }

  if (field.type === "date") {
    return "Select the correct date from the calendar so the document can place it accurately.";
  }

  if (field.type === "number") {
    return "Enter only the numeric amount or value, without extra words or symbols unless the field asks for them.";
  }

  if (field.type === "textarea") {
    return field.example
      ? `Write a clear paragraph. You can follow this example: ${field.example}`
      : "Write the relevant details in complete, specific sentences. If unsure, open the AI help under this field.";
  }

  return field.example
    ? `Enter a clear value. Example: ${field.example}`
    : "Enter the correct details for this field. If unsure, use the AI help directly below it.";
}

function findSectionTitleForField(sections = [], fieldName) {
  for (const section of sections || []) {
    const names = (section.fields || []).map((field) =>
      typeof field === "string" ? field : field?.name
    );
    if (names.includes(fieldName)) return section.title;
  }
  return "Form details";
}

function createFieldError(field, {
  title,
  why,
  fix,
  sourceMessage,
  sectionTitle,
  severity = "error",
} = {}) {
  return {
    title: title || `${field.label} needs attention`,
    where: `${sectionTitle || "Form details"} > ${field.label}`,
    why:
      why ||
      sourceMessage ||
      "LegalAId could not safely use this value while preparing the draft.",
    fix: fix || buildFieldFix(field),
    sourceMessage: sourceMessage || "",
    severity,
  };
}

function normalizeFieldError(error) {
  if (!error) return null;
  if (typeof error === "string") {
    return {
      title: "This field needs attention",
      where: "This field",
      why: error,
      fix: "Review the highlighted field and enter the missing or corrected information.",
      sourceMessage: error,
      severity: "error",
    };
  }
  return error;
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

function findFieldForIssue(fields, issueOrMessage) {
  const message =
    typeof issueOrMessage === "string"
      ? issueOrMessage
      : [
          issueOrMessage?.field,
          issueOrMessage?.fieldName,
          issueOrMessage?.path,
          issueOrMessage?.variable,
          issueOrMessage?.input_field,
          issueOrMessage?.offending_field,
          issueOrMessage?.message,
          issueOrMessage?.suggestion,
        ]
          .filter(Boolean)
          .join(" ");
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
      fieldNamePattern.test(String(message).toLowerCase()) ||
      labelPattern.test(String(message).toLowerCase())
    ) {
      return field;
    }

    const normalizedLabel = normalizeText(field.label);
    if (normalizedLabel && normalizedMessage.includes(normalizedLabel)) {
      return field;
    }
  }

  return null;
}

function buildFieldErrorMap(
  fields,
  { missingFields = [], apiError, validation, sections = [] } = {}
) {
  const map = {};

  missingFields.forEach((field) => {
    map[field.name] = createFieldError(field, {
      title: `${field.label} is required`,
      sectionTitle: findSectionTitleForField(sections, field.name),
      why: `This field is marked required because LegalAId needs it to generate a usable ${field.label.toLowerCase()} clause or document detail.`,
      fix: buildFieldFix(field),
      sourceMessage: `${field.label} is required.`,
    });
  });

  const issues = [
    ...(validation?.blockingIssues || []),
    ...(validation?.advisoryIssues || []),
  ].filter(Boolean);

  for (const issue of issues) {
    const field = findFieldForIssue(fields, issue);
    if (!field || map[field.name]) continue;

    map[field.name] = createFieldError(field, {
      title: `${field.label} needs attention`,
      sectionTitle: findSectionTitleForField(sections, field.name),
      why:
        issue.message ||
        "Final validation found a problem connected to this input.",
      fix: issue.suggestion || buildFieldFix(field),
      sourceMessage: issue.message || "",
      severity: issue.severity || "error",
    });
  }

  if (apiError) {
    const field = findFieldForIssue(fields, apiError);
    if (field && !map[field.name]) {
      map[field.name] = createFieldError(field, {
        title: `${field.label} could not be used`,
        sectionTitle: findSectionTitleForField(sections, field.name),
        why: apiError,
        fix: buildFieldFix(field),
        sourceMessage: apiError,
      });
    }
  }

  return map;
}

function findFirstErroredField(fields, fieldErrors) {
  return fields.find((field) => fieldErrors[field.name]);
}

function FormField({ field, value, onChange, hasError, errorId }) {
  const id = `field-${field.name}`;
  const props = {
    id,
    name: field.name,
    value: value ?? "",
    onChange,
    className: `field-input${hasError ? " field-input--error" : ""}`,
    "aria-invalid": hasError ? "true" : "false",
    "aria-describedby": hasError ? errorId : undefined,
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

function buildAssistantFailureReply(error) {
  const status = error?.response?.status;
  const data = error?.response?.data || {};
  const text = `${data.error || ""} ${data.details || ""}`.toLowerCase();

  if (!error?.response) {
    return "The field assistant could not reach the backend. Why: the server may be stopped or unreachable. Solution: keep your form open, restart/check the backend, then ask again.";
  }
  if (status === 401 || status === 403) {
    return "The field assistant could not answer because your session is not authorized. Why: your login may have expired or your email may need verification. Solution: sign in again, then return to this form.";
  }
  if (status === 429 || text.includes("rate")) {
    return "The field assistant is temporarily rate limited. Why: the AI provider is handling too many requests. Solution: wait a minute and ask again.";
  }
  if (text.includes("ai") || text.includes("timeout") || text.includes("model")) {
    return "The field assistant could not complete the AI request. Why: the AI provider failed, timed out, or is not configured. Solution: try again shortly, and check backend AI keys/models if it keeps happening.";
  }

  return `The field assistant could not respond. Why: ${
    data.error || "the backend returned an unexpected error"
  }. Solution: try again, or fill the field using the definition and example shown above.`;
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
  const resolvedError = normalizeFieldError(error);
  const errorId = `field-error-${field.name}`;
  const definitionText = buildFieldDefinitionText(field);
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
    } catch (err) {
      setAssistantReply(buildAssistantFailureReply(err));
      setAssistantSuggestions([]);
      setAssistantOpen(true);
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div
      className={`field-group${field.type === "textarea" ? " field-group--full" : ""}${
        resolvedError ? " field-group--error" : ""
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
        hasError={Boolean(resolvedError)}
        errorId={errorId}
      />
      {/* <div className="field-help">
        <div className="field-help__definition">
          <strong>Definition:</strong> {definitionText}
        </div>
        {field.example && (
          <div className="field-help__example">Example: {field.example}</div>
        )}
        {field.aiGuidance && (
          <div className="field-help__ai">AI tip: {field.aiGuidance}</div>
        )}
      </div> */}
      {resolvedError && (
        <div className="field-inline-error" id={errorId} role="alert">
          <div className="field-inline-error__icon">{Icons.warning}</div>
          <div className="field-inline-error__body">
            <div className="field-inline-error__title">
              {resolvedError.title}
            </div>
            <div className="field-inline-error__row">
              <strong>Where:</strong> {resolvedError.where}
            </div>
            <div className="field-inline-error__row">
              <strong>Why:</strong> {resolvedError.why}
            </div>
            <div className="field-inline-error__row">
              <strong>How to fix:</strong> {resolvedError.fix}
            </div>
          </div>
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
            <div className="field-assistant__context">
              <strong>{field.label}</strong>
              <span>{definitionText}</span>
            </div>    
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
      .catch((err) =>
        setError(
          buildFormIssue({
            title: "Form could not be loaded",
            message:
              "LegalAId could not load the intake fields for this document type.",
            cause:
              err?.response?.data?.error ||
              "The document configuration endpoint did not return the required form setup.",
            solution:
              "Refresh the page and choose the document again from the library. If it repeats, check that the backend is running and this document type is configured.",
            technicalDetail: err?.message,
          })
        )
      )
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
      const nextFieldErrors = buildFieldErrorMap(fields, {
        missingFields,
        sections: visibleSections,
      });
      setFieldErrors(nextFieldErrors);
      setGenerationValidation(null);
      setError(
        buildFormIssue({
          title: "Required details are missing",
          message: `${missingFields.length} required ${
            missingFields.length === 1 ? "field is" : "fields are"
          } missing.`,
          cause:
            "LegalAId needs every required field before it can assemble the legal clauses safely.",
          solution:
            "Use the links below to jump to each missing field, read its definition, fill the value, and generate again.",
        })
      );
      const firstMissingField = findFirstErroredField(fields, nextFieldErrors);
      if (firstMissingField) {
        document
          .getElementById(`field-${firstMissingField.name}`)
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }
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
        sections: visibleSections,
      });
      setFieldErrors(nextFieldErrors);
      setError(
        buildGenerationIssue(err, {
          fieldErrorCount: Object.keys(nextFieldErrors).length,
        })
      );
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
  const scrollToField = (fieldName) =>
    document.getElementById(`field-${fieldName}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

  const errorSummaryItems = useMemo(
    () =>
      fields
        .filter((field) => fieldErrors[field.name])
        .map((field) => ({
          field,
          error: normalizeFieldError(fieldErrors[field.name]),
        })),
    [fieldErrors, fields]
  );

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
              <div className="form-error__icon">{Icons.warning}</div>
              <div className="form-error__body">
                <div className="form-error__title">
                  {typeof error === "string"
                    ? "We found an issue before generating"
                    : error.title}
                </div>
                <div className="form-error__message">
                  {typeof error === "string" ? error : error.message}
                </div>
                {typeof error !== "string" && (
                  <div className="form-error__details">
                    <div>
                      <strong>Why it happened:</strong> {error.cause}
                    </div>
                    <div>
                      <strong>How to fix:</strong> {error.solution}
                    </div>
                    {error.technicalDetail && (
                      <div>
                        <strong>Technical detail:</strong>{" "}
                        {error.technicalDetail}
                      </div>
                    )}
                  </div>
                )}
                {errorSummaryItems.length > 0 && (
                  <div className="form-error__links">
                    {errorSummaryItems.map(({ field, error: itemError }) => (
                      <button
                        key={field.name}
                        type="button"
                        className="form-error__link"
                        onClick={() => scrollToField(field.name)}
                      >
                        Fix {field.label}
                        <span>{itemError?.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
