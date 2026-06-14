/* TİYS — Yapay Zeka Asistanı (tam sayfa)
 * Yerel veri sorgu motoru: sorulara işletme verisinden cevap üretir. LLM/internet gerekmez.
 */
(function (global) {
  "use strict";
  const D = window.DB;
  const money = v => D.money(v), num = v => D.num(v);
  function yil() { try { return new Date().getFullYear(); } catch (e) { return 2026; } }
  // Türkçe normalize: küçült + aksanları sadeleştir
  function norm(s) {
    return String(s == null ? "" : s).toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ö/g, "o").replace(/â/g, "a");
  }
  function has(q, ...ws) { return ws.some(w => q.includes(norm(w))); }
  // kelime-sınırı eşleşmesi (kısa kelimeler için: "kar" → "dekar" ile eşleşmesin)
  function hasW(q, ...ws) { return ws.some(w => { const n = norm(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp("(^|[^a-z0-9])" + n + "([^a-z0-9]|$)").test(q); }); }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // ============ CEVAP MOTORU ============
  function cevap(soru) {
    const Y = yil(), q = norm(soru);

    // Selam
    if (has(q, "selam", "merhaba", "naber", "iyi misin", "gunaydin")) {
      return `Merhaba! 👋 İşletmenle ilgili her şeyi sorabilirsin — kârın, giderlerin, kimin borcu var, en verimli tarlan, hasat zamanı... Aşağıdaki örneklere de dokunabilirsin.`;
    }

    // İşçi kiralama / müşteri borç hanesi
    if (has(q, "borc", "alacak", "alacag", "tahsil", "kim bana", "kim ne kadar")) {
      const oz = D.musteriOzet();
      const qWords = q.split(/[^a-z0-9]+/).filter(Boolean);
      const adGecen = oz.find(o => norm(o.musteri).split(/[^a-z0-9]+/).filter(w => w.length >= 3).some(w => qWords.includes(w)));
      if (adGecen) {
        return adGecen.kalan > 0.5
          ? `<b>${esc(adGecen.musteri)}</b> sana <b>${money(adGecen.kalan)}</b> borçlu (hakediş ${money(adGecen.hakedis)} − tahsil ${money(adGecen.tahsil)}).`
          : `<b>${esc(adGecen.musteri)}</b> ile hesap kapalı 🟢 (toplam ${money(adGecen.hakedis)} tahsil edildi).`;
      }
      const borclu = oz.filter(o => o.kalan > 0.5).sort((a, b) => b.kalan - a.kalan);
      const kalan = oz.reduce((a, x) => a + x.kalan, 0);
      if (!borclu.length) return `Tüm müşteri hesapları kapalı 🟢 — bekleyen alacağın yok.`;
      const liste = borclu.slice(0, 6).map(o => `• <b>${esc(o.musteri)}</b>: ${money(o.kalan)}`).join("<br>");
      return `Toplam <b>${money(kalan)}</b> tahsil edilecek alacağın var · ${borclu.length} borçlu müşteri:<br>${liste}<br><span class="muted">Detaylar: İşçi Kiralama sayfası.</span>`;
    }

    // Kâr / genel durum
    if (hasW(q, "kar", "kardayim") || has(q, "karli mi", "kazanc", "kazandi", "kazan", "net kar", "durum ne", "nasil gidiyor", "ozetle", "ne durumda")) {
      const g = D.toplamGelir(Y), e = D.toplamGider(Y), n = D.netKar(Y);
      return `<b>${Y} özeti:</b> Gelir ${money(g)} − Gider ${money(e)} = <b>Net ${money(n)}</b>. ${n >= 0 ? "Kârdasın 🟢" : "Zarardasın 🔴"}<br><span class="muted">Detay: Raporlar.</span>`;
    }

    // En verimli / kârlı tarla
    if (has(q, "verimli", "karli tarla", "en iyi tarla", "hangi tarla")) {
      const s = D.tarlaVerimSirasi()[0];
      if (!s) return "Henüz tarla/hasat verisi yok.";
      return `En verimli tarlan: <b>${esc(s.ad)}</b> — verim %${s.puan}, ${num(s.kgDekar)} kg/dekar. Tarla bazlı kâr için Raporlar → Kârlılık.`;
    }

    // En yüksek gider
    if (has(q, "en fazla gider", "en yuksek gider", "en cok harca", "en buyuk gider", "nereye harca")) {
      const d = D.giderDagilimi(Y), top = Object.keys(d).sort((a, b) => d[b] - d[a])[0];
      return `En yüksek gider kalemin: <b>${top}</b> — ${money(d[top])} (giderlerinin %${pct(d[top], D.toplamGider(Y))}'i).`;
    }

    // Senaryo (azalt/artır)
    if (has(q, "azalt", "dusur", "artar", "ne olur", "senaryo")) {
      const d = D.giderDagilimi(Y), m = q.match(/(\d{1,2})/), oran = m ? +m[1] : 10;
      const hedef = has(q, "gubre") ? "Gübre" : has(q, "iscilik") ? "İşçilik" : has(q, "yakit") ? "Yakıt" : "Gübre";
      const tasarruf = Math.round((d[hedef] || 0) * oran / 100);
      return `${hedef} maliyetini %${oran} azaltırsan ~<b>${money(tasarruf)}</b> tasarruf. Net kârın ${money(D.netKar(Y))} → <b>${money(D.netKar(Y) + tasarruf)}</b>.<br><span class="muted">Daha fazla senaryo: Analiz Merkezi.</span>`;
    }

    // Gider (toplam veya belirli kalem)
    if (has(q, "gider", "masraf", "harca", "maliyet")) {
      const d = D.giderDagilimi(Y);
      const kalem = { gubre: "Gübre", yakit: "Yakıt", iscilik: "İşçilik", makine: "Makine", ekipman: "Ekipman" };
      for (const k in kalem) if (q.includes(k)) return `${kalem[k]} gideri: <b>${money(d[kalem[k]] || 0)}</b> (${Y}).`;
      const top = Object.keys(d).sort((a, b) => d[b] - d[a])[0];
      return `${Y} toplam giderin: <b>${money(D.toplamGider(Y))}</b>. En büyük kalem: ${top} (${money(d[top])}).`;
    }

    // Gelir
    if (has(q, "gelir", "satis", "ciro", "ne kadar para", "kac para")) {
      const gd = D.gelirDagilimi(Y);
      return `${Y} toplam gelirin: <b>${money(D.toplamGelir(Y))}</b><br>• Hasat: ${money(gd["Hasat Geliri"])}<br>• İşçi Kiralama: ${money(gd["İşçi Kiralama"])}<br>• Ev Kira: ${money(gd["Ev Kira"])}`;
    }

    // Hasat
    if (has(q, "hasat", "ne zaman topla", "toplama")) {
      const ht = D.load().ayarlar.hasatTarihi;
      return ht ? `Tahmini hasat tarihi: <b>${D.dateTR(ht)}</b>. Güncel öneri için Hava ve Karar Destek sayfasına bak.` : "Hasat tarihi henüz ayarlanmamış (Ayarlar'dan girebilirsin).";
    }

    // Hava / ilaçlama / don
    if (has(q, "ilacla", "ilac", "yagmur", "yagis", "hava", "don ", "gubrele ne zaman", "sulama")) {
      return `Hava + ilaçlama/gübreleme/don önerileri <b>Hava ve Karar Destek</b> sayfasında canlı hesaplanıyor (Open-Meteo, 5 günlük tahmin). Örn. yağış varsa "ilaçlama önerilmez" uyarısı verir.`;
    }

    // Tarla sayısı / dekar / ürün
    if (has(q, "kac tarla", "tarla sayi", "kac dekar", "toplam alan", "ne kadar arazi")) {
      const n = D.coll("tarlalar").length;
      const us = D.aktifUrunler().map(u => D.urun(u).emoji + " " + D.urun(u).ad).join(", ");
      return `<b>${n} tarlan</b> var, toplam <b>${num(D.toplamDekar())} dekar</b>. Ürünler: ${us}.`;
    }
    if (has(q, "urun", "cesit", "ne ekiyorum", "ne yetistir", "zeytin", "findik", "ceviz", "narenciye", "uzum")) {
      const us = D.aktifUrunler();
      if (!us.length) return "Henüz tarla/ürün kaydın yok.";
      return `Aktif ürünlerin: ${us.map(u => `${D.urun(u).emoji} ${D.urun(u).ad}`).join(", ")}.<br><span class="muted">Tarla başına ürün/çeşit: Tarla Yönetimi.</span>`;
    }

    // Fallback
    return `Bunu verilerinden hesaplayabilirim. Örnekler:<br>• "Bu yıl kâr ettim mi?"<br>• "Kim bana ne kadar borçlu?"<br>• "En yüksek giderim hangi kalemde?"<br>• "En verimli tarlam hangisi?"<br>• "Hasat ne zaman?"<br>• "Gübreyi %10 azaltırsam ne olur?"<br><span class="muted">(Serbest sohbet için ileride gerçek AI bağlanabilir.)</span>`;
  }

  // ============ TAM SAYFA ============
  const ORNEKLER = [
    "Bu yıl kâr ettim mi?", "Kim bana ne kadar borçlu?", "Toplam alacağım ne kadar?",
    "En yüksek giderim hangi kalemde?", "En verimli tarlam hangisi?", "Gelirim nereden geliyor?",
    "Hasat ne zaman?", "Gübreyi %10 azaltırsam ne olur?", "Kaç dekar arazim var?", "İlaçlamayı ne zaman yapmalıyım?"
  ];

  function render(view) {
    view.innerHTML = `
      <div class="page-head"><div><h2 style="margin:0">🤖 Yapay Zeka Asistanı</h2><div class="lead">Verinden hesaplar — internet/abonelik gerektirmez</div></div></div>
      <div class="panel ai-full">
        <div class="ai-msgs" id="aiMsgs2"></div>
        <div class="ai-chips" id="aiChips2">${ORNEKLER.map(s => `<button class="ai-chip" data-q="${esc(s).replace(/"/g, "&quot;")}">💬 ${esc(s)}</button>`).join("")}</div>
        <div class="ai-input"><input id="aiInput2" placeholder="Sorunu yaz... (örn. kim bana borçlu)"><button id="aiSend2">➤</button></div>
      </div>`;

    const box = view.querySelector("#aiMsgs2"), inp = view.querySelector("#aiInput2"), snd = view.querySelector("#aiSend2");
    function ekle(tip, html) { box.insertAdjacentHTML("beforeend", `<div class="ai-msg ${tip}">${html}</div>`); box.scrollTop = box.scrollHeight; }
    function sor(qRaw) {
      const q = String(qRaw).trim(); if (!q) return;
      ekle("u", esc(q)); if (inp) inp.value = "";
      setTimeout(() => ekle("a", cevap(q)), 140);
    }
    ekle("a", cevap("merhaba"));
    view.querySelectorAll("#aiChips2 .ai-chip").forEach(c => c.onclick = () => sor(c.dataset.q));
    if (snd) snd.onclick = () => sor(inp.value);
    if (inp) inp.onkeydown = e => { if (e.key === "Enter") sor(inp.value); };
  }

  global.Asistan = { render, cevap };
})(window);
