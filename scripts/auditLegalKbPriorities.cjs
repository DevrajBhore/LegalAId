const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const kbRoot = path.join(root, "knowledge-base");
const diagnosticsDir = path.join(kbRoot, "diagnostics");
const outputPath = path.join(diagnosticsDir, "legal_kb_priority_audit.json");

function exists(targetPath) {
  return fs.existsSync(targetPath);
}

function readJson(targetPath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch {
    return fallback;
  }
}

function listDirs(targetPath) {
  if (!exists(targetPath)) return [];
  return fs
    .readdirSync(targetPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(targetPath, entry.name));
}

function countJsonFiles(targetPath) {
  if (!exists(targetPath)) return 0;

  let count = 0;
  const stack = [targetPath];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        count += 1;
      }
    }
  }

  return count;
}

function subordinateStats() {
  const subordinateRoot = path.join(kbRoot, "subordinate");
  const actDirs = listDirs(subordinateRoot);
  const buckets = {
    act_folders: actDirs.length,
    index_only_act_folders: 0,
    act_folders_with_documents: 0,
    missing_index_files: 0,
    subordinate_document_files: 0,
  };

  for (const actDir of actDirs) {
    const files = fs
      .readdirSync(actDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => entry.name);

    const hasIndex = files.includes("index.json");
    const docFiles = files.filter((name) => name !== "index.json");

    if (!hasIndex) buckets.missing_index_files += 1;
    if (docFiles.length === 0) buckets.index_only_act_folders += 1;
    if (docFiles.length > 0) buckets.act_folders_with_documents += 1;

    buckets.subordinate_document_files += docFiles.length;
  }

  return buckets;
}

function reraStats() {
  const reraRoot = path.join(kbRoot, "rera");
  const authorities = {};

  for (const authorityDir of listDirs(reraRoot)) {
    const authority = path.basename(authorityDir);
    const itemsDir = path.join(authorityDir, "items");
    authorities[authority] = {
      json_files: countJsonFiles(authorityDir),
      item_files: exists(itemsDir) ? countJsonFiles(itemsDir) : 0,
    };
  }

  return authorities;
}

function regulatoryStats() {
  const regulatoryRoot = path.join(kbRoot, "regulatory");
  const authorities = {};

  for (const authorityDir of listDirs(regulatoryRoot)) {
    const authority = path.basename(authorityDir);
    authorities[authority] = {
      json_files: countJsonFiles(authorityDir),
    };
  }

  return authorities;
}

function priority(status, nextAction, localEvidence = {}) {
  return {
    status,
    local_evidence: localEvidence,
    recommended_next_action: nextAction,
  };
}

const indiaCodeCoverage = readJson(
  path.join(diagnosticsDir, "indiacode_coverage.json"),
  {}
);
const subordinate = subordinateStats();
const caseLawCount = countJsonFiles(path.join(kbRoot, "case-law"));
const templateCount = countJsonFiles(path.join(kbRoot, "templates"));
const formsCount = countJsonFiles(path.join(kbRoot, "forms"));
const proceduresCount = countJsonFiles(path.join(kbRoot, "procedures"));
const actsCount = countJsonFiles(path.join(kbRoot, "acts"));
const sectionsCount = countJsonFiles(path.join(kbRoot, "sections"));
const gazetteCount = countJsonFiles(path.join(kbRoot, "gazette"));
const regulatory = regulatoryStats();
const rera = reraStats();

const report = {
  audited_at: new Date().toISOString(),
  scope: "LegalAId local knowledge-base priority audit",
  policy: {
    core_knowledge_first: true,
    avoid_bulk_reference_scraping_by_default: true,
    rera_role: "supplemental lookup/cache, not primary vector knowledge",
  },
  inventory: {
    acts_json_files: actsCount,
    sections_json_files: sectionsCount,
    subordinate,
    case_law_json_files: caseLawCount,
    template_json_files: templateCount,
    forms_json_files: formsCount,
    procedures_json_files: proceduresCount,
    gazette_json_files: gazetteCount,
    regulatory,
    rera,
  },
  existing_indiacode_coverage: indiaCodeCoverage,
  prioritized_backlog: [
    {
      rank: 1,
      area: "Subordinate legislation",
      classification: "core legal knowledge",
      ...priority(
        "partially collected, needs targeted recovery and quality verification",
        "Do not re-run a blind scrape. Target the 153 inconclusive acts and 50 acts with failed candidates, then verify index-only folders against IndiaCode metadata.",
        subordinate
      ),
    },
    {
      rank: 2,
      area: "Judgments and case law",
      classification: "core legal knowledge",
      ...priority(
        caseLawCount > 500 ? "seed present" : "very thin seed",
        "Add a curated case-law pipeline for Supreme Court, High Courts, and tribunals with court/date/citation/issues/summary/full-text fields.",
        { case_law_json_files: caseLawCount }
      ),
    },
    {
      rank: 3,
      area: "Legal document corpus",
      classification: "drafting intelligence",
      ...priority(
        templateCount > 100 ? "seed present" : "thin seed",
        "Expand into vetted variants for each supported document type, then map clauses to inputs used by the generator.",
        { template_json_files: templateCount }
      ),
    },
    {
      rank: 4,
      area: "Procedures and government forms",
      classification: "workflow knowledge",
      ...priority(
        formsCount + proceduresCount > 0 ? "seed present" : "not yet represented as a dedicated KB area",
        "Create a structured procedures/forms collection for filings, compliance workflows, and user action steps.",
        { forms_json_files: formsCount, procedures_json_files: proceduresCount }
      ),
    },
    {
      rank: 5,
      area: "MCA/company data",
      classification: "supplemental lookup",
      ...priority(
        "small regulatory seed only",
        "Keep MCA as an on-demand lookup/cache module unless a drafting workflow specifically needs company verification.",
        { regulatory_mca: regulatory.mca || null }
      ),
    },
    {
      rank: 6,
      area: "Lawyer ecosystem",
      classification: "product marketplace/support module",
      ...priority(
        "not a scraping priority",
        "Build after core drafting and legal knowledge are stronger. Prefer verified onboarding data over scraping directories.",
        {}
      ),
    },
    {
      rank: 7,
      area: "RERA expansion",
      classification: "supplemental lookup/cache",
      ...priority(
        "seed cache is enough for prototype",
        "Stop bulk expansion for now. Later implement local search, official live fallback, normalization, last_verified_at, and user confirmation before draft injection.",
        rera
      ),
    },
  ],
};

fs.mkdirSync(diagnosticsDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Wrote ${outputPath}`);
console.log(
  JSON.stringify(
    {
      acts_json_files: actsCount,
      sections_json_files: sectionsCount,
      subordinate,
      case_law_json_files: caseLawCount,
      template_json_files: templateCount,
      gazette_json_files: gazetteCount,
      rera,
    },
    null,
    2
  )
);
