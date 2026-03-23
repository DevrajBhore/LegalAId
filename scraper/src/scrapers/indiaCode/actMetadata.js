// scraper/src/scrapers/indiaCode/actMetadata.js
import * as cheerio from "cheerio";
import { cleanText } from "../../parsers/textProcessor.js";

/**
 * Extract structured metadata from Act detail page.
 */
export function extractActMetadata(html) {
  const $ = cheerio.load(html);

  const getTextAfterLabel = (label) => {
    const el = $(`td:contains("${label}")`).next();
    if (el && el.text()) return cleanText(el.text());
    return "";
  };

  const metadata = {
    act_id_official: getTextAfterLabel("Act ID:"),
    act_number: getTextAfterLabel("Act Number:"),
    act_year: getTextAfterLabel("Act Year:"),
    enactment_date: getTextAfterLabel("Enactment Date:"),
    enforcement_date: getTextAfterLabel("Enforcement Date:"),
    ministry: getTextAfterLabel("Ministry:"),
    department: getTextAfterLabel("Department:"),
    status: getTextAfterLabel("Status:"),
    repealed_by: getTextAfterLabel("Repealed By:"),
  };

  return metadata;
}
