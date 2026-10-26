// Belirli zamanlardan kare alır: node snap.js out_dir t1 t2 ...
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
(async () => {
  const [out, ...ts] = process.argv.slice(2);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "?export");
  await p.evaluate(() => window.__tiys.fontsReady());
  for (const t of ts) {
    const d = await p.evaluate(t => { window.__tiys.draw(+t); return document.getElementById("c").toDataURL("image/jpeg", 0.85); }, t);
    fs.writeFileSync(path.join(out, `f_${(+t).toFixed(2).padStart(6, "0")}.jpg`), Buffer.from(d.split(",")[1], "base64"));
  }
  if (errs.length) console.log("ERR", errs.slice(0, 5));
  await b.close();
})();
