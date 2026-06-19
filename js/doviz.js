/* TİYS — USD Karşılığı (tarihsel kur: Frankfurter / Avrupa Merkez Bankası, ücretsiz, key yok) */
(function (global) {
  "use strict";

  function cache() { const a = DB.load().ayarlar; if (!a.kurCache) a.kurCache = {}; return a.kurCache; }

  // Eksik tarihler için kurları tek istekte (aralık) çek, cihazda önbelleğe al.
  async function kurlariYukle(dates) {
    const c = cache();
    const eksik = dates.filter(d => !c[d]);
    if (!eksik.length) return c;
    let min = eksik[0], max = eksik[0];
    eksik.forEach(d => { if (d < min) min = d; if (d > max) max = d; });
    try {
      const r = await fetch(`https://api.frankfurter.dev/v1/${min}..${max}?from=USD&to=TRY`);
      const j = await r.json();
      if (j && j.rates) Object.keys(j.rates).forEach(d => { if (j.rates[d] && j.rates[d].TRY) c[d] = j.rates[d].TRY; });
    } catch (e) { /* internet yok */ }
    // Hiç kur gelmediyse (ör. gelecek tarihler) en güncel kuru evrensel yedek olarak al
    if (!Object.keys(c).length) {
      try { const r2 = await fetch(`https://api.frankfurter.dev/v1/latest?from=USD&to=TRY`); const j2 = await r2.json(); if (j2 && j2.rates && j2.rates.TRY && j2.date) c[j2.date] = j2.rates.TRY; } catch (e) {}
    }
    DB.save();
    return c;
  }

  // Tarihteki kuru bul; hafta sonu/tatil için en yakın iş gününe (geriye) bak.
  function kurBul(c, tarih) {
    let d = tarih;
    for (let i = 0; i < 12; i++) {
      if (c[d]) return c[d];
      const dd = new Date(d); dd.setDate(dd.getDate() - 1); d = dd.toISOString().slice(0, 10);
    }
    const keys = Object.keys(c).sort();
    return keys.length ? c[keys[keys.length - 1]] : null;
  }

  function usdFmt(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function gnTarih(s) { return (s || "").slice(0, 10).split("-").reverse().join("."); }

  async function render(view) {
    view.innerHTML = `<div class="page-head"><div><h2 style="margin:0">USD Karşılığı</h2><div class="lead">Gelir/gider, her işlemin kendi tarihindeki kurla dolara çevrilir</div></div></div>
      <div class="panel"><div class="empty"><div class="e-ico">💵</div>Tarihsel kurlar alınıyor…</div></div>`;
    const d = DB.load();
    const gel = (d.gelirler || []).map(x => Object.assign({ _tip: "gelir" }, x));
    const gid = (d.giderler || []).map(x => Object.assign({ _tip: "gider" }, x));
    const hepsi = gel.concat(gid).filter(x => x.tarih && x.tutar);
    if (!hepsi.length) { view.querySelector(".panel").innerHTML = `<div class="empty"><div class="e-ico">📭</div>Gelir/gider kaydı yok.</div>`; return; }
    const dates = Array.from(new Set(hepsi.map(x => (x.tarih || "").slice(0, 10))));
    const c = await kurlariYukle(dates);

    let gelTRY = 0, gidTRY = 0, gelUSD = 0, gidUSD = 0;
    const rows = hepsi.sort((a, b) => (b.tarih || "").localeCompare(a.tarih || "")).map(x => {
      const kur = kurBul(c, (x.tarih || "").slice(0, 10));
      const usd = kur ? x.tutar / kur : null;
      if (x._tip === "gelir") { gelTRY += x.tutar; gelUSD += usd || 0; } else { gidTRY += x.tutar; gidUSD += usd || 0; }
      const renk = x._tip === "gelir" ? "#16a34a" : "#dc2626";
      return `<tr style="border-bottom:1px solid var(--line,#2a3a4a)">
        <td style="padding:8px 6px;white-space:nowrap">${gnTarih(x.tarih)}</td>
        <td style="padding:8px 6px"><span style="color:${renk};font-weight:600">${x._tip === "gelir" ? "Gelir" : "Gider"}</span></td>
        <td style="padding:8px 6px">${(x.cesit || x.tur || x.aciklama || "—")}</td>
        <td style="padding:8px 6px;text-align:right;white-space:nowrap">${DB.money(x.tutar)}</td>
        <td style="padding:8px 6px;text-align:right;font-weight:700;white-space:nowrap">${usd != null ? usdFmt(usd) : "—"}</td>
        <td style="padding:8px 6px;text-align:right;color:var(--muted,#94a3b8);font-size:11px">${kur ? kur.toFixed(2) : "—"}</td></tr>`;
    }).join("");

    const netUSD = gelUSD - gidUSD;
    const kpi = (l, v, col) => `<div class="panel" style="margin:0"><div class="lead">${l}</div><div style="font-size:23px;font-weight:800;color:${col}">${v}</div></div>`;
    view.innerHTML = `<div class="page-head"><div><h2 style="margin:0">USD Karşılığı</h2><div class="lead">Her işlem kendi tarihindeki USD/TRY kuruyla dolara çevrildi</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px">
        ${kpi("Toplam Gelir (USD)", usdFmt(gelUSD), "#16a34a")}
        ${kpi("Toplam Gider (USD)", usdFmt(gidUSD), "#dc2626")}
        ${kpi("Net (USD)", (netUSD < 0 ? "-" : "") + usdFmt(Math.abs(netUSD)), "#2563eb")}
      </div>
      <div class="panel"><h3>📋 Tüm İşlemler — ₺ → $ (tarihsel kur)</h3>
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="border-bottom:2px solid var(--line,#2a3a4a);text-align:left;color:var(--muted,#94a3b8);font-size:11.5px">
            <th style="padding:8px 6px">Tarih</th><th style="padding:8px 6px">Tip</th><th style="padding:8px 6px">Açıklama</th>
            <th style="padding:8px 6px;text-align:right">TRY</th><th style="padding:8px 6px;text-align:right">USD</th><th style="padding:8px 6px;text-align:right">Kur</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
        <p class="lead" style="margin-top:12px">💱 Kur kaynağı: <b>Frankfurter / Avrupa Merkez Bankası (ECB)</b> günlük referans kuru — TCMB'ye çok yakındır. Hafta sonu/tatil tarihleri için en yakın iş günü kuru kullanılır. Kurlar cihazda önbelleğe alınır (tekrar internet gerekmez). Gelecek tarihli kayıtlarda en güncel kur baz alınır.</p></div>`;
  }

  // Bir tutarı tarihindeki kurla USD'ye çevir (önbellekten, senkron). Liste sütunları için.
  function usdStr(tutar, tarih) {
    if (!tutar || !tarih) return "—";
    const kur = kurBul(cache(), (tarih + "").slice(0, 10));
    return kur ? usdFmt(tutar / kur) : "—";
  }
  // Gelir/gider tarihlerinin kurlarını arka planda yükle; YENİ kur geldiyse 1 kez yeniden çiz.
  // ⚠️ DÖNGÜ KORUMASI: route() her çizimde prefetch çağırır; prefetch de (yeni kur gelince)
  // route()'u geri çağırır. Çıkış koşulu KESİN sonlanmazsa sonsuz döngü olur → sayfa sürekli
  // yanıp söner, butonlar/formlar çalışmaz (her ekran genişliğinde). Çözüm: her tarih ÖMÜR BOYU
  // EN FAZLA 1 KEZ denenir (denenen{}). Hafta sonu/tatil/offline kuru hiç cache'lenmese bile o
  // tarih "denenen" olduğu için bir daha listeye girmez → eksik er ya da geç boşalır → döngü biter.
  // (baslatildi gibi tek-sefer bayrağı KULLANMA: import/bulut sonrası yeni tarihler için USD çekmez.)
  var denenen = {};
  function prefetch(cb) {
    const d = DB.load();
    const hepsi = [].concat(d.gelirler || [], d.giderler || []).filter(x => x.tarih && x.tutar);
    const dates = Array.from(new Set(hepsi.map(x => (x.tarih + "").slice(0, 10))));
    const eksik = dates.filter(dt => !cache()[dt] && !denenen[dt]);
    if (!eksik.length) return;                          // denenmemiş yeni tarih yok → ÇIK (döngü imkânsız)
    eksik.forEach(dt => denenen[dt] = true);             // her tarih en fazla 1 kez denenir
    const oncekiBoyut = Object.keys(cache()).length;
    kurlariYukle(eksik).then(function () {
      // SADECE gerçekten yeni kur eklendiyse 1 kez yeniden çiz (offline/engelli → çizim yok, kesinti yok)
      if (cb && Object.keys(cache()).length > oncekiBoyut) cb();
    });
  }

  global.Doviz = { render, usdStr, prefetch };
})(window);
