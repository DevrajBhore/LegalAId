import { inferDomainRequirements } from "./domainInference.js";
import { loadStatutesForDomain } from "./statuteLoader.js";
import { loadSectionsForAct } from "./sectionLoader.js";
import { compileRulesFromAct } from "./ruleCompiler.js";
import { compareDraftAgainstRules } from "./ruleComparator.js";
import { loadSubordinateIndexesForActs } from "./subordinateLoader.js";
import { buildTargetedSubordinateProfileNotices } from "./subordinateProfiles.js";

function emptySubordinateContext() {
  return {
    scanned_acts: 0,
    acts_with_subordinate: 0,
    acts_with_possible_subordinate: 0,
    total_subordinate_entries: 0,
    acts_with_source_gaps: 0,
    top_categories: [],
    profile_notice_count: 0,
    matched_profiles: [],
  };
}

function summarizeActTitle(act = {}) {
  return act.title || act.short_title || act.act_id || "Unknown Act";
}

function isLowSignalSubordinateAct(act = {}, subordinate = {}) {
  const title = summarizeActTitle(act).toLowerCase();
  const isCrossCuttingAct =
    title.includes("indian contract act") ||
    title.includes("arbitration and conciliation act") ||
    title.includes("mediation act") ||
    title.includes("specific relief act") ||
    title.includes("limitation act");

  return isCrossCuttingAct && (subordinate?.count || 0) < 25;
}

function buildSubordinateNotice(relevantActs = []) {
  if (!Array.isArray(relevantActs) || relevantActs.length === 0) {
    return { issues: [], context: emptySubordinateContext() };
  }

  const subordinateIndexes = loadSubordinateIndexesForActs(
    relevantActs.map((act) => act.act_id)
  );
  const indexByActId = new Map(
    subordinateIndexes.map((index) => [index.act_id, index])
  );

  const resolvedActs = relevantActs
    .map((act) => ({
      act,
      subordinate: indexByActId.get(act.act_id) || null,
    }))
    .filter(({ subordinate }) => subordinate);

  const actsWithSubordinate = resolvedActs.filter(
    ({ subordinate }) =>
      subordinate?.has_subordinate_legislation === true && subordinate.count > 0
  );
  const actionableActsWithSubordinate = actsWithSubordinate.filter(
    ({ act, subordinate }) => !isLowSignalSubordinateAct(act, subordinate)
  );
  const actsWithPossibleOnly = resolvedActs.filter(
    ({ subordinate }) =>
      subordinate?.has_subordinate_legislation !== true &&
      subordinate?.possible_subordinate_legislation === true
  );

  const categoryTotals = {};
  for (const { subordinate } of actionableActsWithSubordinate) {
    for (const [category, count] of Object.entries(
      subordinate.category_counts || {}
    )) {
      categoryTotals[category] = (categoryTotals[category] || 0) + count;
    }
  }

  const topCategories = Object.entries(categoryTotals)
    .filter(([category]) => category !== "other")
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }));

  const context = {
    scanned_acts: resolvedActs.length,
    acts_with_subordinate: actionableActsWithSubordinate.length,
    acts_with_possible_subordinate: actsWithPossibleOnly.length,
    total_subordinate_entries: actionableActsWithSubordinate.reduce(
      (sum, { subordinate }) => sum + subordinate.count,
      0
    ),
    acts_with_source_gaps: actionableActsWithSubordinate.filter(
      ({ subordinate }) => subordinate.failed_candidate_count > 0
    ).length,
    top_categories: topCategories,
    profile_notice_count: 0,
    matched_profiles: [],
  };

  if (actionableActsWithSubordinate.length === 0) {
    return { issues: [], context };
  }

  const targetedProfileNotices =
    buildTargetedSubordinateProfileNotices(actionableActsWithSubordinate);
  context.profile_notice_count = targetedProfileNotices.issues.length;
  context.matched_profiles = targetedProfileNotices.matchedProfiles;

  if (targetedProfileNotices.issues.length > 0) {
    return {
      issues: targetedProfileNotices.issues,
      context,
    };
  }

  const topActs = actionableActsWithSubordinate
    .slice()
    .sort((left, right) => right.subordinate.count - left.subordinate.count)
    .slice(0, 3)
    .map(
      ({ act, subordinate }) =>
        `${summarizeActTitle(act)} (${subordinate.count} indexed item${
          subordinate.count === 1 ? "" : "s"
        })`
    );

  const actsCount = context.acts_with_subordinate;
  const pluralActs = actsCount === 1 ? "act" : "acts";
  const totalEntries = context.total_subordinate_entries;
  const pluralEntries = totalEntries === 1 ? "entry" : "entries";
  const sourceGapCount = context.acts_with_source_gaps;
  const topCategoriesText =
    topCategories.length > 0
      ? ` Primary subordinate categories: ${topCategories
          .map(({ category, count }) => `${category} (${count})`)
          .join(", ")}.`
      : "";
  const topActsText =
    topActs.length > 0 ? ` Key mapped statutes include ${topActs.join(", ")}.` : "";
  const sourceGapText =
    sourceGapCount > 0
      ? ` India Code still had upstream retrieval gaps for ${sourceGapCount} mapped ${pluralActs}, so source review may still be needed for time-sensitive compliance points.`
      : "";

  return {
    issues: [
      {
        rule_id: "SUBORDINATE_LEGISLATION_REVIEW",
        severity: "LOW",
        notice_only: true,
        recommendation_only: true,
        source: "SubordinateStatutoryIndex",
        statutory_ref: actsWithSubordinate
          .map(({ act }) => summarizeActTitle(act))
          .join("; "),
        message:
          `Relevant subordinate legislation is indexed for ${actsCount} mapped ${pluralActs} ` +
          `(${totalEntries} ${pluralEntries} total).` +
          topCategoriesText +
          topActsText +
          " Review rules, notifications, circulars, or orders where operational or sector-specific compliance matters." +
          sourceGapText,
        subordinate_context: context,
        related_acts: actionableActsWithSubordinate.map(({ act, subordinate }) => ({
          act_id: act.act_id,
          title: summarizeActTitle(act),
          subordinate_count: subordinate.count,
          top_categories: subordinate.top_categories || [],
        })),
      },
    ],
    context,
  };
}

