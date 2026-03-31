import {
  callGemini,
  callGeminiChatRaw,
  callGeminiFixRaw,
  callGeminiSafetyRaw,
} from "./geminiClient.js";
import {
  callGroq,
  callGroqChat,
  callGroqFix,
  callGroqSafetyRaw,
} from "./groqClient.js";
import { buildPrompt } from "./promptBuilder.js";

const FALLBACK_ERRORS = new Set([
  "RATE_LIMITED",
  "TIMEOUT",
  "AI_PROVIDER_ERROR",
  "NO_MODEL_AVAILABLE",
]);
const PROVIDER_DISCLOSURE_REPLY =
  "I'm the LegalAId AI assistant for this workspace. I can help with clause edits, explanations, risk review, and document improvements, but I don't expose internal provider details.";

function canUseGroq() {
  return Boolean(process.env.GROQ_API_KEY);
}

function isProviderDisclosureQuestion(message = "") {
  const normalized = String(message || "").toLowerCase();

  return (
    /\b(gemini|groq|openai|anthropic|claude|gpt|llama)\b/.test(normalized) ||
    /\b(which|what)\s+(model|ai|provider)\b/.test(normalized) ||
    /\bwhat\s+are\s+you\s+using\b/.test(normalized) ||
    /\bbackend\s+(model|provider|ai)\b/.test(normalized) ||
    (/\bprovider\b/.test(normalized) && /\b(use|using|used|which|what)\b/.test(normalized))
  );
}

function shouldUseGroqFallback(response) {
  return !response?.success && canUseGroq() && FALLBACK_ERRORS.has(response.error);
}

function mergeFailedResponses(primary, fallback) {
  return {
    success: false,
    error: fallback?.error || primary?.error || "AI_PROVIDER_ERROR",
    details: [
      primary?.details ? `Gemini: ${primary.details}` : null,
      fallback?.details ? `Groq: ${fallback.details}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    fallbackAttempted: true,
  };
}

export async function callAI(input) {
  const prompt = buildPrompt(input);
  const response = await callGemini(prompt);

  if (shouldUseGroqFallback(response)) {
    console.warn(`[callAI] Gemini failed with ${response.error}. Trying Groq backup.`);
    const fallback = await callGroq(prompt);

    if (fallback.success) {
      return {
        ...fallback,
        provider: "groq",
        fallbackFrom: "gemini",
      };
    }

    console.error("[callAI] Groq backup failed:", fallback.details);
    return mergeFailedResponses(response, fallback);
  }

  if (!response.success && response.error === "AI_PROVIDER_ERROR") {
    console.error("[callAI] Provider error:", response.details);
  }

  return { ...response, provider: "gemini" };
}

export async function callAIChat(draft, message) {
  if (isProviderDisclosureQuestion(message)) {
    return {
      type: "reply",
      reply: PROVIDER_DISCLOSURE_REPLY,
      edits: [],
    };
  }

  const response = await callGeminiChatRaw(draft, message);

  if (response.success) {
    return response.data;
  }

  if (shouldUseGroqFallback(response)) {
    console.warn(
      `[callAIChat] Gemini failed with ${response.error}. Trying Groq backup.`
    );
    const fallback = await callGroqChat(draft, message);

    if (fallback.success) {
      return fallback.data;
    }

    console.error("[callAIChat] Groq backup failed:", fallback.details);
  }

  return {
    type: "reply",
    reply:
      response.error === "RATE_LIMITED"
        ? "AI is temporarily rate limited. Please wait a moment and try again."
        : "AI temporarily unavailable. Please try again.",
  };
}

export async function callAIFix(draft, issue) {
  const response = await callGeminiFixRaw(draft, issue);

  if (response.success) {
    return response.data;
  }

  if (shouldUseGroqFallback(response)) {
    console.warn(
      `[callAIFix] Gemini failed with ${response.error}. Trying Groq backup.`
    );
    const fallback = await callGroqFix(draft, issue);

    if (fallback.success) {
      return fallback.data;
    }

    console.error("[callAIFix] Groq backup failed:", fallback.details);
  }

  return { explanation: "Fix failed - please try again.", edits: [] };
}

export async function callAISafetyRaw(
  prompt,
  { schemaName = "safety_response", schema } = {}
) {
  const response = await callGeminiSafetyRaw(prompt);

  if (response.success) {
    return {
      ...response,
      provider: "gemini",
    };
  }

  if (shouldUseGroqFallback(response)) {
    console.warn(
      `[callAISafety] Gemini failed with ${response.error}. Trying Groq backup.`
    );

    const fallback = await callGroqSafetyRaw(prompt, {
      schemaName,
      schema,
    });

    if (fallback.success) {
      return {
        ...fallback,
        provider: "groq",
        fallbackFrom: "gemini",
      };
    }

    console.error("[callAISafety] Groq backup failed:", fallback.details);
    return mergeFailedResponses(response, fallback);
  }

  return {
    ...response,
    provider: "gemini",
  };
}
