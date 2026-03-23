import fs from "fs";
import path from "path";

const BASE = "knowledge-base/clause_library";

const VALID_FOLDERS = [
  "core",
  "commercial",
  "employment",
  "finance",
  "property"
];

function normalizeClause(filePath) {

  const raw = fs.readFileSync(filePath, "utf8");
  const clause = JSON.parse(raw);

  // 1️⃣ Normalize category
  if (clause.category) {
    clause.category = clause.category.toUpperCase();
  }

  // 2️⃣ Normalize document types
  if (Array.isArray(clause.document_types)) {
    clause.document_types = clause.document_types.map(d =>
      d.toUpperCase()
    );
  }

  // 3️⃣ Fix legal_basis section type
  if (Array.isArray(clause.legal_basis)) {

    clause.legal_basis = clause.legal_basis.map(lb => {

      if (!lb.section) return lb;

      // convert numbers → string
      if (typeof lb.section === "number") {
        lb.section = String(lb.section);
      }

      // remove "Section " prefix
      if (typeof lb.section === "string") {
        lb.section = lb.section.replace(/section\s*/i, "").trim();
      }

      return lb;
    });

  }

  // 4️⃣ Normalize source
  if (!clause.source) {
    clause.source = "LegalAId Clause Library";
  }

  // 5️⃣ Ensure version
  if (!clause.version) {
    clause.version = "1.0";
  }

  fs.writeFileSync(filePath, JSON.stringify(clause, null, 2));
}

function walk(dir) {

  const files = fs.readdirSync(dir);

  files.forEach(file => {

    const full = path.join(dir, file);

    if (fs.statSync(full).isDirectory()) {
      walk(full);
      return;
    }

    if (!file.endsWith(".json")) return;

    normalizeClause(full);

  });

}

VALID_FOLDERS.forEach(folder => {

  const dir = path.join(BASE, folder);

  if (fs.existsSync(dir)) {
    walk(dir);
  }

});

console.log("Clause library normalized successfully.");