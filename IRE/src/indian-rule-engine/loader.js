import fs from "fs";
import path from "path";

/**
 * Load all JSON files from a directory
 */
export function loadJSONFiles(dirPath) {

  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = fs.readdirSync(dirPath);

  return files
    .filter(file => file.endsWith(".json"))
    .map(file => {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    });
}
