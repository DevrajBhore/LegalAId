import dotenv from "dotenv";
dotenv.config();

import { createOpenAICompatibleClient } from "./openaiCompatible.js";

// Groq is OpenAI-compatible — uses the shared factory so its behavior stays
// identical to OpenAI/other providers.
const client = createOpenAICompatibleClient({
  label: "Groq",
  apiKeyName: "GROQ_API_KEY",
  getApiKey: () => process.env.GROQ_API_KEY,
  getBaseUrl: () => process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  getModel: () => process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  timeout: 60_000,
});

export const callGroq = client.callGenerate;
export const callGroqChat = client.callChat;
export const callGroqFix = client.callFix;
export const callGroqSafetyRaw = client.callSafetyRaw;
export const isGroqConfigured = client.isConfigured;
