import mongoose from "mongoose";

// Human-review queue for clause variants mined from scraped templates.
// Nothing reaches the production clause_library without passing through here.
const clauseReviewSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, index: true },
    fingerprint: { type: String, required: true },
    clauseName: { type: String, default: null },
    text: { type: String, required: true },
    charLength: { type: Number, default: 0 },
    riskLevel: { type: String, default: "medium" },
    sourceTemplate: { type: String, default: null },
    sourceDocumentName: { type: String, default: null },
    // Provenance of the candidate: "mined" (scraped templates) or "ai-proposed".
    source: { type: String, enum: ["mined", "ai-proposed"], default: "mined", index: true },
    // For AI proposals: the document type it was proposed for, plus the rule that
    // should wire it in (so promotion can stage a near-complete, wireable clause).
    documentType: { type: String, default: null },
    legalBasis: { type: String, default: null },
    ruleWhen: { type: String, default: null },
    ruleAction: { type: String, default: null },
    proposalWhy: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "promoted"],
      default: "pending",
      index: true,
    },
    reviewNotes: { type: String, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    promotedClauseId: { type: String, default: null },
  },
  { timestamps: true }
);

// One review row per distinct mined clause (category + content fingerprint).
clauseReviewSchema.index({ category: 1, fingerprint: 1 }, { unique: true });

export default mongoose.model("ClauseReview", clauseReviewSchema);