/**
 * Dynamic Statutory KB Validation Engine
 */
export async function runStatutoryValidation(draft) {
  const issues = [];
  const context = {
    domains: [],
    statutes_loaded: 0,
    compiled_rules: 0,
    subordinate: emptySubordinateContext(),
  };

  try {
    const domains = inferDomainRequirements(draft.document_type, draft);
    context.domains = domains;

    const compiledRules = [];
    const relevantActs = [];

    for (const domain of domains) {
      const acts = loadStatutesForDomain(domain);
      relevantActs.push(...acts);

      for (const act of acts) {
        const sections = loadSectionsForAct(act.act_id);
        const rules = compileRulesFromAct(act, sections);
        compiledRules.push(...rules);
      }
    }

    const uniqueRules = [];
    const seenRuleIds = new Set();
    for (const rule of compiledRules) {
      if (!seenRuleIds.has(rule.rule_id)) {
        seenRuleIds.add(rule.rule_id);
        uniqueRules.push(rule);
      }
    }

    const uniqueActs = [];
    const seenActIds = new Set();
    for (const act of relevantActs) {
      if (!act?.act_id || seenActIds.has(act.act_id)) continue;
      seenActIds.add(act.act_id);
      uniqueActs.push(act);
    }

    context.statutes_loaded = uniqueActs.length;
    context.compiled_rules = uniqueRules.length;

    const subordinateNotice = buildSubordinateNotice(uniqueActs);
    context.subordinate = subordinateNotice.context;
    issues.push(...subordinateNotice.issues);

    const statutoryIssues = compareDraftAgainstRules(draft, uniqueRules);
    issues.push(...statutoryIssues);
  } catch (err) {
    console.error("Statutory engine failed safely:", err);
  }

  return { issues, context };
}
