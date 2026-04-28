import { PDFParse } from "pdf-parse";

export async function parsePDF(buffer) {
  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText({ parseHyperlinks: false });
    const infoResult = await parser.getInfo();
    const text = (textResult?.text || "").replace(/\s+/g, " ").trim();

    return {
      text,
      numPages: textResult?.total ?? infoResult?.total ?? null,
      info: infoResult?.info ?? {},
    };
  } catch (error) {
    console.error("parsePDF error:", error);
    return {
      text: "",
      error,
    };
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch {
        // Ignore destroy failures from partially-loaded documents.
      }
    }
  }
}
