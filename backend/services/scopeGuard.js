import { DOCUMENT_CONFIG } from "../config/documentConfig.js";

export function enforceScopeGuard(draft, input) {

  const config = DOCUMENT_CONFIG[input.document_type];
  
  if (!config?.scopeGuard) {
    return draft;
  }

  draft.clauses = draft.clauses.map(c => {
    if (c.category === "PURPOSE") {
      c.text += `
The Permitted Purpose is strictly limited to evaluation discussions only.
Nothing herein shall create a partnership, joint venture, agency, or binding commercial obligation.
`;
    }
    return c;
  });

  return draft;
}