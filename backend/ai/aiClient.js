import { callGemini } from "./geminiClient.js";
import { buildPrompt } from "./promptBuilder.js";

export async function callAI(input) {
  const prompt = buildPrompt(input);

  const response = await callGemini(prompt);

  return response;
}