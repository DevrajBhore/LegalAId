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
  const assumptions = draft?.metadata?.assumptions;
  if (!Array.isArray(assumptions) || !assumptions.length) return null;

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
