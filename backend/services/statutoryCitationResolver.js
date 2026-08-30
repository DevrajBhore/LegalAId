import fs from "fs";

// Citations, resolved against the date the document actually takes effect.
//
// Until now every citation in the library was treated as timeless. It is not.
// Twenty-nine labour Acts were repealed on 21 November 2025 and replaced by four
// Codes; the DPDP Rules 2025 commence in three tranches running to 14 May 2027.
// Which of those is the right law depends entirely on when the document takes
// effect, and no amount of clause-by-clause editing can express that - a clause
// is written once and used for years.
//
// So the clause library cites the law as it stands, and this layer reports where
// that is wrong for the document in hand:
//   - an Act repealed before the document takes effect, still cited as live
//   - a provision that will not be in force when the document takes effect
//   - a document dated before a Code commenced, citing the Code rather than the
//     Act the Code replaced
//
// It reports. It does not rewrite: which law governs a transitional document is
// a question for the supervising advocate, and the answer belongs in the file.

const REGISTRY_FILE = new URL(
  "../../knowledge-base/metadata/statute_versions.json",
  import.meta.url
);

let registryCache = null;

function loadRegistry() {
  if (registryCache === null) {
    try {
      registryCache = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"))?.acts || {};
    } catch {
      registryCache = {};
    }
  }
  return registryCache;
}

export function _resetRegistryCache() {
  registryCache = null;
}

// Dates arrive from the intake as ISO, and from prose as "21 November 2025" or
// "21.11.2025". Anything that does not resolve is treated as no date at all,
// because a guessed effective date produces confidently wrong citations.
export function parseEffectiveDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

  const text = String(raw).trim();
  if (!text) return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));

  const dotted = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dotted) return new Date(Date.UTC(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1])));

  const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const spelled = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (spelled) {
    const month = MONTHS[spelled[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Date.UTC(Number(spelled[3]), month, Number(spelled[1])));
    }
  }
  return null;
}

function asDate(iso) {
  return iso ? parseEffectiveDate(iso) : null;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// Act names as they appear in citations: "Payment of Wages Act, 1936 S.5",
// "Code on Wages 2019 - S.17", "Factories Act 1948, section 66". The registry
// keys carry the comma; live text often does not.
function buildActMatchers(registry) {
  return Object.keys(registry).map((name) => {
    const escaped = name
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      // The comma before the year is optional in practice.
      .replace(/,\s*(\d{4})/, ",?\\s*$1")
      .replace(/\s+/g, "\\s+");
    return { name, pattern: new RegExp(escaped, "gi") };
  });
}

// A section or rule reference sitting immediately after the Act name, so a
// per-provision commencement can be resolved. "S.17", "Section 17(2)",
// "R.6", "Rule 6", "ss. 17 and 18".
const PROVISION_AFTER = /^[\s,;:-]*(?:and\s+)?(?:u\/s\s*|under\s+)?(?:S{1,2}\.?|Sec(?:tion|s)?\.?|R\.?|Rules?\.?)\s*(\d+[A-Z]?)/i;

// The other order, which is how the Rules are usually written in prose:
// "Rule 6 of the Digital Personal Data Protection Rules, 2025",
// "Section 8(5) of the Digital Personal Data Protection Act, 2023".
const PROVISION_BEFORE =
  /(?:S{1,2}\.?|Sec(?:tion|s)?\.?|R\.?|Rules?\.?)\s*(\d+[A-Z]?)(?:\([^)]*\))?\s+(?:of|under)\s+(?:the\s+)?$/i;

function provisionAt(text, start, end) {
  const after = text.slice(end, end + 40).match(PROVISION_AFTER);
  if (after) return after[1];
  const before = text.slice(Math.max(0, start - 60), start).match(PROVISION_BEFORE);
  return before ? before[1] : null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The renderings a date can take in drafted prose: "14 May 2027", "14th May,
// 2027", "14.05.2027", "2027-05-14".
function dateRenderings(date) {
  const day = date.getUTCDate();
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();
  const pad = (n) => String(n).padStart(2, "0");
  const name = MONTH_NAMES[month];
  return [
    `${day} ${name} ${year}`,
    `${day}${["th", "st", "nd", "rd"][day % 10 > 3 || (day > 10 && day < 14) ? 0 : day % 10]} ${name} ${year}`,
    `${day} ${name}, ${year}`,
    `${pad(day)}.${pad(month + 1)}.${year}`,
    `${pad(day)}/${pad(month + 1)}/${year}`,
    `${year}-${pad(month + 1)}-${pad(day)}`,
  ];
}

const COMMENCEMENT_LANGUAGE =
  /\b(comes? into force|came into force|commences?|commencement|takes? effect|with effect from|not yet in force)\b/i;

// A clause that has already told the reader when the provision commences has
// disclosed the very thing this layer exists to surface. Reporting it again as a
// defect would punish the clause for being right.
function commencementIsDisclosed(text, inForceFrom) {
  if (!inForceFrom) return false;
  return dateRenderings(inForceFrom).some((rendering) => text.includes(rendering));
}

// The other side of that: a clause that talks about commencement but names a
// date the registry does not carry is worse than one that says nothing.
function commencementIsMisstated(text, inForceFrom) {
  if (!inForceFrom || !COMMENCEMENT_LANGUAGE.test(text)) return false;
  if (commencementIsDisclosed(text, inForceFrom)) return false;
  // Only call it misstated where the clause actually names some date.
  return /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December),?\s+\d{4}\b/.test(
    text
  );
}

