/* TİYS — Raporlar + Analiz Merkezi */
(function (global) {
  "use strict";
  const YIL = 2026;
  let _charts = [];
  function destroy() { _charts.forEach(c => { try { c.destroy(); } catch (e) {} }); _charts = []; }
  function escR(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // Tarla bazlı tahmini kârlılık (gelir = son verim × dekar × satış fiyatı; gider = dekar payı)
  function tarlaKarlilik() {
    const tarlalar = DB.coll("tarlalar");
    const totalGider = DB.toplamGider(YIL), totalDekar = DB.toplamDekar() || 1;
    return tarlalar.map(t => {
      const uretim = (t.sonVerimKgDekar || 0) * (t.alanDekar || 0);
      const gelir = uretim * DB.urunFiyat(t.urun);
      const gider = totalGider * ((t.alanDekar || 0) / totalDekar);
      return { ad: t.ad, urun: t.urun, dekar: t.alanDekar, uretim, gelir, gider, kar: gelir - gider, kgDekar: t.sonVerimKgDekar || 0, verim: t.verimPuani || 0 };
    }).sort((a, b) => b.kar - a.kar);
  }

  function karRapor(view) {
    destroy();
    const gelir = DB.toplamGelir(YIL), gider = DB.toplamGider(YIL), net = gelir - gider;
    const tk = tarlaKarlilik();
    const tarlalar = DB.coll("tarlalar");
    view.innerHTML = `
      <div class="page-head"><div><h2 style="margin:0">Raporlar</h2><div class="lead">Kârlılık · Verimlilik · ${YIL} yılı</div></div><div style="display:flex;gap:8px;flex-wrap:wrap">${Export.bar('rapor')}</div></div>
      <div class="kpis" style="grid-template-columns:repeat(3,1fr);max-width:680px">
        ${rc("teal", "Toplam Gelir", DB.money(gelir))}${rc("red", "Toplam Gider", DB.money(gider))}${rc("blue", "Net Kâr", DB.money(net))}
      </div>
      <div class="grid cols-2" style="margin-top:16px;align-items:start">
        <div class="panel"><h3>🏞️ Tarla Bazlı Kârlılık (tahmini)</h3>
          <div style="position:relative;height:260px"><canvas id="karChart"></canvas></div>
          <p class="lead" style="margin-top:8px">Gelir = son verim × dekar × satış fiyatı · Gider = dekar payı</p></div>
        <div class="panel"><h3>📋 Kârlılık Tablosu</h3>
          <table class="t"><thead><tr><th>Tarla</th><th>Gelir</th><th>Gider</th><th>Kâr</th></tr></thead><tbody>
          ${tk.map(t => `<tr><td>${t.ad}</td><td>${DB.money(t.gelir)}</td><td>${DB.money(t.gider)}</td>
            <td style="color:${t.kar >= 0 ? "var(--green)" : "var(--red)"};font-weight:700">${DB.money(t.kar)}</td></tr>`).join("")}
          </tbody></table></div>
      </div>
      <div class="grid cols-2" style="margin-top:14px;align-items:start">
        <div class="panel"><h3>📊 Verimlilik (kg/dekar)</h3>
          <div style="position:relative;height:240px"><canvas id="verimChart"></canvas></div></div>
        <div class="panel"><h3>📈 Yıllık Karşılaştırma</h3>
          <div style="position:relative;height:240px"><canvas id="yilChart"></canvas></div>
          <p class="lead" style="margin-top:8px">Veri biriktikçe 5–10 yıllık karşılaştırma otomatik dolacak.</p></div>
      </div>
      <div class="panel" style="margin-top:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px">
          <h3 style="margin:0">🗺️ Tarla Bazlı Gider Sorgu</h3>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select id="rTarlaSec" style="padding:8px 11px;border:1px solid var(--line,#d1d5db);border-radius:9px;font-family:inherit;font-size:13px;background:#fff;color:var(--ink,#111)">
              <option value="__all">📊 Tüm Tarlalar (özet)</option>
              ${tarlalar.map(t => `<option value="${escR(t.id)}">${escR(t.ad)}</option>`).join("")}
            </select>
            ${Export.bar('rtarla')}
          </div>
        </div>
        <p class="lead" style="margin-top:0">Bir tarla seç → o tarlada hangi gider türünden ne kadar harcandığını gör. "Tüm Tarlalar" tüm tarlaların gider toplamını listeler.</p>
        <div id="rTarlaGider" style="margin-top:8px"></div>
      </div>`;

    _charts.push(new Chart(document.getElementById("karChart"), {
      type: "bar",
      data: { labels: tk.map(t => t.ad), datasets: [
        { label: "Gelir", data: tk.map(t => Math.round(t.gelir)), backgroundColor: "#22c55e" },
        { label: "Gider", data: tk.map(t => Math.round(t.gider)), backgroundColor: "#ef4444" }] },
      options: { plugins: { legend: { position: "top", align: "end" } }, scales: { x: { ticks: { maxRotation: 60, minRotation: 45, font: { size: 10 } } }, y: { ticks: { callback: v => (v / 1000) + "K" } } }, maintainAspectRatio: false }
    }));
    _charts.push(new Chart(document.getElementById("verimChart"), {
      type: "bar",
      data: { labels: tk.map(t => t.ad), datasets: [{ label: "kg/dekar", data: tk.map(t => t.kgDekar), backgroundColor: tk.map(t => t.verim >= 85 ? "#16a34a" : t.verim >= 75 ? "#84cc16" : t.verim >= 70 ? "#f59e0b" : "#ef4444") }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 60, minRotation: 45, font: { size: 10 } } } }, maintainAspectRatio: false }
    }));
    // yıllık (şimdilik tek yıl; gerçek yıllar biriktikçe çoğalır)
    const yillar = {}; ["gelirler", "giderler"].forEach(() => {});
    DB.coll("gelirler").forEach(g => { const y = new Date(g.tarih).getFullYear(); (yillar[y] = yillar[y] || { g: 0, e: 0 }).g += g.tutar || 0; });
    DB.coll("giderler").forEach(g => { const y = new Date(g.tarih).getFullYear(); (yillar[y] = yillar[y] || { g: 0, e: 0 }).e += g.tutar || 0; });
    const yl = Object.keys(yillar).sort();
    _charts.push(new Chart(document.getElementById("yilChart"), {
      type: "bar",
      data: { labels: yl, datasets: [
        { label: "Gelir", data: yl.map(y => Math.round(yillar[y].g)), backgroundColor: "#22c55e" },
        { label: "Gider", data: yl.map(y => Math.round(yillar[y].e)), backgroundColor: "#ef4444" },
        { label: "Net", data: yl.map(y => Math.round(yillar[y].g - yillar[y].e)), backgroundColor: "#3b82f6" }] },
      options: { plugins: { legend: { position: "top", align: "end" } }, scales: { y: { ticks: { callback: v => (v / 1000) + "K" } } }, maintainAspectRatio: false }
    }));

    Export.wire(view, 'rapor', () => ({
      file: "TIYS-Rapor", title: "TİYS — Kârlılık ve Verimlilik Raporu (" + YIL + ")",
      tables: [
        { name: "Özet", headers: ["Kalem", "Tutar (₺)"], rows: [["Toplam Gelir", Math.round(gelir)], ["Toplam Gider", Math.round(gider)], ["Net Kâr", Math.round(net)]] },
        { name: "Kârlılık", headers: ["Tarla", "Ürün", "Dekar", "Gelir (₺)", "Gider (₺)", "Kâr (₺)"], rows: tk.map(t => [t.ad, (DB.urun(t.urun) || {}).ad || t.urun || "—", t.dekar || 0, Math.round(t.gelir), Math.round(t.gider), Math.round(t.kar)]) },
        { name: "Verimlilik", headers: ["Tarla", "kg/dekar", "Verim %"], rows: tk.map(t => [t.ad, t.kgDekar || 0, t.verim || 0]) }
      ]
    }));

    function rTarlaRender() {
      const sel = view.querySelector("#rTarlaSec").value, box = view.querySelector("#rTarlaGider"), gid = DB.coll("giderler");
      if (sel === "__all") {
        const map = {}; let genel = 0;
        gid.forEach(g => { if (g.tarlaId) map[g.tarlaId] = (map[g.tarlaId] || 0) + (Number(g.tutar) || 0); else genel += (Number(g.tutar) || 0); });
        const rows = DB.coll("tarlalar").map(t => ({ ad: t.ad, tutar: map[t.id] || 0 })).filter(r => r.tutar > 0).sort((a, b) => b.tutar - a.tutar);
        const toplam = rows.reduce((a, x) => a + x.tutar, 0) + genel;
        box.innerHTML = (rows.length || genel > 0) ? `<table class="t"><thead><tr><th>Tarla</th><th style="text-align:right">Toplam Gider</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td>${escR(r.ad)}</td><td style="text-align:right;font-weight:600">${DB.money(r.tutar)}</td></tr>`).join("")}
          ${genel > 0 ? `<tr><td style="color:var(--muted)">— Tarlasız (genel) —</td><td style="text-align:right">${DB.money(genel)}</td></tr>` : ""}
          <tr style="border-top:2px solid var(--line,#e5e7eb)"><td style="font-weight:700">TOPLAM</td><td style="text-align:right;font-weight:700;color:var(--red)">${DB.money(toplam)}</td></tr>
        </tbody></table>` : `<div class="lead">Henüz tarlaya bağlı gider girilmemiş. Gider eklerken "Tarla" seç ya da Tarla Yönetimi → tarlaya tıkla → Gider Ekle.</div>`;
      } else {
        const f = gid.filter(g => g.tarlaId === sel), byTur = {};
        f.forEach(g => { const k = g.tur || "Diğer"; byTur[k] = (byTur[k] || 0) + (Number(g.tutar) || 0); });
        const keys = Object.keys(byTur).sort((a, b) => byTur[b] - byTur[a]), toplam = keys.reduce((a, k) => a + byTur[k], 0);
        box.innerHTML = keys.length ? `<table class="t"><thead><tr><th>Gider Türü</th><th style="text-align:right">Tutar</th></tr></thead><tbody>
          ${keys.map(k => `<tr><td>${escR(k)}</td><td style="text-align:right;font-weight:600">${DB.money(byTur[k])}</td></tr>`).join("")}
          <tr style="border-top:2px solid var(--line,#e5e7eb)"><td style="font-weight:700">TOPLAM</td><td style="text-align:right;font-weight:700;color:var(--red)">${DB.money(toplam)}</td></tr>
        </tbody></table>` : `<div class="lead">Bu tarlaya bağlı gider yok.</div>`;
      }
    }
    view.querySelector("#rTarlaSec").onchange = rTarlaRender;
    rTarlaRender();
    Export.wire(view, 'rtarla', () => {
      const sel = view.querySelector("#rTarlaSec").value, gid = DB.coll("giderler");
      if (sel === "__all") {
        const map = {}; let genel = 0;
        gid.forEach(g => { if (g.tarlaId) map[g.tarlaId] = (map[g.tarlaId] || 0) + (Number(g.tutar) || 0); else genel += (Number(g.tutar) || 0); });
        const rows = DB.coll("tarlalar").map(t => [t.ad, Math.round(map[t.id] || 0)]).filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
        if (genel > 0) rows.push(["— Tarlasız (genel) —", Math.round(genel)]);
        return { file: "TIYS-Tarla-Gider-Ozet", title: "TİYS — Tarla Bazlı Gider Özeti", tables: [{ name: "Tarla Giderleri", headers: ["Tarla", "Toplam Gider (₺)"], rows }] };
      }
      const t = DB.coll("tarlalar").find(x => x.id === sel) || {}, f = gid.filter(g => g.tarlaId === sel), byTur = {};
      f.forEach(g => { const k = g.tur || "Diğer"; byTur[k] = (byTur[k] || 0) + (Number(g.tutar) || 0); });
      const rows = Object.keys(byTur).sort((a, b) => byTur[b] - byTur[a]).map(k => [k, Math.round(byTur[k])]);
      return { file: "TIYS-Tarla-Gider-" + (t.ad || ""), title: "TİYS — " + (t.ad || "Tarla") + " Gider Dökümü", tables: [{ name: "Gider Türleri", headers: ["Gider Türü", "Tutar (₺)"], rows }] };
    });
  }
  function rc(cls, l, v) { return `<div class="kpi ${cls}" style="min-height:auto;padding:14px"><div class="k-label">${l}</div><div class="k-val" style="font-size:21px">${v}</div></div>`; }

  // ---- Analiz Merkezi (senaryo) ----
  function analizPage(view) {
    destroy();
    const a = DB.load().ayarlar;
    const baseFiyat = a.findikSatisFiyat || 250;
    const gelirT = DB.toplamGelir(YIL), giderT = DB.toplamGider(YIL);
    const hasat = DB.coll("gelirler").filter(g => g.tur === "hasat").reduce((s, g) => s + (g.tutar || 0), 0);
    const digerGelir = gelirT - hasat;
    const gd = DB.giderDagilimi(YIL);
    const baseIscilik = gd["İşçilik"] || 0, baseGubre = gd["Gübre"] || 0;
    const digerGider = giderT - baseIscilik - baseGubre;
    const baseNet = gelirT - giderT;

    view.innerHTML = `
      <div class="page-head"><div><h2 style="margin:0">Analiz Merkezi</h2><div class="lead">Senaryo değiştir, kâr-zarar anında hesaplansın</div></div></div>
      <div class="panel">
        <h3>🔬 Senaryo Değişkenleri</h3>
        <div class="scn-grid">
          ${slider("fiyat", "Ürün Fiyatları Değişimi", 0, -50, 100, 1, "%")}
          ${slider("verim", "Verim Değişimi", 0, -50, 50, 1, "%")}
          ${slider("iscilik", "İşçilik Maliyeti Değişimi", 0, -30, 50, 1, "%")}
          ${slider("gubre", "Gübre Maliyeti Değişimi", 0, -30, 50, 1, "%")}
        </div>
        <div class="result-cards">
          <div class="rc" style="background:linear-gradient(135deg,#64748b,#475569)"><div class="l">Mevcut Net Kâr</div><div class="v">${DB.money(baseNet)}</div></div>
          <div class="rc" id="rcNet" style="background:linear-gradient(135deg,#22c55e,#16a34a)"><div class="l">Senaryo Net Kâr</div><div class="v" id="scnNet">—</div></div>
          <div class="rc" id="rcFark" style="background:linear-gradient(135deg,#3b82f6,#2563eb)"><div class="l">Fark</div><div class="v" id="scnFark">—</div></div>
        </div>
        <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="scn"><div class="lab">Senaryo Hasat Geliri</div><div class="v" id="scnHasat">—</div></div>
          <div class="scn"><div class="lab">Senaryo Toplam Gider</div><div class="v" id="scnGider" style="color:var(--red)">—</div></div>
        </div>
        <p class="lead" style="margin-top:12px">Temel veriler ${YIL} kayıtlarından alınır; fiyat değişimi tüm ürünlere birlikte uygulanır.</p>
      </div>`;

    function val(id) { return +view.querySelector("#sl_" + id).value; }
    function recompute() {
      const fD = val("fiyat") / 100, vD = val("verim") / 100, iD = val("iscilik") / 100, gD = val("gubre") / 100;
      ["fiyat", "verim", "iscilik", "gubre"].forEach(k => { view.querySelector("#lbl_" + k).textContent = view.querySelector("#sl_" + k).value + "%"; });
      const yeniHasat = hasat * (1 + fD) * (1 + vD);
      const yeniGelir = yeniHasat + digerGelir;
      const yeniGider = baseIscilik * (1 + iD) + baseGubre * (1 + gD) + digerGider;
      const yeniNet = yeniGelir - yeniGider, fark = yeniNet - baseNet;
      view.querySelector("#scnNet").textContent = DB.money(yeniNet);
      view.querySelector("#scnHasat").textContent = DB.money(yeniHasat);
      view.querySelector("#scnGider").textContent = DB.money(yeniGider);
      view.querySelector("#scnFark").textContent = (fark >= 0 ? "+" : "") + DB.money(fark);
      view.querySelector("#rcNet").style.background = yeniNet >= baseNet ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#f59e0b,#ea7317)";
      view.querySelector("#rcFark").style.background = fark >= 0 ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "linear-gradient(135deg,#ef4444,#dc2626)";
    }
    view.querySelectorAll("input[type=range]").forEach(s => s.addEventListener("input", recompute));
    recompute();
  }
  function slider(id, label, val, min, max, step, unit) {
    return `<div class="scn"><div class="lab">${label}: <span class="v" id="lbl_${id}">${val}${unit === "%" ? "%" : " " + unit}</span></div>
      <input type="range" id="sl_${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
  }

  global.Reports = { karRapor, analizPage, destroy };
})(window);
