import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv from "ajv";

import { toBlueprintName } from "./documentTypeNormalizer.js";
import { normalizeClauseCategory } from "../config/clauseOrder.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_ROOT = path.resolve(__dirname, "../../knowledge-base");
const CLAUSE_LIB = path.join(KB_ROOT, "clause_library");
const BLUEPRINTS = path.join(CLAUSE_LIB, "blueprints");
const CLAUSE_SCHEMA_FILE = path.join(CLAUSE_LIB, "base_clause.schema.json");

let knowledgeBaseCache = null;
let clauseSchemaValidator = null;

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function buildBlueprintCandidates(documentType) {
  const base = documentType.toLowerCase();
  const candidates = [];

  pushUnique(candidates, `${toBlueprintName(documentType)}.blueprint.json`);
  pushUnique(candidates, `${base}.blueprint.json`);

  const agreementAlias = base.replace(/_agreement$/, "");
  if (agreementAlias !== base && agreementAlias.split("_").length <= 3) {
    pushUnique(candidates, `${agreementAlias}.blueprint.json`);
  }

  const contractAlias = base.replace(/_contract$/, "");
  if (contractAlias !== base) {
    pushUnique(candidates, `${contractAlias}.blueprint.json`);
  }

  const deedAlias = base.replace(/_deed$/, "");
  if (deedAlias !== base) {
    pushUnique(candidates, `${deedAlias}.blueprint.json`);
  }

  return candidates;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to parse JSON at "${filePath}": ${error.message}`);
  }
}

function extractClauseIds(blueprint, label) {
  const clauseIds = blueprint.required_clauses || blueprint.clauses || [];

  if (!Array.isArray(clauseIds)) {
    throw new Error(
      `Invalid blueprint format for "${label}": clauses must be an array.`
    );
  }

  for (const clauseId of clauseIds) {
    if (typeof clauseId !== "string" || !clauseId.trim()) {
      throw new Error(
        `Invalid clause reference in "${label}": ${JSON.stringify(clauseId)}`
      );
    }
  }

  return clauseIds;
}

function getClauseSchemaValidator() {
  if (!clauseSchemaValidator) {
    if (!fs.existsSync(CLAUSE_SCHEMA_FILE)) {
      throw new Error(`Clause schema not found at: ${CLAUSE_SCHEMA_FILE}`);
    }

    const schema = readJsonFile(CLAUSE_SCHEMA_FILE);
    const ajv = new Ajv({ allErrors: true, strict: false });
    clauseSchemaValidator = ajv.compile(schema);
  }

  return clauseSchemaValidator;
}

function loadClauseCache() {
  if (!fs.existsSync(CLAUSE_LIB)) {
    throw new Error(`Clause library not found at: ${CLAUSE_LIB}`);
  }

  const clausesById = new Map();
  const folders = fs.readdirSync(CLAUSE_LIB, { withFileTypes: true });
  const validateClause = getClauseSchemaValidator();

  for (const folder of folders) {
    if (!folder.isDirectory() || folder.name === "blueprints") continue;

    const dir = path.join(CLAUSE_LIB, folder.name);
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith(".json")) continue;

      const filePath = path.join(dir, file.name);
      const clause = readJsonFile(filePath);

      if (!validateClause(clause)) {
        const details = (validateClause.errors || [])
          .map((error) => `${error.instancePath || "/"} ${error.message}`)
          .join("; ");
        throw new Error(
          `Clause file "${filePath}" failed schema validation: ${details}`
        );
      }

      if (typeof clause?.clause_id !== "string" || !clause.clause_id.trim()) {
        throw new Error(`Clause file "${filePath}" is missing a valid clause_id.`);
      }

      if (typeof clause?.text !== "string" || !clause.text.trim()) {
        throw new Error(`Clause file "${filePath}" is missing clause text.`);
      }

      if (clausesById.has(clause.clause_id)) {
        throw new Error(
          `Duplicate clause_id "${clause.clause_id}" found in "${filePath}".`
        );
      }

      clausesById.set(clause.clause_id, clause);
    }
  }

  if (clausesById.size === 0) {
    throw new Error(`No clause JSON files were loaded from: ${CLAUSE_LIB}`);
  }

  return clausesById;
}

function loadBlueprintCache() {
  if (!fs.existsSync(BLUEPRINTS)) {
    throw new Error(`Blueprint directory not found at: ${BLUEPRINTS}`);
  }

  const blueprintsByFile = new Map();
  const files = fs.readdirSync(BLUEPRINTS, { withFileTypes: true });

  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".json")) continue;

    const filePath = path.join(BLUEPRINTS, file.name);
    const blueprint = readJsonFile(filePath);

    extractClauseIds(blueprint, file.name);
    blueprintsByFile.set(file.name, blueprint);
  }

  if (blueprintsByFile.size === 0) {
    throw new Error(`No blueprint JSON files were loaded from: ${BLUEPRINTS}`);
  }

  return blueprintsByFile;
}

function validateBlueprintReferences(blueprintsByFile, clausesById) {
  const missingReferences = [];

  for (const [fileName, blueprint] of blueprintsByFile.entries()) {
    for (const clauseId of extractClauseIds(blueprint, fileName)) {
      if (!clausesById.has(clauseId)) {
        missingReferences.push(`${fileName} -> ${clauseId}`);
      }
    }
  }

  if (missingReferences.length > 0) {
    throw new Error(
      "Blueprints reference missing clauses:\n" +
        missingReferences.map((entry) => `- ${entry}`).join("\n")
    );
  }
}

function resolveBlueprint(documentType, blueprintsByFile) {
  const candidates = buildBlueprintCandidates(documentType);

  for (const candidate of candidates) {
    const blueprint = blueprintsByFile.get(candidate);
    if (blueprint) {
      return { blueprint, candidates };
    }
  }

  return { blueprint: null, candidates };
}

function validateDocumentTypeCoverage(blueprintsByFile, documentTypes = []) {
  const missing = [];

  for (const documentType of documentTypes) {
    const { blueprint, candidates } = resolveBlueprint(
      documentType,
      blueprintsByFile
    );

    if (!blueprint) {
      missing.push(`"${documentType}" (tried: ${candidates.join(", ")})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      "No blueprint found for configured document types:\n" +
        missing.map((entry) => `- ${entry}`).join("\n")
    );
  }
}

