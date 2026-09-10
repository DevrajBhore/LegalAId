/**
 * factRegistry.js
 *
 * The fact registry, assembled from every knowledge source rather than read out
 * of one file.
 *
 * `legal_facts.json` holds the facts that cross document families -- what the
 * counterparty has access to, whether third parties can be harmed. A family with
 * a question of its own contributes `knowledge-base/intake/facts/*.facts.json`
 * and nothing merges it by hand.
 *
 * That modularity is the point: a new legal family should not require editing a
 * shared file that forty other families depend on, because that edit is a
 * merge conflict and a review burden dressed up as knowledge work.
 *
 * The contract is the shape -- facts, treatments, defaults -- not the paths.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(HERE, "../../knowledge-base/intake/legal_facts.json");
const CONTRIBUTED = path.resolve(HERE, "../../knowledge-base/intake/facts");

/**
 * The admission gate.
 *
 * "A fact exists" and "a fact has legal significance" are separate claims, and
 * the registry must not let the first pass for the second. A checkbox reading
 * `is_female_employee` is not legal knowledge; the legally meaningful
 * proposition is whatever statutory rule makes that fact relevant, with its
 * scope and conditions. So:
 *
 *   FACT  records what is true of the engagement
 *   TREATMENT  records what legal consequence follows, and on whose authority
 *   CLAUSE  is what the deterministic engine then selects
 *
 * Keeping the three apart is what stops the registry becoming another place
 * legal reasoning gets hardcoded. Every field below exists because leaving it
 * optional would let one of the three quietly absorb another.
 */
function admit(part, source) {
  const problems = [];
  const factIds = new Set((part.facts || []).map((f) => f.id));

  for (const fact of part.facts || []) {
    const need = (field, ok) => { if (!ok) problems.push(`fact ${fact.id}: ${field}`); };
    need("id must be UPPER_SNAKE_CASE", /^[A-Z0-9_]+$/.test(String(fact.id || "")));
    need("question is required", String(fact.question || "").trim().length > 15);
    need("legal_proposition — say what turns on this, not merely what it asks",
      String(fact.legal_proposition || "").trim().length > 30);
    need("scope — where this fact applies", String(fact.scope || "").trim().length > 10);
    need("jurisdiction", String(fact.jurisdiction || "").trim());
    need("unknown_behaviour — what happens when nobody answers, which is the " +
      "state most engagements are actually in",
      String(fact.unknown_behaviour || "").trim().length > 20);
    need("review_status", String(fact.review_status || "").trim());
    need("at least two options, each establishing something",
      (fact.options || []).length >= 2 &&
      fact.options.every((o) => o.label && Object.keys(o.establishes || {}).length));
  }

  for (const treatment of part.treatments || []) {
    const label = `treatment ${treatment.fact}=${JSON.stringify(treatment.value)}`;
    if (!Object.keys(treatment.positions || {}).length) {
      problems.push(`${label}: takes no position, so it is not a treatment`);
    }
    if (String(treatment.basis || "").trim().length < 20) {
      problems.push(`${label}: basis — an advocate must be able to see why this answer changes this mechanism`);
    }
    const authority = treatment.authority;
    const structured = Array.isArray(authority) && authority.every((a) => a?.act && a?.section);
    if (!(structured || authority === "commercial")) {
      problems.push(
        `${label}: authority must be a list of {act, section}, or the string "commercial" where ` +
        `the consequence is a drafting choice rather than a statutory one. Inventing a statute ` +
        `for a commercial preference is worse than admitting it is one.`
      );
    }
    if (!treatment.review_status) problems.push(`${label}: review_status`);
  }

  // A fact whose treatments only fire on one value cannot express a negative,
  // so answering "no" would leave the position exactly as unanswered silence --
  // collapsing the distinction the whole pipeline rests on.
  for (const factId of factIds) {
    const fact = (part.facts || []).find((f) => f.id === factId);
    const established = new Set(
      (fact.options || []).flatMap((o) => Object.keys(o.establishes || {}))
    );
    const values = new Set(
      (part.treatments || [])
        .filter((t) => established.has(t.fact))
        .map((t) => JSON.stringify(t.value))
    );
    if (values.size < 2) {
      problems.push(
        `fact ${factId}: its treatments respond to only ${values.size} value(s). Answering it ` +
        `the other way would change nothing, which makes an explicit answer indistinguishable ` +
        `from silence.`
      );
    }
  }

  if (problems.length) {
    throw new Error(
      `Fact source ${source} does not meet the admission gate:\n  - ${problems.join("\n  - ")}`
    );
  }
  return part;
}

let cache = null;

export function loadFactRegistry({ refresh = false } = {}) {
  if (cache && !refresh) return cache;

  const registry = { facts: [], treatments: [], defaults: {} };
  const sources = [BASE];
  try {
    for (const name of fs.readdirSync(CONTRIBUTED)) {
      if (name.endsWith(".json")) sources.push(path.join(CONTRIBUTED, name));
    }
  } catch {
    // No contributed facts is a normal state, not an error.
  }

  const seenFacts = new Set();
  for (const source of sources) {
    let part;
    try {
      part = JSON.parse(fs.readFileSync(source, "utf8"));
    } catch (error) {
      throw new Error(`Unreadable fact source ${path.basename(source)}: ${error.message}`);
    }
    admit(part, path.basename(source));
    for (const fact of part.facts || []) {
      if (seenFacts.has(fact.id)) {
        throw new Error(
          `Fact "${fact.id}" is declared twice (${path.basename(source)}). Two sources claiming ` +
          `the same question is an ambiguity, not an override.`
        );
      }
      seenFacts.add(fact.id);
      registry.facts.push(fact);
    }
    registry.treatments.push(...(part.treatments || []));
    Object.assign(registry.defaults, part.defaults || {});
  }

  cache = registry;
  return cache;
}

export function clearFactRegistryCache() {
  cache = null;
}
