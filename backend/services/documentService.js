import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve IRE path robustly from backend service location
const IRE_ROOT = path.resolve(__dirname, "../../IRE");

import { callAI } from "../ai/aiClient.js";
import { buildStructuredDraft } from "./schemaBuilder.js";
import { injectDoctrine } from "./doctrineInjector.js";
import { enforceScopeGuard } from "./scopeGuard.js";
import { resolveSignatures } from "./signatureResolver.js";
import { assembleDocument } from "./clauseAssembler.js";
import { injectDraftVariables } from "./draftVariableInjector.js";
import { loadVariables } from "./variableLoader.js";
import { validateVariables } from "./variableValidator.js";
import { validate } from "../ire/runner.js";
import { commercialValidate } from "../ire/commercialValidator.js";
import { computeRisk } from "../utils/riskAggregator.js";
import { enhanceCommercially } from "../commercial/commercialEngine.js";

// Dynamic import for IRE modules (path-safe)
let CategoryMapper = null;
let completenessValidate = null;

async function loadIREModules() {
  if (CategoryMapper) return;
  try {
    const cmPath = pathToFileURL(
      path.join(IRE_ROOT, "src/indian-rule-engine/CategoryMapper.js")
    ).href;
    const cvPath = pathToFileURL(
      path.join(IRE_ROOT, "src/indian-rule-engine/completenessValidator.js")
    ).href;
    const cm = await import(cmPath);
    const cv = await import(cvPath);
    CategoryMapper = cm;
    completenessValidate = cv.completenessValidate;
  } catch (err) {
    console.warn(
      "[DocumentService] Could not load IRE modules directly:",
      err.message
    );
    // Graceful fallback — these are optional enrichments
    CategoryMapper = { mapAndNormalize: (d) => d };
    completenessValidate = () => [];
  }
}

// ── Input validation ──────────────────────────────────────────────────────────

function validateInputByDocumentType(input) {
  const schema = loadVariables(input.document_type);
  const errors = validateVariables(schema, input.variables || {});
  return errors.length > 0
    ? { valid: false, missing: errors }
    : { valid: true };
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateDocument(input) {
  await loadIREModules();

  // 0. Require document_type
  if (!input.document_type) {
    return {
      draft: null,
      validation: {
        certified: false,
        risk_level: "BLOCKED",
        issue_count: 1,
        issues: [
          {
            rule_id: "MISSING_DOCUMENT_TYPE",
            severity: "CRITICAL",
            message: "document_type is required.",
          },
        ],
      },
    };
  }

  // 1. Validate required input fields
  const inputCheck = validateInputByDocumentType(input);
  if (!inputCheck.valid) {
    return {
      draft: null,
      validation: {
        certified: false,
        risk_level: "BLOCKED",
        issue_count: inputCheck.missing.length,
        issues: inputCheck.missing.map((field) => ({
          rule_id: "MISSING_REQUIRED_INPUT",
          severity: "CRITICAL",
          message: `Missing required field: ${field}`,
        })),
      },
    };
  }

  // 2. Assemble base draft from KB
  let baseDraft = assembleDocument(input.document_type, input.variables);

  // 3. Inject user variables into clause text
  baseDraft = injectDraftVariables(baseDraft, input.variables);

  // 4. Call AI to draft clause text
  const aiResponse = await callAI({ ...input, baseDraft });

  if (!aiResponse.success) {
    const isTimeout = aiResponse.error === "TIMEOUT";
    return {
      draft: null,
      validation: null,
      error: isTimeout
        ? "The AI took too long to respond. Please try again — this is usually a temporary issue."
        : `AI generation failed: ${aiResponse.error}`,
    };
  }

  const MAX_REGEN = 2;
  let attempts = 0;
  let draft = null;
  let validation = null;
  let currentAI = aiResponse;

  while (attempts <= MAX_REGEN) {
    const aiContent = currentAI.draft;

    // 5. Build structured draft from AI output
    draft = buildStructuredDraft(aiContent, baseDraft);

    // 6. Legal enrichments
    draft = injectDoctrine(draft);
    draft = enforceScopeGuard(draft, input);
    draft = resolveSignatures(draft, input);

    // 7. Commercial enhancements (inject liability cap, indemnity, force majeure if missing)
    draft = enhanceCommercially(draft);

    // 8. Ensure document_type propagates
    draft.document_type = input.document_type;

    // 9. Normalize clause categories via CategoryMapper
    try {
      const normalized = CategoryMapper.mapAndNormalize(draft);
      draft.clauses = normalized.clauses || draft.clauses;
    } catch {
      /* non-fatal */
    }

    // 10. Completeness validation
    let completenessIssues = [];
    try {
      completenessIssues = completenessValidate(draft) || [];
    } catch {
      /* non-fatal */
    }

    // 11. IRE legal validation
    const coreValidation = await validate({
      document_type: draft.document_type,
      clauses: draft.clauses,
      jurisdiction: input.jurisdiction,
    });

    // 12. Commercial validation
    const commercialIssues = commercialValidate(draft, input.document_type);

    // 13. Aggregate
    const allIssues = deduplicateIssues([
      ...(coreValidation.issues || []),
      ...completenessIssues,
      ...commercialIssues,
    ]);

    // For generated docs: only issues with blocks_generation=true block certification.
    // This is data-driven — each rule in illegal_clauses.rules.json declares
    // whether it should block a freshly generated document or just be advisory.
    // Rules that detect truly illegal content (bonded labour, ouster of courts, etc.)
    // set blocks_generation=true. Style/compliance issues set blocks_generation=false.
    const blockingIssues = allIssues.filter(
      (i) =>
        i.blocks_generation === true ||
        (i.blocks_generation === undefined && i.severity === "CRITICAL")
    );
    const advisoryIssues = allIssues.filter(
      (i) =>
        i.blocks_generation === false ||
        (i.blocks_generation === undefined && i.severity !== "CRITICAL")
    );

    const legalRisk = computeRisk(coreValidation.issues || []);
    const commercialRisk = computeRisk(commercialIssues);
    const overallRisk = blockingIssues.length > 0 ? "BLOCKED" : "LOW";
    const hasBlocking = blockingIssues.length > 0;

    validation = {
      certified: !hasBlocking,
      legal_risk: hasBlocking ? "BLOCKED" : "LOW",
      commercial_risk: commercialRisk,
      overall_risk: overallRisk,
      risk_level: overallRisk,
      issue_count: blockingIssues.length,
      issues: blockingIssues, // only truly blocking issues shown as problems
      advisory_issues: advisoryIssues, // everything else shown as advisory
      layers: coreValidation._layers || null,
      is_generated: true,
    };

    if (!hasBlocking) break;

    // Regenerate with IRE feedback
    const regen = await callAI({
      ...input,
      baseDraft,
      regenerationContext: {
        previousIssues: validation.issues.filter(
          (i) => i.severity === "CRITICAL"
        ),
      },
    });
    if (!regen.success) break;
    currentAI = regen;
    attempts++;
  }

  return { draft, validation };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function deduplicateIssues(issues = []) {
  const seen = new Set();
  return issues.filter((issue) => {
    if (!issue?.rule_id) return true;
    if (seen.has(issue.rule_id)) return false;
    seen.add(issue.rule_id);
    return true;
  });
}
