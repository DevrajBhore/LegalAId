/**
 * launchCompliance.test.mjs
 *
 * Pins the fixes from the 26 Sep 2026 launch-compliance audit, so none of them
 * quietly regresses: the claims that were removed, the one legal notice, the
 * notice in every export, consent and age at sign-up, the data-rights routes,
 * the working contact form, and the licence and font changes.
 *
 * Routes run against an in-process Express app with the database models stubbed
 * and a local SMTP sink, so nothing here needs MongoDB or a mail provider.
 */
import assert from "node:assert";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Environment BEFORE importing the email service: no Resend, SMTP to the sink.
delete process.env.RESEND_API_KEY;
process.env.JWT_SECRET = "test-secret-for-launch-compliance";
const smtp = await startSmtpSink();
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = String(smtp.port);
process.env.SMTP_PASS = "x";
process.env.SMTP_USER = "x";
process.env.EMAIL_FROM = "LegalAId <noreply@example.test>";

const express = (await import("../backend/node_modules/express/index.js")).default;
const jwt = (await import("../backend/node_modules/jsonwebtoken/index.js")).default;
const { default: User } = await import("../backend/models/User.js");
const { default: DocumentDraft } = await import("../backend/models/DocumentDraft.js");
const { default: DocumentVersion } = await import("../backend/models/DocumentVersion.js");
const { default: authRoutes } = await import("../backend/auth/authRoutes.js");
const { contactHandler } = await import("../backend/routes/contactRoutes.js");
const backendNotice = await import("../backend/services/legalNotice.js");
const frontendNotice = await import("../frontend/src/data/legalNotice.js");

let checks = 0;
const check = async (label, fn) => { await fn(); checks += 1; console.log(`PASS  ${label}`); };

/* ── Copy and claims ──────────────────────────────────────────────────────── */

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const frontendFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx?|css|html)$/.test(e.name)) frontendFiles.push(p);
  }
})(path.join(ROOT, "frontend/src"));
frontendFiles.push(path.join(ROOT, "frontend/index.html"));
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$|\{\/\*[\s\S]*?\*\/\}/gm, "");

await check("the claims the audit could not support are gone from the site", () => {
  const BANNED = [
    [/court-ready/i, "court-ready"], [/certified DOCX/i, "certified DOCX"], [/execution-ready/i, "execution-ready"],
    [/designed to be enforceable/i, "designed to be enforceable"], [/we do not guess/i, "We do not guess"],
    [/free forever/i, "Free forever"], [/lawyers-first/i, "Lawyers-first"], [/16\+ document types/i, "16+ document types"],
    [/legalaid\.in\b/i, "the dead legalaid.in domain"], [/enterprise (sales|access|workflows|enquiry)/i, "an enterprise offer that does not exist"],
    [/Payment of Wages Act|Maternity Benefit Act/, "repealed labour Acts"], [/What does 'Certified' mean/, "the Certified FAQ"],
  ];
  const hits = [];
  for (const f of frontendFiles) {
    const src = stripComments(fs.readFileSync(f, "utf8"));
    for (const [re, what] of BANNED) if (re.test(src)) hits.push(`${path.relative(ROOT, f)}: ${what}`);
  }
  assert.deepStrictEqual(hits, [], `unsupported claims are back:\n${hits.join("\n")}`);
});

