import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const currentKbRoot = path.join(repoRoot, "knowledge-base");
const v3KbRoot = path.join(repoRoot, "tmp", "kb_v3_compare", "kb_upgraded");
const baselineKbRoot = path.join(repoRoot, "tmp", "kb_head_snapshot", "knowledge-base");
const PASSIVE_CLAUSE_KEYS = [
  "name",
  "legal_basis",
  "source",
  "version",
  "depends_on",
  "conflicts_with",
  "required_with",
  "suggested_with",
  "jurisdiction_constraints",
  "litigation_risk",
  "drafting_strength",
  "dispute_hotspots",
  "blocks_generation_if_absent",
  "tds_applicable",
  "gst_applicable",
  "msme_sensitive",
];

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`${label} not found at: ${targetPath}`);
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function listJsonFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files;
}

function contentEquals(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function extractPlaceholders(text = "") {
  const matches = String(text).match(/{{\s*[^}]+\s*}}|\[[A-Z0-9_]+\]/g) || [];
  return [...new Set(matches)];
}

function hasExternalScheduleReference(text = "") {
  const normalized = String(text || "");
  return (
    /\b(?:specified|set out|described|contained|included|recorded)\s+in\s+(?:the\s+)?(?:schedule|annexure|appendix)\s*[a-z0-9-]*\b/i.test(
      normalized
    ) ||
    /\b(?:schedule|annexure|appendix)\s+(?:[0-9]+|[A-Z]|[IVXLCM]+)\b/.test(
      normalized
    )
  );
}

function buildClauseMap(clauseLibraryRoot) {
  const files = listJsonFiles(clauseLibraryRoot);
  const clausesById = new Map();

  for (const filePath of files) {
    const relativePath = path.relative(clauseLibraryRoot, filePath);
    if (
      relativePath === "base_clause.schema.json" ||
      relativePath === "clause_definitions.json" ||
      relativePath.startsWith(`blueprints${path.sep}`)
    ) {
      continue;
    }

    const clause = readJson(filePath);
    if (!clause?.clause_id) {
      continue;
    }

    clausesById.set(clause.clause_id, {
      filePath,
      relativePath,
      clause,
    });
  }

  return clausesById;
}

function readBaselineJson(...relativeSegments) {
  const filePath = path.join(baselineKbRoot, ...relativeSegments);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function mergeClauses(summary) {
  const currentClauseRoot = path.join(currentKbRoot, "clause_library");
  const v3ClauseRoot = path.join(v3KbRoot, "clause_library");

  const currentClausesById = buildClauseMap(currentClauseRoot);
  const v3ClausesById = buildClauseMap(v3ClauseRoot);

  for (const [clauseId, v3Entry] of v3ClausesById.entries()) {
    const currentEntry = currentClausesById.get(clauseId);

    if (currentEntry) {
      const baselineClause =
        readBaselineJson(
          "clause_library",
          ...currentEntry.relativePath.split(path.sep)
        ) || currentEntry.clause;
      const mergedClause = {
        ...baselineClause,
      };

      for (const key of PASSIVE_CLAUSE_KEYS) {
        if (key in v3Entry.clause) {
          mergedClause[key] = v3Entry.clause[key];
        }
      }

      if (
        extractPlaceholders(v3Entry.clause.text || "").length > 0 ||
        hasExternalScheduleReference(v3Entry.clause.text || "")
      ) {
        summary.clauses.textPreserved += 1;
      }

      if (!contentEquals(currentEntry.clause, mergedClause)) {
        writeJson(currentEntry.filePath, mergedClause);
        summary.clauses.updated += 1;
      }
      continue;
    }

    const targetPath = path.join(currentClauseRoot, v3Entry.relativePath);
    writeJson(targetPath, v3Entry.clause);
    summary.clauses.added += 1;
  }
}

function mergeBlueprints(summary) {
  const currentBlueprintRoot = path.join(
    currentKbRoot,
    "clause_library",
    "blueprints"
  );
  const v3BlueprintRoot = path.join(v3KbRoot, "clause_library", "blueprints");

  const currentFiles = listJsonFiles(currentBlueprintRoot);
  const v3Files = listJsonFiles(v3BlueprintRoot);
  const v3ByDocumentType = new Map();

  for (const filePath of v3Files) {
    const blueprint = readJson(filePath);
    if (blueprint?.document_type) {
      v3ByDocumentType.set(blueprint.document_type, blueprint);
    }
  }

  for (const filePath of currentFiles) {
    const currentBlueprint = readJson(filePath);
    const v3Blueprint = v3ByDocumentType.get(currentBlueprint.document_type);
    const baselineBlueprint =
      readBaselineJson("clause_library", "blueprints", path.basename(filePath)) ||
      currentBlueprint;

    if (!v3Blueprint) {
      continue;
    }

    const mergedBlueprint = {
      ...baselineBlueprint,
      document_type:
        baselineBlueprint.document_type || v3Blueprint.document_type,
      family: baselineBlueprint.family || v3Blueprint.family,
      clauses: baselineBlueprint.clauses || [],
      required_clauses: baselineBlueprint.clauses || [],
    };

    for (const key of [
      "version",
      "_notes",
      "conditional_clauses",
      "removed_from_v2",
      "mandatory_legal_checks",
    ]) {
      if (key in v3Blueprint) {
        mergedBlueprint[key] = v3Blueprint[key];
      }
    }

    if (!contentEquals(currentBlueprint, mergedBlueprint)) {
      writeJson(filePath, mergedBlueprint);
      summary.blueprints.enriched += 1;
    }
  }
}

function copyDirectoryJsonFiles(sourceDir, targetDir, counter) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  for (const filePath of listJsonFiles(sourceDir)) {
    const relativePath = path.relative(sourceDir, filePath);
    const targetPath = path.join(targetDir, relativePath);
    const sourceJson = readJson(filePath);
    const targetJson = fs.existsSync(targetPath) ? readJson(targetPath) : null;

    if (!targetJson || !contentEquals(sourceJson, targetJson)) {
      writeJson(targetPath, sourceJson);
      counter.count += 1;
    }
  }
}

