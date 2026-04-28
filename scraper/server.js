import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { getOrchestratorConfig, runOrchestrator } from "./src/orchestrator.js";
import { createKnowledgeBaseSnapshot } from "./src/storage/backupStorage.js";
import { getStorageStats, kbRoot, resetStorageStats } from "./src/storage/fileStorage.js";
import { getRequestTuning } from "./src/common/request.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("[Scraper] LegalAId scraper server starting...");
console.log("[Scraper] Working directory:", __dirname);

const logsDir = path.join(__dirname, "src", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log("[Scraper] Created logs directory.");
}

function shouldCreateSnapshot() {
  return String(process.env.SCRAPER_CREATE_SNAPSHOT || "false").toLowerCase() === "true";
}

(async () => {
  try {
    const config = getOrchestratorConfig();
    resetStorageStats();
    console.log(
      "[Scraper] Effective groups:",
      config.groups.length > 0 ? config.groups.join(", ") : "none"
    );
    console.log(
      "[Scraper] Effective targets:",
      config.requested.length > 0
        ? config.requested.join(", ")
        : config.subTargets["india-code"].join(", ")
    );
    console.log(
      "[Scraper] Request tuning:",
      JSON.stringify(getRequestTuning())
    );

    const snapshotPath = shouldCreateSnapshot()
      ? createKnowledgeBaseSnapshot({
          sourceDir: kbRoot,
          label: config.requested.length > 0 ? config.requested.join("_") : "central-acts",
        })
      : null;

    const summary = await runOrchestrator();
    const storage = getStorageStats();
    console.log("[Scraper] Scraper finished successfully.");
    console.log(
      "[Scraper] Summary:",
      JSON.stringify(
        {
          ...summary,
          snapshotPath,
          storage,
        },
        null,
        2
      )
    );

    if (summary.totals.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("[Scraper] Scraper crashed:", error);
    process.exitCode = 1;
  }
})();
