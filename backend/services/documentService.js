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
import { sanitizeVariablesForDocument } from "../config/variableConfig.js";
import { loadVariables } from "./variableLoader.js";
import { validateVariables } from "./variableValidator.js";
import { applyDeterministicFixes } from "./deterministicFixer.js";
import { enhanceCommercially } from "../commercial/commercialEngine.js";
import { normalizeClauseText } from "./clauseQualityNormalizer.js";
import { lockCriticalClauses } from "./clauseLocker.js";
import { resolveDependencies } from "./dependencyResolver.js";
import { injectJurisdictionRules } from "./jurisdictionEngine.js";
import { applyDocumentHardening } from "./documentHardening.js";
import { applyDocumentQualityControls } from "./documentQualityControl.js";
import {
  formatValidationResult,
  runDocumentValidation,
} from "./validationService.js";
import { callAI } from "../ai/aiClient.js";
import { deriveGenerationControls } from "./generationControls.js";
import { buildSemanticContext } from "./inputSemantics.js";
import { buildDocumentIntelligence } from "./documentIntelligence.js";
import { buildObligations } from "./obligationTracker.js";

// Attach the advisory risk-&-explainability report + lifecycle obligations to a
// successful generation.
function buildSuccess(draft, validation) {
  const variables = draft?.metadata?.source_variables || {};
  return {
    draft,
    validation,
    intelligence: buildDocumentIntelligence(draft, validation),
    obligations: buildObligations(draft, variables),
  };
}

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
  const sanitizedVariables = sanitizeVariablesForDocument(
    input.document_type,
    input.variables || {}
  );
  const errors = validateVariables(schema, sanitizedVariables, {
    documentType: input.document_type,
  });
  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function prepareGenerationInput(input = {}) {
  const sanitizedVariables = sanitizeVariablesForDocument(
    input.document_type,
    input.variables || {}
  );
  const variables = deriveGenerationControls(input.document_type, sanitizedVariables);

  return {
    ...input,
    variables,
    semanticContext: buildSemanticContext(input.document_type, variables),
  };
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
      interpreted_facts:
        input.semanticContext ||
        draft?.metadata?.interpreted_facts ||
        null,
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

  draft = resolveDependencies(draft, input);
  draft = injectJurisdictionRules(draft, input);
  draft = injectDoctrine(draft);
  draft = enforceScopeGuard(draft, input);
  draft = resolveSignatures(draft, input);
  draft = applyDocumentHardening(draft, input);
  draft = applyDocumentQualityControls(draft, input);
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
  draft = applyDocumentQualityControls(draft, input);

  return draft;
}

function shouldUseSemanticGeneration(input = {}) {
  // Explicit opt-out always wins (lets callers force the deterministic path).
  if (input?.semantic_generation === false) return false;
  if (String(input?.generation_style || "").toLowerCase() === "deterministic") {
    return false;
  }

  // Explicit opt-in.
  if (
    input?.semantic_generation === true ||
    String(input?.generation_style || "").toLowerCase() === "semantic"
  ) {
    return true;
  }

  // Default: use semantic drafting whenever an AI provider is configured. The
  // deterministic pipeline below remains the automatic fallback if the provider
  // is unavailable, errors, or the AI draft fails final validation.
  return hasSemanticProviderConfigured();
}

function hasSemanticProviderConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

