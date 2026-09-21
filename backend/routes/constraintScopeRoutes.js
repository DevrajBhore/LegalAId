/**
 * constraintScopeRoutes.js
 *
 * Advocate review of constraint SCOPE — which instruments a rule is about — as
 * opposed to libraryReviewRoutes.js, which reviews clause text. Mounted
 * admin-only.
 */

import express from "express";

import {
  listConstraintScopes,
  summariseConstraintScope,
  recordScopeDecision,
} from "../services/constraintScopeReviewService.js";

const router = express.Router();

// GET /admin/constraint-scope/summary
router.get("/summary", (_req, res) => {
  try {
    res.json(summariseConstraintScope());
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// GET /admin/constraint-scope?state=outstanding
router.get("/", (req, res) => {
  try {
    const rules = listConstraintScopes({ state: req.query.state || null });
    res.json({ count: rules.length, rules, summary: summariseConstraintScope() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

// PATCH /admin/constraint-scope/:ruleId
// { decision: decide|not_representable|discuss|reset, scope, authority, note }
//
// The decider is taken from the authenticated session, as with clause review.
// The authority is NOT — it has to be typed, because it is the thing that makes
// the answer a decision rather than an opinion.
router.patch("/:ruleId", (req, res) => {
  try {
    const body = req.body || {};
    res.json(
      recordScopeDecision({
        ruleId: req.params.ruleId,
        decision: body.decision,
        scope: body.scope,
        authority: body.authority,
        note: body.note,
        reviewer: req.user?.name || req.user?.email || body.reviewer,
        enrolment: body.enrolment,
        decidedOn: body.decided_on,
      })
    );
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

export default router;
