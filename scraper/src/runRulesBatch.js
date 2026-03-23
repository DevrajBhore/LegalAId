import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Bottleneck from "bottleneck";
import { runForOneAct } from "./scrapers/indiaCode/subordinateScraper.js";

/* -------------------- ESM dirname -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------- PATHS -------------------- */
const ACTS_DIR = path.join(__dirname, "../../knowledge-base/acts");
const RULES_DIR = path.join(__dirname, "../../knowledge-base/rules");
const LOG_DIR = path.join(__dirname, "logs");

const PROGRESS_FILE = path.join(LOG_DIR, "rules_batch_progress.json");
const ERROR_LOG = path.join(LOG_DIR, "rules_batch_errors.log");

/* -------------------- LIMITER -------------------- */
/*
  IndiaCode is sensitive.
  This setting is conservative and safe.
*/
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2500, // ~1 request every 2.5 seconds
});

/* -------------------- HELPERS -------------------- */

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    return { completed: [] };
  }
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
}

function saveProgress(progress) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function logError(actFile, error) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(
    ERROR_LOG,
    `[${new Date().toISOString()}] ${actFile}\n${error.stack || error}\n\n`
  );
}

function slugFromActFile(actFile) {
  return actFile
    .replace(/__\d+\.json$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/* -------------------- MAIN -------------------- */

async function runBatch() {
  const progress = loadProgress();

  const actFiles = fs
    .readdirSync(ACTS_DIR)
    .filter(f => f.endsWith(".json"))
    .sort();

  console.log(`📚 Total acts found: ${actFiles.length}`);
  console.log(`✅ Already completed: ${progress.completed.length}`);

  for (const actFile of actFiles) {
    if (progress.completed.includes(actFile)) {
      continue;
    }

    const actPath = path.join(ACTS_DIR, actFile);
    const act = JSON.parse(fs.readFileSync(actPath, "utf-8"));

    console.log(`\nProcessing: ${actFile}`);

    try {
      await limiter.schedule(() =>
        runForOneAct(act, actFile)
      );

      progress.completed.push(actFile);
      saveProgress(progress);

      console.log(`✔ Finished: ${actFile}`);
    } catch (err) {
      console.error(`❌ Failed: ${actFile}`);
      logError(actFile, err);

      /*
        IMPORTANT:
        We still mark it as completed so batch does not stall.
        Failure is auditable via logs.
      */
      progress.completed.push(actFile);
      saveProgress(progress);
    }
  }

  console.log("\nBatch completed successfully");
}

await runBatch();
