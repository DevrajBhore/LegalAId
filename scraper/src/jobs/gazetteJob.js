import { runModuleGroupJob } from "./moduleGroupJob.js";

const GAZETTE_MODULES = [
  {
    key: "egazette-index",
    relativePath: "../scrapers/egazette/index.js",
    exportNames: ["runEGazetteScraper", "runEgazetteScraper", "scrapeEGazette"],
  },
  {
    key: "egazette-notifications",
    relativePath: "../scrapers/egazette/notificationScraper.js",
    exportNames: ["runNotificationScraper", "scrapeNotifications"],
  },
  {
    key: "egazette-pdf",
    relativePath: "../scrapers/egazette/pdfExtractor.js",
    exportNames: ["runPdfExtractor", "extractGazettePdf"],
  },
];

export async function runGazetteJob({ modules = [] } = {}) {
  return runModuleGroupJob({
    label: "Gazette Sources",
    modules: GAZETTE_MODULES,
    selected: modules,
  });
}
