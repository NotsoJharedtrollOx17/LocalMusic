"""Validate tracked Markdown links/encoding without fetching external sites."""
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
files = [ROOT / "README.md", ROOT / "AGENTS.md", *sorted((ROOT / "docs").rglob("*.md"))]
errors = []
for path in files:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"{path.relative_to(ROOT)}: invalid UTF-8")
        continue
    if "\ufffd" in text:
        errors.append(f"{path.relative_to(ROOT)}: damaged replacement character")
    for raw in re.findall(r"\]\(([^)]+)\)", text):
        target = raw.strip().strip("<>")
        if not target or urlsplit(target).scheme or target.startswith("#"):
            continue
        target = unquote(target.split("#", 1)[0])
        if not (path.parent / target).exists():
            errors.append(f"{path.relative_to(ROOT)}: missing link {target}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"Validated UTF-8 and local links in {len(files)} Markdown files.")
