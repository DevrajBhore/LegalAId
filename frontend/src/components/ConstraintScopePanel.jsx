import { useCallback, useEffect, useState } from "react";
import {
  getConstraintScopes,
  recordConstraintScope,
} from "../services/api";
import { Scales } from "../utils/icons";
import "./ConstraintScopePanel.css";

/**
 * Advocate review of constraint SCOPE — which instruments a rule is about.
 *
 * Distinct from the clause panel above it, which reviews wording. Thirteen rules
 * state their scope in prose ("Every contract must…", "Employment contract
 * must…") and declare none as data, and the evaluator reads an undeclared scope
 * as universal — so each is currently applied to every document the system
 * produces.
 *
 * The measured effect of each candidate answer is shown. That is deliberate and
 * so is the warning beside it: it is there so the effect is visible, not so an
 * answer can be chosen by its effect.
 *
 * Recording a decision does not change what the product generates. The panel
 * says so on every row that has one, because a decision that looked live would
 * be a decision nobody re-measured.
 */

const STATE_FILTERS = [
  { key: "outstanding", label: "Outstanding" },
  { key: "decided", label: "Decided" },
  { key: "", label: "All" },
];

export default function ConstraintScopePanel() {
  const [rules, setRules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stateFilter, setStateFilter] = useState("outstanding");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getConstraintScopes({ state: stateFilter || undefined });
      setRules(res.data?.rules || []);
      setSummary(res.data?.summary || null);
    } catch (err) {
      setError(err?.response?.data?.error || "Could not load the constraint scope questions.");
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => { load(); }, [load]);

  const draftFor = (id) => drafts[id] || { scope: "", authority: "", note: "" };
  const setDraft = (id, patch) =>
    setDrafts((d) => ({ ...d, [id]: { ...draftFor(id), ...patch } }));

  const submit = async (ruleId, decision) => {
    setBusyId(ruleId);
    setError("");
    try {
      const d = draftFor(ruleId);
      await recordConstraintScope(ruleId, {
        decision,
        scope: d.scope,
        authority: d.authority,
        note: d.note,
      });
      setDrafts((prev) => { const next = { ...prev }; delete next[ruleId]; return next; });
      setExpanded(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not record that decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="admin-panel constraint-scope">
      <div className="admin-panel-head">
        <h2><Scales /> Constraint scope</h2>
        <p>
          Which instruments each rule actually governs. Thirteen rules say so in
          their own wording and declare nothing the engine can read, so every one
          of them currently applies to every document.
        </p>
      </div>

      {summary && (
        <div className="cs-summary">
          <span><strong>{summary.outstanding}</strong> outstanding</span>
          <span><strong>{summary.decided}</strong> decided</span>
          {summary.awaiting_encoding > 0 && (
            <span className="cs-awaiting">
              <strong>{summary.awaiting_encoding}</strong> awaiting encoding
            </span>
          )}
          <span className="cs-note">{summary.note}</span>
        </div>
      )}

      <div className="cs-filters">
        {STATE_FILTERS.map((f) => (
          <button
            key={f.key || "all"}
            type="button"
            className={stateFilter === f.key ? "is-active" : ""}
            onClick={() => setStateFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="cs-error">{error}</div>}
      {loading && <div className="cs-loading">Loading…</div>}

      {!loading && rules.length === 0 && (
        <div className="cs-empty">Nothing in this view.</div>
      )}

      <ul className="cs-list">
        {rules.map((r) => {
          const open = expanded === r.rule_id;
          const d = draftFor(r.rule_id);
          const busy = busyId === r.rule_id;
          const mc = r.measured_consequence;
          return (
            <li key={r.rule_id} className={`cs-row ${open ? "is-open" : ""}`}>
              <button type="button" className="cs-head" onClick={() => setExpanded(open ? null : r.rule_id)}>
                <span className="cs-id">{r.rule_id}</span>
                <span className="cs-prop">{r.proposition}</span>
                <span className={`cs-state cs-state-${r.review_state}`}>
                  {r.review_state === "outstanding" ? "not decided" : r.review_state}
                </span>
              </button>

              {open && (
                <div className="cs-body">
                  <dl className="cs-facts">
                    <dt>Authority currently recorded</dt>
                    <dd>{r.authority_recorded || "—"}</dd>
                    <dt>Scope as written in the rule</dt>
                    <dd>“{r.authored_scope}”</dd>
                    <dt>Scope declared to the engine</dt>
                    <dd>{r.declared_scope && (r.declared_scope.applies_to_doc_types || r.declared_scope.excludes_shapes)
                      ? JSON.stringify(r.declared_scope)
                      : "none — so the engine applies it to every document"}</dd>
                  </dl>

                  {mc && (
                    <div className="cs-consequence">
                      <h4>What happens today, and under each candidate answer</h4>
                      <p className="cs-measured-on">
                        Measured {mc.measured_on} against {mc.population}.
                      </p>
                      <p>
                        <strong>Today:</strong> {mc.today.satisfy} document families satisfy this
                        rule, {mc.today.do_not} do not.
                      </p>
                      <ul>
                        {mc.candidates.map((c) => (
                          <li key={c.id}>
                            <strong>Option {c.id}</strong> — {c.scope}: {c.satisfy} satisfy,{" "}
                            {c.do_not} do not, {c.not_applicable} become not-applicable.
                            {c.$caution && <em> ({c.$caution})</em>}
                          </li>
                        ))}
                      </ul>
                      <p className="cs-warning">
                        These are shown so the effect of an answer is visible — not so an
                        answer can be chosen by its effect. Please answer the legal question.
                      </p>
                    </div>
                  )}

                  {r.scope_decision ? (
                    <div className="cs-recorded">
                      <h4>Recorded</h4>
                      <p>{r.scope_decision.scope || r.scope_decision.note}</p>
                      {r.scope_decision.authority && <p><strong>Authority:</strong> {r.scope_decision.authority}</p>}
                      <p className="cs-meta">
                        {r.scope_decision.decided_by || r.scope_decision.flagged_by} ·{" "}
                        {r.scope_decision.decided_on || r.scope_decision.flagged_on}
                      </p>
                      {r.awaiting_encoding && (
                        <p className="cs-warning">
                          Recorded but not encoded. The rule still behaves as it did; an
                          engineer encodes this and re-measures before anything changes.
                        </p>
                      )}
                      <button type="button" disabled={busy} onClick={() => submit(r.rule_id, "reset")}>
                        Withdraw
                      </button>
                    </div>
                  ) : (
                    <div className="cs-form">
                      <label>
                        Which instruments does this proposition govern?
                        <textarea
                          rows={3}
                          value={d.scope}
                          placeholder="By document type, by instrument character, or by a condition — whichever fits the proposition."
                          onChange={(e) => setDraft(r.rule_id, { scope: e.target.value })}
                        />
                      </label>
                      <label>
                        Authority relied on <span className="cs-required">required</span>
                        <input
                          type="text"
                          value={d.authority}
                          placeholder="The provision or decision this rests on"
                          onChange={(e) => setDraft(r.rule_id, { authority: e.target.value })}
                        />
                      </label>
                      <label>
                        Notes
                        <textarea
                          rows={2}
                          value={d.note}
                          placeholder="Anything the engineers need to know — including if the boundary is not expressible as a document type."
                          onChange={(e) => setDraft(r.rule_id, { note: e.target.value })}
                        />
                      </label>
                      <div className="cs-actions">
                        <button type="button" className="cs-primary" disabled={busy}
                                onClick={() => submit(r.rule_id, "decide")}>
                          Record decision
                        </button>
                        <button type="button" disabled={busy}
                                onClick={() => submit(r.rule_id, "not_representable")}>
                          Cannot be expressed this way
                        </button>
                        <button type="button" disabled={busy}
                                onClick={() => submit(r.rule_id, "discuss")}>
                          Needs discussion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
