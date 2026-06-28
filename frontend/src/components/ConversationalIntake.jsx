import { useEffect, useRef, useState } from "react";
import { runConversationalStep } from "../services/api";
import { Sparkles } from "../utils/icons";
import "./ConversationalIntake.css";

/**
 * Conversational intake: the assistant asks one natural question at a time and
 * fills the form fields from each answer. It reuses the schema-safe backend
 * extraction (no invented fields) and walks the document's essential fields, so
 * it is bounded — it asks at most as many questions as there are essentials,
 * then hands off to the form (already pre-filled).
 *
 * Props:
 *   documentType   string
 *   onApply        (fieldName, value) => void   — applies one field to the form
 *   appliedValues  object                       — current form values (seed)
 *   onContinue     () => void                    — go to the (pre-filled) form
 *   onSkip         () => void                    — skip straight to the form
 */
export default function ConversationalIntake({
  documentType,
  onApply,
  appliedValues = {},
  onContinue,
  onSkip,
}) {
  const [messages, setMessages] = useState([]); // { role: "bot" | "user", text }
  const [filled, setFilled] = useState(() => ({ ...appliedValues }));
  const [targetField, setTargetField] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const scrollRef = useRef(null);

  const applyUpdates = (updates = []) => {
    let added = 0;
    setFilled((prev) => {
      const next = { ...prev };
      for (const update of updates) {
        next[update.field] = update.value;
        onApply(update.field, update.value);
        added += 1;
      }
      return next;
    });
    if (added) setAppliedCount((count) => count + added);
  };

  const handleStepResult = (data) => {
    if (data?.available === false) {
      setError(
        "The chat assistant needs the AI service, which is unavailable right now. You can use “Describe in one go” or fill the form directly."
      );
      return;
    }
    applyUpdates(data?.field_updates || []);
    setTargetField(data?.next_field || null);
    if (data?.ready || !data?.next_question) {
      setReady(true);
      setMessages((prev) => [
        ...prev,
        { role: "bot", text: "Great — I have everything I need for a first draft. Continue to review and generate." },
      ]);
    } else {
      setMessages((prev) => [...prev, { role: "bot", text: data.next_question }]);
    }
  };

  // Fetch the very first question on mount.
  useEffect(() => {
    if (startedRef.current || !documentType) return;
    startedRef.current = true;
    setLoading(true);
    runConversationalStep({ document_type: documentType, filled: appliedValues })
      .then((res) => handleStepResult(res.data))
      .catch(() =>
        setError("Could not start the chat. You can use the form or “Describe in one go” instead.")
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentType]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading || ready) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setError("");
    setLoading(true);
    try {
      const res = await runConversationalStep({
        document_type: documentType,
        message: text,
        filled,
        target_field: targetField,
      });
      handleStepResult(res.data);
    } catch {
      setError("Couldn't process that answer. Try rephrasing, or switch to the form.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section className="conv-intake">
      <div className="conv-intake__head">
        <div className="conv-intake__badge">
          <Sparkles size={11} />
          <span>Chat intake</span>
        </div>
        <h2 className="conv-intake__title">Let's set this up together</h2>
        <p className="conv-intake__sub">
          Answer a few quick questions and I'll fill the form for you. You can switch
          to the form anytime to review what's been captured.
        </p>
      </div>

      <div className="conv-intake__thread" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`conv-msg conv-msg--${m.role}`}>
            <div className="conv-msg__bubble">{m.text}</div>
          </div>
        ))}
        {loading && (
          <div className="conv-msg conv-msg--bot">
            <div className="conv-msg__bubble conv-msg__bubble--typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
      </div>

      {error && <p className="conv-intake__error">{error}</p>}

      {!ready ? (
        <div className="conv-intake__inputrow">
          <textarea
            className="conv-intake__input"
            rows={1}
            placeholder="Type your answer…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            className="conv-intake__send"
            onClick={send}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
      ) : (
        <button type="button" className="conv-intake__continue" onClick={onContinue}>
          {appliedCount > 0
            ? `Continue to review (${appliedCount} field${appliedCount === 1 ? "" : "s"} filled)`
            : "Continue to review"}
        </button>
      )}

      <div className="conv-intake__footer">
        <button type="button" className="conv-intake__skip" onClick={onSkip}>
          Skip to the form
        </button>
        {appliedCount > 0 && !ready && (
          <button type="button" className="conv-intake__tocontinue" onClick={onContinue}>
            Continue to form now ({appliedCount} filled)
          </button>
        )}
      </div>
    </section>
  );
}
