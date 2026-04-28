import { runModuleGroupJob } from "./moduleGroupJob.js";

const RERA_MODULES = [
  {
    key: "maharera",
    relativePath: "../scrapers/rera/mahaReraScraper.js",
    exportNames: ["runMahaReraScraper", "scrapeMahaRera"],
  },
  {
    key: "delhi-rera",
    relativePath: "../scrapers/rera/delhiReraScraper.js",
    exportNames: ["runDelhiReraScraper", "scrapeDelhiRera"],
  },
  {
    key: "karnataka-rera",
    relativePath: "../scrapers/rera/kaReraScraper.js",
    exportNames: ["runKarnatakaReraScraper", "scrapeKarnatakaRera"],
  },
];

export async function runReraJob({ states = [] } = {}) {
  return runModuleGroupJob({
    label: "RERA Sources",
    modules: RERA_MODULES,
    selected: states,
  });
}
