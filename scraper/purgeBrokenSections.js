import fs from "fs";
import path from "path";

const BASE_DIR = path.resolve("knowledge-base/sections");

function walk(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);

    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath);
      continue;
    }

    try {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const data = JSON.parse(raw);

      const isInvalid =
        !data.content ||
        typeof data.content !== "string" ||
        data.content.trim().length < 20;

      if (isInvalid) {
        fs.unlinkSync(fullPath);
        console.log("🗑 Deleted broken section:", fullPath);
      }

    } catch {
      console.log("⚠ Could not parse file:", fullPath);
    }
  }
}

walk(BASE_DIR);

console.log("✅ Broken sections removed.");