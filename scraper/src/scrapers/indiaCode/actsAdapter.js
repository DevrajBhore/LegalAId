import { runActsScraper } from "./actsScraper.js";

/**
 * Adapter layer
 * - Keeps legacy scraper intact
 * - Gives orchestrator a stable entrypoint
 */
export async function runCentralActs(opts = {}) {
  console.log("▶ Running Central Acts Adapter");
  return runActsScraper(opts);
}
