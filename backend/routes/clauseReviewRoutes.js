import express from "express";
import {
  importMinedClauses,
  listClauseReviews,
  setReviewStatus,
  promoteClause,
} from "../services/clauseReviewService.js";

const router = express.Router();

// NOTE: AI gap-detection (propose missing protections → queue) is exposed at
// POST /admin/clause-authoring/propose (index.js), which carries the aiLimiter.
// This router owns the review/promote half of the flywheel.

// GET /admin/clause-reviews?status=pending&category=termination
router.get("/", async (req, res) => {
  try {
    const reviews = await listClauseReviews({
      status: req.query.status || null,
      category: req.query.category || null,
    });
    res.json({ count: reviews.length, reviews });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// POST /admin/clause-reviews/import  — pull mined variants into the queue
router.post("/import", async (_req, res) => {
  try {
    res.json(await importMinedClauses());
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /admin/clause-reviews/:id  { status, notes }
router.patch("/:id", async (req, res) => {
  try {
    const updated = await setReviewStatus({
      id: req.params.id,
      status: req.body?.status,
      notes: req.body?.notes,
      userId: req.user?._id,
    });
    res.json(updated);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// POST /admin/clause-reviews/:id/promote  — write a production stub
router.post("/:id/promote", async (req, res) => {
  try {
    res.json(await promoteClause({ id: req.params.id }));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
