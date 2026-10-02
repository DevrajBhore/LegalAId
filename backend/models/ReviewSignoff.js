import mongoose from "mongoose";

/**
 * Advocate review state, stored where it survives.
 *
 * libraryReviewService and constraintScopeReviewService write their decisions
 * into the knowledge-base JSON files. That is correct for a developer machine
 * and wrong for the deployment: render.yaml runs on the free plan with no `disk:`
 * mount, so the container filesystem is rebuilt from the deployed image on every
 * restart and free instances sleep after inactivity. Every sign-off written to a
 * file is therefore reverted, which is why a reviewed clause reappears as pending
 * after the advocate signs in again.
 *
 * The clause library files are SOURCE. Review state is DATA. Data belongs here.
 *
 * The file write is kept as well, so a maintainer can still commit accumulated
 * sign-offs into the repository and importReviewSignoff.py keeps working. This
 * collection is what the running product reads.
 */
const reviewSignoffSchema = new mongoose.Schema(
  {
    // "clause" | "constraint_scope" — what kind of object was reviewed.
    kind: { type: String, required: true, index: true },
    // clause_id or rule_id.
    targetId: { type: String, required: true, index: true },
    /**
     * Exactly the fields the service writes onto the object, and nothing else.
     * Stored as a free-form object rather than a typed schema because the two
     * kinds record different things, and because a typed mirror of the clause
     * shape here would be a second place to update whenever that shape moves.
     */
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true }
);

reviewSignoffSchema.index({ kind: 1, targetId: 1 }, { unique: true });

export default mongoose.models.ReviewSignoff ||
  mongoose.model("ReviewSignoff", reviewSignoffSchema);
