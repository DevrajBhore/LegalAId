import express from "express";
import {
  deleteDocumentHistory,
  getDocumentHistoryDetail,
  listDocumentHistories,
  restoreDocumentHistoryVersion,
  saveDocumentHistory,
} from "../services/documentHistoryService.js";

const router = express.Router();

router.get("/documents", async (req, res) => {
  try {
    const documents = await listDocumentHistories(req.user._id);
    res.json({ documents });
  } catch (error) {
    console.error("History list error:", error);
    res.status(500).json({
      error: "Failed to load document history.",
      details: error.message,
    });
  }
});

router.post("/documents/save", async (req, res) => {
  try {
    const result = await saveDocumentHistory({
      userId: req.user._id,
      draftId: req.body?.draftId || null,
      draft: req.body?.draft,
      validation: req.body?.validation || null,
      documentMeta: req.body?.documentMeta || null,
      changeType: req.body?.changeType || "autosave",
    });
    res.json(result);
  } catch (error) {
    console.error("History save error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to save document history.",
    });
  }
});

router.get("/documents/:id", async (req, res) => {
  try {
    const detail = await getDocumentHistoryDetail(req.user._id, req.params.id);
    res.json(detail);
  } catch (error) {
    console.error("History detail error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to load document history detail.",
    });
  }
});

router.delete("/documents/:id", async (req, res) => {
  try {
    const result = await deleteDocumentHistory(req.user._id, req.params.id);
    res.json(result);
  } catch (error) {
    console.error("History delete error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to delete document history.",
    });
  }
});

router.post("/documents/:id/restore/:versionId", async (req, res) => {
  try {
    const detail = await restoreDocumentHistoryVersion({
      userId: req.user._id,
      draftId: req.params.id,
      versionId: req.params.versionId,
    });
    res.json(detail);
  } catch (error) {
    console.error("History restore error:", error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Failed to restore document version.",
    });
  }
});

export default router;