// Resilient per-clause merge. The rule engine has ALREADY decided the clause set
// (the seed); the AI's job is to TAILOR the wording of each clause to the user's
// situation. So we never decide structure from the AI — we keep the seed's exact
// clause set, and for each clause use the AI's rewritten text when it returned a
// usable one, otherwise keep the deterministic (hardened) version. This turns the
// old all-or-nothing gate (one drift → 100% boilerplate) into "tailor what the AI
// rewrote, keep the rest." The merged draft is still validated downstream, and if
// it fails the deterministic base draft remains the safety net.
export function mergeAIDraftWithSeed(seedDraft, aiDraft, input, provider) {
  if (!seedDraft?.clauses?.length || !aiDraft?.clauses?.length) {
    return null;
  }

  // Reject only on a genuine error: the AI drafted the WRONG document type.
  if (
    aiDraft.document_type &&
    String(aiDraft.document_type).toUpperCase() !==
      String(input.document_type).toUpperCase()
  ) {
    return null;
  }

  // Index the AI clauses that are actually usable (real id + non-empty text).
  const aiById = new Map(
    aiDraft.clauses
      .filter((c) => c?.clause_id && typeof c.text === "string" && c.text.trim())
      .map((c) => [c.clause_id, c])
  );
  if (aiById.size === 0) {
    return null; // nothing usable — fall back to the deterministic draft
  }

  let tailored = 0;
  const mergedClauses = seedDraft.clauses.map((seedClause) => {
    const aiClause = aiById.get(seedClause.clause_id);
    if (!aiClause) {
      return seedClause; // keep the deterministic, hardened clause as-is
    }
    tailored += 1;
    return {
      ...seedClause,
      ...aiClause,
      clause_id: seedClause.clause_id, // structure is the rule engine's, not the AI's
      category: aiClause.category || seedClause.category,
      title:
        typeof aiClause.title === "string" && aiClause.title.trim()
          ? aiClause.title
          : seedClause.title || null,
      statutory_reference:
        aiClause.statutory_reference ?? seedClause.statutory_reference ?? null,
      text: aiClause.text.trim(),
    };
  });

  return normalizeClauseText({
    ...seedDraft,
    document_type: input.document_type,
    jurisdiction: aiDraft.jurisdiction || seedDraft.jurisdiction || "India",
    clauses: mergedClauses,
    metadata: {
      ...(seedDraft.metadata || {}),
      ai_touched: tailored > 0,
      ai_tailored_clause_count: tailored,
      ai_total_clause_count: seedDraft.clauses.length,
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
    semanticContext: input.semanticContext,
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

  const generationInput = prepareGenerationInput(input);

  if (shouldUseSemanticGeneration(input)) {
    const semanticSeed = applyGenerationStages(
      createBlueprintDraft(generationInput),
      generationInput
    );
    const semanticDraft = await attemptSemanticDraft(semanticSeed, generationInput);

    if (semanticDraft) {
      let draft = attachDraftContext(semanticDraft, generationInput, {
        resetBaseline: true,
      });
      let validation = await runGenerationStageValidation(draft, generationInput);

      if (isGenerationReady(validation)) {
        return buildSuccess(draft, validation);
      }

      const repairedDraft = applyDeterministicRepairRound(draft, validation);
      if (repairedDraft !== draft) {
        draft = attachDraftContext(repairedDraft, generationInput, {
          resetBaseline: true,
        });
        validation = await runGenerationStageValidation(draft, generationInput);

        if (isGenerationReady(validation)) {
          return buildSuccess(draft, validation);
        }
      }
    }
  }

  // Deterministic fallback remains the safety net when semantic drafting is
  // disabled, unavailable, or fails validation.
  const baseDraft = createDeterministicBaseDraft(generationInput);
  let draft = attachDraftContext(
    applyGenerationStages(baseDraft, generationInput),
    generationInput,
    {
      resetBaseline: true,
    }
  );
  let validation = await runGenerationStageValidation(draft, generationInput);

  if (isGenerationReady(validation)) {
    return buildSuccess(draft, validation);
  }

  const repairedDraft = applyDeterministicRepairRound(draft, validation);

  if (repairedDraft !== draft) {
    draft = attachDraftContext(repairedDraft, generationInput, {
      resetBaseline: true,
    });
    validation = await runGenerationStageValidation(draft, generationInput);

    if (isGenerationReady(validation)) {
      return buildSuccess(draft, validation);
    }
  }

  return buildGenerationFailureResult(validation);
}
