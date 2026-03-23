import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, "../../..");
const ACTS_DIR = path.join(projectRoot, "knowledge-base", "acts");

const STATE_KEYWORDS = [
  "bombay",
  "madras",
  "bengal",
  "punjab",
  "oudh",
  "assam",
  "bihar",
  "orissa",
  "hyderabad",
  "provincial",
  "state of"
];

function isStateAct(act) {
  const haystack = (
    (act.title || "") +
    " " +
    (act.full_text || "") +
    " " +
    JSON.stringify(act.metadata || {})
  ).toLowerCase();

  return STATE_KEYWORDS.some(k => haystack.includes(k));
}

export async function classifyActs() {
  console.log("🏷 Starting Act classification");

  // Safety check
  try {
    await fs.access(ACTS_DIR);
  } catch {
    throw new Error(`Acts directory not found: ${ACTS_DIR}`);
  }

  const files = await fs.readdir(ACTS_DIR);
  let stateCount = 0;
  let centralCount = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(ACTS_DIR, file);
    const raw = await fs.readFile(filePath, "utf-8");
    const act = JSON.parse(raw);

    // Idempotency
    if (act.jurisdiction) continue;

    if (isStateAct(act)) {
      act.jurisdiction = "state";
      act.state = "as_per_indiacode";
      stateCount++;
    } else {
      act.jurisdiction = "central";
      centralCount++;
    }

    await fs.writeFile(filePath, JSON.stringify(act, null, 2));
  }

  console.log("✅ Classification completed");
  console.log(`🏛 State Acts: ${stateCount}`);
  console.log(`🏢 Central Acts: ${centralCount}`);
}
