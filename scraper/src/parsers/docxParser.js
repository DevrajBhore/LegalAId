import mammoth from "mammoth";

export async function parseDOCX(buffer) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = String(result?.value || "").replace(/\s+/g, " ").trim();

    return {
      text,
      messages: result?.messages || [],
    };
  } catch (error) {
    console.error("parseDOCX error:", error);
    return {
      text: "",
      error,
    };
  }
}
