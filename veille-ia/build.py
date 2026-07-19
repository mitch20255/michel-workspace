#!/usr/bin/env python3
"""Injecte posts.json dans dashboard.html (entre les marqueurs __DATA__ / __END__).
Le dashboard doit etre autonome : le CSP des Artifacts bloque tout fetch externe.
Usage: python3 build.py"""
import json, re, pathlib

here = pathlib.Path(__file__).parent
data = json.loads((here / "posts.json").read_text(encoding="utf-8"))
html = (here / "dashboard.html").read_text(encoding="utf-8")

payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
new = re.sub(
    r"/\*__DATA__\*/.*?/\*__END__\*/",
    "/*__DATA__*/" + payload.replace("\\", "\\\\") + "/*__END__*/",
    html, count=1, flags=re.DOTALL,
)
(here / "dashboard.html").write_text(new, encoding="utf-8")
sessions = data.get("sessions", [])
total = sum(len(s.get("posts", [])) for s in sessions)
print(f"OK — {len(sessions)} sessions / {total} posts injectes dans dashboard.html")
for s in sessions:
    print(f"   {s.get('icon','')} {s['name']}: {len(s.get('posts', []))} posts")
