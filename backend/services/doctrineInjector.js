export function injectDoctrine(draft) {
    const doctrineText = `
  The Parties represent and warrant that:
  (a) The object and consideration of this Agreement are lawful under Section 23 of the Indian Contract Act, 1872;
  (b) This Agreement is entered into with free consent under Sections 13–19 of the Indian Contract Act, 1872;
  (c) Each Party is competent to contract under applicable law.
  `;
  
    draft.clauses = draft.clauses.map(c => {
      if (c.category === "ENFORCEABILITY") {
        c.text += "\n\n" + doctrineText;
      }
      return c;
    });
  
    return draft;
  }