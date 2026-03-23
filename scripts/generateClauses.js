import fs from "fs";
import path from "path";

const BASE_PATH = "knowledge-base/clause_library";

const definitions = JSON.parse(
  fs.readFileSync(
    `${BASE_PATH}/clause_definitions.json`,
    "utf8"
  )
);

const TEMPLATE = {
  clause_id: "",
  name: "",
  category: "",
  document_types: ["ALL"],
  jurisdiction: "India",
  text: "",
  legal_basis: [],
  mandatory: false,
  enforceability: "HIGH",
  risk_level: "LOW",
  invalid_if: [],
  source: "LegalAId Clause Library",
  version: "1.0"
};

function filenameFromId(id) {
  return id
    .toLowerCase()
    .replace(/^[a-z]+_/, "")     // remove prefix like core_
    .replace(/_\d+$/, "")        // remove version
    + ".json";
}

function generateClauses() {

  Object.entries(definitions).forEach(([group, clauses]) => {

    const folder = path.join(BASE_PATH, group);

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    clauses.forEach(clause => {

      const fileName = filenameFromId(clause.id);
      const filePath = path.join(folder, fileName);

      if (fs.existsSync(filePath)) {
        console.log("Skipping existing:", filePath);
        return;
      }

      const newClause = {
        ...TEMPLATE,
        clause_id: clause.id,
        name: clause.name,
        category: clause.category,
        legal_basis: clause.legal_basis
          ? [clause.legal_basis]
          : []
      };

      fs.writeFileSync(
        filePath,
        JSON.stringify(newClause, null, 2)
      );

      console.log("Created:", filePath);

    });

  });

}

generateClauses();