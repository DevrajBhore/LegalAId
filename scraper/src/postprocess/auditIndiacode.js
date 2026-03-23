import fs from "fs/promises";
import path from "path";
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
  let missingIndex = 0;

  for (const f of actFiles) {
    const actId = f.replace(".json", "");
    const indexPath = path.join(SUB, actId, "index.json");

    try {
      const raw = await fs.readFile(indexPath, "utf-8");
      const idx = JSON.parse(raw);
      if (idx.has_subordinate_legislation) withSub++;
      else withoutSub++;
    } catch {
      missingIndex++;
    }
  }

  const report = {
    total_acts: actFiles.length,
    acts_with_subordinate: withSub,
    acts_without_subordinate: withoutSub,
    missing_index_files: missingIndex,
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
