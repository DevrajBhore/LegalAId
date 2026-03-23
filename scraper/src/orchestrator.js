import { runCentralActs } from "./scrapers/indiaCode/actsAdapter.js";
import { scrapeStateActs } from "./scrapers/indiaCode/stateActsScraper.js";
import { runSubordinateScraper } from "./scrapers/indiaCode/subordinateScraper.js";

const RUN_CENTRAL_ACTS = true;
const RUN_STATE_ACTS = false;
const RUN_SUBORDINATE = false;

export async function runOrchestrator() {
  console.log("🚦 Orchestrator started");

  if (RUN_CENTRAL_ACTS) {
    await runCentralActs({ rpp: 100, concurrency: 4 });
  } else {
    console.log("⏭ Central Acts already scraped — skipping");
  }

  if (RUN_STATE_ACTS) {
    await scrapeStateActs();
  }

  if (RUN_SUBORDINATE) {
    await runSubordinateScraper();
  }

  console.log("✅ Orchestrator completed");
}
