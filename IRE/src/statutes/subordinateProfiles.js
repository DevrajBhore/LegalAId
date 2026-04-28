function formatCategorySnippet(subordinate = {}, categories = []) {
  const counts = subordinate?.category_counts || {};
  const parts = categories
    .map((category) => {
      const count = counts[category] || 0;
      if (!count) return null;
      return `${category} (${count})`;
    })
    .filter(Boolean)
    .slice(0, 3);

  if (parts.length === 0) return "";
  return ` Primary indexed categories: ${parts.join(", ")}.`;
}

function buildSourceGapText(subordinate = {}) {
  return subordinate.failed_candidate_count > 0
    ? " Some linked source files still had upstream retrieval gaps on India Code, so final source review may be needed for time-sensitive compliance points."
    : "";
}

export const SUBORDINATE_ACT_PROFILES = [
  {
    key: "GST",
    actIdPrefix: "the_central_goods_and_services_tax_act_2017",
    ruleId: "SUBORDINATE_GST_COMPLIANCE_REVIEW",
    categories: ["notifications", "circulars", "orders", "rules"],
    buildMessage({ subordinate }) {
      return (
        `CGST subordinate legislation is indexed (${subordinate.count} items).` +
        formatCategorySnippet(subordinate, this.categories) +
        " Review GST rate notifications, invoicing directions, circulars, and procedural orders before relying on tax clauses, invoicing language, or compliance assumptions." +
        buildSourceGapText(subordinate)
      );
    },
  },
  {
    key: "COMPANIES",
    actIdPrefix: "the_companies_act_2013",
    ruleId: "SUBORDINATE_COMPANIES_COMPLIANCE_REVIEW",
    categories: ["rules", "notifications", "orders"],
    buildMessage({ subordinate }) {
      return (
        `Companies Act subordinate legislation is indexed (${subordinate.count} items).` +
        formatCategorySnippet(subordinate, this.categories) +
        " Review company-law rules and notifications for governance, filings, board procedures, share actions, and corporate compliance mechanics that may sit outside the parent Act text." +
        buildSourceGapText(subordinate)
      );
    },
  },
  {
    key: "EPF",
    actIdPrefix:
      "the_employees_provident_funds_and_miscellaneous_provisions_act_1952",
    ruleId: "SUBORDINATE_EPF_COMPLIANCE_REVIEW",
    categories: ["notifications", "rules", "orders"],
    buildMessage({ subordinate }) {
      return (
        `EPF subordinate legislation is indexed (${subordinate.count} items).` +
        formatCategorySnippet(subordinate, this.categories) +
        " Review provident-fund schemes, contribution procedure updates, exemptions, and notification-driven labour compliance points before treating employment terms as operationally complete." +
        buildSourceGapText(subordinate)
      );
    },
  },
  {
    key: "STAMP",
    actIdPrefix: "the_indian_stamp_act_1899",
    ruleId: "SUBORDINATE_STAMP_COMPLIANCE_REVIEW",
    categories: ["rules", "directions", "orders", "notifications"],
    buildMessage({ subordinate }) {
      return (
        `Indian Stamp Act subordinate materials are indexed (${subordinate.count} items).` +
        formatCategorySnippet(subordinate, ["rules", "orders", "notifications"]) +
        " Review stamp-related directions and procedural materials where execution, adjudication, or instrument treatment could turn on more than the parent Act alone."
      );
    },
  },
];

export function buildTargetedSubordinateProfileNotices(resolvedActs = []) {
  const issues = [];
  const matchedProfiles = [];

  for (const profile of SUBORDINATE_ACT_PROFILES) {
    const match = resolvedActs.find(
      ({ act, subordinate }) =>
        act?.act_id?.startsWith(profile.actIdPrefix) &&
        subordinate?.has_subordinate_legislation === true &&
        (subordinate?.count || 0) > 0
    );

    if (!match) continue;

    matchedProfiles.push(profile.key);
    issues.push({
      rule_id: profile.ruleId,
      severity: "LOW",
      notice_only: true,
      recommendation_only: true,
      source: "SubordinateStatutoryProfile",
      statutory_ref: match.act?.title || match.act?.act_id || profile.actIdPrefix,
      message: profile.buildMessage(match),
      subordinate_profile: profile.key,
      subordinate_context: {
        act_id: match.act?.act_id,
        subordinate_count: match.subordinate?.count || 0,
        category_counts: match.subordinate?.category_counts || {},
      },
    });
  }

  return { issues, matchedProfiles };
}
