import crypto from "crypto";

const MAX_SUBORDINATE_DIRECTORY_LENGTH = 80;

function trimTrailingUnderscores(value = "") {
  return String(value).replace(/_+$/g, "");
}

export function getSubordinateDirectoryKey(actId = "") {
  const normalized = String(actId || "").trim();
  if (!normalized) return "";

  if (normalized.length <= MAX_SUBORDINATE_DIRECTORY_LENGTH) {
    return normalized;
  }

  const suffixMatch = normalized.match(/(__\d+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : "";
  const hash = crypto.createHash("sha1").update(normalized).digest("hex").slice(0, 12);
  const reservedLength = suffix.length + hash.length + 2;
  const prefixLength = Math.max(
    16,
    MAX_SUBORDINATE_DIRECTORY_LENGTH - reservedLength
  );
  const prefix = trimTrailingUnderscores(normalized.slice(0, prefixLength));
  return `${prefix}_${hash}${suffix}`;
}

export function getSubordinateDirectoryMetadata(actId = "") {
  const directoryKey = getSubordinateDirectoryKey(actId);
  return {
    actId: String(actId || "").trim(),
    directoryKey,
    isAliased: directoryKey !== String(actId || "").trim(),
  };
}

export { MAX_SUBORDINATE_DIRECTORY_LENGTH };
