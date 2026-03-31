import mongoose from "mongoose";

const { Schema } = mongoose;

const documentVersionSchema = new Schema(
  {
    draftId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentDraft",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    changeType: {
      type: String,
      enum: [
        "generated",
        "autosave",
        "manual_edit",
        "ai_edit",
        "validated",
        "exported",
        "restored",
      ],
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
    },
    draftSnapshot: {
      type: Schema.Types.Mixed,
      required: true,
    },
    validationSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    summary: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false,
  }
);

documentVersionSchema.index({ draftId: 1, versionNumber: -1 }, { unique: true });
documentVersionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model("DocumentVersion", documentVersionSchema);
