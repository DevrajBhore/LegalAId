// scraper/src/scrapers/indiaCode/parseActPage.js
import cheerio from "cheerio";import * as cheerio from "cheerio";
import { fetchHtml } from "../../common/request.js";

export async function parseActPage(actUrl) {
  const res = await fetchHtml(actUrl);
  const $ = cheerio.load(res.data);

  // ---- Act metadata ----
  const title = $("h1").first().text().trim();
  const enactment = $("span:contains('Enactment Date')")
    .next()
    .text()
    .trim();

  const act = {
    title,
    enactment_date: enactment,
    source_url: actUrl
  };

  // ---- Sections ----
  const sections = [];

  $(".section").each((_, el) => {
    const number = $(el).find(".section-number").text().trim();
    const heading = $(el).find(".section-heading").text().trim();
    const content = $(el).find(".section-content").text().trim();

    if (number) {
      sections.push({
        number,
        heading,
        content
      });
    }
  });

  return { act, sections };
}
