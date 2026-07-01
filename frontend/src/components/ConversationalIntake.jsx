import { useEffect, useRef, useState } from "react";
import { runConversationalStep } from "../services/api";
import { Sparkles } from "../utils/icons";
import "./ConversationalIntake.css";

/**
 * Conversational intake — one continuous, natural chat (LLM-feel) that drafts
 * *with the engine underneath*. The user talks freely; every turn the AI
 * extracts variables into the SAME form object (variables only — never flags,
 * never clauses), the oracle (validateVariables, detailed) names what's still
 * missing, and the assistant asks for it conversationally. When the required set
 * is satisfied it echoes the structured interpretation for confirmation, then
 * hands off to the same review screen. The actual clauses still come from the
 * reviewed rules engine and pass Indian-law validation — this is just a natural
 * front door, not a freehand drafter.
 *
 * Props:
 *   documentType   string
 *   onApply        (fieldName, value) => void
 *   appliedValues  object
 *   onContinue     () => void   — go to the (pre-filled) review screen
 *   onSkip         () => void   — skip straight to the form
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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [collected, setCollected] = useState([]); // [{ field, label, value }]
  const [appliedCount, setAppliedCount] = useState(0);
  const [stuck, setStuck] = useState(false);
  const [error, setError] = useState("");
  const startedRef = useRef(false);
  const scrollRef = useRef(null);

  // Merge updates into form + local filled; returns merged so callers can pass it
  // straight to the next request without waiting on setState.
  const applyUpdates = (base, updates = []) => {
    const next = { ...base };
    for (const update of updates) {
      next[update.field] = update.value;
      onApply(update.field, update.value);
    }
    setFilled(next);
    if (updates.length) setAppliedCount((count) => count + updates.length);
    return next;
  };

  const ingestStep = (data) => {
    if (Array.isArray(data?.collected)) setCollected(data.collected);
    const text = data?.reply || data?.next_question || "Could you tell me a bit more?";
    setMessages((prev) => [...prev, { role: "bot", text }]);
    if (data?.ready) setReady(true);
  };

  // Open the conversation with a warm, open-ended invitation.
  useEffect(() => {
    if (startedRef.current || !documentType) return;
    startedRef.current = true;
    setLoading(true);
    runConversationalStep({ document_type: documentType, filled: appliedValues })
      .then((res) => {
        if (res.data?.available === false) {
          setError(
            "The chat assistant needs the AI service, which is unavailable right now. You can fill the form directly."
          );
          return;
        }
        ingestStep(res.data);
      })
      .catch(() => setError("Could not start the chat. You can use the form instead."))
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
      });
      if (res.data?.available === false) {
        setError("The assistant is temporarily unavailable. You can continue on the form.");
        return;
      }
      const updates = res.data?.field_updates || [];
      applyUpdates(filled, updates);
      // Unmappable answer: nothing new mapped and not done → re-asked above; also
      // surface a skip-to-review escape so the user never loops silently.
      setStuck(updates.length === 0 && res.data?.ready !== true);
      ingestStep(res.data);
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
        <h2 className="conv-intake__title">Let's draft this together</h2>
        <p className="conv-intake__sub">
          Tell me what you need in your own words. I'll fill things in as we talk and
          ask only for what's missing.
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
        <>
          <div className="conv-intake__inputrow">
            <textarea
              className="conv-intake__input"
              rows={1}
              placeholder="Describe it, or answer in your own words…"
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
          {stuck && (
            <p className="conv-intake__stuck">
              Having trouble with that one?{" "}
              <button type="button" className="conv-intake__stuck-skip" onClick={onContinue}>
                Skip it and fill it in on the review screen
              </button>
            </p>
          )}
        </>
      ) : (
        // Mapping confirmation — structured interpretation, not raw chat, so a
        // swapped mapping is caught before handoff. Its own step, not Generate.
        <div className="conv-confirm">
          <div className="conv-confirm__title">Here's what I understood — does this look right?</div>
          <dl className="conv-confirm__list">
            {collected.map((item) => (
              <div key={item.field} className="conv-confirm__row">
                <dt className="conv-confirm__label">{item.label}</dt>
                <dd className="conv-confirm__value">{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="conv-confirm__actions">
            <button type="button" className="conv-intake__continue" onClick={onContinue}>
              Looks right — continue to review
            </button>
            <button
              type="button"
              className="conv-confirm__fix"
              onClick={() => {
                setReady(false);
                setStuck(false);
                setMessages((prev) => [
                  ...prev,
                  { role: "bot", text: "No problem — tell me what to change." },
                ]);
              }}
            >
              Let me correct something
            </button>
          </div>
        </div>
      )}

      {!ready && (
        <div className="conv-intake__footer">
          <button type="button" className="conv-intake__skip" onClick={onSkip}>
            Skip to the form
          </button>
          {appliedCount > 0 && (
            <button type="button" className="conv-intake__tocontinue" onClick={onContinue}>
              Continue to form now ({appliedCount} filled)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
