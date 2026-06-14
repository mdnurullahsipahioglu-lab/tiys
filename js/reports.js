/* TİYS — Raporlar + Analiz Merkezi */
(function (global) {
  "use strict";
  const YIL = 2026;
  let _charts = [];
  function destroy() { _charts.forEach(c => { try { c.destroy(); } catch (e) {} }); _charts = []; }

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
    view.innerHTML = `
      <div class="page-head"><div><h2 style="margin:0">Raporlar</h2><div class="lead">Kârlılık · Verimlilik · ${YIL} yılı</div></div></div>
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
