/**
 * variableLoader.js
 *
 * Loads variable definitions for a given document type.
 * Source of truth is variableConfig.js — no longer reads from knowledge-base/variables/*.json.
 */

import { getVariables } from "../config/variableConfig.js";

export function loadVariables(documentType) {
  return getVariables(documentType);
}