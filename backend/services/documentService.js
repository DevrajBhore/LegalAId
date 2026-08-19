import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IRE_ROOT = path.resolve(__dirname, "../../IRE");

export const GENERATION_GUARDRAIL_BUILD = "identity-guardrails-2026-08-16";

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
import { resolveStampFinancials } from "./stampDutyBasis.js";

// Attach the advisory risk-&-explainability report + lifecycle obligations to a
// successful generation.
function buildSuccess(draft, validation) {
  const variables = draft?.metadata?.source_variables || {};
  const markedDraft = {
    ...draft,
    metadata: {
      ...(draft?.metadata || {}),
      generation_guardrail_build: GENERATION_GUARDRAIL_BUILD,
    },
  };

  return {
    draft: markedDraft,
    validation,
    intelligence: buildDocumentIntelligence(markedDraft, validation),
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
    mode: input.mode,
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
      // The stamp rate table charges duty on totalRent / loanAmount /
      // guaranteedAmount. Nothing ever populated these, so the adequacy check
      // returned early on every document. Derive them from the intake form.
      financials: resolveStampFinancials(input.variables || {}),
      state:
        input.variables?.governing_law_state ||
        input.variables?.operating_state ||
        draft?.metadata?.state ||
        null,
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

// A document is BLOCKED only by a blocking issue. Advisory findings -- a missing
// nice-to-have clause, a formatting nit, a stamp or registration notice -- are
// things the user should see ON the draft, not reasons to withhold it. Before
// this, `certified` meant "zero actionable issues of any severity", so a single
// MEDIUM advisory returned draft: null and the user got nothing at all.
function hasBlockingIssues(validation) {
  return (validation?.blockingIssues?.length ?? 0) > 0;
}

// Stricter test, used only to decide whether a draft is good enough to stop
// trying: a clean result short-circuits the repair round and, on the semantic
// path, is preferred over falling back to the deterministic draft.
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
    generation_guardrail_build: GENERATION_GUARDRAIL_BUILD,
    error: latestIssue
      ? `We couldn't produce a fully validated first draft yet. Latest issue: ${latestIssue}`
      : "We couldn't produce a fully validated first draft yet. Please try again.",
  };
}

