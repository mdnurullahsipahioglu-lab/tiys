/* TİYS — Kiralama Takvimi: aylık genel bakış + Excel/Word takvim çıktısı */
(function (global) {
  "use strict";
  const D = window.DB;
  const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const GUNLER_TAM = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  let _y = null, _m = null;

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  const money = v => D.money(v);
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function bugun() { try { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; } catch (e) { return { y: 2026, m: 5, d: 13 }; } }
  function adKisa(s) { s = String(s || "—").trim(); const p = s.split(/\s+/); return p.length > 1 ? (p[0] + " " + p[1][0] + ".") : s; }
  function aralik(k) { const b = String(k.tarih || "").slice(0, 10), e = String(k.bitis || "").slice(0, 10); return e && e !== b ? (D.dateTR(b) + " – " + D.dateTR(e)) : D.dateTR(b); }

  function gunKiralamalari(giso) {
    return D.coll("isciKiralamalar").filter(k => {
      const b = String(k.tarih || "").slice(0, 10); if (!b) return false;
      const e = String(k.bitis || k.tarih || "").slice(0, 10) || b;
      return giso >= b && giso <= e;
    }).map(k => ({ musteri: k.musteri || "—", kisi: Number(k.kisi) || 0, tutar: Number(k.tutar) || 0 }));
  }

  function ayBilgi() {
    const sonGun = new Date(_y, _m + 1, 0).getDate();
    const ayBas = iso(_y, _m, 1), aySon = iso(_y, _m, sonGun);
    const ayKira = D.coll("isciKiralamalar").filter(k => { const b = String(k.tarih || "").slice(0, 10); return b >= ayBas && b <= aySon; });
    const ayToplam = ayKira.reduce((a, k) => a + (Number(k.tutar) || 0), 0);
    let dolu = 0; for (let d = 1; d <= sonGun; d++) if (gunKiralamalari(iso(_y, _m, d)).length) dolu++;
    return { sonGun, ayKira, ayToplam, dolu, bos: sonGun - dolu };
  }

  function haftalar() {
    const sonGun = new Date(_y, _m + 1, 0).getDate();
    const ilk = new Date(_y, _m, 1).getDay(), offset = (ilk + 6) % 7; // Pzt=0
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= sonGun; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  function render(view) {
    if (_y == null) { const t = bugun(); _y = t.y; _m = t.m; }
    const bil = ayBilgi(), weeks = haftalar(), t = bugun();
    const hucre = d => {
      if (d == null) return `<div style="background:#f8fafc;border-radius:9px"></div>`;
      const giso = iso(_y, _m, d), ks = gunKiralamalari(giso), buBugun = (t.y === _y && t.m === _m && t.d === d);
      return `<div style="min-height:84px;border:1px solid var(--line,#e5e7eb);border-radius:9px;padding:5px 6px;background:${ks.length ? "rgba(34,197,94,0.10)" : "#fff"};${buBugun ? "box-shadow:0 0 0 2px #3b82f6 inset;" : ""}">
        <div style="font-size:12px;font-weight:700;color:${ks.length ? "#166534" : "var(--muted,#94a3b8)"}">${d}${buBugun ? " •" : ""}</div>
        ${ks.map(k => `<div title="${esc(k.musteri)} · ${k.kisi} işçi · ${money(k.tutar)}" style="font-size:10.5px;background:#16a34a;color:#fff;border-radius:5px;padding:1px 5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(adKisa(k.musteri))} · ${k.kisi}</div>`).join("")}
        ${!ks.length ? `<div style="font-size:9.5px;color:#cbd5e1;margin-top:8px">boş</div>` : ""}
      </div>`;
    };
    view.innerHTML = `
      <div class="page-head">
        <div><h2 style="margin:0">📅 Kiralama Takvimi</h2><div class="lead">Hangi gün kime kiraladın, kaç kişi, hangi günler boş — tek bakışta</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${Export.bar('takvim')}</div>
      </div>
      <div class="panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn ghost" id="tk_prev">‹ Önceki</button>
            <h3 style="margin:0;min-width:140px;text-align:center">${AYLAR[_m]} ${_y}</h3>
            <button class="btn ghost" id="tk_next">Sonraki ›</button>
            <button class="btn ghost" id="tk_bugun">Bugün</button>
          </div>
          <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:13px">
            <div><span style="color:var(--muted,#64748b)">Dolu gün</span> <b style="color:#16a34a">${bil.dolu}</b></div>
            <div><span style="color:var(--muted,#64748b)">Boş gün</span> <b style="color:#64748b">${bil.bos}</b></div>
            <div><span style="color:var(--muted,#64748b)">Bu ay toplam kiralama</span> <b style="color:var(--teal,#0d9488)">${money(bil.ayToplam)}</b></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px">
          ${GUNLER.map(g => `<div style="text-align:center;font-size:11.5px;font-weight:600;color:var(--muted,#94a3b8);padding:4px 0">${g}</div>`).join("")}
        </div>
        ${weeks.map(w => `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:5px">${w.map(hucre).join("")}</div>`).join("")}
        <div class="lead" style="margin-top:10px">🟩 kiralı (dolu) gün · beyaz = boş. Bir kiralama birden çok günü kapsıyorsa her güne işlenir. Üstteki 📊 Excel / 📄 Word ile bu takvimi dışa aktar.</div>
      </div>`;
    view.querySelector("#tk_prev").onclick = () => { _m--; if (_m < 0) { _m = 11; _y--; } render(view); };
    view.querySelector("#tk_next").onclick = () => { _m++; if (_m > 11) { _m = 0; _y++; } render(view); };
    view.querySelector("#tk_bugun").onclick = () => { const b = bugun(); _y = b.y; _m = b.m; render(view); };
    Export.wire(view, 'takvim', takvimExport);
  }

  function takvimExport() {
    const weeks = haftalar(), bil = ayBilgi();
    const takvimRows = weeks.map(w => w.map(d => {
      if (d == null) return "";
      const ks = gunKiralamalari(iso(_y, _m, d));
      return d + (ks.length ? "\n" + ks.map(k => k.musteri + " (" + k.kisi + ")").join("\n") : "");
    }));
    const ozetRows = bil.ayKira.slice().sort((a, b) => String(a.tarih).localeCompare(String(b.tarih)))
      .map(k => [k.musteri || "—", aralik(k), Number(k.gun) || (k.bitis && k.tarih ? Math.max(1, Math.round((new Date(k.bitis) - new Date(k.tarih)) / 86400000) + 1) : 0), Number(k.kisi) || 0, Math.round(Number(k.tutar) || 0)]);
    ozetRows.push(["", "", "", "TOPLAM", Math.round(bil.ayToplam)]);
    return {
      file: "TIYS-Takvim-" + _y + "-" + pad(_m + 1),
      title: "TİYS — Kiralama Takvimi (" + AYLAR[_m] + " " + _y + ")",
      tables: [
        { name: ("Takvim " + AYLAR[_m] + " " + _y).slice(0, 31), headers: GUNLER_TAM, rows: takvimRows },
        { name: "Ozet", headers: ["Müşteri", "Tarih Aralığı", "Gün", "İşçi", "Tutar (₺)"], rows: ozetRows }
      ]
    };
  }

  global.Takvim = { render };
})(window);