function mergeConstraints(summary) {
  const sourceDir = path.join(baselineKbRoot, "constraints");
  const targetDir = path.join(currentKbRoot, "constraints");
  const counter = { count: 0 };
  copyDirectoryJsonFiles(sourceDir, targetDir, counter);
  summary.constraints.runtimePreserved = counter.count;
}

function mergeDomainActRules(summary) {
  const currentFile = path.join(currentKbRoot, "rules", "domain_acts.rules.json");
  const v3File = path.join(v3KbRoot, "rules", "domain_acts.rules.json");

  const currentData = readJson(currentFile);
  const v3Data = readJson(v3File);
  const merged = {
    ...currentData,
    ...v3Data,
    domain_act_map: {
      ...(currentData.domain_act_map || {}),
      ...(v3Data.domain_act_map || {}),
    },
  };

  if (!contentEquals(currentData, merged)) {
    writeJson(currentFile, merged);
    summary.rules.domainActsUpdated = true;
  }
}

function mergeIllegalClauseRules(summary) {
  const currentFile = path.join(
    currentKbRoot,
    "rules",
    "illegal_clauses.rules.json"
  );
  const baselineFile = path.join(
    baselineKbRoot,
    "rules",
    "illegal_clauses.rules.json"
  );

  const currentData = readJson(currentFile);
  const baselineData = readJson(baselineFile);

  if (!contentEquals(currentData, baselineData)) {
    writeJson(currentFile, baselineData);
    summary.rules.illegalClausesRestored = true;
    summary.rules.illegalClauseCount = (baselineData.rules || []).length;
  }
}

function mergeAdditionalRules(summary) {
  const sourceFile = path.join(
    v3KbRoot,
    "rules",
    "indian_law_enforcement.rules.json"
  );
  const targetFile = path.join(
    currentKbRoot,
    "rules",
    "indian_law_enforcement.rules.json"
  );

  if (fs.existsSync(sourceFile)) {
    const sourceJson = readJson(sourceFile);
    const targetJson = fs.existsSync(targetFile) ? readJson(targetFile) : null;
    if (!targetJson || !contentEquals(sourceJson, targetJson)) {
      writeJson(targetFile, sourceJson);
      summary.rules.additionalFilesAdded += 1;
    }
  }
}

function mergeInteractionEngine(summary) {
  const sourceDir = path.join(v3KbRoot, "interaction_engine");
  const targetDir = path.join(currentKbRoot, "interaction_engine");
  const counter = { count: 0 };
  copyDirectoryJsonFiles(sourceDir, targetDir, counter);
  summary.interactionEngine.updated = counter.count;
}

function main() {
  assertExists(currentKbRoot, "Current knowledge-base");
  assertExists(v3KbRoot, "Extracted v3 knowledge-base");
  assertExists(baselineKbRoot, "Baseline knowledge-base snapshot");

  const summary = {
    clauses: { updated: 0, added: 0, textPreserved: 0 },
    blueprints: { enriched: 0 },
    constraints: { runtimePreserved: 0 },
    rules: {
      domainActsUpdated: false,
      illegalClausesRestored: false,
      illegalClauseCount: 0,
      additionalFilesAdded: 0,
    },
    interactionEngine: { updated: 0 },
  };

  mergeClauses(summary);
  mergeBlueprints(summary);
  mergeConstraints(summary);
  mergeDomainActRules(summary);
  mergeIllegalClauseRules(summary);
  mergeAdditionalRules(summary);
  mergeInteractionEngine(summary);

  console.log("Knowledge-base v3 merge complete.");
  console.log(JSON.stringify(summary, null, 2));
}

main();
