import { injectVariables } from "./variableInjector.js";

export function injectDraftVariables(draft, variables = {}) {
  if (!draft || !Array.isArray(draft.clauses)) {
    return draft;
  }

  draft.clauses = draft.clauses.map((c) => {
    const injectedText = injectVariables(c.text || "", variables);
    const leftover = [
      ...(injectedText.match(/{{(.*?)}}/g) || []),
      ...(injectedText.match(/\[[A-Z0-9_]+\]/g) || []),
    ];

    if (leftover.length > 0) {
      console.warn("Unresolved variables in clause:", c.clause_id, leftover);
    }

    return {
      ...c,
      text: injectedText,
    };
  });

  return draft;
}
