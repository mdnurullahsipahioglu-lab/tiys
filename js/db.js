/* TİYS — Tarım İşletme Yönetim Sistemi
 * Veri katmanı: localStorage tabanlı, offline çalışır, JSON yedek al/yükle.
 * Tüm modüller bu katman üzerinden okur/yazar.
 */
(function (global) {
  "use strict";
  const KEY = "fiys_db_v1";

  // ---- Türkçe biçimlendiriciler -------------------------------------------
  const TL = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
  const NUM = new Intl.NumberFormat("tr-TR");
  function money(n) { return TL.format(Number(n) || 0); }
  function num(n) { return NUM.format(Number(n) || 0); }
  // gg/aa/yyyy
  function dateTR(d) {
    const x = (d instanceof Date) ? d : new Date(d);
    if (isNaN(x)) return "—";
    const p = (v) => String(v).padStart(2, "0");
    return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
  }
  // gg/aa/yyyy & 00.00  (saat ayıracı NOKTA — spec gereği)
  function dateTimeTR(d) {
    const x = (d instanceof Date) ? d : new Date(d);
    if (isNaN(x)) return "—";
    const p = (v) => String(v).padStart(2, "0");
    return `${dateTR(x)} ${p(x.getHours())}.${p(x.getMinutes())}`;
  }
  function uid() { return "id" + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }

  // ---- ÜRÜN KAYIT DEFTERİ (çoklu ürün desteği) ----------------------------
  const URUNLER = {
    findik:    { ad: "Fındık", emoji: "🌰", cesitler: ["Tombul", "Palaz", "Çakıldak", "Foşa", "Mincane", "Sivri", "Diğer"], birim: "kg", defaultFiyat: 250, hasatAy: 8 },
    zeytin:    { ad: "Zeytin", emoji: "🫒", cesitler: ["Gemlik", "Ayvalık", "Memecik", "Domat", "Çelebi", "Diğer"], birim: "kg", defaultFiyat: 40, hasatAy: 11 },
    ceviz:     { ad: "Ceviz", emoji: "🥥", cesitler: ["Chandler", "Fernor", "Franquette", "Şebin", "Bilecik", "Diğer"], birim: "kg", defaultFiyat: 130, hasatAy: 9 },
    narenciye: { ad: "Narenciye", emoji: "🍊", cesitler: ["Portakal", "Mandalina", "Limon", "Greyfurt", "Diğer"], birim: "kg", defaultFiyat: 18, hasatAy: 12 },
    uzum:      { ad: "Üzüm", emoji: "🍇", cesitler: ["Sultani", "Razakı", "Öküzgözü", "Boğazkere", "Kalecik", "Diğer"], birim: "kg", defaultFiyat: 30, hasatAy: 9 },
    tibbi:     { ad: "Tıbbi-Aromatik", emoji: "🌿", cesitler: ["Lavanta", "Kekik", "Adaçayı", "Nane", "Rezene", "Diğer"], birim: "kg", defaultFiyat: 90, hasatAy: 7 },
    diger:     { ad: "Diğer", emoji: "🌱", cesitler: ["Diğer"], birim: "kg", defaultFiyat: 0, hasatAy: 9 }
  };
  function urun(key) { return URUNLER[key] || URUNLER.findik; }
  // Yıl-bazlı değer: v tek sayı (eski format → her yıla aynı) ya da {yil:deger}. En yakın (tercihen ≤yil) değeri döndür.
  function yilDeger(v, yil) {
    if (v == null) return null;
    if (typeof v !== "object") return v;
    const ks = Object.keys(v).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (!ks.length) return null;
    const alt = ks.filter(k => k <= yil);
    return v[String(alt.length ? alt[alt.length - 1] : ks[0])];
  }
  function urunFiyat(key, yil) { const a = (_data && _data.ayarlar) || {}; const v = yilDeger(a.urunFiyat ? a.urunFiyat[key] : null, yil || new Date().getFullYear()); return v != null ? v : urun(key).defaultFiyat; }
  // Tek-değeri (eski format) objeye çevirirken eski değeri EN ESKİ veri yılına baz olarak taşı (geçmiş korunur)
  function objeYap(c) { if (typeof c === "object" && c != null) return c; const o = {}; if (typeof c === "number") { const y = yillar(); o[String(y[y.length - 1])] = c; } return o; }
  function setUrunFiyat(key, yil, val) { const a = load().ayarlar; a.urunFiyat = a.urunFiyat || {}; const c = objeYap(a.urunFiyat[key]); c[String(yil)] = Number(val) || 0; a.urunFiyat[key] = c; save(); }
  // Sabit fiyat (gubreFiyat/mazotFiyat...) — yıla göre oku/yaz
  function sabitFiyat(alan, yil) { return yilDeger((load().ayarlar || {})[alan], yil || new Date().getFullYear()) || 0; }
  function setSabitFiyat(alan, yil, val) { const a = load().ayarlar; const c = objeYap(a[alan]); c[String(yil)] = Number(val) || 0; a[alan] = c; save(); }
  // Veride geçen yıllar (büyükten küçüğe)
  function yillar() { const s = new Set(); ["gelirler", "giderler", "hasatlar", "isciKiralamalar", "isTakip"].forEach(c => coll(c).forEach(x => { const y = x.tarih ? new Date(x.tarih).getFullYear() : 0; if (y > 1990 && y < 2100) s.add(y); })); if (!s.size) s.add(new Date().getFullYear()); return [...s].sort((a, b) => b - a); }
  function aktifUrunler() { const s = new Set(coll("tarlalar").map(t => t.urun || "findik")); return [...s]; }
  function urunOptions() { return Object.keys(URUNLER).map(k => ({ v: k, l: URUNLER[k].emoji + " " + URUNLER[k].ad })); }

  // ---- Depolama ------------------------------------------------------------
  let _data = null;
  // Masaüstü (Electron) sürümde veri dosyası kullanılıyor mu?
  function dosyaModu() { return !!(global.tiysFS && global.tiysFS.read && global.tiysFS.write); }
  function load() {
    if (_data) return _data;
    // Masaüstü: veri Belgeler/TIYS/veri.json'da — kurulum/güncelleme/silmeden ETKİLENMEZ
    if (dosyaModu()) {
      try {
        const raw = global.tiysFS.read();
        if (raw) { _data = JSON.parse(raw); migrate(_data); return _data; }
        // dosya yok → eski localStorage verisini taşı (varsa), yoksa demo başlat
        let ls = null; try { ls = localStorage.getItem(KEY); } catch (e) {}
        _data = ls ? JSON.parse(ls) : seed();
        save(); // ilk yazımda dosyaya kaydet
        migrate(_data); return _data;
      } catch (e) { /* dosya hatası → localStorage'a düş */ }
    }
    try {
      const raw = localStorage.getItem(KEY);
      _data = raw ? JSON.parse(raw) : seed();
    } catch (e) { _data = seed(); }
    if (!localStorage.getItem(KEY)) save();
    migrate(_data); return _data;
  }
  function save() {
    const s = JSON.stringify(_data);
    try { localStorage.setItem(KEY, s); } catch (e) {}
    if (dosyaModu()) { try { global.tiysFS.write(s); } catch (e) {} }
    try { global.dispatchEvent(new CustomEvent("tiys:save")); } catch (e) {}
  }
  function reset() { _data = seed(); save(); return _data; }

  // ---- Otomatik veri onarımı (eski Excel import'larından gelen bozuk veriyi düzeltir) ----
  function migrate(d) {
    if (!d) return;
    let degisti = false;
    // 1) Excel seri-numarası tarihleri (ör. 42797) → gerçek tarih (YYYY-MM-DD). Her açılışta güvenli/idempotent.
    (d.giderler || []).concat(d.gelirler || []).forEach(x => {
      if (typeof x.tarih === "number" && x.tarih > 20000 && x.tarih < 90000) {
        x.tarih = new Date(Math.round((x.tarih - 25569) * 86400000)).toISOString().slice(0, 10);
        degisti = true;
      }
    });
    // 2) Kategorisiz giderler hiçbir sayfada görünmüyor → "genel" kategori + altKategori ata
    (d.giderler || []).forEach(x => {
      if (!x.kategori) {
        x.kategori = "genel";
        const t = (x.tur || "").toLowerCase();
        x.altKategori = /g[üu]bre/.test(t) ? "gubre"
          : /i[şs]çi|isci|t[ıi]rpan|temizli|toplama|budama|dal|kesim|patoz/.test(t) ? "iscilik" : "diger";
        degisti = true;
      }
    });
    // 3) Tek seferlik (V1): kullanıcının kendi gider türlerini ayarlara ekle + hava konumunu tarlalarına çek
    if (d.ayarlar && !(d.meta && d.meta.migrateV1)) {
      const turler = d.ayarlar.giderTurleri || [];
      (d.giderler || []).forEach(x => { if (x.kategori === "genel" && x.tur && turler.indexOf(x.tur) < 0) turler.push(x.tur); });
      if (turler.length) d.ayarlar.giderTurleri = turler;
      const k = d.ayarlar.konum;
      const varsayilan = !k || (Math.abs((k.lat || 0) - 40.985) < 0.002 && Math.abs((k.lng || 0) - 36.742) < 0.002);
      const ts = (d.tarlalar || []).filter(t => t.lat && t.lng);
      if (varsayilan && ts.length) {
        d.ayarlar.konum = { ad: (ts[0].koy || "Tarlalar"), lat: +(ts.reduce((a, t) => a + t.lat, 0) / ts.length).toFixed(5), lng: +(ts.reduce((a, t) => a + t.lng, 0) / ts.length).toFixed(5) };
      }
      if (!d.meta) d.meta = {};
      d.meta.migrateV1 = true;
      degisti = true;
    }
    if (degisti) { try { save(); } catch (e) {} }
  }

  // ---- CRUD yardımcıları ---------------------------------------------------
  function coll(name) { const d = load(); if (!d[name]) d[name] = []; return d[name]; }
  function add(name, obj) { const c = coll(name); obj.id = obj.id || uid(); c.push(obj); save(); return obj; }
  function update(name, id, patch) { const c = coll(name); const i = c.findIndex(x => x.id === id); if (i >= 0) { c[i] = Object.assign({}, c[i], patch); save(); return c[i]; } }
  function remove(name, id) { const d = load(); d[name] = coll(name).filter(x => x.id !== id); save(); }

  // ---- Hesaplamalar (dashboard + raporlar) --------------------------------
  function sum(arr, f) { return arr.reduce((a, x) => a + (Number(f ? f(x) : x) || 0), 0); }
  function yearOf(d) { return new Date(d).getFullYear(); }

  function toplamGelir(yil) { return sum(coll("gelirler").filter(g => !yil || yearOf(g.tarih) === yil), g => g.tutar); }
  function toplamGider(yil) { return sum(coll("giderler").filter(g => !yil || yearOf(g.tarih) === yil), g => g.tutar); }
  function netKar(yil) { return toplamGelir(yil) - toplamGider(yil); }
  function toplamDekar() { return sum(coll("tarlalar"), t => t.alanDekar); }

  function giderDagilimi(yil) {
    const g = coll("giderler").filter(x => !yil || yearOf(x.tarih) === yil);
    const cats = { iscilik: "İşçilik", gubre: "Gübre", yakit: "Yakıt", makine: "Makine", ekipman: "Ekipman", diger: "Diğer" };
    const out = {};
    Object.keys(cats).forEach(k => out[cats[k]] = 0);
    g.forEach(x => { const lbl = cats[x.altKategori] || cats[x.kategori] || "Diğer"; out[lbl] = (out[lbl] || 0) + (Number(x.tutar) || 0); });
    return out;
  }
  function gelirDagilimi(yil) {
    const g = coll("gelirler").filter(x => !yil || yearOf(x.tarih) === yil);
    const lbl = { hasat: "Hasat Geliri", isciKiralama: "İşçi Kiralama", evKira: "Ev Kira" };
    const out = { "Hasat Geliri": 0, "İşçi Kiralama": 0, "Ev Kira": 0 };
    g.forEach(x => { out[lbl[x.tur] || "Hasat Geliri"] += (Number(x.tutar) || 0); });
    return out;
  }
  // Aylık gelir/gider (trend grafiği)
  function aylikTrend(yil) {
    const ay = Array.from({ length: 12 }, () => ({ gelir: 0, gider: 0 }));
    coll("gelirler").forEach(g => { const d = new Date(g.tarih); if (!yil || yearOf(d) === yil) ay[d.getMonth()].gelir += Number(g.tutar) || 0; });
    coll("giderler").forEach(g => { const d = new Date(g.tarih); if (!yil || yearOf(d) === yil) ay[d.getMonth()].gider += Number(g.tutar) || 0; });
    return ay;
  }
  function tarlaVerimSirasi() {
    return coll("tarlalar").slice().map(t => {
      const h = coll("hasatlar").filter(x => x.tarlaId === t.id).sort((a, b) => new Date(b.tarih) - new Date(a.tarih))[0];
      const kgDekar = h && t.alanDekar ? Math.round(h.kuruUrun / t.alanDekar) : (t.sonVerimKgDekar || 0);
      return { ad: t.ad, kgDekar, puan: t.verimPuani || 0 };
    }).sort((a, b) => b.puan - a.puan);
  }

  // ---- Yedek ---------------------------------------------------------------
  function exportJSON() { return JSON.stringify(load(), null, 2); }
  function importJSON(str) { try { _data = JSON.parse(str); migrate(_data); save(); return true; } catch (e) { return false; } }

  // ---- Tohum (mockup'a uygun demo veri) -----------------------------------
  function seed() {
    const Y = 2026;
    const tarlaTanim = [
      { ad: "Köprübaşı 1", koy: "Merkez", adaParsel: "112/4", alanDekar: 11, dikimYili: 2008, cesit: "Tombul", rakim: 320, egim: "Orta", lat: 40.985, lng: 36.742, verimPuani: 92, sonVerimKgDekar: 265 },
      { ad: "Merkez 2", koy: "Merkez", adaParsel: "118/2", alanDekar: 10, dikimYili: 2010, cesit: "Tombul", rakim: 305, egim: "Az", lat: 40.982, lng: 36.738, verimPuani: 88, sonVerimKgDekar: 240 },
      { ad: "Yukarı Tarla", koy: "Yeşilköy", adaParsel: "204/1", alanDekar: 9, dikimYili: 2006, cesit: "Çakıldak", rakim: 410, egim: "Dik", lat: 40.991, lng: 36.751, verimPuani: 81, sonVerimKgDekar: 215 },
      { ad: "Çeşme Yanı", koy: "Yeşilköy", adaParsel: "207/3", alanDekar: 6, dikimYili: 2012, cesit: "Tombul", rakim: 395, egim: "Orta", lat: 40.989, lng: 36.747, verimPuani: 77, sonVerimKgDekar: 195 },
      { ad: "Aşağı Tarla", koy: "Merkez", adaParsel: "121/7", alanDekar: 8.5, dikimYili: 2005, cesit: "Palaz", rakim: 290, egim: "Az", lat: 40.978, lng: 36.733, verimPuani: 68, sonVerimKgDekar: 165 },
      { ad: "Yeşme Tarla", koy: "Yeşilköy", adaParsel: "210/2", alanDekar: 7, dikimYili: 2009, cesit: "Tombul", rakim: 400, egim: "Orta", lat: 40.994, lng: 36.744, verimPuani: 81, sonVerimKgDekar: 210 },
      { ad: "Dere Kenarı", koy: "Merkez", adaParsel: "130/5", alanDekar: 6.5, dikimYili: 2011, cesit: "Çakıldak", rakim: 280, egim: "Az", lat: 40.975, lng: 36.729, verimPuani: 74, sonVerimKgDekar: 190 },
      { ad: "Tepe Üstü", koy: "Karaköy", adaParsel: "301/1", alanDekar: 5.5, dikimYili: 2007, cesit: "Palaz", rakim: 460, egim: "Dik", lat: 41.001, lng: 36.760, verimPuani: 70, sonVerimKgDekar: 175 },
      { ad: "Bağ Yolu", koy: "Karaköy", adaParsel: "305/4", alanDekar: 6, dikimYili: 2013, cesit: "Tombul", rakim: 450, egim: "Orta", lat: 41.004, lng: 36.756, verimPuani: 79, sonVerimKgDekar: 205 },
      { ad: "Kavak Altı", koy: "Merkez", adaParsel: "140/2", alanDekar: 5, dikimYili: 2014, cesit: "Tombul", rakim: 300, egim: "Az", lat: 40.972, lng: 36.736, verimPuani: 76, sonVerimKgDekar: 198 },
      { ad: "Söğütlük", koy: "Yeşilköy", adaParsel: "215/6", alanDekar: 5.5, dikimYili: 2010, cesit: "Çakıldak", rakim: 390, egim: "Orta", lat: 40.996, lng: 36.749, verimPuani: 72, sonVerimKgDekar: 185 },
      { ad: "Harman Yeri", koy: "Karaköy", adaParsel: "310/3", alanDekar: 5, dikimYili: 2008, cesit: "Palaz", rakim: 440, egim: "Dik", lat: 41.007, lng: 36.762, verimPuani: 66, sonVerimKgDekar: 160 }
    ];
    const tarlalar = tarlaTanim.map(t => Object.assign({ id: uid(), urun: "findik" }, t));
    // Çoklu ürün demo — birkaç tarlayı farklı ürüne çevir
    [["Aşağı Tarla", "zeytin", "Gemlik"], ["Tepe Üstü", "zeytin", "Ayvalık"], ["Bağ Yolu", "ceviz", "Chandler"], ["Söğütlük", "ceviz", "Fernor"]]
      .forEach(([ad, u, c]) => { const t = tarlalar.find(x => x.ad === ad); if (t) { t.urun = u; t.cesit = c; } });

    // Gelirler — toplam ~1.250.000 (Hasat %85, İşçi Kiralama %10, Ev Kira %5)
    const gelirler = [];
    let g = (tur, tarih, tutar, aciklama, tarlaId) => gelirler.push({ id: uid(), tur, tarih, tutar, aciklama, tarlaId });
    // Hasat gelirleri — hasat sonrası Eylül-Aralık'a yayılmış satışlar ~1.062.600
    [["2026-09-05", 175000, "Köprübaşı 1 hasat satışı"], ["2026-09-22", 150000, "Merkez 2 hasat satışı"],
     ["2026-10-08", 140000, "Yukarı Tarla + Çeşme Yanı satışı"], ["2026-10-24", 120000, "Yeşme Tarla satışı"],
     ["2026-11-10", 110000, "Aşağı Tarla satışı"], ["2026-11-26", 100000, "Dere Kenarı + Tepe Üstü satışı"],
     ["2026-12-12", 95000, "Bağ Yolu + Kavak Altı satışı"], ["2026-12-24", 172600, "Söğütlük + Harman Yeri + kalan satış"]
    ].forEach(r => g("hasat", r[0], r[1], r[2]));
    // İşçi kiralama tahsilatları — müşterilerin ödemeleri (gelir olarak işlenir)
    [["2026-06-15", "İşçi 1", 40500], ["2026-06-20", "İşçi 2", 18000], ["2026-06-22", "İşçi 3", 25000], ["2026-06-25", "İşçi 5", 15000]]
      .forEach(r => gelirler.push({ id: uid(), tur: "isciKiralama", tarih: r[0], tutar: r[2], musteri: r[1], aciklama: "Tahsilat — " + r[1] }));
    // Ev kira ~62.500
    for (let m = 0; m < 12; m++) g("evKira", `2026-${String(m + 1).padStart(2, "0")}-05`, 5200, "Aylık ev kirası");

    // Giderler — toplam ~720.000 (İşçilik %45, Gübre %20, Yakıt %12, Makine %8, Ekipman %7, Diğer %8)
    const giderler = [];
    let gi = (kategori, altKategori, tur, tarih, tutar, aciklama) => giderler.push({ id: uid(), kategori, altKategori, tur, tarih, tutar, aciklama });
    gi("genel", "iscilik", "Fındık çipil temizlik işçilik", "2026-03-12", 95000, "");
    gi("genel", "iscilik", "Kalın dal budama", "2026-02-20", 48000, "");
    gi("genel", "iscilik", "İlk tırpan işçilik", "2026-05-15", 52000, "");
    gi("genel", "iscilik", "Hasat işçilik", "2026-08-15", 78000, "");
    gi("genel", "iscilik", "Çapalama", "2026-04-22", 35000, "");
    gi("genel", "iscilik", "Patoz işçilik", "2026-09-02", 16000, "");
    gi("genel", "gubre", "Gübre bedeli", "2026-03-25", 88000, "");
    gi("genel", "gubre", "Gübre işçilik bedeli", "2026-03-26", 56000, "");
    gi("yakit", "yakit", "Tırpan yakıt", "2026-05-18", 42000, "Benzin");
    gi("yakit", "yakit", "Traktör motorin", "2026-06-01", 34000, "Motorin");
    gi("yakit", "yakit", "Yağ", "2026-06-01", 10000, "");
    gi("makine", "makine", "Motor tamir + misina", "2026-05-30", 28000, "");
    gi("makine", "makine", "Patoz bakım", "2026-08-20", 18000, "");
    gi("makine", "makine", "Traktör bakım", "2026-04-10", 12000, "");
    gi("ekipman", "ekipman", "Misina + zincir", "2026-05-10", 14000, "");
    gi("ekipman", "ekipman", "Koruyucu ekipman + el aletleri", "2026-05-11", 36000, "");
    gi("genel", "diger", "İlaçlama bedeli", "2026-06-25", 31000, "");
    gi("genel", "diger", "Yemek bedeli", "2026-08-15", 27000, "");

    // Yaklaşan işler (takvim)
    const isler = [
      { id: uid(), baslik: "Gübreleme", tarih: "2026-06-20T08:00", durum: "planli" },
      { id: uid(), baslik: "İlaçlama", tarih: "2026-06-25T07:30", durum: "planli" },
      { id: uid(), baslik: "Tırpan İşçiliği", tarih: "2026-07-10T08:00", durum: "planli" },
      { id: uid(), baslik: "Hasat Hazırlığı", tarih: "2026-08-05T09:00", durum: "planli" },
      { id: uid(), baslik: "Hasat Başlangıcı", tarih: "2026-08-10T07:00", durum: "planli" }
    ];

    // İşçi kiralamalar — hakediş = işçi × gün × yevmiye (2026 yevmiye: ₺900)
    const isciKiralamalar = [
      { id: uid(), tarih: "2026-06-12", bitis: "2026-06-14", musteri: "İşçi 1", kisi: 15, gun: 3, yevmiye: 900, tutar: 40500 },
      { id: uid(), tarih: "2026-06-10", bitis: "2026-06-11", musteri: "İşçi 2", kisi: 10, gun: 2, yevmiye: 900, tutar: 18000 },
      { id: uid(), tarih: "2026-06-08", bitis: "2026-06-11", musteri: "İşçi 3", kisi: 12, gun: 4, yevmiye: 900, tutar: 43200 },
      { id: uid(), tarih: "2026-06-05", bitis: "2026-06-06", musteri: "İşçi 4", kisi: 18, gun: 2, yevmiye: 900, tutar: 32400 },
      { id: uid(), tarih: "2026-06-01", bitis: "2026-06-01", musteri: "İşçi 5", kisi: 20, gun: 1, yevmiye: 900, tutar: 18000 }
    ];

    return {
      meta: { version: 1, urun: "Fındık", olusturma: "2026-06-13" },
      ayarlar: {
        isletmeAdi: "Sipahioğlu Tarım İşletmesi", yonetici: "Rıfat Sipahioğlu",
        gelistirici: "Rıfat Sipahioğlu", iletisim: "rsipahi@gmail.com",
        gubreFiyat: 450, iscilikFiyat: 900, mazotFiyat: 42,
        urunFiyat: { findik: 250, zeytin: 40, ceviz: 130, narenciye: 18, uzum: 30, tibbi: 90 },
        yevmiyeler: { "2026": 900 }, grupBuyukluk: 20,
        hasatTarihi: "2026-08-10", konum: { lat: 40.985, lng: 36.742, ad: "Merkez" }
      },
      tarlalar, gelirler, giderler, isler, isciKiralamalar,
      isTakip: [], puantaj: [], hasatlar: [], aktifIsci: 34
    };
  }

  // ---- İşçi kiralama / müşteri borç hanesi ---------------------------------
  function yevmiyeFor(yil) {
    const v = yilDeger(load().ayarlar.yevmiyeler, yil);
    return v != null ? v : sabitFiyat("iscilikFiyat", yil);
  }
  function setYevmiye(yil, val) {
    const d = load(); d.ayarlar.yevmiyeler = d.ayarlar.yevmiyeler || {};
    d.ayarlar.yevmiyeler[String(yil)] = Number(val) || 0; save();
  }
  // Tahsilatlar = işçi kiralama gelirleri (müşteri ödemeleri)
  function tahsilatlar() { return coll("gelirler").filter(g => g.tur === "isciKiralama"); }
  function musteriList() {
    const s = new Set();
    coll("isciKiralamalar").forEach(k => { if (k.musteri) s.add(String(k.musteri).trim()); });
    tahsilatlar().forEach(t => { if (t.musteri) s.add(String(t.musteri).trim()); });
    return [...s].sort();
  }
  // Müşteri bazlı borç hanesi: hakediş (kiralama) − tahsil (ödeme) = kalan borç
  function musteriOzet() {
    const map = {};
    const ensure = m => (map[m] = map[m] || { musteri: m, hakedis: 0, tahsil: 0, isciGun: 0, kiraSayi: 0 });
    coll("isciKiralamalar").forEach(k => {
      const o = ensure(String(k.musteri || "—").trim());
      o.hakedis += Number(k.tutar) || 0; o.isciGun += (Number(k.kisi) || 0) * (Number(k.gun) || 0); o.kiraSayi++;
    });
    tahsilatlar().forEach(t => { ensure(String(t.musteri || "—").trim()).tahsil += Number(t.tutar) || 0; });
    return Object.values(map).map(o => Object.assign(o, { kalan: o.hakedis - o.tahsil })).sort((a, b) => b.kalan - a.kalan);
  }

  // ---- Dışa aç -------------------------------------------------------------
  global.DB = {
    load, save, reset, coll, add, update, remove,
    money, num, dateTR, dateTimeTR, uid,
    toplamGelir, toplamGider, netKar, toplamDekar,
    giderDagilimi, gelirDagilimi, aylikTrend, tarlaVerimSirasi,
    exportJSON, importJSON,
    URUNLER, urun, urunFiyat, setUrunFiyat, sabitFiyat, setSabitFiyat, yilDeger, yillar, aktifUrunler, urunOptions,
    yevmiyeFor, setYevmiye, tahsilatlar, musteriList, musteriOzet
  };
})(window);