function getKnowledgeBaseCache() {
  if (!knowledgeBaseCache) {
    preloadKnowledgeBase();
  }

  return knowledgeBaseCache;
}

export function preloadKnowledgeBase({ documentTypes = [] } = {}) {
  if (!knowledgeBaseCache) {
    const clausesById = loadClauseCache();
    const blueprintsByFile = loadBlueprintCache();

    validateBlueprintReferences(blueprintsByFile, clausesById);
    validateDocumentTypeCoverage(blueprintsByFile, documentTypes);

    knowledgeBaseCache = {
      clausesById,
      blueprintsByFile,
      stats: {
        clauseCount: clausesById.size,
        blueprintCount: blueprintsByFile.size,
        documentTypeCount: documentTypes.length,
      },
    };
  } else if (documentTypes.length > 0) {
    validateDocumentTypeCoverage(knowledgeBaseCache.blueprintsByFile, documentTypes);
  }

  return knowledgeBaseCache.stats;
}

export function assembleDocument(documentType, _variables = {}) {
  const { clausesById, blueprintsByFile } = getKnowledgeBaseCache();
  const { blueprint, candidates } = resolveBlueprint(
    documentType,
    blueprintsByFile
  );

  if (!blueprint) {
    throw new Error(
      `Blueprint not found for document type: "${documentType}". ` +
        `Tried: ${candidates.join(", ")}`
    );
  }

  const clauseIds = extractClauseIds(blueprint, documentType);
  const clauses = clauseIds.map((id) => {
    const clause = clausesById.get(id);
    if (!clause) {
      throw new Error(
        `Clause "${id}" referenced by "${documentType}" was not found in the preloaded cache.`
      );
    }
    return {
      ...clause,
      category: normalizeClauseCategory(clause.category),
      title: clause.title || clause.name || null,
    };
  });

  return {
    document_type: documentType,
    jurisdiction: "India",
    clauses,
    metadata: {
      blueprint_clause_count: clauseIds.length,
      loaded_clause_count: clauses.length,
      missing_clauses: [],
    },
  };
}

export function getKnowledgeBaseStats() {
  return getKnowledgeBaseCache().stats;
}

export function getClauseById(clauseId) {
  if (!clauseId) return null;
  return getKnowledgeBaseCache().clausesById.get(clauseId) || null;
}

export function clearClauseCache() {
  knowledgeBaseCache = null;
}
