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
    currentVersionNumber: record.currentVersionNumber || 1,
    versionCount: record.versionCount || 1,
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

  // Only orphaned (stale) drafts have their versions purged. The kept record's
  // version history is preserved.
  if (staleIds.length > 0) {
    await DocumentVersion.deleteMany({
      userId,
      draftId: { $in: staleIds },
    });
  }
}

const VERSION_CHANGE_TYPES = new Set([
  "generated",
  "autosave",
  "manual_edit",
  "ai_edit",
  "validated",
  "exported",
  "restored",
]);
const MAX_STORED_VERSIONS = 20;

function normalizeChangeType(changeType) {
  return VERSION_CHANGE_TYPES.has(changeType) ? changeType : "autosave";
}

async function createVersion(record, { draft, validation, changeType, contentHash, summary }) {
  const versionNumber = (record.versionCount || 0) + 1;
  const version = await DocumentVersion.create({
    draftId: record._id,
    userId: record.userId,
    versionNumber,
    changeType: normalizeChangeType(changeType),
    contentHash,
    draftSnapshot: cloneValue(draft),
    validationSnapshot: cloneValue(validation),
    summary: summary || summarizeValidation(validation),
  });

  record.currentVersionNumber = versionNumber;
  record.versionCount = versionNumber;
  record.latestVersionId = version._id;
  return version;
}

// Keep the most recent MAX_STORED_VERSIONS snapshots per draft.
async function pruneVersions(record) {
  const stale = await DocumentVersion.find({ draftId: record._id, userId: record.userId })
    .sort({ versionNumber: -1 })
    .skip(MAX_STORED_VERSIONS)
    .select("_id")
    .lean();
  if (stale.length > 0) {
    await DocumentVersion.deleteMany({ _id: { $in: stale.map((v) => v._id) } });
  }
}

function serializeVersionSummary(version) {
  return {
    versionId: String(version._id),
    versionNumber: version.versionNumber,
    changeType: version.changeType,
    createdAt: version.createdAt,
    validation: summarizeValidation(version.validationSnapshot),
  };
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
    const firstVersion = await createVersion(record, {
      draft,
      validation,
      changeType: changeType === "autosave" ? "generated" : changeType,
      contentHash,
    });
    await record.save();
    await purgeLegacyHistoryRecords(userId, draft.document_type, record._id);

    return {
      history: buildHistorySummary(record),
      versionCreated: true,
      latestVersion: serializeVersionSummary(firstVersion),
    };
  }

  const previousHash = record.lastContentHash;
  const contentChanged = previousHash !== contentHash;

  record.title = buildTitle(draft.document_type, normalizedMeta);
  record.documentType = draft.document_type;
  record.documentMeta = cloneValue(normalizedMeta);
  record.currentDraft = cloneValue(draft);
  record.currentValidation = cloneValue(validation);
  record.sourceVariables = sourceVariables;
  record.status = status;
  record.lastOpenedAt = now;
  record.lastContentHash = contentHash;

  if (validation) {
    record.lastValidatedAt = now;
  }

  if (changeType === "exported") {
    record.lastExportedAt = now;
  }

  // Snapshot a new version when content changed, or for explicit milestone events
  // (validated/exported/manual/ai edits) even if the hash is unchanged.
  const milestone = ["validated", "exported", "manual_edit", "ai_edit", "restored"].includes(
    changeType
  );
  let createdVersion = null;
  if (contentChanged || milestone) {
    createdVersion = await createVersion(record, {
      draft,
      validation,
      changeType,
      contentHash,
    });
  }

  await record.save();
  if (createdVersion) {
    await pruneVersions(record);
  }
  await purgeLegacyHistoryRecords(userId, draft.document_type, record._id);

  return {
    history: buildHistorySummary(record),
    versionCreated: Boolean(createdVersion),
    latestVersion: createdVersion ? serializeVersionSummary(createdVersion) : null,
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

  const versions = await DocumentVersion.find({ draftId, userId })
    .sort({ versionNumber: -1 })
    .limit(MAX_STORED_VERSIONS)
    .lean();

  return {
    draft: cloneValue(record.currentDraft),
    validation: cloneValue(record.currentValidation),
    documentMeta:
      cloneValue(record.documentMeta) || buildDocumentTypeMeta(record.documentType),
    history: buildHistorySummary(record),
    versions: versions.map(serializeVersionSummary),
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

export async function restoreDocumentHistoryVersion({ userId, draftId, versionId }) {
  const record = await DocumentDraft.findOne({ _id: draftId, userId });
  ensureOwnedDraft(record, draftId);

  const version = await DocumentVersion.findOne({ _id: versionId, draftId, userId });
  if (!version) {
    const error = new Error(`Version "${versionId}" was not found for this document.`);
    error.statusCode = 404;
    throw error;
  }

  const restoredDraft = cloneValue(version.draftSnapshot);
  const restoredValidation = cloneValue(version.validationSnapshot);
  const now = new Date();

  record.currentDraft = restoredDraft;
  record.currentValidation = restoredValidation;
  record.lastContentHash = version.contentHash || buildContentHash(restoredDraft);
  record.status = deriveStatus({ changeType: "restored", validation: restoredValidation });
  record.lastOpenedAt = now;

  // Record the restore itself as a new version so history stays linear/auditable.
  await createVersion(record, {
    draft: restoredDraft,
    validation: restoredValidation,
    changeType: "restored",
    contentHash: record.lastContentHash,
    summary: { restored_from_version: version.versionNumber },
  });
  await record.save();
  await pruneVersions(record);

  const versions = await DocumentVersion.find({ draftId, userId })
    .sort({ versionNumber: -1 })
    .limit(MAX_STORED_VERSIONS)
    .lean();

  return {
    draft: cloneValue(record.currentDraft),
    validation: cloneValue(record.currentValidation),
    documentMeta:
      cloneValue(record.documentMeta) || buildDocumentTypeMeta(record.documentType),
    history: buildHistorySummary(record),
    versions: versions.map(serializeVersionSummary),
    restoredFromVersion: version.versionNumber,
  };
}
