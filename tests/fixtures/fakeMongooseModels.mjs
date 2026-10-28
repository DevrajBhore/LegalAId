/**
 * fakeMongooseModels.mjs — in-memory stand-ins for DocumentDraft/DocumentVersion.
 *
 * Just enough of the Mongoose model and query API that
 * backend/services/documentHistoryService.js uses, so its semantics can be
 * tested offline without a MongoDB server. Not a general Mongoose emulator.
 */
import { createRequire } from "node:module";

// Mongoose is a backend dependency only (see the root package.json note);
// resolve the backend's copy so ObjectId matches the service's instance.
const mongoose = createRequire(new URL("../../backend/package.json", import.meta.url))("mongoose");

// Deep copy that keeps ObjectIds and Dates as themselves (structuredClone
// turns an ObjectId into a plain object).
function clone(value) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof mongoose.Types.ObjectId) return new mongoose.Types.ObjectId(String(value));
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  const out = {};
  for (const [key, inner] of Object.entries(value)) out[key] = clone(inner);
  return out;
}
const idOf = (value) => (value == null ? value : String(value));

function matchesValue(actual, expected) {
  if (expected && typeof expected === "object" && !(expected instanceof mongoose.Types.ObjectId)) {
    if ("$in" in expected) return expected.$in.map(idOf).includes(idOf(actual));
    if ("$ne" in expected) return idOf(actual) !== idOf(expected.$ne);
    if ("$eq" in expected) return idOf(actual) === idOf(expected.$eq);
  }
  return idOf(actual) === idOf(expected);
}

function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => matchesValue(doc[key], expected));
}

function compareBy(sortSpec) {
  const entries = Object.entries(sortSpec || {});
  return (a, b) => {
    for (const [key, dir] of entries) {
      const av = a[key] instanceof Date ? a[key].getTime() : a[key];
      const bv = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    return 0;
  };
}

function makeModel(name) {
  const store = new Map();
  let tick = 0;
  const nextTime = () => new Date(Date.UTC(2026, 0, 1) + ++tick * 1000);

  class Doc {
    constructor(fields = {}) {
      Object.assign(this, clone(fields));
      if (!this._id) this._id = new mongoose.Types.ObjectId();
    }
    async save() {
      const now = nextTime();
      if (!this.createdAt) this.createdAt = now;
      this.updatedAt = now;
      const plain = { ...this };
      store.set(idOf(this._id), clone(plain));
      return this;
    }
  }

  const hydrate = (raw) => Object.assign(Object.create(Doc.prototype), clone(raw));

  class Query {
    constructor(filter, single) {
      this.filter = filter;
      this.single = single;
      this.sortSpec = null;
      this.skipN = 0;
      this.limitN = Infinity;
      this.asLean = false;
    }
    sort(spec) { this.sortSpec = spec; return this; }
    skip(n) { this.skipN = n; return this; }
    limit(n) { this.limitN = n; return this; }
    select() { return this; }
    lean() { this.asLean = true; return this; }
    exec() {
      let rows = [...store.values()].filter((doc) => matches(doc, this.filter));
      if (this.sortSpec) rows.sort(compareBy(this.sortSpec));
      rows = rows.slice(this.skipN, this.skipN + this.limitN);
      const out = rows.map((row) => (this.asLean ? clone(row) : hydrate(row)));
      return Promise.resolve(this.single ? out[0] || null : out);
    }
    then(resolve, reject) { return this.exec().then(resolve, reject); }
    catch(reject) { return this.exec().catch(reject); }
  }

  Doc.modelName = name;
  Doc._store = store;
  Doc.find = (filter) => new Query(filter, false);
  Doc.findOne = (filter) => new Query(filter, true);
  Doc.create = async (fields) => new Doc(fields).save();
  Doc.deleteMany = async (filter) => {
    let deletedCount = 0;
    for (const [key, doc] of [...store.entries()]) {
      if (matches(doc, filter)) { store.delete(key); deletedCount += 1; }
    }
    return { deletedCount };
  };
  Doc.deleteOne = async (filter) => {
    for (const [key, doc] of store.entries()) {
      if (matches(doc, filter)) { store.delete(key); return { deletedCount: 1 }; }
    }
    return { deletedCount: 0 };
  };
  return Doc;
}

export const FakeDocumentDraft = makeModel("DocumentDraft");
export const FakeDocumentVersion = makeModel("DocumentVersion");
