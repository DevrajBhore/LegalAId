/**
 * loadEnv.js — side-effect module that loads backend/.env exactly once,
 * resolved relative to THIS file rather than the process working directory.
 *
 * Import it (`import "./loadEnv.js";`) as the first import of any module that
 * reads process.env at import time. Do not call dotenv.config() in a module
 * body instead: ESM evaluates every static import before any module-body
 * statement, so a `dotenv.config()` written at the top of index.js still runs
 * *after* everything index.js imports has already executed. That ordering is
 * what previously let a cwd-relative `.env` from the repo root shadow
 * backend/.env — dotenv never overwrites an already-set variable, so the
 * path-resolved load became a no-op and injected zero variables.
 *
 * Because module evaluation is cached, importing this from several modules
 * still loads the file only once, at the earliest point any of them is reached.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env"),
});
