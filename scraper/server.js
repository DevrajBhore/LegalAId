// scraper/server.js
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { runOrchestrator } from "./src/orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Basic startup log
console.log("🚀 LegalAId Scraper Server Starting...");
console.log("📁 Working directory:", __dirname);

// Ensure logs directory exists
const logsDir = path.join(__dirname, "src", "logs");
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    console.log("📂 Created logs directory.");
}

// Run main orchestrator
(async () => {
    try {
        await runOrchestrator();
        console.log("✅ Scraper finished successfully.");
    } catch (err) {
        console.error("❌ Scraper crashed:", err);
    }
})();
