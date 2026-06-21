/**
 * obligationTracker.js
 *
 * Lifecycle layer: turns a generated document into a set of dated obligations and
 * reminders — the thing a stateless chatbot can't do for a document it produced.
 * Derives key dates from the supplied variables (effective date + durations) and
 * from the presence of lifecycle clauses (registration, lock-in, auto-renewal,
 * notice). Computed deterministically; advisory only.
 */

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Guard month overflow (e.g. Jan 31 + 1mo).
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

// "2 years" → 24, "12 months" → 12, "90 days" → 3. A BARE number ("3") is
// ambiguous, so the field's conventional unit is passed in (defaultUnit).
function durationToMonths(value, defaultUnit = "months") {
  const s = String(value || "").toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (/year/.test(s)) return Math.round(n * 12);
  if (/day/.test(s)) return Math.max(1, Math.round(n / 30));
  if (/week/.test(s)) return Math.max(1, Math.round(n / 4.3));
  if (/month/.test(s)) return Math.round(n);
  return defaultUnit === "years" ? Math.round(n * 12) : Math.round(n); // bare number
}

// Fields whose bare number means YEARS (NDA convention); everything else months.
const YEAR_UNIT_FIELDS = new Set(["agreement_term", "confidentiality_period"]);

function durationToDays(value) {
  const s = String(value || "").toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  if (/year/.test(s)) return Math.round(n * 365);
  if (/month/.test(s)) return Math.round(n * 30);
  if (/week/.test(s)) return Math.round(n * 7);
  return Math.round(n); // bare number / "days"
}

const TERM_FIELDS = [
  "agreement_term", "lease_term", "license_term", "contract_duration",
  "jv_duration", "mou_duration", "loan_tenure", "guarantee_period", "term",
];

function firstDuration(variables, fields) {
  for (const f of fields) {
    if (variables[f] != null && String(variables[f]).trim()) return { field: f, value: variables[f] };
  }
  return null;
}

export function buildObligations(draft, variables = {}) {
  const vars = variables || draft?.metadata?.source_variables || {};
  const clauseText = (draft?.clauses || []).map((c) => String(c.text || "").toLowerCase()).join(" ");
  const hasClause = (re) => (draft?.clauses || []).some((c) => re.test(String(c.clause_id || "")));
  const obligations = [];
  const start = parseDate(vars.effective_date) || parseDate(vars.start_date);

  // ── Stamp duty (at/before execution) ────────────────────────────────────
  if (/stamp/.test(clauseText)) {
    obligations.push({
      type: "STAMP_DUTY",
      title: "Stamp the agreement",
      description:
        "Pay applicable stamp duty on or before execution; an under-stamped instrument is inadmissible in evidence.",
      due_date: toISO(start),
      recurrence: null,
      basis: "variables",
      severity: "high",
    });
  }

  // ── Registration (long-term lease) — within 4 months of execution ───────
  if (hasClause(/REGISTRATION/) && start) {
    obligations.push({
      type: "REGISTRATION_DEADLINE",
      title: "Register the document",
      description:
        "Compulsorily registrable; present before the Sub-Registrar within four months of execution (Registration Act, 1908 s.23).",
      due_date: toISO(addMonths(start, 4)),
      recurrence: null,
      basis: "PROP_REGISTRATION",
      severity: "high",
    });
  }

  // ── Term / expiry + termination-notice deadline + auto-renewal ──────────
  const termDur = firstDuration(vars, TERM_FIELDS);
  const termMonths = termDur
    ? durationToMonths(termDur.value, YEAR_UNIT_FIELDS.has(termDur.field) ? "years" : "months")
    : null;
  const expiry = start && termMonths ? addMonths(start, termMonths) : null;
  if (expiry) {
    obligations.push({
      type: "AGREEMENT_EXPIRY",
      title: "Agreement term ends",
      description: `The term runs ${termMonths} month(s) from the effective date and expires on this date unless renewed or terminated earlier.`,
      due_date: toISO(expiry),
      recurrence: null,
      basis: "variables",
      severity: "medium",
    });

    const noticeDays = durationToDays(vars.notice_period_days ?? vars.notice_period ?? vars.termination_notice);
    if (noticeDays) {
      obligations.push({
        type: "TERMINATION_NOTICE_DEADLINE",
        title: "Last day to give termination notice",
        description: `To end the agreement at term, serve written notice at least ${noticeDays} day(s) before expiry.`,
        due_date: toISO(addDays(expiry, -noticeDays)),
        recurrence: null,
        basis: "variables",
        severity: "high",
      });
    }

    if (/auto[- ]?renew|automatically renew|holding over|deemed renewed/.test(clauseText)) {
      obligations.push({
        type: "AUTO_RENEWAL",
        title: "Auto-renewal — act before expiry",
        description:
          "This agreement may renew automatically. To prevent renewal, give notice before the term ends.",
        due_date: toISO(expiry),
        recurrence: null,
        basis: "clause text",
        severity: "medium",
      });
    }
  }

  // ── Lock-in period end ──────────────────────────────────────────────────
  const lockMonths = durationToMonths(vars.lock_in_period ?? vars.lockin_period);
  if (start && lockMonths) {
    obligations.push({
      type: "LOCK_IN_END",
      title: "Lock-in period ends",
      description: `Early exit before this date may forfeit deposit or attract penalty (lock-in of ${lockMonths} month(s)).`,
      due_date: toISO(addMonths(start, lockMonths)),
      recurrence: null,
      basis: "variables",
      severity: "info",
    });
  }

  // ── Probation confirmation (employment) ─────────────────────────────────
  const probMonths = durationToMonths(vars.probation_period);
  if (start && probMonths) {
    obligations.push({
      type: "PROBATION_CONFIRMATION",
      title: "Probation review / confirmation due",
      description: `Confirm, extend, or end the employee's probation by this date (${probMonths}-month probation).`,
      due_date: toISO(addMonths(start, probMonths)),
      recurrence: null,
      basis: "variables",
      severity: "medium",
    });
  }

  // ── Confidentiality survival (NDA) ──────────────────────────────────────
  const confMonths = durationToMonths(vars.confidentiality_period, "years");
  if (expiry && confMonths) {
    obligations.push({
      type: "CONFIDENTIALITY_SURVIVAL_END",
      title: "Confidentiality obligations end",
      description: `Confidentiality survives ${confMonths} month(s) after the agreement ends (trade secrets may survive indefinitely).`,
      due_date: toISO(addMonths(expiry, confMonths)),
      recurrence: null,
      basis: "variables",
      severity: "info",
    });
  }

  // ── Recurring payments (rent / retainer / EMI) ──────────────────────────
  if (/monthly|per month|each month|every month/.test(clauseText) &&
      /(rent|retainer|instal|emi|fee)/.test(clauseText)) {
    obligations.push({
      type: "PAYMENT_RECURRING",
      title: "Recurring payment due",
      description: "A recurring monthly payment (rent / retainer / instalment) falls due each month of the term.",
      due_date: start ? toISO(addMonths(start, 1)) : null,
      recurrence: "monthly",
      basis: "clause text",
      severity: "medium",
    });
  }

  // Sort by due date (undated last).
  obligations.sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

  return {
    count: obligations.length,
    next: obligations.find((o) => o.due_date) || null,
    obligations,
  };
}
