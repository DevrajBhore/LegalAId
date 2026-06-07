const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const kbRoot = path.join(root, "knowledge-base");
const templatesRoot = path.join(kbRoot, "templates");
const diagnosticsDir = path.join(kbRoot, "diagnostics");
const normalizedDir = path.join(templatesRoot, "normalized");
const approvedDir = path.join(templatesRoot, "approved");
const reviewDir = path.join(templatesRoot, "review");
const extractedClausesDir = path.join(kbRoot, "clauses");

const auditPath = path.join(diagnosticsDir, "template_audit.json");
const intelligencePath = path.join(
  diagnosticsDir,
  "template_intelligence_report.json"
);
const qualityPath = path.join(diagnosticsDir, "template_quality_report.json");

const GENERATED_DIR_NAMES = new Set(["approved", "review", "normalized"]);

const DRAFTING_KEYWORDS = [
  "agreement",
  "deed",
  "contract",
  "nda",
  "non disclosure",
  "lease",
  "license",
  "licence",
  "employment",
  "service agreement",
  "partnership",
  "shareholder",
  "term sheet",
  "guarantee",
  "indemnity",
  "power of attorney",
  "letter of intent",
  "offer letter",
  "promissory",
  "bond",
];

const KNOWLEDGE_DOCUMENT_KEYWORDS = [
  "guideline",
  "manual",
  "policy",
  "scheme",
  "yojana",
  "subsidy",
  "notification",
  "circular",
  "rules",
  "bye laws",
  "bye-laws",
  "rating",
  "certification",
  "report",
  "terms of use",
  "user manual",
  "process",
  "prerequisites",
  "recruitment",
];

const STRONG_DRAFT_TITLE_KEYWORDS = [
  "agreement",
  "deed",
  "contract",
  "guarantee",
  "undertaking",
  "letter",
  "term sheet",
  "bond",
  "power of attorney",
  "will",
  "lease",
  "license",
  "licence",
  "nda",
  "non disclosure",
  "promissory",
];

const CLAUSE_PATTERNS = [
  {
    category: "confidentiality",
    names: ["Confidentiality", "Confidential Information"],
    keywords: ["confidential", "non-disclosure", "non disclosure"],
    risk_level: "medium",
  },
  {
    category: "arbitration",
    names: ["Arbitration", "Dispute Resolution"],
    keywords: ["arbitration", "arbitral", "dispute resolution"],
    risk_level: "medium",
  },
  {
    category: "termination",
    names: ["Termination"],
    keywords: ["termination", "terminate", "expiry"],
    risk_level: "medium",
  },
  {
    category: "indemnity",
    names: ["Indemnity", "Indemnification"],
    keywords: ["indemnity", "indemnify", "indemnification"],
    risk_level: "high",
  },
  {
    category: "jurisdiction",
    names: ["Jurisdiction", "Governing Law"],
    keywords: ["jurisdiction", "governed by", "laws of india", "courts at"],
    risk_level: "medium",
  },
  {
    category: "notice_period",
    names: ["Notice", "Notice Period"],
    keywords: ["notice period", "written notice", "notice of"],
    risk_level: "low",
  },
  {
    category: "payment_terms",
    names: ["Payment", "Fees", "Consideration"],
    keywords: ["payment", "fees", "consideration", "invoice", "salary", "rent"],
    risk_level: "medium",
  },
  {
    category: "force_majeure",
    names: ["Force Majeure"],
    keywords: ["force majeure", "act of god"],
    risk_level: "medium",
  },
  {
    category: "non_compete",
    names: ["Non-Compete", "Restrictive Covenant"],
    keywords: ["non-compete", "non compete", "restraint of trade"],
    risk_level: "high",
  },
  {
    category: "ip_ownership",
    names: ["Intellectual Property", "IP Ownership"],
    keywords: ["intellectual property", "ip ownership", "assignment of ip", "copyright"],
    risk_level: "high",
  },
];

const MANDATORY_CATEGORIES = new Set([
  "identity",
  "definitions",
  "confidentiality",
  "termination",
  "jurisdiction",
  "signatures",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function resetJsonDir(dirPath) {
  ensureDir(dirPath);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        if (error.code !== "EBUSY" && error.code !== "EPERM") {
          throw error;
        }
      }
    }
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = [];
  const stack = [dirPath];

  while (stack.length) {
    const current = stack.pop();
    const baseName = path.basename(current);
    if (GENERATED_DIR_NAMES.has(baseName)) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
        files.push(fullPath);
      }
    }
  }

  return files.sort((left, right) => left.localeCompare(right));
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return { raw, json: null, parseError: "empty_file" };

  try {
    return { raw, json: JSON.parse(raw), parseError: null };
  } catch (error) {
    return { raw, json: null, parseError: error.message };
  }
}

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, "/");
}

