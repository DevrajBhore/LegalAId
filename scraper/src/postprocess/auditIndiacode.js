import fs from "fs/promises";
import path from "path";
import { getSubordinateDirectoryMetadata } from "../../../shared/subordinateDirectory.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../..");

const KB = path.join(projectRoot, "knowledge-base");
const ACTS = path.join(KB, "acts");
const SUB = path.join(KB, "subordinate");

async function audit() {
  const actFiles = (await fs.readdir(ACTS)).filter(f => f.endsWith(".json"));

  let withSub = 0;
  let withoutSub = 0;
  let possibleOrInconclusive = 0;
  let missingIndex = 0;
  let countMismatch = 0;
  let duplicateSourceActs = 0;
  let duplicateSourceRows = 0;
  let actsWithFailedCandidates = 0;
  let totalFailedCandidates = 0;
  let recoveredFromAlternateSource = 0;
  let filesWithRecoveryAttempts = 0;
  const detectionVersions = {};

    for (const f of actFiles) {
      const actId = f.replace(".json", "");
      const { directoryKey } = getSubordinateDirectoryMetadata(actId);
      const indexPath = path.join(SUB, directoryKey, "index.json");
      const actDir = path.join(SUB, directoryKey);

    try {
      const raw = await fs.readFile(indexPath, "utf-8");
      const idx = JSON.parse(raw);
      const version = String(idx.detection_version ?? "unknown");
      detectionVersions[version] = (detectionVersions[version] || 0) + 1;
      const failedCandidateCount = Array.isArray(idx.failed_candidates)
        ? idx.failed_candidates.length
        : 0;
      if (failedCandidateCount > 0) {
        actsWithFailedCandidates++;
        totalFailedCandidates += failedCandidateCount;
      }

      let subordinateFiles = [];
      try {
        subordinateFiles = (await fs.readdir(actDir)).filter(
          (file) => file.endsWith(".json") && file !== "index.json"
        );
      } catch {
        subordinateFiles = [];
      }

      if (Number(idx.count || 0) !== subordinateFiles.length) {
        countMismatch++;
      }

      const seenSourceKeys = new Set();
      let actDuplicateRows = 0;
      for (const file of subordinateFiles) {
        try {
          const subordinateRaw = await fs.readFile(path.join(actDir, file), "utf-8");
          const subordinate = JSON.parse(subordinateRaw);
          const sourceKey = `${String(subordinate.type || "").toLowerCase()}::${String(
            subordinate.source_url || ""
          ).trim().toLowerCase()}`;
          if (sourceKey === "::") continue;
          if (seenSourceKeys.has(sourceKey)) {
            actDuplicateRows++;
            continue;
          }
          seenSourceKeys.add(sourceKey);

          const extraction = subordinate.extraction || {};
          if (Array.isArray(extraction.recovery_attempts) && extraction.recovery_attempts.length > 0) {
            filesWithRecoveryAttempts++;
          }
          if (extraction.recovered_from_alternate_source === true) {
            recoveredFromAlternateSource++;
          }
        } catch {
          // ignore malformed subordinate files in diagnostics
        }
      }

      if (actDuplicateRows > 0) {
        duplicateSourceActs++;
        duplicateSourceRows += actDuplicateRows;
      }

      if (idx.has_subordinate_legislation) {
        withSub++;
      } else if (idx.possible_subordinate_legislation) {
        possibleOrInconclusive++;
      } else {
        withoutSub++;
      }
    } catch {
      missingIndex++;
    }
  }

  const report = {
    total_acts: actFiles.length,
    acts_with_subordinate: withSub,
    acts_without_subordinate: withoutSub,
    acts_with_possible_or_inconclusive_subordinate: possibleOrInconclusive,
    missing_index_files: missingIndex,
    count_mismatch_acts: countMismatch,
    acts_with_duplicate_source_entries: duplicateSourceActs,
    duplicate_source_rows: duplicateSourceRows,
    acts_with_failed_candidates: actsWithFailedCandidates,
    total_failed_candidates: totalFailedCandidates,
    subordinate_files_with_recovery_attempts: filesWithRecoveryAttempts,
    subordinate_files_recovered_from_alternate_source: recoveredFromAlternateSource,
    detection_versions: detectionVersions,
    audited_at: new Date().toISOString(),
    scope: "IndiaCode only"
  };

  await fs.mkdir(path.join(KB, "diagnostics"), { recursive: true });
  await fs.writeFile(
    path.join(KB, "diagnostics", "indiacode_coverage.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(report);
}

audit();
