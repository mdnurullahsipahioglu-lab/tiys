/* TİYS tanıtım — müzik + efekt motoru. Tüm enstrümanlar burada, JS ile sentezlenir.
 * renderMix(voBuffers) -> OfflineAudioContext ile tüm şarkıyı + efektleri + seslendirmeyi tek stereo buffer'a basar. */
(function (g) {
  "use strict";
  const { BEAT, BAR, DUR, VO, SFX } = g.TL;
  const SR = 48000;

  // ---------- deterministik rastgele ----------
  let seed = 1234567;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  const noise = () => rnd() * 2 - 1;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- örnek (sample) üreticiler: Float32Array döner ----------
  // Karplus-Strong telli çalgı (kesirli gecikme için allpass ile akortlu)
  function pluck(freq, dur, o = {}) {
    const bright = o.bright ?? 0.6, decay = o.decay ?? 0.996, n = Math.floor(SR * dur);
    const y = new Float32Array(n);
    let L = SR / freq - 0.5, N = Math.floor(L), fr = L - N;
    if (fr < 0.1) { N -= 1; fr += 1; }
    const C = (1 - fr) / (1 + fr);
    let lp = 0;
    for (let i = 0; i < Math.min(N, n); i++) { lp += bright * (noise() - lp); y[i] = lp; }
    let apIn = 0, apOut = 0;
    for (let i = N; i < n; i++) {
      const v = decay * 0.5 * (y[i - N] + (i - N - 1 >= 0 ? y[i - N - 1] : 0));
      const out = C * (v - apOut) + apIn;
      apIn = v; apOut = out; y[i] = out;
    }
    // pena pozisyonu (tarak filtresi) + yumuşak bitiş
    const pk = Math.max(1, Math.floor(N * (o.pick ?? 0.18)));
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) z[i] = y[i] - 0.6 * (i >= pk ? y[i - pk] : 0);
    fadeTail(z, 0.03);
    return norm(z, o.peak ?? 0.9);
  }
  // Metalofon / çan: inharmonik kısmi sesler
  function bell(freq, dur, o = {}) {
    const n = Math.floor(SR * dur), y = new Float32Array(n);
    const parts = o.parts || [[1, 1, 1.4], [2.756, 0.38, 0.5], [5.404, 0.16, 0.22], [8.933, 0.06, 0.1]];
    for (const [r, a, d] of parts) {
      const f = freq * r; if (f > SR / 2.2) continue;
      const w = 2 * Math.PI * f / SR, ph = rnd() * 6.28;
      for (let i = 0; i < n; i++) y[i] += a * Math.sin(w * i + ph) * Math.exp(-i / (SR * d * (o.decay ?? 1)));
    }
    for (let i = 0; i < Math.min(n, 96); i++) y[i] *= i / 96;
    fadeTail(y, 0.05);
    return norm(y, 0.9);
  }
  // Marimba / pizzicato benzeri yumuşak tahta tını
  function mallet(freq, dur, o = {}) {
    const n = Math.floor(SR * dur), y = new Float32Array(n);
    const parts = [[1, 1, 0.42], [3.99, 0.22, 0.09], [10.6, 0.06, 0.03]];
    for (const [r, a, d] of parts) {
      const f = freq * r; if (f > SR / 2.2) continue; const w = 2 * Math.PI * f / SR;
      for (let i = 0; i < n; i++) y[i] += a * Math.sin(w * i) * Math.exp(-i / (SR * d * (o.decay ?? 1)));
    }
    for (let i = 0; i < Math.min(n, 48); i++) y[i] *= i / 48;
    fadeTail(y, 0.03);
    return norm(y, 0.9);
  }
  function kick() {
    const n = Math.floor(SR * 0.45), y = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR, f = 46 + 110 * Math.exp(-t / 0.045);
      ph += 2 * Math.PI * f / SR;
      y[i] = Math.sin(ph) * Math.exp(-t / 0.22) + (t < 0.004 ? noise() * 0.3 * (1 - t / 0.004) : 0);
    }
    return norm(y, 0.95);
  }
  function noiseBuf(dur, env) {
    const n = Math.floor(SR * dur), y = new Float32Array(n);
    for (let i = 0; i < n; i++) y[i] = noise() * env(i / SR);
    return y;
  }
  function clap() {
    return norm(noiseBuf(0.25, t => (t < 0.01 ? 1 : t < 0.02 ? 0.8 * Math.exp(-(t - 0.01) / 0.004) + 0.2 : 0) + (t >= 0.02 ? Math.exp(-(t - 0.02) / 0.06) : 0)), 0.9);
  }
  function shaker() { return norm(noiseBuf(0.09, t => Math.min(1, t / 0.012) * Math.exp(-t / 0.025)), 0.8); }
  function crash() {
    const n = Math.floor(SR * 2.2), y = new Float32Array(n);
    const fs = [205.3, 304.4, 369.6, 522.7, 540, 800];
    for (let i = 0; i < n; i++) {
      const t = i / SR; let s = 0;
      for (const f of fs) s += Math.sign(Math.sin(2 * Math.PI * f * 3.1 * t));
      y[i] = (s * 0.08 + noise() * 0.7) * Math.exp(-t / 0.55) * Math.min(1, t / 0.002);
    }
    return norm(y, 0.8);
  }
  function woodblock(f) {
    const n = Math.floor(SR * 0.12), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] = (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.43 * t)) * Math.exp(-t / 0.018); }
    return norm(y, 0.9);
  }
  // Islık: legato ezgi, vibrato, nefes
  function whistle(notes, o = {}) { // notes: [başlangıç(sn), midi, süre(sn)]
    const end = Math.max(...notes.map(n => n[0] + n[2])) + 0.3, n = Math.floor(SR * end), y = new Float32Array(n);
    let ph = 0, f = mtof(notes[0][1]), lpN = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; let cur = null;
      for (const nt of notes) if (t >= nt[0] && t < nt[0] + nt[2]) cur = nt;
      let a = 0;
      if (cur) {
        const lt = t - cur[0], rt = cur[0] + cur[2] - t;
        a = Math.min(1, lt / 0.04) * Math.min(1, rt / 0.06);
        f += (mtof(cur[1]) - f) * 0.0028;
      }
      const vib = 1 + 0.012 * Math.sin(2 * Math.PI * 5.6 * t) * Math.min(1, (cur ? t - cur[0] : 0) / 0.25);
      ph += 2 * Math.PI * f * vib / SR;
      lpN += 0.2 * (noise() - lpN);
      y[i] = a * (Math.sin(ph) + 0.06 * Math.sin(2 * ph) + 0.05 * lpN);
    }
    // ortalama zarf yumuşatma
    let e = 0; for (let i = 0; i < n; i++) { e += (y[i] - e) * 0.5; y[i] = e; }
    return norm(y, 0.8);
  }
  // Komik trombon "vah vah" (toplamalı testere + parlaklık zarfı)
  function sadTrombone(notes) {
    const end = Math.max(...notes.map(n => n[0] + n[2])) + 0.2, n = Math.floor(SR * end), y = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / SR; let cur = null; for (const nt of notes) if (t >= nt[0] && t < nt[0] + nt[2]) cur = nt;
      if (!cur) continue;
      const lt = t - cur[0], rt = cur[0] + cur[2] - t, last = cur === notes[notes.length - 1];
      const f = mtof(cur[1]) * (1 + (last ? 0.03 * Math.sin(2 * Math.PI * 6 * lt) * Math.min(1, lt / 0.2) : 0)) * (1 - 0.02 * Math.exp(-lt / 0.03));
      ph += 2 * Math.PI * f / SR;
      const env = Math.min(1, lt / 0.03) * Math.min(1, rt / 0.05);
      const bright = 0.25 + 0.75 * Math.sin(Math.min(Math.PI, lt / cur[2] * Math.PI)); // "va-ah" açılıp kapanma
      let s = 0; for (let h = 1; h <= 18; h++) s += Math.sin(h * ph) / h * Math.exp(-h * (1.6 - bright * 1.3) * 0.35);
      y[i] = s * env;
    }
    return norm(y, 0.8);
  }
  function pad(midis, dur) {
    const n = Math.floor(SR * dur), y = new Float32Array(n);
    for (const m of midis) for (const det of [-0.08, 0.08]) {
      const f = mtof(m + det), w = 2 * Math.PI * f / SR, ph = rnd() * 6;
      for (let i = 0; i < n; i++) { const p = w * i + ph; y[i] += Math.sin(p) + 0.25 * Math.sin(2 * p) + 0.1 * Math.sin(3 * p); }
    }
    for (let i = 0; i < n; i++) { const t = i / SR; y[i] *= Math.min(1, t / 0.5) * Math.min(1, (dur - t) / 0.6); }
    return norm(y, 0.7);
  }

  // ---------- efekt sesleri ----------
  function sfxBuf(type, x) {
    x = x || 1;
    switch (type) {
      case "pop": { const n = Math.floor(SR * 0.12), y = new Float32Array(n); let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / SR, f = (300 + 700 * Math.exp(-t / 0.02)) * x; ph += 2 * Math.PI * f / SR; y[i] = Math.sin(ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.002); } return norm(y, 0.9); }
      case "boing": { const n = Math.floor(SR * 0.6), y = new Float32Array(n); let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / SR, f = 180 * x * (1 + 0.5 * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 14 * t)) + 120 * t; ph += 2 * Math.PI * f / SR; y[i] = (Math.sin(ph) + 0.3 * Math.sin(2 * ph)) * Math.exp(-t / 0.18) * Math.min(1, t / 0.004); } return norm(y, 0.8); }
      case "slide": return norm(filt(noiseBuf(0.35, t => Math.sin(Math.PI * Math.min(1, t / 0.35)) ** 2), "bp", 900, 0.8), 0.6);
      case "whoosh": { const y = noiseBuf(0.55, t => Math.sin(Math.PI * t / 0.55) ** 1.5); return norm(sweep(y, 400, 2600, 0.55), 0.8); }
      case "paper": case "flutter": { const d = type === "paper" ? 0.6 : 0.35;
        const y = noiseBuf(d, t => (rnd() < 0.03 ? 1 : 0.18) * Math.sin(Math.PI * t / d)); return norm(filt(y, "hp", 1800, 0.7), 0.6); }
      case "slap": { const y = noiseBuf(0.25, t => Math.exp(-t / 0.03) + (rnd() < 0.02 ? 0.4 : 0) * Math.exp(-t / 0.1)); const b = filt(y, "bp", 1400, 0.6);
        const n = b.length; for (let i = 0; i < n; i++) { const t = i / SR; b[i] += 0.6 * Math.sin(2 * Math.PI * (90 + 60 * Math.exp(-t / 0.02)) * t) * Math.exp(-t / 0.05); } return norm(b, 0.9); }
      case "scribble": { const d = x || 1, y = noiseBuf(d, t => { const m = 0.5 + 0.5 * Math.sin(2 * Math.PI * (9 + 3 * Math.sin(t * 7)) * t); return m * m * Math.min(1, t / 0.05) * Math.min(1, (d - t) / 0.08); });
        return norm(filt(y, "bp", 3800, 1.2), 0.5); }
      case "tick": return norm(filt(noiseBuf(0.05, t => Math.exp(-t / 0.008)), "bp", 4200, 2), 0.7);
      case "snip": { const y = filt(noiseBuf(0.08, t => Math.exp(-t / 0.006)), "hp", 3000, 0.7); for (let i = 0; i < y.length; i++) { const t = i / SR; y[i] += 0.5 * Math.sin(2 * Math.PI * 5200 * t) * Math.exp(-t / 0.01); } return norm(y, 0.9); }
      case "tear": { const y = noiseBuf(0.6, t => (0.5 + (rnd() < 0.08 ? 0.5 : 0)) * Math.min(1, t / 0.02) * Math.exp(-t / 0.25)); return norm(filt(y, "bp", 2400, 0.5), 0.85); }
      case "stamp": { const n = Math.floor(SR * 0.35), y = new Float32Array(n); let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / SR, f = (55 + 85 * Math.exp(-t / 0.03)) * x; ph += 2 * Math.PI * f / SR; y[i] = Math.sin(ph) * Math.exp(-t / 0.09) + noise() * 0.5 * Math.exp(-t / 0.015); }
        return norm(y, 0.95); }
      case "thud": { const n = Math.floor(SR * 0.4), y = new Float32Array(n); let ph = 0;
        for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (48 + 50 * Math.exp(-t / 0.04)) / SR; y[i] = Math.sin(ph) * Math.exp(-t / 0.12) + noise() * 0.25 * Math.exp(-t / 0.03); } return norm(y, 0.95); }
      case "puff": return norm(filt(noiseBuf(0.3, t => Math.min(1, t / 0.03) * Math.exp(-t / 0.08)), "lp", 1200, 0.7), 0.7);
      case "ding": return bell(mtof(96), 1.6, { decay: 1.1 });
      case "ching": { const a = bell(mtof(100), 1.2), b = bell(mtof(105), 1.2), y = new Float32Array(a.length);
        const off = Math.floor(SR * 0.06); for (let i = 0; i < y.length; i++) y[i] = 0.6 * a[i] + 0.5 * (i >= off ? b[i - off] : 0); return norm(y, 0.85); }
      case "click": { const y = filt(noiseBuf(0.06, t => Math.exp(-t / 0.004)), "bp", 2500, 1.5); for (let i = 0; i < y.length; i++) y[i] += 0.4 * Math.sin(2 * Math.PI * 1800 * i / SR) * Math.exp(-i / SR / 0.006); return norm(y, 0.9); }
      case "tape": { const d = 0.45, y = noiseBuf(d, t => { const r = t / d; return (0.25 + 0.75 * r) * (rnd() < 0.15 ? 1 : 0.35) * (r < 0.95 ? 1 : 0); }); return norm(filt(y, "bp", 2000, 0.6), 0.6); }
      case "sparkle": { const n = Math.floor(SR * 1.4), y = new Float32Array(n), ns = [84, 88, 91, 96, 100, 103];
        ns.forEach((m, k) => { const b = bell(mtof(m), 0.9, { decay: 0.6 }), off = Math.floor(SR * 0.055 * k); for (let i = 0; i < b.length && i + off < n; i++) y[i + off] += b[i] * 0.5; }); return norm(y, 0.8); }
    }
    return new Float32Array(1);
  }

  // ---------- yardımcı DSP ----------
  function norm(y, peak) { let m = 0; for (let i = 0; i < y.length; i++) m = Math.max(m, Math.abs(y[i])); if (m > 0) { const k = peak / m; for (let i = 0; i < y.length; i++) y[i] *= k; } return y; }
  function fadeTail(y, sec) { const k = Math.min(y.length, Math.floor(SR * sec)); for (let i = 0; i < k; i++) y[y.length - 1 - i] *= i / k; }
  function biq(type, f, q) { // RBJ biquad katsayıları
    const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }
  function filt(y, type, f, q) {
    const [b0, b1, b2, a1, a2] = biq(type, f, q); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; const o = new Float32Array(y.length);
    for (let i = 0; i < y.length; i++) { const x = y[i], v = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = v; o[i] = v; }
    return o;
  }
  function sweep(y, f0, f1, d) { // zamana göre kayan bant geçiren
    const o = new Float32Array(y.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      if (i % 64 === 0) { const t = i / SR / d, f = f0 * Math.pow(f1 / f0, Math.sin(Math.PI * Math.min(1, t)) ); var K = biq("bp", f, 0.9); }
      const x = y[i], v = K[0] * x + K[1] * x1 + K[2] * x2 - K[3] * y1 - K[4] * y2; x2 = x1; x1 = x; y2 = y1; y1 = v; o[i] = v;
    }
    return o;
  }
  function impulse(ctx, dur, decay) {
    const n = Math.floor(SR * dur), b = ctx.createBuffer(2, n, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / SR; lp += (0.35 + 0.6 * Math.exp(-t / 0.4)) * (noise() - lp); d[i] = lp * Math.exp(-t / decay) * (t < 0.012 ? t / 0.012 : 1); }
    }
    return b;
  }

  // ---------- düzenleme ----------
  const CH = { F: [60, 65, 69, 72], C: [60, 64, 67, 72], Dm: [62, 65, 69, 74], Bb: [62, 65, 70, 74], C7: [58, 64, 67, 72], Gm: [62, 67, 70, 74], A7: [61, 64, 67, 69] };
  const ROOT = { F: 41, C: 36, Dm: 38, Bb: 34, C7: 36, Gm: 43, A7: 45 };
  const PROG = ["F", "C", "Dm", "Bb"];
  // 4 ölçülük ana tema: [vuruş, midi, süre(vuruş)]
  const THEME = [
    [[0, 69, .5], [.5, 72, .5], [1, 77, .75], [2, 76, .5], [2.5, 74, .5], [3, 72, 1]],
    [[0, 67, .5], [.5, 72, .5], [1, 76, .75], [2, 74, .5], [2.5, 72, .5], [3, 67, 1]],
    [[0, 69, .5], [.5, 74, .5], [1, 77, .5], [1.5, 76, .5], [2, 74, .5], [2.5, 72, .5], [3, 69, 1]],
    [[0, 70, .5], [.5, 74, .5], [1, 72, .5], [1.5, 70, .5], [2, 69, 1], [3, 67, .5], [3.5, 72, .5]]
  ];
  const THEME_B = [ // varyasyon (son ölçü toniğe iner)
    [[0, 72, .5], [.5, 77, .5], [1, 81, .75], [2, 79, .5], [2.5, 77, .5], [3, 76, 1]],
    [[0, 76, .5], [.5, 72, .5], [1, 79, .75], [2, 77, .5], [2.5, 76, .5], [3, 72, 1]],
    [[0, 74, .5], [.5, 77, .5], [1, 81, .5], [1.5, 79, .5], [2, 77, .5], [2.5, 74, .5], [3, 72, 1]],
    [[0, 74, .5], [.5, 72, .5], [1, 70, .5], [1.5, 69, .5], [2, 67, .5], [2.5, 69, .5], [3, 72, 1]]
  ];
  const WHISTLE = [ // ölçü başına [vuruş, midi, süre]
    [[0, 72, 1], [1, 69, .5], [1.5, 72, .5], [2, 77, 1.8]],
    [[0, 76, 1], [1, 74, .5], [1.5, 72, .5], [2, 67, 1.8]],
    [[0, 69, 1], [1, 74, 1], [2, 77, 1], [3, 76, .9]],
    [[0, 74, 1.5], [1.5, 72, .5], [2, 70, 1], [3, 69, .9]]
  ];

  async function renderMix(voBuffers, opts = {}) {
    seed = 1234567;
    const ctx = new OfflineAudioContext(2, Math.ceil(SR * DUR), SR);
    const master = ctx.createGain(); master.gain.value = 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.18;
    master.connect(comp); comp.connect(ctx.destination);

    const music = ctx.createGain(); music.gain.value = opts.noMusic ? 0 : 1; music.connect(master);
    const sfx = ctx.createGain(); sfx.gain.value = opts.noSfx ? 0 : 0.9; sfx.connect(master);
    const vo = ctx.createGain(); vo.gain.value = opts.noVo ? 0 : 1.0;
    // VO kanalı: hafif oda + doğrudan
    vo.connect(master);
    const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 2.6, 0.7);
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut); verbOut.connect(music);
    const roomVO = ctx.createConvolver(); roomVO.buffer = impulse(ctx, 0.6, 0.12);
    const roomG = ctx.createGain(); roomG.gain.value = 0.07; vo.connect(roomVO); roomVO.connect(roomG); roomG.connect(master);
    // müzik "body" EQ
    const mLow = ctx.createBiquadFilter(); mLow.type = "highpass"; mLow.frequency.value = 35;
    const mDip = ctx.createBiquadFilter(); mDip.type = "peaking"; mDip.frequency.value = 2500; mDip.Q.value = 0.8; mDip.gain.value = -2.5; // VO'ya yer aç
    mLow.connect(mDip); mDip.connect(music);
    const mus = mLow;

    // seslendirme altında müziği kıs (ducking)
    const DUCK = 0.5;
    const mg = music.gain;
    if (!opts.noMusic) {
      mg.setValueAtTime(1, 0);
      for (const [id, st] of VO) {
        const b = voBuffers && voBuffers[id]; if (!b) continue;
        const en = st + b.duration;
        mg.setTargetAtTime(DUCK, st - 0.12, 0.06);
        mg.setTargetAtTime(1, en + 0.05, 0.18);
      }
    }

    const cache = new Map();
    function buf(key, fn) {
      if (!cache.has(key)) { const d = fn(); const b = ctx.createBuffer(1, d.length, SR); b.copyToChannel(d, 0); cache.set(key, b); }
      return cache.get(key);
    }
    function play(b, t, gain, pan, dest, send, rate, filt) {
      if (t < 0 || t > DUR) return;
      const s = ctx.createBufferSource(); s.buffer = b; if (rate) s.playbackRate.value = rate;
      const gn = ctx.createGain(); gn.gain.value = gain;
      const p = ctx.createStereoPanner(); p.pan.value = pan || 0;
      let head = s;
      if (filt) { const f = ctx.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; f.Q.value = filt[2] || 0.7; s.connect(f); head = f; }
      head.connect(gn); gn.connect(p); p.connect(dest);
      if (send) { const sg = ctx.createGain(); sg.gain.value = send; p.connect(sg); sg.connect(verb); }
      s.start(t);
    }
    const B = (bar, beat) => bar * BAR + beat * BEAT;

    // enstrüman çağrıları
    const uke = (m, t, g, pan) => play(buf("u" + m, () => pluck(mtof(m), 1.6, { bright: 0.55, decay: 0.993, pick: 0.2 })), t, g, pan, mus, 0.18, 0, ["lowpass", 5200, 0.6]);
    const strum = (ch, t, g, down = true) => { const ns = down ? CH[ch] : [...CH[ch]].reverse(); ns.forEach((m, i) => uke(m, t + i * 0.011, g * (1 - i * 0.07), -0.25 + i * 0.12)); };
    const bass = (m, t, g, d = 0.9) => play(buf("b" + m + d, () => { const y = pluck(mtof(m), d, { bright: 0.28, decay: 0.998, pick: 0.35 }); const n = y.length, w = 2 * Math.PI * mtof(m) / SR; for (let i = 0; i < n; i++) y[i] = y[i] * 0.7 + 0.5 * Math.sin(w * i) * Math.exp(-i / SR / 0.5) * Math.min(1, i / 200); fadeTail(y, 0.06); return norm(y, 0.9); }), t, g, 0, mus, 0.03, 0, ["lowpass", 1400, 0.7]);
    const glock = (m, t, g, pan = 0.15) => play(buf("g" + m, () => bell(mtof(m), 2.2)), t, g, pan, mus, 0.35);
    const mar = (m, t, g, pan = 0) => play(buf("m" + m, () => mallet(mtof(m), 0.7)), t, g, pan, mus, 0.2);
    const K = (t, g = 0.75) => play(buf("kick", kick), t, g, 0, mus, 0.02);
    const CL = (t, g = 0.32) => play(buf("clap", clap), t, g, 0.05, mus, 0.25, 0, ["bandpass", 1300, 0.8]);
    const SH = (t, g = 0.11) => play(buf("sh", shaker), t, g, 0.35, mus, 0.05, 0, ["highpass", 6000, 0.7]);
    const WB = (t, g = 0.25, f = 1100, pan = -0.3) => play(buf("wb" + f, () => woodblock(f)), t, g, pan, mus, 0.15);
    const CR = (t, g = 0.16) => play(buf("crash", crash), t, g, -0.2, mus, 0.25, 0, ["highpass", 3500, 0.7]);
    const PAD = (ch, t, d, g = 0.08) => play(buf("pad" + ch + d, () => pad(CH[ch].map(m => m - 12).concat([CH[ch][1]]), d)), t, g, 0, mus, 0.5, 0, ["lowpass", 1800, 0.6]);

    // ---------- 0–4.8 İntro: F | C — parmakla çalınan uke + metalofon ----------
    for (let bar = 0; bar < 2; bar++) {
      const ch = bar === 0 ? "F" : "C", ns = CH[ch];
      [0, 2, 1, 3, 0, 2, 1, 3].forEach((k, i) => uke(ns[k] + (i % 4 === 3 ? 12 : 0), B(bar, i * 0.5), 0.2, -0.2 + k * 0.12));
      bass(ROOT[ch] + 12, B(bar, 0), 0.32, 1.2);
      THEME[bar].forEach(([b, m, d]) => glock(m + 12, B(bar, b), 0.13));
      PAD(ch, B(bar, 0), BAR + 0.3, 0.05);
    }
    // ---------- 4.8–9.6 Kaos: Dm | Bb — haylaz marimba + tahta blok ----------
    play(buf("trom", () => sadTrombone([[0, 58, .2], [.22, 57, .2], [.44, 56, .2], [.66, 55, .75]])), B(2, 0) - 0.05, 0.28, 0.1, mus, 0.25);
    for (let bar = 2; bar < 4; bar++) {
      const ch = bar === 2 ? "Dm" : "Bb", ns = CH[ch];
      for (let i = 0; i < 8; i++) {
        const k = [0, 1, 2, 3, 2, 1, 0, 2][i];
        mar(ns[k] + 12, B(bar, i * 0.5), i % 2 ? 0.16 : 0.24, (i % 2 ? 0.3 : -0.3));
        if (i % 2 === 1) WB(B(bar, i * 0.5), 0.12, i % 4 === 1 ? 1100 : 1500);
      }
      for (let i = 0; i < 16; i++) SH(B(bar, i * 0.25), i % 2 ? 0.05 : 0.08);
      [0, 1, 2, 3].forEach(q => bass(ROOT[ch] + (q === 2 ? 7 : 0) + 12, B(bar, q), q % 2 ? 0.22 : 0.3, 0.35));
    }
    // ---------- 9.6–12.0 Gerilim: C7 — tik-tak + yükselen arpej, 11.85'te sus ----------
    {
      const bar = 4;
      for (let i = 0; i < 7; i++) WB(B(bar, i * 0.5), 0.2, i % 2 ? 1800 : 1250, i % 2 ? 0.4 : -0.4);
      [58, 64, 67, 72, 76, 79, 84].forEach((m, i) => mar(m, B(bar, i * 0.47), 0.12 + i * 0.02, -0.3 + i * 0.1));
      bass(36, B(bar, 0), 0.3, 1.5);
      PAD("C7", B(bar, 0), 2.2, 0.06);
      // yükselen gürültü (riser)
      play(buf("riser", () => { const d = 1.2, y = noiseBuf(d, t => (t / d) ** 2.2); return norm(sweep(y, 500, 5000, d * 2), 0.7); }), 10.65, 0.22, 0, mus, 0.3);
    }
    // ---------- 12.0–43.2 Ana groove: F C Dm Bb ----------
    for (let bar = 5; bar < 18; bar++) {
      const ch = PROG[(bar - 5) % 4], ns = CH[ch], t0 = B(bar, 0);
      const last = bar === 17;
      // davul
      if (!last || true) {
        K(B(bar, 0)); K(B(bar, 2), 0.65); if ((bar - 5) % 2 === 1) K(B(bar, 3.5), 0.45);
        CL(B(bar, 1)); CL(B(bar, 3));
        for (let i = 0; i < 8; i++) SH(B(bar, i * 0.5 + 0.25), 0.09), SH(B(bar, i * 0.5), 0.06);
      }
      // uke ritmi: D . D U . U D U
      [[0, 1, 1], [1, 1, .8], [1.5, 0, .6], [2.5, 0, .6], [3, 1, .85], [3.5, 0, .6]].forEach(([b, dn, a]) => strum(ch, B(bar, b), 0.17 * a, !!dn));
      // bas
      bass(ROOT[ch], B(bar, 0), 0.5, 0.55); bass(ROOT[ch] + 7, B(bar, 1.5), 0.36, 0.4); bass(ROOT[ch] + 12, B(bar, 2), 0.4, 0.45);
      const nextR = ROOT[PROG[(bar - 4) % 4]]; bass(nextR + (nextR > ROOT[ch] ? -1 : 1), B(bar, 3.5), 0.3, 0.3);
      // ezgi: 5-8 tema, 9-12 ıslık, 13-16 tema-B, 17 sus
      const k = (bar - 5) % 4;
      if (bar >= 5 && bar <= 8) THEME[k].forEach(([b, m, d]) => glock(m + 12, B(bar, b), 0.16));
      if (bar >= 9 && bar <= 12) { WHISTLE[k].forEach(([b, m, d]) => {}); }
      if (bar >= 13 && bar <= 16) THEME_B[k].forEach(([b, m, d]) => glock(m, B(bar, b), 0.17, -0.1));
      if (bar >= 9 && bar <= 12) THEME[k].forEach(([b, m, d], i) => { if (i % 2 === 0) mar(m, B(bar, b), 0.09, 0.25); });
      PAD(ch, t0, BAR + 0.2, 0.045);
      // bölüm geçiş dolgusu (her özellik sahnesi bitmeden)
      if ((bar - 5) % 2 === 1 || bar === 17) { WB(B(bar, 3.5), 0.18, 1500); WB(B(bar, 3.667), 0.16, 1250); WB(B(bar, 3.833), 0.2, 1100); }
    }
    // ıslık ezgisi (9-12 ölçüler, 21.6–31.2)
    {
      const notes = []; for (let k = 0; k < 4; k++) WHISTLE[k].forEach(([b, m, d]) => notes.push([k * BAR + b * BEAT, m + 12, d * BEAT]));
      play(buf("whA", () => whistle(notes)), B(9, 0), 0.1, 0.2, mus, 0.4);
    }
    CR(B(5, 0), 0.22); CR(B(13, 0), 0.12);
    // büyük açılış vuruşu
    strum("F", B(5, 0), 0.3); K(B(5, 0), 0.95); glock(89, B(5, 0), 0.12); glock(84, B(5, 0.25), 0.1); glock(81, B(5, 0.5), 0.1);
    // ---------- 43.2–48.0 Sakin bölüm: Bb | C ----------
    for (let bar = 18; bar < 20; bar++) {
      const ch = bar === 18 ? "Bb" : "C", ns = CH[ch];
      [0, 2, 1, 3, 0, 2, 3, 1].forEach((k, i) => uke(ns[k] + (i === 3 || i === 6 ? 12 : 0), B(bar, i * 0.5), 0.17, -0.2 + k * 0.12));
      bass(ROOT[ch] + 12, B(bar, 0), 0.34, 1.6); bass(ROOT[ch] + 12, B(bar, 2), 0.24, 1.2);
      PAD(ch, B(bar, 0), BAR + 0.4, 0.075);
      for (let i = 0; i < 8; i++) SH(B(bar, i * 0.5 + 0.25), 0.045);
    }
    play(buf("whB", () => whistle([[0, 86, BEAT * .9], [BEAT, 84, BEAT * .9], [BEAT * 2, 82, BEAT * .9], [BEAT * 3, 81, BEAT * .9], [BAR, 79, BEAT * .9], [BAR + BEAT, 81, BEAT * .9], [BAR + BEAT * 2, 82, BEAT * .9], [BAR + BEAT * 3, 84, BEAT * 0.9]])), B(18, 0), 0.08, 0.2, mus, 0.45);
    // yükseliş + trampet rulosu
    for (let i = 0; i < 8; i++) CL(B(19, 2 + i * 0.25), 0.06 + i * 0.03);
    play(buf("riser2", () => { const d = 1.3, y = noiseBuf(d, t => (t / d) ** 2); return norm(sweep(y, 600, 6000, d * 2), 0.7); }), B(19, 2) - 0.1, 0.18, 0, mus, 0.3);
    // ---------- 48.0–50.4 Final: F | Bb C, 50.4 son akor ----------
    {
      const bar = 20;
      CR(B(bar, 0), 0.22); K(B(bar, 0), 0.9); K(B(bar, 1), 0.6); K(B(bar, 2), 0.7); K(B(bar, 3), 0.6);
      CL(B(bar, 1)); CL(B(bar, 3)); for (let i = 0; i < 8; i++) SH(B(bar, i * 0.5 + 0.25), 0.09);
      [[0, "F", 1], [1, "F", .8], [1.5, "F", .6], [2, "Bb", 1], [2.5, "Bb", .6], [3, "C", 1], [3.5, "C", .7]].forEach(([b, ch, a]) => strum(ch, B(bar, b), 0.18 * a, true));
      bass(41, B(bar, 0), 0.5, 0.5); bass(41 + 12, B(bar, 1), 0.36, 0.4); bass(34, B(bar, 2), 0.48, 0.5); bass(36, B(bar, 3), 0.48, 0.5);
      THEME_B[3].forEach(([b, m]) => glock(m, B(bar, b), 0.15));
      // son akor
      const tf = B(21, 0);
      strum("F", tf, 0.32); strum("F", tf + 0.09, 0.18, false); bass(29 + 12, tf, 0.55, 3.2); K(tf, 0.95); CR(tf, 0.26);
      PAD("F", tf, 3.4, 0.09);
      [77, 81, 84, 89].forEach((m, i) => glock(m + 12, tf + 0.08 * i, 0.13));
    }

    // ---------- efektler ----------
    for (const [t, type, gn, x] of SFX) {
      const key = "sfx" + type + (x || "");
      const b = buf(key, () => sfxBuf(type, type === "scribble" ? x : x));
      play(b, t, gn, (rnd() - 0.5) * 0.5, sfx, type === "ding" || type === "sparkle" || type === "boing" ? 0.25 : 0.06);
    }
    // ---------- seslendirme ----------
    if (voBuffers) for (const [id, st] of VO) { const b = voBuffers[id]; if (!b) continue; const s = ctx.createBufferSource(); s.buffer = b; s.connect(vo); s.start(st); }

    const out = await ctx.startRendering();
    // tepe normalizasyonu -1 dBFS
    let m = 0; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); }
    const k = m > 0 ? 0.89 / m : 1; for (let c = 0; c < 2; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
    // son 0.4 sn yumuşak kapanış
    for (let c = 0; c < 2; c++) { const d = out.getChannelData(c), n = Math.floor(SR * 0.4); for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n; }
    return out;
  }

  function toWav(ab) {
    const ch = ab.numberOfChannels, n = ab.length, buf = new ArrayBuffer(44 + n * ch * 2), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * ch * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, ch, true); v.setUint32(24, ab.sampleRate, true); v.setUint32(28, ab.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(ab.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
    return buf;
  }

  g.TiysAudio = { renderMix, toWav, SR };
})(typeof window !== "undefined" ? window : globalThis);
