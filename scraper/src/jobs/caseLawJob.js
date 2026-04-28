import { runModuleGroupJob } from "./moduleGroupJob.js";

const CASE_LAW_MODULES = [
  {
    key: "indiankanoon",
    relativePath: "../scrapers/caseLaws/kanoonScraper.js",
    exportNames: ["runIndianKanoonScraper", "scrapeIndianKanoon"],
  },
  {
    key: "judis",
    relativePath: "../scrapers/caseLaws/judisScraper.js",
    exportNames: ["runJudisScraper", "scrapeJudis"],
  },
];

export async function runCaseLawJob({ providers = [] } = {}) {
  return runModuleGroupJob({
    label: "Case Law Sources",
    modules: CASE_LAW_MODULES,
    selected: providers,
  });
}
