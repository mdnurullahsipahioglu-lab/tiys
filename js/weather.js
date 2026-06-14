/* TİYS — Hava ve Karar Destek (Open-Meteo, ücretsiz, key yok) */
(function (global) {
  "use strict";
  let _chart = null;
  function destroy() { if (_chart) { try { _chart.destroy(); } catch (e) {} _chart = null; } }

  const WMO = {
    0: ["Açık", "☀️"], 1: ["Az bulutlu", "🌤️"], 2: ["Parçalı bulutlu", "⛅"], 3: ["Çok bulutlu", "☁️"],
    45: ["Sisli", "🌫️"], 48: ["Kırağılı sis", "🌫️"], 51: ["Hafif çiseleme", "🌦️"], 53: ["Çiseleme", "🌦️"], 55: ["Yoğun çiseleme", "🌧️"],
    56: ["Donlu çiseleme", "🌧️"], 57: ["Donlu çiseleme", "🌧️"], 61: ["Hafif yağmur", "🌦️"], 63: ["Yağmurlu", "🌧️"], 65: ["Sağanak yağmur", "🌧️"],
    66: ["Donlu yağmur", "🌧️"], 67: ["Donlu yağmur", "🌧️"], 71: ["Hafif kar", "🌨️"], 73: ["Kar", "🌨️"], 75: ["Yoğun kar", "❄️"], 77: ["Kar taneleri", "🌨️"],
    80: ["Sağanak", "🌧️"], 81: ["Sağanak", "🌧️"], 82: ["Şiddetli sağanak", "⛈️"], 85: ["Kar sağanağı", "🌨️"], 86: ["Kar sağanağı", "🌨️"],
    95: ["Gök gürültülü", "⛈️"], 96: ["Dolu fırtınası", "⛈️"], 99: ["Şiddetli fırtına", "⛈️"]
  };
  function wmo(c) { return WMO[c] || ["—", "🌡️"]; }
  const GUN = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

  function render(view) {
    destroy();
    const k = DB.load().ayarlar.konum || { lat: 40.985, lng: 36.742, ad: "Merkez" };
    view.innerHTML = `
      <div class="page-head"><div><h2 style="margin:0">Hava ve Karar Destek</h2><div class="lead">${k.ad} · Open-Meteo verisiyle akıllı öneriler</div></div></div>
      <div class="panel"><div id="wxLoad" class="empty"><div class="e-ico">🌦️</div>Hava verisi alınıyor…</div></div>`;

    const fc = `https://api.open-meteo.com/v1/forecast?latitude=${k.lat}&longitude=${k.lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=auto&forecast_days=7`;
    const arch = `https://archive-api.open-meteo.com/v1/archive?latitude=${k.lat}&longitude=${k.lng}&start_date=2020-01-01&end_date=2024-12-31&daily=precipitation_sum&timezone=auto`;

    Promise.all([fetch(fc).then(r => r.json()), fetch(arch).then(r => r.json()).catch(() => null)])
      .then(([f, a]) => paint(view, k, f, a))
      .catch(() => { view.querySelector(".panel").innerHTML = `<div class="empty"><div class="e-ico">📡</div>Hava verisi alınamadı.<br>İnternet bağlantısını kontrol et — bu modül için bağlantı gerekir.</div>`; });
  }

  function paint(view, k, f, a) {
    const cur = f.current, d = f.daily;
    const [curDesc, curIco] = wmo(cur.weather_code);
    // karar destek metrikleri (önümüzdeki 5 gün)
    const n = Math.min(5, d.time.length);
    let prob5 = 0, sum5 = 0, min7 = 99;
    for (let i = 0; i < d.time.length; i++) { if (i < n) { prob5 = Math.max(prob5, d.precipitation_probability_max[i] || 0); sum5 += d.precipitation_sum[i] || 0; } min7 = Math.min(min7, d.temperature_2m_min[i]); }
    const donVar = min7 < 2;
    const ilacUygun = !(prob5 >= 50 || sum5 >= 5);
    const gubre = sum5 >= 30 ? ["Erteleyin", "Aşırı yağış besinleri yıkar", "red"] : sum5 >= 3 ? ["İdeal", "Hafif yağış besini toprağa indirir", "green"] : ["Uygun", "Kuru — sonrasında sulama düşünün", "orange"];
    const budamaUygun = !donVar && sum5 < 10;
    const hasatT = new Date(DB.load().ayarlar.hasatTarihi);
    const gunKaldi = Math.max(0, Math.ceil((hasatT - new Date(2026, 5, 13)) / 86400000));

    // geçmiş yıllar yağış (archive)
    let yilYagis = null;
    if (a && a.daily && a.daily.time) {
      const acc = {};
      a.daily.time.forEach((t, i) => { const y = t.slice(0, 4); acc[y] = (acc[y] || 0) + (a.daily.precipitation_sum[i] || 0); });
      yilYagis = acc;
    }

    view.querySelector(".content") || 0;
    view.querySelector(".panel").outerHTML = `
      <div class="grid cols-2" style="align-items:start">
        <div class="panel"><h3>🌦️ Şu An — ${k.ad}</h3>
          <div class="weather-head"><div class="big">${curIco}</div>
            <div><div class="temp">${Math.round(cur.temperature_2m)}°C</div><div class="desc">${curDesc}</div></div></div>
          <div class="wx-row">
            <div class="wx"><div class="v">%${cur.relative_humidity_2m}</div><div class="l">💧 Nem</div></div>
            <div class="wx"><div class="v">${Math.round(cur.wind_speed_10m)} km/s</div><div class="l">🌬️ Rüzgar</div></div>
            <div class="wx"><div class="v">${cur.precipitation} mm</div><div class="l">🌧️ Yağış</div></div>
          </div>
          <div class="risk-row">
            <div class="risk">❄️ Don Riski<b style="color:${donVar ? "var(--red)" : "var(--green)"}">${donVar ? "VAR" : "Düşük"}</b></div>
            <div class="risk">🌧️ 5 Gün Yağış<b>${Math.round(sum5)} mm</b></div>
            <div class="risk">📅 Hasata<b>${gunKaldi} gün</b></div>
          </div>
        </div>
        <div class="panel"><h3>📆 7 Günlük Tahmin</h3>
          <div style="display:flex;flex-direction:column;gap:2px">
          ${d.time.map((t, i) => { const [ds, ic] = wmo(d.weather_code[i]); const dt = new Date(t);
            return `<div class="task" style="padding:8px 0"><div style="width:42px;font-weight:600;font-size:12px">${i === 0 ? "Bugün" : GUN[dt.getDay()]}</div>
              <div style="font-size:20px;width:34px;text-align:center">${ic}</div>
              <div class="t-body" style="flex:1"><div class="t-title" style="font-size:12.5px">${ds}</div></div>
              <div style="font-size:11px;color:var(--blue);width:54px">💧%${d.precipitation_probability_max[i] || 0}</div>
              <div style="font-weight:700;font-size:12.5px;width:74px;text-align:right">${Math.round(d.temperature_2m_max[i])}° / ${Math.round(d.temperature_2m_min[i])}°</div></div>`;
          }).join("")}</div>
        </div>
      </div>

      <div class="panel" style="margin-top:14px"><h3>🧠 Karar Destek Önerileri</h3>
        <div class="grid cols-trio">
          ${oneri("💊 İlaçlama", ilacUygun ? "UYGUN" : "ÖNERİLMEZ", ilacUygun ? "Önümüzdeki 5 gün kuru — ilaçlama yapılabilir." : "5 gün içinde yağış bekleniyor; ilaç yıkanır, önerilmez.", ilacUygun ? "green" : "red")}
          ${oneri("🌿 Gübreleme", gubre[0].toUpperCase(), gubre[1], gubre[2])}
          ${oneri("✂️ Budama", budamaUygun ? "UYGUN" : "BEKLEYİN", budamaUygun ? "Hava kuru ve don riski yok." : (donVar ? "Don riski var, budamayı erteleyin." : "Yağışlı — kuru güne bırakın."), budamaUygun ? "green" : "orange")}
          ${oneri("❄️ Don Riski", donVar ? "VAR" : "DÜŞÜK", donVar ? `7 gün içinde min ${Math.round(min7)}°C — hassas dönemse koruma alın.` : `En düşük ${Math.round(min7)}°C — risk düşük.`, donVar ? "red" : "green")}
          ${oneri("🌰 Hasat", gunKaldi + " GÜN", `Tahmini hasat: ${DB.dateTR(hasatT)}. Hasat öncesi kuru hava penceresi kollayın.`, "teal")}
          ${oneri("💧 Sulama", sum5 < 3 ? "GEREKEBİLİR" : "GEREKMEZ", sum5 < 3 ? "5 günde kayda değer yağış yok." : `5 günde ~${Math.round(sum5)} mm yağış bekleniyor.`, sum5 < 3 ? "orange" : "green")}
        </div>
      </div>

      ${yilYagis ? `<div class="panel" style="margin-top:14px"><h3>📊 Geçmiş Yıllar Yıllık Yağış (mm) — son 5 yıl</h3>
        <div style="position:relative;height:220px"><canvas id="yagisChart"></canvas></div>
        <p class="lead" style="margin-top:8px">Kaynak: Open-Meteo arşivi (${k.ad}). Yağış eğilimi gübreleme ve sulama planı için referanstır.</p></div>` : ""}`;

    if (yilYagis) {
      const yl = Object.keys(yilYagis).sort();
      _chart = new Chart(document.getElementById("yagisChart"), {
        type: "bar",
        data: { labels: yl, datasets: [{ label: "Yıllık Yağış (mm)", data: yl.map(y => Math.round(yilYagis[y])), backgroundColor: "#3b82f6", borderRadius: 6 }] },
        options: { plugins: { legend: { display: false } }, maintainAspectRatio: false }
      });
    }
  }

  function oneri(baslik, durum, aciklama, renk) {
    const c = { green: "#16a34a", red: "#dc2626", orange: "#ea7317", teal: "#0d9488" }[renk] || "#64748b";
    return `<div class="panel" style="box-shadow:none;border:1px solid var(--line);margin:0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <b style="font-size:13.5px">${baslik}</b><span style="background:${c}1a;color:${c};font-weight:700;font-size:11px;padding:3px 9px;border-radius:20px">${durum}</span></div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">${aciklama}</div></div>`;
  }

  global.Weather = { render, destroy };
})(window);
