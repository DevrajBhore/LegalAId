import { runModuleGroupJob } from "./moduleGroupJob.js";

const REGULATORY_MODULES = [
  {
    key: "rbi",
    relativePath: "../scrapers/regulatory/rbiScraper.js",
    exportNames: ["runRbiScraper", "scrapeRbiCirculars"],
  },
  {
    key: "sebi",
    relativePath: "../scrapers/regulatory/sebiScraper.js",
    exportNames: ["runSebiScraper", "scrapeSebiCirculars"],
  },
  {
    key: "irdai",
    relativePath: "../scrapers/regulatory/irdaiScraper.js",
    exportNames: ["runIrdaiScraper", "scrapeIrdaiCirculars"],
  },
  {
    key: "mca",
    relativePath: "../scrapers/regulatory/mcaScraper.js",
    exportNames: ["runMcaScraper", "scrapeMcaCirculars"],
  },
  {
    key: "dpiit",
    relativePath: "../scrapers/regulatory/dpiitScraper.js",
    exportNames: ["runDpiitScraper", "scrapeDpiitNotifications"],
  },
];

export async function runRegulatoryJob({ providers = [] } = {}) {
  return runModuleGroupJob({
    label: "Regulatory Circulars",
    modules: REGULATORY_MODULES,
    selected: providers,
  });
}
