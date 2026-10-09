/**
 * instrumentCoherence.js — D4.44
 *
 * Checks the RENDERED document against what the instrument says it is. The
 * structural validators check that clauses exist and that inputs are reflected;
 * none of them asked whether the document, read as a whole, is coherent. A term
 * sheet that called itself non-binding in clause 1 and recited an intention to
 * be legally bound on page one passed all of them and scored 100.
 *
 * Runs only for document types whose drafting policy declares
 * `rendering.instrument`. Every check reads the text, so it applies equally to a
 * generated draft, an AI-edited draft and a user-edited one.
 *
 * Outcome classes, kept apart on purpose:
 *   INCOHERENT              the document contradicts itself or binds a non-party
 *   INCOMPLETE              a term the instrument must state is absent, or a
 *                           choice was stated that nobody made
 *   INVALID_INPUT           an answer cannot be used as given
 *   COMMERCIALLY_UNUSUAL    lawful, but outside the usual range; check intent
 *   LEGAL_REVIEW_REQUIRED   needs an advocate's view
 *   LEGALLY_PROHIBITED      only with a verified authority (none yet)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getInstrument,
  provisionStatusOf,
  PROVISION_STATUS,
  UNRESOLVED_PREFIX,
} from "./instrumentKnowledge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEXICON_PATH = path.resolve(__dirname, "../../knowledge-base/metadata/instrument_coherence.json");
let lexiconCache = null;
function lexicon() {
  if (!lexiconCache) lexiconCache = JSON.parse(fs.readFileSync(LEXICON_PATH, "utf8"));
  return lexiconCache;
}

const OUTCOME = Object.freeze({
  INCOHERENT: "INCOHERENT",
  INCOMPLETE: "INCOMPLETE",
  INVALID_INPUT: "INVALID_INPUT",
  COMMERCIALLY_UNUSUAL: "COMMERCIALLY_UNUSUAL",
  LEGAL_REVIEW_REQUIRED: "LEGAL_REVIEW_REQUIRED",
  LEGALLY_PROHIBITED: "LEGALLY_PROHIBITED",
});
export { OUTCOME as COHERENCE_OUTCOME };

const SEVERITY_FOR_OUTCOME = {
  INVALID_INPUT: "CRITICAL",
  LEGALLY_PROHIBITED: "CRITICAL",
  LEGAL_REVIEW_REQUIRED: "HIGH",
  COMMERCIALLY_UNUSUAL: "MEDIUM",
};

function issue(rule_id, severity, outcome, message, extra = {}) {
  return {
    rule_id,
    severity,
    outcome_class: outcome,
    message,
    layer: "instrument_coherence",
    ...(severity === "CRITICAL" ? { blocks_generation: true } : {}),
    ...(outcome === OUTCOME.LEGAL_REVIEW_REQUIRED ? { manual_review_required: true } : {}),
    ...extra,
  };
}

const rx = (source, flags = "i") => new RegExp(source, flags);
const clip = (text, n = 140) => {
  const t = String(text).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function sentencesOf(text) {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.;])\s+(?=[A-Z(])/))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Party labels the document itself defines: `referred to as the "X"`, `together the "X"`. */
function definedPartyLabels(clauses) {
  const text = clauses.map((c) => c.text || "").join("\n");
  const labels = new Set();
  for (const m of text.matchAll(/referred to as the "([^"]+)"/g)) labels.add(m[1]);
  for (const m of text.matchAll(/together the "([^"]+)"/g)) labels.add(m[1]);
  for (const m of text.matchAll(/each a "([^"]+)"/g)) labels.add(m[1]);
  return labels;
}

function partySatisfies(role, labels) {
  const map = lexicon().role_aliases_satisfied_by_party || {};
  if (labels.has(role)) return true;
  const singular = role.replace(/s$/, "");
  if (labels.has(singular)) return true;
  const stem = Object.prototype.hasOwnProperty.call(map, role) ? map[role] : singular;
  if (stem === null) return true; // an organ of a party (a director), not a person bound in their own right
  return [...labels].some((label) => label === stem || label.startsWith(`${stem} `));
}

