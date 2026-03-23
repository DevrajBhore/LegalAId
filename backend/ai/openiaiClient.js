import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function callOpenAI(prompt) {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You are a legal drafting assistant. Output JSON only."
      },
      {
        role: "user",
        content: JSON.stringify(prompt)
      }
    ],
    temperature: 0.2
  });

  return JSON.parse(response.choices[0].message.content);
}
