/* TİYS tanıtım — ortak zaman çizelgesi (ses + görüntü aynı tablodan beslenir) */
(function (g) {
  "use strict";
  const BPM = 100, BEAT = 60 / BPM, BAR = BEAT * 4;
  const DUR = 54;

  // Seslendirme: [id, başlangıç sn, ekranda gösterilecek metin]
  const VO = [
    ["l01", 1.0, "Fındık bahçesi... güzel şey."],
    ["l02", 2.9, "Ama hesabı? Biraz karışık."],
    ["l03", 5.5, "Mazot fişi cepte, işçi hesabı defterde, hasat kilosu da aklında."],
    ["l04", 9.8, "Peki, hepsi tek bir yerde olsa?"],
    ["l05", 12.5, "Tanışın: TİYS! Tarım İşletme Yönetim Sistemi."],
    ["l06", 17.1, "Kim kaç gün çalıştı, kime ne kadar ödendi... hepsi kayıtlı."],
    ["l07", 21.9, "Her gideri, her geliri, tarla tarla gör."],
    ["l08", 26.7, "Tarlanı haritada işaretle, hasadını kilosuyla kaydet."],
    ["l09", 31.5, "Hava durumu, dolar kuru, raporlar... hepsi bir bakışta."],
    ["l10", 36.2, "İnternet olmasa bile çalışır. Verilerin şifrelenip güvenle yedeklenir."],
    ["l11", 41.0, "Telefonda da, bilgisayarda da."],
    ["l12", 43.7, "Sen bahçene bak. Hesabı TİYS tutsun."],
    ["l13", 48.6, "7 gün ücretsiz dene!"]
  ];

  // Efektler: [zaman, tür, kazanç, ek]
  const SFX = [
    [0.02, "paper", 0.5], [0.05, "slide", 0.35], [0.2, "slide", 0.3], [0.35, "slide", 0.3],
    [0.45, "pop", 0.35, 1.3],
    [0.7, "pop", 0.22, 0.9], [0.85, "pop", 0.22, 1.1], [1.0, "boing", 0.45], [1.15, "pop", 0.22, 1.0], [1.35, "pop", 0.2, 1.2],
    [1.1, "scribble", 0.28, 1.3], [3.0, "scribble", 0.28, 0.9],
    [3.65, "pop", 0.3, 1.4], [3.95, "pop", 0.3, 1.6],
    [4.35, "flutter", 0.35], [4.65, "flutter", 0.3],
    [5.0, "whoosh", 0.4],
    [5.5, "slap", 0.55], [6.8, "slap", 0.55], [8.15, "puff", 0.45],
    [8.6, "flutter", 0.3], [8.9, "flutter", 0.3], [9.2, "flutter", 0.32], [9.45, "pop", 0.25, 0.8],
    [10.35, "ding", 0.45],
    [11.0, "scribble", 0.3, 0.6],
    [11.62, "snip", 0.55], [11.74, "snip", 0.5], [11.86, "snip", 0.55], [11.97, "snip", 0.6],
    [12.0, "tear", 0.55],
    [12.3, "boing", 0.4],
    [12.95, "stamp", 0.45, 1.2], [13.08, "stamp", 0.45, 1.1], [13.21, "stamp", 0.45, 1.25], [13.34, "stamp", 0.5, 0.95],
    [12.95, "sparkle", 0.35],
    [13.7, "tape", 0.35],
    [16.3, "whoosh", 0.4],
    [17.3, "tick", 0.3], [17.45, "tick", 0.3], [17.6, "tick", 0.3], [17.75, "tick", 0.3], [17.9, "tick", 0.3], [18.05, "tick", 0.3], [18.2, "tick", 0.3], [18.35, "tick", 0.3],
    [18.6, "stamp", 0.5, 1.0], [19.8, "pop", 0.35, 1.3],
    [21.1, "whoosh", 0.4],
    [21.95, "whoosh", 0.3], [22.25, "slap", 0.35], [22.6, "ching", 0.4],
    [23.3, "slide", 0.35], [23.5, "pop", 0.22, 0.9], [23.75, "pop", 0.22, 1.0], [24.0, "pop", 0.22, 1.1], [24.25, "pop", 0.22, 1.2],
    [25.9, "whoosh", 0.4],
    [26.8, "pop", 0.22, 0.8], [27.0, "pop", 0.22, 0.9], [27.2, "pop", 0.22, 1.0], [27.4, "pop", 0.22, 1.1],
    [27.6, "pop", 0.32, 1.5], [27.8, "pop", 0.32, 1.6], [28.0, "pop", 0.32, 1.7],
    [28.7, "thud", 0.55], [29.2, "boing", 0.3],
    [30.7, "whoosh", 0.4],
    [31.5, "tape", 0.3], [32.3, "tape", 0.3], [33.15, "tape", 0.3], [33.6, "sparkle", 0.25],
    [35.5, "whoosh", 0.4],
    [36.6, "pop", 0.3, 0.7], [37.25, "ding", 0.35], [38.9, "click", 0.5], [39.3, "whoosh", 0.3],
    [40.3, "whoosh", 0.4],
    [41.0, "pop", 0.3, 1.0], [41.35, "pop", 0.3, 1.2],
    [42.7, "whoosh", 0.4],
    [43.7, "scribble", 0.25, 0.9], [44.95, "scribble", 0.25, 1.1],
    [47.5, "whoosh", 0.45],
    [48.1, "slide", 0.4],
    [49.15, "stamp", 0.7, 0.8],
    [50.4, "sparkle", 0.4], [50.45, "boing", 0.35]
  ];

  g.TL = { BPM, BEAT, BAR, DUR, VO, SFX };
})(typeof window !== "undefined" ? window : globalThis);
