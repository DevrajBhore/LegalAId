import * as cheerio from "cheerio";

import { fetchHtml } from "../../common/request.js";
import { saveJSON } from "../../storage/fileStorage.js";
import { absoluteUrl, normalizeText } from "../shared/scraperUtils.js";

const SCI_BASE_URL = "https://www.sci.gov.in";
const SCI_JUDGMENTS_URL = `${SCI_BASE_URL}/judgements-case-no/`;

function extractOfficialLinks(html) {
  const $ = cheerio.load(html || "");
  return $("a[href]")
    .toArray()
    .map((node) => {
      const href = absoluteUrl($(node).attr("href"), SCI_BASE_URL);
      const label = normalizeText($(node).text());
      return { label, href };
    })
    .filter((link) => link.href && /judg|case|order/i.test(`${link.label} ${link.href}`));
}

export async function runJudisScraper() {
  const fetchedAt = new Date().toISOString();
  const response = await fetchHtml(SCI_JUDGMENTS_URL, {
    maxRedirects: 5,
    retries: 2,
  });

  const html = response.data || "";
  const $ = cheerio.load(html);
  const pageTitle = normalizeText($("title").first().text());
  const officialLinks = extractOfficialLinks(html);

  await saveJSON("case-law/judis/index.json", {
    source_label: "Supreme Court of India",
    source_url: SCI_JUDGMENTS_URL,
    source_status: response.status,
    page_title: pageTitle,
    official_links: officialLinks,
    unique_items: 0,
    fetched_at: fetchedAt,
    extraction: {
      status: "source_requires_query",
      note:
        "The official Supreme Court judgments page is form/API driven. Bulk case-law text is collected through the Indian Kanoon target; this target records the official source endpoint for future query-specific expansion.",
    },
  });
}

export const scrapeJudis = runJudisScraper;