function applyDeterministicRepairRound(draft, validation, input) {
  const issues = [
    ...(validation?.blockingIssues || []),
    ...(validation?.advisoryIssues || []),
  ];

  if (!issues.length) {
    return draft;
  }

  return applyFinalDraftGuardrails(applyDeterministicFixes(draft, issues), input);
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

function isSignatureClause(clause = {}) {
  return (
    clause?.category === "SIGNATURE_BLOCK" ||
    clause?.clause_id === "CORE_SIGNATURE_BLOCK_001"
  );
}

const PROTECTED_SEMANTIC_CATEGORIES = new Set([
  "IDENTITY",
  "GOVERNING_LAW",
  "DISPUTE_RESOLUTION",
  "SIGNATURE_BLOCK",
  "SIGNATURES",
  "LIABILITY_CAP",
]);

const PROTECTED_SEMANTIC_CLAUSE_IDS = new Set([
  "CORE_IDENTITY_001",
  "CORE_GOVERNING_LAW_001",
  "CORE_DISPUTE_RESOLUTION_001",
  "CORE_SIGNATURE_BLOCK_001",
  "CORE_LIABILITY_CAP_001",
]);

function isProtectedSemanticClause(clause = {}) {
  return Boolean(
    clause?.locked ||
      isSignatureClause(clause) ||
      PROTECTED_SEMANTIC_CATEGORIES.has(clause?.category) ||
      PROTECTED_SEMANTIC_CLAUSE_IDS.has(clause?.clause_id)
  );
}

function applyFinalDraftGuardrails(draft, input) {
  let next = resolveSignatures(draft, input);
  next = applyDocumentHardening(next, input);
  next = applyDocumentQualityControls(next, input);
  next = lockCriticalClauses(next);
  next = normalizeClauseText(next);
  next = applyDocumentQualityControls(next, input);
  return next;
}

// Resilient per-clause merge. The rule engine has ALREADY decided the clause set
// (the seed); the AI's job is to TAILOR the wording of each clause to the user's
// situation. So we never decide structure from the AI — we keep the seed's exact
// clause set, and for each clause use the AI's rewritten text when it returned a
// usable one, otherwise keep the deterministic (hardened) version. This turns the
// old all-or-nothing gate (one drift → 100% boilerplate) into "tailor what the AI
// rewrote, keep the rest." The merged draft is still validated downstream, and if
// it fails the deterministic base draft remains the safety net.
export function mergeAIDraftWithSeed(seedDraft, aiDraft, input, provider, options = {}) {
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

  // Stability across regens: a clause is UNCHANGED if a prior accepted version
  // exists and its deterministic seed text is identical to this regen's. For
  // those we reuse the prior AI-tailored wording verbatim, so a revision that
  // only changes the term never silently re-words clauses the user accepted.
  const priorById = options.priorClausesById || null;
  const isUnchanged = (seedClause) => {
    if (!priorById) return false;
    const prior = priorById.get(seedClause.clause_id);
    return Boolean(
      prior &&
        typeof prior.text === "string" &&
        prior.text.trim() &&
        prior._seed_text !== undefined &&
        prior._seed_text === seedClause._seed_text
    );
  };

  let tailored = 0;
  let reused = 0;
  const mergedClauses = seedDraft.clauses.map((seedClause) => {
    if (isProtectedSemanticClause(seedClause)) {
      return seedClause;
    }

    if (isUnchanged(seedClause)) {
      reused += 1;
      const prior = priorById.get(seedClause.clause_id);
      return { ...seedClause, text: prior.text }; // keep accepted wording + new seed meta
    }
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
      _seed_text: seedClause._seed_text,
    };
  });

  const mergedDraft = normalizeClauseText({
    ...seedDraft,
    document_type: input.document_type,
    jurisdiction: aiDraft.jurisdiction || seedDraft.jurisdiction || "India",
    clauses: mergedClauses,
    metadata: {
      ...(seedDraft.metadata || {}),
      ai_touched: tailored > 0,
      ai_tailored_clause_count: tailored,
      ai_reused_clause_count: reused,
      ai_total_clause_count: seedDraft.clauses.length,
      ai_generation_provider: provider || null,
    },
  });

  return applyFinalDraftGuardrails(mergedDraft, input);
}

async function attemptSemanticDraft(seedDraft, input, options = {}) {
  if (!hasSemanticProviderConfigured()) {
    return null;
  }

  const priorClausesById = options.priorClausesById || null;

  // On a revision regen, only send the AI the clauses that actually changed
  // (new id, or its deterministic seed text differs from the accepted version).
  // Unchanged clauses keep their prior wording in the merge — so revisions are
  // fast and don't silently re-word what the user already accepted.
  let baseForAI = seedDraft;
  if (priorClausesById) {
    const changedClauses = seedDraft.clauses.filter((clause) => {
      if (isProtectedSemanticClause(clause)) return false;

      const prior = priorClausesById.get(clause.clause_id);
      return (
        !prior ||
        !prior.text ||
        prior._seed_text === undefined ||
        prior._seed_text !== clause._seed_text
      );
    });
    if (changedClauses.length === 0) {
      // Nothing to re-tailor — rebuild final wording from the prior draft.
      const unchangedDraft = normalizeClauseText({
        ...seedDraft,
        clauses: seedDraft.clauses.map((clause) => {
          if (isProtectedSemanticClause(clause)) {
            return clause;
          }

          const prior = priorClausesById.get(clause.clause_id);
          return prior?.text ? { ...clause, text: prior.text } : clause;
        }),
        metadata: { ...(seedDraft.metadata || {}), ai_touched: true, ai_tailored_clause_count: 0 },
      });

      return applyFinalDraftGuardrails(unchangedDraft, input);
    }
    baseForAI = { ...seedDraft, clauses: changedClauses };
  } else {
    const draftableClauses = seedDraft.clauses.filter(
      (clause) => !isProtectedSemanticClause(clause)
    );
    if (draftableClauses.length > 0) {
      baseForAI = { ...seedDraft, clauses: draftableClauses };
    }
  }

  const aiResult = await callAI({
    document_type: input.document_type,
    variables: input.variables || {},
    baseDraft: baseForAI,
    semanticContext: input.semanticContext,
  });

  if (!aiResult?.success || !aiResult?.draft) {
    return null;
  }

  return mergeAIDraftWithSeed(seedDraft, aiResult.draft, input, aiResult.provider, {
    priorClausesById,
  });
}

