// MP4 dışa aktarım: node export.js çıktı.mp4 [fps]
// Kareleri tarayıcıda çizer, ffmpeg'e borular; sesi aynı motordan üretip -14 LUFS'a ayarlar.
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs"), path = require("path"), os = require("os");
(async () => {
  const out = path.resolve(process.argv[2] || "tiys-tanitim.mp4"), fps = +(process.argv[3] || 30);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tiys-")), wav = path.join(tmp, "mix.wav"), vid = path.join(tmp, "video.mp4");
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on("pageerror", e => console.log("ERR", e.message));
  await p.goto("file://" + path.resolve(__dirname, "../index.html") + "?export");
  await p.evaluate(() => window.__tiys.fontsReady());
  fs.writeFileSync(wav, Buffer.from(await p.evaluate(() => window.__tiys.mixWav()), "base64"));
  const dur = await p.evaluate(() => TL.DUR), n = Math.round(dur * fps);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-tune", "animation", vid], { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < n; i++) {
    const d = await p.evaluate(t => { window.__tiys.draw(t); return document.getElementById("c").toDataURL("image/jpeg", 0.96); }, i / fps);
    if (!ff.stdin.write(Buffer.from(d.slice(d.indexOf(",") + 1), "base64"))) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`kare ${i}/${n}`);
  }
  ff.stdin.end(); await new Promise(r => ff.on("close", r)); await b.close();
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", vid, "-i", wav, "-af", "loudnorm=I=-14:TP=-1:LRA=11", "-ar", "48000", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out]);
  fs.rmSync(tmp, { recursive: true });
  console.log("hazır:", out);
})();