// A repealed Act is often named in a clause that is entirely up to date, because
// the clause explains what the current provision replaced: "Bharatiya Nyaya
// Sanhita, 2023 S.75, replacing Section 354A of the Indian Penal Code, 1860".
// That is scholarship, not a stale citation, and flagging it trains the reader
// to ignore the warning - which is how a real stale citation gets through.
const HISTORICAL_FRAME =
  /\b(replac(?:ing|ed|es)|formerly|erstwhile|repeal(?:ed|ing|s)|superseded|previously|corresponding to|which was|used to be|before its repeal|as it stood)\b/i;

function namedOnlyHistorically(text, actName, index) {
  // Look at the sentence the name sits in, not the whole clause: a clause may
  // properly cite an Act in one place and mention a repealed one in another.
  const before = text.lastIndexOf(".", index);
  const afterMark = text.indexOf(".", index + actName.length);
  const sentence = text.slice(
    before === -1 ? 0 : before + 1,
    afterMark === -1 ? text.length : afterMark
  );
  return HISTORICAL_FRAME.test(sentence);
}

function buildIssue(ruleId, severity, message, suggestion, extra = {}) {
  return {
    rule_id: ruleId,
    severity,
    message,
    suggestion,
    blocks_generation: false,
    auto_fixable: false,
    ...extra,
  };
}

function clauseText(clause) {
  if (!clause) return "";
  return [
    clause.clause_text,
    clause.text,
    clause.content,
    clause.statutory_reference,
    // legal_basis entries are {act, section, note}, not {reference}. Reading the
    // wrong key meant this layer scanned only the prose and the
    // statutory_reference line, and silently missed six clauses whose repealed
    // citation lived in legal_basis alone. The build-time checker caught them;
    // this one did not.
    Array.isArray(clause.legal_basis)
      ? clause.legal_basis
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : [entry?.act, entry?.section ? `S.${entry.section}` : "", entry?.note]
                  .filter(Boolean)
                  .join(" ")
          )
          .join("\n")
      : clause.legal_basis,
  ]
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n");
}

/**
 * @param draft           the assembled draft, or anything with a `clauses` array
 * @param effectiveDate   when the document takes effect - ISO, dotted or spelled
 * @param asOf            "today" for the purpose of pending-commencement notices;
 *                        injectable so the tests do not drift with the calendar
 */
