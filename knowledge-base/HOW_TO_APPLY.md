# KB Update — How to Apply

## One command (Mac/Linux)
```bash
cp -r KB_updated_final/* /path/to/LegalAId/knowledge-base/
```

## One command (Windows PowerShell)
```powershell
Copy-Item -Recurse -Force "$HOME\OneDrive\Desktop\KB_updated_final\*" "$HOME\OneDrive\Desktop\LegalAId\knowledge-base\"
```

## What changed
- clause_library/ → 49 empty stubs now filled with production legal text
- constraints/    → 9 domain constraint files (was 1)
- blueprints/     → all 10 blueprints updated with correct clause IDs

## What is NOT touched
- acts/     (804 IndiaCode acts — not in this zip)
- sections/ (789 section folders — not in this zip)

## Verify
```bash
ls knowledge-base/constraints/
# Should show 9 files
```
