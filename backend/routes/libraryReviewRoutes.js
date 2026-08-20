/**
 * libraryReviewRoutes.js
 *
 * Advocate review of the live clause library, as opposed to the candidate queue
 * in clauseReviewRoutes.js. Mounted admin-only.
 */

import express from "express";

import {
  listLibraryClauses,
  summariseLibraryReview,
  recordLibraryReview,
} from "../services/libraryReviewService.js";

const router = express.Router();

// GET /admin/library-review/summary  — headline coverage for the admin banner.
router.get("/summary", (_req, res) => {
  try {
    res.json(summariseLibraryReview());
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// GET /admin/library-review?state=outstanding&search=indemnity&documentType=NDA
// Ordered by how much of the product each clause touches, so a partial review
// still covers the documents users actually generate.
router.get("/", (req, res) => {
  try {
    const clauses = listLibraryClauses({
      state: req.query.state || null,
      search: req.query.search || null,
      documentType: req.query.documentType || null,
    });
    res.json({ count: clauses.length, clauses, summary: summariseLibraryReview() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /admin/library-review/:clauseId
// { decision: approve|amend|reject|discuss|reset, revised_text, note,
//   reviewer, enrolment, reviewed_on }
router.patch("/:clauseId", (req, res) => {
  try {
    const body = req.body || {};
    res.json(
      recordLibraryReview({
        clauseId: req.params.clauseId,
        decision: body.decision,
        revisedText: body.revised_text,
        note: body.note,
        // The signed-in administrator is the reviewer of record unless a name is
        // supplied explicitly (an advocate reviewing under a shared account).
        reviewer: body.reviewer || req.user?.name || req.user?.email,
        enrolment: body.enrolment,
        reviewedOn: body.reviewed_on,
      })
    );
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
