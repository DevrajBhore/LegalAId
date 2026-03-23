import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";

const BASE_DIR = path.resolve("knowledge-base/sections");

function cleanHtml(html) {
  if (!html) return "";
  return cheerio
    .load(html)
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function walk(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }

    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw);

      let updated = false;

      // 1️⃣ If "text" exists → migrate to content
      if (data.text && !data.content) {
        data.content = cleanHtml(data.text);
        delete data.text;
        updated = true;
      }

      // 2️⃣ If content exists but contains HTML → clean it
      if (data.content && data.content.includes("<")) {
        data.content = cleanHtml(data.content);
        updated = true;
      }

      // 3️⃣ If content exists but is too small → mark for refetch
      if (!data.content || data.content.length < 20) {
        console.log("⚠ Weak section (will be refetched later):", fullPath);
      }

      if (updated) {
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
        console.log("✔ Repaired:", fullPath);
      }

    } catch (err) {
      console.log("Skipped invalid file:", fullPath);
    }
  }
}

walk(BASE_DIR);

console.log("✅ Section normalization complete.");