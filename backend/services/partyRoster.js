/**
 * partyRoster.js — HOW MANY PEOPLE IS THIS INSTRUMENT ABOUT?
 *
 * D4.14 ran the 2→3 counterfactual on a partnership deed. A user with three
 * partners had two routes and both failed: `partner_3_name` was dropped by
 * sanitisation and vanished silently, and a third partner described in free text
 * appeared in the CAPITAL AND PROFIT clause while appearing in neither the
 * identity clause nor the signature block. The deed recited a person as sharing
 * profits without making them a party. Under the Indian Partnership Act 1932 s.4
 * and s.25 that misstates the firm — a person who signs nothing is bound by
 * nothing, whatever the deed says about their share.
 *
 * The cause was architectural, not authorial: across all 40 families there is no
 * party index above 2 and no collection-typed field of any kind. `multiselect`
 * picks from a fixed option list and cannot carry correlated per-entity
 * attributes. There was no way to represent a repeating entity.
 *
 * THIS IS THE REPRESENTATION. A roster is an ordered collection of members, each
 * with an identity, a role and a provenance, resolved from whatever the intake
 * actually supplied. It accepts:
 *
 *   - indexed slots, to any depth: party_1_*, party_2_*, party_3_* …
 *     (the existing two are simply the first two)
 *   - family-specific prefixes: partner_N_*, shareholder_N_*, founder_N_*
 *   - an explicit `parties` array, for callers that already have a collection
 *
 * WHAT IT DELIBERATELY DOES NOT DO.
 *
 * It does not invent members. A name mentioned in free prose is not a party, and
 * inferring one from `partner_roles` is exactly the failure D4.14 measured — the
 * roster would then agree that someone is a partner while the signature block
 * still does not bind them. Free text is not a source here.
 *
 * It does not renumber or reorder. Position is identity in a document that says
 * "Party 1" and "Party 2", and a roster that silently resequenced would rewrite
 * cross-references that nothing else knows about.
 *
 * It does not decide what N-party language should say. That is invariant 60's
 * six shapes, and two of them carry legal decisions nobody has made.
 *
 * PRECEDENCE AND DEDUPLICATION, because two sources can describe one person.
 *
 * A caller may supply `parties[]` AND indexed slots at the same time — an app
 * that keeps a collection and also writes the first two into the legacy fields
 * will do exactly that. Without a stated rule, Meera Iyer arrives twice and
 * becomes two partners: a firm of three silently reported as a firm of four,
 * with two signature blocks for one woman. That is the D4.14 failure running in
 * the opposite direction, and it is worse, because the extra party is
 * plausible.
 *
 * The rule, in three parts:
 *
 *   1. `parties[]` is AUTHORITATIVE for membership when it is present. A caller
 *      that holds a collection has said who the parties are.
 *   2. An indexed slot describing someone already in the collection is the SAME
 *      PERSON, not a second one. It is merged; the declared representation wins
 *      on any attribute both supply, and the disagreement is recorded.
 *   3. An indexed slot describing someone NOT in the collection is neither
 *      admitted nor discarded. It is recorded as a conflict, because both
 *      alternatives are a silent decision: admitting binds someone the
 *      authoritative collection did not list, and dropping repeats D4.14.
 *
 * Identity is PAN where both representations carry one — two people cannot
 * share a PAN, so equal PAN is the same person and unequal PAN is not, whatever
 * the names say. Otherwise it is the normalised name, which is weaker and is
 * all that a name-only intake gives us.
 */

/** Prefixes a family may use for its principals, in the order they are tried. */
const PRINCIPAL_PREFIXES = ["party", "partner", "shareholder", "founder", "member"];

/** Attributes a member carries, and the suffix each is read from. */
const ATTRIBUTES = ["name", "address", "type", "pan", "gstin", "cin", "llpin",
  "signatory_name", "signatory_designation", "authority_reference", "label"];

const meaningful = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const normaliseName = (value) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const normaliseId = (value) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The statutory identifiers that identify a legal person uniquely. */
const STRONG_IDENTIFIERS = ["pan", "cin", "llpin"];

