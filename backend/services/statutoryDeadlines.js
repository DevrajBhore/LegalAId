/**
 * statutoryDeadlines.js
 *
 * A notice is an instrument of dates. Almost every way a notice fails is a date
 * failure: sent a day late, demanding payment in ten days where the statute
 * requires fifteen, or a complaint filed after the one-month window closed. None
 * of those are drafting mistakes a reader would catch - the notice reads
 * perfectly well and is simply worthless.
 *
 * So the dates are computed here rather than left to the drafter, and the
 * computed chain is both stated in the document and checked against the dates
 * the user actually entered.
 *
 * The arithmetic follows the General Clauses Act 1897 S.9: where a period is
 * reckoned FROM a day, that day is excluded. The Limitation Act 1963 S.12(1)
 * says the same for the day from which a period is to be reckoned.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  const text = String(raw).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return utc(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotted) return utc(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]));

  const spelled = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (spelled) {
    const month = MONTH_NAMES.findIndex(
      (name) => name.toLowerCase() === spelled[2].toLowerCase()
    );
    if (month >= 0) return utc(Number(spelled[3]), month, Number(spelled[1]));
  }
  return null;
}

function utc(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** General Clauses Act 1897 S.9: the day from which the period runs is excluded. */
export function addDays(date, days) {
  if (!date) return null;
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * "One month" in a statute is a calendar month, not thirty days - General
 * Clauses Act 1897 S.3(35). Where the corresponding day does not exist in the
 * later month, the period ends on that month's last day.
 */
export function addMonths(date, months) {
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return utc(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay));
}

export function daysBetween(from, to) {
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** "21st August, 2026" - the form a notice actually uses. */
export function formatLegalDate(date) {
  if (!date) return "";
  const day = date.getUTCDate();
  const suffix =
    day % 10 === 1 && day !== 11 ? "st"
    : day % 10 === 2 && day !== 12 ? "nd"
    : day % 10 === 3 && day !== 13 ? "rd"
    : "th";
  return `${day}${suffix} ${MONTH_NAMES[date.getUTCMonth()]}, ${date.getUTCFullYear()}`;
}

function issue(ruleId, severity, message, suggestion, statutoryReference) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    statutory_reference: statutoryReference,
    blocks_generation: severity === "CRITICAL",
    auto_fixable: false,
  };
}

/**
 * The Section 138 chain, which is the whole of a cheque-bounce case.
 *
 *   proviso (a)  the cheque must be presented within its validity - three months
 *                from the date it bears, or the validity marked on it
 *   proviso (b)  the payee must demand payment in writing within THIRTY days of
 *                receiving the bank's information that the cheque was returned
 *   proviso (c)  the drawer must fail to pay within FIFTEEN days of RECEIVING
 *                the notice; the offence is complete on the sixteenth day
 *   S.142(1)(b)  the complaint must be filed within ONE MONTH of the day the
 *                cause of action arose under proviso (c)
 *
 * Every one of those is jurisdictional. A notice sent on the thirty-first day is
 * not a late notice; it is no notice at all, and the complaint founded on it
 * will be quashed.
 */