await check("the contact form no longer fakes success", () => {
  const src = read("frontend/src/pages/Contact.jsx");
  assert.ok(!/setTimeout\(\s*\(\)\s*=>\s*setStatus\("success"\)/.test(src), "the timer that faked 'Message sent' is back");
  assert.match(src, /sendContactMessage\(/);
});

/* ── The one notice ───────────────────────────────────────────────────────── */

await check("the site and the exports print the same notice", () => {
  assert.strictEqual(frontendNotice.LEGAL_NOTICE, backendNotice.LEGAL_NOTICE, "frontend/src/data/legalNotice.js and backend/services/legalNotice.js have drifted");
  assert.strictEqual(frontendNotice.LEGAL_NOTICE_TITLE, backendNotice.LEGAL_NOTICE_TITLE);
  assert.strictEqual(frontendNotice.MINIMUM_AGE, backendNotice.MINIMUM_AGE);
  for (const phrase of ["not a law firm", "does not provide legal advice", "not yet been reviewed by an advocate", "AI"])
    assert.ok(backendNotice.LEGAL_NOTICE.includes(phrase), `the notice no longer says "${phrase}"`);
});

await check("the form, editor, footer and sign-up all show it", () => {
  for (const f of ["frontend/src/pages/Form.jsx", "frontend/src/pages/Editor.jsx", "frontend/src/components/Footer.jsx", "frontend/src/pages/auth/Register.jsx"])
    assert.match(read(f), /data\/legalNotice/, `${f} does not import the notice`);
  assert.match(read("frontend/src/pages/Form.jsx"), /AI_PROCESSING_NOTICE/, "the intake form lost its note about where answers go");
});

await check("every export ends with the notice (TXT and DOCX; PDF checked by hand)", async () => {
  const { generateDocument } = await import("../backend/services/documentService.js");
  const { draftToText, draftToDocx } = await import("../backend/services/exportService.js");
  const { variablesFor, FIXTURE_PROFILE } = await import("../sweep.mjs");
  const out = await generateDocument({ document_type: "NDA", variables: variablesFor("NDA", { profile: FIXTURE_PROFILE.WELL_FILLED }) });
  assert.ok(draftToText(out.draft).trimEnd().endsWith(backendNotice.LEGAL_NOTICE), "the TXT export does not end with the notice");
  const docx = Buffer.from(await draftToDocx(out.draft));
  const JSZip = (await import("../backend/node_modules/jszip/lib/index.js")).default;
  const xml = await (await JSZip.loadAsync(docx)).file("word/document.xml").async("string");
  assert.ok(xml.includes(backendNotice.LEGAL_NOTICE.slice(0, 60)), "the DOCX export does not contain the notice");
});

/* ── Sign-up: age and terms ───────────────────────────────────────────────── */

const created = [];
User.findOne = async () => null;
User.create = async (doc) => { created.push(doc); return doc; };

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.post("/contact", contactHandler());
const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const call = (method, url, body, headers = {}) =>
  fetch(base + url, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, headers: r.headers, body: await r.text().then((t) => { try { return JSON.parse(t); } catch { return t; } }) }));

const signup = { name: "Asha Rao", email: "asha@example.test", password: "correct horse battery" };

await check("sign-up is refused without the 18+ confirmation, server-side", async () => {
  const r = await call("POST", "/auth/register", { ...signup, acceptedTerms: true });
  assert.strictEqual(r.status, 400); assert.match(r.body.error, /18 or older/);
  const r2 = await call("POST", "/auth/register", { ...signup, acceptedTerms: true, ageConfirmed: "true" });
  assert.strictEqual(r2.status, 400, "a string 'true' must not count as confirmation");
  assert.strictEqual(created.length, 0);
});

await check("sign-up is refused without accepting the Terms and Privacy Policy", async () => {
  const r = await call("POST", "/auth/register", { ...signup, ageConfirmed: true });
  assert.strictEqual(r.status, 400); assert.match(r.body.error, /Terms of Service and Privacy Policy/);
  assert.strictEqual(created.length, 0);
});

await check("an accepted sign-up records what was accepted, and when", async () => {
  const before = smtp.messages.length;
  const r = await call("POST", "/auth/register", { ...signup, ageConfirmed: true, acceptedTerms: true });
  assert.strictEqual(r.status, 201, JSON.stringify(r.body));
  const c = created.at(-1).consent;
  assert.deepStrictEqual([c.termsVersion, c.privacyVersion, c.ageConfirmed], [backendNotice.TERMS_VERSION, backendNotice.PRIVACY_VERSION, true]);
  assert.ok(c.acceptedAt instanceof Date);
  assert.strictEqual(smtp.messages.length, before + 1, "no verification email was sent");
});

