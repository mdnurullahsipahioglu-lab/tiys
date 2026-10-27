// Ses miksini WAV olarak yazar: node mix.js out.wav '{"noVo":true}'
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const out = process.argv[2], opts = JSON.parse(process.argv[3] || "{}");
  const b = await chromium.launch(); const p = await b.newPage();
  p.on("pageerror", e => console.log("ERR", e.message)); p.on("console", m => { if (m.type() === "error") console.log("ERR", m.text()); });
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "?export");
  const t = Date.now();
  const w = await p.evaluate(o => window.__tiys.mixWav(o), opts);
  fs.writeFileSync(out, Buffer.from(w, "base64"));
  console.log("ok", out, (Date.now() - t) + "ms");
  await b.close();
})();
