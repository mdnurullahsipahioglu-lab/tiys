/* TİYS tanıtım — el çizimi kolaj animasyonu. drawFrame(ctx, t) saf fonksiyon: aynı t her zaman aynı kare. */
(function (g) {
  "use strict";
  const W = 1920, H = 1080;
  const P = {
    cream: "#f3ead3", paper: "#fffaf0", ink: "#2a221d", ink2: "#4a3d33",
    kraft: "#c8a273", kraftD: "#a8834f",
    green: "#164c3f", greenD: "#0e3a30", leaf: "#4f8a3a", leaf2: "#77a94a", lime: "#b9d36a", bush: "#3d7432",
    hazel: "#a2602f", hazelD: "#6d3b19", hazelL: "#c98448", base: "#e2c194",
    red: "#df4f3a", orange: "#f19a36", yellow: "#f5c842", sky: "#bfe0ea", blue: "#3d78a8", pink: "#f0a9a0",
    butter: "#f6e2a0", sage: "#d3e3bd", peach: "#f5c7b1", lav: "#d8cff0", bone: "#f1ece2"
  };

  // ---------------- yardımcılar ----------------
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const eOut = x => 1 - Math.pow(1 - x, 3);
  const eIn = x => x * x * x;
  const eIO = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const eBack = x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const eElastic = x => x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  function hr(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function RNG(s) { let t = s >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  let T = 0, BOIL = 0, ctx = null;
  const jit = (id, a) => (hr(id * 17.31 + BOIL * 3.77) - 0.5) * 2 * a;   // stop-motion titreşimi (12 fps)

  // ---------------- dokular ----------------
  const TEX = {};
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function buildTextures() {
    // kâğıt lifi dokusu (multiply ile bindirilir)
    const c = mkCanvas(512, 512), x = c.getContext("2d"), r = RNG(7);
    x.fillStyle = "#fff"; x.fillRect(0, 0, 512, 512);
    const id = x.getImageData(0, 0, 512, 512), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const v = 255 - r() * 38 * r(); d[i] = v; d[i + 1] = v - 2; d[i + 2] = v - 6; }
    x.putImageData(id, 0, 0);
    for (let i = 0; i < 900; i++) {
      x.strokeStyle = `rgba(${r() < 0.5 ? "120,95,60" : "255,255,255"},${0.05 + r() * 0.12})`; x.lineWidth = 0.6 + r();
      const px = r() * 512, py = r() * 512, a = r() * 6.28, l = 4 + r() * 22;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 0.5) * l / 2, py + Math.sin(a + 0.5) * l / 2, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    for (let i = 0; i < 40; i++) { const gr = x.createRadialGradient(r() * 512, r() * 512, 0, r() * 512, r() * 512, 30 + r() * 90); gr.addColorStop(0, "rgba(150,120,80,0.05)"); gr.addColorStop(1, "rgba(150,120,80,0)"); x.fillStyle = gr; x.fillRect(0, 0, 512, 512); }
    TEX.fiber = c;
    // kurşun kalem greni
    const c2 = mkCanvas(512, 512), x2 = c2.getContext("2d"), r2 = RNG(9);
    x2.fillStyle = "#fff";
    for (let i = 0; i < 2600; i++) { x2.globalAlpha = 0.25 + r2() * 0.75; x2.beginPath(); x2.arc(r2() * 512, r2() * 512, r2() < 0.92 ? 0.6 + r2() * 1.6 : 2 + r2() * 5, 0, 7); x2.fill(); }
    for (let i = 0; i < 40; i++) { x2.globalAlpha = 0.5; x2.lineWidth = 1 + r2() * 2; x2.strokeStyle = "#fff"; const px = r2() * 512, py = r2() * 512; x2.beginPath(); x2.moveTo(px, py); x2.lineTo(px + (r2() - 0.5) * 80, py + (r2() - 0.5) * 12); x2.stroke(); }
    TEX.grain = c2;
    TEX.fiberPat = null;
    // arka plan kâğıtları
    TEX.bg = {};
  }
  function bgPaper(color, key) {
    if (TEX.bg[key]) return TEX.bg[key];
    const c = mkCanvas(W, H), x = c.getContext("2d"), r = RNG(key.length * 31 + 5);
    x.fillStyle = color; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const px = r() * W, py = r() * H, rad = 120 + r() * 420, gr = x.createRadialGradient(px, py, 0, px, py, rad); const dark = r() < 0.45; gr.addColorStop(0, dark ? "rgba(90,60,30,0.05)" : "rgba(255,255,240,0.14)"); gr.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.3;
    for (let yy = 0; yy < H; yy += 512) for (let xx = 0; xx < W; xx += 512) x.drawImage(TEX.fiber, xx, yy);
    x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
    const v = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(40,20,5,0.2)");
    x.fillStyle = v; x.fillRect(0, 0, W, H);
    // ortalama rengi palet rengine geri çek (dokular kâğıdı griye boğmasın)
    const im = x.getImageData(0, 0, W, H), d = im.data, tgt = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
    const m = [0, 0, 0]; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; n++; }
    const k = m.map((v, i) => tgt[i] / (v / n) * 1.02);
    for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * k[0]); d[i + 1] = Math.min(255, d[i + 1] * k[1]); d[i + 2] = Math.min(255, d[i + 2] * k[2]); }
    x.putImageData(im, 0, 0);
    TEX.bg[key] = c; return c;
  }

  // ---------------- şekil üreticileri (önbellekli) ----------------
  const SH = new Map();
  function cached(key, fn) { if (!SH.has(key)) SH.set(key, fn()); return SH.get(key); }
  // yırtık kenarlı dikdörtgen: merkezde, w x h
  function tornRect(w, h, seed, rough = 5, step = 16) {
    return cached(`tr${w}|${h}|${seed}|${rough}`, () => {
      const r = RNG(seed), pts = [];
      const edge = (x0, y0, x1, y1, nx, ny) => {
        const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.round(L / step));
        let o = 0;
        for (let i = 0; i < n; i++) { const t = i / n; o = o * 0.55 + (r() - 0.5) * rough * 1.6; pts.push([lerp(x0, x1, t) + nx * o + (r() - 0.5) * 2, lerp(y0, y1, t) + ny * o]); }
      };
      const a = w / 2, b = h / 2;
      edge(-a, -b, a, -b, 0, -1); edge(a, -b, a, b, 1, 0); edge(a, b, -a, b, 0, 1); edge(-a, b, -a, -b, -1, 0);
      return pts;
    });
  }
  function tornCircle(rad, seed, rough = 4, ry) {
    return cached(`tc${rad}|${seed}|${rough}|${ry}`, () => {
      const r = RNG(seed), n = Math.max(18, Math.round(rad / 5)), pts = []; let o = 0; ry = ry || rad;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; o = o * 0.5 + (r() - 0.5) * rough * 1.5; pts.push([Math.cos(a) * (rad + o), Math.sin(a) * (ry + o)]); }
      return pts;
    });
  }
  function blobShape(rad, seed, lumps = 5, amt = 0.18) {
    return cached(`bl${rad}|${seed}|${lumps}|${amt}`, () => {
      const r = RNG(seed), n = 48, ph = r() * 6, pts = [];
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = 1 + amt * Math.sin(a * lumps + ph) + (r() - 0.5) * 0.05; pts.push([Math.cos(a) * rad * k, Math.sin(a) * rad * k]); }
      return pts;
    });
  }
  function polyPath(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }

  // Kesilmiş kâğıt çiz: beyaz yırtık kenar + gölge + doku
  function cut(pts, o) {
    const x = o.x || 0, y = o.y || 0, s = o.s == null ? 1 : o.s, rot = o.rot || 0, lift = o.lift == null ? 1 : o.lift;
    if (s <= 0.001 || o.alpha === 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * (o.sx || 1), s * (o.sy || 1));
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    polyPath(pts);
    if (lift > 0) { ctx.shadowColor = "rgba(45,25,8,0.33)"; ctx.shadowBlur = 10 * lift; ctx.shadowOffsetX = 4 * lift; ctx.shadowOffsetY = 7 * lift; }
    if (o.edge !== false) { ctx.lineJoin = "round"; ctx.lineWidth = o.edgeW || 7; ctx.strokeStyle = o.edgeC || "#fbf6ea"; ctx.stroke(); }
    ctx.fillStyle = o.fill || P.paper; ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save(); ctx.clip();
    if (o.inner) o.inner();
    if (o.tex !== 0) { ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha *= (o.tex || 0.85); ctx.drawImage(TEX.fiber, -256 + (o.tx || 0) % 200, -256 + (o.ty || 0) % 200, 1024, 1024); }
    ctx.restore();
    if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = o.olw || 2.5; ctx.globalAlpha *= 0.8; wobblyPoly(pts, o.oid || 1); }
    ctx.restore();
  }
  function wobblyPoly(pts, id) { ctx.beginPath(); pts.forEach((p, i) => { const px = p[0] + jit(id + i, 1.4), py = p[1] + jit(id + i + 99, 1.4); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); ctx.stroke(); }

  // Kurşun kalem çizgisi: noktalar boyunca kısmi (prog) çizim, iki geçiş
  function pencil(pts, prog, o = {}) {
    if (prog <= 0 || pts.length < 2) return;
    const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const lim = L[L.length - 1] * clamp(prog);
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = o.c || P.ink;
    const passes = o.passes || 2, id = o.id || 1, a = o.j == null ? 1.6 : o.j;
    for (let p = 0; p < passes; p++) {
      ctx.lineWidth = (o.w || 4) * (p ? 0.55 : 1); ctx.globalAlpha = (o.alpha || 1) * (p ? 0.55 : 0.92);
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        let [px, py] = pts[i];
        if (L[i] > lim) { const k = (lim - L[i - 1]) / (L[i] - L[i - 1] || 1); px = lerp(pts[i - 1][0], px, k); py = lerp(pts[i - 1][1], py, k); }
        px += jit(id * 7 + i + p * 31, a); py += jit(id * 11 + i + p * 37, a);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        if (L[i] > lim) break;
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function ellipsePts(cx, cy, rx, ry, turns = 1.08, start = -1.9, n = 48) { const a = []; for (let i = 0; i <= n; i++) { const t = start + i / n * Math.PI * 2 * turns; const k = 1 + 0.04 * Math.sin(i * 0.7); a.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); } return a; }
  function linePts(x0, y0, x1, y1, n = 10, bow = 0) { const a = []; for (let i = 0; i <= n; i++) { const t = i / n; a.push([lerp(x0, x1, t) - (y1 - y0) * bow * Math.sin(Math.PI * t), lerp(y0, y1, t) + (x1 - x0) * bow * Math.sin(Math.PI * t)]); } return a; }

  // El yazısı: harf harf beliren, her harf hafif titreyen metin
  const FONTS = { hand: "'Caveat', cursive", handB: "'Caveat Brush', 'Caveat', cursive", print: "'Patrick Hand', 'Caveat', cursive", slab: "'Alfa Slab One', serif", rubik: "'Rubik', sans-serif" };
  function text(str, x, y, o = {}) {
    const size = o.size || 80, font = `${o.weight || 700} ${size}px ${o.font || FONTS.hand}`;
    ctx.save(); ctx.font = font; ctx.textBaseline = "alphabetic";
    const chars = [...str], ws = chars.map(c => ctx.measureText(c).width), tw = ws.reduce((a, b) => a + b, 0) * (o.track || 1);
    let cx = o.align === "center" ? x - tw / 2 : o.align === "right" ? x - tw : x;
    const start = o.start == null ? -9 : o.start, dur = o.dur == null ? 0.8 : o.dur, n = chars.length;
    for (let i = 0; i < n; i++) {
      const ta = start + (i / Math.max(1, n)) * dur, k = seg(T, ta, ta + 0.16);
      if (k > 0 && chars[i] !== " ") {
        const sc = o.pop === false ? 1 : eBack(k);
        ctx.save(); ctx.translate(cx + ws[i] / 2, y + jit(i * 3 + (o.id || 0), o.jy == null ? 1.6 : o.jy));
        ctx.rotate(jit(i * 5 + 1 + (o.id || 0), o.jr == null ? 0.035 : o.jr)); ctx.scale(sc, sc);
        ctx.globalAlpha *= clamp(k * 3);
        if (o.stroke) { ctx.lineJoin = "round"; ctx.lineWidth = o.strokeW || 10; ctx.strokeStyle = o.stroke; ctx.strokeText(chars[i], -ws[i] / 2, 0); }
        ctx.fillStyle = o.color || P.ink; ctx.fillText(chars[i], -ws[i] / 2, 0);
        ctx.restore();
      }
      cx += ws[i] * (o.track || 1);
    }
    ctx.restore();
    return tw;
  }
  function measure(str, size, font, weight = 700) { ctx.save(); ctx.font = `${weight} ${size}px ${font || FONTS.hand}`; const w = [...str].reduce((a, c) => a + ctx.measureText(c).width, 0); ctx.restore(); return w; }

  // Bant parçası
  function tape(x, y, w, rot, alpha = 1, seed = 1) {
    const pts = cached(`tape${w}|${seed}`, () => { const r = RNG(seed), h = 46, a = w / 2, b = h / 2, p = []; for (let i = 0; i <= 6; i++) p.push([-a + (i / 6) * w, -b + (r() - 0.5) * 2]); for (let i = 0; i <= 5; i++) p.push([a + (i % 2 ? 5 : -2) + (r() - 0.5) * 3, -b + (i / 5) * h]); for (let i = 0; i <= 6; i++) p.push([a - (i / 6) * w, b + (r() - 0.5) * 2]); for (let i = 0; i <= 5; i++) p.push([-a + (i % 2 ? -5 : 2) + (r() - 0.5) * 3, b - (i / 5) * h]); return p; });
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= alpha;
    polyPath(pts); ctx.fillStyle = "rgba(246,236,200,0.72)"; ctx.shadowColor = "rgba(0,0,0,0.12)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; ctx.fill(); ctx.shadowColor = "transparent";
    ctx.clip(); ctx.globalAlpha *= 0.5; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(TEX.fiber, -200, -100, 600, 300);
    ctx.restore();
  }

  // ---------------- karakter: Fındık ----------------
  function hazelBody() { ctx.beginPath(); ctx.moveTo(0, -118); ctx.bezierCurveTo(58, -112, 104, -42, 100, 18); ctx.bezierCurveTo(97, 74, 56, 104, 0, 104); ctx.bezierCurveTo(-56, 104, -97, 74, -100, 18); ctx.bezierCurveTo(-104, -42, -58, -112, 0, -118); ctx.closePath(); }
  // o: {x,y,s,rot,sq(squash), look:[x,y], blink, mouth:'smile'|'o'|'worry'|'grin'|'flat', armL/armR açıları, wave, legs, dizzy, glasses}
  function mascot(o) {
    const s = o.s || 1; if (s <= 0.01) return;
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0);
    const sq = o.sq || 0; ctx.scale(s * (1 + sq * 0.5), s * (1 - sq));
    // bacaklar
    if (o.legs !== false) {
      const lk = o.legKick || 0;
      pencil([[-34, 96], [-40 - lk * 10, 140], [-56 - lk * 14, 146]], 1, { w: 7, id: 501, j: 1.2 });
      pencil([[34, 96], [40 + lk * 10, 140], [58 + lk * 14, 146]], 1, { w: 7, id: 502, j: 1.2 });
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(-60 - lk * 14, 148, 16, 8, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(62 + lk * 14, 148, 16, 8, 0, 0, 7); ctx.fill();
    }
    // kollar (arkadan)
    const arm = (side, ang, wave) => {
      const sx = side * 92, sy = 10, L = 74, a = ang + (wave || 0);
      const ex = sx + Math.cos(a) * L * side, ey = sy + Math.sin(a) * L;
      pencil([[sx, sy], [lerp(sx, ex, 0.5) + side * 6, lerp(sy, ey, 0.5) - 6], [ex, ey]], 1, { w: 7, id: 520 + side, j: 1.2 });
      ctx.fillStyle = P.paper; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ex, ey, 13, 0, 7); ctx.fill(); ctx.stroke();
    };
    arm(-1, o.armL == null ? 0.9 : o.armL, o.waveL); arm(1, o.armR == null ? 0.9 : o.armR, o.waveR);
    // gövde
    ctx.save(); hazelBody();
    ctx.shadowColor = "rgba(45,25,8,0.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 9;
    ctx.lineWidth = 8; ctx.strokeStyle = "#fbf6ea"; ctx.stroke(); ctx.fillStyle = P.hazel; ctx.fill(); ctx.shadowColor = "transparent";
    ctx.clip();
    const gr = ctx.createLinearGradient(-90, -100, 80, 100); gr.addColorStop(0, "rgba(255,210,150,0.45)"); gr.addColorStop(0.5, "rgba(255,210,150,0)"); gr.addColorStop(1, "rgba(60,25,5,0.35)");
    ctx.fillStyle = gr; ctx.fillRect(-120, -130, 240, 250);
    // açık renkli taban (fındığın "göbeği")
    ctx.fillStyle = P.base; ctx.beginPath(); ctx.ellipse(0, 104, 88, 40, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(140,90,40,0.45)"; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(-70 + hr(i) * 140, 78 + hr(i + 9) * 22, 2.2, 0, 7); ctx.fill(); }
    // damarlar
    ctx.strokeStyle = "rgba(70,35,10,0.5)"; ctx.lineWidth = 3;
    [[-48, -70, -62, 40], [-12, -100, -18, 50], [30, -90, 50, 40]].forEach(([x0, y0, x1, y1], i) => { ctx.beginPath(); ctx.moveTo(x0 + jit(600 + i, 1), y0); ctx.quadraticCurveTo((x0 + x1) / 2 - 12, (y0 + y1) / 2, x1, y1); ctx.stroke(); });
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.7; ctx.drawImage(TEX.fiber, -150, -150, 400, 400);
    ctx.restore();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3.5; ctx.save(); ctx.translate(jit(610, 1), jit(611, 1)); hazelBody(); ctx.globalAlpha = 0.65; ctx.stroke(); ctx.restore();
    // yaprak şapka (zuruf)
    const leaf = (rx, ry, rot, c, sd) => cut(blobShape(44, sd, 7, 0.22), { x: rx, y: ry, rot, sx: 1.25, sy: 0.62, fill: c, lift: 0.5, edgeW: 5, tex: 0.6, outline: "rgba(30,60,20,0.6)", olw: 2, oid: sd });
    leaf(-40, -108, -0.45, P.leaf2, 31); leaf(38, -110, 0.5, P.leaf, 32); leaf(0, -126, 0.05, P.lime, 33);
    pencil([[0, -150], [4, -172], [14, -184]], 1, { w: 5, c: "#3b5b23", id: 640 });
    // yüz
    const lx = (o.look ? o.look[0] : 0) * 7, ly = (o.look ? o.look[1] : 0) * 6;
    const blink = o.blink ? 0.12 : 1;
    [[-34, -14], [34, -14]].forEach(([ex, ey], i) => {
      ctx.fillStyle = "#fffdf6"; ctx.strokeStyle = P.ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(ex, ey, 22, 27 * blink, 0, 0, 7); ctx.fill(); ctx.stroke();
      if (blink > 0.5) {
        if (o.dizzy) { ctx.lineWidth = 3.5; ctx.beginPath(); for (let k = 0; k < 30; k++) { const a = k * 0.55 + T * 9 * (i ? 1 : -1), rr = k * 0.55; k ? ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr) : ctx.moveTo(ex, ey); } ctx.stroke(); }
        else { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(ex + lx, ey + 4 + ly, 10, 12, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(ex + lx - 4, ey + ly - 1, 3.5, 0, 7); ctx.fill(); }
      }
    });
    if (o.glasses) { ctx.fillStyle = "#1d1d1d"; ctx.beginPath(); ctx.ellipse(-34, -10, 28, 20, 0, 0, 7); ctx.ellipse(34, -10, 28, 20, 0, 0, 7); ctx.fill(); ctx.strokeStyle = "#1d1d1d"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(8, -14); ctx.stroke(); ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(-50, -22, 12, 5); ctx.fillRect(18, -22, 12, 5); }
    // yanaklar
    ctx.fillStyle = "rgba(240,120,110,0.55)"; ctx.beginPath(); ctx.ellipse(-62, 22, 15, 9, 0, 0, 7); ctx.ellipse(62, 22, 15, 9, 0, 0, 7); ctx.fill();
    // ağız
    ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineCap = "round";
    const m = o.mouth || "smile";
    if (m === "smile") { ctx.beginPath(); ctx.arc(0, 22, 24, 0.2, Math.PI - 0.2); ctx.stroke(); }
    else if (m === "grin") { ctx.fillStyle = "#5a1d12"; ctx.beginPath(); ctx.moveTo(-28, 26); ctx.quadraticCurveTo(0, 74, 28, 26); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#f07f74"; ctx.beginPath(); ctx.ellipse(0, 46, 11, 7, 0, 0, 7); ctx.fill(); }
    else if (m === "o") { ctx.fillStyle = "#5a1d12"; ctx.beginPath(); ctx.ellipse(0, 40, 12, 15, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    else if (m === "worry") { ctx.beginPath(); ctx.moveTo(-22, 44); ctx.quadraticCurveTo(-8, 30, 0, 40); ctx.quadraticCurveTo(10, 50, 22, 36); ctx.stroke(); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-52, -52); ctx.lineTo(-20, -44); ctx.moveTo(52, -52); ctx.lineTo(20, -44); ctx.stroke(); }
    else if (m === "flat") { ctx.beginPath(); ctx.moveTo(-18, 38); ctx.lineTo(18, 36); ctx.stroke(); }
    ctx.restore();
  }

  // ---------------- dekor parçaları ----------------
  function hills(prog, k0 = 0) {
    const layers = [
      { c: P.lime, y: 640, amp: 60, f: 1.6, ph: 0.4, sd: 41 },
      { c: P.leaf2, y: 760, amp: 50, f: 2.1, ph: 2.0, sd: 42 },
      { c: P.leaf, y: 880, amp: 40, f: 1.3, ph: 4.1, sd: 43 }
    ];
    layers.forEach((L, i) => {
      const p = eBack(seg(prog, i * 0.12, i * 0.12 + 0.55));
      if (p <= 0) return;
      const pts = cached("hill" + i, () => { const r = RNG(L.sd), a = []; let o = 0; for (let x = -60; x <= W + 60; x += 18) { o = o * 0.6 + (r() - 0.5) * 7; a.push([x, L.y + Math.sin(x / W * Math.PI * L.f + L.ph) * L.amp + o - L.y]); } a.push([W + 60, H + 80 - L.y + 200], [-60, H + 80 - L.y + 200]); return a; });
      cut(pts, { x: 0, y: L.y + (1 - p) * 520 + jit(700 + i, 1), fill: L.c, lift: 1.2, edgeW: 8, tx: i * 90, ty: i * 50 });
    });
  }
  function bush(x, y, s, sd, nuts = true) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y + jit(sd, 1)); ctx.scale(s, s);
    [[-60, 10, 62, P.bush], [55, 15, 58, P.bush], [0, -30, 72, P.leaf], [-20, 30, 55, P.leaf2]].forEach(([bx, by, br, c], i) => cut(blobShape(br, sd * 10 + i, 6, 0.12), { x: bx, y: by, fill: c, lift: 0.8, edgeW: 6, tex: 0.7, tx: sd * 30 }));
    if (nuts) [[-30, 0], [26, -12], [4, 26], [50, 30], [-56, 34]].forEach(([nx, ny], i) => { ctx.fillStyle = P.hazel; ctx.strokeStyle = "#fbf6ea"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(nx, ny, 11, 13, 0.3, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.lime; ctx.beginPath(); ctx.ellipse(nx, ny - 12, 10, 5, 0, 0, 7); ctx.fill(); });
    ctx.restore();
  }
  function sun(x, y, s, rot) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (let i = 0; i < 12; i++) { const a = rot + i / 12 * Math.PI * 2; pencil([[Math.cos(a) * 120, Math.sin(a) * 120], [Math.cos(a) * 165, Math.sin(a) * 165]], 1, { w: 7, c: P.orange, id: 800 + i }); }
    cut(tornCircle(100, 55, 5), { fill: P.yellow, rot: rot * 0.3, lift: 1, inner: () => { ctx.fillStyle = "rgba(241,154,54,0.35)"; ctx.beginPath(); ctx.arc(30, 30, 80, 0, 7); ctx.fill(); } });
    ctx.restore();
  }
  function cloud(x, y, s, sd = 3, c = "#ffffff") {
    if (s <= 0.01) return;
    const pts = cached("cloud" + sd, () => { const a = [], bumps = [[-90, 10, 55], [-40, -30, 65], [30, -40, 70], [90, -5, 55], [60, 35, 50], [-20, 40, 55], [-80, 40, 40]]; for (let i = 0; i < 120; i++) { const ang = i / 120 * Math.PI * 2; let best = 0; for (const [bx, by, br] of bumps) { const dx = Math.cos(ang), dy = Math.sin(ang), b = bx * dx + by * dy, cc = bx * bx + by * by - br * br, disc = b * b - cc; if (disc > 0) best = Math.max(best, b + Math.sqrt(disc)); } a.push([Math.cos(ang) * best, Math.sin(ang) * best * 0.8]); } return a; });
    cut(pts, { x, y, s, fill: c, lift: 0.9, tex: 0.5, outline: "rgba(42,34,29,0.55)", olw: 3, oid: sd * 7 });
  }
  function coin(x, y, s, rot = 0) {
    cut(tornCircle(38, 77, 2), { x, y, s, rot, fill: "#f2c14e", lift: 0.8, edgeW: 5, inner: () => { ctx.strokeStyle = "rgba(150,100,10,0.7)"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.stroke(); ctx.fillStyle = "#9a6a10"; ctx.font = `700 44px ${FONTS.hand}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("₺", 0, 2); } });
  }
  function sticky(x, y, rot, s, label, c = P.yellow, sd = 5) {
    cut(tornRect(180, 170, sd, 2.5), { x, y, rot, s, fill: c, lift: 1, edgeW: 4, inner: () => { ctx.fillStyle = P.ink; ctx.font = `700 50px ${FONTS.hand}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, 0, 4); } });
  }
  function receipt(x, y, rot, s, lines, sd = 9) {
    const pts = cached("rcpt" + sd, () => { const a = [], w = 260, h = 380; for (let i = 0; i <= 13; i++) a.push([-w / 2 + i * w / 13, -h / 2 + (i % 2 ? 0 : 12)]); for (let i = 0; i <= 13; i++) a.push([w / 2 - i * w / 13, h / 2 + (i % 2 ? 0 : -14)]); return a; });
    cut(pts, { x, y, rot, s, fill: "#fdfdf8", lift: 1.2, edgeW: 3, inner: () => {
      ctx.fillStyle = "#3a3a44"; ctx.textAlign = "center"; ctx.font = `700 34px ${FONTS.print}`; ctx.fillText(lines[0], 0, -120);
      ctx.font = `400 26px ${FONTS.print}`; ctx.globalAlpha = 0.75;
      for (let i = 0; i < 4; i++) ctx.fillRect(-100, -80 + i * 34, 120 + hr(i + sd) * 60, 5);
      ctx.globalAlpha = 1; ctx.font = `700 54px ${FONTS.hand}`; ctx.fillText(lines[1], 0, 116);
      ctx.setLineDash([8, 7]); ctx.strokeStyle = "#555"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-110, 65); ctx.lineTo(110, 65); ctx.stroke(); ctx.setLineDash([]);
    } });
  }
  function notebook(x, y, rot, s, sd = 12) {
    cut(tornRect(430, 520, sd, 3), { x, y, rot, s, fill: "#fbfbf4", lift: 1.2, edgeW: 3, inner: () => {
      ctx.strokeStyle = "rgba(80,140,200,0.45)"; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(-215, -190 + i * 40); ctx.lineTo(215, -190 + i * 40); ctx.stroke(); }
      ctx.strokeStyle = "rgba(220,70,60,0.6)"; ctx.beginPath(); ctx.moveTo(-150, -260); ctx.lineTo(-150, 260); ctx.stroke();
      for (let i = 0; i < 7; i++) { ctx.fillStyle = "#c9b99a"; ctx.beginPath(); ctx.arc(-190, -220 + i * 72, 11, 0, 7); ctx.fill(); }
      ctx.fillStyle = "#30304a"; ctx.font = `700 46px ${FONTS.hand}`; ctx.textAlign = "left";
      ctx.fillText("Ali  — 3 gün", -130, -160); ctx.fillText("Ayşe — 2 gün?", -130, -80); ctx.fillText("Hasan  ...", -130, 0); ctx.fillText("mazot ödendi mi?", -130, 80); ctx.fillText("= ???", -130, 160);
    } });
    // karalanmış satır
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    pencil(linePts(-140, 6, 70, -8, 8, 0.02).concat(linePts(70, -8, -120, 12, 8, -0.02)).concat(linePts(-120, 12, 60, 2, 8, 0.02)), 1, { w: 5, c: "#30304a", id: 930 });
    ctx.restore();
  }
  function bubble(x, y, s, inner) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    cloud(0, 0, 1.25, 8);
    [[-120, 150, 22], [-150, 200, 13]].forEach(([bx, by, br], i) => cut(tornCircle(br, 90 + i, 2), { x: bx, y: by, fill: "#fff", lift: 0.6, edgeW: 3, outline: "rgba(42,34,29,0.5)", oid: 950 + i }));
    if (inner) inner();
    ctx.restore();
  }
  function sack(x, y, s, rot, kg) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    const pts = cached("sack", () => { const r = RNG(61), a = []; for (let i = 0; i < 60; i++) { const t = i / 60 * Math.PI * 2; const rx = 150 + 20 * Math.cos(t * 2), ry = 160; let px = Math.cos(t) * rx, py = Math.sin(t) * ry; if (py < -100) { px *= 0.55 + (py + 160) / 60 * 0.25; } a.push([px + (r() - 0.5) * 6, py + (r() - 0.5) * 6]); } return a; });
    cut(pts, { fill: "#c9a46a", lift: 1.3, inner: () => { ctx.strokeStyle = "rgba(110,75,30,0.35)"; ctx.lineWidth = 3; for (let i = -160; i < 170; i += 14) { ctx.beginPath(); ctx.moveTo(-170, i); ctx.lineTo(170, i + 6); ctx.stroke(); } ctx.fillStyle = "#7a4a1d"; ctx.font = `400 50px ${FONTS.slab}`; ctx.textAlign = "center"; ctx.fillText("FINDIK", 0, 40); } });
    pencil([[-70, -112], [-20, -122], [30, -118], [72, -110]], 1, { w: 9, c: "#7a5522", id: 970 });
    // fındıklar tepesi
    [[-40, -150], [0, -162], [38, -150], [-14, -140], [20, -138]].forEach(([nx, ny], i) => { ctx.save(); ctx.translate(nx, ny); ctx.rotate(i); ctx.fillStyle = P.hazel; ctx.strokeStyle = "#fbf6ea"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 20, 23, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = P.base; ctx.beginPath(); ctx.ellipse(0, 14, 15, 7, 0, 0, 7); ctx.fill(); ctx.restore(); });
    if (kg) { const sw = Math.sin(T * 3.2) * 0.12; ctx.save(); ctx.translate(165, -105); ctx.rotate(0.05 + sw); pencil([[0, 0], [10, 50]], 1, { w: 3, id: 980 }); cut(tornRect(210, 92, 66, 2), { x: 70, y: 100, rot: -0.2, fill: P.paper, lift: 0.8, edgeW: 3, inner: () => { ctx.fillStyle = P.red; ctx.font = `700 60px ${FONTS.hand}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(kg, 0, 4); } }); ctx.restore(); }
    ctx.restore();
  }
  function person(x, y, s, o) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y + Math.sin(T * 5 + o.ph) * 4); ctx.scale(s, s); ctx.rotate(Math.sin(T * 3 + o.ph) * 0.03);
    cut(tornRect(120, 150, o.sd, 3), { x: 0, y: 40, fill: o.shirt, lift: 1, edgeW: 5, sx: 1, inner: () => { ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(-60, 80, 120, 40); } });
    if (o.scarf) cut(tornCircle(60, o.sd + 2, 3, 62), { x: 0, y: -78, fill: o.scarf, lift: 0.6, edgeW: 4, inner: () => { ctx.fillStyle = "rgba(255,255,255,0.6)"; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(-48 + (i % 4) * 32, -48 + Math.floor(i / 4) * 32, 4, 0, 7); ctx.fill(); } } });
    cut(tornCircle(46, o.sd + 1, 2.5), { x: 0, y: -66, fill: o.skin, lift: 0.5, edgeW: 5 });
    if (o.scarf) cut(tornRect(104, 26, o.sd + 5, 2), { x: 0, y: -108, fill: o.scarf, lift: 0.3, edgeW: 3 });
    if (o.cap) { cut(tornRect(110, 34, o.sd + 3, 2), { x: 0, y: -112, fill: o.cap, lift: 0.5, edgeW: 3 }); cut(tornRect(70, 14, o.sd + 4, 1), { x: 44, y: -96, fill: o.cap, lift: 0.4, edgeW: 2 }); }
    ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(-15, -68, 5, 0, 7); ctx.arc(15, -68, 5, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(240,120,110,0.5)"; ctx.beginPath(); ctx.arc(-28, -52, 8, 0, 7); ctx.arc(28, -52, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -56, 13, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.restore();
  }
  function stamp(x, y, s, rot, label, c = P.red, w = 520, h = 150, fs = 92) {
    if (s <= 0.01) return;
    // damga ayrı katmanda hazırlanır; mürekkep boşlukları yalnız damgayı deler
    const img = cached(`stamp${label}|${c}|${w}|${h}|${fs}`, () => {
      const cv = mkCanvas(w + 40, h + 40), x = cv.getContext("2d");
      x.translate((w + 40) / 2, (h + 40) / 2); x.strokeStyle = c; x.lineWidth = 12;
      x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 18); x.stroke();
      x.lineWidth = 4; x.beginPath(); x.roundRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, 10); x.stroke();
      x.fillStyle = c; x.font = `900 ${fs}px ${FONTS.rubik}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(label, 0, 6);
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "destination-out"; x.globalAlpha = 0.85;
      for (let yy = 0; yy < h + 40; yy += 512) for (let xx = 0; xx < w + 40; xx += 512) x.drawImage(TEX.grain, xx, yy);
      return cv;
    });
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.globalAlpha *= 0.92;
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }
  function phone(x, y, s, rot, screen) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    cut(tornRect(300, 560, 141, 2.5), { fill: "#2f3540", lift: 1.4, edgeW: 6 });
    cut(tornRect(256, 470, 142, 1.5), { y: -6, fill: P.paper, lift: 0, edgeW: 2, inner: screen });
    ctx.fillStyle = "#555c66"; ctx.beginPath(); ctx.roundRect(-34, -262, 68, 10, 5); ctx.fill();
    ctx.restore();
  }
  function laptop(x, y, s, rot, screen) {
    if (s <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    cut(tornRect(620, 400, 151, 2.5), { y: -40, fill: "#2f3540", lift: 1.3, edgeW: 6 });
    cut(tornRect(570, 350, 152, 1.5), { y: -40, fill: P.paper, lift: 0, edgeW: 2, inner: screen });
    cut(tornRect(760, 46, 153, 2), { y: 182, fill: "#8d96a3", lift: 1, edgeW: 5 });
    ctx.restore();
  }
  // mini panel çizimi (uygulamanın sade temsili)
  function miniDash(w, h, p, big) {
    ctx.save();
    ctx.fillStyle = P.green; ctx.fillRect(-w / 2, -h / 2, w, h * 0.13);
    ctx.fillStyle = "#fff"; ctx.font = `700 ${h * 0.075}px ${FONTS.print}`; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("🌰 TİYS", -w / 2 + w * 0.06, -h / 2 + h * 0.066);
    const cards = big ? 4 : 2, cw = (w * 0.88 - (cards - 1) * w * 0.03) / cards;
    const cc = [P.leaf2, P.orange, P.blue, P.red];
    for (let i = 0; i < cards; i++) { const k = eOut(seg(p, i * 0.1, i * 0.1 + 0.4)); ctx.globalAlpha = k; ctx.fillStyle = cc[i]; ctx.beginPath(); ctx.roundRect(-w * 0.44 + i * (cw + w * 0.03), -h / 2 + h * 0.18, cw, h * 0.16, 8); ctx.fill(); }
    ctx.globalAlpha = 1;
    const bars = big ? 9 : 6, bw = w * 0.88 / bars;
    for (let i = 0; i < bars; i++) { const bh = h * 0.36 * (0.35 + 0.65 * hr(i + 3)) * eOut(seg(p, 0.2 + i * 0.05, 0.6 + i * 0.05)); ctx.fillStyle = i % 2 ? P.lime : P.leaf; ctx.fillRect(-w * 0.44 + i * bw + bw * 0.15, h * 0.4 - bh, bw * 0.7, bh); }
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w * 0.44, h * 0.4); ctx.lineTo(w * 0.44, h * 0.4); ctx.stroke();
    ctx.restore();
  }

  // Başlık etiketi: yırtık beyaz kâğıt + bant + el yazısı
  function label(x, y, str, sub, t0, o = {}) {
    const k = eBack(seg(T, t0, t0 + 0.45)); if (k <= 0) return;
    const size = o.size || 104, tw = measure(str, size), w = Math.max(tw + 110, sub ? measure(sub, 56, FONTS.print, 400) + 90 : 0), h = sub ? size * 1.95 : size * 1.4;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2 + (1 - k) * -60); ctx.rotate((o.rot || -0.025) + (1 - k) * -0.15);
    cut(tornRect(Math.round(w / 10) * 10, Math.round(h / 10) * 10, o.sd || 201, 4), { fill: o.fill || P.paper, lift: 1.2, alpha: clamp(k * 2) });
    tape(-w / 2 + 40, -h / 2 + 6, 150, -0.5, clamp(k * 2), 3); tape(w / 2 - 40, -h / 2 + 8, 140, 0.45, clamp(k * 2), 4);
    text(str, -tw / 2, sub ? -h / 2 + size * 0.98 : size * 0.33, { size, start: t0 + 0.15, dur: 0.5, color: o.color || P.ink, id: o.sd || 0 });
    if (sub) text(sub, 0, -h / 2 + size * 1.62, { size: 56, font: FONTS.print, weight: 400, start: t0 + 0.45, dur: 0.5, color: P.ink2, align: "center", id: 40 });
    ctx.restore();
  }

  // Yeni sahne kâğıdı kayarak girer (yırtık ön kenar). dir: 'l','r','u','d'
  function sheetIn(t0, dur, dir, drawNew, sd = 1) {
    const p = eIO(seg(T, t0, t0 + dur));
    if (p <= 0) return false;
    if (p >= 1) { drawNew(); return true; }
    const edge = cached("edge" + sd, () => { const r = RNG(sd), a = []; let o = 0; for (let i = 0; i <= 60; i++) { o = o * 0.6 + (r() - 0.5) * 14; a.push(o); } return a; });
    ctx.save(); ctx.beginPath();
    const horiz = dir === "l" || dir === "r";
    const span = horiz ? W : H, other = horiz ? H : W, pos = p * (span + 80);
    const pts = [];
    for (let i = 0; i <= 60; i++) { const u = i / 60 * other, e = pos + edge[i]; pts.push(horiz ? [dir === "r" ? W - e : e, u] : [u, dir === "d" ? H - e : e]); }
    if (dir === "l") { ctx.moveTo(-10, -10); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(-10, H + 10); }
    if (dir === "r") { ctx.moveTo(W + 10, -10); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(W + 10, H + 10); }
    if (dir === "u") { ctx.moveTo(-10, -10); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(W + 10, -10); }
    if (dir === "d") { ctx.moveTo(-10, H + 10); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.lineTo(W + 10, H + 10); }
    ctx.closePath();
    ctx.save(); ctx.shadowColor = "rgba(30,15,0,0.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetX = dir === "l" ? 14 : dir === "r" ? -14 : 0; ctx.shadowOffsetY = dir === "u" ? 14 : dir === "d" ? -14 : 0; ctx.fillStyle = "#fbf6ea"; ctx.fill(); ctx.restore();
    ctx.clip();
    drawNew();
    ctx.restore();
    // beyaz yırtık kenar şeridi
    ctx.save(); ctx.strokeStyle = "#fbf6ea"; ctx.lineWidth = 9; ctx.lineJoin = "round"; ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.restore();
    return true;
  }
  function bg(color, key) { ctx.drawImage(bgPaper(color, key), 0, 0); }

  // Konfeti (kâğıt parçaları)
  function confetti(t0, n, cx, cy, sd, spread = 1) {
    const dt = T - t0; if (dt < 0 || dt > 3.2) return;
    const cols = [P.yellow, P.red, P.orange, P.lime, P.sky, P.pink, "#fff"];
    for (let i = 0; i < n; i++) {
      const r = hr(sd + i * 3.1), r2 = hr(sd + i * 7.7), r3 = hr(sd + i * 1.3);
      const a = -Math.PI / 2 + (r - 0.5) * 2.6 * spread, v = 700 + r2 * 900;
      const x = cx + Math.cos(a) * v * dt * 0.9, y = cy + Math.sin(a) * v * dt + 900 * dt * dt;
      ctx.save(); ctx.translate(x, y); ctx.rotate(dt * (4 + r3 * 8) * (r > 0.5 ? 1 : -1)); ctx.scale(1, Math.cos(dt * 9 + i));
      ctx.globalAlpha = clamp((3.2 - dt) * 2); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(-9, -6, 18 + r2 * 10, 12); ctx.restore();
    }
  }
  function questionMark(x, y, s, id) { if (s <= 0.01) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(jit(id, 0.06)); text("?", 0, 0, { size: 150, font: FONTS.handB, weight: 400, color: P.red, stroke: "#fbf6ea", strokeW: 12, align: "center", id }); ctx.restore(); }

  // ================= SAHNELER =================
  // S1: Bahçe (0 – 5.3)
  function sceneGarden(tl, calm) {
    bg(P.cream, "cream");
    const st = calm ? 43.2 : 0;
    sun(1560, 230, eBack(seg(T, st + 0.35, st + 0.9)), T * 0.25);
    if (calm) { [[180, 150], [290, 110], [400, 170]].forEach(([bx, by], i) => { const f = Math.sin(T * 8 + i) * 10; pencil([[bx - 30 + Math.sin(T + i) * 40, by + f], [bx + Math.sin(T + i) * 40, by + 14], [bx + 30 + Math.sin(T + i) * 40, by + f]], 1, { w: 4, id: 1100 + i }); }); }
    cloud(250 + Math.sin(T * 0.4) * 30, 400, eBack(seg(T, st + 0.5, st + 1.0)) * 0.8, 4);
    cloud(1260 + Math.sin(T * 0.3 + 2) * 30, 450, eBack(seg(T, st + 0.6, st + 1.1)) * 0.55, 5);
    hills(seg(T, st, st + 1.3));
    const bs = [[260, 760, 0.7], [620, 700, 0.6], [1250, 690, 0.65], [1650, 760, 0.8], [1450, 880, 0.9], [120, 950, 0.9]];
    bs.forEach(([bx, by, sc], i) => bush(bx, by, sc * eBack(seg(T, st + 0.65 + i * 0.13, st + 1.0 + i * 0.13)), 20 + i));
  }
  function s1() {
    sceneGarden();
    // Fındık
    const up = eBack(seg(T, 0.95, 1.4));
    const worry = T > 2.95;
    const scratch = worry ? Math.sin(T * 14) * 0.3 : 0;
    mascot({ x: 960, y: 1240 - up * 520 + Math.sin(T * 4) * 5, s: 1.25, rot: Math.sin(T * 2) * 0.03, sq: Math.max(0, 1 - seg(T, 1.15, 1.6) * 1.4) * 0.15 * Math.sin(T * 30),
      mouth: worry ? (T > 4.75 ? "o" : "worry") : "grin", look: worry ? [0.6, -0.8] : [0, 0], blink: blinkAt(1.9) || blinkAt(4.2),
      armR: worry ? -1.6 + scratch : -0.9, waveR: worry ? 0 : Math.sin(T * 9) * 0.35, armL: 0.9 });
    // başlık
    text("Fındık bahçesi...", 960, 190, { size: 130, start: 1.05, dur: 1.0, align: "center", color: P.green, stroke: "#fbf6ea", strokeW: 14 });
    if (T > 2.9) text("ama hesabı?", 960, 330, { size: 120, start: 3.0, dur: 0.7, align: "center", color: P.red, stroke: "#fbf6ea", strokeW: 14, id: 50 });
    questionMark(1250, 600, eBack(seg(T, 3.65, 3.95)), 61); questionMark(1360, 520, eBack(seg(T, 3.95, 4.25)) * 0.8, 62);
    // ilk uçuşan kâğıtlar
    if (T > 4.3) { const k = seg(T, 4.3, 5.4); receipt(lerp(-200, 380, eOut(k)), 520 + Math.sin(T * 6) * 20, -0.5 + k, 0.6, ["FİŞ", "?"], 9); sticky(lerp(2100, 1600, eOut(seg(T, 4.6, 5.4))), 420, 0.3, 0.8, "kira?", P.pink, 6); }
  }
  function blinkAt(t0) { return T > t0 && T < t0 + 0.12; }

  // S2: Kaos (5.0 – 12.0)
  function s2(frozenT) {
    const Tsave = T; if (frozenT != null) T = frozenT;
    bg(P.kraft, "kraft");
    // arka plan karalamaları
    ctx.save(); ctx.globalAlpha = 0.18; [[200, 200], [1700, 860], [1600, 180], [260, 900]].forEach(([dx, dy], i) => text(["₺", "kg", "%", "?"][i], dx, dy, { size: 160, font: FONTS.handB, weight: 400, color: P.ink, id: 300 + i })); ctx.restore();
    const swirl = seg(T, 8.5, 9.8), freeze = seg(T, 9.9, 10.3), orbitSpeed = (1 - freeze);
    const orb = (i, rx, ry, ph) => { const a = ph + (T - 8.5) * (1.2 + swirl * 2.4) * orbitSpeed * (i % 2 ? 1 : -0.8); return [960 + Math.cos(a) * rx, 560 + Math.sin(a) * ry]; };
    // fiş
    {
      const k = eOut(seg(T, 5.35, 5.6)), lnd = T > 5.6, wob = lnd ? Math.sin((T - 5.6) * 12) * Math.exp(-(T - 5.6) * 3) * 0.12 : 0;
      let [x, y] = [lerp(-300, 400, k), lerp(-300, 360, k)];
      if (swirl > 0) { const [ox, oy] = orb(1, 620, 330, 3.6); x = lerp(x, ox, eIO(swirl)); y = lerp(y, oy, eIO(swirl)); }
      if (T > 5.35) receipt(x, y, -0.22 + wob + (swirl * 0.6), 1.05 * (1 + (1 - k) * 0.6), ["MAZOT", "2.450 ₺"], 9);
    }
    // defter
    {
      const k = eOut(seg(T, 6.62, 6.86)), lnd = T > 6.86, wob = lnd ? Math.sin((T - 6.86) * 12) * Math.exp(-(T - 6.86) * 3) * 0.1 : 0;
      let [x, y] = [lerp(2300, 1480, k), lerp(-200, 390, k)];
      if (swirl > 0) { const [ox, oy] = orb(2, 640, 300, 0.2); x = lerp(x, ox, eIO(swirl)); y = lerp(y, oy, eIO(swirl)); }
      if (T > 6.62) notebook(x, y, 0.12 + wob - swirl * 0.4, 0.95 * (1 + (1 - k) * 0.5), 12);
    }
    // ekstra uçuşanlar
    const extras = [[8.6, "gübre?", P.yellow, 0.9], [8.9, "ilaç", P.lime, 2.3], [9.2, "kira", P.pink, 4.4], [9.0, "işçi?", P.sky, 5.6]];
    extras.forEach(([t0, lb, c, ph], i) => { const k = eOut(seg(T, t0, t0 + 0.5)); if (k <= 0) return; const [ox, oy] = orb(i + 3, 760 - i * 40, 420 - i * 20, ph); sticky(lerp(i % 2 ? 2100 : -200, ox, k), lerp(oy - 300, oy, k), Math.sin(T * 2 + i) * 0.3, 0.85, lb, c, 20 + i); });
    [[8.8, 1.2], [9.1, 3.1], [9.35, 5.2]].forEach(([t0, ph], i) => { const k = eOut(seg(T, t0, t0 + 0.4)); if (k > 0) { const [ox, oy] = orb(i + 7, 520 + i * 60, 260 + i * 30, ph); coin(ox, lerp(-100, oy, k), 1.1, T * 3 + i); } });
    // hesap makinesi
    { const k = eOut(seg(T, 9.45, 9.85)); if (k > 0) { const [ox, oy] = orb(11, 700, 380, 1.9); cut(tornRect(200, 280, 404, 2), { x: lerp(960, ox, k), y: lerp(1300, oy, k), rot: T * 1.5 * orbitSpeed + 0.4, fill: "#5d6b7a", lift: 1.2, inner: () => { ctx.fillStyle = "#cfe5c9"; ctx.fillRect(-80, -120, 160, 60); ctx.fillStyle = "#33424f"; ctx.font = `700 40px ${FONTS.print}`; ctx.textAlign = "right"; ctx.fillText("Err", 70, -76); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { ctx.fillStyle = r === 3 && c === 2 ? P.orange : "#e9e4d8"; ctx.fillRect(-78 + c * 56, -40 + r * 42, 44, 32); } } }); } }
    // Fındık (ortada, şaşkın)
    const dz = seg(T, 8.6, 9.9) * (1 - freeze);
    const idea = T > 10.3;
    mascot({ x: 960, y: 640 + Math.sin(T * 5) * 6, s: 1.2, rot: dz * Math.sin(T * 7) * 0.14, mouth: idea ? "o" : T > 6.6 ? "worry" : "o", dizzy: dz > 0.3 && !idea, look: T > 8.0 && T < 8.6 ? [0.4, -1] : idea ? [0, -1] : [Math.sin(T * 2), 0], armL: idea ? 0.6 : -0.3 + Math.sin(T * 6) * 0.2, armR: idea ? -1.4 : -0.3 - Math.sin(T * 6) * 0.2, blink: blinkAt(7.4) });
    // düşünce balonu
    { const k = eBack(seg(T, 8.1, 8.45)) * (1 - seg(T, 8.6, 8.9)); bubble(1210, 250, k, () => { text("kaç kilo?", 0, 18, { size: 70, align: "center", color: P.ink, id: 70 }); }); }
    // ampul
    { const k = eBack(seg(T, 10.3, 10.6)); if (k > 0) { ctx.save(); ctx.translate(960, 330); ctx.scale(k, k); const glow = 0.5 + 0.5 * Math.sin(T * 10);
      ctx.fillStyle = `rgba(255,230,120,${0.25 + glow * 0.15})`; ctx.beginPath(); ctx.arc(0, -20, 110, 0, 7); ctx.fill();
      cut(tornCircle(62, 501, 2.5), { y: -30, fill: "#ffe680", lift: 0.8, outline: P.ink, oid: 777 }); cut(tornRect(56, 46, 502, 1.5), { y: 46, fill: "#9aa3ad", lift: 0.6 });
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42; pencil([[Math.cos(a) * 90, -30 + Math.sin(a) * 90], [Math.cos(a) * 125, -30 + Math.sin(a) * 125]], 1, { w: 6, c: P.orange, id: 1200 + i }); }
      ctx.restore(); } }
    T = Tsave;
  }
  // Makas kesimi (11.0 – 12.7)
  function cutTransition() {
    const lineY = (x) => 560 + Math.sin(x / 140) * 18;
    if (T < 12.0) {
      s2(T > 10.3 ? Math.min(T, 11.0) : null);
      if (T > 11.0) { const k = seg(T, 11.0, 11.6); const pts = []; for (let x = -20; x <= W + 20; x += 20) pts.push([x, lineY(x)]);
        ctx.save(); ctx.setLineDash([26, 18]); pencil(pts, k, { w: 5, id: 1300, passes: 1, j: 0.8 }); ctx.restore(); }
      if (T > 11.5) { const k = seg(T, 11.6, 12.0), sx = lerp(-150, W + 150, eIn(k * 0.6 + 0.4 * k)), open = Math.abs(Math.sin(T * 26)) * 0.42;
        drawScissors(Math.max(-100, sx), lineY(sx), open, eOut(seg(T, 11.5, 11.65))); }
      return;
    }
    // ikiye ayrılan sahne
    const k = eIn(seg(T, 12.0, 12.75));
    sceneReveal();
    const half = (top) => {
      ctx.save();
      ctx.translate(0, (top ? -1 : 1) * k * 900); ctx.translate(W / 2, H / 2); ctx.rotate((top ? -1 : 1) * k * 0.12); ctx.translate(-W / 2, -H / 2);
      ctx.beginPath();
      if (top) { ctx.moveTo(-50, -50); for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, lineY(x) + (x % 40 ? 3 : -3)); ctx.lineTo(W + 50, -50); }
      else { ctx.moveTo(-50, H + 50); for (let x = -20; x <= W + 20; x += 20) ctx.lineTo(x, lineY(x) + (x % 40 ? 3 : -3)); ctx.lineTo(W + 50, H + 50); }
      ctx.closePath(); ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = top ? 16 : -16; ctx.fillStyle = P.kraft; ctx.fill(); ctx.restore();
      ctx.clip(); s2(11.0);
      ctx.restore();
    };
    if (k < 1) { half(true); half(false); }
  }
  function drawScissors(x, y, open, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * 1.1, s * 1.1);
    const blade = (sgn) => { ctx.save(); ctx.rotate(sgn * open); cut(cached("blade", () => [[0, -10], [190, -4], [205, 0], [190, 6], [0, 12]]), { fill: "#c9d0d8", lift: 0.9, edgeW: 3, outline: "rgba(40,40,50,0.6)", oid: 1400 + sgn });
      cut(tornCircle(34, 1410 + sgn, 2, 26), { x: -46, y: sgn * 28, fill: P.red, lift: 0.9, edgeW: 4, inner: () => { ctx.fillStyle = P.kraft; ctx.beginPath(); ctx.ellipse(-46, sgn * 28, 18, 12, 0, 0, 7); } }); ctx.fillStyle = P.kraft; ctx.beginPath(); ctx.ellipse(-46, sgn * 28, 17, 11, 0, 0, 7); ctx.fill(); ctx.restore(); };
    blade(1); blade(-1);
    ctx.fillStyle = "#555"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
    ctx.restore();
  }

  // S3: Logo (12.0 – 16.8)
  const LETTERS = [["T", FONTS.slab, P.yellow, P.green, -0.08], ["İ", FONTS.rubik, P.red, "#fff", 0.06], ["Y", FONTS.slab, P.paper, P.green, -0.04], ["S", FONTS.rubik, P.orange, "#fff", 0.07]];
  function logo(cx, cy, scale, times, opts = {}) {
    const step = 230 * scale;
    LETTERS.forEach(([ch, font, bgc, fg, rot], i) => {
      const t0 = times[i], k = seg(T, t0, t0 + 0.22); if (k <= 0) return;
      const sc = lerp(2.6, 1, eOut(k)) * scale, a = clamp(k * 4);
      const x = cx + (i - 1.5) * step, y = cy + (i % 2 ? 14 : -10) * scale + jit(1500 + i, 1.5);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot + (1 - eOut(k)) * 0.5 + jit(1510 + i, 0.012)); ctx.scale(sc, sc);
      cut(tornRect(200, 240, 1520 + i, 4.5), { fill: bgc, lift: 1.3 * (2 - eOut(k)), tx: i * 70, ty: i * 40 });
      ctx.fillStyle = fg; ctx.font = `${font === FONTS.rubik ? 900 : 400} ${font === FONTS.rubik ? 190 : 175}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(ch, 0, ch === "İ" ? 22 : 12);
      ctx.restore();
    });
  }
  function sceneReveal() {
    bg(P.green, "green");
    // arkadaki silik fındık desenleri
    ctx.save(); ctx.globalAlpha = 0.08; for (let i = 0; i < 14; i++) { const x = hr(i) * W, y = hr(i + 20) * H; ctx.save(); ctx.translate(x, y + Math.sin(T + i) * 8); ctx.rotate(i); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(0, 0, 40, 46, 0, 0, 7); ctx.fill(); ctx.restore(); } ctx.restore();
    text("Tanışın:", 960, 215, { size: 96, start: 12.45, dur: 0.35, align: "center", color: P.yellow, id: 90 });
    logo(960, 510, 1, [12.92, 13.05, 13.18, 13.31]);
    const tk = eBack(seg(T, 13.62, 13.95));
    if (tk > 0) { ctx.save(); ctx.translate(960, 770); ctx.rotate(-0.015); ctx.scale(tk, 1); cut(tornRect(1020, 110, 1601, 3), { fill: "rgba(246,236,200,0.92)", lift: 0.6, edgeW: 2 }); ctx.restore();
      text("Tarım İşletme Yönetim Sistemi", 960, 793, { size: 64, font: FONTS.print, weight: 400, start: 13.7, dur: 0.9, align: "center", color: P.green, id: 91 }); }
    const up = eBack(seg(T, 12.25, 12.7));
    mascot({ x: 1650, y: 1250 - up * 430, s: 0.95, rot: -0.08 + Math.sin(T * 3) * 0.04, mouth: "grin", armL: -0.9, armR: -0.9, waveL: Math.sin(T * 10) * 0.2, waveR: -Math.sin(T * 10) * 0.2, blink: blinkAt(14.6) });
    confetti(12.95, 70, 960, 600, 3, 1.2);
  }

  // Özellik sahneleri ortak arka planı
  function featureBg(c, key) { bg(c, key); }
  // F1: İşçi takibi (16.8 – 21.6)
  function f1() {
    featureBg(P.sky, "sky");
    label(110, 120, "İşçi & İş Takibi", "Kim, kaç gün, ne kadar?", 16.85);
    // takvim kartı
    const k = eBack(seg(T, 16.95, 17.4));
    ctx.save(); ctx.translate(1340, 600 + (1 - k) * 700); ctx.rotate(0.03);
    cut(tornRect(780, 600, 1700, 3.5), { fill: P.paper, lift: 1.4, inner: () => { ctx.fillStyle = P.red; ctx.fillRect(-400, -310, 800, 95); } });
    tape(-300, -290, 160, -0.35, 1, 5); tape(300, -292, 160, 0.3, 1, 6);
    text("EYLÜL", 0, -232, { size: 74, font: FONTS.print, weight: 400, color: "#fff", align: "center", start: 17.2, dur: 0.3, id: 92 });
    const gx = -330, gy = -180, cw = 94, chh = 92;
    ctx.strokeStyle = "rgba(42,34,29,0.5)"; ctx.lineWidth = 2.5;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) { ctx.save(); ctx.translate(jit(1710 + r * 7 + c, 1), jit(1740 + r * 7 + c, 1)); ctx.strokeRect(gx + c * cw, gy + r * chh + 10, cw - 10, chh - 12); ctx.restore(); ctx.fillStyle = "rgba(42,34,29,0.45)"; ctx.font = `400 22px ${FONTS.print}`; ctx.fillText(String(r * 7 + c + 1), gx + c * cw + 8, gy + r * chh + 32); }
    const checks = [[0, 1], [0, 2], [0, 3], [1, 0], [1, 1], [1, 4], [2, 2], [2, 3]];
    checks.forEach(([r, c], i) => { const t0 = 17.3 + i * 0.15; const cx = gx + c * cw + 42, cy = gy + r * chh + 54; pencil([[cx - 22, cy], [cx - 6, cy + 18], [cx + 26, cy - 24]], seg(T, t0, t0 + 0.14), { w: 7, c: P.leaf, id: 1800 + i }); });
    stamp(170, 210, eBack(seg(T, 18.55, 18.75)) * 1 + (1 - seg(T, 18.55, 18.65)) * 0, -0.14, "ÖDENDİ", P.red, 380, 120, 74);
    ctx.restore();
    // işçiler
    const ppl = [{ shirt: P.orange, skin: "#e8b48a", scarf: "#7a4fa0", sd: 1801, ph: 0 }, { shirt: P.blue, skin: "#d9a074", cap: P.red, sd: 1811, ph: 1.3 }, { shirt: P.leaf2, skin: "#efc39a", scarf: P.red, sd: 1821, ph: 2.1 }, { shirt: P.yellow, skin: "#c98f62", cap: P.green, sd: 1831, ph: 3.1 }];
    ppl.forEach((o, i) => { const k2 = eBack(seg(T, 17.05 + i * 0.12, 17.45 + i * 0.12)); person(190 + i * 175, 1210 - k2 * 420, 1.15, o); });
    // kayıtlı etiketi
    { const k3 = eBack(seg(T, 19.8, 20.1)); if (k3 > 0) { ctx.save(); ctx.translate(520, 545); ctx.rotate(-0.06); ctx.scale(k3, k3); cut(tornRect(400, 96, 1850, 3), { fill: P.leaf, lift: 1 }); text("✓ hepsi kayıtlı", 0, 22, { size: 66, align: "center", color: "#fff", id: 93 }); ctx.restore(); } }
  }
  // F2: Gelir · Gider (21.6 – 26.4)
  function f2() {
    featureBg(P.butter, "butter");
    label(110, 120, "Gelir · Gider", "tarla tarla, kuruşu kuruşuna", 21.65);
    // klasör + kavanoz
    const kf = eBack(seg(T, 21.7, 22.0));
    ctx.save(); ctx.translate(330, 830 + (1 - kf) * 500);
    cut(tornRect(380, 60, 1901, 2), { y: -150, x: -70, fill: "#e0b36a", lift: 1 });
    cut(tornRect(420, 300, 1902, 3), { fill: "#e9bd73", lift: 1.3, inner: () => { ctx.strokeStyle = "rgba(120,80,20,0.25)"; ctx.lineWidth = 3; ctx.strokeRect(-180, -120, 360, 240); } });
    text("GİDERLER", 0, 22, { size: 58, font: FONTS.print, weight: 400, align: "center", color: "#6b4512", id: 94 });
    ctx.restore();
    { const k = seg(T, 21.9, 22.3); if (k > 0 && k < 1) receipt(lerp(-150, 330, eIn(k)), lerp(300, 700, eIn(k)), k * 4, 0.55 * (1 - k * 0.4), ["MAZOT", "₺"], 9); }
    const kj = eBack(seg(T, 21.8, 22.1));
    ctx.save(); ctx.translate(780, 820 + (1 - kj) * 500);
    cut(tornRect(260, 320, 1910, 3), { fill: "rgba(200,230,235,0.85)", lift: 1.2, inner: () => { ctx.fillStyle = "rgba(242,193,78,0.85)"; ctx.fillRect(-130, 40 - seg(T, 22.6, 22.9) * 40, 260, 200); } });
    cut(tornRect(200, 50, 1911, 2), { y: -180, fill: "#8d96a3", lift: 0.8 });
    text("GELİRLER", 0, 0, { size: 50, font: FONTS.print, weight: 400, align: "center", color: P.green, id: 95 });
    ctx.restore();
    { const k = seg(T, 22.3, 22.62); if (k > 0 && k < 1) coin(780, lerp(260, 760, eIn(k)), 1, k * 8); }
    // grafik kartı
    const kc = eBack(seg(T, 23.2, 23.6));
    ctx.save(); ctx.translate(1430, 560 + (1 - kc) * 800); ctx.rotate(-0.025);
    cut(tornRect(820, 640, 1950, 3.5), { fill: P.paper, lift: 1.4 });
    tape(0, -318, 200, 0.02, 1, 7);
    pencil([[-340, -230], [-340, 220], [360, 220]], seg(T, 23.35, 23.7), { w: 5, id: 1960 });
    const tarla = ["Tarla 1", "Tarla 2", "Tarla 3"], gel = [0.82, 0.62, 0.95], gid = [0.45, 0.5, 0.38];
    tarla.forEach((nm, i) => {
      const bx = -260 + i * 220, kk = eBack(seg(T, 23.5 + i * 0.25, 23.85 + i * 0.25));
      cut(tornRect(70, 400, 1970 + i, 2), { x: bx, y: 220 - 200 * gel[i] * kk, sy: gel[i] * kk + 0.001, fill: P.leaf2, lift: 0.7, edgeW: 3 });
      cut(tornRect(70, 400, 1980 + i, 2), { x: bx + 80, y: 220 - 200 * gid[i] * kk, sy: gid[i] * kk + 0.001, fill: P.red, lift: 0.7, edgeW: 3 });
      text(nm, bx + 40, 272, { size: 44, align: "center", start: 23.6 + i * 0.25, dur: 0.3, id: 96 + i });
    });
    [["gelir", P.leaf2, -300], ["gider", P.red, -110]].forEach(([nm, c, lx]) => { ctx.fillStyle = c; ctx.fillRect(lx, -270, 34, 34); text(nm, lx + 46, -242, { size: 44, start: 23.5, dur: 0.2, id: 99 }); });
    ctx.restore();
  }
  // F3: Tarla & Hasat (26.4 – 31.2)
  function f3() {
    featureBg(P.sage, "sage");
    label(110, 120, "Tarla & Hasat", "haritada işaretle, kiloyu kaydet", 26.45);
    const km = eBack(seg(T, 26.55, 26.95));
    ctx.save(); ctx.translate(1300, 590 + (1 - km) * 800); ctx.rotate(0.02);
    cut(tornRect(900, 640, 2001, 4), { fill: "#efe9d6", lift: 1.4, inner: () => {
      ctx.strokeStyle = "rgba(120,140,100,0.35)"; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { ctx.beginPath(); for (let x = -460; x <= 460; x += 20) ctx.lineTo(x, -300 + i * 75 + Math.sin(x / 90 + i) * 18); ctx.stroke(); }
      ctx.strokeStyle = "rgba(80,140,200,0.55)"; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-460, 200); ctx.bezierCurveTo(-200, 120, -120, 300, 120, 240); ctx.bezierCurveTo(300, 200, 360, 300, 460, 260); ctx.stroke();
    } });
    tape(-380, -300, 150, -0.4, 1, 8); tape(380, -300, 150, 0.4, 1, 9);
    const fields = [[[-360, -230], [-120, -250], [-90, -40], [-370, -10]], [[-90, -250], [150, -230], [130, -60], [-70, -40]], [[160, -230], [380, -250], [390, 10], [150, -50]], [[-330, 20], [-80, -10], [-60, 150], [-340, 170]]];
    const fc = [P.leaf2, P.lime, P.leaf, "#9cc35a"];
    fields.forEach((f, i) => { const kk = eBack(seg(T, 26.8 + i * 0.2, 27.15 + i * 0.2)); if (kk <= 0) return; const cx = f.reduce((a, p) => a + p[0], 0) / 4, cy = f.reduce((a, p) => a + p[1], 0) / 4;
      cut(f.map(p => [p[0] - cx, p[1] - cy]), { x: cx, y: cy, s: kk, fill: fc[i], lift: 0.7, edgeW: 4, outline: "rgba(30,60,20,0.6)", oid: 2010 + i, inner: () => { ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 3; for (let j = -200; j < 200; j += 22) { ctx.beginPath(); ctx.moveTo(j, -150); ctx.lineTo(j + 60, 150); ctx.stroke(); } } });
      text(["Tarla 1", "Tarla 2", "Tarla 3", "Tarla 4"][i], cx, cy + 14, { size: 44, align: "center", color: P.ink, start: 27.0 + i * 0.2, dur: 0.3, id: 110 + i }); });
    [[-300, -175], [-40, -185], [300, -180]].forEach(([px, py], i) => { const t0 = 27.6 + i * 0.2, kk = seg(T, t0, t0 + 0.2); if (kk <= 0) return; const yy = py - 40 - (1 - eOut(kk)) * 300;
      ctx.save(); ctx.translate(px, yy); ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath(); ctx.ellipse(6, 52, 16, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = P.red; ctx.strokeStyle = "#fbf6ea"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 50); ctx.bezierCurveTo(-34, 0, -30, -36, 0, -36); ctx.bezierCurveTo(30, -36, 34, 0, 0, 50); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -10, 11, 0, 7); ctx.fill(); ctx.restore(); });
    ctx.restore();
    // çuval + Fındık
    const ks = eBack(seg(T, 28.55, 28.85));
    sack(330, 1240 - ks * 430, 0.88, -0.04, T > 28.9 ? "1.250 kg" : null);
    const km2 = eBack(seg(T, 29.05, 29.4));
    mascot({ x: 700, y: 1300 - km2 * 470, s: 0.72, rot: 0.08, mouth: "grin", armR: -1.2, waveR: Math.sin(T * 8) * 0.2, armL: 0.6, blink: blinkAt(30.3) });
  }
  // F4: Hava · Dolar · Rapor (31.2 – 36.0)
  function polaroid(x, y, rot, k, sd, inner, cap) {
    if (k <= 0) return;
    ctx.save(); ctx.translate(x, y - (1 - k) * 160); ctx.rotate(rot + (1 - k) * 0.4); ctx.globalAlpha *= clamp(k * 3);
    cut(tornRect(440, 500, sd, 2.5), { fill: "#fdfbf5", lift: 1.4 });
    cut(tornRect(380, 340, sd + 1, 1.2), { y: -50, fill: "#e8eef2", lift: 0, edgeW: 1, inner });
    tape(0, -250, 170, -0.06 + jit(sd, 0.01), 1, sd % 9);
    text(cap, 0, 196, { size: 58, align: "center", start: -9, id: sd });
    ctx.restore();
  }
  function f4() {
    featureBg(P.peach, "peach");
    label(110, 90, "Hava · Dolar · Rapor", "hepsi bir bakışta", 31.25, { size: 96 });
    polaroid(470, 690, -0.06, eBack(seg(T, 31.45, 31.8)), 2101, () => {
      sun(-60, -40, 0.62, T * 0.6); cloud(60, 40, 0.8, 6);
      for (let i = 0; i < 6; i++) { const dy = ((T * 260 + i * 53) % 120); ctx.strokeStyle = P.blue; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(10 + i * 26, 100 + dy * 0.6); ctx.lineTo(4 + i * 26, 118 + dy * 0.6); ctx.stroke(); }
      ctx.fillStyle = P.ink; ctx.font = `700 64px ${FONTS.hand}`; ctx.fillText("24°", 80, -90);
    }, "Hava durumu");
    polaroid(960, 700, 0.04, eBack(seg(T, 32.25, 32.6)), 2111, () => {
      cut(tornRect(300, 150, 2120, 2), { y: -20, rot: -0.08, fill: "#9cc58c", lift: 0.8, inner: () => { ctx.strokeStyle = "rgba(30,80,30,0.6)"; ctx.lineWidth = 4; ctx.strokeRect(-130, -55, 260, 110); ctx.fillStyle = "#1f5a2a"; ctx.font = `400 96px ${FONTS.slab}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("$", 0, 6); } });
      text("₺ → $", 0, 120, { size: 64, align: "center", color: P.green, start: 32.5, dur: 0.3, id: 120 });
    }, "Dolar karşılığı");
    polaroid(1450, 690, -0.03, eBack(seg(T, 33.1, 33.45)), 2131, () => {
      const p = seg(T, 33.3, 34.0);
      ctx.save(); ctx.translate(-80, -10); const sl = [[0.42, P.leaf2], [0.28, P.orange], [0.3, P.blue]]; let a0 = -Math.PI / 2;
      sl.forEach(([f, c]) => { const a1 = a0 + f * Math.PI * 2 * eOut(p); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 90, a0, a1); ctx.closePath(); ctx.fill(); a0 = a1; }); ctx.restore();
      pencil([[30, 100], [70, 50], [110, 70], [160, -10]], seg(T, 33.5, 34.0), { w: 6, c: P.red, id: 2140 });
    }, "Raporlar");
  }
  // F5: Çevrimdışı + şifreli yedek (36.0 – 40.8)
  function f5() {
    featureBg(P.lav, "lav");
    label(110, 120, "İnternetsiz de çalışır", "verilerin şifreli yedeklenir", 36.05, { size: 96 });
    const kp = eBack(seg(T, 36.15, 36.55));
    phone(760, 680 + (1 - kp) * 800, 1.0, -0.06, () => {
      ctx.save(); ctx.translate(0, -60);
      // wifi simgesi
      ctx.strokeStyle = "#7d8794"; ctx.lineWidth = 12; ctx.lineCap = "round";
      [70, 46, 22].forEach(r => { ctx.beginPath(); ctx.arc(0, 30, r, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke(); }); ctx.fillStyle = "#7d8794"; ctx.beginPath(); ctx.arc(0, 30, 8, 0, 7); ctx.fill();
      pencil([[-70, -60], [70, 60]], seg(T, 36.6, 36.8), { w: 10, c: P.red, id: 2201 }); pencil([[70, -60], [-70, 60]], seg(T, 36.75, 36.95), { w: 10, c: P.red, id: 2202 });
      const kk = eBack(seg(T, 37.2, 37.5)); if (kk > 0) { ctx.save(); ctx.translate(0, 170); ctx.scale(kk, kk); ctx.fillStyle = P.leaf; ctx.beginPath(); ctx.roundRect(-110, -40, 220, 80, 16); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = `700 46px ${FONTS.hand}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✓ kaydedildi", 0, 4); ctx.restore(); }
      ctx.restore();
    });
    // bulut + kilit
    const kc = eBack(seg(T, 38.2, 38.6));
    if (kc > 0) {
      ctx.save(); ctx.translate(1380, 470); ctx.scale(kc, kc);
      cloud(0, 0, 1.6, 9, "#ffffff");
      const close = eBack(seg(T, 38.85, 39.05));
      ctx.strokeStyle = "#8a6d1e"; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, -10 - (1 - close) * 30, 40, Math.PI, 0); ctx.lineTo(40, 30 - (1 - close) * 30); ctx.moveTo(-40, -10 - (1 - close) * 30); ctx.lineTo(-40, 10); ctx.stroke();
      cut(tornRect(130, 100, 2210, 2), { y: 50, fill: P.yellow, lift: 0.9, inner: () => { ctx.fillStyle = "#7a5b10"; ctx.beginPath(); ctx.arc(0, -6, 12, 0, 7); ctx.fill(); ctx.fillRect(-5, -4, 10, 26); } });
      ctx.restore();
    }
    const ka = seg(T, 39.25, 39.7);
    if (ka > 0) { ctx.save(); ctx.setLineDash([20, 16]); pencil(linePts(900, 560, 1220, 520, 12, -0.18), ka, { w: 6, id: 2220, passes: 1 }); ctx.restore(); if (ka >= 1) pencil([[1190, 490], [1225, 520], [1185, 552]], 1, { w: 6, id: 2221 }); }
  }
  // F6: Telefon + bilgisayar (40.8 – 43.2)
  function f6() {
    featureBg(P.bone, "bone");
    text("Telefonda da, bilgisayarda da.", 960, 170, { size: 104, start: 40.95, dur: 0.8, align: "center", color: P.green, stroke: "#fbf6ea", strokeW: 12, id: 130 });
    const kl = eBack(seg(T, 40.95, 41.35)), kp = eBack(seg(T, 41.3, 41.7)), p = seg(T, 41.4, 42.4);
    laptop(1150, 660 + (1 - kl) * 800, 1.0, 0.02, () => miniDash(560, 340, p, true));
    phone(520, 640 + (1 - kp) * 800, 0.92, -0.08, () => miniDash(250, 460, p, false));
    const sp = seg(T, 41.6, 42.0);
    if (sp > 0) { ctx.save(); ctx.translate(800, 560); ctx.rotate(T * 2.5); ctx.scale(eBack(sp), eBack(sp)); pencil(ellipsePts(0, 0, 60, 60, 0.42, 0), 1, { w: 7, c: P.leaf, id: 2301 }); pencil(ellipsePts(0, 0, 60, 60, 0.42, Math.PI), 1, { w: 7, c: P.leaf, id: 2302 }); ctx.restore(); }
  }
  // S6: Rahat bahçe (43.2 – 48.0) — Fındık çayını yudumluyor
  function teaGlass(x, y, s, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    // ince belli çay bardağı
    const g = cached("tea", () => { const a = []; for (let i = 0; i <= 20; i++) { const t = i / 20, yy = -60 + t * 120, w = 34 - 14 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + (t > 0.85 ? 4 : 0); a.push([w, yy]); } for (let i = 20; i >= 0; i--) { const t = i / 20, yy = -60 + t * 120, w = 34 - 14 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + (t > 0.85 ? 4 : 0); a.push([-w, yy]); } return a; });
    cut(g, { fill: "rgba(255,255,255,0.75)", lift: 0.8, edgeW: 4, tex: 0.2, inner: () => { ctx.fillStyle = "#b8361f"; ctx.fillRect(-40, -38, 80, 100); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-18, -34, 7, 80); } });
    cut(tornCircle(52, 2601, 2, 12), { y: 68, fill: "#f7f1e3", lift: 0.6, edgeW: 3, inner: () => { ctx.strokeStyle = P.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 40, 7, 0, 0, 7); ctx.stroke(); } });
    // buhar
    for (let i = 0; i < 3; i++) { const ph = (T * 0.8 + i / 3) % 1; ctx.globalAlpha = 0.6 * Math.sin(Math.PI * ph); pencil([[-14 + i * 14, -70 - ph * 60], [-6 + i * 14 + Math.sin(T * 3 + i) * 8, -90 - ph * 60], [-14 + i * 14, -110 - ph * 60]], 1, { w: 4, c: "#fff", id: 2610 + i, passes: 1 }); }
    ctx.restore();
  }
  function s6() {
    sceneGarden(null, true);
    const up = eBack(seg(T, 43.35, 43.8));
    const y0 = 1260 - up * 600, sway = Math.sin(T * 1.6) * 0.04;
    mascot({ x: 960, y: y0 + Math.sin(T * 1.6) * 5, s: 1.3, rot: sway, mouth: T > 45.4 ? "grin" : "smile", glasses: true, armL: 0.25, armR: -0.35, waveR: Math.sin(T * 1.2) * 0.05 });
    // sol koltuk altında TİYS defteri, sağ elde çay
    cut(tornRect(150, 190, 2410, 2), { x: 960 - 145, y: y0 + 75, rot: -0.12 + sway, fill: P.green, lift: 1, inner: () => { ctx.fillStyle = P.yellow; ctx.font = `400 46px ${FONTS.slab}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("TİYS", 0, 4); ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 3; ctx.strokeRect(-60, -80, 120, 160); } });
    teaGlass(960 + 190, y0 - 25, 1.0, 0.08 + sway);
    text("Sen bahçene bak,", 960, 205, { size: 120, start: 43.7, dur: 0.9, align: "center", color: P.green, stroke: "#fbf6ea", strokeW: 14, id: 150 });
    const gap = 34, w1 = measure("hesabı", 120), w2 = measure("TİYS", 100, FONTS.slab, 400), w3 = measure("tutsun.", 120), x0 = 960 - (w1 + w2 + w3 + gap * 2 + 40) / 2;
    text("hesabı", x0, 350, { size: 120, start: 44.95, dur: 0.3, color: P.green, stroke: "#fbf6ea", strokeW: 14, id: 151 });
    { const kk = eBack(seg(T, 45.2, 45.5)); if (kk > 0) { ctx.save(); ctx.translate(x0 + w1 + gap + (w2 + 40) / 2, 318); ctx.rotate(-0.04); ctx.scale(kk, kk); cut(tornRect(Math.round(w2 + 40), 130, 2420, 3), { fill: P.yellow, lift: 1 }); ctx.fillStyle = P.green; ctx.font = `400 100px ${FONTS.slab}`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("TİYS", 0, 8); ctx.restore(); } }
    text("tutsun.", x0 + w1 + w2 + 40 + gap * 2, 350, { size: 120, start: 45.4, dur: 0.4, color: P.green, stroke: "#fbf6ea", strokeW: 14, id: 152 });
  }
  // S7: Çağrı (48.0 – 54)
  function s7() {
    bg(P.green, "green");
    ctx.save(); ctx.globalAlpha = 0.08; for (let i = 0; i < 14; i++) { const x = hr(i + 40) * W, y = hr(i + 60) * H; ctx.save(); ctx.translate(x, y + Math.sin(T + i) * 8); ctx.rotate(i); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(0, 0, 40, 46, 0, 0, 7); ctx.fill(); ctx.restore(); } ctx.restore();
    logo(960, 235, 0.68, [48.1, 48.18, 48.26, 48.34]);
    text("Tarım İşletme Yönetim Sistemi", 960, 400, { size: 54, font: FONTS.print, weight: 400, align: "center", color: P.yellow, start: 48.4, dur: 0.6, id: 162 });
    // damga
    const ks = seg(T, 49.0, 49.15), sc = T < 49.0 ? 0 : lerp(2.4, 1, eIn(ks)) + (T > 49.15 ? Math.sin((T - 49.15) * 30) * Math.exp(-(T - 49.15) * 9) * 0.04 : 0);
    { const kp = eBack(seg(T, 48.55, 48.95)); if (kp > 0) { ctx.save(); ctx.translate(960, 600); ctx.rotate(0.015); ctx.scale(kp, kp); cut(tornRect(1060, 250, 2490, 5), { fill: P.paper, lift: 1.5 }); tape(-470, -110, 160, -0.6, 1, 2); tape(470, -112, 160, 0.6, 1, 6); ctx.restore(); } }
    if (T > 49.0) { ctx.save(); ctx.globalAlpha = clamp(ks * 3); stamp(960, 600, sc, -0.05, "7 GÜN ÜCRETSİZ", P.red, 960, 180, 100); ctx.restore(); }
    // dene etiketi
    const kb = eBack(seg(T, 50.35, 50.7));
    if (kb > 0) { ctx.save(); ctx.translate(960, 845); ctx.rotate(0.02); ctx.scale(kb, kb); cut(tornRect(520, 120, 2501, 3.5), { fill: P.yellow, lift: 1.4 }); text("Hemen dene  →", 0, 30, { size: 84, align: "center", color: P.green, id: 160 }); ctx.restore(); }
    text("Telefon · Bilgisayar · Web", 960, 1000, { size: 58, align: "center", color: "rgba(251,246,234,0.85)", start: 50.6, dur: 0.6, id: 161, font: FONTS.print, weight: 400 });
    const up = eBack(seg(T, 48.3, 48.75));
    mascot({ x: 1650, y: 1300 - up * 470, s: 0.9, rot: 0.06, mouth: "grin", armL: -1.1, waveL: Math.sin(T * 9) * 0.25, armR: 0.5, blink: T > 50.5 && T < 50.9 });
    confetti(50.4, 80, 960, 640, 9, 1.4);
    // kapanış kararması
    const fo = seg(T, 53.3, 54); if (fo > 0) { ctx.fillStyle = `rgba(10,30,24,${fo})`; ctx.fillRect(0, 0, W, H); }
  }

  // ================= ANA ÇİZİM =================
  function drawFrame(c, t) {
    ctx = c; T = t; BOIL = Math.floor(t * 12);
    if (!TEX.fiber) buildTextures();
    ctx.save();
    ctx.setTransform(c.canvas.width / W, 0, 0, c.canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // hafif kamera titremesi (stop-motion)
    ctx.translate(W / 2 + jit(9001, 1.2), H / 2 + jit(9002, 1.2)); ctx.rotate(jit(9003, 0.0012)); ctx.scale(1.012, 1.012); ctx.translate(-W / 2, -H / 2);

    if (t < 5.0) s1();
    else if (t < 5.6) { s1(); sheetIn(5.0, 0.55, "l", () => s2(), 11); }
    else if (t < 10.3) s2();
    else if (t < 12.8) cutTransition();
    else if (t < 16.3) sceneReveal();
    else if (t < 16.9) { sceneReveal(); sheetIn(16.3, 0.55, "r", f1, 12); }
    else if (t < 21.1) f1();
    else if (t < 21.7) { f1(); sheetIn(21.1, 0.55, "r", f2, 13); }
    else if (t < 25.9) f2();
    else if (t < 26.5) { f2(); sheetIn(25.9, 0.55, "r", f3, 14); }
    else if (t < 30.7) f3();
    else if (t < 31.3) { f3(); sheetIn(30.7, 0.55, "r", f4, 15); }
    else if (t < 35.5) f4();
    else if (t < 36.1) { f4(); sheetIn(35.5, 0.55, "r", f5, 16); }
    else if (t < 40.3) f5();
    else if (t < 40.9) { f5(); sheetIn(40.3, 0.55, "u", f6, 17); }
    else if (t < 42.7) f6();
    else if (t < 43.3) { f6(); sheetIn(42.7, 0.55, "l", s6, 18); }
    else if (t < 47.5) s6();
    else if (t < 48.1) { s6(); sheetIn(47.5, 0.55, "d", s7, 19); }
    else s7();

    // film greni + hafif ışık oynaması
    ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = 0.08;
    const ox = Math.floor(hr(BOIL) * 256), oy = Math.floor(hr(BOIL + 5) * 256);
    ctx.drawImage(TEX.fiber, -ox, -oy, 1024, 1024); ctx.drawImage(TEX.fiber, 1024 - ox, -oy, 1024, 1024); ctx.drawImage(TEX.fiber, -ox, 1024 - oy, 1024, 1024); ctx.drawImage(TEX.fiber, 1024 - ox, 1024 - oy, 1024, 1024);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    ctx.restore();
  }

  g.TiysAnim = { drawFrame, W, H };
})(typeof window !== "undefined" ? window : globalThis);
