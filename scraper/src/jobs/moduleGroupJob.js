import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeList(values = []) {
  return [
    ...new Set(
      (values || []).map((value) => String(value).trim()).filter(Boolean)
    ),
  ];
}

async function resolveModule(absolutePath) {
  const stats = await fs.stat(absolutePath).catch(() => null);
  if (!stats || stats.size === 0) {
    return { status: "empty" };
  }

  const imported = await import(pathToFileURL(absolutePath).href);
  return { status: "ready", imported };
}

function pickRunnableExport(imported, exportNames = []) {
  for (const name of exportNames) {
    if (typeof imported?.[name] === "function") {
      return { name, fn: imported[name] };
    }
  }

  if (typeof imported?.default === "function") {
    return { name: "default", fn: imported.default };
  }

  return null;
}

export async function runModuleGroupJob({
  label,
  modules = [],
  selected = [],
  sharedOptions = {},
} = {}) {
  const requested = new Set(normalizeList(selected));
  const summary = {
    label,
    completed: [],
    skipped: [],
    failed: [],
  };

  console.log(`\n[Scraper] Starting ${label} job...`);

  for (const moduleConfig of modules) {
    if (requested.size > 0 && !requested.has(moduleConfig.key)) {
      summary.skipped.push({
        key: moduleConfig.key,
        reason: "not selected",
      });
      continue;
    }

    const absolutePath = path.resolve(__dirname, moduleConfig.relativePath);
    const resolved = await resolveModule(absolutePath);

    if (resolved.status === "empty") {
      console.log(
        `[Scraper] Skipping ${moduleConfig.key}: module is still a placeholder`
      );
      summary.skipped.push({
        key: moduleConfig.key,
        reason: "module placeholder",
      });
      continue;
    }

    const runnable = pickRunnableExport(
      resolved.imported,
      moduleConfig.exportNames || []
    );

    if (!runnable) {
      console.log(
        `[Scraper] Skipping ${moduleConfig.key}: no runnable export found`
      );
      summary.skipped.push({
        key: moduleConfig.key,
        reason: "no runnable export",
      });
      continue;
    }

    try {
      console.log(
        `[Scraper] Running ${moduleConfig.key} via ${runnable.name}()`
      );
      await runnable.fn({
        ...sharedOptions,
        ...(moduleConfig.options || {}),
      });
      summary.completed.push(moduleConfig.key);
    } catch (error) {
      console.error(
        `[Scraper] ${moduleConfig.key} failed:`,
        error?.message || error
      );
      summary.failed.push({
        key: moduleConfig.key,
        error: error?.message || String(error),
      });
    }
  }

  console.log(
    `[Scraper] ${label} job complete: ${summary.completed.length} completed, ${summary.skipped.length} skipped, ${summary.failed.length} failed`
  );

  return summary;
}