function slug(value) {
  return String(value || "template")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "template";
}

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeForHash(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .toLowerCase();
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sourceOf(relPath) {
  return relPath.split("/")[2] || "unknown";
}

function kindOf(relPath) {
  if (relPath.includes("/items/")) return "item";
  const fileName = path.basename(relPath).toLowerCase();
  if (fileName === "index.json") return "index";
  if (fileName === "parsed-index.json") return "parsed-index";
  if (fileName === "unresolved.json") return "unresolved";
  return "support";
}

function textFrom(json) {
  if (!json || typeof json !== "object") return "";
  if (typeof json.body === "string") return json.body;
  if (typeof json.text === "string") return json.text;
  if (typeof json.content === "string") return json.content;
  if (Array.isArray(json.body)) return json.body.join("\n");
  return "";
}

function normalizedHaystack(json, text) {
  return normalizeForHash(
    [json?.title, json?.id, json?.category, json?.document_url, text.slice(0, 800)].join(" ")
  );
}

function hasAnyKeyword(haystack, keywords) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function hasStrongDraftTitleSignal(json) {
  const haystack = normalizeForHash(
    [json?.title, json?.id, json?.document_url].join(" ")
  );
  return hasAnyKeyword(haystack, STRONG_DRAFT_TITLE_KEYWORDS);
}

function detectPlaceholders(text) {
  const matches = String(text || "").match(
    /\[[^\]\r\n]{0,90}\]|\{\{[^}\r\n]{1,90}\}\}|<<[^>\r\n]{1,90}>>|__[A-Z0-9_]{2,}__/g
  );

  return unique(matches || []).map((value) => value.trim()).slice(0, 80);
}

function placeholderLooksMalformed(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return true;
  if (trimmed === "[]" || trimmed === "[ ]" || trimmed === "[__]") return false;
  if (trimmed.startsWith("[") && !trimmed.endsWith("]")) return true;
  if (trimmed.startsWith("{{") && !trimmed.endsWith("}}")) return true;
  return trimmed.length > 90;
}

function brokenExtraction(json, kind, text) {
  if (!json || typeof json !== "object" || kind !== "item") return false;
  const extraction = json.extraction || {};
  const status = String(extraction.status || "").toLowerCase();
  const linkStatus = String(extraction.link_status || "").toLowerCase();
  const sourceError = String(extraction.source_error || "").toLowerCase();

  return (
    status.includes("unresolved") ||
    status.includes("failed") ||
    linkStatus.includes("broken") ||
    sourceError.includes("404") ||
    sourceError.includes("failed") ||
    (json.has_text === false && !text.trim())
  );
}

function formattingIssues(raw, text) {
  const issues = [];
  if (/[âÂ]/.test(raw)) issues.push("encoding_artifacts");
  if (/--\s+\d+\s+of\s+\d+\s+--/i.test(text)) issues.push("pdf_page_markers");
  if (/\s{8,}/.test(text)) issues.push("excessive_spacing");
  if (text.split(/\r?\n/).some((line) => line.length > 1200)) {
    issues.push("very_long_lines");
  }
  if ((text.match(/\b\d+\.\s+/g) || []).length > 12 && !/\n\s*\d+\.\s+/.test(text)) {
    issues.push("flattened_numbering");
  }
  return issues;
}

function splitIntoClauses(text) {
  const cleaned = normalizeWhitespace(text)
    .replace(/--\s+\d+\s+of\s+\d+\s+--/gi, "\n")
    .replace(/\s+(?=(?:\d{1,2}|[A-Z])\.\s+[A-Z"][A-Za-z])/g, "\n");

  const parts = cleaned
    .split(/\n(?=(?:\d{1,2}|[A-Z])\.\s+|(?:\d{1,2})\)\s+|[A-Z][A-Z\s]{4,}:)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 60);

  if (parts.length >= 3) return parts;

  return cleaned
    .split(/(?<=\.)\s+(?=(?:\d{1,2}\.|[A-Z][A-Za-z ]{3,40}\s+shall\b))/)
    .map((part) => part.trim())
    .filter((part) => part.length > 80);
}

function headingFromClause(clause, fallbackIndex) {
  const firstLine = clause.split(/\r?\n/)[0].trim();
  const match = firstLine.match(/^(?:\d{1,2}|[A-Z])?[.)]?\s*([A-Z][A-Za-z &/,()-]{3,80})(?::|\s{2,}|$)/);
  if (match && match[1]) return match[1].trim();
  return `Clause ${fallbackIndex + 1}`;
}

function detectClauseCategory(text) {
  const haystack = normalizeForHash(text);
  const match = CLAUSE_PATTERNS.find((pattern) =>
    pattern.keywords.some((keyword) => haystack.includes(keyword))
  );
  return match?.category || "general";
}

function inferDocumentType(json, text) {
  const haystack = normalizedHaystack(json, text);
  const checks = [
    ["NDA", ["non disclosure", "non-disclosure", "nda", "confidentiality agreement"]],
    ["EMPLOYMENT_CONTRACT", ["employment agreement", "offer letter", "relieving letter", "experience letter"]],
    ["SERVICE_AGREEMENT", ["service agreement", "engagement agreement", "consultancy agreement"]],
    ["PARTNERSHIP_DEED", ["partnership deed", "partnership agreement"]],
    ["COMMERCIAL_LEASE_AGREEMENT", ["commercial lease", "lease deed"]],
    ["LEAVE_AND_LICENSE_AGREEMENT", ["leave and license", "licence agreement", "license agreement", "rent deed"]],
    ["LOAN_AGREEMENT", ["loan agreement", "promissory note", "ordinary bond"]],
    ["GUARANTEE_AGREEMENT", ["guarantee", "bank guarantee"]],
    ["SHAREHOLDERS_AGREEMENT", ["shareholder", "shareholders", "sha"]],
    ["JOINT_VENTURE_AGREEMENT", ["joint venture", "jv"]],
    ["MOU", ["memorandum of understanding", "mou", "letter of intent"]],
  ];

  return checks.find(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))?.[0] || "GENERAL_LEGAL_TEMPLATE";
}

