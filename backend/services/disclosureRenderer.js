/**
 * disclosureRenderer.js
 *
 * Phase 5.1. ONE legal surface, three presentation surfaces.
 *
 *   resolved positions
 *          ↓
 *   this renderer            <- the only place that decides what is disclosed
 *          ↓
 *   canonical disclosure block
 *        ↙  ↓  ↘
 *     DOCX  PDF  TXT
 *
 * The exporters must never work out for themselves what to disclose. Three
 * exporters each reconstructing this logic is how a system ends up with the
 * DOCX saying one thing, the PDF another and the API a third -- and of those
 * three, the one the parties sign is the DOCX.
 *
 * It discloses WHAT THE ENGINE ACTUALLY KNOWS. An answer the system could not
 * place is reported to the caller as unmatched and never appears here: inventing
 * an explanation for malformed input is worse than staying silent, because a
 * fabricated disclosure reads exactly like a real one.
 */
import { protectionDisclosures } from "./protectionDecisions.js";

export const DISCLOSURE_HEADING = "ASSUMPTIONS AND OPEN POINTS";

// Presentation only. The kinds themselves are defined in positionResolution.js.
const LABELS = {
  ASSUMED: "ASSUMED",
  OPEN_POINT: "OPEN POINT",
  DRAFTING_DEFAULT: "DRAFTING DEFAULT",
};

const PREAMBLE =
  "This section is not part of the agreement between the parties. It records what " +
  "was assumed in drafting and what has not been settled, so that both can be dealt " +
  "with before signing.";

/**
 * @param   {object} draft  a generated draft; assumptions live on draft.metadata
 * @returns {{heading:string, preamble:string, entries:Array<{text:string, kind:string}>}|null}
 *          null when there is nothing to disclose, which is a legitimate state
 *          and must produce no section at all rather than an empty one.
 */
export function buildDisclosureBlock(draft) {
  // D4.50: protections no answer of the user's governs are disclosed as drafting
  // defaults, read from draft.metadata.protection_decisions, and only while the
  // clause is still in the document (protectionDecisions.js).
  const assumptions = [
    ...(Array.isArray(draft?.metadata?.assumptions) ? draft.metadata.assumptions : []),
    ...protectionDisclosures(draft),
  ];
  if (!assumptions.length) return null;

  const entries = assumptions
    .map((assumption) => {
      const text = String(assumption?.text || "").trim();
      if (!text) return null;
      return {
        text,
        // Read off the model, not deduced here. Which kind of disclosure this
        // is decides what the reader has to do about it -- verify, answer, or
        // accept -- and that is a legal characterisation. A renderer that
        // re-derives it becomes a second place where the classification lives,
        // and the two drift.
        kind: LABELS[assumption?.kind] || LABELS.OPEN_POINT,
      };
    })
    .filter(Boolean);

  if (!entries.length) return null;
  return { heading: DISCLOSURE_HEADING, preamble: PREAMBLE, entries };
}

/** Plain-text rendering, shared by the text exporter. */
export function renderDisclosureText(draft) {
  const block = buildDisclosureBlock(draft);
  if (!block) return "";
  const lines = [`\n\n${block.heading}\n${"=".repeat(block.heading.length)}`, "", block.preamble, ""];
  block.entries.forEach((entry, index) => {
    lines.push(`${index + 1}. [${entry.kind}] ${entry.text}`);
    lines.push("");
  });
  return lines.join("\n").replace(/\n+$/, "\n");
}

/**
 * D4.51. The disclosure for the editor, from the same renderer as the exports, so
 * the screen and the file cannot say different things. `protections_assessed` is
 * false for a draft generated before D4.50, which records no protection decisions:
 * its list does not cover the protections the engine added on its own, and the
 * editor says so rather than presenting the list as complete.
 */
export const DISCLOSURE_NOT_ASSESSED_NOTE =
  "This document was created before LegalAId recorded which protections it adds on its own, so this list does not cover them. Generate the document again to see them.";

export function disclosureFor(draft) {
  const block = buildDisclosureBlock(draft);
  const assessed = Array.isArray(draft?.metadata?.protection_decisions);
  return {
    heading: DISCLOSURE_HEADING,
    preamble: block?.preamble || PREAMBLE,
    entries: block?.entries || [],
    protections_assessed: assessed,
    note: assessed ? null : DISCLOSURE_NOT_ASSESSED_NOTE,
  };
}
