import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IRE_ROOT = path.resolve(__dirname, "../../IRE");

import { injectDoctrine } from "./doctrineInjector.js";
import { enforceScopeGuard } from "./scopeGuard.js";
import { resolveSignatures } from "./signatureResolver.js";
import { assembleDocument } from "./clauseAssembler.js";
import { injectDraftVariables } from "./draftVariableInjector.js";
import { loadVariables } from "./variableLoader.js";
import { validateVariables } from "./variableValidator.js";
import { applyDeterministicFixes } from "./deterministicFixer.js";
import { enhanceCommercially } from "../commercial/commercialEngine.js";
import { normalizeClauseText } from "./clauseQualityNormalizer.js";
import { lockCriticalClauses } from "./clauseLocker.js";
import { resolveDependencies } from "./dependencyResolver.js";
import { injectJurisdictionRules } from "./jurisdictionEngine.js";
import { applyDocumentHardening } from "./documentHardening.js";
import {
  formatValidationResult,
  runDocumentValidation,
} from "./validationService.js";
import { callAI } from "../ai/aiClient.js";

let CategoryMapper = null;

async function loadIREModules() {
  if (CategoryMapper) return;

  try {
    const cmPath = pathToFileURL(
      path.join(IRE_ROOT, "src/indian-rule-engine/CategoryMapper.js")
    ).href;
    const cm = await import(cmPath);
    CategoryMapper = cm;
  } catch (err) {
    console.warn(
      "[DocumentService] Could not load IRE modules directly:",
      err.message
    );
    CategoryMapper = { mapAndNormalize: (draft) => draft };
  }
}

