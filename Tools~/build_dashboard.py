"""Build the self-contained HTML opened by Unity or a browser."""
from pathlib import Path

tools = Path(__file__).resolve().parent
src = tools / "dashboard"
html = (src / "index.html").read_text()
css = (src / "dashboard.css").read_text()
html = html.replace('<link rel="stylesheet" href="dashboard.css">', f"<style>\n{css}</style>")
for name in ("oasis.js", "sessions.js", "dashboard.js"):
    js = (src / name).read_text()
    html = html.replace(f'<script src="{name}"></script>', f"<script>\n{js}</script>")
(tools.parent / "Editor/Dashboard/index.html").write_text(html)