/**
 * Are these two representations the same legal person?
 *
 * A statutory identifier settles it in BOTH directions: two people cannot share
 * a PAN, and one person does not have two. So where both representations carry
 * the same kind of identifier, that comparison is the answer and the names are
 * not consulted — which is what stops "Meera Iyer" the individual and "Meera
 * Iyer" her sole proprietorship from being collapsed into one party.
 *
 * With no shared identifier the name is all there is. It is a weaker test and
 * it is stated as such: `basis` travels with the answer so a caller can tell a
 * merge that rests on a PAN from one that rests on a spelling.
 */
export function sameMember(a = {}, b = {}) {
  for (const key of STRONG_IDENTIFIERS) {
    const left = normaliseId(a?.[key]);
    const right = normaliseId(b?.[key]);
    if (left && right) return { same: left === right, basis: key };
  }
  const leftName = normaliseName(a?.name);
  const rightName = normaliseName(b?.name);
  if (!leftName || !rightName) return { same: false, basis: null };
  return { same: leftName === rightName, basis: "name" };
}

/** Attributes both representations supply, with different values. */
function attributeDisagreements(declared = {}, indexed = {}) {
  const out = [];
  for (const attribute of ATTRIBUTES) {
    const left = declared[attribute];
    const right = indexed[attribute];
    if (!meaningful(left) || !meaningful(right)) continue;
    if (String(left).trim() === String(right).trim()) continue;
    out.push({ attribute, declared: left, indexed: right });
  }
  return out;
}

function memberFromSlot(variables, prefix, index) {
  return {
    index,
    role: variables[`${prefix}_${index}_role`] || null,
    provenance: "declared",
    ...Object.fromEntries(
      ATTRIBUTES.map((a) => [a, variables[`${prefix}_${index}_${a}`] ?? null])
    ),
    name: variables[`${prefix}_${index}_name`],
  };
}

/**
 * Every indexed principal the variables carry, under the first prefix that
 * yields any, with gaps recorded and same-person repeats collapsed.
 */
function scanIndexedSlots(variables = {}) {
  for (const prefix of PRINCIPAL_PREFIXES) {
    const members = [];
    const gaps = [];
    const duplicates = [];
    /*
     * Scan well past the two the intake currently offers. The ceiling is not a
     * belief about how many partners a firm may have — the Companies Act 2013
     * Rule 10 caps a partnership at 50 — it is a bound on a loop over a flat
     * object, and a gap is recorded rather than treated as the end so that
     * supplying 1 and 3 does not silently discard the third.
     */
    for (let i = 1; i <= 50; i += 1) {
      const name = variables[`${prefix}_${i}_name`];
      if (!meaningful(name)) { if (members.length) gaps.push(i); continue; }
      const candidate = memberFromSlot(variables, prefix, i);

      const earlier = members.find((m) => sameMember(m, candidate).same);
      if (earlier) {
        /*
         * The same person written into two slots. Admitting both would give one
         * partner two capital accounts and two signature blocks, so the repeat
         * is collapsed onto the first position it occupied and the collapse is
         * recorded rather than performed quietly.
         */
        duplicates.push({
          kept_index: earlier.index, dropped_index: i,
          basis: sameMember(earlier, candidate).basis,
          name: String(candidate.name).trim(),
        });
        continue;
      }
      members.push(candidate);
    }
    if (members.length) {
      const last = members[members.length - 1].index;
      return { members, prefix, duplicates, gaps: gaps.filter((g) => g < last) };
    }
  }
  return { members: [], prefix: null, duplicates: [], gaps: [] };
}

/**
 * Resolve the roster from intake variables.
 *
 * @param {object} variables intake answers, already sanitised or not
 * @returns {{members: object[], count: number, prefix: string|null,
 *            source: string, gaps: number[], duplicates: object[],
 *            conflicts: object[], reconciled: boolean}}
 */
