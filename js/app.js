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
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${Export.bar('crud')}${Export.importBtn('crud')}<button class="btn primary" data-add>➕ ${opts.addLabel || "Yeni Kayıt"}</button></div></div>
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
        v.querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => (opts.onRowClick ? opts.onRowClick(rows[+tr.dataset.i], refresh) : openForm(rows[+tr.dataset.i])));
        Export.wire(v, 'crud', () => ({ file: opts.title, title: "TİYS — " + opts.title, tables: [{ name: opts.title, headers: opts.cols.map(c => c.h), rows: rows.map(r => opts.cols.map(c => Export.clean(c.v(r)))) }] }));
        Export.wireImport(v, 'crud', function (satirlar) {
          if (!satirlar || !satirlar.length) { alert("Excel'de satır bulunamadı.\nİpucu: önce 📊 Excel ile dışa aktar, dosyayı doldur, sonra 📥 ile geri yükle."); return; }
          const flds = (typeof opts.fields === "function" ? opts.fields() : opts.fields) || [];
          const nrm = s => String(s || "").toLowerCase().trim().replace(/ı/g, "i").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/ğ/g, "g");
          const harita = {}; flds.forEach(f => { if (f.key) { harita[nrm(f.label)] = f; harita[nrm(f.key)] = f; } });
          let eklenen = 0;
          satirlar.forEach(row => {
            const obj = Object.assign({}, opts.defaults || {}); let doluVar = false;
            Object.keys(row).forEach(col => {
              const f = harita[nrm(col)]; if (!f) return;
              let val = row[col]; if (val === "" || val == null) return;
              if (f.type === "money" || f.type === "number") val = parseFloat(String(val).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")) || 0;
              else if (f.type === "date") { const s = String(val).trim(); const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/); if (m) val = m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2); else if (/^\d{4,5}(\.\d+)?$/.test(s)) val = new Date(Math.round((parseFloat(s) - 25569) * 86400000)).toISOString().slice(0, 10); }
              obj[f.key] = val; doluVar = true;
            });
            if (doluVar) { D.add(opts.coll, obj); eklenen++; }
          });
          if (eklenen) { Forms.toast(eklenen + " kayıt Excel'den eklendi ✓"); refresh(); }
          else alert("Eşleşen sütun bulunamadı.\nExcel'in başlık satırı şu alanlarla aynı olmalı (ör: " + flds.slice(0, 4).map(f => f.label).join(", ") + ").");
        });
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
    const turField = kategori === "genel" ? { key: "tur", label: "Gider Türü", type: "select", required: true, options: ((D.load().ayarlar.giderTurleri || []).length ? D.load().ayarlar.giderTurleri : GENEL_TUR) }
      : kategori === "makine" ? { key: "tur", label: "Makine", type: "select", required: true, options: ["Motorlu tırpan", "Testere", "Patoz", "Traktör", "Diğer"] }
      : kategori === "yakit" ? { key: "tur", label: "Yakıt", type: "select", required: true, options: ["Benzin", "Motorin", "Yağ"] }
      : { key: "tur", label: "Ekipman", type: "select", required: true, options: ["Misina", "Zincir", "Koruyucu ekipman", "El aletleri", "Diğer"] };
    const f = [turField, { key: "tarih", label: "Tarih", type: "date", required: true }, { key: "tutar", label: "Tutar (₺)", type: "money", required: true }];
    if (kategori === "genel") f.push({ key: "altKategori", label: "Dağılım Kategorisi", type: "select", options: ALT, hint: "Dashboard grafiği için" });
    f.push({ key: "tarlaId", label: "Tarla (hangi tarlaya?)", type: "select", options: tarlaOptions(), hint: "Boş bırakırsan genel/tüm işletme gideri sayılır" });
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
    { key: "cuval", label: "Çuval Sayısı", type: "number", hint: "Bu tarladan toplanan çuval adedi" },
    { key: "yasUrun", label: "Toplanan Yaş Ürün (kg)", type: "number" },
    { key: "kuruUrun", label: "Kurutma Sonrası (kg)", type: "number", hint: "Kuruyunca gir — sonradan da girebilirsin" },
    { key: "nem", label: "Nem Oranı (%)", type: "number" },
    { key: "randiman", label: "Randıman (%)", type: "number", calc: true, hint: "Otomatik: kuru ÷ yaş" }
  ];

  // ---- Rotalar ----
  const routes = {
    "/dashboard": { title: "Dashboard", render: v => Dashboard.render(v) },

    "/gelir-hasat": { title: "Hasat Geliri", render: crud({ coll: "gelirler", title: "Hasat Geliri", icon: "🌾", addLabel: "Hasat Geliri Ekle", totalLabel: "Toplam Hasat Geliri", defaults: { tur: "hasat" }, filter: g => g.tur === "hasat", fields: gelirFields, total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Tarla", v: r => (D.coll("tarlalar").find(t => t.id === r.tarlaId) || {}).ad || "—" }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }, { h: "USD", v: r => Doviz.usdStr(r.tutar, r.tarih) }] }) },
    "/gelir-kiralama": { title: "İşçi Kiralama Geliri", render: crud({ coll: "gelirler", title: "İşçi Kiralama Geliri", icon: "👷", addLabel: "Tahsilat Ekle", lead: "Müşterilerden alınan işçilik ödemeleri — detaylı borç takibi: İşçi Kiralama sayfası", totalLabel: "Tahsil Edilen", defaults: { tur: "isciKiralama" }, filter: g => g.tur === "isciKiralama", fields: () => [{ key: "tarih", label: "Tarih", type: "date", required: true }, { key: "musteri", label: "Müşteri", type: "text", datalist: D.musteriList(), placeholder: "Ad Soyad" }, { key: "tutar", label: "Alınan Tutar (₺)", type: "money", required: true }, { key: "aciklama", label: "Not", type: "text", full: true, placeholder: "nakit / havale" }], total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Müşteri", v: r => r.musteri || "—" }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }, { h: "USD", v: r => Doviz.usdStr(r.tutar, r.tarih) }] }) },
    "/gelir-kira": { title: "Ev Kira Geliri", render: crud({ coll: "gelirler", title: "Ev Kira Geliri", icon: "🏠", addLabel: "Kira Geliri Ekle", totalLabel: "Toplam", defaults: { tur: "evKira" }, filter: g => g.tur === "evKira", fields: gelirFields, total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }, { h: "USD", v: r => Doviz.usdStr(r.tutar, r.tarih) }] }) },

    "/gider-genel": { title: "Genel Giderler", render: giderRoute("genel", "📋") },
    "/gider-makine": { title: "Makine Giderleri", render: giderRoute("makine", "⚙️") },
    "/gider-yakit": { title: "Yakıt Giderleri", render: giderRoute("yakit", "⛽") },
    "/gider-ekipman": { title: "Ekipman Giderleri", render: giderRoute("ekipman", "🛠️") },

    "/tarlalar": { title: "Tarla Yönetimi", render: crud({ coll: "tarlalar", title: "Tarla Yönetimi", icon: "🗺️", addLabel: "Tarla Ekle", lead: "Tarlaya tıkla → gider/gelir dökümü · alan, çeşit, GPS, verim", onRowClick: tarlaDetay, sort: (a, b) => (b.verimPuani || 0) - (a.verimPuani || 0), fields: tarlaFields, cols: [{ h: "Tarla", v: r => r.ad }, { h: "Ürün", v: r => D.urun(r.urun).emoji + " " + D.urun(r.urun).ad }, { h: "Köy", v: r => r.koy || "—" }, { h: "Ada/Parsel", v: r => r.adaParsel || "—" }, { h: "Alan", v: r => (r.alanDekar || 0) + " dekar" }, { h: "Çeşit", v: r => r.cesit || "—" }, { h: "Dikim", v: r => r.dikimYili || "—" }, { h: "Verim", v: r => "%" + (r.verimPuani || 0) }], extraKpi: r => miniKpi("orange", "Toplam Dekar", D.num(r.reduce((a, x) => a + (x.alanDekar || 0), 0))), total: r => null }) },

    "/hasat": { title: "Hasat Takip", render: crud({ coll: "hasatlar", title: "Hasat Takip", icon: "🌰", addLabel: "Hasat Kaydı Ekle", lead: "Tarla bazlı yaş/kuru ürün, randıman, nem", fields: hasatFields, compute: d => { const r = (d.yasUrun && d.kuruUrun) ? Math.round(d.kuruUrun / d.yasUrun * 100) : ""; return { randiman: r ? "Randıman: %" + r : "" }; }, computeSave: d => ({ randiman: (d.yasUrun && d.kuruUrun) ? Math.round(d.kuruUrun / d.yasUrun * 100) : d.randiman }), cols: [{ h: "Tarla", v: r => (D.coll("tarlalar").find(t => t.id === r.tarlaId) || {}).ad || "—" }, { h: "Tarih", v: r => dt(r.tarih) }, { h: "Çuval", v: r => D.num(r.cuval) || "—" }, { h: "Yaş (kg)", v: r => D.num(r.yasUrun) }, { h: "Kuru (kg)", v: r => D.num(r.kuruUrun) }, { h: "Randıman", v: r => "%" + (r.randiman || 0) }, { h: "Nem", v: r => "%" + (r.nem || 0) }] }) },

    "/isci-kiralama": { title: "İşçi Kiralama", render: v => Isci.render(v) },
    "/takvim": { title: "Kiralama Takvimi", render: v => Takvim.render(v) },

    "/is-takibi": { title: "İş Takibi", render: crud({ coll: "isTakip", title: "İş Takibi", icon: "⏱️", addLabel: "İş Ekle", lead: "Başlangıç/bitiş (gg/aa/yyyy & 00.00) ve ödeme", sort: (a, b) => new Date(b.baslangic) - new Date(a.baslangic), fields: () => [{ key: "baslik", label: "İş Adı", type: "text", required: true, full: true }, { key: "baslangic", label: "Başlangıç", type: "datetime", required: true }, { key: "bitis", label: "Bitiş", type: "datetime" }, { key: "odeme", label: "Toplam Ödeme (₺)", type: "money" }, { key: "aciklama", label: "Açıklama", type: "textarea", full: true }], total: r => r.reduce((a, x) => a + (x.odeme || 0), 0), totalLabel: "Toplam Ödeme", cols: [{ h: "İş", v: r => r.baslik }, { h: "Başlangıç", v: r => dtt(r.baslangic) }, { h: "Bitiş", v: r => dtt(r.bitis) }, { h: "Ödeme", v: r => D.money(r.odeme) }] }) },

    "/puantaj": { title: "Puantaj", render: crud({ coll: "puantaj", title: "Puantaj", icon: "🕘", addLabel: "Puantaj Ekle", lead: "Günlük giriş/çıkış, mesai, hakediş", fields: () => [{ key: "isciAdi", label: "İşçi Adı", type: "text", required: true }, { key: "tarih", label: "Tarih", type: "date", required: true }, { key: "giris", label: "Giriş (00.00)", type: "text", placeholder: "08.00" }, { key: "cikis", label: "Çıkış (00.00)", type: "text", placeholder: "17.00" }, { key: "calismaSaat", label: "Çalışma Saati", type: "number", calc: true }, { key: "fazlaMesai", label: "Fazla Mesai (saat)", type: "number" }, { key: "odenen", label: "Ödenen (₺)", type: "money" }, { key: "kalan", label: "Kalan Alacak (₺)", type: "money" }], compute: d => { const s = saatFark(d.giris, d.cikis); return { calismaSaat: s != null ? "≈ " + s + " saat" : "" }; }, computeSave: d => { const s = saatFark(d.giris, d.cikis); return { calismaSaat: s != null ? s : d.calismaSaat }; }, cols: [{ h: "İşçi", v: r => r.isciAdi }, { h: "Tarih", v: r => dt(r.tarih) }, { h: "Giriş–Çıkış", v: r => (r.giris || "—") + " – " + (r.cikis || "—") }, { h: "Saat", v: r => r.calismaSaat || "—" }, { h: "Ödenen", v: r => D.money(r.odenen) }, { h: "Kalan", v: r => D.money(r.kalan) }] }) },

    "/raporlar": { title: "Raporlar", render: v => Reports.karRapor(v) },
    "/doviz": { title: "USD Karşılığı", render: v => Doviz.render(v) },
    "/hava": { title: "Hava ve Karar Destek", render: v => Weather.render(v) },
    "/analiz": { title: "Analiz Merkezi", render: v => Reports.analizPage(v) },
    "/ai": { title: "Yapay Zeka Asistanı", render: v => Asistan.render(v) },

    "/ayarlar": { title: "Ayarlar", render: ayarlarPage }
  };

  function giderRoute(kategori, ico) {
    const titles = { genel: "Genel Giderler", makine: "Makine Giderleri", yakit: "Yakıt Giderleri", ekipman: "Ekipman Giderleri" };
    return crud({ coll: "giderler", title: titles[kategori], icon: ico, addLabel: titles[kategori] + " Ekle", totalLabel: "Toplam", defaults: { kategori, altKategori: kategori === "genel" ? "iscilik" : kategori }, filter: g => g.kategori === kategori, fields: () => giderFields(kategori), total: r => r.reduce((a, x) => a + (x.tutar || 0), 0), cols: [{ h: "Tarih", v: r => dt(r.tarih) }, { h: "Tür", v: r => r.tur }, { h: "Tarla", v: r => (D.coll("tarlalar").find(t => t.id === r.tarlaId) || {}).ad || "— genel —" }, { h: "Açıklama", v: r => r.aciklama || "—" }, { h: "Tutar", v: r => D.money(r.tutar) }, { h: "USD", v: r => Doviz.usdStr(r.tutar, r.tarih) }] });
  }

  function saatFark(g, c) {
    if (!g || !c) return null;
    const p = s => { const m = String(s).replace(":", ".").match(/(\d+)[.,]?(\d+)?/); return m ? (+m[1]) + (m[2] ? (+m[2]) / 60 : 0) : null; };
    const a = p(g), b = p(c); if (a == null || b == null) return null;
    return Math.round((b - a) * 10) / 10;
  }

  // ---- Tarla detay: tarla bazlı gider/gelir dökümü ----
  function escA(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function bugunISO2() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "2026-06-17"; } }
  function tAd(tarlaId) { return (D.coll("tarlalar").find(t => t.id === tarlaId) || {}).ad || ""; }
  function tarlaGiderForm(kategori, tarlaId, after) {
    const baslik = { genel: "Genel Gider", makine: "Makine Gideri", yakit: "Yakıt Gideri", ekipman: "Ekipman Gideri" }[kategori] || "Gider";
    Forms.open({
      title: baslik + (tAd(tarlaId) ? " — " + tAd(tarlaId) : ""), icon: "🧮",
      fields: giderFields(kategori),
      record: { kategori: kategori, tarlaId: tarlaId, altKategori: kategori === "genel" ? "iscilik" : kategori, tarih: bugunISO2() },
      onSave: data => { data.kategori = kategori; D.add("giderler", data); if (after) after(); }
    });
  }
  function tarlaGelirForm(tarlaId, after) {
    Forms.open({
      title: "Hasat / Gelir" + (tAd(tarlaId) ? " — " + tAd(tarlaId) : ""), icon: "💰",
      fields: gelirFields(),
      record: { tur: "hasat", tarlaId: tarlaId, tarih: bugunISO2() },
      onSave: data => { data.tur = data.tur || "hasat"; D.add("gelirler", data); if (after) after(); }
    });
  }
  function tarlaEditForm(rec, after) {
    Forms.open({
      title: "Tarla — Düzenle", icon: "🗺️", fields: tarlaFields(), record: rec || {},
      onSave: data => { if (rec && rec.id) D.update("tarlalar", rec.id, data); else D.add("tarlalar", data); if (after) after(); },
      onDelete: rec && rec.id ? id => { D.remove("tarlalar", id); if (after) after(); } : null
    });
  }
  function tarlaGiderEkle(tarlaId, after) {
    const ov = document.createElement("div"); ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal" style="max-width:430px">
      <div class="modal-head"><h3>➕ Gider Ekle — ${escA(tAd(tarlaId))}</h3><button class="x">✕</button></div>
      <div class="modal-body"><p class="lead" style="margin-top:0">Hangi tür gider ekleyeceksin?</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn ghost" data-k="genel">📋 Genel Gider</button>
          <button class="btn ghost" data-k="makine">⚙️ Makine</button>
          <button class="btn ghost" data-k="yakit">⛽ Yakıt</button>
          <button class="btn ghost" data-k="ekipman">🛠️ Ekipman</button>
        </div></div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector(".x").onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelectorAll("[data-k]").forEach(b => b.onclick = () => { close(); tarlaGiderForm(b.dataset.k, tarlaId, after); });
  }
  function tarlaDetay(tarla, refreshList) {
    const ov = document.createElement("div"); ov.className = "modal-overlay";
    function build() {
      const gid = D.coll("giderler").filter(g => g.tarlaId === tarla.id);
      const gel = D.coll("gelirler").filter(g => g.tarlaId === tarla.id);
      const toplamGider = gid.reduce((a, x) => a + (Number(x.tutar) || 0), 0);
      const toplamGelir = gel.reduce((a, x) => a + (Number(x.tutar) || 0), 0);
      const byTur = {}; gid.forEach(g => { const k = g.tur || "Diğer"; byTur[k] = (byTur[k] || 0) + (Number(g.tutar) || 0); });
      const turRows = Object.keys(byTur).sort((a, b) => byTur[b] - byTur[a]);
      const hareketler = gid.map(g => Object.assign({ _t: "gider" }, g)).concat(gel.map(g => Object.assign({ _t: "gelir" }, g))).sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
      return { gid, gel, toplamGider, toplamGelir, net: toplamGelir - toplamGider, byTur, turRows, hareketler };
    }
    function render() {
      const c = build(), u = D.urun(tarla.urun) || {};
      ov.innerHTML = `<div class="modal">
        <div class="modal-head"><h3>${u.emoji || "🗺️"} ${escA(tarla.ad)}</h3><button class="x">✕</button></div>
        <div class="modal-body">
          <div class="lead" style="margin-top:0">${escA(u.ad || tarla.urun || "")} · ${escA(tarla.koy || "—")} · ${(Number(tarla.alanDekar) || 0)} dekar · ${escA(tarla.cesit || "—")}</div>
          <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin:12px 0">
            ${miniKpi("teal", "Gelir", D.money(c.toplamGelir))}${miniKpi("red", "Gider", D.money(c.toplamGider))}${miniKpi(c.net >= 0 ? "blue" : "orange", "Net", D.money(c.net))}
          </div>
          <h3 style="margin:8px 0 6px;font-size:15px">🧾 Gider Türlerine Göre Döküm</h3>
          ${c.turRows.length ? `<table class="t"><thead><tr><th>Gider Türü</th><th style="text-align:right">Tutar</th></tr></thead><tbody>
            ${c.turRows.map(t => `<tr><td>${escA(t)}</td><td style="text-align:right;font-weight:600">${D.money(c.byTur[t])}</td></tr>`).join("")}
            <tr style="border-top:2px solid var(--line,#e5e7eb)"><td style="font-weight:700">TOPLAM GİDER</td><td style="text-align:right;font-weight:700;color:var(--red)">${D.money(c.toplamGider)}</td></tr>
          </tbody></table>` : `<div class="lead">Bu tarlaya henüz gider girilmemiş. Aşağıdan "➕ Gider Ekle" ile başla.</div>`}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
            <button class="btn primary" data-add-gider>➕ Gider Ekle</button>
            <button class="btn ghost" data-add-gelir>💰 Gelir Ekle</button>
            <button class="btn ghost" data-edit>✏️ Tarlayı Düzenle</button>
            ${Export.bar('tarladetay')}
          </div>
          ${c.hareketler.length ? `<h3 style="margin:8px 0 6px;font-size:15px">📋 Hareketler (${c.hareketler.length})</h3>
          <table class="t"><thead><tr><th>Tarih</th><th>İşlem</th><th style="text-align:right">Tutar</th></tr></thead><tbody>
            ${c.hareketler.map(h => `<tr><td>${dt(h.tarih)}</td><td>${h._t === "gider" ? "🧮 " + escA(h.tur || h.kategori || "Gider") : "💰 " + escA(h.aciklama || "Gelir")}</td><td style="text-align:right;font-weight:600;color:${h._t === "gider" ? "var(--red)" : "var(--teal)"}">${h._t === "gider" ? "−" : "+"}${D.money(h.tutar)}</td></tr>`).join("")}
          </tbody></table>` : ""}
        </div>
        <div class="modal-foot"><div class="right"><button class="btn ghost" data-cancel>Kapat</button></div></div>
      </div>`;
      const close = () => ov.remove();
      ov.querySelector(".x").onclick = close;
      ov.querySelector("[data-cancel]").onclick = close;
      ov.querySelector("[data-add-gider]").onclick = () => tarlaGiderEkle(tarla.id, () => { render(); if (refreshList) refreshList(); });
      ov.querySelector("[data-add-gelir]").onclick = () => tarlaGelirForm(tarla.id, () => { render(); if (refreshList) refreshList(); });
      ov.querySelector("[data-edit]").onclick = () => { close(); tarlaEditForm(tarla, () => { if (refreshList) refreshList(); }); };
      Export.wire(ov, 'tarladetay', () => ({
        file: "TIYS-Tarla-" + tarla.ad, title: "TİYS — " + tarla.ad + " Gider/Gelir Dökümü",
        tables: [
          { name: "Gider Türleri", headers: ["Gider Türü", "Tutar (₺)"], rows: c.turRows.map(t => [t, Math.round(c.byTur[t])]).concat([["TOPLAM GİDER", Math.round(c.toplamGider)], ["TOPLAM GELİR", Math.round(c.toplamGelir)], ["NET", Math.round(c.net)]]) },
          { name: "Hareketler", headers: ["Tarih", "Yön", "Tür/Açıklama", "Tutar (₺)"], rows: c.hareketler.map(h => [dt(h.tarih), h._t === "gider" ? "Gider" : "Gelir", h._t === "gider" ? (h.tur || h.kategori || "") : (h.aciklama || ""), Math.round(Number(h.tutar) || 0)]) }
        ]
      }));
    }
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov);
    render();
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
        <div class="panel"><h3>🏭 İşletme Bilgileri</h3>
          <div class="form-grid">
            <div class="field full"><label>İşletme Adı</label><input id="s_isl" value="${a.isletmeAdi || ""}"></div>
            <div class="field"><label>Yönetici</label><input id="s_yon" value="${a.yonetici || ""}"></div>
            <div class="field"><label>Tahmini Hasat Tarihi</label><input id="s_has" type="date" value="${(a.hasatTarihi || "").slice(0, 10)}"></div>
          </div>
          <div style="margin:12px 0"><button class="btn primary" id="s_save">💾 İşletme Bilgilerini Kaydet</button></div>
          <hr style="border:0;border-top:1px solid var(--line,#e2e8f0);margin:16px 0">
          <h3 style="margin-top:0">💰 Sabit Fiyatlar — Yıl Bazında</h3>
          <p class="lead" style="margin-top:0">Gübre, işçilik, ürün fiyatı yıldan yıla değişir → <b>her yıl ayrı girilir</b>. Dashboard ve raporlar seçilen yılın fiyatını kullanır.</p>
          <div class="field" style="max-width:240px"><label>📅 Fiyat Yılı</label><select id="fy_yil"></select></div>
          <div id="fyBody" style="margin-top:10px"></div>
        </div>
        <div class="panel"><h3>☁️ Yedekleme & Veri</h3>
          <p class="lead" style="margin-top:0">Bulut senkronu eklenene kadar verini JSON dosyası olarak yedekleyip başka cihaza taşıyabilirsin.</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <button class="btn ghost" id="b_xls">📊 Tüm Verileri Excel'e Aktar</button>
            <button class="btn ghost" id="b_xls_imp">📥 Excel'den İçe Aktar (yedek/düzenleme)</button>
            <input type="file" id="b_xls_file" accept=".xlsx,.xls" class="hidden">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-bottom:4px">
              <div style="font-weight:700;margin-bottom:3px">📲 Cihaz Arası Aktar — kurulumsuz</div>
              <div class="lead" style="font-size:12.5px;margin:0 0 10px">Bir cihazda <b>Paylaş</b> → WhatsApp/e-posta ile diğerine yolla → orada <b>Gelen Veriyi Yükle</b>. Hesap/kod gerekmez.</div>
              <button class="btn primary" id="b_share" style="width:100%">📤 Veriyi Paylaş (WhatsApp · e-posta)</button>
            </div>
            <button class="btn ghost" id="b_import">📥 Gelen Veriyi Yükle</button>
            <input type="file" id="b_file" accept="application/json" class="hidden">
            <button class="btn ghost" id="b_export">⬇️ Yedek Al (JSON indir)</button>
            <button class="btn danger" id="b_reset">🧹 Verileri Temizle (gelir/gider/hasat kayıtları)</button>
            <p class="lead" style="margin:-4px 0 8px;font-size:12px;opacity:.7">Sadece girilen günlük kayıtları siler. Çeşitler/türler, sabit fiyatlar, tarlalar ve ayarlar korunur.</p>
            <button class="btn ghost" id="b_full" style="font-size:12px;opacity:.65">🗑️ Her Şeyi Sıfırla — çeşitler + tarlalar dahil (yeni işletme / satış)</button>
            <button class="btn ghost" id="b_demo" style="font-size:12px;opacity:.65">🎬 Demo verileri yükle (deneme için)</button>
          </div>
          <p class="lead" style="margin-top:14px">🔒 Tüm veri yalnızca bu cihazda saklanır.${(window.tiysFS && window.tiysFS.yol) ? ' <b>Masaüstü:</b> verileriniz <code style="font-size:11px">' + String(window.tiysFS.yol()).replace(/</g, "&lt;") + '</code> dosyasında kalıcı tutulur — programı güncellemek/yeniden kurmak verilerinizi SİLMEZ.' : ''}</p>
        </div>
      </div>
      <div class="panel" id="cloudPanel" style="margin-top:14px;max-width:540px"></div>
      <div class="panel" id="cesitPanel" style="margin-top:14px;max-width:760px"></div>
      <div class="panel" style="margin-top:14px;max-width:540px"><h3>ℹ️ Hakkında</h3>
        <div class="about-row"><b>Uygulama</b><span>TİYS — Tarım İşletme Yönetim Sistemi</span></div>
        <div class="about-row"><b>Sürüm</b><span>1.0.0</span></div>
        <div class="about-row"><b>Geliştiren</b><span>${a.gelistirici || "Rıfat Sipahioğlu"}</span></div>
        <div class="about-row"><b>İletişim</b><span><a href="mailto:${a.iletisim || "rsipahi@gmail.com"}" style="color:var(--blue)">${a.iletisim || "rsipahi@gmail.com"}</a></span></div>
        <div class="about-row"><b>Telif Hakkı</b><span>© 2026 ${a.gelistirici || "Rıfat Sipahioğlu"} · Tüm hakları saklıdır</span></div>
      </div>`;
    view.querySelector("#s_save").onclick = () => {
      const d = D.load();
      d.ayarlar.isletmeAdi = val("#s_isl"); d.ayarlar.yonetici = val("#s_yon"); d.ayarlar.hasatTarihi = val("#s_has");
      D.save(); Forms.toast("İşletme bilgileri kaydedildi ✓");
      document.getElementById("userName").textContent = d.ayarlar.yonetici || "Yönetici";
    };
    // --- Yıl bazında sabit fiyatlar ---
    const URUN_KEYS = Object.keys(D.URUNLER).filter(k => k !== "diger");
    function fiyatYillariDoldur() {
      const sel = view.querySelector("#fy_yil"); if (!sel) return;
      const simdi = new Date().getFullYear(), set = new Set(D.yillar()); set.add(simdi); set.add(simdi + 1);
      sel.innerHTML = [...set].sort((x, y) => y - x).map(y => `<option value="${y}">${y}</option>`).join("") + `<option value="__yeni">➕ Başka yıl…</option>`;
      sel.value = String(simdi);
    }
    function fiyatYilRender(yil) {
      const b = view.querySelector("#fyBody"); if (!b) return;
      b.innerHTML = `<div class="form-grid">
        <div class="field"><label>Gübre (₺/çuval)</label><input id="fy_gub" type="number" value="${D.sabitFiyat("gubreFiyat", yil)}"></div>
        <div class="field"><label>İşçilik / Yevmiye (₺/gün)</label><input id="fy_isc" type="number" value="${D.yevmiyeFor(yil)}"></div>
        <div class="field"><label>Mazot (₺/lt)</label><input id="fy_maz" type="number" value="${D.sabitFiyat("mazotFiyat", yil)}"></div></div>
        <div class="lead" style="margin:12px 0 8px;font-weight:600">🌱 Ürün Satış Fiyatları (₺/kg) — ${yil}</div>
        <div class="form-grid">${URUN_KEYS.map(k => `<div class="field"><label>${D.URUNLER[k].emoji} ${D.URUNLER[k].ad}</label><input id="fy_u_${k}" type="number" value="${D.urunFiyat(k, yil)}"></div>`).join("")}</div>
        <div style="margin-top:14px"><button class="btn primary" id="fy_save">💾 ${yil} Fiyatlarını Kaydet</button></div>`;
      b.querySelector("#fy_save").onclick = () => {
        D.setSabitFiyat("gubreFiyat", yil, +val("#fy_gub")); D.setYevmiye(yil, +val("#fy_isc")); D.setSabitFiyat("mazotFiyat", yil, +val("#fy_maz"));
        URUN_KEYS.forEach(k => D.setUrunFiyat(k, yil, +val("#fy_u_" + k)));
        Forms.toast(yil + " fiyatları kaydedildi ✓");
      };
    }
    fiyatYillariDoldur();
    const fySel = view.querySelector("#fy_yil");
    if (fySel) {
      fiyatYilRender(+fySel.value);
      fySel.onchange = () => {
        if (fySel.value === "__yeni") { const y = parseInt(prompt("Hangi yıl? (ör. 2024)"), 10); if (y > 1990 && y < 2100) { const o = document.createElement("option"); o.value = y; o.textContent = y; fySel.insertBefore(o, fySel.firstChild); fySel.value = String(y); fiyatYilRender(y); } else fiyatYillariDoldur(); return; }
        fiyatYilRender(+fySel.value);
      };
    }
    const XLS_KOLL = [["tarlalar", "Tarlalar"], ["gelirler", "Gelirler"], ["giderler", "Giderler"], ["hasatlar", "Hasatlar"], ["isTakip", "İş Takibi"], ["puantaj", "Puantaj"], ["isciKiralamalar", "İşçi Kiralamalar"]];
    view.querySelector("#b_xls").onclick = () => {
      const d = D.load();
      const tables = XLS_KOLL.filter(k => Array.isArray(d[k[0]]) && d[k[0]].length).map(k => {
        const arr = d[k[0]], keys = [];
        arr.forEach(o => Object.keys(o).forEach(kk => { if (keys.indexOf(kk) < 0) keys.push(kk); }));
        return { name: k[1], headers: keys, rows: arr.map(o => keys.map(kk => (o[kk] == null ? "" : o[kk]))) };
      });
      if (!tables.length) { Forms.toast("Aktarılacak veri yok"); return; }
      Export.excel("TIYS-TumVeri", tables);
      Forms.toast("Excel indirildi ✓");
    };
    view.querySelector("#b_xls_imp").onclick = () => view.querySelector("#b_xls_file").click();
    view.querySelector("#b_xls_file").onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      Export.importExcel(file, (err, sheets) => {
        e.target.value = "";
        if (err) { alert("Excel okunamadı: " + err.message); return; }
        const MAP = {}; XLS_KOLL.forEach(k => MAP[k[1]] = k[0]);
        const apply = [];
        Object.keys(sheets).forEach(sn => { const key = MAP[sn]; if (key && Array.isArray(sheets[sn]) && sheets[sn].length) apply.push([key, sn, sheets[sn]]); });
        if (!apply.length) { alert("Excel'de tanınan sayfa yok.\nSayfa adları şunlardan olmalı: " + XLS_KOLL.map(k => k[1]).join(", ") + ".\n(Önce 'Tüm Verileri Excel'e Aktar' ile örnek dosya alabilirsin.)"); return; }
        if (!confirm(apply.map(a => a[1]).join(", ") + " sayfaları içe aktarılacak. Bu tablolardaki MEVCUT veriler Excel'dekiyle DEĞİŞTİRİLECEK. Devam edilsin mi?")) return;
        const d = D.load();
        apply.forEach(a => { a[2].forEach(o => { if (!o.id) o.id = "imp_" + Math.random().toString(36).slice(2, 9); }); d[a[0]] = a[2]; });
        D.save(); Forms.toast(apply.length + " tablo içe aktarıldı ✓"); FIYS.route();
      });
    };
    view.querySelector("#b_share").onclick = async () => {
      const ad = "tiys-yedek-" + new Date().toISOString().slice(0, 10) + ".json";
      const veri = D.exportJSON();
      try {
        const dosya = new File([veri], ad, { type: "application/json" });
        if (navigator.canShare && navigator.canShare({ files: [dosya] })) {
          await navigator.share({ files: [dosya], title: "TİYS verisi", text: "TİYS verisi. Diğer cihazda: Ayarlar → 📥 Gelen Veriyi Yükle ile aç." });
          return;
        }
      } catch (e) { if (e && e.name === "AbortError") return; }
      // Paylaşım yoksa (masaüstü vb.): dosyayı indir, kullanıcı elle göndersin
      const blob = new Blob([veri], { type: "application/json" });
      const url = URL.createObjectURL(blob), aEl = document.createElement("a");
      aEl.href = url; aEl.download = ad; aEl.click(); URL.revokeObjectURL(url);
      Forms.toast("Dosya indirildi — WhatsApp/e-posta ile diğer cihaza gönder 📤");
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
    view.querySelector("#b_reset").onclick = () => { if (confirm("Girilen GÜNLÜK kayıtlar (gelir, gider, hasat, iş, puantaj, işçi kiralama) silinecek.\n\nÇeşitler/türler, sabit fiyatlar, tarlalar ve ayarlar KORUNACAK. Emin misin?")) { D.gunlukTemizle(); Forms.toast("Günlük kayıtlar temizlendi (çeşitler ve tarlalar korundu)"); location.hash = "#/dashboard"; FIYS.route(); } };
    var bFull = view.querySelector("#b_full"); if (bFull) bFull.onclick = () => { if (confirm("DİKKAT: Çeşitler/türler, sabit fiyatlar, tarlalar ve ayarlar DAHİL girilen HER ŞEY kalıcı silinecek; program sıfırdan, boş başlayacak (yeni işletme / satış). Emin misin?")) { D.bosla(); Forms.toast("Her şey sıfırlandı — yeni işletme"); location.hash = "#/dashboard"; FIYS.route(); } };
    var bDemo = view.querySelector("#b_demo"); if (bDemo) bDemo.onclick = () => { if (confirm("Deneme için örnek (demo) veriler yüklensin mi? Mevcut verinin yerine geçer.")) { D.reset(); Forms.toast("Demo veriler yüklendi"); location.hash = "#/dashboard"; FIYS.route(); } };

    function renderCloud() {
      const p = view.querySelector("#cloudPanel"); if (!p || typeof Cloud === "undefined") return;
      const s = Cloud.status();
      if (!s.configured) {
        p.innerHTML = `<h3>☁️ Bulut Senkron</h3><p class="lead" style="margin-top:0">Henüz kurulmadı. Kurulduğunda telefon · bilgisayar · web otomatik eşitlenir, USB ile taşımaya gerek kalmaz.</p>`;
        return;
      }
      if (!s.paired) {
        p.innerHTML = `<h3>☁️ Bulut Senkron — Eşleştirme Kodu</h3>
          <p class="lead" style="margin-top:0">Hesap/şifre yok. <b>Bir cihazda</b> "Yeni eşleştirme" ile kod üret; <b>diğer cihazlarda</b> o kodu gir. Hepsi otomatik eşitlenir.</p>
          <div style="margin-bottom:14px"><button class="btn primary" id="cl_new">✨ Yeni eşleştirme oluştur</button></div>
          <div class="field" style="max-width:320px"><label>Ya da var olan kodu gir</label><input id="cl_code" placeholder="ABCD-EFGH" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:3px;font-size:18px;font-family:monospace"></div>
          <div style="margin-top:10px"><button class="btn ghost" id="cl_join">🔗 Bu koda bağlan</button></div>
          <div class="lead" id="cl_msg" style="margin-top:10px"></div>`;
        const msg = t => p.querySelector("#cl_msg").textContent = t;
        p.querySelector("#cl_new").onclick = async () => { msg("Kod oluşturuluyor…"); const r = await Cloud.kodOlustur(); if (r.error) msg("⚠️ " + r.error); else { Forms.toast("Eşleştirme oluştu ✓"); renderCloud(); } };
        p.querySelector("#cl_join").onclick = async () => {
          const girilen = p.querySelector("#cl_code").value;
          if (Cloud.kayitSayisi && Cloud.kayitSayisi() > 0 && !confirm("Bu cihazdaki mevcut veri, koddaki ortak veriyle DEĞİŞTİRİLECEK. Devam edilsin mi?")) return;
          msg("Bağlanılıyor…"); const r = await Cloud.kodGir(girilen);
          if (r.error) msg("⚠️ " + r.error); else { Forms.toast(r.vardiVeri ? "Bağlandı, veri çekildi ✓" : "Bağlandı ✓"); renderCloud(); }
        };
      } else {
        p.innerHTML = `<h3>☁️ Bulut Senkron — Açık</h3>
          <p class="lead" style="margin-top:0">Bu kodu <b>diğer cihazlara gir</b>, hepsi eşitlensin:</p>
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0 14px">
            <span style="font-size:26px;font-weight:800;letter-spacing:3px;font-family:monospace;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 16px">${s.kod}</span>
            <button class="btn ghost" id="cl_copy">📋 Kopyala</button></div>
          <div class="about-row"><b>Durum</b><span>${s.durum === "senkron" ? "🔄 Senkronize ediliyor…" : s.durum === "cevrimdisi" ? "☁️ Çevrimdışı" : "✅ Açık"}</span></div>
          <div class="about-row"><b>Son eşitleme</b><span>${s.lastSync ? D.dateTimeTR(s.lastSync) : "—"}</span></div>
          <p class="lead">Veri girince ~1.5 sn'de buluta gider; diğer cihaza geçince anında iner.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn ghost" id="cl_push">⬆️ Şimdi Yükle</button><button class="btn ghost" id="cl_pull">⬇️ Şimdi Çek</button><button class="btn danger" id="cl_unpair">Bağlantıyı kes</button></div>`;
        p.querySelector("#cl_copy").onclick = () => { try { navigator.clipboard.writeText(s.kod); Forms.toast("Kod kopyalandı ✓"); } catch (e) { Forms.toast(s.kod); } };
        p.querySelector("#cl_push").onclick = async () => { const r = await Cloud.push(); Forms.toast(r.error ? "⚠️ " + r.error : "Buluta yüklendi ✓"); renderCloud(); };
        p.querySelector("#cl_pull").onclick = async () => { const r = await Cloud.pull(); Forms.toast(r.error ? "⚠️ " + r.error : (r.vardi ? "Buluttan çekildi ✓" : "Bulutta yeni veri yok")); };
        p.querySelector("#cl_unpair").onclick = () => { if (!confirm("Bu cihazın eşleştirmesi kaldırılsın mı? (Veri cihazda kalır)")) return; Cloud.kopar(); Forms.toast("Bağlantı kesildi"); renderCloud(); };
      }
    }
    renderCloud();

    function renderCesitler() {
      const p = view.querySelector("#cesitPanel"); if (!p) return;
      const esc = s => (s + "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
      const GELIR_DEF = ["Hasat", "İşçi Kiralama", "Ev Kira", "Diğer"];
      const defFor = k => k === "giderTurleri" ? GENEL_TUR.slice() : GELIR_DEF.slice();
      const d = D.load();
      const gider = (d.ayarlar.giderTurleri && d.ayarlar.giderTurleri.length) ? d.ayarlar.giderTurleri : GENEL_TUR.slice();
      const gelir = (d.ayarlar.gelirCesitleri && d.ayarlar.gelirCesitleri.length) ? d.ayarlar.gelirCesitleri : GELIR_DEF.slice();
      const chip = (x, key, i) => `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);padding:4px 10px;border-radius:14px;font-size:12.5px">${esc(x)} <button data-del="${key}" data-i="${i}" style="background:none;border:none;color:#f87171;cursor:pointer;font-size:13px;padding:0;line-height:1">✕</button></span>`;
      const liste = (arr, key) => arr.length ? arr.map((x, i) => chip(x, key, i)).join("") : '<span class="lead">— henüz yok —</span>';
      const inpStyle = "flex:1;padding:8px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;color:inherit";
      p.innerHTML = `<h3>🏷️ Gelir / Gider Çeşitleri</h3>
        <p class="lead" style="margin-top:0">Gelir ve gider formlarındaki açılır listelere kendi türlerini ekle/çıkar.</p>
        <div class="grid cols-2" style="align-items:start;gap:18px">
          <div>
            <div style="font-weight:600;margin-bottom:8px">🧮 Gider Türleri <span class="lead">(Genel Giderler)</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px">${liste(gider, "giderTurleri")}</div>
            <div style="display:flex;gap:7px"><input id="ce_gider" placeholder="Yeni gider türü…" style="${inpStyle}"><button class="btn ghost" data-add="giderTurleri">+ Ekle</button></div>
          </div>
          <div>
            <div style="font-weight:600;margin-bottom:8px">💰 Gelir Çeşitleri</div>
            <div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px">${liste(gelir, "gelirCesitleri")}</div>
            <div style="display:flex;gap:7px"><input id="ce_gelir" placeholder="Yeni gelir çeşidi…" style="${inpStyle}"><button class="btn ghost" data-add="gelirCesitleri">+ Ekle</button></div>
          </div>
        </div>`;
      p.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
        const k = b.getAttribute("data-del"), i = +b.getAttribute("data-i");
        const dd = D.load(); dd.ayarlar[k] = dd.ayarlar[k] || defFor(k); dd.ayarlar[k].splice(i, 1); D.save(); renderCesitler();
      });
      p.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
        const k = b.getAttribute("data-add");
        const inp = view.querySelector(k === "giderTurleri" ? "#ce_gider" : "#ce_gelir");
        const v = (inp.value || "").trim(); if (!v) return;
        const dd = D.load(); dd.ayarlar[k] = dd.ayarlar[k] || defFor(k); if (dd.ayarlar[k].indexOf(v) < 0) dd.ayarlar[k].push(v); D.save(); renderCesitler();
      });
    }
    renderCesitler();

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
    if (window.Doviz && Doviz.prefetch) Doviz.prefetch(() => route());   // USD sütunu için kurları yükle, gelince yeniden çiz
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

  function cikisYap() {
    closeSidebar();
    if (!confirm("TİYS'ten çıkmak istiyor musunuz? (Verileriniz bu cihazda saklı kalır)")) return;
    try { if (typeof Cloud !== "undefined" && Cloud.status && Cloud.status().paired) Cloud.push(); } catch (e) {}
    try { window.close(); } catch (e) {}
    setTimeout(function () {
      if (!document.hidden) {
        document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui,Arial,sans-serif;color:#475569;text-align:center;padding:24px"><div><div style="font-size:54px">🌰</div><h2 style="margin:10px 0 6px;color:#166534">TİYS kapatıldı</h2><p style="margin:0 0 16px;max-width:320px">Programdan çıktınız. Pencereyi kapatabilir veya yeniden başlatabilirsiniz.</p><button onclick="location.reload()" style="padding:11px 22px;border:0;border-radius:10px;background:#16a34a;color:#fff;font-size:15px;font-weight:600;cursor:pointer">↻ Yeniden Aç</button></div></div>';
      }
    }, 250);
  }

  // Bulut senkron durum göstergesi (topbar çipi) — babanın "senkron oluyor mu?" sorusuna görünür cevap
  function senkronGoster() {
    const el = document.getElementById("cloudChip"); if (!el) return;
    const s = (typeof Cloud !== "undefined" && Cloud.status) ? Cloud.status() : null;
    if (!s || !s.configured) { el.style.display = "none"; return; }
    el.style.display = ""; el.style.cursor = "pointer";
    el.onclick = function () { location.hash = "#/ayarlar"; };
    if (!s.paired) { el.innerHTML = "☁️ <span>Senkron kapalı · eşleştir</span>"; el.style.color = "#94a3b8"; return; }
    if (s.durum === "senkron") { el.innerHTML = "🔄 <span>Senkronize ediliyor…</span>"; el.style.color = "#2563eb"; return; }
    if (s.durum === "cevrimdisi") { el.innerHTML = "☁️ <span>Çevrimdışı — bağlanınca eşitlenir</span>"; el.style.color = "#d97706"; return; }
    el.innerHTML = "✅ <span>Senkron açık</span>"; el.style.color = "#16a34a";
  }
  window.addEventListener("tiys:cloud", senkronGoster);

  global.FIYS = { toggleSidebar, closeSidebar, route, cikisYap, senkronGoster };
  window.addEventListener("hashchange", route);
  function boot() { D.load(); initNav(); route(); senkronGoster(); }
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot); else boot();
})(window);