function inferVariant(documentType, json, text) {
  const haystack = normalizedHaystack(json, text);
  const variantRules = {
    NDA: [
      ["mutual", ["mutual"]],
      ["one_way", ["one-way", "one way", "unilateral"]],
      ["employee", ["employee", "employment"]],
      ["startup", ["startup", "founder"]],
      ["investor", ["investor", "investment"]],
      ["vendor", ["vendor", "supplier"]],
      ["contractor", ["contractor", "consultant"]],
      ["ip_focused", ["intellectual property", "ip"]],
    ],
    EMPLOYMENT_CONTRACT: [
      ["full_time", ["full-time", "full time"]],
      ["part_time", ["part-time", "part time"]],
      ["internship", ["intern", "trainee"]],
      ["consultant", ["consultant"]],
      ["fixed_term", ["fixed term"]],
      ["remote", ["remote", "work from home"]],
      ["executive", ["executive", "director"]],
    ],
    SERVICE_AGREEMENT: [
      ["freelancer", ["freelancer"]],
      ["it_services", ["software", "technology", "it services"]],
      ["saas", ["saas"]],
      ["consulting", ["consulting", "consultancy"]],
      ["marketing", ["marketing"]],
      ["maintenance", ["maintenance"]],
    ],
    COMMERCIAL_LEASE_AGREEMENT: [
      ["commercial", ["commercial"]],
      ["equipment_lease", ["equipment"]],
      ["short_term", ["short term", "short-term"]],
    ],
    LEAVE_AND_LICENSE_AGREEMENT: [
      ["leave_and_license", ["leave and license"]],
      ["residential", ["residential", "house", "flat"]],
      ["short_term", ["short term", "short-term"]],
    ],
    PARTNERSHIP_DEED: [
      ["general", ["general"]],
      ["llp", ["llp"]],
      ["startup_cofounder", ["founder", "co-founder", "cofounder"]],
      ["joint_venture", ["joint venture"]],
    ],
  };

  const rules = variantRules[documentType] || [];
  return rules.find(([, keywords]) => keywords.some((keyword) => haystack.includes(keyword)))?.[0] || "standard";
}