export function chequeBounceSchedule({
  chequeDate,
  returnMemoDate,
  noticeDate,
  serviceDate,
} = {}) {
  const cheque = parseDate(chequeDate);
  const memo = parseDate(returnMemoDate);
  const notice = parseDate(noticeDate);
  // Where service is not yet known, the notice date is the best available proxy
  // and the document says so rather than pretending to a date it does not have.
  const served = parseDate(serviceDate);

  const schedule = {
    chequeDate: cheque,
    returnMemoDate: memo,
    noticeDate: notice,
    serviceDate: served,
    presentationDeadline: cheque ? addMonths(cheque, 3) : null,
    noticeDeadline: memo ? addDays(memo, 30) : null,
    paymentDeadline: served ? addDays(served, 15) : null,
    causeOfActionDate: served ? addDays(served, 16) : null,
    complaintDeadline: served ? addMonths(addDays(served, 16), 1) : null,
    serviceDateIsAssumed: !served && Boolean(notice),
  };

  const issues = [];

  if (memo && notice) {
    const elapsed = daysBetween(memo, notice);
    if (elapsed > 30) {
      issues.push(issue(
        "S138_NOTICE_OUT_OF_TIME",
        "CRITICAL",
        `The notice is dated ${formatLegalDate(notice)}, which is ${elapsed} days after the bank's return memo of ${formatLegalDate(
          memo
        )}. The statutory window is thirty days, and it closed on ${formatLegalDate(schedule.noticeDeadline)}.`,
        "A notice outside the thirty-day window will not support a complaint under Section 138. The cheque may be presented again within its validity, and a fresh thirty-day window will run from the fresh return memo.",
        "Negotiable Instruments Act 1881 - S.138 proviso (b)"
      ));
    } else if (elapsed < 0) {
      issues.push(issue(
        "S138_NOTICE_PREDATES_DISHONOUR",
        "CRITICAL",
        `The notice is dated ${formatLegalDate(notice)}, before the bank returned the cheque on ${formatLegalDate(memo)}.`,
        "A demand cannot precede the dishonour it complains of. Check both dates.",
        "Negotiable Instruments Act 1881 - S.138 proviso (b)"
      ));
    } else if (elapsed > 25) {
      issues.push(issue(
        "S138_NOTICE_NEAR_DEADLINE",
        "MEDIUM",
        `The notice is dated ${formatLegalDate(notice)}, ${elapsed} days after the return memo. The window closes on ${formatLegalDate(
          schedule.noticeDeadline
        )}.`,
        "Serve it now and keep proof of despatch. Where the notice is sent by post, despatch within the window is what counts, but the burden of proving it is on the sender.",
        "Negotiable Instruments Act 1881 - S.138 proviso (b)"
      ));
    }
  }

  if (cheque && memo) {
    const presented = daysBetween(cheque, memo);
    if (presented > 92) {
      issues.push(issue(
        "S138_CHEQUE_PRESENTED_LATE",
        "HIGH",
        `The cheque is dated ${formatLegalDate(cheque)} and was returned on ${formatLegalDate(
          memo
        )}, ${presented} days later. A cheque is valid for three months from its date.`,
        "Confirm the date the cheque was first presented. Section 138 protects only a cheque presented within its validity, and a bank that returned it as stale gives no cause of action.",
        "Negotiable Instruments Act 1881 - S.138 proviso (a)"
      ));
    }
    if (presented < 0) {
      issues.push(issue(
        "S138_RETURN_PREDATES_CHEQUE",
        "CRITICAL",
        `The return memo is dated ${formatLegalDate(memo)}, before the cheque itself, which is dated ${formatLegalDate(cheque)}.`,
        "Check both dates against the instrument and the memo.",
        "Negotiable Instruments Act 1881 - S.138 proviso (a)"
      ));
    }
  }

  if (served && notice && daysBetween(notice, served) < 0) {
    issues.push(issue(
      "S138_SERVICE_PREDATES_NOTICE",
      "CRITICAL",
      `Service is recorded on ${formatLegalDate(served)}, before the notice was written on ${formatLegalDate(notice)}.`,
      "Check the despatch and delivery records.",
      "Negotiable Instruments Act 1881 - S.138 proviso (c)"
    ));
  }

  return { schedule, issues };
}

/**
 * Civil Procedure Code 1908 S.80(1): no suit against the Government or against a
 * public officer for an act done in official capacity until two months after
 * notice in writing. S.80(2) allows urgent relief with the leave of the court;
 * S.80(3) saves a notice that has a defect but substantially indicates the
 * cause of action and identifies the plaintiff.
 */
export function governmentNoticeSchedule({ noticeDate } = {}) {
  const notice = parseDate(noticeDate);
  return {
    schedule: {
      noticeDate: notice,
      suitMayBeFiledFrom: notice ? addMonths(notice, 2) : null,
    },
    issues: [],
  };
}

