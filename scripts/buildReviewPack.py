#!/usr/bin/env python3
"""
Builds the advocate review pack from reviewpack.json.

One row per clause, ordered so that the clauses reaching the most documents come
first. The advocate fills three columns; importReviewSignoff.mjs reads them back
into the clause library. Nothing else in the sheet is read on import.
"""
import json, sys
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FONT = "Arial"
HEAD_FILL = PatternFill("solid", fgColor="1F3864")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
BAND_FILL = PatternFill("solid", fgColor="F2F2F2")
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

rows = json.load(open("reviewpack.json", encoding="utf-8"))
used = [r for r in rows if r["doc_types_reached"] > 0]
unused = [r for r in rows if r["doc_types_reached"] == 0]

wb = Workbook()

# ── Instructions ────────────────────────────────────────────────────────────
ws = wb.active
ws.title = "How to use"
guide = [
    ("LegalAId — Advocate Review Pack", 16, True),
    ("", 11, False),
    ("Three columns are yours. Everything else is context.", 11, True),
    ("", 11, False),
    ("DECISION      Approve / Amend / Reject / Needs discussion", 11, False),
    ("REVISED TEXT  Only if you chose Amend. Paste the clause as it should read.", 11, False),
    ("              Use a blank line between numbered sub-clauses; they are", 11, False),
    ("              renumbered automatically (5.1, 5.2, 5.2.1).", 11, False),
    ("NOTE          Optional. Why, or what the engineer must change elsewhere.", 11, False),
    ("", 11, False),
    ("Sign once, at the top of the 'Reviewed clauses' tab, in the yellow cells.", 11, True),
    ("Your name goes into every clause you approved, as the reviewer of record.", 11, False),
    ("", 11, False),
    ("Order of work", 12, True),
    ("Rows are sorted by how much of the product each clause touches.", 11, False),
    (f"  The first 20 rows cover 61% of all clause usage across the 22 document types.", 11, False),
    (f"  The first 50 rows cover 80%.", 11, False),
    ("Stopping after 20 or 50 is a legitimate first pass — coverage is reported", 11, False),
    ("per document, so a partly-reviewed library is honest rather than broken.", 11, False),
    ("", 11, False),
    ("What 'reach' means", 12, True),
    ("How many of the 22 document types actually render this clause. A clause", 11, False),
    ("with reach 22 appears in every document the product can produce.", 11, False),
    ("", 11, False),
    (f"The 'Unused clauses' tab lists {len(unused)} clauses that reach no document at all.", 11, True),
    ("They need no review. They need a decision on whether to keep them.", 11, False),
]
for i, (text, size, bold) in enumerate(guide, start=1):
    c = ws.cell(row=i, column=1, value=text)
    c.font = Font(name=FONT, size=size, bold=bold)
ws.column_dimensions["A"].width = 92

# ── Review sheet ────────────────────────────────────────────────────────────
rv = wb.create_sheet("Reviewed clauses")
rv["A1"] = "Reviewer name (goes into every approved clause)"
rv["A1"].font = Font(name=FONT, size=11, bold=True)
rv["C1"].fill = INPUT_FILL; rv["C1"].border = BORDER
rv["A2"] = "Review date (YYYY-MM-DD)"
rv["A2"].font = Font(name=FONT, size=11, bold=True)
rv["C2"].fill = INPUT_FILL; rv["C2"].border = BORDER
rv["A3"] = "Bar Council enrolment number (optional, recorded with the sign-off)"
rv["A3"].font = Font(name=FONT, size=11, bold=True)
rv["C3"].fill = INPUT_FILL; rv["C3"].border = BORDER

HEADERS = ["#", "Clause ID", "Title", "Reach", "Risk", "Mandatory", "Words",
           "Statutory basis", "Document types", "Clause text as generated",
           "DECISION", "REVISED TEXT (only if amending)", "NOTE"]
HEAD_ROW = 5
for col, name in enumerate(HEADERS, start=1):
    c = rv.cell(row=HEAD_ROW, column=col, value=name)
    c.font = Font(name=FONT, size=10, bold=True, color="FFFFFF")
    c.fill = HEAD_FILL
    c.alignment = Alignment(vertical="center", wrap_text=True)
    c.border = BORDER
rv.freeze_panes = "C6"

for idx, r in enumerate(used, start=1):
    row = HEAD_ROW + idx
    values = [idx, r["clause_id"], r["title"], r["doc_types_reached"],
              r["risk_level"], "Yes" if r["mandatory"] else "", r["rendered_words"],
              r["citations"], r["doc_types"], r["text"], "", "", ""]
    for col, v in enumerate(values, start=1):
        c = rv.cell(row=row, column=col, value=v)
        c.font = Font(name=FONT, size=10)
        c.alignment = Alignment(vertical="top", wrap_text=col in (3, 8, 9, 10, 12, 13))
        c.border = BORDER
        if col in (11, 12, 13):
            c.fill = INPUT_FILL
        elif idx % 2 == 0:
            c.fill = BAND_FILL

dv = DataValidation(type="list", formula1='"Approve,Amend,Reject,Needs discussion"', allow_blank=True)
rv.add_data_validation(dv)
dv.add(f"K{HEAD_ROW+1}:K{HEAD_ROW+len(used)}")

WIDTHS = {1:5, 2:34, 3:28, 4:7, 5:9, 6:11, 7:8, 8:34, 9:34, 10:80, 11:18, 12:60, 13:34}
for col, w in WIDTHS.items():
    rv.column_dimensions[get_column_letter(col)].width = w

# ── Unused clauses ──────────────────────────────────────────────────────────
uw = wb.create_sheet("Unused clauses")
uw["A1"] = f"{len(unused)} clauses reach none of the 22 document types. Keep, or delete?"
uw["A1"].font = Font(name=FONT, size=12, bold=True)
UH = ["Clause ID", "Title", "Domain", "Risk", "Statutory basis", "KEEP / DELETE", "NOTE"]
for col, name in enumerate(UH, start=1):
    c = uw.cell(row=3, column=col, value=name)
    c.font = Font(name=FONT, size=10, bold=True, color="FFFFFF")
    c.fill = HEAD_FILL; c.border = BORDER
for i, r in enumerate(unused, start=1):
    for col, v in enumerate([r["clause_id"], r["title"], r["domain"], r["risk_level"], r["citations"], "", ""], start=1):
        c = uw.cell(row=3 + i, column=col, value=v)
        c.font = Font(name=FONT, size=10); c.border = BORDER
        if col in (6, 7): c.fill = INPUT_FILL
for col, w in {1:34, 2:30, 3:14, 4:9, 5:40, 6:16, 7:34}.items():
    uw.column_dimensions[get_column_letter(col)].width = w

out = sys.argv[1] if len(sys.argv) > 1 else "LegalAId_Advocate_Review_Pack.xlsx"
wb.save(out)
print(f"wrote {out}: {len(used)} clauses to review, {len(unused)} unused")