function detectVariables(text) {
  const placeholders = detectPlaceholders(text);
  const variables = [];
  const push = (name, type, required = true, validation = {}) => {
    if (!variables.some((item) => item.name === name)) {
      variables.push({ name, type, required, validation });
    }
  };

  placeholders.forEach((placeholder, index) => {
    const clean = placeholder
      .replace(/^[{\[<_\s]+|[}\]>_\s]+$/g, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    push(clean && clean !== "__" ? clean : `placeholder_${index + 1}`, "text", true, {
      source: placeholder,
    });
  });

  const haystack = normalizeForHash(text);
  if (/\bdate[ds]?\b|effective date/i.test(text)) push("effective_date", "date", true, { kind: "valid_date" });
  if (/\bparty 1\b|\bfirst party\b/i.test(text)) push("party_1_name", "text", true, { kind: "required" });
  if (/\bparty 2\b|\bsecond party\b/i.test(text)) push("party_2_name", "text", true, { kind: "required" });
  if (/\baddress\b/i.test(text)) push("party_address", "textarea", false, { kind: "complete_address" });
  if (/\bemail\b/i.test(text)) push("email", "text", false, { kind: "email" });
  if (/\bnotice period\b|\bwritten notice\b/i.test(text)) push("notice_period", "number", false, { kind: "positive_integer" });
  if (/\bfees?\b|\bpayment\b|\brent\b|\bsalary\b|\bconsideration\b/i.test(text)) {
    push("payment_amount", "number", false, { kind: "numeric" });
  }
  if (haystack.includes("purpose")) push("purpose", "textarea", false, { kind: "meaningful_text" });
  if (haystack.includes("jurisdiction") || haystack.includes("courts at")) {
    push("jurisdiction_city", "text", false, { kind: "city" });
  }

  return variables;
}

function detectSectionHeadings(clauses) {
  return unique(clauses.map((clause, index) => headingFromClause(clause, index))).slice(0, 80);
}

function detectJurisdiction(text) {
  const match =
    text.match(/courts?\s+(?:at|of|in)\s+([A-Z][A-Za-z ]{2,40})/i) ||
    text.match(/jurisdiction\s+(?:of|at|in)\s+([A-Z][A-Za-z ]{2,40})/i);
  if (match) return match[1].trim().replace(/\s+India$/i, "");
  if (/laws? of india|governed.*india/i.test(text)) return "India";
  return null;
}

function detectSpecialClauses(clauses) {
  const result = {
    party_definitions: [],
    dates: [],
    payment_terms: [],
    dispute_clauses: [],
    governing_law: [],
    jurisdiction: [],
    signatures: [],
  };

  clauses.forEach((clause, index) => {
    const entry = { index: index + 1, heading: headingFromClause(clause, index) };
    if (/\bparty\b|\bparties\b/i.test(clause)) result.party_definitions.push(entry);
    if (/\bdate\b|\beffective date\b/i.test(clause)) result.dates.push(entry);
    if (/\bpayment\b|\bfees?\b|\brent\b|\bsalary\b|\bconsideration\b/i.test(clause)) {
      result.payment_terms.push(entry);
    }
    if (/\barbitration\b|\bdispute\b|\bmediation\b/i.test(clause)) {
      result.dispute_clauses.push(entry);
    }
    if (/\bgoverned by\b|\blaws? of india\b/i.test(clause)) result.governing_law.push(entry);
    if (/\bjurisdiction\b|\bcourts? at\b/i.test(clause)) result.jurisdiction.push(entry);
    if (/\bsignature\b|\bin witness whereof\b|\bexecuted\b/i.test(clause)) result.signatures.push(entry);
  });

  return result;
}

function assessQuality({ text, variables, clauses, auditRecord }) {
  let score = 0;
  const reasons = [];

  if (text.length > 500) score += 15;
  else reasons.push("short_text");

  if (clauses.length >= 8) score += 25;
  else if (clauses.length >= 4) score += 16;
  else reasons.push("few_clause_boundaries");

  if (variables.length >= 4) score += 15;
  else if (variables.length >= 1) score += 8;
  else reasons.push("no_variables_detected");

  if (auditRecord.unresolved_placeholders.length === 0) score += 10;
  else if (auditRecord.unresolved_placeholders.length <= 8) score += 6;
  else reasons.push("many_unresolved_placeholders");

  const formattingIssueCount = (
    auditRecord.inconsistent_formatting ||
    auditRecord.formatting_issues ||
    []
  ).length;

  if (formattingIssueCount === 0) score += 10;
  else reasons.push("formatting_issues");

  const categories = new Set(clauses.map((clause) => clause.category));
  if (categories.size >= 5) score += 15;
  else if (categories.size >= 3) score += 9;
  else reasons.push("low_clause_category_coverage");

  if (!auditRecord.duplicate) score += 5;
  else reasons.push("duplicate_content");

  if (!auditRecord.broken && !auditRecord.empty) score += 5;

  if (auditRecord.misclassified_knowledge_document) score = Math.min(score, 40);
  if (auditRecord.broken || auditRecord.empty) score = Math.min(score, 20);

  return {
    quality_score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

function buildAuditRecords() {
  const records = listJsonFiles(templatesRoot).map((filePath) => {
    const relPath = relative(filePath);
    const { raw, json, parseError } = readJson(filePath);
    const kind = kindOf(relPath);
    const text = textFrom(json);
    const cleanText = normalizeWhitespace(text);
    const haystack = normalizedHaystack(json, cleanText);
    const placeholders = detectPlaceholders(cleanText);
    const clauses = splitIntoClauses(cleanText);
    const empty = !raw.trim() || (kind === "item" && !cleanText);
    const broken = Boolean(parseError) || brokenExtraction(json, kind, cleanText);
    const draftingKeyword = hasAnyKeyword(haystack, DRAFTING_KEYWORDS);
    const knowledgeKeyword = hasAnyKeyword(haystack, KNOWLEDGE_DOCUMENT_KEYWORDS);
    const strongDraftTitle = hasStrongDraftTitleSignal(json);
    const misclassified =
      kind === "item" &&
      !broken &&
      !empty &&
      (!draftingKeyword || (knowledgeKeyword && !strongDraftTitle));
    const rawDocument = kind === "item" && !broken && !empty && draftingKeyword;
    const validDraftingTemplate =
      rawDocument &&
      !misclassified &&
      clauses.length >= 3 &&
      cleanText.length >= 500;

    return {
      path: relPath,
      source: sourceOf(relPath),
      kind,
      id: json?.id || null,
      title: json?.title || null,
      document_url: json?.document_url || null,
      document_format: json?.document_format || null,
      text_length: cleanText.length,
      content_hash: cleanText.length >= 120 ? hash(normalizeForHash(cleanText)) : null,
      valid_drafting_template: validDraftingTemplate,
      raw_document: rawDocument,
      duplicate: false,
      broken,
      incomplete: false,
      empty,
      unresolved_placeholders: placeholders,
      unresolved_placeholder_count: placeholders.length,
      malformed_placeholders: placeholders.filter(placeholderLooksMalformed),
      misclassified_knowledge_document: misclassified,
      missing_sections: clauses.length < 3,
      inconsistent_formatting: formattingIssues(raw, cleanText),
      parse_error: parseError,
      classifications: [],
    };
  });

  const duplicateGroups = Object.values(
    records.reduce((groups, record) => {
      if (!record.content_hash) return groups;
      groups[record.content_hash] ||= [];
      groups[record.content_hash].push(record.path);
      return groups;
    }, {})
  ).filter((group) => group.length > 1);
  const duplicatePaths = new Set(duplicateGroups.flat());

  records.forEach((record) => {
    record.duplicate = duplicatePaths.has(record.path);
    record.incomplete =
      record.empty ||
      record.broken ||
      record.missing_sections ||
      record.malformed_placeholders.length > 0 ||
      (record.raw_document && record.unresolved_placeholder_count === 0);

    const classifications = [];
    if (record.valid_drafting_template) classifications.push("valid_drafting_template");
    if (record.raw_document) classifications.push("raw_document");
    if (record.duplicate) classifications.push("duplicate");
    if (record.broken) classifications.push("broken");
    if (record.incomplete) classifications.push("incomplete");
    if (record.empty) classifications.push("empty");
    if (record.unresolved_placeholder_count > 0) classifications.push("unresolved_placeholders");
    if (record.misclassified_knowledge_document) classifications.push("misclassified_knowledge_document");
    if (record.inconsistent_formatting.length > 0) classifications.push("inconsistent_formatting");
    record.classifications = classifications;
  });

  return { records, duplicateGroups };
}

function summarizeAudit(records, duplicateGroups) {
  const count = (predicate) => records.filter(predicate).length;
  const bySource = {};
  records.forEach((record) => {
    bySource[record.source] ||= {
      total: 0,
      valid_templates: 0,
      raw_documents: 0,
      duplicates: 0,
      broken: 0,
      empty: 0,
      incomplete: 0,
      misclassified: 0,
      unresolved_placeholders: 0,
    };
    const bucket = bySource[record.source];
    bucket.total += 1;
    if (record.valid_drafting_template) bucket.valid_templates += 1;
    if (record.raw_document) bucket.raw_documents += 1;
    if (record.duplicate) bucket.duplicates += 1;
    if (record.broken) bucket.broken += 1;
    if (record.empty) bucket.empty += 1;
    if (record.incomplete) bucket.incomplete += 1;
    if (record.misclassified_knowledge_document) bucket.misclassified += 1;
    if (record.unresolved_placeholder_count > 0) bucket.unresolved_placeholders += 1;
  });

  return {
    total_templates: records.length,
    valid_templates: count((record) => record.valid_drafting_template),
    duplicates: count((record) => record.duplicate),
    broken: count((record) => record.broken),
    empty: count((record) => record.empty),
    incomplete: count((record) => record.incomplete),
    misclassified: count((record) => record.misclassified_knowledge_document),
    unresolved_placeholders: count((record) => record.unresolved_placeholder_count > 0),
    raw_documents: count((record) => record.raw_document),
    inconsistent_formatting: count((record) => record.inconsistent_formatting.length > 0),
    by_source: bySource,
    duplicate_groups: duplicateGroups.map((paths) => ({ count: paths.length, paths })),
  };
}

function buildIntelligence(record) {
  const sourcePath = path.join(root, record.path);
  const { json } = readJson(sourcePath);
  const text = normalizeWhitespace(textFrom(json));
  const rawClauses = splitIntoClauses(text);
  const clauses = rawClauses.map((clause, index) => ({
    id: `${slug(json?.id || json?.title)}_${index + 1}`,
    heading: headingFromClause(clause, index),
    category: detectClauseCategory(clause),
    text: clause,
  }));
  const variables = detectVariables(text);
  const special = detectSpecialClauses(rawClauses);
  const jurisdiction = detectJurisdiction(text);
  const quality = assessQuality({ text, variables, clauses, auditRecord: record });

  return {
    source_path: record.path,
    document_name: json?.title || json?.id || path.basename(record.path, ".json"),
    document_type: inferDocumentType(json, text),
    variant: inferVariant(inferDocumentType(json, text), json, text),
    variables_detected: variables,
    clauses_detected: clauses.map(({ id, heading, category }) => ({
      id,
      heading,
      category,
    })),
    section_headings: detectSectionHeadings(rawClauses),
    party_definitions: special.party_definitions,
    dates: special.dates,
    payment_terms: special.payment_terms,
    dispute_clauses: special.dispute_clauses,
    governing_law: special.governing_law,
    jurisdiction,
    jurisdiction_clauses: special.jurisdiction,
    signatures: special.signatures,
    missing_variables:
      variables.length === 0 ? ["no variables or placeholders detected"] : [],
    quality_score: quality.quality_score,
    quality_reasons: quality.reasons,
    _clauses_full: clauses,
    _body: text,
    _source: json,
  };
}

function normalizeTemplate(intel) {
  const mandatory = [];
  const optional = [];

  intel._clauses_full.forEach((clause) => {
    const entry = {
      clause_id: clause.id,
      clause_name: clause.heading,
      category: clause.category,
    };
    if (MANDATORY_CATEGORIES.has(clause.category)) mandatory.push(entry);
    else optional.push(entry);
  });

  return {
    document_type: intel.document_type,
    variant: intel.variant,
    jurisdiction: intel.jurisdiction || "India",
    variables: intel.variables_detected,
    mandatory_clauses: mandatory,
    optional_clauses: optional,
    body: cleanTemplateBody(intel._body),
    metadata: {
      source: intel.source_path,
      source_label: intel._source?.source_label || null,
      source_url: intel._source?.document_url || null,
      quality_score: intel.quality_score,
      approval_eligible: isApprovalEligibleSource(intel._source),
      version: "0.1.0",
      generated_by: "scripts/auditTemplates.cjs",
      generation_policy: "not connected to main generation pipeline",
    },
  };
}

function isApprovalEligibleSource(json) {
  if (!json || typeof json !== "object") return false;
  const titleHaystack = normalizeForHash(
    [json.title, json.id, json.document_url].join(" ")
  );
  const knowledgeSignal =
    hasAnyKeyword(titleHaystack, KNOWLEDGE_DOCUMENT_KEYWORDS) ||
    /\bterms?\s+(?:and\s+)?conditions?\b/.test(titleHaystack) ||
    /\bterms?\s+of\s+(?:use|service)\b/.test(titleHaystack);
  const instrumentSignal =
    /\bagreement\b/.test(titleHaystack) ||
    /\bdeed\b/.test(titleHaystack) ||
    /\bguarantee\b/.test(titleHaystack) ||
    /\bundertaking\b/.test(titleHaystack) ||
    /\bterm\s+sheet\b/.test(titleHaystack) ||
    /\bbond\b/.test(titleHaystack) ||
    /\bpower\s+of\s+attorney\b/.test(titleHaystack) ||
    /\bwill\b/.test(titleHaystack) ||
    /\blease\b/.test(titleHaystack) ||
    /\blicen[cs]e\b/.test(titleHaystack) ||
    /\bnda\b/.test(titleHaystack) ||
    /\bnon\s+disclosure\b/.test(titleHaystack) ||
    /\bpromissory\b/.test(titleHaystack) ||
    /\bletter\s+of\s+intent\b/.test(titleHaystack) ||
    /\boffer\s+letter\b/.test(titleHaystack);

  return instrumentSignal && !knowledgeSignal;
}

function cleanTemplateBody(text) {
  return normalizeWhitespace(text)
    .replace(/--\s+\d+\s+of\s+\d+\s+--/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\[__\]/g, "{{placeholder}}")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Reusable clause mining ────────────────────────────────────────────────────
// The earlier version kept the single LONGEST chunk per category, which actively
// selected mis-segmented whole-document blobs (e.g. a full consultancy agreement
// labelled "confidentiality"). This version rejects blobs, recovers sub-clauses
// from over-long chunks, and collects multiple ranked, deduped VARIANTS per
// family — each flagged unreviewed so nothing can silently reach generation.
const REUSABLE_MIN_CHARS = 120;
const REUSABLE_MAX_CHARS = 2200;
const REUSABLE_MAX_VARIANTS = 6;

function categoryKeywordHits(haystack) {
  const hits = new Map();
  for (const pattern of CLAUSE_PATTERNS) {
    let count = 0;
    for (const keyword of pattern.keywords) {
      if (haystack.includes(keyword)) count += 1;
    }
    if (count > 0) hits.set(pattern.category, count);
  }
  return hits;
}

function headingCategory(heading) {
  const normalized = normalizeForHash(heading || "");
  for (const pattern of CLAUSE_PATTERNS) {
    if (pattern.names.some((name) => normalized.includes(normalizeForHash(name)))) {
      return pattern.category;
    }
  }
  return null;
}

function classifyClauseChunk(text, heading) {
  const hits = categoryKeywordHits(normalizeForHash(text));
  const matchedCategories = [...hits.keys()];
  const headingCat = headingCategory(heading);
  let category = headingCat;
  if (!category && matchedCategories.length) {
    category = matchedCategories.sort((a, b) => hits.get(b) - hits.get(a))[0];
  }
  return {
    category: category || "general",
    matchedCount: matchedCategories.length,
    headingCat,
  };
}

function looksLikeWholeDocument(text) {
  if (text.length <= REUSABLE_MAX_CHARS) return false;
  const signatureSignal = /in witness whereof|signature|_{3,}/i.test(text);
  const manyHeadings = (text.match(/\b[A-Z]{4,}[ .:]/g) || []).length >= 6;
  return signatureSignal || manyHeadings;
}

function splitBlobIntoSubClauses(text) {
  return text
    .split(/(?=\b[A-Z][A-Z ]{4,}[.:]\s)|(?<=\.)\s+(?=\d{1,2}[.)]\s)/)
    .map((part) => part.trim())
    .filter((part) => part.length >= REUSABLE_MIN_CHARS && part.length <= REUSABLE_MAX_CHARS);
}

function isExtractableClause(text, classification) {
  if (text.length < REUSABLE_MIN_CHARS || text.length > REUSABLE_MAX_CHARS) return false;
  if (classification.category === "general") return false;
  if (classification.matchedCount >= 3) return false; // multi-topic = mis-segment
  if (looksLikeWholeDocument(text)) return false;
  return true;
}

function clauseQualityScore(text, classification) {
  let score = 0;
  const len = text.length;
  if (len >= 250 && len <= 1200) score += 40;
  else if (len >= 150) score += 20;
  if (classification.headingCat) score += 25;
  if (classification.matchedCount === 1) score += 20;
  const placeholderNoise = (text.match(/\[[^\]]*\]|\{\{|_{3,}/g) || []).length;
  score -= Math.min(20, placeholderNoise * 4);
  return score;
}

function extractReusableClauses(intelligence) {
  const byCategory = new Map();
  const seenHashes = new Map();

  const consider = (rawText, heading, intel) => {
    const cleaned = cleanTemplateBody(rawText);
    const classification = classifyClauseChunk(cleaned, heading);
    if (!isExtractableClause(cleaned, classification)) return;

    const { category } = classification;
    const fingerprint = hash(normalizeForHash(cleaned).slice(0, 400));
    if (!seenHashes.has(category)) seenHashes.set(category, new Set());
    if (seenHashes.get(category).has(fingerprint)) return; // dedupe near-identical
    seenHashes.get(category).add(fingerprint);

    const pattern = CLAUSE_PATTERNS.find((item) => item.category === category);
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        clause_name: pattern?.names?.[0] || heading,
        category,
        risk_level: pattern?.risk_level || "medium",
        variants: [],
      });
    }
    byCategory.get(category).variants.push({
      clause_name: classification.headingCat
        ? pattern?.names?.[0] || heading
        : heading,
      text: cleaned,
      char_length: cleaned.length,
      risk_level: pattern?.risk_level || "medium",
      quality_score: clauseQualityScore(cleaned, classification),
      review_status: "unreviewed",
      production_ready: false,
      source_template: intel.source_path,
      source_document_name: intel.document_name,
    });
  };

  intelligence.forEach((intel) => {
    intel._clauses_full.forEach((clause) => {
      const cleaned = cleanTemplateBody(clause.text);
      if (cleaned.length > REUSABLE_MAX_CHARS) {
        // Recover candidate sub-clauses from an over-long (mis-segmented) chunk.
        for (const sub of splitBlobIntoSubClauses(cleaned)) {
          consider(sub, headingFromClause(sub, 0), intel);
        }
      } else {
        consider(clause.text, clause.heading, intel);
      }
    });
  });

  const families = [...byCategory.values()]
    .map((family) => {
      family.variants.sort((a, b) => b.quality_score - a.quality_score);
      family.variants = family.variants.slice(0, REUSABLE_MAX_VARIANTS);
      family.variant_count = family.variants.length;
      return family;
    })
    .filter((family) => family.variant_count > 0)
    .sort((left, right) => left.category.localeCompare(right.category));

  const totalVariants = families.reduce((sum, family) => sum + family.variant_count, 0);
  return { families, totalVariants };
}

function writeStructuredOutputs(normalizedTemplates) {
  const approval = {
    threshold: 80,
    approved: [],
    review: [],
  };

  ensureDir(normalizedDir);
  ensureDir(approvedDir);
  ensureDir(reviewDir);

  normalizedTemplates.forEach((template) => {
    const sourceStem = slug(
      path.basename(template.metadata.source || "template", ".json")
    );
    const fileName = `${sourceStem}.structured.json`;
    const normalizedPath = path.join(normalizedDir, fileName);
    const isApproved =
      template.metadata.quality_score >= approval.threshold &&
      template.metadata.approval_eligible === true;
    const targetDir = isApproved ? approvedDir : reviewDir;
    const targetPath = path.join(targetDir, fileName);

    writeJson(normalizedPath, template);
    writeJson(targetPath, template);

    const relativeTarget = relative(targetPath);
    if (isApproved) {
      approval.approved.push(relativeTarget);
    } else {
      approval.review.push(relativeTarget);
    }
  });

  writeJson(path.join(approvedDir, "index.json"), {
    generated_at: new Date().toISOString(),
    threshold: approval.threshold,
    count: approval.approved.length,
    templates: approval.approved,
  });
  writeJson(path.join(reviewDir, "index.json"), {
    generated_at: new Date().toISOString(),
    threshold: approval.threshold,
    count: approval.review.length,
    templates: approval.review,
  });

  return approval;
}

function roadmap() {
  return [
    {
      phase: 1,
      name: "Template audit",
      status: "complete",
      output: relative(auditPath),
    },
    {
      phase: 2,
      name: "Template intelligence extraction",
      status: "complete",
      output: relative(intelligencePath),
    },
    {
      phase: 3,
      name: "Template normalization",
      status: "complete",
      output: "knowledge-base/templates/normalized/",
    },
    {
      phase: 4,
      name: "Clause extraction",
      status: "complete",
      output: "knowledge-base/clauses/",
    },
    {
      phase: 5,
      name: "Template quality improvement",
      status: "complete",
      output: relative(qualityPath),
    },
    {
      phase: 6,
      name: "Approval pipeline",
      status: "complete",
      output: "knowledge-base/templates/approved/ and knowledge-base/templates/review/",
    },
    {
      phase: "next",
      name: "Human legal review",
      status: "todo",
      output:
        "Review high-scoring templates, fix placeholders/clauses manually, then decide whether to integrate approved assets behind a feature flag.",
    },
  ];
}

function main() {
  ensureDir(diagnosticsDir);
  resetJsonDir(normalizedDir);
  resetJsonDir(approvedDir);
  resetJsonDir(reviewDir);
  resetJsonDir(extractedClausesDir);

  const { records, duplicateGroups } = buildAuditRecords();
  const auditSummary = summarizeAudit(records, duplicateGroups);
  const validRecords = records.filter((record) => record.valid_drafting_template);
  const intelligenceFull = validRecords.map(buildIntelligence);
  const normalizedTemplates = intelligenceFull.map(normalizeTemplate);
  const approval = writeStructuredOutputs(normalizedTemplates);
  const { families: clauseFamilies, totalVariants } =
    extractReusableClauses(intelligenceFull);

  clauseFamilies.forEach((family) => {
    writeJson(path.join(extractedClausesDir, `${slug(family.category)}.json`), {
      category: family.category,
      clause_name: family.clause_name,
      risk_level: family.risk_level,
      variant_count: family.variant_count,
      policy:
        "UNREVIEWED clause variants mined from raw templates. Must be upgraded to base_clause.schema.json and lawyer-reviewed before use in generation.",
      variants: family.variants,
    });
  });
  writeJson(path.join(extractedClausesDir, "index.json"), {
    generated_at: new Date().toISOString(),
    policy:
      "Clause variants mined from raw templates. Not wired into the main generator. Every variant is UNREVIEWED.",
    family_count: clauseFamilies.length,
    variant_count: totalVariants,
    families: clauseFamilies.map((family) => ({
      category: family.category,
      file: `${slug(family.category)}.json`,
      variant_count: family.variant_count,
    })),
  });
  // Curation worklist: the bridge from mined variants to production clauses.
  writeJson(path.join(extractedClausesDir, "_worklist.json"), {
    generated_at: new Date().toISOString(),
    purpose:
      "Curation worklist. Mined clause variants awaiting human selection, schema-upgrade, and legal review before they can feed the variant engine (clause_library/ blueprints variant_clauses[]).",
    totals: {
      families: clauseFamilies.length,
      variants: totalVariants,
      reviewed: 0,
      unreviewed: totalVariants,
    },
    families: clauseFamilies.map((family) => ({
      category: family.category,
      variant_count: family.variant_count,
      unreviewed: family.variant_count,
      next_action:
        "Pick the genuinely distinct variants, author into base_clause.schema.json (clause_id, document_types, legal_basis, enforceability), then add to a blueprint variant_clauses[] slot.",
    })),
  });

  const intelligenceReport = {
    generated_at: new Date().toISOString(),
    policy: {
      raw_templates_only: true,
      not_connected_to_generation: true,
    },
    total_valid_templates: intelligenceFull.length,
    templates: intelligenceFull.map(({ _clauses_full, _body, _source, ...publicIntel }) => publicIntel),
  };

  const qualityReport = {
    generated_at: new Date().toISOString(),
    scoring_model: {
      max_score: 100,
      approval_threshold: approval.threshold,
      dimensions: [
        "completeness",
        "formatting",
        "variable coverage",
        "clause coverage",
        "duplicate detection",
        "unresolved placeholders",
      ],
    },
    summary: {
      normalized_templates: normalizedTemplates.length,
      approved: approval.approved.length,
      review: approval.review.length,
      extracted_reusable_clauses: totalVariants,
      average_quality_score:
        normalizedTemplates.length === 0
          ? 0
          : Math.round(
              normalizedTemplates.reduce(
                (sum, template) => sum + template.metadata.quality_score,
                0
              ) / normalizedTemplates.length
            ),
    },
    templates: normalizedTemplates.map((template) => ({
      document_type: template.document_type,
      variant: template.variant,
      source: template.metadata.source,
      quality_score: template.metadata.quality_score,
      destination:
        template.metadata.quality_score >= approval.threshold &&
        template.metadata.approval_eligible
          ? "approved"
          : "review",
      approval_eligible: template.metadata.approval_eligible,
      variable_count: template.variables.length,
      mandatory_clause_count: template.mandatory_clauses.length,
      optional_clause_count: template.optional_clauses.length,
    })),
  };

  writeJson(auditPath, {
    generated_at: new Date().toISOString(),
    scope: "LegalAId raw scraped template audit",
    policy: {
      no_scraping_performed: true,
      raw_sources_preserved: true,
      approved_templates_not_connected_to_generation: true,
    },
    report: auditSummary,
    roadmap: roadmap(),
    templates: records,
  });
  writeJson(intelligencePath, intelligenceReport);
  writeJson(qualityPath, qualityReport);

  console.log(
    JSON.stringify(
      {
        audit: relative(auditPath),
        intelligence: relative(intelligencePath),
        quality: relative(qualityPath),
        ...auditSummary,
        normalized_templates: normalizedTemplates.length,
        extracted_reusable_clauses: totalVariants,
        approved: approval.approved.length,
        review: approval.review.length,
      },
      null,
      2
    )
  );
}

main();
