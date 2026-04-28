import { runCaseLawJob } from "./jobs/caseLawJob.js";
import { runGazetteJob } from "./jobs/gazetteJob.js";
import { runRegulatoryJob } from "./jobs/regulatoryJob.js";
import { runReraJob } from "./jobs/reraJob.js";
import { runSyncActsJob } from "./jobs/syncActsJob.js";
import { runTemplateJob } from "./jobs/templateJob.js";

const GROUP_ALIASES = {
  "india-code": "india-code",
  indiancode: "india-code",
  acts: "india-code",
  regulatory: "regulatory",
  gazette: "gazette",
  egazette: "gazette",
  "case-law": "case-law",
  caselaw: "case-law",
  caselaws: "case-law",
  rera: "rera",
  templates: "templates",
};

const TARGET_GROUPS = {
  "central-acts": "india-code",
  "state-acts": "india-code",
  subordinate: "india-code",
  rbi: "regulatory",
  sebi: "regulatory",
  irdai: "regulatory",
  mca: "regulatory",
  dpiit: "regulatory",
  "egazette-index": "gazette",
  "egazette-notifications": "gazette",
  "egazette-pdf": "gazette",
  indiankanoon: "case-law",
  judis: "case-law",
  maharera: "rera",
  "delhi-rera": "rera",
  "karnataka-rera": "rera",
  gem: "templates",
  msme: "templates",
  "startup-india": "templates",
};

function parseCsv(input) {
  return String(input || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function buildActsOptions() {
  const options = {
    rpp: parseOptionalInteger(process.env.SCRAPER_RPP) ?? 100,
    concurrency: parseOptionalInteger(process.env.SCRAPER_CONCURRENCY) ?? 4,
    politeDelayMs:
      parseOptionalInteger(process.env.SCRAPER_POLITE_DELAY_MS) ?? 800,
  };

  const maxPages = parseOptionalInteger(process.env.SCRAPER_MAX_PAGES);
  if (maxPages !== undefined) {
    options.maxPages = maxPages;
  }

  return options;
}

function buildRunConfiguration() {
  const requested = parseCsv(process.env.SCRAPER_TARGETS);
  const runAll = requested.includes("all");
  const normalizedGroups = new Set();
  const subTargets = {
    "india-code": [],
    regulatory: [],
    gazette: [],
    "case-law": [],
    rera: [],
    templates: [],
  };

  if (requested.length === 0) {
    subTargets["india-code"].push("central-acts");
    return {
      runAll,
      requested,
      groups: ["india-code"],
      subTargets,
      actsOptions: buildActsOptions(),
    };
  }

  if (runAll) {
    return {
      runAll,
      requested,
      groups: [
        "india-code",
        "regulatory",
        "gazette",
        "case-law",
        "rera",
        "templates",
      ],
      subTargets,
      actsOptions: buildActsOptions(),
    };
  }

  for (const token of requested) {
    const groupKey = GROUP_ALIASES[token];
    if (groupKey) {
      normalizedGroups.add(groupKey);
      continue;
    }

    const mappedGroup = TARGET_GROUPS[token];
    if (mappedGroup) {
      normalizedGroups.add(mappedGroup);
      subTargets[mappedGroup].push(token);
      continue;
    }

    console.log(`[Scraper] Ignoring unknown target token: ${token}`);
  }

  return {
    runAll,
    requested,
    groups: [...normalizedGroups],
    subTargets,
    actsOptions: buildActsOptions(),
  };
}

function createAggregateSummary(config) {
  return {
    requested: config.requested,
    effectiveTargets:
      config.requested.length > 0
        ? config.requested
        : config.subTargets["india-code"],
    groups: config.groups,
    actsOptions: config.actsOptions,
    jobs: [],
    totals: {
      completed: 0,
      skipped: 0,
      failed: 0,
    },
  };
}

function includeCounts(summary, jobSummary) {
  summary.jobs.push(jobSummary);
  summary.totals.completed += jobSummary.completed.length;
  summary.totals.skipped += jobSummary.skipped.length;
  summary.totals.failed += jobSummary.failed.length;
}

export function getOrchestratorConfig() {
  return buildRunConfiguration();
}

export async function runOrchestrator() {
  const config = buildRunConfiguration();
  const summary = createAggregateSummary(config);

  console.log("[Scraper] Orchestrator started");
  console.log(
    `[Scraper] Requested targets: ${
      config.requested.length > 0 ? config.requested.join(", ") : "default"
    }`
  );

  if (config.groups.includes("india-code")) {
    includeCounts(
      summary,
      await runSyncActsJob({
        targets: config.runAll ? [] : config.subTargets["india-code"],
        actsOptions: config.actsOptions,
      })
    );
  }

  if (config.groups.includes("regulatory")) {
    includeCounts(
      summary,
      await runRegulatoryJob({
        providers: config.runAll ? [] : config.subTargets.regulatory,
      })
    );
  }

  if (config.groups.includes("gazette")) {
    includeCounts(
      summary,
      await runGazetteJob({
        modules: config.runAll ? [] : config.subTargets.gazette,
      })
    );
  }

  if (config.groups.includes("case-law")) {
    includeCounts(
      summary,
      await runCaseLawJob({
        providers: config.runAll ? [] : config.subTargets["case-law"],
      })
    );
  }

  if (config.groups.includes("rera")) {
    includeCounts(
      summary,
      await runReraJob({
        states: config.runAll ? [] : config.subTargets.rera,
      })
    );
  }

  if (config.groups.includes("templates")) {
    includeCounts(
      summary,
      await runTemplateJob({
        providers: config.runAll ? [] : config.subTargets.templates,
      })
    );
  }

  console.log(
    `[Scraper] Orchestrator completed: ${summary.totals.completed} completed, ${summary.totals.skipped} skipped, ${summary.totals.failed} failed`
  );

  return summary;
}
