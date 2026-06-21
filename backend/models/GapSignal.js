import mongoose from "mongoose";

// Usage-driven gap signals: each real generation that hits an advisory issue or
// lacks a recommended protection increments a counter here. This closes the
// flywheel's 4th step — usage reveals gaps automatically, so an admin (or a
// threshold job) can turn the top gaps into AI proposals without hand-hunting.
const gapSignalSchema = new mongoose.Schema(
  {
    documentType: { type: String, required: true, index: true },
    gapType: { type: String, enum: ["advisory", "missing_protection"], required: true },
    gapKey: { type: String, required: true }, // rule_id or missing category
    label: { type: String, default: null },
    count: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: Date.now },
    // Set once an AI proposal has been generated for this gap, to avoid re-proposing.
    proposedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

gapSignalSchema.index({ documentType: 1, gapKey: 1 }, { unique: true });

export default mongoose.model("GapSignal", gapSignalSchema);
