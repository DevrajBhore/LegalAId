import { runModuleGroupJob } from "./moduleGroupJob.js";

const TEMPLATE_MODULES = [
  {
    key: "gem",
    relativePath: "../scrapers/templates/gemScraper.js",
    exportNames: ["runGemScraper", "scrapeGemTemplates"],
  },
  {
    key: "msme",
    relativePath: "../scrapers/templates/msmeScraper.js",
    exportNames: ["runMsmeScraper", "scrapeMsmeTemplates"],
  },
  {
    key: "startup-india",
    relativePath: "../scrapers/templates/startupIndiaScraper.js",
    exportNames: ["runStartupIndiaScraper", "scrapeStartupIndiaTemplates"],
  },
];

export async function runTemplateJob({ providers = [] } = {}) {
  return runModuleGroupJob({
    label: "Template Sources",
    modules: TEMPLATE_MODULES,
    selected: providers,
  });
}