/* ── The checks ──────────────────────────────────────────────────────────── */

function checkFormationFormulae(clauses, instrument) {
  if (instrument.binding_character === "BINDING") return [];
  const out = [];
  for (const clause of clauses) {
    const hits = lexicon().contract_formation_formulae
      .map(({ pattern, describes }) => ({ m: rx(pattern, pattern === "\\bTHIS AGREEMENT\\b" ? "" : "i").exec(clause.text || ""), describes }))
      .filter((h) => h.m);
    if (!hits.length) continue;
    out.push(issue("BINDING_STATUS_CONTRADICTED", "CRITICAL", OUTCOME.INCOHERENT,
      `The document says it is not legally binding except for named provisions, but ${clause.title || clause.clause_id} contains ${hits.map((h) => h.describes).join("; ")} (for example "${clip(hits[0].m[0], 60)}"). A court reads the document as a whole; this wording supports the argument that it was meant to bind.`,
      { offending_clause_id: clause.clause_id || null, evidence: hits.map((h) => h.m[0]) }));
  }
  return out;
}

function checkOperativeLanguage(clauses, documentType, instrument) {
  if (instrument.binding_character === "BINDING") return [];
  const { obligation_markers: markers, descriptive_frames: frames } = lexicon();
  const out = [];
  for (const clause of clauses) {
    const status = provisionStatusOf(documentType, clause.clause_id);
    if (status === PROVISION_STATUS.BINDING_NOW) continue;
    const lines = String(clause.text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const inheritsFrame = lines.length > 0 && /:\s*$/.test(lines[0]) && frames.some((f) => rx(f).test(lines[0]));
    const findings = [];
    lines.forEach((line, i) => {
      // Only a LIST ITEM under "It is proposed that:" inherits the frame. A plain
      // sentence after the list does not: planting "Any transfer ... shall be
      // void." after the list passed until this was narrowed (D4.44).
      const framedLine = inheritsFrame && i > 0 && /^\(?(?:[a-z]{1,3}|\d{1,2}(?:\.\d{1,2})*)[.)]\s/i.test(line);
      for (const sentence of sentencesOf(line)) {
        const interpretive = (lexicon().interpretive_constructions || []).map((p) => rx(p, "gi"));
        const plain = interpretive.reduce((t, r) => t.replace(r, " "), sentence);
        const marker = markers.map((m) => rx(m).exec(plain)).find(Boolean);
        if (!marker) continue;
        if (framedLine) continue;
        const before = plain.slice(0, marker.index);
        if (frames.some((f) => rx(f).test(before))) continue;
        findings.push(sentence);
      }
    });
    if (!findings.length) continue;
    const label = status === PROVISION_STATUS.NON_BINDING ? "is declared non-binding" : "has no declared binding status";
    out.push(issue("NON_BINDING_OPERATIVE_LANGUAGE", "CRITICAL", OUTCOME.INCOHERENT,
      `${clause.title || clause.clause_id} ${label}, but imposes present obligations: "${clip(findings[0])}"${findings.length > 1 ? ` (and ${findings.length - 1} more)` : ""}. In a non-binding provision, describe what the definitive agreements will provide; do not impose the obligation now.`,
      { offending_clause_id: clause.clause_id || null, evidence: findings.slice(0, 5) }));
  }
  return out;
}

function checkUndeclaredStatus(clauses, documentType) {
  const out = [];
  for (const clause of clauses) {
    if (!clause.clause_id) continue;
    if (provisionStatusOf(documentType, clause.clause_id) !== PROVISION_STATUS.UNRESOLVED_PENDING_REVIEW) continue;
    out.push(issue("BINDING_STATUS_UNDECLARED", "HIGH", OUTCOME.LEGAL_REVIEW_REQUIRED,
      `${clause.title || clause.clause_id} (${clause.clause_id}) is in the document, but nothing records whether it is meant to bind. Until that is decided it is unresolved pending legal review.`,
      { offending_clause_id: clause.clause_id }));
  }
  return out;
}

function checkNonPartyObligations(clauses) {
  const labels = definedPartyLabels(clauses);
  const roles = [...lexicon().person_roles].sort((a, b) => b.length - a.length);
  const markers = lexicon().obligation_markers;
  const out = [];
  const seen = new Set();
  for (const clause of clauses) {
    for (const sentence of sentencesOf(clause.text)) {
      const marker = markers.map((m) => rx(m).exec(sentence)).find(Boolean);
      if (!marker) continue;
      const subject = sentence.slice(0, marker.index);
      for (const role of roles) {
        const m = rx(`\\b(?:the|each|any|all|no|every)\\s+${role}\\b`).exec(subject);
        if (!m) continue;
        if (partySatisfies(role, labels)) break;
        const key = `${role}|${clause.clause_id}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(issue("NON_PARTY_OBLIGATION", "CRITICAL", OUTCOME.INCOHERENT,
            `${clause.title || clause.clause_id} imposes an obligation on "${role}", who is not a party to this document: "${clip(sentence)}". A person who does not sign is not bound by it.`,
            { offending_clause_id: clause.clause_id || null, evidence: role }));
        }
        break;
      }
    }
  }
  return out;
}

function checkBoilerplate(clauses, instrument) {
  if (instrument.binding_character === "BINDING") return [];
  const out = [];
  for (const entry of lexicon().binding_contract_only_provisions) {
    const hit = clauses.find((c) => entry.clause_ids.includes(c.clause_id) ||
      rx(`^\\s*${entry.title}\\s*$`).test(String(c.title || "")));
    if (!hit) continue;
    out.push(issue("BINDING_CONTRACT_BOILERPLATE", "HIGH", OUTCOME.INCOHERENT,
      `The document carries ${/^[aeiou]/i.test(entry.title) ? "an" : "a"} ${entry.title} provision (${hit.clause_id || hit.title}). It is a general provision of a binding contract; in a document that is not binding it suggests that it is.`,
      { offending_clause_id: hit.clause_id || null }));
  }
  const noun = instrument.noun;
  if (noun) {
    for (const clause of clauses) {
      const m = rx(`supersed\\w*[^.]{0,200}\\b${noun}s?\\b`).exec(clause.text || "");
      if (!m) continue;
      out.push(issue("SELF_SUPERSESSION", "HIGH", OUTCOME.INCOHERENT,
        `${clause.title || clause.clause_id} supersedes "${noun.toLowerCase()}s" from inside a ${noun}: "${clip(m[0])}".`,
        { offending_clause_id: clause.clause_id || null }));
    }
  }
  return out;
}

function stemOf(noun) {
  const last = String(noun).trim().split(/\s+/).pop() || "";
  return last.replace(/(?:ies)$/, "y").replace(/s$/, "");
}

function checkCrossReferences(clauses) {
  const out = [];
  const full = clauses.map((c) => `${c.title || ""}\n${c.text || ""}`).join("\n");
  const titles = clauses.map((c) => String(c.title || "").toLowerCase());
  for (const source of lexicon().cross_reference_patterns) {
    for (const clause of clauses) {
      for (const m of String(clause.text || "").matchAll(rx(source, "gi"))) {
        const stem = stemOf(m[1]);
        if (!stem) continue;
        const elsewhere = full.replace(m[0], "");
        const hasList = rx(`(?:following|these)\\s+(?:\\w+\\s+){0,2}${stem}|${stem}\\w*[^.:\\n]{0,40}:`, "i").test(elsewhere) ||
          titles.some((t) => t.includes(stem.toLowerCase()));
        if (hasList) continue;
        out.push(issue("UNDEFINED_CROSS_REFERENCE", "HIGH", OUTCOME.INCOHERENT,
          `${clause.title || clause.clause_id} refers to "${m[0]}", but the document lists no ${m[1]}.`,
          { offending_clause_id: clause.clause_id || null }));
      }
    }
  }
  const headingSource = lexicon().heading_reference_pattern;
  for (const clause of clauses) {
    for (const m of String(clause.text || "").matchAll(rx(headingSource, "g"))) {
      for (const h of m[1].matchAll(/"([^"]+)"/g)) {
        const heading = h[1].toLowerCase();
        if (titles.includes(heading)) continue;
        out.push(issue("UNDEFINED_CROSS_REFERENCE", "HIGH", OUTCOME.INCOHERENT,
          `${clause.title || clause.clause_id} refers to a provision headed "${h[1]}", which the document does not contain.`,
          { offending_clause_id: clause.clause_id || null }));
      }
    }
  }
  return out;
}

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
function checkBoardSize(clauses) {
  const { determinate, indeterminate } = lexicon().board_size;
  const full = clauses.map((c) => c.text || "").join("\n");
  const counts = new Set();
  for (const source of determinate) {
    for (const m of full.matchAll(rx(source, "gi"))) {
      const word = m[1].toLowerCase();
      const n = NUMBER_WORDS[word] ?? (/^\d+$/.test(word) ? Number(word) : null);
      if (n) counts.add(n);
    }
  }
  const vague = indeterminate.map((s) => rx(s).exec(full)).find(Boolean);
  const out = [];
  if (counts.size > 1 || (counts.size === 1 && vague)) {
    out.push(issue("BOARD_SIZE_CONTRADICTION", "HIGH", OUTCOME.INCOHERENT,
      `The document states the size of the board in incompatible ways: ${[...counts].map((n) => `${n} directors`).join(" and ")}${vague ? ` and "${vague[0]}"` : ""}.`));
  }
  return out;
}

function checkArticlesPrecedence(clauses) {
  const { patterns, authority } = lexicon().articles_precedence;
  const out = [];
  for (const clause of clauses) {
    const m = patterns.map((p) => rx(p).exec(clause.text || "")).find(Boolean);
    if (!m) continue;
    out.push(issue("ARTICLES_PRECEDENCE_UNSUPPORTED", "HIGH", OUTCOME.LEGAL_REVIEW_REQUIRED,
      `${clause.title || clause.clause_id} states that the contract prevails over the Articles of Association: "${clip(m[0])}". Under Indian company law a restriction that is not in the Articles may not bind the company or its shareholders (${authority}).`,
      { offending_clause_id: clause.clause_id || null }));
  }
  return out;
}

function checkRequiredTerms(clauses, instrument) {
  const out = [];
  const full = clauses.map((c) => `${c.title || ""}\n${c.text || ""}`).join("\n");
  const labels = definedPartyLabels(clauses);
  for (const term of instrument.required_terms || []) {
    let present;
    if (term.check === "party_label_present") present = [...labels].some((l) => rx(term.label_pattern, "").test(l));
    else present = rx(term.pattern).test(full);
    if (present) continue;
    out.push(issue("REQUIRED_TERM_MISSING", "HIGH", OUTCOME.INCOMPLETE,
      `A ${instrument.noun || "document"} must state ${term.label}, either as agreed or as expressly to be agreed. This one does not mention it.`,
      { term: term.id }));
  }
  return out;
}

const answered = (v) => v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim().toLowerCase() !== "to be agreed";

function checkSilentDefaults(clauses, instrument, variables) {
  const out = [];
  const full = clauses.map((c) => c.text || "").join("\n");
  for (const choice of instrument.economic_choices || []) {
    if (answered(variables?.[choice.field])) continue;
    const hit = choice.asserted_by.map((p) => rx(p).exec(full)).find(Boolean);
    if (!hit) continue;
    out.push(issue("SILENT_DEFAULT", "HIGH", OUTCOME.INCOMPLETE,
      `The document states ${choice.label} ("${clip(hit.input.slice(Math.max(0, hit.index - 30), hit.index + 60), 100)}"), but nobody chose it: the answer for "${choice.field}" is missing. A choice that moves value between the parties must come from an answer or be marked as to be agreed.`,
      { choice: choice.id }));
  }
  return out;
}

function checkUnresolved(clauses) {
  const full = clauses.map((c) => c.text || "").join("\n");
  const items = [...full.matchAll(/\[To be agreed: ([^\]]+)\]/g)].map((m) => m[1]);
  if (!items.length) return [];
  return [issue("TERMS_TO_BE_AGREED", "MEDIUM", OUTCOME.INCOMPLETE,
    `${items.length} term${items.length === 1 ? " is" : "s are"} marked as to be agreed: ${items.map((i) => clip(i, 70)).join("; ")}. Open points belong in the non-binding provisions of a term sheet; the void-for-uncertainty rule (Contract Act s.29) is still applied to the binding provisions.`,
    { recommendation_only: true, items })];
}

/* ── Inputs ──────────────────────────────────────────────────────────────── */

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};
function wordsToNumber(words) {
  let total = 0, current = 0, seen = false;
  for (const w of words.toLowerCase().split(/[\s-]+/).filter((x) => x && x !== "and")) {
    if (!(w in WORD_NUMBERS)) return null;
    seen = true;
    if (w === "hundred") current = (current || 1) * 100;
    else current += WORD_NUMBERS[w];
  }
  total += current;
  return seen ? total : null;
}
export function parseDurationDays(value) {
  const text = String(value || "").trim().toLowerCase();
  const m = /^(?:([a-z][a-z\s-]*?)\s*(?:\((\d+)\))?|(\d+(?:\.\d+)?))\s*(day|week|month|year)s?\b/.exec(text);
  if (!m) return null;
  const n = m[2] ? Number(m[2]) : m[3] ? Number(m[3]) : wordsToNumber(m[1] || "");
  if (!n || !Number.isFinite(n)) return null;
  const factor = { day: 1, week: 7, month: 30, year: 365 }[m[4]];
  return n * factor;
}

function num(v) {
  if (!answered(v)) return null;
  const n = Number(String(v).replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function holds(cond, variables) {
  const v = variables?.[cond.field];
  return answered(v) && (cond.in || []).includes(String(v).trim());
}

export function validateInstrumentInputs(documentType, variables = {}) {
  const instrument = getInstrument(documentType);
  if (!instrument || !variables) return [];
  const out = [];
  for (const check of instrument.input_checks || []) {
    const fields = check.fields || (check.field ? [check.field] : []);
    let fails = false;
    switch (check.rule) {
      case "positive":
        fails = fields.some((f) => answered(variables[f]) && !(num(variables[f]) > 0));
        break;
      case "positive_integer_if_answered":
        fails = fields.some((f) => answered(variables[f]) && !(Number.isInteger(num(variables[f])) && num(variables[f]) > 0));
        break;
      case "range_if_answered":
        fails = fields.some((f) => {
          const n = num(variables[f]);
          if (n === null) return false;
          if (Number.isNaN(n)) return check.outcome === "INVALID_INPUT";
          return (check.min_exclusive !== undefined && !(n > check.min_exclusive)) ||
            (check.max_exclusive !== undefined && !(n < check.max_exclusive)) ||
            (check.min_inclusive !== undefined && !(n >= check.min_inclusive)) ||
            (check.max_inclusive !== undefined && !(n <= check.max_inclusive));
        });
        break;
      case "required_when":
        fails = holds(check.when, variables) && !answered(variables[check.field]);
        break;
      case "date_after": {
        const a = Date.parse(variables[check.field]);
        const b = Date.parse(variables[check.after]);
        fails = answered(variables[check.field]) && answered(variables[check.after]) && Number.isFinite(a) && Number.isFinite(b) && !(a > b);
        break;
      }
      case "duration":
        fails = answered(variables[check.field]) && parseDurationDays(variables[check.field]) === null;
        break;
      case "duration_days_max": {
        const days = parseDurationDays(variables[check.field]);
        fails = days !== null && days > check.max_days;
        break;
      }
      case "investment_exceeds": {
        const a = num(variables[check.field]);
        const b = num(variables[check.than]);
        fails = a !== null && b !== null && a > b;
        break;
      }
      case "equals":
        fails = holds({ field: check.field, in: check.in }, variables);
        break;
      case "all":
        fails = (check.conditions || []).every((c) => holds(c, variables));
        break;
      default:
        throw new Error(`instrument input check ${check.id}: unknown rule ${check.rule}`);
    }
    if (!fails) continue;
    const severity = SEVERITY_FOR_OUTCOME[check.outcome] || "HIGH";
    out.push(issue(check.id, severity, check.outcome, check.message, {
      field: check.field || fields[0] || null,
      ...(check.outcome === "COMMERCIALLY_UNUSUAL" ? { recommendation_only: true } : {}),
    }));
  }
  return out;
}

/**
 * Every coherence finding for a rendered draft. [] for a document type with no
 * declared instrument.
 */
export function validateInstrumentCoherence(draft, { documentType, variables } = {}) {
  const type = documentType || draft?.document_type;
  const instrument = getInstrument(type);
  if (!instrument || !Array.isArray(draft?.clauses)) return [];
  const clauses = draft.clauses.filter((c) => c && typeof c.text === "string");
  return [
    ...checkFormationFormulae(clauses, instrument),
    ...checkOperativeLanguage(clauses, type, instrument),
    ...checkNonPartyObligations(clauses),
    ...checkUndeclaredStatus(clauses, type),
    ...checkBoilerplate(clauses, instrument),
    ...checkCrossReferences(clauses),
    ...checkBoardSize(clauses),
    ...checkArticlesPrecedence(clauses),
    ...checkRequiredTerms(clauses, instrument),
    ...checkSilentDefaults(clauses, instrument, variables || {}),
    ...checkUnresolved(clauses),
    ...validateInstrumentInputs(type, variables || {}),
  ];
}

export function declaresInstrument(documentType) {
  return Boolean(getInstrument(documentType));
}

export { UNRESOLVED_PREFIX };

/* ── Uncertainty, scoped by binding status ───────────────────────────────────
 *
 * Section 29 of the Contract Act voids an AGREEMENT whose meaning is uncertain.
 * Two engine rules apply it to the whole text: any "[" or "to be agreed"
 * anywhere is CRITICAL. In a partly binding instrument the open points sit in
 * provisions that are not agreements at all, and are meant to be open. The
 * rules are kept for the binding provisions, where they matter, and released
 * for the rest, which TERMS_TO_BE_AGREED reports instead.
 */
const UNCERTAINTY_RULES = new Set(["UNCERTAINTY_PLACEHOLDER", "AGREEMENT_VOID_FOR_UNCERTAINTY"]);
const UNCERTAIN_TEXT = /\[|to be agreed|to be decided|to be mutually agreed|\btbd\b|as mutually agreed later/i;

export function scopeUncertaintyToBindingProvisions(issues = [], draft, documentType) {
  const instrument = getInstrument(documentType);
  if (!instrument || instrument.binding_character === "BINDING" || !Array.isArray(draft?.clauses)) return issues;
  const uncertainInBinding = draft.clauses.some((clause) =>
    provisionStatusOf(documentType, clause.clause_id) !== PROVISION_STATUS.NON_BINDING &&
    UNCERTAIN_TEXT.test(clause.text || ""));
  if (uncertainInBinding) return issues;
  return issues.filter((i) => !UNCERTAINTY_RULES.has(i?.rule_id));
}
