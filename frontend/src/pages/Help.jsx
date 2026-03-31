import { useState } from "react";
import { Icons } from "../utils/icons";
import "./Help.css";

const FAQS = [
  {
    cat: "Getting Started",
    items: [
      {
        q: "What is LegalAId?",
        a: "LegalAId is an AI-powered legal document drafting workspace built exclusively for Indian law. You fill a guided intake form, the AI drafts the document, legal validation checks it, and you download a court-ready DOCX.",
      },
      {
        q: "Is it really free?",
        a: "Yes. Core drafting - all 16+ document types, AI editing, legal validation, and DOCX export - is completely free. No credit card required.",
      },
      {
        q: "Do I need legal knowledge to use it?",
        a: "No. The intake form is designed for founders, operators, and professionals. Technical legal framing is handled by the drafting engine. Complex transactions should still be reviewed by a qualified advocate.",
      },
    ],
  },
  {
    cat: "Document Generation",
    items: [
      {
        q: "Why does generation take a few seconds?",
        a: "LegalAId assembles the clause library from your inputs, drafts the document, runs legal validation, and builds the final structured draft before opening the workspace.",
      },
      {
        q: "What if I do not have all the details?",
        a: "Required fields are marked. Fill those at minimum, then refine the draft in the workspace if needed.",
      },
      {
        q: "Can I generate the same document type multiple times?",
        a: "Yes. Each run is independent and produces a fresh draft from the current inputs.",
      },
    ],
  },
  {
    cat: "Legal Validation",
    items: [
      {
        q: "How does validation work?",
        a: "Legal validation checks every generated document for structural integrity, drafting quality, variable correctness, and document completeness before export.",
      },
      {
        q: "What does 'Certified' mean?",
        a: "A certified document has passed all blocking validation rules - no missing mandatory provisions, no structurally invalid sections, and no unresolved critical issues. Advisory notes may still appear but do not block certification.",
      },
      {
        q: "Can the AI fix flagged issues?",
        a: "Yes. After generation, the AI assistant can help fix flagged issues. Review the edits in the workspace, validate again, and then export once the draft is clean.",
      },
    ],
  },
  {
    cat: "Editing & Export",
    items: [
      {
        q: "Can I edit clauses after generation?",
        a: "Yes. Every clause is editable directly in the browser. After editing, run Validate to re-check the draft. Once it passes, you can download the DOCX.",
      },
      {
        q: "What format does the export produce?",
        a: "DOCX - a Microsoft Word document with Indian legal formatting, signature blocks, and stamp duty notices where applicable.",
      },
      {
        q: "Is my draft saved if I close the browser?",
        a: "The current session is saved in your browser session storage. Closing the tab can lose unsaved work, so export your DOCX before closing.",
      },
    ],
  },
];

export default function Help() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(null);

  const lowerQuery = query.toLowerCase();
  const filtered = FAQS
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          !lowerQuery ||
          item.q.toLowerCase().includes(lowerQuery) ||
          item.a.toLowerCase().includes(lowerQuery)
      ),
    }))
    .filter((group) => group.items.length > 0);

  let flatIndex = 0;

  return (
    <div className="help-page">
      <div className="help-hero animate-in">
        <span className="help-eyebrow">HELP CENTER</span>
        <h1 className="help-title">How can we help?</h1>
        <p className="help-sub">Answers about LegalAId, document generation, validation, and export.</p>
        <div className="help-search-wrap">
          <span className="help-search-icon">{Icons.search}</span>
          <input
            className="help-search"
            type="text"
            placeholder="Search questions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="help-body">
        <div className="help-inner">
          {filtered.length === 0 ? (
            <div className="help-empty">
              <span className="help-empty-icon">{Icons.fileText}</span>
              <p>No results for "{query}". Try different keywords.</p>
            </div>
          ) : (
            filtered.map((group) => (
              <div key={group.cat} className="faq-group animate-in">
                <h3 className="faq-cat">{group.cat}</h3>
                {group.items.map((item) => {
                  const idx = flatIndex++;
                  const isOpen = open === idx;
                  return (
                    <div key={item.q} className={`faq-item${isOpen ? " faq-item--open" : ""}`}>
                      <button className="faq-q" onClick={() => setOpen(isOpen ? null : idx)}>
                        <span>{item.q}</span>
                        <span className="faq-chevron">{isOpen ? Icons.arrowLeft : Icons.arrowRight}</span>
                      </button>
                      {isOpen && <div className="faq-a">{item.a}</div>}
                    </div>
                  );
                })}
              </div>
            ))
          )}

          <div className="help-still-stuck animate-in">
            <div className="help-stuck-icon">{Icons.messageSquare}</div>
            <h3>Still have questions?</h3>
            <p>
              Our team is reachable at <a href="mailto:support@legalaid.in">support@legalaid.in</a> and typically responds within one business day.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
