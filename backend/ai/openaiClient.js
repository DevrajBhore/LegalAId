import "../loadEnv.js";

import { createOpenAICompatibleClient } from "./openaiCompatible.js";

// Native OpenAI provider. Set OPENAI_API_KEY (and optionally OPENAI_MODEL /
// OPENAI_BASE_URL) and select it via AI_PROVIDER=openai — no code changes.
const client = createOpenAICompatibleClient({
  label: "OpenAI",
  apiKeyName: "OPENAI_API_KEY",
  getApiKey: () => process.env.OPENAI_API_KEY,
  getBaseUrl: () => process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  getModel: () => process.env.OPENAI_MODEL || "gpt-4o-mini",
  timeout: 60_000,
});

export const callOpenAI = client.callGenerate;
export const callOpenAIChat = client.callChat;
export const callOpenAIFix = client.callFix;
export const callOpenAISafetyRaw = client.callSafetyRaw;
export const isOpenAIConfigured = client.isConfigured;
