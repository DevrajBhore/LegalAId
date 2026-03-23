// scraper/src/storage/backupStorage.js
import fs from "fs";
import path from "path";

export function backupFile(sourcePath, backupDir) {
    try {
        if (!fs.existsSync(sourcePath)) return false;

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const fileName = path.basename(sourcePath);
        const timestamp = Date.now();
        const backupPath = path.join(backupDir, `${timestamp}_${fileName}`);

        fs.copyFileSync(sourcePath, backupPath);

        console.log(`🛡 Backup created: ${backupPath}`);
        return true;
    } catch (err) {
        console.error("❌ Backup Error:", err);
        return false;
    }
}
