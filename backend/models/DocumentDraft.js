import mongoose from "mongoose";

const { Schema } = mongoose;

const documentDraftSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    documentMeta: {
      type: Schema.Types.Mixed,
      default: null,
    },
    currentDraft: {
      type: Schema.Types.Mixed,
      required: true,
    },
    currentValidation: {
      type: Schema.Types.Mixed,
      default: null,
    },
    sourceVariables: {
      type: Schema.Types.Mixed,
      default: null,
    },
    currentVersionNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    versionCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    latestVersionId: {
      type: Schema.Types.ObjectId,
      ref: "DocumentVersion",
      default: null,
    },
    lastContentHash: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["draft", "validated", "exported", "archived"],
      default: "draft",
      index: true,
    },
    lastOpenedAt: {
      type: Date,
      default: null,
    },
    lastValidatedAt: {
      type: Date,
      default: null,
    },
    lastExportedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

documentDraftSchema.index({ userId: 1, updatedAt: -1 });

export default mongoose.model("DocumentDraft", documentDraftSchema);
