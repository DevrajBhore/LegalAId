import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runForOneAct } from "./scrapers/indiaCode/subordinateScraper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTS_DIR = path.join(__dirname, "../../knowledge-base/acts");

const actFiles = fs.readdirSync(ACTS_DIR).filter(f => f.endsWith(".json"));
if (!actFiles.length) throw new Error("No acts found");

const actFile = actFiles[0];
const act = JSON.parse(
  fs.readFileSync(path.join(ACTS_DIR, actFile), "utf8")
);

console.log(`Using act file: ${actFile}`);
await runForOneAct(act, actFile);
