# Applying this change set to D:\dev\LegalAId

`legalaid-phase-b-c-d.tar.gz` holds 112 files, rooted at the repo root. Every
path inside the archive is relative to `D:\dev\LegalAId`, so extracting over the
repo puts each file where it belongs.

From PowerShell, in the repo root:

    cd D:\dev\LegalAId
    tar -xzf <path-to>\legalaid-phase-b-c-d.tar.gz

Then:

    npm test

Expected: green, and `Clause baseline: no drift across 40 document types.`

## What it contains

Phase B (canonical fact resolution), Phase C (dependency/applicability
integrity), and Phase D so far (POSH_POLICY and TERMS_OF_SERVICE certified to
FALSIFICATION_PASSED).

- 14 engine/config files under `backend/`, `IRE/`
- 4 requirement matrices, 1 proposition file, 1 semantic-facts file
- 48 blueprints (only the floor-clause gates and the loan variant slot changed;
  the rest are byte-identical to what was cloned)
- 3 clause records
- 15 tests, 2 frozen baselines
- 12 probe scripts, 1 shared library
- 14 audit records under `docs/audit/`, plus `docs/INVARIANTS.md`

## What it does NOT contain

No `.env`, no credentials, no secrets of any kind — verified before packing.

## One caution

These files were cloned from the repo at the start of this work. If anything in
the repo changed on your side since then, extracting will overwrite it. The
blueprints are the largest group and mostly unmodified, so if you want the
narrowest possible diff, extract and then review `git status` / `git diff`
before committing.
