/**
 * providers.js  —  AI provider registry.
 *
 * Makes the AI layer provider-agnostic: switching providers is just env config.
 *   AI_PROVIDER           primary provider   (default: gemini)
 *   AI_FALLBACK_PROVIDER   backup provider    (default: groq)
 *
 * Each provider exposes the SAME interface: { name, isConfigured, generate,
 * chatRaw, fixRaw, safetyRaw }. To add a new OpenAI-compatible provider, add a
 * client (like openaiClient.js) and one entry here.
 */
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
  isGroqConfigured,
} from "./groqClient.js";
import {
  callOpenAI,
  callOpenAIChat,
  callOpenAIFix,
  callOpenAISafetyRaw,
  isOpenAIConfigured,
} from "./openaiClient.js";

const PROVIDERS = {
  gemini: {
    name: "gemini",
    isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
    generate: (prompt) => callGemini(prompt),
    chatRaw: (draft, message) => callGeminiChatRaw(draft, message),
    fixRaw: (draft, issue) => callGeminiFixRaw(draft, issue),
    // Gemini takes the schema under `responseSchema`.
    safetyRaw: (prompt, { schema } = {}) => callGeminiSafetyRaw(prompt, { responseSchema: schema }),
  },
  groq: {
    name: "groq",
    isConfigured: isGroqConfigured,
    generate: (prompt) => callGroq(prompt),
    chatRaw: (draft, message) => callGroqChat(draft, message),
    fixRaw: (draft, issue) => callGroqFix(draft, issue),
    safetyRaw: (prompt, opts) => callGroqSafetyRaw(prompt, opts),
  },
  openai: {
    name: "openai",
    isConfigured: isOpenAIConfigured,
    generate: (prompt) => callOpenAI(prompt),
    chatRaw: (draft, message) => callOpenAIChat(draft, message),
    fixRaw: (draft, issue) => callOpenAIFix(draft, issue),
    safetyRaw: (prompt, opts) => callOpenAISafetyRaw(prompt, opts),
  },
};

function resolve(name) {
  return PROVIDERS[String(name || "").toLowerCase().trim()] || null;
}

// Ordered list of providers to try: [primary, fallback]. Only includes
// configured ones, but always keeps the primary so its error surfaces clearly.
export function getProviderChain() {
  const primary = resolve(process.env.AI_PROVIDER) || PROVIDERS.gemini;
  const fallback = resolve(process.env.AI_FALLBACK_PROVIDER) || PROVIDERS.groq;

  const chain = [];
  if (primary.isConfigured()) chain.push(primary);
  if (fallback !== primary && fallback.isConfigured()) chain.push(fallback);
  if (chain.length === 0) {
    // Neither the selected primary nor fallback has a key, but another
    // registered provider does (e.g. only OPENAI_API_KEY is set while
    // AI_PROVIDER defaults to gemini). Use it rather than failing every call.
    const anyConfigured = Object.values(PROVIDERS).find((p) => p.isConfigured());
    if (anyConfigured) chain.push(anyConfigured);
  }
  if (chain.length === 0) chain.push(primary); // surface a clear "missing key" error
  return chain;
}

// Single source of truth for "is any AI provider usable right now". Callers
// must use this instead of checking individual *_API_KEY variables.
export function hasConfiguredProvider() {
  return getProviderChain().some((provider) => provider.isConfigured());
}

export function getProvider(name) {
  return resolve(name);
}
