#!/usr/bin/env python3
"""tanitim/src -> tanitim/index.html (fontlar, seslendirme ve kod tek dosyaya gömülür)"""
import base64, json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
S = R / "src"
html = (S / "template.html").read_text(encoding="utf-8")
vo = {p.stem: base64.b64encode(p.read_bytes()).decode() for p in sorted((S / "vo").glob("*.mp3"))}
rep = {
    "/*__FONTS__*/": (S / "fonts.css").read_text(),
    "/*__VO__*/": "window.VO_DATA=" + json.dumps(vo) + ";",
    "/*__TIMELINE__*/": (S / "timeline.js").read_text(encoding="utf-8"),
    "/*__AUDIO__*/": (S / "audio.js").read_text(encoding="utf-8"),
    "/*__ANIM__*/": (S / "anim.js").read_text(encoding="utf-8"),
}
for k, v in rep.items():
    assert k in html, k
    html = html.replace(k, v)
(R / "index.html").write_text(html, encoding="utf-8")
print("index.html", round(len(html) / 1024), "KB")