/**
 * A demand notice that is not statutory still has a limitation problem: there is
 * no point demanding payment of a debt that is already time-barred, and a notice
 * that reveals the claim is stale is worse than no notice.
 *
 * Limitation Act 1963 Article 55 gives three years from the breach for
 * compensation for breach of contract; Article 19 gives three years from the
 * date of the loan for money lent. Section 18 gives a fresh period from a
 * written, signed acknowledgement made before the original period expired.
 */
export function limitationPosition({ causeOfActionDate, acknowledgementDate, asOf } = {}) {
  const cause = parseDate(causeOfActionDate);
  const acknowledgement = parseDate(acknowledgementDate);
  const today = parseDate(asOf) || new Date();
  if (!cause) return { schedule: {}, issues: [] };

  const originalExpiry = addMonths(cause, 36);
  // S.18 only revives a period that has not already run out.
  const acknowledgementIsEffective =
    acknowledgement && acknowledgement <= originalExpiry && acknowledgement >= cause;
  const expiry = acknowledgementIsEffective ? addMonths(acknowledgement, 36) : originalExpiry;

  const issues = [];
  const remaining = daysBetween(today, expiry);

  if (remaining !== null && remaining < 0) {
    issues.push(issue(
      "CLAIM_APPEARS_TIME_BARRED",
      "HIGH",
      `On the dates given, the three-year period ran out on ${formatLegalDate(expiry)}, ${Math.abs(
        remaining
      )} days ago.`,
      acknowledgement && !acknowledgementIsEffective
        ? `The acknowledgement of ${formatLegalDate(acknowledgement)} does not help: Section 18 revives a period only where the acknowledgement was made before the original period expired on ${formatLegalDate(originalExpiry)}.`
        : "Check for a written acknowledgement of liability signed before the period expired, or a part payment under Section 19, either of which starts a fresh three years. Otherwise the demand should say what it is: a request, not a claim that can be sued on.",
      "Limitation Act 1963 - Articles 19 and 55, read with S.18"
    ));
  } else if (remaining !== null && remaining < 90) {
    issues.push(issue(
      "LIMITATION_EXPIRING_SOON",
      "MEDIUM",
      `The three-year period expires on ${formatLegalDate(expiry)}, in ${remaining} days.`,
      "A notice does not stop limitation running. If the claim is to be preserved, the suit must be filed before that date.",
      "Limitation Act 1963 - Articles 19 and 55"
    ));
  }

  return {
    // Namespaced. This schedule is merged with an instrument's own, and a bare
    // `causeOfActionDate` here silently overwrote the Section 138 one - which is
    // a different date entirely, being the sixteenth day after service.
    schedule: {
      limitationCauseOfActionDate: cause,
      limitationAcknowledgementDate: acknowledgement,
      limitationAcknowledgementIsEffective: Boolean(acknowledgementIsEffective),
      limitationOriginalExpiry: originalExpiry,
      limitationExpiry: expiry,
      limitationDaysRemaining: remaining,
    },
    issues,
  };
}

/**
 * Arbitration and Conciliation Act 1996 S.21: unless otherwise agreed, arbitral
 * proceedings commence on the date the request to refer the dispute is RECEIVED
 * by the respondent. That date matters twice - it stops limitation running under
 * S.43(2), and it starts the thirty days under S.11(4) and (5) after which the
 * court may be asked to appoint.
 */
export function arbitrationNoticeSchedule({ noticeDate, serviceDate } = {}) {
  const notice = parseDate(noticeDate);
  const served = parseDate(serviceDate) || notice;
  return {
    schedule: {
      noticeDate: notice,
      commencementDate: served,
      // S.11(4)/(5): a party has thirty days from the request to act on it.
      appointmentWindowCloses: served ? addDays(served, 30) : null,
      serviceDateIsAssumed: !parseDate(serviceDate) && Boolean(notice),
    },
    issues: [],
  };
}

/**
 * The single entry point the validation pipeline calls. Returns the computed
 * schedule for the document type, and every date problem found in it.
 */
