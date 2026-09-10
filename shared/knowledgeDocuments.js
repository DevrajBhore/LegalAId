/**
 * knowledgeDocuments.js
 *
 * Document families defined as knowledge rather than as code.
 *
 * The engine's question is "what document definitions are available?", never
 * "is this one of the forty I know about?". That is the whole difference between
 * a universal engine and a catalogue of special cases behind a common API.
 *
 * This is deliberately NOT a registration API. There is no registerDocument({…})
 * for application code to call, because a function that takes a document's
 * knowledge as arguments is still hardcoding with better manners. The loader
 * discovers definitions; it is never told about them.
 *
 * The durable contract is the SCHEMA below and the relationships it names — not
 * this directory, not these filenames. The same definitions could live in one
 * file or in a database tomorrow and nothing downstream would care. Modular
 * files are simply easier to review one legal family at a time.
 *
 * The forty families still defined in JavaScript are debt, not design. A
 * definition found here takes precedence over nothing and conflicts with
 * nothing: it fills a gap the code does not already fill.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOCUMENTS_DIR = path.resolve(HERE, "../knowledge-base/documents");

// Required shape. A definition that does not satisfy it is refused with a named
// reason rather than half-loaded: a document family that exists for discovery
// but has no intake is worse than one that does not exist.
function validate(definition, file) {
  const problems = [];
  const need = (field, test, why) => {
    if (!test) problems.push(`${field}: ${why}`);
  };
  need("document_type", typeof definition?.document_type === "string" && /^[A-Z0-9_]+$/.test(definition.document_type),
    "must be an UPPER_SNAKE_CASE string");
  need("display_name", typeof definition?.display_name === "string" && definition.display_name.trim(),
    "must be a non-empty string");
  need("family", typeof definition?.family === "string" && definition.family.trim(),
    "must be a non-empty string");
  need("blueprint", typeof definition?.blueprint === "string" && definition.blueprint.trim(),
    "must name a blueprint");
  need("variables", definition?.variables && typeof definition.variables === "object" && Object.keys(definition.variables).length,
    "must define at least one intake variable");
  need("sections", Array.isArray(definition?.sections) && definition.sections.length,
    "must define at least one intake section");

  // A family may reuse fields from the shared intake -- party names, dates,
  // jurisdiction -- but it must SAY it does. Declaring the inheritance keeps the
  // validator able to catch a typo in a field name, which is the whole reason
  // for validating: silently accepting any unknown field would let a definition
  // reference a variable that does not exist anywhere and fail at generation
  // time instead of at load time.
  const known = new Set([
    ...Object.keys(definition?.variables || {}),
    ...(definition?.common_fields || []),
  ]);
  for (const section of definition?.sections || []) {
    if (!section?.title || !Array.isArray(section.fields) || !section.fields.length) {
      problems.push(`sections: "${section?.title || "?"}" needs a title and at least one field`);
      continue;
    }
    for (const field of section.fields) {
      if (!known.has(field)) {
        problems.push(
          `sections: "${section.title}" references "${field}", which is neither one of this ` +
          `family's variables nor listed in common_fields`
        );
      }
    }
  }
  for (const field of definition?.required_fields || []) {
    if (!known.has(field)) {
      problems.push(
        `required_fields: "${field}" is neither one of this family's variables nor listed in common_fields`
      );
    }
  }
  if (problems.length) {
    throw new Error(`Invalid document definition in ${path.basename(file)}:\n  - ${problems.join("\n  - ")}`);
  }
  return definition;
}

let cache = null;

export function loadKnowledgeDocuments({ refresh = false } = {}) {
  if (cache && !refresh) return cache;
  const definitions = new Map();
  let files = [];
  try {
    files = fs.readdirSync(DOCUMENTS_DIR).filter((name) => name.endsWith(".document.json"));
  } catch {
    files = [];
  }
  for (const name of files) {
    const file = path.join(DOCUMENTS_DIR, name);
    const definition = validate(JSON.parse(fs.readFileSync(file, "utf8")), file);
    definitions.set(definition.document_type, definition);
  }
  cache = definitions;
  return cache;
}

export function clearKnowledgeDocumentCache() {
  cache = null;
}

/** The registry entry a knowledge-defined family contributes. */
export function knowledgeRegistryEntries() {
  const entries = {};
  for (const [type, definition] of loadKnowledgeDocuments()) {
    entries[type] = {
      displayName: definition.display_name,
      family: definition.family,
      ireType: type,
      blueprintName: definition.blueprint,
      knowledgeDefined: true,
    };
  }
  return entries;
}

/** The DOCUMENT_CONFIG entry it contributes. */
export function knowledgeDocumentConfigs() {
  const configs = {};
  for (const [type, definition] of loadKnowledgeDocuments()) {
    configs[type] = {
      requiredFields: definition.required_fields || [],
      signatureType: definition.signature_type || "BILATERAL",
      sections: definition.sections,
    };
  }
  return configs;
}

/** The intake variables it contributes. */
export function knowledgeVariables(documentType) {
  return loadKnowledgeDocuments().get(documentType)?.variables || null;
}
