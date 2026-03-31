import crypto from "crypto";
import DocumentDraft from "../models/DocumentDraft.js";
import DocumentVersion from "../models/DocumentVersion.js";
import { buildDocumentTypeMeta } from "./documentTypeNormalizer.js";

function cloneValue(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

function buildTitle(documentType, documentMeta) {
  return (
    documentMeta?.displayName ||
    buildDocumentTypeMeta(documentType)?.displayName ||
    String(documentType || "Untitled Document")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function buildHashPayload(draft) {
  return {
    document_type: draft?.document_type || null,
    jurisdiction: draft?.jurisdiction || null,
    clauses: (draft?.clauses || []).map((clause) => ({
      clause_id: clause?.clause_id || null,
      category: clause?.category || null,
      title: clause?.title || null,
      text: clause?.text || null,
      statutory_reference: clause?.statutory_reference || null,
    })),
    source_variables: draft?.metadata?.source_variables || null,
  };
}

function buildContentHash(draft) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(buildHashPayload(draft)))
    .digest("hex");
}

function summarizeValidation(validation) {
  if (!validation) return null;

  return {
    mode: validation.mode || null,
    certified: validation.certified === true,
    risk:
      validation.risk || validation.overall_risk || validation.risk_level || null,
    issueCount:
      validation.summary?.total ??
      validation.issueCount ??
      validation.issue_count ??
      0,
    blocking:
      validation.summary?.blocking ?? validation.blockingIssues?.length ?? 0,
    advisory:
      validation.summary?.advisory ?? validation.advisoryIssues?.length ?? 0,
    notices:
      validation.summary?.notices ?? validation.notices?.length ?? 0,
  };
}

function deriveStatus({ changeType, validation }) {
  if (changeType === "exported") return "exported";

  if (validation?.certified === true) {
    const openIssues =
      validation?.summary?.total ??
      validation?.issueCount ??
      validation?.issue_count ??
      0;

    if (openIssues === 0) {
      return "validated";
    }
  }

  return "draft";
}

function buildHistorySummary(record) {
  const validationSummary = summarizeValidation(record.currentValidation);

  return {
    draftId: String(record._id),
    documentType: record.documentType,
    title: record.title,
    documentMeta:
      record.documentMeta || buildDocumentTypeMeta(record.documentType),
    status: record.status,
    currentVersionNumber: 1,
    versionCount: 1,
    updatedAt: record.updatedAt,
    createdAt: record.createdAt,
    lastOpenedAt: record.lastOpenedAt,
    lastValidatedAt: record.lastValidatedAt,
    lastExportedAt: record.lastExportedAt,
    validation: validationSummary,
  };
}

function ensureOwnedDraft(record, draftId) {
  if (!record) {
    const error = new Error(
      `Document history record "${draftId}" was not found.`
    );
    error.statusCode = 404;
    throw error;
  }
}

async function purgeLegacyHistoryRecords(userId, documentType, keepId = null) {
  const records = await DocumentDraft.find({ userId, documentType })
    .sort({ updatedAt: -1, createdAt: -1 })
    .select("_id")
    .lean();

  const keepRecordId =
    keepId != null
      ? String(keepId)
      : records.length > 0
        ? String(records[0]._id)
        : null;

  const staleIds = records
    .map((record) => String(record._id))
    .filter((id) => id !== keepRecordId);

  if (staleIds.length > 0) {
    await DocumentDraft.deleteMany({ _id: { $in: staleIds }, userId });
  }

  const allIdsForCleanup = keepRecordId
    ? [keepRecordId, ...staleIds]
    : staleIds;

  if (allIdsForCleanup.length > 0) {
    await DocumentVersion.deleteMany({
      userId,
      draftId: { $in: allIdsForCleanup },
    });
  }
}

async function findPrimaryDraftRecord(userId, draftId, documentType) {
  const records = await DocumentDraft.find({ userId, documentType }).sort({
    updatedAt: -1,
    createdAt: -1,
  });

  if (records.length === 0) {
    return null;
  }

  if (draftId) {
    const matching = records.find((record) => String(record._id) === String(draftId));
    if (matching) {
      return matching;
    }
  }

  return records[0];
}

export async function saveDocumentHistory({
  userId,
  draftId,
  draft,
  validation = null,
  documentMeta = null,
  changeType = "autosave",
}) {
  if (!draft?.document_type || !Array.isArray(draft?.clauses)) {
    const error = new Error(
      "A valid draft with document_type and clauses is required."
    );
    error.statusCode = 400;
    throw error;
  }

  const normalizedMeta = documentMeta || buildDocumentTypeMeta(draft.document_type);
  const contentHash = buildContentHash(draft);
  const sourceVariables = cloneValue(draft?.metadata?.source_variables || null);
  const status = deriveStatus({ changeType, validation });
  const now = new Date();

  let record = await findPrimaryDraftRecord(userId, draftId, draft.document_type);

  if (draftId && !record) {
    const directRecord = await DocumentDraft.findOne({ _id: draftId, userId });
    ensureOwnedDraft(directRecord, draftId);
    record = directRecord;
  }

  if (!record) {
    record = new DocumentDraft({
      userId,
      documentType: draft.document_type,
      title: buildTitle(draft.document_type, normalizedMeta),
      documentMeta: cloneValue(normalizedMeta),
      currentDraft: cloneValue(draft),
      currentValidation: cloneValue(validation),
      sourceVariables,
      status,
      lastOpenedAt: now,
      lastValidatedAt: validation ? now : null,
      lastExportedAt: changeType === "exported" ? now : null,
      currentVersionNumber: 1,
      versionCount: 1,
      latestVersionId: null,
      lastContentHash: contentHash,
    });

    await record.save();
    await purgeLegacyHistoryRecords(userId, draft.document_type, record._id);

    return {
      history: buildHistorySummary(record),
      versionCreated: false,
      latestVersion: null,
    };
  }

  record.title = buildTitle(draft.document_type, normalizedMeta);
  record.documentType = draft.document_type;
  record.documentMeta = cloneValue(normalizedMeta);
  record.currentDraft = cloneValue(draft);
  record.currentValidation = cloneValue(validation);
  record.sourceVariables = sourceVariables;
  record.status = status;
  record.lastOpenedAt = now;
  record.currentVersionNumber = 1;
  record.versionCount = 1;
  record.latestVersionId = null;
  record.lastContentHash = contentHash;

  if (validation) {
    record.lastValidatedAt = now;
  }

  if (changeType === "exported") {
    record.lastExportedAt = now;
  }

  await record.save();
  await purgeLegacyHistoryRecords(userId, draft.document_type, record._id);

  return {
    history: buildHistorySummary(record),
    versionCreated: false,
    latestVersion: null,
  };
}

export async function listDocumentHistories(userId) {
  const records = await DocumentDraft.find({
    userId,
    status: { $ne: "archived" },
  })
    .sort({ updatedAt: -1, createdAt: -1 })
    .lean();

  const seenTypes = new Set();
  const latestRecords = [];

  for (const record of records) {
    if (seenTypes.has(record.documentType)) {
      continue;
    }

    seenTypes.add(record.documentType);
    latestRecords.push(record);
  }

  await Promise.all(
    latestRecords.map((record) =>
      purgeLegacyHistoryRecords(userId, record.documentType, record._id)
    )
  );

  return latestRecords.map((record) => buildHistorySummary(record));
}

export async function getDocumentHistoryDetail(userId, draftId) {
  const record = await DocumentDraft.findOne({
    _id: draftId,
    userId,
    status: { $ne: "archived" },
  }).lean();

  ensureOwnedDraft(record, draftId);

  return {
    draft: cloneValue(record.currentDraft),
    validation: cloneValue(record.currentValidation),
    documentMeta:
      cloneValue(record.documentMeta) || buildDocumentTypeMeta(record.documentType),
    history: buildHistorySummary(record),
    versions: [],
  };
}

export async function deleteDocumentHistory(userId, draftId) {
  const record = await DocumentDraft.findOne({
    _id: draftId,
    userId,
  });

  ensureOwnedDraft(record, draftId);

  const relatedRecords = await DocumentDraft.find({
    userId,
    documentType: record.documentType,
  })
    .select("_id")
    .lean();

  const relatedIds = relatedRecords.map((item) => String(item._id));

  if (relatedIds.length > 0) {
    await DocumentVersion.deleteMany({
      userId,
      draftId: { $in: relatedIds },
    });
  }

  await DocumentDraft.deleteMany({
    userId,
    documentType: record.documentType,
  });

  return {
    deleted: true,
    draftId: String(record._id),
    documentType: record.documentType,
  };
}

export async function restoreDocumentHistoryVersion() {
  const error = new Error(
    "Version history is no longer stored. Only the latest saved draft is kept for each document type."
  );
  error.statusCode = 410;
  throw error;
}
