import { fetchHtml } from "../../common/request.js";
import { saveJSON } from "../../storage/fileStorage.js";
import {
  buildStableId,
  normalizeText,
  uniqueBy,
} from "../shared/scraperUtils.js";

const SOURCE_URL = "https://rera.karnataka.gov.in/viewAllProjects";

function decodeJsString(value = "") {
  return String(value)
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function extractPushValues(html, listName) {
  const values = [];
  const pattern = new RegExp(`${listName}\\s*\\.push\\('([\\s\\S]*?)'\\)`, "g");
  let match;

  while ((match = pattern.exec(html))) {
    values.push(decodeJsString(match[1]));
  }

  return values;
}

function extractApplicationNumbers(html) {
  const values = [];
  const pattern = /appNo\s*:\s*'([\s\S]*?)'/g;
  let match;

  while ((match = pattern.exec(html))) {
    values.push(decodeJsString(match[1]));
  }

  return values;
}

function parseProjects(html) {
  const applicationNumbers = extractApplicationNumbers(html);
  const registrationNumbers = extractPushValues(html, "applicationNameList2");
  const projectNames = extractPushValues(html, "applicationNameList3");
  const promoterNames = extractPushValues(html, "applicationNameList4");
  const rowCount = Math.max(
    applicationNumbers.length,
    registrationNumbers.length,
    projectNames.length,
    promoterNames.length
  );
  const projects = [];

  for (let index = 0; index < rowCount; index += 1) {
    const applicationNo = normalizeText(applicationNumbers[index]);
    const registrationNo = normalizeText(registrationNumbers[index]);
    const projectName = normalizeText(projectNames[index]);
    const promoterName = normalizeText(promoterNames[index]);

    if (!applicationNo && !registrationNo && !projectName && !promoterName) {
      continue;
    }

    const title = projectName || registrationNo || applicationNo;
    projects.push({
      id: buildStableId("karnataka_rera", title, registrationNo || applicationNo),
      authority: "Karnataka RERA",
      source_type: "rera-project",
      source_label: "Karnataka Real Estate Regulatory Authority",
      application_no: applicationNo,
      registration_no: registrationNo,
      project_name: projectName,
      promoter_name: promoterName,
      source_url: SOURCE_URL,
      text: normalizeText(
        `${projectName} ${promoterName} ${registrationNo} ${applicationNo}`
      ),
      extraction: {
        status: "parsed",
        source_mode: "viewAllProjects_javascript_arrays",
      },
    });
  }

  return projects;
}

export async function runKarnatakaReraScraper() {
  const fetchedAt = new Date().toISOString();
  const response = await fetchHtml(SOURCE_URL, {
    maxRedirects: 5,
    retries: 2,
    timeout: 90000,
  });
  const projects = parseProjects(response.data || "");
  const uniqueItems = uniqueBy(
    projects,
    (item) => item.registration_no || item.application_no || item.id
  );

  for (const item of uniqueItems) {
    await saveJSON(`rera/karnataka-rera/items/${item.id}.json`, item);
  }

  await saveJSON("rera/karnataka-rera/index.json", {
    source_label: "Karnataka RERA registered projects",
    source_url: SOURCE_URL,
    source_status: response.status,
    source_rows: projects.length,
    unique_items: uniqueItems.length,
    fetched_at: fetchedAt,
  });
}

export const scrapeKarnatakaRera = runKarnatakaReraScraper;