/* ── Data rights ──────────────────────────────────────────────────────────── */

const userId = "64f000000000000000000001";
const token = jwt.sign({ id: userId }, process.env.JWT_SECRET);
const auth = { authorization: `Bearer ${token}` };
const state = { name: "Asha Rao", phone: undefined, deleted: false, deletes: [] };
const query = (value) => { const q = { select: () => q, lean: () => q, then: (ok, fail) => Promise.resolve(value()).then(ok, fail) }; return q; };
User.findById = () => query(() => state.deleted ? null : ({
  _id: userId, name: state.name, email: "asha@example.test", phone: state.phone, isVerified: true, isAdmin: false,
  createdAt: new Date("2026-09-01"), consent: { termsVersion: "2026-09-26" },
  comparePassword: async (p) => p === "correct horse battery",
  save: async function () { state.name = this.name; state.phone = this.phone; return this; },
}));
User.deleteOne = async (f) => { state.deletes.push(["User", String(f._id)]); state.deleted = true; return { deletedCount: 1 }; };
DocumentDraft.find = () => query(() => [{ _id: "d1", userId, title: "NDA draft" }]);
DocumentVersion.find = () => query(() => [{ _id: "v1", draftId: "d1", userId }, { _id: "v2", draftId: "d1", userId }]);
DocumentDraft.deleteMany = async (f) => { state.deletes.push(["DocumentDraft", String(f.userId)]); return { deletedCount: 1 }; };
DocumentVersion.deleteMany = async (f) => { state.deletes.push(["DocumentVersion", String(f.userId)]); return { deletedCount: 2 }; };

await check("a user can correct their name and phone", async () => {
  const r = await call("PATCH", "/auth/me", { name: "Asha R. Rao", phone: "9876543210" }, auth);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  assert.deepStrictEqual([r.body.user.name, r.body.user.phone], ["Asha R. Rao", "9876543210"]);
  assert.strictEqual((await call("PATCH", "/auth/me", { phone: "12345" }, auth)).status, 400);
  assert.strictEqual((await call("PATCH", "/auth/me", { name: "" }, auth)).status, 400);
  assert.strictEqual((await call("PATCH", "/auth/me", { name: "X" })).status, 401, "unauthenticated edit accepted");
});

await check("a user can download everything held about them, without secrets", async () => {
  const r = await call("GET", "/auth/me/export", undefined, auth);
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("content-disposition") || "", /attachment; filename="legalaid-data-/);
  assert.deepStrictEqual([r.body.account.email, r.body.documents.length, r.body.document_versions.length], ["asha@example.test", 1, 2]);
  const text = JSON.stringify(r.body);
  for (const secret of ["password", "verificationToken", "resetPasswordToken", "comparePassword"])
    assert.ok(!text.includes(secret), `the export contains ${secret}`);
});

await check("account deletion needs the password and removes versions, drafts and the account", async () => {
  const wrong = await call("DELETE", "/auth/me", { password: "nope" }, auth);
  assert.strictEqual(wrong.status, 400);
  assert.deepStrictEqual(state.deletes, [], "something was deleted on a wrong password");
  const ok = await call("DELETE", "/auth/me", { password: "correct horse battery" }, auth);
  assert.strictEqual(ok.status, 200, JSON.stringify(ok.body));
  assert.deepStrictEqual(state.deletes.map(([m]) => m).sort(), ["DocumentDraft", "DocumentVersion", "User"]);
  assert.ok(state.deletes.every(([, id]) => id === userId), "a delete was not scoped to this user");
  assert.match(ok.headers.get("set-cookie") || "", /legalaid_token=;/, "the session cookie was not cleared");
  assert.strictEqual((await call("GET", "/auth/me", undefined, auth)).status, 401, "the deleted account still authenticates");
});

await check("changing or deleting the account is on the brute-force budget, not the session budget", () => {
  const src = read("backend/index.js");
  assert.match(src, /req\.path === "\/me" && req\.method === "GET"/, "PATCH/DELETE /auth/me may have fallen back into the generous session limiter");
});

