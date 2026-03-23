/**
 * Returns required clause IDs for a document type
 */
export function planDocument(registry, documentType) {
    const clauseIds = registry.mappings.get(documentType);
  
    if (!clauseIds) {
      return []; // allow dynamic drafts without blueprint enforcement
    }
  
    return clauseIds;
  }
  