function validateInputByDocumentType(input) {
  const schema = loadVariables(input.document_type);
  const errors = validateVariables(schema, input.variables || {}, {
    documentType: input.document_type,
  });
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function buildBlockedGenerationResult(issues, { statusCode = 422, error } = {}) {
  const validation = formatValidationResult({
    mode: "generation",
    issues,
    risk: "BLOCKED",
    certified: false,
  });
  const latestIssue =
    issues?.[0]?.message ||
    validation?.blockingIssues?.[0]?.message ||
    validation?.advisoryIssues?.[0]?.message;

  return {
    draft: null,
    validation,
    statusCode,
    error:
      error ||
      latestIssue ||
      "We couldn't generate a valid first draft from the supplied inputs.",
  };
}

function createBlueprintDraft(input) {
  return assembleDocument(input.document_type, input.variables);
}

function createDeterministicBaseDraft(input) {
  return injectDraftVariables(createBlueprintDraft(input), input.variables);
}

function sanitizeSourceVariables(variables = {}) {
  return Object.fromEntries(
    Object.entries(variables || {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
  );
}

function buildBaselineClauseMap(clauses = []) {
  return Object.fromEntries(
    (clauses || [])
      .filter((clause) => clause?.clause_id)
      .map((clause) => [
        clause.clause_id,
        {
          clause_id: clause.clause_id,
          title: clause.title || null,
          category: clause.category || null,
          text: clause.text || "",
        },
      ])
  );
}

function attachDraftContext(draft, input, { resetBaseline = false } = {}) {
  const existingBaseline = draft?.metadata?.baseline_clause_map;

  return {
    ...draft,
    document_type: input.document_type,
    jurisdiction: input.jurisdiction || draft?.jurisdiction || "India",
    metadata: {
      ...(draft?.metadata || {}),
      document_type: input.document_type,
      jurisdiction: input.jurisdiction || draft?.jurisdiction || "India",
      source_variables: sanitizeSourceVariables(input.variables),
      ai_touched: Boolean(draft?.metadata?.ai_touched),
      user_edited: Boolean(draft?.metadata?.user_edited),
      baseline_clause_map:
        resetBaseline || !existingBaseline
          ? buildBaselineClauseMap(draft?.clauses || [])
          : existingBaseline,
    },
  };
}

function isGenerationReady(validation) {
  return (
    validation?.certified === true &&
    (validation?.summary?.total ?? validation?.issueCount ?? 0) === 0
  );
}

function buildGenerationFailureResult(validation) {
  const latestIssue =
    validation?.blockingIssues?.[0]?.message ||
    validation?.advisoryIssues?.[0]?.message;
  return {
    draft: null,
    validation,
    statusCode: 422,
    error: latestIssue
      ? `We couldn't produce a fully validated first draft yet. Latest issue: ${latestIssue}`
      : "We couldn't produce a fully validated first draft yet. Please try again.",
  };
}

function applyDeterministicRepairRound(draft, validation) {
  const issues = [
    ...(validation?.blockingIssues || []),
    ...(validation?.advisoryIssues || []),
  ];

  if (!issues.length) {
    return draft;
  }

  return applyDeterministicFixes(draft, issues);
}

function applyGenerationStages(draft, input) {
  if (!draft.metadata) draft.metadata = {};

  draft = resolveDependencies(draft);
  draft = injectJurisdictionRules(draft, input);
  draft = injectDoctrine(draft);
  draft = enforceScopeGuard(draft, input);
  draft = resolveSignatures(draft, input);
  draft = applyDocumentHardening(draft, input);
  draft = enhanceCommercially(draft);
  draft = lockCriticalClauses(draft);
  draft.document_type = input.document_type;

  try {
    const normalized = CategoryMapper.mapAndNormalize(draft);
    draft.clauses = normalized.clauses || draft.clauses;
  } catch {
    /* non-fatal */
  }

  draft = normalizeClauseText(draft);

  return draft;
}

function shouldUseSemanticGeneration(input = {}) {
  return (
    input?.semantic_generation === true ||
    String(input?.generation_style || "").toLowerCase() === "semantic"
  );
}

function hasSemanticProviderConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

function mergeAIDraftWithSeed(seedDraft, aiDraft, input, provider) {
  if (!seedDraft?.clauses?.length || !aiDraft?.clauses?.length) {
    return null;
  }

  if (
    aiDraft.document_type &&
    String(aiDraft.document_type).toUpperCase() !==
      String(input.document_type).toUpperCase()
  ) {
    return null;
  }

  const aiClauses = aiDraft.clauses.filter((clause) => clause?.clause_id);
  const aiById = new Map(aiClauses.map((clause) => [clause.clause_id, clause]));

  if (
    aiById.size !== seedDraft.clauses.length ||
    aiClauses.length !== seedDraft.clauses.length
  ) {
    return null;
  }

  const mergedClauses = [];

  for (const seedClause of seedDraft.clauses) {
    const aiClause = aiById.get(seedClause.clause_id);

    if (!aiClause || typeof aiClause.text !== "string" || !aiClause.text.trim()) {
      return null;
    }

    mergedClauses.push({
      ...seedClause,
      ...aiClause,
      clause_id: seedClause.clause_id,
      category: aiClause.category || seedClause.category,
      title:
        typeof aiClause.title === "string" && aiClause.title.trim()
          ? aiClause.title
          : seedClause.title || null,
      statutory_reference:
        aiClause.statutory_reference ?? seedClause.statutory_reference ?? null,
      text: aiClause.text.trim(),
    });
  }

  return normalizeClauseText({
    ...seedDraft,
    document_type: input.document_type,
    jurisdiction: aiDraft.jurisdiction || seedDraft.jurisdiction || "India",
    clauses: mergedClauses,
    metadata: {
      ...(seedDraft.metadata || {}),
      ai_touched: true,
      ai_generation_provider: provider || null,
    },
  });
}

async function attemptSemanticDraft(seedDraft, input) {
  if (!hasSemanticProviderConfigured()) {
    return null;
  }

  const aiResult = await callAI({
    document_type: input.document_type,
    variables: input.variables || {},
    baseDraft: seedDraft,
  });

  if (!aiResult?.success || !aiResult?.draft) {
    return null;
  }

  return mergeAIDraftWithSeed(
    seedDraft,
    aiResult.draft,
    input,
    aiResult.provider
  );
}

async function runGenerationStageValidation(draft, input) {
  return runDocumentValidation(
    {
      ...draft,
      jurisdiction: input.jurisdiction,
    },
    {
      mode: "final",
      documentType: input.document_type,
      sourceVariables: input.variables,
      isUserEdit: false,
    }
  );
}

export async function generateDocument(input) {
  await loadIREModules();

  if (!input.document_type) {
    return buildBlockedGenerationResult([
      {
        rule_id: "MISSING_DOCUMENT_TYPE",
        severity: "CRITICAL",
        message: "document_type is required.",
      },
    ], { statusCode: 400 });
  }

  const inputCheck = validateInputByDocumentType(input);
  if (!inputCheck.valid) {
    return buildBlockedGenerationResult(
      inputCheck.errors.map((message, index) => ({
        rule_id: `INVALID_INPUT_${index + 1}`,
        severity: "CRITICAL",
        message,
      })),
      { statusCode: 400 }
    );
  }

  if (shouldUseSemanticGeneration(input)) {
    const semanticSeed = applyGenerationStages(createBlueprintDraft(input), input);
    const semanticDraft = await attemptSemanticDraft(semanticSeed, input);

    if (semanticDraft) {
      let draft = attachDraftContext(semanticDraft, input, {
        resetBaseline: true,
      });
      let validation = await runGenerationStageValidation(draft, input);

      if (isGenerationReady(validation)) {
        return { draft, validation };
      }

      const repairedDraft = applyDeterministicRepairRound(draft, validation);
      if (repairedDraft !== draft) {
        draft = attachDraftContext(repairedDraft, input, { resetBaseline: true });
        validation = await runGenerationStageValidation(draft, input);

        if (isGenerationReady(validation)) {
          return { draft, validation };
        }
      }
    }
  }

  // Deterministic fallback remains the safety net when semantic drafting is
  // disabled, unavailable, or fails validation.
  const baseDraft = createDeterministicBaseDraft(input);
  let draft = attachDraftContext(applyGenerationStages(baseDraft, input), input, {
    resetBaseline: true,
  });
  let validation = await runGenerationStageValidation(draft, input);

  if (isGenerationReady(validation)) {
    return { draft, validation };
  }

  const repairedDraft = applyDeterministicRepairRound(draft, validation);

  if (repairedDraft !== draft) {
    draft = attachDraftContext(repairedDraft, input, { resetBaseline: true });
    validation = await runGenerationStageValidation(draft, input);

    if (isGenerationReady(validation)) {
      return { draft, validation };
    }
  }

  return buildGenerationFailureResult(validation);
}
