import { buildPrompt } from "./promptBuilder.js";
import { getProviderChain } from "./providers.js";

const FALLBACK_ERRORS = new Set([
  "RATE_LIMITED",
  "TIMEOUT",
  "AI_PROVIDER_ERROR",
  "NO_MODEL_AVAILABLE",
]);
const PROVIDER_DISCLOSURE_REPLY =
  "I'm the LegalAId AI assistant for this workspace. I can help with clause edits, explanations, risk review, and document improvements, but I don't expose internal provider details.";

function isProviderDisclosureQuestion(message = "") {
  const normalized = String(message || "").toLowerCase();
  return (
    /\b(gemini|groq|openai|anthropic|claude|gpt|llama|mistral)\b/.test(normalized) ||
    /\b(which|what)\s+(model|ai|provider)\b/.test(normalized) ||
    /\bwhat\s+are\s+you\s+using\b/.test(normalized) ||
    /\bbackend\s+(model|provider|ai)\b/.test(normalized) ||
    (/\bprovider\b/.test(normalized) && /\b(use|using|used|which|what)\b/.test(normalized))
  );
}

function mergeFailedResponses(primary, fallback, chain) {
  return {
    success: false,
    error: fallback?.error || primary?.error || "AI_PROVIDER_ERROR",
    details: [
      primary?.details ? `${chain[0]?.name || "primary"}: ${primary.details}` : null,
      fallback?.details ? `${chain[1]?.name || "fallback"}: ${fallback.details}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    fallbackAttempted: Boolean(fallback),
  };
}

/**
 * Runs `invoke(provider)` across the configured provider chain: tries the
 * primary, and only falls back to the next provider on retryable errors. The
 * winning provider's name is attached to the response. Provider selection is
 * entirely env-driven (AI_PROVIDER / AI_FALLBACK_PROVIDER) — swapping providers
 * never touches this code.
 */
async function runWithFallback(invoke) {
  const chain = getProviderChain();
  let primaryResponse = null;

  for (let i = 0; i < chain.length; i++) {
    const provider = chain[i];
    const response = await invoke(provider);

    if (response?.success) {
      return i === 0
        ? { ...response, provider: provider.name }
        : { ...response, provider: provider.name, fallbackFrom: chain[0].name };
    }

    if (i === 0) primaryResponse = response;

    // Stop unless this is a retryable error and another provider remains.
    if (!FALLBACK_ERRORS.has(response?.error) || i === chain.length - 1) {
      if (i > 0) return mergeFailedResponses(primaryResponse, response, chain);
      return { ...response, provider: provider.name };
    }

    console.warn(
      `[AI] ${provider.name} failed with ${response.error}. Trying ${chain[i + 1].name}.`
    );
  }

  return primaryResponse || { success: false, error: "AI_PROVIDER_ERROR" };
}

export async function callAI(input) {
  const prompt = buildPrompt(input);
  return runWithFallback((provider) => provider.generate(prompt));
}

export async function callAIChat(draft, message) {
  if (isProviderDisclosureQuestion(message)) {
    return { type: "reply", reply: PROVIDER_DISCLOSURE_REPLY, edits: [] };
  }

  const response = await runWithFallback((provider) => provider.chatRaw(draft, message));
  if (response?.success) return response.data;

  return {
    type: "reply",
    reply:
      response?.error === "RATE_LIMITED"
        ? "AI is temporarily rate limited. Please wait a moment and try again."
        : "AI temporarily unavailable. Please try again.",
  };
}

export async function callAIFix(draft, issue) {
  const response = await runWithFallback((provider) => provider.fixRaw(draft, issue));
  if (response?.success) return response.data;
  return { explanation: "Fix failed - please try again.", edits: [] };
}

export async function callAISafetyRaw(prompt, { schemaName = "safety_response", schema } = {}) {
  return runWithFallback((provider) => provider.safetyRaw(prompt, { schemaName, schema }));
}
