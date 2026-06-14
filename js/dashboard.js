/* TİYS — Dashboard modülü (mockup birebir, gerçek veriden) */
(function (global) {
  "use strict";
  const YIL = 2026;
  let _charts = [], _map = null;

  const PALETTE = {
    gider: { "İşçilik": "#2563eb", "Gübre": "#22c55e", "Yakıt": "#f59e0b", "Makine": "#06b6d4", "Ekipman": "#a855f7", "Diğer": "#ef4444" },
    gelir: { "Hasat Geliri": "#14b8a6", "İşçi Kiralama": "#f59e0b", "Ev Kira": "#ef4444" }
  };
  const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function destroy() { _charts.forEach(c => { try { c.destroy(); } catch (e) {} }); _charts = []; if (_map) { try { _map.remove(); } catch (e) {} _map = null; } }

  function pct(part, whole) { return whole ? Math.round(part / whole * 100) : 0; }
  function donutLegend(map, total) {
    return Object.keys(map).filter(k => map[k] > 0).map(k =>
      `<div class="li"><span class="dot" style="background:${colorFor(k)}"></span>${k}<span class="pct">%${pct(map[k], total)}</span></div>`
    ).join("");
  }
  function colorFor(k) { return PALETTE.gider[k] || PALETTE.gelir[k] || "#94a3b8"; }
  function urunOzet() {
    const map = {};
    DB.coll("tarlalar").forEach(x => { const u = x.urun || "findik"; (map[u] = map[u] || { urun: u, adet: 0, dekar: 0 }); map[u].adet++; map[u].dekar += (Number(x.alanDekar) || 0); });
    return Object.values(map).sort((a, b) => b.dekar - a.dekar);
  }

  function render(view) {
    destroy();
    const gelir = DB.toplamGelir(YIL), gider = DB.toplamGider(YIL), net = gelir - gider;
    const tarlalar = DB.coll("tarlalar"), dekar = DB.toplamDekar();
    const isci = DB.load().aktifIsci || 0;
    const giderD = DB.giderDagilimi(YIL), gelirD = DB.gelirDagilimi(YIL);
    const sira = DB.tarlaVerimSirasi();
    const isler = DB.coll("isler").slice().sort((a, b) => new Date(a.tarih) - new Date(b.tarih)).slice(0, 5);
    const kiralar = DB.coll("isciKiralamalar").slice().sort((a, b) => new Date(b.tarih) - new Date(a.tarih)).slice(0, 5);
    const borcOzet = DB.musteriOzet();
    const borclu = borcOzet.filter(o => o.kalan > 0.5);
    const toplamAlacak = borcOzet.reduce((a, x) => a + x.kalan, 0);
    const urunler = urunOzet();

    // hasat geri sayımı
    const hasatT = new Date(DB.load().ayarlar.hasatTarihi);
    const gunKaldi = Math.max(0, Math.ceil((hasatT - new Date(2026, 5, 13)) / 86400000));

    view.innerHTML = `
    <!-- KPI -->
    <div class="kpis">
      ${kpi("green", "💰", "Toplam Gelir", DB.money(gelir), "Bu Yıl", "▲ %18.5")}
      ${kpi("red", "🧮", "Toplam Gider", DB.money(gider), "Bu Yıl", "▲ %12.3")}
      ${kpi("blue", "📈", "Net Kâr", DB.money(net), "Bu Yıl", "▲ %29.4")}
      ${kpi("orange", "🏞️", "Toplam Tarla", tarlalar.length, "Toplam", "")}
      ${kpi("purple", "🌿", "Toplam Dekar", DB.num(dekar), "Dekar", "")}
      ${kpi("teal", "👷", "Aktif İşçi", isci, "Kişi", "")}
    </div>

    <!-- Trend + 2 donut + takvim -->
    <div class="grid cols-3" style="margin-bottom:14px">
      <div class="panel">
        <div class="h-row"><h3>📊 Gelir – Gider Trend Analizi (Aylık)</h3></div>
        <div style="position:relative;height:200px"><canvas id="trendChart"></canvas></div>
      </div>
      <div class="panel">
        <h3>Gider Dağılımı</h3>
        <div class="donut-wrap"><div style="position:relative;height:150px"><canvas id="giderDonut"></canvas></div>
          <div class="legend">${donutLegend(giderD, gider)}</div></div>
      </div>
      <div class="panel">
        <div class="h-row"><h3>Yaklaşan İşler Takvimi</h3><span class="soon">Tümü</span></div>
        ${isler.map(taskRow).join("") || '<div class="empty">İş yok</div>'}
      </div>
    </div>

    <!-- Gelir donut + harita + hava + geri sayım -->
    <div class="grid" style="grid-template-columns:1fr;gap:14px">
      <div class="grid cols-3">
        <div class="panel">
          <h3>Gelir Dağılımı</h3>
          <div class="donut-wrap"><div style="position:relative;height:150px"><canvas id="gelirDonut"></canvas></div>
            <div class="legend">${donutLegend(gelirD, gelir)}</div></div>
        </div>
        <div class="panel" style="grid-column:span 2">
          <div class="h-row"><h3>🗺️ Tarla Haritası</h3>
            <div class="tab-mini"><button class="on" id="mapNormal">Harita</button><button id="mapSat">Uydu</button></div></div>
          <div class="map" id="tarlaMap"></div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="panel">
          <h3>🌦️ Hava Durumu ve Uyarılar</h3>
          <div class="weather-head">
            <div class="big">🌧️</div>
            <div><div class="temp">24°C</div><div class="desc">Az Bulutlu</div></div>
          </div>
          <div class="wx-row">
            <div class="wx"><div class="v">%65</div><div class="l">💧 Nem</div></div>
            <div class="wx"><div class="v">15 km/s</div><div class="l">🌬️ Rüzgar</div></div>
            <div class="wx"><div class="v">%30</div><div class="l">🌧️ Yağış</div></div>
          </div>
          <div class="alert">⚠️ <div><b>UYARI</b><br>Önümüzdeki 5 gün yağış bekleniyor. İlaçlama önerilmez.</div></div>
          <div class="risk-row">
            <div class="risk">❄️ Don Riski<b>Düşük</b></div>
            <div class="risk">🌧️ Yağış Riski<b>Orta</b></div>
            <div class="risk">🌬️ Rüzgar<b>Orta</b></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="countdown">
            <div>📅</div>
            <div><div><span class="num">${gunKaldi}</span> <span class="lab">Gün Kaldı</span></div>
              <div class="lab" style="margin-top:8px">Tahmini Hasat Tarihi<br><b style="font-size:15px">${DB.dateTR(hasatT)}</b></div></div>
            <div class="pic">🌰</div>
          </div>
          ${aiPanel()}
        </div>
      </div>

      <!-- Ürün dağılımı (çoklu ürün) -->
      <div class="panel">
        <div class="h-row"><h3>🌱 Ürün Dağılımı</h3><span class="lead" style="font-size:12px">${urunler.length} ürün · ${tarlalar.length} tarla</span></div>
        <div class="urun-strip">
          ${urunler.map(u => `<div class="urun-item"><div class="ue">${DB.urun(u.urun).emoji}</div>
            <div><b>${DB.urun(u.urun).ad}</b><div class="lead" style="font-size:11.5px">${u.adet} tarla · ${DB.num(u.dekar)} dekar</div></div></div>`).join("")}
        </div>
      </div>

      <!-- Alt: 3'lü -->
      <div class="grid cols-trio">
        <div class="panel">
          <h3>🏞️ Tarla Verimlilik Sıralaması</h3>
          <table class="t"><thead><tr><th>#</th><th>Tarla Adı</th><th>Verim</th><th>Puan</th></tr></thead><tbody>
          ${sira.slice(0, 6).map((t, i) => `<tr><td><span class="rank">${i + 1}</span></td><td>${t.ad}</td>
            <td>${DB.num(t.kgDekar)} kg/dekar</td>
            <td><div style="display:flex;align-items:center;gap:6px"><div class="bar" style="width:60px"><span style="width:${t.puan}%;background:${barColor(t.puan)}"></span></div>%${t.puan}</div></td></tr>`).join("")}
          </tbody></table>
        </div>
        <div class="panel">
          <h3>📊 En Yüksek Gider Kalemleri</h3>
          ${Object.keys(giderD).filter(k => giderD[k] > 0).sort((a, b) => giderD[b] - giderD[a]).slice(0, 6).map(k =>
            `<div class="hbar-row"><span class="lbl">${k}</span><div class="bar"><span style="width:${pct(giderD[k], gider)}%;background:${colorFor(k)}"></span></div><span class="pct">%${pct(giderD[k], gider)}</span></div>`).join("")}
        </div>
        <div class="panel" id="alacakPanel" style="cursor:pointer">
          <div class="h-row"><h3>💵 Tahsil Edilecek Alacaklar</h3>${borclu.length ? `<span class="soon">${borclu.length} borçlu</span>` : ""}</div>
          ${borclu.length ? `<div style="font-size:23px;font-weight:800;color:#f59e0b;margin:2px 0 10px">${DB.money(toplamAlacak)}</div>
          <table class="t"><tbody>
          ${borclu.slice(0, 5).map(o => `<tr><td>${o.musteri}</td><td style="text-align:right;font-weight:700;color:#f59e0b">${DB.money(o.kalan)}</td></tr>`).join("")}
          </tbody></table>
          <div class="lead" style="margin-top:8px;font-size:11.5px">İşçi Kiralama sayfasına git →</div>`
          : `<div class="empty"><div class="e-ico">🟢</div>Tüm müşteri hesapları kapalı.<br>Bekleyen alacağın yok.</div>`}
        </div>
      </div>
    </div>`;

    initCharts(giderD, gider, gelirD, gelir);
    initMap(tarlalar);
    bindAI();
    const ap = view.querySelector("#alacakPanel"); if (ap) ap.onclick = () => { location.hash = "#/isci-kiralama"; };
  }

  function kpi(cls, ico, label, val, foot, trend) {
    return `<div class="kpi ${cls}"><div class="k-ico">${ico}</div>
      <div class="k-label">${label}</div><div class="k-val">${val}</div>
      <div class="k-foot"><span>${foot}</span><span class="trend">${trend}</span></div></div>`;
  }
  function barColor(p) { return p >= 85 ? "#22c55e" : p >= 75 ? "#84cc16" : p >= 70 ? "#f59e0b" : "#ef4444"; }
  function taskRow(it) {
    const d = new Date(it.tarih), p = (v) => String(v).padStart(2, "0");
    return `<div class="task"><div class="cal"><span class="d">${p(d.getDate())}</span><span class="m">${AYLAR[d.getMonth()].slice(0, 3)}</span></div>
      <div class="t-body"><div class="t-title">${it.baslik}</div><div class="t-sub">${DB.dateTR(d)} ${p(d.getHours())}.${p(d.getMinutes())}</div></div></div>`;
  }

  function initCharts(giderD, gToplam, gelirD, gelToplam) {
    const trend = DB.aylikTrend(YIL);
    _charts.push(new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: AYLAR,
        datasets: [
          { label: "Gelir", data: trend.map(t => t.gelir), borderColor: "#16a34a", backgroundColor: "rgba(34,197,94,.12)", fill: true, tension: .4, pointBackgroundColor: "#16a34a" },
          { label: "Gider", data: trend.map(t => t.gider), borderColor: "#dc2626", backgroundColor: "rgba(239,68,68,.10)", fill: true, tension: .4, pointBackgroundColor: "#dc2626" }
        ]
      },
      options: { plugins: { legend: { position: "top", align: "end", labels: { boxWidth: 12, usePointStyle: true } } }, scales: { y: { ticks: { callback: v => (v / 1000) + "K" } } }, maintainAspectRatio: false }
    }));
    const donut = (id, map) => new Chart(document.getElementById(id), {
      type: "doughnut",
      data: { labels: Object.keys(map), datasets: [{ data: Object.values(map), backgroundColor: Object.keys(map).map(colorFor), borderWidth: 2, borderColor: "#fff" }] },
      options: { cutout: "68%", plugins: { legend: { display: false } }, maintainAspectRatio: true }
    });
    _charts.push(donut("giderDonut", filterPos(giderD)));
    _charts.push(donut("gelirDonut", filterPos(gelirD)));
  }
  function filterPos(m) { const o = {}; Object.keys(m).forEach(k => { if (m[k] > 0) o[k] = m[k]; }); return o; }

  function initMap(tarlalar) {
    const el = document.getElementById("tarlaMap"); if (!el || !global.L) return;
    const c = DB.load().ayarlar.konum;
    _map = L.map(el, { scrollWheelZoom: false }).setView([c.lat, c.lng], 13);
    const normal = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap", maxZoom: 19 });
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "© Esri", maxZoom: 19 });
    normal.addTo(_map);
    tarlalar.forEach(t => {
      if (t.lat == null) return;
      const color = t.verimPuani >= 85 ? "#16a34a" : t.verimPuani >= 75 ? "#84cc16" : t.verimPuani >= 70 ? "#f59e0b" : "#dc2626";
      const icon = L.divIcon({ className: "", html: `<div style="background:${color};color:#fff;border-radius:10px;padding:3px 7px;font:600 11px sans-serif;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3);transform:translate(-50%,-100%)">📍 ${t.ad}<br><span style="opacity:.9">Verim %${t.verimPuani}</span></div>`, iconSize: [0, 0] });
      L.marker([t.lat, t.lng], { icon }).addTo(_map);
    });
    const nb = document.getElementById("mapNormal"), sb = document.getElementById("mapSat");
    if (nb && sb) {
      nb.onclick = () => { _map.removeLayer(sat); normal.addTo(_map); nb.classList.add("on"); sb.classList.remove("on"); };
      sb.onclick = () => { _map.removeLayer(normal); sat.addTo(_map); sb.classList.add("on"); nb.classList.remove("on"); };
    }
    setTimeout(() => _map.invalidateSize(), 200);
  }

  // ---- Yapay Zeka Asistanı (yerel motor) ----------------------------------
  function aiPanel() {
    const sorular = ["Bu yıl en kârlı tarlam hangisi?", "En fazla gider hangi kalemde oluştu?", "Gübre maliyetini %10 azaltırsam ne olur?", "Hasat için en uygun tarih nedir?"];
    return `<div class="panel ai-card">
      <h3>🤖 Yapay Zeka Asistanı</h3>
      <div class="ai-msgs" id="aiMsgs"></div>
      <div class="ai-chips" id="aiChips">${sorular.map(s => `<div class="ai-chip" data-q="${s}">💬 ${s}</div>`).join("")}</div>
      <div class="ai-input"><input id="aiInput" placeholder="Sorunuzu yazın..."><button id="aiSend">➤</button></div>
    </div>`;
  }
  function bindAI() {
    const chips = document.getElementById("aiChips"), input = document.getElementById("aiInput"), send = document.getElementById("aiSend");
    if (!chips) return;
    chips.querySelectorAll(".ai-chip").forEach(c => c.onclick = () => ask(c.dataset.q));
    if (send) send.onclick = () => { if (input.value.trim()) ask(input.value.trim()); };
    if (input) input.onkeydown = e => { if (e.key === "Enter" && input.value.trim()) ask(input.value.trim()); };
  }
  function ask(q) {
    const box = document.getElementById("aiMsgs"); const inp = document.getElementById("aiInput");
    if (inp) inp.value = "";
    box.insertAdjacentHTML("beforeend", `<div class="ai-msg u">${q}</div>`);
    box.insertAdjacentHTML("beforeend", `<div class="ai-msg a">${AI.answer(q)}</div>`);
    box.scrollTop = box.scrollHeight;
  }

  // Yerel cevap motoru — tam asistan (js/ai.js) ile aynı motoru kullanır
  const AI = {
    answer(q) {
      if (global.Asistan && Asistan.cevap) return Asistan.cevap(q);
      return "Bunu verilerinden hesaplayabilirim. Gelir, gider, tarla kârlılığı veya hasat tarihi hakkında sorabilirsin.";
    }
  };

  global.Dashboard = { render, destroy };
})(window);
