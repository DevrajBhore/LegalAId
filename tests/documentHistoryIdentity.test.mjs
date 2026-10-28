/**
 * documentHistoryIdentity.test.mjs — EACH SAVED DOCUMENT IS ITS OWN MATTER
 *
 * The history service used to keep "one live document per type": a save with
 * no matching id attached itself to the user's latest record of that type, and
 * every save and list deleted the user's other records of the type. Two
 * unrelated NDAs therefore overwrote each other.
 *
 * Runs offline: the two Mongoose models are swapped for in-memory stand-ins
 * (tests/fixtures/fakeMongooseModels.mjs) through a module resolve hook.
 */
import assert from "node:assert/strict";
import { register, createRequire } from "node:module";

const FAKES = new URL("./fixtures/fakeMongooseModels.mjs", import.meta.url).href;
const stub = (exportName) =>
  "data:text/javascript," + encodeURIComponent(`export { ${exportName} as default } from ${JSON.stringify(FAKES)};`);
const hooks = `
const DRAFT = ${JSON.stringify(stub("FakeDocumentDraft"))};
const VERSION = ${JSON.stringify(stub("FakeDocumentVersion"))};
export async function resolve(specifier, context, next) {
  if (/\\/models\\/DocumentDraft\\.js$/.test(specifier)) return { url: DRAFT, shortCircuit: true };
  if (/\\/models\\/DocumentVersion\\.js$/.test(specifier)) return { url: VERSION, shortCircuit: true };
  return next(specifier, context);
}`;
register("data:text/javascript," + encodeURIComponent(hooks));

const { FakeDocumentDraft, FakeDocumentVersion } = await import(FAKES);
const {
  saveDocumentHistory,
  listDocumentHistories,
  deleteDocumentHistory,
  getDocumentHistoryDetail,
  restoreDocumentHistoryVersion,
} = await import("../backend/services/documentHistoryService.js");
const mongoose = createRequire(new URL("../backend/package.json", import.meta.url))("mongoose");

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks += 1;
  console.log(`PASS  ${msg}`);
};

const userA = new mongoose.Types.ObjectId();
const userB = new mongoose.Types.ObjectId();
const nda = (party, text = "The Receiving Party shall keep it confidential.") => ({
  document_type: "NDA",
  clauses: [{ clause_id: "NDA_CONF", category: "CONFIDENTIALITY", title: "Confidentiality", text }],
  metadata: { source_variables: { party_1_name: party, party_2_name: "Counterparty Ltd" } },
});

/* ── Two NDAs for one user are two documents ────────────────────────────── */
const first = await saveDocumentHistory({ userId: userA, draft: nda("Acme Pvt Ltd") });
const second = await saveDocumentHistory({ userId: userA, draft: nda("Beta LLP") });
ok(first.history.draftId !== second.history.draftId, "a save without an id starts a new document, even of the same type");

let list = await listDocumentHistories(userA);
ok(list.length === 2, "both NDAs are listed");
ok(FakeDocumentDraft._store.size === 2, "listing deletes nothing");
ok(list.some((d) => d.parties === "Acme Pvt Ltd & Counterparty Ltd") && list.some((d) => d.parties === "Beta LLP & Counterparty Ltd"),
  "each listed document carries its party names, so same-type drafts can be told apart");

/* ── Saving with an id updates exactly that document ────────────────────── */
const edited = await saveDocumentHistory({
  userId: userA,
  draftId: first.history.draftId,
  draft: nda("Acme Pvt Ltd", "The Receiving Party shall keep it strictly confidential."),
  changeType: "manual_edit",
});
ok(edited.history.draftId === first.history.draftId && edited.versionCreated, "a save with an id versions that document");
const firstDetail = await getDocumentHistoryDetail(userA, first.history.draftId);
const secondDetail = await getDocumentHistoryDetail(userA, second.history.draftId);
ok(/strictly/.test(firstDetail.draft.clauses[0].text), "the named document holds the edit");
ok(!/strictly/.test(secondDetail.draft.clauses[0].text), "the other NDA is untouched by the edit");
ok(firstDetail.versions.length === 2 && secondDetail.versions.length === 1, "each document keeps its own version history");
ok("intelligence" in firstDetail && "obligations" in firstDetail,
  "a reopened document comes back with explanations and obligations derived from its stored draft");

/* ── Ownership is enforced ──────────────────────────────────────────────── */
await assert.rejects(
  saveDocumentHistory({ userId: userB, draftId: first.history.draftId, draft: nda("Intruder") }),
  (err) => err.statusCode === 404
);
checks += 1; console.log("PASS  another user cannot save into this document");
await assert.rejects(
  saveDocumentHistory({ userId: userA, draftId: "not-an-id", draft: nda("X") }),
  (err) => err.statusCode === 404
);
checks += 1; console.log("PASS  a malformed id is a 404, not a silent new document");

/* ── Restore stays within the document ──────────────────────────────────── */
const firstVersionId = firstDetail.versions[firstDetail.versions.length - 1].versionId;
const restored = await restoreDocumentHistoryVersion({ userId: userA, draftId: first.history.draftId, versionId: firstVersionId });
ok(!/strictly/.test(restored.draft.clauses[0].text) && restored.history.draftId === first.history.draftId,
  "restoring a version changes only that document");
ok("intelligence" in restored && "obligations" in restored, "a restore returns panels for the restored text");

/* ── Delete removes one document, not the type ──────────────────────────── */
await deleteDocumentHistory(userA, first.history.draftId);
list = await listDocumentHistories(userA);
ok(list.length === 1 && list[0].draftId === second.history.draftId, "deleting one NDA leaves the other");
ok([...FakeDocumentVersion._store.values()].every((v) => String(v.draftId) === second.history.draftId),
  "the deleted document's versions are gone; the other's remain");

console.log(`\nALL GREEN (${checks} checks)`);