/* ── Contact ──────────────────────────────────────────────────────────────── */

const msg = { name: "Asha Rao", email: "asha@example.test", subject: "privacy", message: "Please delete my data." };

await check("the contact form refuses when no inbox is configured, rather than pretending", async () => {
  delete process.env.CONTACT_EMAIL;
  const r = await call("POST", "/contact", msg);
  assert.strictEqual(r.status, 503);
});

await check("the contact form delivers to CONTACT_EMAIL with reply-to set to the sender", async () => {
  process.env.CONTACT_EMAIL = "support@example.test";
  const before = smtp.messages.length;
  const r = await call("POST", "/contact", msg);
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const m = smtp.messages.at(-1);
  assert.strictEqual(smtp.messages.length, before + 1);
  assert.ok(m.rcpt.includes("<support@example.test>"), `delivered to ${m.rcpt}`);
  assert.match(m.data, /Reply-To: asha@example\.test/i);
  assert.match(m.data, /Please delete my data\./);
});

await check("the contact form validates input and drops bot submissions", async () => {
  const before = smtp.messages.length;
  assert.strictEqual((await call("POST", "/contact", { ...msg, email: "not-an-email" })).status, 400);
  assert.strictEqual((await call("POST", "/contact", { ...msg, message: "" })).status, 400);
  assert.strictEqual((await call("POST", "/contact", { ...msg, website: "http://spam" })).status, 200);
  assert.strictEqual(smtp.messages.length, before, "a rejected or honeypot message was sent");
});

/* ── Licences and fonts ───────────────────────────────────────────────────── */

await check("the open-source notices file is current and linked from the footer", () => {
  execFileSync(process.execPath, ["scripts/generateFrontendNotices.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
  const notices = read("frontend/public/third-party-notices.txt");
  for (const name of ["react ", "react-dom ", "axios ", "Lucide icons", "Feather icons"]) assert.ok(notices.includes(name), `notices lack ${name}`);
  assert.match(read("frontend/src/components/Footer.jsx"), /third-party-notices\.txt/);
});

await check("the project is proprietary, not accidentally ISC", () => {
  assert.match(read("LICENSE"), /All rights reserved/);
  for (const p of ["package.json", "backend/package.json", "frontend/package.json", "scraper/package.json", "IRE/package.json"])
    assert.strictEqual(JSON.parse(read(p)).license, "UNLICENSED", p);
});

await check("no page load reaches Google Fonts", () => {
  const hits = frontendFiles.filter((f) => /fonts\.(googleapis|gstatic)\.com/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
  assert.deepStrictEqual(hits, []);
});

server.close();
smtp.close();
console.log(`\n${checks} checks passed`);
process.exit(0);

/* A minimal SMTP sink: accepts one message per connection and records it. */
function startSmtpSink() {
  const messages = [];
  const srv = net.createServer((sock) => {
    let data = false, buf = "", cur = { rcpt: [], data: "" };
    sock.write("220 sink ESMTP\r\n");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) !== -1) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) {
          if (line === ".") { data = false; messages.push(cur); cur = { rcpt: [], data: "" }; sock.write("250 OK\r\n"); }
          else cur.data += `${line}\n`;
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") sock.write("250-sink\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd === "AUTH") sock.write("235 OK\r\n");
        else if (cmd === "MAIL") sock.write("250 OK\r\n");
        else if (cmd === "RCPT") { cur.rcpt.push(line.slice(line.indexOf(":") + 1).trim()); sock.write("250 OK\r\n"); }
        else if (cmd === "DATA") { data = true; sock.write("354 go\r\n"); }
        else if (cmd === "QUIT") { sock.write("221 bye\r\n"); sock.end(); }
        else sock.write("250 OK\r\n");
      }
    });
  });
  return new Promise((resolve) => srv.listen(0, "127.0.0.1", () => resolve({ port: srv.address().port, messages, close: () => srv.close() })));
}
