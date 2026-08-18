/**
 * registrationValidator.js
 *
 * Whether the instrument must be registered under the Registration Act, 1908.
 *
 * This replaces a boolean (`registrationMandatory`) that was set on three of
 * roughly 160 document types and then tested by searching the draft text for
 * "sub-registrar" / "registration act". That asked whether the document TALKS
 * about registration, not whether registration is legally required -- so a
 * two-year lease passed on any stray mention, and no lease was ever assessed on
 * its actual term.
 *
 * Registration requirements are read from knowledge-base/rules/registration.rules.json.
 * Findings are notices: failing to register does not make the instrument invalid
 * between the parties, it makes it inadmissible in evidence (S.49). Blocking
 * generation would be the wrong response.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { parseDurationMonths } from "./constraintEngine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function findRulesFile() {
  const candidates = [
    path.resolve(__dirname, "../../../knowledge-base/rules/registration.rules.json"),
    path.resolve(__dirname, "../../../../knowledge-base/rules/registration.rules.json"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

let rulesCache;

function loadRules() {
  if (rulesCache === undefined) {
    const file = findRulesFile();
    try {
      rulesCache = file ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    } catch {
      rulesCache = null;
    }
  }
  return rulesCache;
}

function readTermMonths(fields = [], variables = {}) {
  for (const field of fields) {
    const months = parseDurationMonths(variables[field]);
    if (months !== null) return { months, field };
  }
  return { months: null, field: null };
}

export function registrationValidate(draft, meta = {}) {
  const rules = loadRules();
  if (!rules || !draft?.clauses) return [];

  const docType = String(draft.document_type || "").toUpperCase();
  const variables =
    meta.variables || draft.metadata?.source_variables || draft.source_variables || {};
  const state =
    meta.state ||
    draft.metadata?.state ||
    variables.governing_law_state ||
    variables.operating_state;

  const stateNote = state ? rules.state_notes?.[state] : null;
  const consequence = `${rules.consequence} (${rules.consequence_reference})`;
  const deadline =
    `It must be presented for registration within ${rules.presentation_deadline_months} months of execution ` +
    `(${rules.deadline_reference}).`;

  const buildNotice = (statutoryReference, reason) => ({
    rule_id: "REGISTRATION_REQUIRED_NOTICE",
    severity: "MEDIUM",
    blocks_generation: false,
    notice_only: true,
    message: `${reason} ${deadline} ${consequence}${stateNote ? ` ${stateNote}` : ""}`,
    statutory_reference: statutoryReference,
    suggestion:
      "Register the instrument before the Sub-Registrar having jurisdiction, and record in the agreement which party bears the registration fee.",
  });

  // A state statute can make an instrument registrable regardless of term, so
  // these are checked before the term threshold.
  for (const entry of rules.state_overrides || []) {
    const matchesType = (entry.doc_types || []).map((d) => d.toUpperCase()).includes(docType);
    const matchesState = (entry.states || []).some(
      (s) => String(s).toLowerCase() === String(state || "").toLowerCase()
    );
    if (matchesType && matchesState && entry.always_registrable) {
      return [buildNotice(entry.statutory_reference, entry.reason)];
    }
  }

  for (const entry of rules.always_registrable || []) {
    if ((entry.doc_types || []).map((d) => d.toUpperCase()).includes(docType)) {
      return [
        buildNotice(
          entry.statutory_reference,
          "This instrument is compulsorily registrable."
        ),
      ];
    }
  }

  for (const entry of rules.term_triggered || []) {
    if (!(entry.doc_types || []).map((d) => d.toUpperCase()).includes(docType)) continue;

    const { months, field } = readTermMonths(entry.term_fields, variables);
    if (months === null) {
      // The term could not be read, so the requirement cannot be decided. Say so
      // rather than guessing in either direction.
      return [
        {
          rule_id: "REGISTRATION_TERM_UNDETERMINED",
          severity: "LOW",
          blocks_generation: false,
          notice_only: true,
          message:
            "Whether this instrument must be registered depends on its term, which could not be read from the submitted values. " +
            consequence,
          statutory_reference: entry.statutory_reference,
          suggestion: `State the term in months or years (for example "11 months" or "2 years").`,
        },
      ];
    }

    if (months >= entry.threshold_months) {
      return [
        buildNotice(
          entry.statutory_reference,
          `${entry.at_or_above} The term stated (${Math.round(months)} months, from "${field}") is at or above the ${entry.threshold_months}-month threshold, so this instrument is compulsorily registrable.`
        ),
      ];
    }

    return [
      {
        rule_id: "REGISTRATION_NOT_REQUIRED_NOTICE",
        severity: "LOW",
        blocks_generation: false,
        notice_only: true,
        message: `${entry.below} The term stated is ${Math.round(months)} months.${stateNote ? ` ${stateNote}` : ""}`,
        statutory_reference: entry.statutory_reference,
        suggestion: null,
      },
    ];
  }

  return [];
}
