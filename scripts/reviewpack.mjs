import { DOCUMENT_TYPE_REGISTRY } from "./shared/documentRegistry.js";
import { VARIABLE_CONFIG } from "./backend/config/variableConfig.js";
import { generateDocument } from "./backend/services/documentService.js";
import fs from "fs";
import path from "path";

const src = fs.readFileSync("sweep.mjs", "utf8");
const samplerSrc = src.slice(src.indexOf("const ENTITY_NAMES"), src.indexOf("function variablesFor"));
const SAMPLES = { name:"Alpha Industries Private Limited", address:"1 First Road, Mumbai, Maharashtra 400001",
  email:"contact@alpha.example", url:"https://alpha.example", city:"Pune", state:"Maharashtra",
  date:"2026-09-01", number:"500000", pan:"AAACA1234A", gstin:"27AAACA1234A1Z5",
  cin:"U74999MH2015PTC123456", llpin:"AAB-1234" };
const { sampleFor } = new Function("SAMPLES", samplerSrc + "; return { sampleFor };")(SAMPLES);

// How many document types each clause actually reaches.
const usage = new Map();
for (const docType of Object.keys(DOCUMENT_TYPE_REGISTRY)) {
  const all = { ...(VARIABLE_CONFIG.COMMON||{}), ...(VARIABLE_CONFIG[docType]||{}) };
  const vars = {};
  for (const [k, d] of Object.entries(all)) {
    if (Array.isArray(d.excludeDocuments) && d.excludeDocuments.includes(docType)) continue;
    if (!d.required) continue;
    vars[k] = sampleFor(k, d);
  }
  let r;
  for (let i = 0; i < 15; i += 1) {
    r = await generateDocument({ document_type: docType, variables: vars });
    if (r?.draft) break;
    const m = String(r?.error || "").match(/Missing required field: (\w+)/);
    if (!m || vars[m[1]] !== undefined) break;
    vars[m[1]] = sampleFor(m[1], all[m[1]] || { type: "text" });
  }
  if (!r?.draft) continue;
  for (const c of r.draft.clauses) {
    const e = usage.get(c.clause_id) || { types: [], words: 0 };
    e.types.push(docType);
    e.words = Math.max(e.words, String(c.text||"").split(/\s+/).filter(Boolean).length);
    usage.set(c.clause_id, e);
  }
}

// Library metadata.
const LIB = "knowledge-base/clause_library";
const clauses = [];
for (const dir of fs.readdirSync(LIB, { withFileTypes: true })) {
  if (!dir.isDirectory() || dir.name === "blueprints") continue;
  for (const file of fs.readdirSync(path.join(LIB, dir.name))) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(LIB, dir.name, file);
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(full, "utf8")); } catch { continue; }
    for (const c of (Array.isArray(parsed) ? parsed : [parsed])) {
      if (!c?.clause_id) continue;
      const u = usage.get(c.clause_id) || { types: [], words: 0 };
      clauses.push({
        clause_id: c.clause_id,
        title: c.title || c.name || "",
        domain: dir.name,
        file: full,
        doc_types_reached: u.types.length,
        doc_types: u.types.join(", "),
        rendered_words: u.words,
        risk_level: c.risk_level || "",
        enforceability: c.enforceability || "",
        mandatory: c.mandatory === true,
        review_status: c.review_status || "unmarked",
        reviewed_by: c.reviewed_by || "",
        citations: (c.legal_basis || []).map(b => `${b.act||""} s.${b.section||""}`).join("; "),
        text: c.text || "",
      });
    }
  }
}

// Priority: reach across document types, weighted up for high risk and for
// clauses that are mandatory in the blueprint.
const RISK_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1, "": 1 };
for (const c of clauses) {
  c.priority = c.doc_types_reached * (RISK_WEIGHT[c.risk_level.toUpperCase()] || 1) + (c.mandatory ? 5 : 0);
}
clauses.sort((a, b) => b.priority - a.priority);

fs.writeFileSync("reviewpack.json", JSON.stringify(clauses, null, 1));
const reached = clauses.filter(c => c.doc_types_reached > 0);
console.log(`${clauses.length} clauses in library, ${reached.length} actually reach a generated document`);
console.log(`${clauses.length - reached.length} never appear in any of the 22 types\n`);
let cum = 0;
const totalPlacements = clauses.reduce((n,c)=>n+c.doc_types_reached,0);
for (const [n] of [[10],[20],[30],[50]]) {
  cum = clauses.slice(0,n).reduce((s,c)=>s+c.doc_types_reached,0);
  console.log(`  top ${String(n).padStart(3)} clauses cover ${String(cum).padStart(4)} of ${totalPlacements} clause placements (${Math.round(100*cum/totalPlacements)}%)`);
}