export function computeDeadlines(documentType, variables = {}) {
  const type = String(documentType || "").toUpperCase();

  if (type === "CHEQUE_BOUNCE_NOTICE") {
    const result = chequeBounceSchedule({
      chequeDate: variables.cheque_date,
      returnMemoDate: variables.return_memo_date,
      noticeDate: variables.notice_date || variables.effective_date,
      serviceDate: variables.notice_service_date,
    });
    const limitation = limitationPosition({
      causeOfActionDate: variables.return_memo_date,
      asOf: variables.notice_date || variables.effective_date,
    });
    return {
      schedule: { ...result.schedule, ...limitation.schedule },
      issues: [...result.issues, ...limitation.issues],
    };
  }

  if (type === "ARBITRATION_NOTICE") {
    const result = arbitrationNoticeSchedule({
      noticeDate: variables.notice_date || variables.effective_date,
      serviceDate: variables.notice_service_date,
    });
    const limitation = limitationPosition({
      causeOfActionDate: variables.cause_of_action_date,
      acknowledgementDate: variables.acknowledgement_date,
      asOf: variables.notice_date || variables.effective_date,
    });
    return {
      schedule: { ...result.schedule, ...limitation.schedule },
      issues: [...result.issues, ...limitation.issues],
    };
  }

  if (type === "LEGAL_NOTICE") {
    const government = governmentNoticeSchedule({
      noticeDate: variables.notice_date || variables.effective_date,
    });
    const limitation = limitationPosition({
      causeOfActionDate: variables.cause_of_action_date,
      acknowledgementDate: variables.acknowledgement_date,
      asOf: variables.notice_date || variables.effective_date,
    });
    const issues = [...limitation.issues];

    // The two-month bar is easy to miss because it does not apply to most
    // defendants, and fatal when it does: the plaint is returned.
    const addresseeIsGovernment =
      /\b(government|state of|union of india|municipal|corporation of|public officer|department of|ministry of)\b/i.test(
        String(variables.addressee_name || "")
      ) || String(variables.addressee_is_government || "").toLowerCase() === "yes";

    if (addresseeIsGovernment && government.schedule.suitMayBeFiledFrom) {
      issues.push(issue(
        "CPC_S80_TWO_MONTH_BAR",
        "HIGH",
        `The addressee appears to be the Government or a public officer, so no suit may be instituted until ${formatLegalDate(
          government.schedule.suitMayBeFiledFrom
        )} - two months from the date of this notice.`,
        "Set the compliance period in the notice to at least two months, or apply under Section 80(2) for leave to sue without notice where the relief is urgent. Section 80(3) will save a notice with a defect, but not a suit filed too early.",
        "Civil Procedure Code 1908 - S.80(1) and S.80(2)"
      ));
    }

    return {
      schedule: { ...government.schedule, ...limitation.schedule, addresseeIsGovernment },
      issues,
    };
  }

  return { schedule: {}, issues: [] };
}

/**
 * The computed dates, rendered as the variables a clause interpolates. This is
 * how the arithmetic reaches the page: the clause says
 * "{{s138_payment_deadline}}" and gets a real date rather than a blank.
 */
export function deadlineVariables(documentType, variables = {}) {
  const { schedule } = computeDeadlines(documentType, variables);
  const out = {};
  const put = (key, date) => {
    if (date) out[key] = formatLegalDate(date);
  };

  put("s138_presentation_deadline", schedule.presentationDeadline);
  put("s138_notice_deadline", schedule.noticeDeadline);
  put("s138_payment_deadline", schedule.paymentDeadline);
  put("s138_cause_of_action_date", schedule.causeOfActionDate);
  put("s138_complaint_deadline", schedule.complaintDeadline);
  put("cpc_s80_suit_may_be_filed_from", schedule.suitMayBeFiledFrom);
  put("arbitration_commencement_date", schedule.commencementDate);
  put("arbitration_appointment_window_closes", schedule.appointmentWindowCloses);
  put("limitation_expiry_date", schedule.limitationExpiry);

  return out;
}