export function resolveRoster(variables = {}) {
  const indexed = scanIndexedSlots(variables);

  /*
   * An explicit collection wins. A caller that already holds a roster should not
   * have to flatten it into indexed keys and have this function put it back
   * together — a round trip through a lossy shape is where members go missing.
   */
  if (Array.isArray(variables.parties) && variables.parties.length) {
    const members = variables.parties
      .map((p, i) => ({ index: i + 1, role: p.role || null, provenance: "declared",
        ...Object.fromEntries(ATTRIBUTES.map((a) => [a, p[a] ?? null])) }))
      .filter((m) => meaningful(m.name));

    const conflicts = [];
    const merged = [];
    for (const slot of indexed.members) {
      const match = members.find((m) => sameMember(m, slot).same);
      if (!match) {
        /*
         * Present in the indexed slots and absent from the authoritative
         * collection. Admitting them would bind a person the caller did not
         * list; dropping them silently is the D4.14 disappearance. Neither is
         * ours to choose, so the roster carries the unreconciled person and says
         * it is not reconciled.
         */
        conflicts.push({
          reason: "NOT_IN_DECLARED_COLLECTION",
          name: String(slot.name).trim(),
          indexed_field: `${indexed.prefix}_${slot.index}_name`,
          note: "Supplied as an indexed principal and absent from parties[]. Not admitted " +
                "as a party and not discarded: a person bound by an instrument must appear " +
                "in the authoritative roster, and a person the intake named must not vanish.",
        });
        continue;
      }
      const disagreements = attributeDisagreements(match, slot);
      for (const attribute of ATTRIBUTES) {
        if (!meaningful(match[attribute]) && meaningful(slot[attribute])) {
          match[attribute] = slot[attribute];
        }
      }
      merged.push({
        name: String(match.name).trim(),
        basis: sameMember(match, slot).basis,
        indexed_field: `${indexed.prefix}_${slot.index}_name`,
        disagreements,
      });
    }

    return {
      members, count: members.length, prefix: null, source: "parties[]",
      gaps: [], duplicates: [], merged, conflicts,
      reconciled: conflicts.length === 0,
    };
  }

  if (indexed.members.length) {
    return {
      members: indexed.members, count: indexed.members.length,
      prefix: indexed.prefix, source: `${indexed.prefix}_N_*`,
      gaps: indexed.gaps, duplicates: indexed.duplicates, merged: [], conflicts: [],
      reconciled: true,
    };
  }

  return { members: [], count: 0, prefix: null, source: "none", gaps: [],
    duplicates: [], merged: [], conflicts: [], reconciled: true };
}

/**
 * Does this field name extend a principal series the schema already declares?
 *
 * Sanitisation drops every field a document type does not declare, which is what
 * made `partner_3_name` disappear between the form and the generator. The
 * admission rule here is deliberately narrow and entirely structural:
 *
 *   - the field parses as `<prefix>_<n>_<attribute>` in the roster grammar;
 *   - `n` is 3 or more, so slots 1 and 2 remain governed by the schema and a
 *     two-party document cannot change behaviour;
 *   - the schema ALREADY declares `<prefix>_1_name` and `<prefix>_2_name`, so
 *     the family has said this is how it names its principals.
 *
 * The engine supplies the mechanics — a principal series has no ceiling. The
 * family supplies the knowledge — which prefix its principals are called by.
 * Nothing here is written per document type.
 */
export function isRosterExtensionField(fieldName = "", declaredFields = new Set()) {
  const has = typeof declaredFields?.has === "function"
    ? (f) => declaredFields.has(f)
    : () => false;

  if (fieldName === "parties") {
    return PRINCIPAL_PREFIXES.some((p) => has(`${p}_1_name`) && has(`${p}_2_name`));
  }

  const match = /^([a-z]+)_(\d+)_([a-z_]+)$/.exec(String(fieldName));
  if (!match) return false;
  const [, prefix, index, attribute] = match;
  if (!PRINCIPAL_PREFIXES.includes(prefix)) return false;
  if (!(Number(index) >= 3)) return false;
  if (!ATTRIBUTES.includes(attribute) && attribute !== "role") return false;
  return has(`${prefix}_1_name`) && has(`${prefix}_2_name`);
}

/**
 * Is this instrument about more than two principals?
 *
 * The question every N-party clause form turns on. Kept separate from the roster
 * so a caller cannot accidentally ask it of a list it has already filtered.
 */
export function isMultiParty(variables = {}) {
  return resolveRoster(variables).count > 2;
}

/**
 * Members other than the one at `index` — what "the other Party" denotes once
 * there can be more than one of them.
 */
export function othersOf(roster, index) {
  return (roster.members || []).filter((m) => m.index !== index);
}

/**
 * Render a roster as the document names it: "A, B and C".
 *
 * Oxford comma deliberately absent — Indian drafting convention, and consistent
 * with the existing clause text this has to sit beside.
 */
export function nameList(roster) {
  const names = (roster.members || []).map((m) => String(m.name).trim()).filter(Boolean);
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
