import { runCentralActs } from "../scrapers/indiaCode/actsAdapter.js";
import { scrapeStateActs } from "../scrapers/indiaCode/stateActsScraper.js";
import { runSubordinateScraper } from "../scrapers/indiaCode/subordinateScraper.js";

function normalizeTargets(targets = []) {
  return new Set((targets || []).map((target) => String(target).trim()).filter(Boolean));
}

export async function runSyncActsJob({
  targets = [],
  actsOptions = {},
} = {}) {
  const selected = normalizeTargets(targets);
  const runEverything = selected.size === 0;
  const summary = {
    label: "India Code Sync",
    completed: [],
    skipped: [],
    failed: [],
  };

  const jobs = [
    {
      key: "central-acts",
      run: () => runCentralActs(actsOptions),
    },
    {
      key: "state-acts",
      run: () => scrapeStateActs(),
    },
    {
      key: "subordinate",
      run: () => runSubordinateScraper(actsOptions),
    },
  ];

  console.log("\n[Scraper] Starting India Code sync job...");

  for (const job of jobs) {
    if (!runEverything && !selected.has(job.key)) {
      summary.skipped.push({
        key: job.key,
        reason: "not selected",
      });
      continue;
    }

    try {
      console.log(`[Scraper] Running ${job.key}...`);
      await job.run();
      summary.completed.push(job.key);
    } catch (error) {
      console.error(`[Scraper] ${job.key} failed:`, error?.message || error);
      summary.failed.push({
        key: job.key,
        error: error?.message || String(error),
      });
    }
  }

  console.log(
    `[Scraper] India Code sync complete: ${summary.completed.length} completed, ${summary.skipped.length} skipped, ${summary.failed.length} failed`
  );

  return summary;
}
