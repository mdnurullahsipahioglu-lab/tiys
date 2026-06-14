/* TİYS — Router + CRUD modülleri + Ayarlar */
(function (global) {
  "use strict";
  const D = window.DB;

  // ---- Sidebar (mobil) ----
  function toggleSidebar() { document.getElementById("sidebar").classList.toggle("open"); document.getElementById("backdrop").classList.toggle("show"); }
  function closeSidebar() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("backdrop").classList.remove("show"); }

  // ---- yardımcılar ----
  function miniKpi(cls, label, val) { return `<div class="kpi ${cls}" style="min-height:auto;padding:13px"><div class="k-label">${label}</div><div class="k-val" style="font-size:20px">${val}</div></div>`; }
  function tarlaOptions() { return [{ v: "", l: "— (genel) —" }].concat(D.coll("tarlalar").map(t => ({ v: t.id, l: t.ad }))); }
  function byDateDesc(a, b) { const da = a.tarih || a.baslangic || "", db = b.tarih || b.baslangic || ""; return new Date(db) - new Date(da); }
  function dt(v) { return v ? D.dateTR(v) : "—"; }
  function dtt(v) { return v ? D.dateTimeTR(v) : "—"; }

  // ---- Genel CRUD görünümü ----
  function crud(opts) {
    return function (view) {
      function refresh() { renderInto(view); }
      function openForm(record) {
        Forms.open({
          title: record && record.id ? opts.title + " — Düzenle" : "Yeni " + opts.title, icon: opts.icon,
          fields: opts.fields(), record: record || Object.assign({}, opts.defaults || {}),
          compute: opts.compute, computeSave: opts.computeSave,
          onSave: data => { if (record && record.id) D.update(opts.coll, record.id, data); else D.add(opts.coll, data); refresh(); },
          onDelete: record && record.id ? id => { D.remove(opts.coll, id); refresh(); } : null
        });
      }
      function renderInto(v) {
        const rows = D.coll(opts.coll).filter(opts.filter || (() => true)).sort(opts.sort || byDateDesc);
        const total = opts.total ? opts.total(rows) : null;
        v.innerHTML = `
          <div class="page-head"><div><h2 style="margin:0">${opts.title}</h2><div class="lead">${opts.lead || ""}</div></div>
            <button class="btn primary" data-add>➕ ${opts.addLabel || "Yeni Kayıt"}</button></div>
          ${total != null ? `<div class="kpis" style="grid-template-columns:repeat(3,1fr);max-width:600px">
            ${miniKpi("teal", opts.totalLabel || "Toplam", D.money(total))}${miniKpi("blue", "Kayıt", D.num(rows.length))}${opts.extraKpi ? opts.extraKpi(rows) : ""}</div>` : ""}
          <div class="panel" style="margin-top:14px">
            ${rows.length ? `<table class="t"><thead><tr>${opts.cols.map(c => `<th>${c.h}</th>`).join("")}<th></th></tr></thead>
              <tbody>${rows.map((r, i) => `<tr data-i="${i}" style="cursor:pointer">${opts.cols.map(c => `<td>${c.v(r)}</td>`).join("")}
                <td class="row-actions"><button class="icon-act" data-edit="${i}">✏️</button><button class="icon-act" data-del="${i}">🗑️</button></td></tr>`).join("")}</tbody></table>`
              : `<div class="empty"><div class="e-ico">${opts.icon || "📄"}</div>Henüz kayıt yok.<br>“${opts.addLabel || "Yeni Kayıt"}” ile ilk kaydını ekle.</div>`}
          </div>`;
        v.querySelector("[data-add]").onclick = () => openForm(null);
        v.querySelectorAll("[data-edit]").forEach(b => b.onclick = e => { e.stopPropagation(); openForm(rows[+b.dataset.edit]); });
        v.querySelectorAll("[data-del]").forEach(b => b.onclick = e => { e.stopPropagation(); if (confirm("Bu kaydı silmek istediğine emin misin?")) { D.remove(opts.coll, rows[+b.dataset.del].id); Forms.toast("Silindi"); refresh(); } });
        v.querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => openForm(rows[+tr.dataset.i]));
      }
      renderInto(view);
    };
  }

  // ---- Şemalar ----
  const CESIT = ["Tombul", "Palaz", "Çakıldak", "Foşa", "Mincane", "Sivri", "Diğer"];
  const EGIM = ["Az", "Orta", "Dik"];
  const GENEL_TUR = ["Fındık çipil temizlik işçilik", "Kalın dal budama", "Gübre bedeli", "Gübre işçilik bedeli", "İlk tırpan işçilik bedeli", "Tırpan yakıt gideri", "Motor tamir misina bedeli", "Hasat işçilik bedeli", "Çapalama bedeli", "İlaçlama bedeli", "Patoz işçilik bedeli", "Yemek bedeli", "Diğer"];
  const ALT = [{ v: "iscilik", l: "İşçilik" }, { v: "gubre", l: "Gübre" }, { v: "diger", l: "Diğer" }];

  function gelirFields() {
    return [
      { key: "tarih", label: "Tarih", type: "date", required: true },
      { key: "tutar", label: "Tutar (₺)", type: "money", required: true, placeholder: "0" },
      { key: "tarlaId", label: "Tarla (varsa)", type: "select", options: tarlaOptions() },
      { key: "aciklama", label: "Açıklama", type: "textarea", full: true, placeholder: "Not / detay" }
    ];
  }
  function giderFields(kategori) {
    const turField = kategori === "genel" ? { key: "tur", label: "Gider Türü", type: "select", required: true, options: GENEL_TUR }
      : kategori === "makine" ? { key: "tur", label: "Makine", type: "select", required: true, options: ["Motorlu tırpan", "Testere", "Patoz", "Traktör", "Diğer"] }
      : kategori === "yakit" ? { key: "tur", label: "Yakıt", type: "select", required: true, options: ["Benzin", "Motorin", "Yağ"] }
      : { key: "tur", label: "Ekipman", type: "select", required: true, options: ["Misina", "Zincir", "Koruyucu ekipman", "El aletleri", "Diğer"] };
    const f = [turField, { key: "tarih", label: "Tarih", type: "date", required: true }, { key: "tutar", label: "Tutar (₺)", type: "money", required: true }];
    if (kategori === "genel") f.push({ key: "altKategori", label: "Dağılım Kategorisi", type: "select", options: ALT, hint: "Dashboard grafiği için" });
    f.push({ key: "aciklama", label: "Açıklama", type: "textarea", full: true });
    return f;
  }
  const tarlaFields = () => [
    { key: "ad", label: "Tarla Adı", type: "text", required: true },
    { key: "urun", label: "Ürün", type: "select", required: true, default: "findik", options: D.urunOptions() },
    { key: "koy", label: "Köy / Mahalle", type: "text" },
    { key: "adaParsel", label: "Ada / Parsel", type: "text" },
    { key: "alanDekar", label: "Alan (dekar)", type: "number", required: true },
    { key: "dikimYili", label: "Dikim Yılı", type: "number" },
    { key: "cesit", label: "Çeşit", type: "select", dependsOn: "urun", optionsFor: u => D.urun(u || "findik").cesitler },
    { key: "rakim", label: "Rakım (m)", type: "number" },
    { key: "egim", label: "Eğim", type: "select", options: EGIM },
    { key: "lat", label: "GPS Enlem", type: "number", step: "any", hint: "ör. 40.985" },
    { key: "lng", label: "GPS Boylam", type: "number", step: "any", hint: "ör. 36.742" },
    { key: "verimPuani", label: "Verim Puanı (%)", type: "number" }
  ];
  const hasatFields = () => [
    { key: "tarlaId", label: "Tarla", type: "select", required: true, options: D.coll("tarlalar").map(t => ({ v: t.id, l: t.ad })) },
    { key: "tarih", label: "Hasat Tarihi", type: "date", required: true },
    { key: "yasUrun", label: "Toplanan Yaş Ürün (kg)", type: "number", required: true },
    { key: "kuruUrun", label: "Kurutma Sonrası (kg)", type: "number", required: true },
    { key: "nem", label: "Nem Oranı (%)", type: "number" },
    { key: "randiman", label: "Randıman (%)", type: "number", calc: true, hint: "Otomatik: kuru ÷ yaş" }
  ];

  // ---- Rotalar ----
  const routes = {
    "/dashboard": { title: "Dashboard", render: v => Dashboard.render(v) },

    "/gelir-hasat": { title: "Hasat Geliri", render: crud({ coll: "gelirler", title: "Hasat Geliri", icon: "🌾", addLabel: "Hasat Geliri Ekle", totalLabel: "Toplam Hasat Geliri", defaults: { tur: "hasat" }, filter: g => g.tur === "hasat", fields: gelirFields, total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Tarla", v: r => (D.coll("tarlalar").find(t => t.id === r.tarlaId) || {}).ad || "—" }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }] }) },
    "/gelir-kiralama": { title: "İşçi Kiralama Geliri", render: crud({ coll: "gelirler", title: "İşçi Kiralama Geliri", icon: "👷", addLabel: "Tahsilat Ekle", lead: "Müşterilerden alınan işçilik ödemeleri — detaylı borç takibi: İşçi Kiralama sayfası", totalLabel: "Tahsil Edilen", defaults: { tur: "isciKiralama" }, filter: g => g.tur === "isciKiralama", fields: () => [{ key: "tarih", label: "Tarih", type: "date", required: true }, { key: "musteri", label: "Müşteri", type: "text", datalist: D.musteriList(), placeholder: "Ad Soyad" }, { key: "tutar", label: "Alınan Tutar (₺)", type: "money", required: true }, { key: "aciklama", label: "Not", type: "text", full: true, placeholder: "nakit / havale" }], total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Müşteri", v: r => r.musteri || "—" }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }] }) },
    "/gelir-kira": { title: "Ev Kira Geliri", render: crud({ coll: "gelirler", title: "Ev Kira Geliri", icon: "🏠", addLabel: "Kira Geliri Ekle", totalLabel: "Toplam", defaults: { tur: "evKira" }, filter: g => g.tur === "evKira", fields: gelirFields, total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }] }) },

    "/gider-genel": { title: "Genel Giderler", render: giderRoute("genel", "📋") },
    "/gider-makine": { title: "Makine Giderleri", render: giderRoute("makine", "⚙️") },
    "/gider-yakit": { title: "Yakıt Giderleri", render: giderRoute("yakit", "⛽") },
    "/gider-ekipman": { title: "Ekipman Giderleri", render: giderRoute("ekipman", "🛠️") },

    "/tarlalar": { title: "Tarla Yönetimi", render: crud({ coll: "tarlalar", title: "Tarla Yönetimi", icon: "🗺️", addLabel: "Tarla Ekle", lead: "Tüm tarlalar; alan, çeşit, GPS ve verim", sort: (a, b) => (b.verimPuani || 0) - (a.verimPuani || 0), fields: tarlaFields, cols: [{ h: "Tarla", v: r => r.ad }, { h: "Ürün", v: r => D.urun(r.urun).emoji + " " + D.urun(r.urun).ad }, { h: "Köy", v: r => r.koy || "—" }, { h: "Ada/Parsel", v: r => r.adaParsel || "—" }, { h: "Alan", v: r => (r.alanDekar || 0) + " dekar" }, { h: "Çeşit", v: r => r.cesit || "—" }, { h: "Dikim", v: r => r.dikimYili || "—" }, { h: "Verim", v: r => "%" + (r.verimPuani || 0) }], extraKpi: r => miniKpi("orange", "Toplam Dekar", D.num(r.reduce((a, x) => a + (x.alanDekar || 0), 0))), total: r => null }) },

    "/hasat": { title: "Hasat Takip", render: crud({ coll: "hasatlar", title: "Hasat Takip", icon: "🌰", addLabel: "Hasat Kaydı Ekle", lead: "Tarla bazlı yaş/kuru ürün, randıman, nem", fields: hasatFields, compute: d => { const r = (d.yasUrun && d.kuruUrun) ? Math.round(d.kuruUrun / d.yasUrun * 100) : ""; return { randiman: r ? "Randıman: %" + r : "" }; }, computeSave: d => ({ randiman: (d.yasUrun && d.kuruUrun) ? Math.round(d.kuruUrun / d.yasUrun * 100) : d.randiman }), cols: [{ h: "Tarla", v: r => (D.coll("tarlalar").find(t => t.id === r.tarlaId) || {}).ad || "—" }, { h: "Tarih", v: r => dt(r.tarih) }, { h: "Yaş (kg)", v: r => D.num(r.yasUrun) }, { h: "Kuru (kg)", v: r => D.num(r.kuruUrun) }, { h: "Randıman", v: r => "%" + (r.randiman || 0) }, { h: "Nem", v: r => "%" + (r.nem || 0) }] }) },

    "/isci-kiralama": { title: "İşçi Kiralama", render: v => Isci.render(v) },

    "/is-takibi": { title: "İş Takibi", render: crud({ coll: "isTakip", title: "İş Takibi", icon: "⏱️", addLabel: "İş Ekle", lead: "Başlangıç/bitiş (gg/aa/yyyy & 00.00) ve ödeme", sort: (a, b) => new Date(b.baslangic) - new Date(a.baslangic), fields: () => [{ key: "baslik", label: "İş Adı", type: "text", required: true, full: true }, { key: "baslangic", label: "Başlangıç", type: "datetime", required: true }, { key: "bitis", label: "Bitiş", type: "datetime" }, { key: "odeme", label: "Toplam Ödeme (₺)", type: "money" }, { key: "aciklama", label: "Açıklama", type: "textarea", full: true }], total: r => r.reduce((a, x) => a + (x.odeme || 0), 0), totalLabel: "Toplam Ödeme", cols: [{ h: "İş", v: r => r.baslik }, { h: "Başlangıç", v: r => dtt(r.baslangic) }, { h: "Bitiş", v: r => dtt(r.bitis) }, { h: "Ödeme", v: r => D.money(r.odeme) }] }) },

    "/puantaj": { title: "Puantaj", render: crud({ coll: "puantaj", title: "Puantaj", icon: "🕘", addLabel: "Puantaj Ekle", lead: "Günlük giriş/çıkış, mesai, hakediş", fields: () => [{ key: "isciAdi", label: "İşçi Adı", type: "text", required: true }, { key: "tarih", label: "Tarih", type: "date", required: true }, { key: "giris", label: "Giriş (00.00)", type: "text", placeholder: "08.00" }, { key: "cikis", label: "Çıkış (00.00)", type: "text", placeholder: "17.00" }, { key: "calismaSaat", label: "Çalışma Saati", type: "number", calc: true }, { key: "fazlaMesai", label: "Fazla Mesai (saat)", type: "number" }, { key: "odenen", label: "Ödenen (₺)", type: "money" }, { key: "kalan", label: "Kalan Alacak (₺)", type: "money" }], compute: d => { const s = saatFark(d.giris, d.cikis); return { calismaSaat: s != null ? "≈ " + s + " saat" : "" }; }, computeSave: d => { const s = saatFark(d.giris, d.cikis); return { calismaSaat: s != null ? s : d.calismaSaat }; }, cols: [{ h: "İşçi", v: r => r.isciAdi }, { h: "Tarih", v: r => dt(r.tarih) }, { h: "Giriş–Çıkış", v: r => (r.giris || "—") + " – " + (r.cikis || "—") }, { h: "Saat", v: r => r.calismaSaat || "—" }, { h: "Ödenen", v: r => D.money(r.odenen) }, { h: "Kalan", v: r => D.money(r.kalan) }] }) },

    "/raporlar": { title: "Raporlar", render: v => Reports.karRapor(v) },
    "/hava": { title: "Hava ve Karar Destek", render: v => Weather.render(v) },
    "/analiz": { title: "Analiz Merkezi", render: v => Reports.analizPage(v) },
    "/ai": { title: "Yapay Zeka Asistanı", render: stub("Yapay Zeka Asistanı", "Verinden cevap veren asistan", "🤖", ["Dashboard'daki asistan çalışıyor — buraya tam sayfa sohbet gelecek", "Gelir/gider/kârlılık/hasat sorularını yerel hesaplar"]) },

    "/ayarlar": { title: "Ayarlar", render: ayarlarPage }
  };

  function giderRoute(kategori, ico) {
    const titles = { genel: "Genel Giderler", makine: "Makine Giderleri", yakit: "Yakıt Giderleri", ekipman: "Ekipman Giderleri" };
    return crud({ coll: "giderler", title: titles[kategori], icon: ico, addLabel: titles[kategori] + " Ekle", totalLabel: "Toplam", defaults: { kategori, altKategori: kategori === "genel" ? "iscilik" : kategori }, filter: g => g.kategori === kategori, fields: () => giderFields(kategori), total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Tür", v: r => r.tur }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }] });
  }

  function saatFark(g, c) {
    if (!g || !c) return null;
    const p = s => { const m = String(s).replace(":", ".").match(/(\d+)[.,]?(\d+)?/); return m ? (+m[1]) + (m[2] ? (+m[2]) / 60 : 0) : null; };
    const a = p(g), b = p(c); if (a == null || b == null) return null;
    return Math.round((b - a) * 10) / 10;
  }

  function stub(title, lead, ico, points) {
    return function (view) {
      view.innerHTML = `<div class="page-head"><div><h2 style="margin:0">${title}</h2><div class="lead">${lead}</div></div><span class="soon">Sıradaki adım</span></div>
        <div class="panel"><div style="display:flex;gap:16px;align-items:flex-start"><div style="font-size:46px">${ico}</div>
        <div><p style="margin:0 0 10px;color:var(--muted)">Bu modül planlandı; veri katmanı hazır. Gelecek özellikler:</p>
        <ul style="margin:0;padding-left:18px;line-height:1.9">${points.map(p => `<li>${p}</li>`).join("")}</ul></div></div></div>`;
    };
  }

  // ---- Ayarlar (çalışan) ----
  function ayarlarPage(view) {
    const a = D.load().ayarlar;
    view.innerHTML = `
      <div class="page-head"><div><h2 style="margin:0">Ayarlar</h2><div class="lead">İşletme bilgileri, sabit fiyatlar, yedekleme</div></div></div>
      <div class="grid cols-2" style="align-items:start">
        <div class="panel"><h3>🏭 İşletme & Sabit Fiyatlar</h3>
          <div class="form-grid">
            <div class="field full"><label>İşletme Adı</label><input id="s_isl" value="${a.isletmeAdi || ""}"></div>
            <div class="field"><label>Yönetici</label><input id="s_yon" value="${a.yonetici || ""}"></div>
            <div class="field"><label>Tahmini Hasat Tarihi</label><input id="s_has" type="date" value="${(a.hasatTarihi || "").slice(0, 10)}"></div>
            <div class="field"><label>Gübre Fiyatı (₺/çuval)</label><input id="s_gub" type="number" value="${a.gubreFiyat || 0}"></div>
            <div class="field"><label>İşçilik (₺/gün)</label><input id="s_isc" type="number" value="${a.iscilikFiyat || 0}"></div>
            <div class="field"><label>Mazot (₺/lt)</label><input id="s_maz" type="number" value="${a.mazotFiyat || 0}"></div>
          </div>
          <div class="lead" style="margin:14px 0 8px;font-weight:600">🌱 Ürün Satış Fiyatları (₺/kg)</div>
          <div class="form-grid">
            ${Object.keys(D.URUNLER).filter(k => k !== "diger").map(k => `<div class="field"><label>${D.URUNLER[k].emoji} ${D.URUNLER[k].ad}</label><input id="s_fiyat_${k}" type="number" value="${(a.urunFiyat && a.urunFiyat[k] != null) ? a.urunFiyat[k] : D.URUNLER[k].defaultFiyat}"></div>`).join("")}
          </div>
          <div style="margin-top:14px"><button class="btn primary" id="s_save">💾 Kaydet</button></div>
        </div>
        <div class="panel"><h3>☁️ Yedekleme & Veri</h3>
          <p class="lead" style="margin-top:0">Bulut senkronu eklenene kadar verini JSON dosyası olarak yedekleyip başka cihaza taşıyabilirsin.</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn ghost" id="b_export">⬇️ Yedek Al (JSON indir)</button>
            <button class="btn ghost" id="b_import">⬆️ Yedek Yükle (JSON)</button>
            <input type="file" id="b_file" accept="application/json" class="hidden">
            <button class="btn danger" id="b_reset">♻️ Demo verilere sıfırla</button>
          </div>
          <p class="lead" style="margin-top:14px">🔒 Tüm veri yalnızca bu cihazda saklanır.</p>
        </div>
      </div>
      <div class="panel" id="cloudPanel" style="margin-top:14px;max-width:540px"></div>
      <div class="panel" style="margin-top:14px;max-width:540px"><h3>ℹ️ Hakkında</h3>
        <div class="about-row"><b>Uygulama</b><span>TİYS — Tarım İşletme Yönetim Sistemi</span></div>
        <div class="about-row"><b>Sürüm</b><span>1.0.0</span></div>
        <div class="about-row"><b>Geliştiren</b><span>${a.gelistirici || "Rıfat Sipahioğlu"}</span></div>
        <div class="about-row"><b>İletişim</b><span><a href="mailto:${a.iletisim || "rsipahi@gmail.com"}" style="color:var(--blue)">${a.iletisim || "rsipahi@gmail.com"}</a></span></div>
        <div class="about-row"><b>Telif Hakkı</b><span>© 2026 ${a.gelistirici || "Rıfat Sipahioğlu"} · Tüm hakları saklıdır</span></div>
      </div>`;
    view.querySelector("#s_save").onclick = () => {
      const d = D.load();
      d.ayarlar = Object.assign({}, a, {
        isletmeAdi: val("#s_isl"), yonetici: val("#s_yon"), hasatTarihi: val("#s_has"),
        gubreFiyat: +val("#s_gub"), iscilikFiyat: +val("#s_isc"), mazotFiyat: +val("#s_maz"),
        urunFiyat: (function () { const uf = {}; Object.keys(D.URUNLER).filter(k => k !== "diger").forEach(k => uf[k] = +val("#s_fiyat_" + k)); return uf; })()
      });
      D.save(); Forms.toast("Ayarlar kaydedildi ✓");
      document.getElementById("userName").textContent = d.ayarlar.yonetici || "Yönetici";
    };
    view.querySelector("#b_export").onclick = () => {
      const blob = new Blob([D.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob), aEl = document.createElement("a");
      aEl.href = url; aEl.download = "tiys-yedek-" + new Date().toISOString().slice(0, 10) + ".json"; aEl.click();
      URL.revokeObjectURL(url); Forms.toast("Yedek indirildi ✓");
    };
    view.querySelector("#b_import").onclick = () => view.querySelector("#b_file").click();
    view.querySelector("#b_file").onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const rdr = new FileReader(); rdr.onload = () => { if (D.importJSON(rdr.result)) { Forms.toast("Yedek yüklendi ✓"); FIYS.route(); } else Forms.toast("Geçersiz yedek dosyası"); };
      rdr.readAsText(file);
    };
    view.querySelector("#b_reset").onclick = () => { if (confirm("Tüm veriler silinip demo verilere dönülecek. Emin misin?")) { D.reset(); Forms.toast("Sıfırlandı"); FIYS.route(); } };

    function renderCloud() {
      const p = view.querySelector("#cloudPanel"); if (!p || typeof Cloud === "undefined") return;
      const s = Cloud.status();
      if (!s.configured) {
        p.innerHTML = `<h3>☁️ Bulut Senkron</h3><p class="lead" style="margin-top:0">Henüz kurulmadı. Kurulduğunda telefon · bilgisayar · web otomatik eşitlenir, USB ile taşımaya gerek kalmaz.</p>`;
        return;
      }
      if (!s.loggedIn) {
        p.innerHTML = `<h3>☁️ Bulut Senkron</h3>
          <p class="lead" style="margin-top:0">Giriş yap; verilerin tüm cihazlarında otomatik eşitlensin.</p>
          <div class="form-grid"><div class="field"><label>E-posta</label><input id="cl_mail" type="email" placeholder="ornek@mail.com"></div>
          <div class="field"><label>Şifre</label><input id="cl_pass" type="password" placeholder="en az 6 karakter"></div></div>
          <div style="display:flex;gap:10px;margin-top:12px"><button class="btn primary" id="cl_in">Giriş Yap</button><button class="btn ghost" id="cl_up">Kayıt Ol</button></div>
          <div class="lead" id="cl_msg" style="margin-top:10px"></div>`;
        const mail = () => p.querySelector("#cl_mail").value.trim(), pass = () => p.querySelector("#cl_pass").value, msg = t => p.querySelector("#cl_msg").textContent = t;
        p.querySelector("#cl_in").onclick = async () => { msg("Giriş yapılıyor…"); const r = await Cloud.signIn(mail(), pass()); if (r.error) msg("⚠️ " + r.error); else { Forms.toast("Giriş yapıldı ✓"); renderCloud(); } };
        p.querySelector("#cl_up").onclick = async () => { msg("Kayıt olunuyor…"); const r = await Cloud.signUp(mail(), pass()); if (r.error) msg("⚠️ " + r.error); else { msg("✓ " + (r.mesaj || "Kayıt oldu")); renderCloud(); } };
      } else {
        p.innerHTML = `<h3>☁️ Bulut Senkron</h3>
          <div class="about-row"><b>Hesap</b><span>${s.email} ✓</span></div>
          <div class="about-row"><b>Son eşitleme</b><span>${s.lastSync ? D.dateTimeTR(s.lastSync) : "—"}</span></div>
          <p class="lead">Veriler değiştikçe otomatik buluta yüklenir; yeni cihazda giriş yapınca otomatik iner.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" id="cl_push">⬆️ Şimdi Yükle</button><button class="btn ghost" id="cl_pull">⬇️ Buluttan Çek</button><button class="btn danger" id="cl_out">Çıkış</button></div>`;
        p.querySelector("#cl_push").onclick = async () => { const r = await Cloud.push(); Forms.toast(r.error ? "⚠️ " + r.error : "Buluta yüklendi ✓"); renderCloud(); };
        p.querySelector("#cl_pull").onclick = async () => { if (!confirm("Buluttaki veri bu cihazdakini değiştirecek. Devam?")) return; const r = await Cloud.pull(); Forms.toast(r.error ? "⚠️ " + r.error : (r.vardi ? "Buluttan çekildi ✓" : "Bulutta kayıt yok")); };
        p.querySelector("#cl_out").onclick = async () => { await Cloud.signOut(); Forms.toast("Çıkış yapıldı"); renderCloud(); };
      }
    }
    renderCloud();

    function val(s) { return view.querySelector(s).value; }
  }

  // ---- Router ----
  function route() {
    const hash = location.hash.replace(/^#/, "") || "/dashboard";
    const r = routes[hash] || routes["/dashboard"];
    document.getElementById("pageTitle").textContent = r.title;
    const view = document.getElementById("view");
    if (Dashboard && Dashboard.destroy) Dashboard.destroy();
    if (window.Reports && Reports.destroy) Reports.destroy();
    if (window.Weather && Weather.destroy) Weather.destroy();
    r.render(view);
    document.querySelectorAll("#nav a.item").forEach(a => {
      const on = a.getAttribute("href") === "#" + hash;
      a.classList.toggle("active", on);
      if (on) { const g = a.closest(".group"); if (g) g.classList.add("open"); }
    });
    closeSidebar();
    const main = document.querySelector(".main"); if (main) main.scrollTop = 0;
  }

  function initNav() {
    document.querySelectorAll("#nav [data-toggle]").forEach(btn => btn.addEventListener("click", () => btn.closest(".group").classList.toggle("open")));
    const d = new Date(2026, 5, 13), gun = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][d.getDay()];
    document.getElementById("dateChip").textContent = `📅 ${D.dateTR(d)}  ${gun}`;
    const a = D.load().ayarlar; if (a.yonetici) document.getElementById("userName").textContent = a.yonetici;
  }

  global.FIYS = { toggleSidebar, closeSidebar, route };
  window.addEventListener("hashchange", route);
  function boot() { D.load(); initNav(); route(); }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot); else boot();
})(window);
