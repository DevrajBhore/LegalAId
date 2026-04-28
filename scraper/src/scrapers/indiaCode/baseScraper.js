import { fetchBinary, fetchHtml } from "../../common/request.js";
import { extractHeadings, extractText } from "../../parsers/htmlParser.js";
import { cleanText, splitSections } from "../../parsers/textProcessor.js";

export function slugify(value) {
  return value
    .toString()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

export function makeActId(title, year) {
  return slugify(`${title}_${year ?? "nodate"}`);
}

function normalizeUrl(url) {
  const trimmed = String(url || "").trim();
  const preserved = [];
  const protectedValue = trimmed.replace(/%[0-9A-Fa-f]{2}/g, (match) => {
    preserved.push(match);
    return `__PRESERVED_PERCENT_${preserved.length - 1}__`;
  });

  return encodeURI(protectedValue).replace(
    /__PRESERVED_PERCENT_(\d+)__/g,
    (_, index) => preserved[Number(index)]
  );
}

function resolveRedirectUrl(currentUrl, location) {
  if (!location) {
    return normalizeUrl(currentUrl);
  }

  return normalizeUrl(new URL(location, currentUrl).toString());
}

function extractRawQueryValue(url, key) {
  const match = String(url || "").match(
    new RegExp(`[?&]${key}=([^&]+)`, "i")
  );
  return match ? match[1] : "";
}

function parseIndiaCodeFileReference(url = "") {
  try {
    const rawPath = extractRawQueryValue(url, "path");
    const rawFile = extractRawQueryValue(url, "file");
    const decodedPath = decodeURIComponent(rawPath || "");
    const pathSegments = decodedPath.split("/").filter(Boolean);
    const actid = pathSegments[0] || "";
    const typeSegment = pathSegments.find((segment) =>
      /individualfile$/i.test(segment)
    );
    const type = String(typeSegment || "")
      .replace(/individualfile$/i, "")
      .replace(/[_-]+$/g, "")
      .trim();
    const decodedFile = rawFile ? decodeURIComponent(rawFile) : "";

    if (!actid || !type || !rawFile) {
      return null;
    }

    return {
      actid,
      type,
      rawFile,
      decodedFile,
    };
  } catch {
    return null;
  }
}

function buildIndiaCodeRecoveryUrls(url = "") {
  const normalizedPrimary = normalizeUrl(url);
  const candidates = [normalizedPrimary];
  const parsed = parseIndiaCodeFileReference(url);

  if (!parsed) {
    return [...new Set(candidates.filter(Boolean))];
  }

  const { actid, type, rawFile, decodedFile } = parsed;
  const encodedFile = encodeURIComponent(decodedFile);

  candidates.push(
    normalizeUrl(
      `https://upload.indiacode.nic.in/showfile?actid=${actid}&type=${type}&filename=${rawFile}`
    )
  );
  candidates.push(
    normalizeUrl(
      `https://upload.indiacode.nic.in/showfile?actid=${actid}&type=${type}&filename=${encodedFile}`
    )
  );
  candidates.push(
    normalizeUrl(
      `https://www.indiacode.nic.in/showfile?actid=${actid}&type=${type}&filename=${rawFile}`
    )
  );
  candidates.push(
    normalizeUrl(
      `https://www.indiacode.nic.in/showfile?actid=${actid}&type=${type}&filename=${encodedFile}`
    )
  );

  return [...new Set(candidates.filter(Boolean))];
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

function looksLikePdfBuffer(buffer) {
  if (!buffer?.length) {
    return false;
  }

  return buffer.slice(0, 5).toString("utf8") === "%PDF-";
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSourceError(buffer, response) {
  const text = Buffer.from(buffer).toString("utf8");
  const cleaned = stripHtml(text);
  const message =
    cleaned.match(/(?:Message|Error)\s+(.+?)(?:Description|Exception|$)/i)?.[1]?.trim() ||
    cleaned.match(/There is some problem\.[^.]*/i)?.[0]?.trim() ||
    cleaned.slice(0, 240) ||
    "Source file could not be retrieved as a valid PDF.";

  return {
    code: "source_unavailable",
    status: response?.status ?? null,
    message,
  };
}

async function fetchBinaryWithNormalizedRedirects(url, maxRedirects = 5) {
  let currentUrl = normalizeUrl(url);
  let response;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    response = await fetchBinary(currentUrl, { maxRedirects: 0 });

    if (!isRedirectStatus(response.status) || !response.headers?.location) {
      break;
    }

    currentUrl = resolveRedirectUrl(currentUrl, response.headers.location);
  }

  return {
    response,
    finalUrl: currentUrl,
  };
}

export async function fetchPageText(url) {
  const res = await fetchHtml(url);
  const html = res.data ?? "";
  const text = extractText(html);
  const headings = extractHeadings(html);

  return {
    html,
    text: cleanText(text),
    headings,
    url,
    status: res.status,
  };
}

export async function fetchPDFText(url) {
  const candidateUrls = buildIndiaCodeRecoveryUrls(url);
  const attempts = [];
  let lastSourceError = null;
  let lastContentType = null;
  let lastFinalUrl = null;

  for (const candidateUrl of candidateUrls) {
    try {
      const {
        response: res,
        finalUrl,
      } = await fetchBinaryWithNormalizedRedirects(candidateUrl, 5);
      const buffer = Buffer.from(res.data ?? []);
      const contentType = res.headers?.["content-type"] ?? null;
      lastContentType = contentType;
      lastFinalUrl = finalUrl;

      if (!looksLikePdfBuffer(buffer) && !String(contentType || "").includes("pdf")) {
        const sourceError = extractSourceError(buffer, res);
        lastSourceError = sourceError;
        attempts.push({
          url: candidateUrl,
          finalUrl,
          status: res.status ?? null,
          outcome: "source_error",
          error: sourceError.message,
        });
        continue;
      }

      const { parsePDF } = await import("../../parsers/pdfParser.js");
      const parsed = await parsePDF(buffer);

      if (parsed.error) {
        lastSourceError = {
          code: "pdf_parse_failed",
          status: res.status ?? null,
          message: parsed.error?.message || String(parsed.error),
        };
        attempts.push({
          url: candidateUrl,
          finalUrl,
          status: res.status ?? null,
          outcome: "parse_error",
          error: lastSourceError.message,
        });
        continue;
      }

      attempts.push({
        url: candidateUrl,
        finalUrl,
        status: res.status ?? null,
        outcome: "parsed",
        error: null,
      });

      return {
        ...parsed,
        contentType,
        finalUrl,
        attemptedUrls: candidateUrls,
        attempts,
        recoveredFromAlternate:
          normalizeUrl(candidateUrl) !== normalizeUrl(url),
      };
    } catch (error) {
      lastSourceError = {
        code: "source_fetch_failed",
        status: error?.response?.status ?? null,
        message: error?.message || String(error),
      };
      attempts.push({
        url: candidateUrl,
        finalUrl: null,
        status: error?.response?.status ?? null,
        outcome: "request_error",
        error: lastSourceError.message,
      });
    }
  }

  return {
    text: "",
    numPages: null,
    info: {},
    sourceError:
      lastSourceError || {
        code: "source_unavailable",
        status: null,
        message: "Source file could not be retrieved as a valid PDF.",
      },
    contentType: lastContentType,
    finalUrl: lastFinalUrl,
    attemptedUrls: candidateUrls,
    attempts,
    recoveredFromAlternate: false,
  };
}

export function buildSections(text) {
  const parts = splitSections(text);
  return parts.map((part, index) => {
    const numberMatch = part.match(
      /^\s*(?:Section|Sec\.?)\s*(\d+[\w.\-]*)\b[:.\-\s]*/i
    );
    const number = numberMatch ? numberMatch[1] : `${index + 1}`;
    const titleMatch = part.match(
      /^\s*(?:Section|Sec\.?)\s*\d+[\w.\-]*[:.\-]?\s*([A-Z][^\.\n]{0,80})/
    );
    const title = titleMatch ? titleMatch[1].trim() : "";

    return {
      section_number: number.toString(),
      title,
      text: part,
    };
  });
}
