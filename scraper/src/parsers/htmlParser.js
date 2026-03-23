// scraper/src/parsers/htmlParser.js
import * as cheerio from "cheerio";

/**
 * Extract main text (simple) from HTML.
 * Returns a cleaned string.
 */
export function extractText(html) {
  const $ = cheerio.load(html);

  // remove elements we don't want
  $("script, style, noscript, iframe, svg").remove();

  // Some sites use <main> or specific containers; use body fallback
  const body = $("main").length ? $("main") : $("body");
  let text = body.text() || "";

  // normalize spaces
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Extract headings (h1-h5) into array preserving order.
 */
export function extractHeadings(html) {
  const $ = cheerio.load(html);
  const headings = [];

  $("h1, h2, h3, h4, h5").each((i, el) => {
    headings.push({
      tag: el.tagName,
      text: $(el).text().trim()
    });
  });

  return headings;
}

/**
 * Extract links (useful for navigation / follow links)
 */
export function extractLinks(html, baseUrl = "") {
  const $ = cheerio.load(html);
  const links = [];

  $("a").each((i, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().trim();
    links.push({ text, href });
  });

  return links;
}
