import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
});

const BASE = "knowledge-base/clause_library";

async function fillClause(filePath) {
  const clause = JSON.parse(fs.readFileSync(filePath));

  if (clause.text && clause.text.length > 20) {
    console.log("Skipping:", filePath);
    return;
  }

  const prompt = `
You are a legal drafting assistant for Indian contracts.

Generate a clause for:

Clause ID: ${clause.clause_id}
Name: ${clause.name}
Category: ${clause.category}

You are creating clauses for a legal clause library.

Rules:
- Clause must be short (1-2 sentences).
- Do NOT include placeholders like [Annexure].
- Use generic wording suitable for many contracts.
- Follow Indian law.
- Return raw JSON only.

Return format:

{
"text": "...",
"legal_basis":[{"act":"...","section":"..."}],
"invalid_if":["..."]
}
`;

  const result = await model.generateContent(prompt);

  const responseText = result.response.text();

  let clean = responseText.trim();

  // remove markdown code fences
  if (clean.startsWith("```")) {
    clean = clean
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
  }

  const parsed = JSON.parse(clean);

  clause.text = parsed.text;
  clause.legal_basis = parsed.legal_basis || [];
  clause.invalid_if = parsed.invalid_if || [];

  fs.writeFileSync(filePath, JSON.stringify(clause, null, 2));

  console.log("Filled:", filePath);
}

async function run() {
  const folders = ["core", "commercial", "employment", "property", "finance"];

  for (const folder of folders) {
    const dir = path.join(BASE, folder);

    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);

    for (const file of files) {
      await fillClause(path.join(dir, file));
    }
  }
}

run();