export function resolveStatutoryCitations(draft, { effectiveDate, asOf } = {}) {
  const clauses = Array.isArray(draft?.clauses) ? draft.clauses : [];
  if (!clauses.length) return [];

  const effective = parseEffectiveDate(effectiveDate);
  const today = parseEffectiveDate(asOf) || new Date();
  const registry = loadRegistry();
  const matchers = buildActMatchers(registry);

  // Disclosure is a property of the DOCUMENT, not of a clause. Where one clause
  // states when a provision commences, a later clause that refers back to what
  // "this Agreement adopts from Rule 6" is not asserting the Rule is in force -
  // the document has already said otherwise, and the reader has been told.
  const documentText = clauses.map(clauseText).join("\n");

  // One finding per Act per kind, however many clauses repeat the citation.
  const seen = new Set();
  const issues = [];
  const record = (key, issue) => {
    if (seen.has(key)) return;
    seen.add(key);
    issues.push(issue);
  };

  for (const clause of clauses) {
    const text = clauseText(clause);
    if (!text) continue;
    const where = clause.clause_id ? ` (cited in ${clause.clause_id})` : "";
    // A clause that already carries a currency flag has recorded the problem and
    // is waiting on the supervising advocate. It is reported as awaiting review
    // rather than as an unnoticed defect, because those are different states and
    // conflating them makes the report useless.
    const acknowledged = String(clause.statute_currency || "");

    for (const { name, pattern } of matchers) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const entry = registry[name];
        const provision = provisionAt(text, match.index, match.index + match[0].length);

        const repealedOn = asDate(entry.repealed_on);
        const inForceFrom = asDate(
          entry.provisions?.[provision]?.in_force_from || entry.in_force_from
        );
        const provisionNote = entry.provisions?.[provision]?.note;
        const label = provision ? `${name} - ${provision}` : name;

        // 1. Repealed law cited as live.
        if (repealedOn) {
          if (namedOnlyHistorically(text, match[0], match.index)) {
            continue;
          }
          if (acknowledged.includes(name) || /CITATION OUT OF DATE/i.test(acknowledged)) {
            record(`acknowledged:${name}`, buildIssue(
              "STALE_CITATION_AWAITING_REVIEW",
              "MEDIUM",
              `${label} was repealed on ${formatDate(repealedOn)}. The clause records this and is awaiting the supervising advocate's re-mapping${where}.`,
              entry.superseded_by
                ? `Map the provision to ${entry.superseded_by} against the bare Act - section numbering does not carry across - and replace the citation.`
                : `Replace the citation with the provision now in force.`,
              // A citation the clause library has already tombstoned and queued
              // for the supervising advocate is a fact about OUR clause text,
              // not a defect in the user's document. The user cannot act on it,
              // and it rides on the general-provisions baseline, so it appears
              // in every document by construction. Scoring it as a defect put a
              // permanent -10 and a MEDIUM risk band on the entire catalogue --
              // which is why every draft displayed 73-76 no matter how it was
              // filled in. It stays visible as a note; it no longer costs the
              // document points. CITES_REPEALED_STATUTE below -- an unrecorded
              // repealed citation -- is a real defect and still scores.
              { notice_only: true }
            ));
            continue;
          }
          if (!effective || effective >= repealedOn) {
            record(`repealed:${name}`, buildIssue(
              "CITES_REPEALED_STATUTE",
              "HIGH",
              `${label} was repealed on ${formatDate(repealedOn)}${
                effective ? `, before this document takes effect on ${formatDate(effective)}` : ""
              }${where}.`,
              entry.superseded_by
                ? `Cite ${entry.superseded_by} instead, and check that the section numbering carries across - the Codes renumbered most of what they replaced.`
                : `Replace the citation with the provision now in force.`
            ));
          } else {
            // Correctly cited: the document predates the repeal.
            record(`transitional:${name}`, buildIssue(
              "TRANSITIONAL_STATUTE_APPLIES",
              "LOW",
              `${label} was repealed on ${formatDate(repealedOn)}, but this document takes effect on ${formatDate(
                effective
              )}, before that date, so the repealed Act still governs it${where}.`,
              `No change is needed. Record in the file that the document was drafted under the pre-repeal position, because a reader after ${formatDate(
                repealedOn
              )} will not assume it.`
            ));
          }
          continue;
        }

        // 2. Law cited that is not yet in force for this document.
        if (inForceFrom) {
          const provisionWasNamed = Boolean(entry.provisions?.[provision]);
          const instrumentIsPhased = Boolean(entry.provisions);
          if ((provisionWasNamed || !instrumentIsPhased) && commencementIsMisstated(text, inForceFrom)) {
            record(`misstated:${name}:${provision || "-"}`, buildIssue(
              "COMMENCEMENT_MISSTATED",
              "HIGH",
              `${label} is described as commencing on a date other than ${formatDate(
                inForceFrom
              )}, which is the date the register carries${where}.`,
              `Correct the date in the clause, or correct the register at knowledge-base/metadata/statute_versions.json if the register is the one that is wrong.`
            ));
          } else if (commencementIsDisclosed(documentText, inForceFrom)) {
            // The clause states the position itself. Nothing to report.
          } else if (effective && effective < inForceFrom) {
            record(`uncommenced:${name}:${provision || "-"}`, buildIssue(
              "CITES_UNCOMMENCED_PROVISION",
              "HIGH",
              `${label} does not come into force until ${formatDate(
                inForceFrom
              )}, but this document takes effect on ${formatDate(effective)}${where}.`,
              provisionNote
                ? `${provisionNote} Either move the effective date, or state the obligation as a contractual undertaking rather than as a statutory requirement, and cite the provision that is in force on the effective date.`
                : `Either move the effective date, or cite the law in force on that date and adopt the coming provision by contract.`
            ));
          } else if (!effective && today < inForceFrom) {
            record(`pending:${name}:${provision || "-"}`, buildIssue(
              "PROVISION_NOT_YET_IN_FORCE",
              "MEDIUM",
              `${label} is cited, but it does not come into force until ${formatDate(inForceFrom)}${where}.`,
              `State it as an obligation the parties adopt by contract, not as one the law presently imposes, until it commences.`
            ));
          }
        }
      }
    }
  }

  return issues;
}

// Which Acts a given effective date changes the answer for. Exposed so the
// intake can warn at the point the date is entered rather than after drafting.
export function statutesSensitiveTo(effectiveDate) {
  const effective = parseEffectiveDate(effectiveDate);
  if (!effective) return [];
  const registry = loadRegistry();
  const sensitive = [];
  for (const [name, entry] of Object.entries(registry)) {
    const repealedOn = asDate(entry.repealed_on);
    if (repealedOn && effective < repealedOn) {
      sensitive.push({ act: name, reason: "repealed after this date", date: entry.repealed_on });
      continue;
    }
    const inForceFrom = asDate(entry.in_force_from);
    if (inForceFrom && effective < inForceFrom) {
      sensitive.push({ act: name, reason: "not yet in force on this date", date: entry.in_force_from });
      continue;
    }
    for (const [provision, spec] of Object.entries(entry.provisions || {})) {
      const provisionFrom = asDate(spec.in_force_from);
      if (provisionFrom && effective < provisionFrom) {
        sensitive.push({
          act: `${name} - ${provision}`,
          reason: "not yet in force on this date",
          date: spec.in_force_from,
        });
      }
    }
  }
  return sensitive;
}
