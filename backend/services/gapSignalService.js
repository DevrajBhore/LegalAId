/**
 * gapSignalService.js
 *
 * The flywheel's auto-seeding step. extractGaps() reads a finished generation and
 * names the gaps it reveals — advisory issues that survived, and recommended
 * protections the document lacks. recordGaps() increments a usage counter per
 * (documentType, gap) so the most common real-world gaps float to the top and
 * can be turned into AI proposals. extractGaps is pure (unit-tested without Mongo);
 * recordGaps degrades gracefully if Mongo is unavailable.
 */
import GapSignal from "../models/GapSignal.js";

// Protections commonly expected; if a document lacks the category entirely we
// record it as a gap (mirrors the editor's gap analysis, server-side).
const RECOMMENDED_PROTECTIONS = [
  { key: "LIABILITY", match: ["RISK", "LIABILITY"], label: "Limitation of Liability" },
  { key: "INDEMNITY", match: ["INDEMNITY"], label: "Indemnity" },
  { key: "FORCE_MAJEURE", match: ["FORCE_MAJEURE"], label: "Force Majeure" },
  { key: "DISPUTE_RESOLUTION", match: ["DISPUTE_RESOLUTION", "DISPUTE", "ARBITRATION"], label: "Dispute Resolution" },
  { key: "CONFIDENTIALITY", match: ["CONFIDENTIALITY"], label: "Confidentiality" },
];

export function extractGaps(draft, validation = {}) {
  const gaps = [];

  // 1. Advisory issues that survived to the certified document.
  for (const issue of validation?.advisoryIssues || []) {
    if (!issue?.rule_id) continue;
    gaps.push({
      gapType: "advisory",
      gapKey: issue.rule_id,
      label: issue.message || issue.rule_id,
    });
  }

  // 2. Recommended protections the document lacks.
  const present = new Set(
    (draft?.clauses || []).map((c) => String(c?.category || "").toUpperCase())
  );
  for (const p of RECOMMENDED_PROTECTIONS) {
    if (!p.match.some((cat) => present.has(cat))) {
      gaps.push({ gapType: "missing_protection", gapKey: p.key, label: `Missing: ${p.label}` });
    }
  }

  // De-dupe by gapKey.
  const seen = new Set();
  return gaps.filter((g) => (seen.has(g.gapKey) ? false : seen.add(g.gapKey)));
}

// Fire-and-forget: never block or fail a generation because gap-recording failed.
export async function recordGaps(documentType, draft, validation) {
  if (!documentType) return { recorded: 0 };
  const gaps = extractGaps(draft, validation);
  let recorded = 0;
  for (const g of gaps) {
    try {
      await GapSignal.updateOne(
        { documentType, gapKey: g.gapKey },
        {
          $set: { gapType: g.gapType, label: g.label, lastSeenAt: new Date() },
          $inc: { count: 1 },
        },
        { upsert: true }
      );
      recorded += 1;
    } catch {
      /* Mongo unavailable / race — skip silently. */
    }
  }
  return { recorded };
}

export async function listTopGaps({ documentType, limit = 50 } = {}) {
  const filter = {};
  if (documentType) filter.documentType = documentType;
  const rows = await GapSignal.find(filter).sort({ count: -1, lastSeenAt: -1 }).limit(limit).lean();
  return rows.map((r) => ({
    documentType: r.documentType,
    gapType: r.gapType,
    gapKey: r.gapKey,
    label: r.label,
    count: r.count,
    lastSeenAt: r.lastSeenAt,
    proposed: Boolean(r.proposedAt),
  }));
}