async function runGenerationStageValidation(draft, input, mode = "final") {
  return runDocumentValidation(
    {
      ...draft,
      jurisdiction: input.jurisdiction,
    },
    {
      // "final" = the strict six-layer gate (export). "generation" = the faster
      // interactive depth a revision regen requests. Export always forces final.
      mode,
      documentType: input.document_type,
      sourceVariables: input.variables,
      isUserEdit: false,
    }
  );
}

// Stamp each clause with its deterministic seed text so a later regen can tell
// which clauses are unchanged (and reuse their accepted wording).
function stampSeedText(draft) {
  if (!draft?.clauses) return draft;
  draft.clauses = draft.clauses.map((clause) => ({
    ...clause,
    _seed_text: typeof clause.text === "string" ? clause.text : "",
  }));
  return draft;
}

// Prior accepted clauses keyed by id (text + seed text) for stability matching.
function buildPriorClauseMap(priorDraft) {
  const map = new Map();
  for (const clause of priorDraft?.clauses || []) {
    if (clause?.clause_id) {
      map.set(clause.clause_id, { text: clause.text, _seed_text: clause._seed_text });
    }
  }
  return map;
}

export async function generateDocument(input, options = {}) {
  await loadIREModules();
  const mode = options.mode === "generation" ? "generation" : "final";
  const priorClausesById = options.priorDraft
    ? buildPriorClauseMap(options.priorDraft)
    : null;

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
    const semanticSeed = stampSeedText(
      applyGenerationStages(createBlueprintDraft(generationInput), generationInput)
    );
    const semanticDraft = await attemptSemanticDraft(semanticSeed, generationInput, {
      priorClausesById,
    });

    if (semanticDraft) {
      let draft = attachDraftContext(semanticDraft, generationInput, {
        resetBaseline: true,
      });
      let validation = await runGenerationStageValidation(draft, generationInput, mode);

      if (isGenerationReady(validation)) {
        return buildSuccess(draft, validation);
      }

      const repairedDraft = applyDeterministicRepairRound(
        draft,
        validation,
        generationInput
      );
      if (repairedDraft !== draft) {
        draft = attachDraftContext(repairedDraft, generationInput, {
          resetBaseline: true,
        });
        validation = await runGenerationStageValidation(draft, generationInput, mode);

        if (isGenerationReady(validation)) {
          return buildSuccess(draft, validation);
        }
      }

      // The tailored draft carries no blocking defect, only advisory findings.
      // Return it with those attached rather than discarding the tailoring and
      // falling back to boilerplate.
      if (!hasBlockingIssues(validation)) {
        return buildSuccess(draft, validation);
      }
    }
  }

  // Deterministic fallback remains the safety net when semantic drafting is
  // disabled, unavailable, or fails validation.
  const baseDraft = createDeterministicBaseDraft(generationInput);
  let draft = attachDraftContext(
    stampSeedText(applyGenerationStages(baseDraft, generationInput)),
    generationInput,
    {
      resetBaseline: true,
    }
  );
  let validation = await runGenerationStageValidation(draft, generationInput, mode);

  if (isGenerationReady(validation)) {
    return buildSuccess(draft, validation);
  }

  const repairedDraft = applyDeterministicRepairRound(
    draft,
    validation,
    generationInput
  );

  if (repairedDraft !== draft) {
    draft = attachDraftContext(repairedDraft, generationInput, {
      resetBaseline: true,
    });
    validation = await runGenerationStageValidation(draft, generationInput, mode);

    if (isGenerationReady(validation)) {
      return buildSuccess(draft, validation);
    }
  }

  // Only a blocking issue withholds the draft.
  if (!hasBlockingIssues(validation)) {
    return buildSuccess(draft, validation);
  }

  return buildGenerationFailureResult(validation);
}
