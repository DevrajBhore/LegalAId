import "./AssumptionsPanel.css";

/**
 * D4.51. The ASSUMPTIONS AND OPEN POINTS the exported document will print, shown
 * before download. The entries are rendered by the backend
 * (disclosureRenderer.disclosureFor) from the draft as it stands, so the screen
 * and the file say the same thing; nothing is worded here.
 */
const KIND_CLASS = {
  "DRAFTING DEFAULT": "assumption-kind--default",
  "OPEN POINT": "assumption-kind--open",
  ASSUMED: "assumption-kind--assumed",
};

export default function AssumptionsPanel({ disclosure }) {
  if (!disclosure) return null;
  const entries = Array.isArray(disclosure.entries) ? disclosure.entries : [];
  if (!entries.length && !disclosure.note) return null;

  return (
    <section className="assumptions-panel" aria-labelledby="assumptions-panel-title">
      <div className="assumptions-panel__head">
        <h3 id="assumptions-panel-title" className="assumptions-panel__title">
          Assumptions and open points
          {entries.length > 0 && <span className="assumptions-panel__count">{entries.length}</span>}
        </h3>
        <p className="assumptions-panel__preamble">
          Printed at the end of the downloaded document. Not part of the agreement: review these before you sign.
        </p>
      </div>

      {disclosure.note && <p className="assumptions-panel__note">{disclosure.note}</p>}

      {entries.length > 0 && (
        <ol className="assumptions-panel__list">
          {entries.map((entry, index) => (
            <li key={`${entry.kind}-${index}`} className="assumption">
              <span className={`assumption-kind ${KIND_CLASS[entry.kind] || ""}`}>{entry.kind}</span>
              <p className="assumption-text">{entry.text}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
