// scraper/src/parsers/pdfParser.js
import pdfParse from "pdf-parse";

/**
 * parsePDF(buffer)
 * Accepts a Buffer (pdf bytes) and returns { text, numPages, info }
 */
export async function parsePDF(buffer) {
  try {
    const data = await pdfParse(buffer);
    const text = (data.text || "").replace(/\s+/g, " ").trim();
    return {
      text,
      numPages: data.numpages ?? null,
      info: data.info ?? {}
    };
  } catch (err) {
    console.error("parsePDF error:", err);
    return { text: "", error: err };
  }
}
