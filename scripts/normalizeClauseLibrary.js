import fs from "fs";
import path from "path";

const WORKSPACE_ROOT = path.resolve("D:/dev/LegalAId - Copy");
const CLAUSE_LIBRARY_ROOT = path.join(WORKSPACE_ROOT, "knowledge-base", "clause_library");
const BLUEPRINT_ROOT = path.join(CLAUSE_LIBRARY_ROOT, "blueprints");

const CLAUSE_FOLDERS = ["core", "commercial", "employment", "finance", "property"];
const CATEGORY_FALLBACK = "MISC";
const SOURCE_FALLBACK = "LegalAId Knowledge Base";
const VERSION_FALLBACK = "1.0.0";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function formatFallbackName(value = "") {
  return value
    .replace(/_/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function toDocumentType(fileName) {
  return fileName
    .replace(/\.bluepe?int\.json$/i, "")
    .replace(/\.blueprint\.json$/i, "")
    .replace(/-/g, "_")
    .toUpperCase();
}

function normalizeSection(section) {
  if (section === undefined || section === null) return "";
  return String(section).replace(/^section\s*/i, "").trim();
}

function deriveLegalBasis(clause) {
  if (Array.isArray(clause.legal_basis)) {
    return clause.legal_basis
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => ({
        act: typeof entry.act === "string" ? entry.act.trim() : "",
        section: normalizeSection(entry.section),
      }))
      .filter((entry) => entry.act);
  }

  return [];
}

function collectBlueprintReferences() {
  const references = new Map();
  const blueprints = fs.existsSync(BLUEPRINT_ROOT)
    ? fs.readdirSync(BLUEPRINT_ROOT).filter((file) => file.endsWith(".json"))
    : [];

  for (const fileName of blueprints) {
    const blueprint = readJson(path.join(BLUEPRINT_ROOT, fileName));
    const clauseIds = Array.isArray(blueprint.required_clauses)
      ? blueprint.required_clauses
      : Array.isArray(blueprint.clauses)
        ? blueprint.clauses
        : [];
    const documentType = toDocumentType(fileName);

    for (const clauseId of clauseIds) {
      if (!references.has(clauseId)) {
        references.set(clauseId, new Set());
      }
      references.get(clauseId).add(documentType);
    }
  }

  return references;
}

function normalizeClause(filePath, blueprintReferences) {
  const clause = readJson(filePath);
  const nextClause = { ...clause };

  nextClause.category =
    typeof nextClause.category === "string" && nextClause.category.trim()
      ? nextClause.category.trim().toUpperCase()
      : CATEGORY_FALLBACK;

  const derivedName =
    typeof nextClause.name === "string" && nextClause.name.trim()
      ? nextClause.name.trim()
      : typeof nextClause.title === "string" && nextClause.title.trim()
        ? nextClause.title.trim()
        : formatFallbackName(nextClause.clause_id || path.basename(filePath, ".json"));
  nextClause.name = derivedName;

  if (
    typeof nextClause.title !== "string" ||
    !nextClause.title.trim()
  ) {
    nextClause.title = derivedName;
  }

  if (!Array.isArray(nextClause.document_types) || nextClause.document_types.length === 0) {
    const documentTypes = Array.from(
      blueprintReferences.get(nextClause.clause_id) || []
    ).sort();
    nextClause.document_types = documentTypes;
  } else {
    nextClause.document_types = nextClause.document_types
      .map((entry) => String(entry).trim().toUpperCase())
      .filter(Boolean);
  }

  nextClause.legal_basis = deriveLegalBasis(nextClause);
  nextClause.invalid_if = Array.isArray(nextClause.invalid_if)
    ? nextClause.invalid_if.map((entry) => String(entry).trim()).filter(Boolean)
    : [];

  if (typeof nextClause.mandatory !== "boolean") {
    nextClause.mandatory = Boolean(nextClause.mandatory);
  }

  if (!["HIGH", "MEDIUM", "LOW"].includes(nextClause.enforceability)) {
    nextClause.enforceability = nextClause.mandatory ? "HIGH" : "MEDIUM";
  }

  if (!["LOW", "MEDIUM", "HIGH"].includes(nextClause.risk_level)) {
    nextClause.risk_level = nextClause.mandatory ? "MEDIUM" : "LOW";
  }

  if (typeof nextClause.source !== "string" || !nextClause.source.trim()) {
    nextClause.source = SOURCE_FALLBACK;
  } else {
    nextClause.source = nextClause.source.trim();
  }

  if (typeof nextClause.version !== "string" || !nextClause.version.trim()) {
    nextClause.version = VERSION_FALLBACK;
  } else {
    nextClause.version = nextClause.version.trim();
  }

  const before = `${JSON.stringify(clause, null, 2)}\n`;
  const after = `${JSON.stringify(nextClause, null, 2)}\n`;
  if (before !== after) {
    writeJson(filePath, nextClause);
    return true;
  }

  return false;
}

function main() {
  const blueprintReferences = collectBlueprintReferences();
  const changedFiles = [];

  for (const folder of CLAUSE_FOLDERS) {
    const dir = path.join(CLAUSE_LIBRARY_ROOT, folder);
    if (!fs.existsSync(dir)) continue;

    for (const fileName of fs.readdirSync(dir)) {
      if (!fileName.endsWith(".json")) continue;
      const filePath = path.join(dir, fileName);
      if (normalizeClause(filePath, blueprintReferences)) {
        changedFiles.push(path.relative(WORKSPACE_ROOT, filePath));
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        changedCount: changedFiles.length,
        changedFiles,
      },
      null,
      2
    )
  );
}

main();
