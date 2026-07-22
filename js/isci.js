/* TİYS — İşçi Kiralama: yıllık yevmiye · müşteri borç hanesi · tahsilat
 * Model: Kiralama = alacak (isciKiralamalar) · Tahsilat = gelir (gelirler[isciKiralama])
 * Müşteri borcu = Σ hakediş − Σ tahsil. Ödeme yapılınca borç kapanır.
 */
(function (global) {
  "use strict";
  const D = window.DB;
  const money = v => D.money(v), num = v => D.num(v);
  const dt = v => v ? D.dateTR(v) : "—";
  function miniKpi(cls, label, val) { return `<div class="kpi ${cls}" style="min-height:auto;padding:13px"><div class="k-label">${label}</div><div class="k-val" style="font-size:20px">${val}</div></div>`; }
  function bugunISO() { try { const d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); } catch (e) { return "2026-06-14"; } } // yerel gün
  function aktifYil() { let y; try { y = new Date().getFullYear(); } catch (e) { y = 2026; } return String(y); }
  function yilOf(tarih) { const s = String(tarih || ""); return s.length >= 4 ? s.slice(0, 4) : aktifYil(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function gunFark(b, c) { if (!b || !c) return null; const d1 = new Date(b), d2 = new Date(c); if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null; const diff = Math.floor((d2 - d1) / 86400000) + 1; return diff > 0 ? diff : null; }
  function grupBuyuk() { const a = D.load().ayarlar || {}; return Number(a.grupBuyukluk) || 0; }
  function setGrupBuyuk(n) { const d = D.load(); d.ayarlar = d.ayarlar || {}; d.ayarlar.grupBuyukluk = Number(n) || 0; D.save(); }
  function araliktan(rec) { return dt(rec.tarih) + (rec.bitis && rec.bitis !== rec.tarih ? " – " + dt(rec.bitis) : ""); }

  let _view = null;
  function refresh() { if (_view) render(_view); }

  function render(view) {
    _view = view;
    const ozet = D.musteriOzet();
    const toplamHakedis = ozet.reduce((a, x) => a + x.hakedis, 0);
    const toplamTahsil = ozet.reduce((a, x) => a + x.tahsil, 0);
    const toplamKalan = toplamHakedis - toplamTahsil;
    const borclu = ozet.filter(o => o.kalan > 0.5).length;
    const yil = aktifYil(), yev = D.yevmiyeFor(yil), grup = grupBuyuk();

    view.innerHTML = `
      <div class="page-head">
        <div><h2 style="margin:0">İşçi Kiralama</h2><div class="lead">Grubunu tarih aralığıyla kirala · müşteri borç hanesi · tahsilat</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="ik_kira">➕ Grup Kirala</button>
          <button class="btn ghost" id="ik_tah">💰 Tahsilat Ekle</button>
          ${Export.bar('ik')}
        </div>
      </div>

      <div class="panel" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div style="display:flex;gap:30px;flex-wrap:wrap">
          <div>
            <div class="lead" style="margin:0">👥 Grubum</div>
            <div style="font-size:24px;font-weight:800;color:var(--teal)">${grup ? grup : "—"} <span style="font-size:13px;font-weight:500;color:var(--muted)">kişi</span></div>
          </div>
          <div>
            <div class="lead" style="margin:0">${yil} kişi-gün yevmiyesi</div>
            <div style="font-size:24px;font-weight:800;color:var(--teal)">${money(yev)} <span style="font-size:13px;font-weight:500;color:var(--muted)">/ kişi / gün</span></div>
          </div>
        </div>
        <button class="btn ghost" id="ik_grup">✏️ Grup &amp; Yevmiye</button>
      </div>
      ${!grup ? `<div class="lead" style="margin:-6px 0 12px;color:var(--orange)">💡 Önce "Grup &amp; Yevmiye" ile grubundaki işçi sayısını gir; kiralamada otomatik gelsin.</div>` : ""}

      <div class="kpis" style="grid-template-columns:repeat(3,1fr);max-width:720px;margin-bottom:14px">
        ${miniKpi("teal", "Toplam Hakediş", money(toplamHakedis))}
        ${miniKpi("blue", "Tahsil Edilen", money(toplamTahsil))}
        ${miniKpi(toplamKalan > 0.5 ? "orange" : "teal", "Kalan Alacak", money(toplamKalan))}
      </div>

      <div class="panel"><h3 style="margin-top:0">👥 Müşteri Borç Hanesi ${borclu ? `<span class="lead" style="font-weight:500">· ${borclu} borçlu</span>` : ""}</h3>
        ${ozet.length ? `<table class="t">
          <thead><tr><th>Müşteri</th><th>İşçi-Gün</th><th>Hakediş</th><th>Tahsil</th><th>Kalan Borç</th><th>Durum</th></tr></thead>
          <tbody>${ozet.map(o => `<tr data-m="${esc(o.musteri)}" style="cursor:pointer">
            <td><b>${esc(o.musteri)}</b></td>
            <td>${num(o.isciGun)} g</td>
            <td>${money(o.hakedis)}</td>
            <td>${money(o.tahsil)}</td>
            <td style="font-weight:700;color:${o.kalan > 0.5 ? "var(--orange)" : "var(--teal)"}">${money(o.kalan)}</td>
            <td>${o.kalan > 0.5 ? "🔴 Borçlu" : "🟢 Kapandı"}</td>
          </tr>`).join("")}</tbody></table>
          <div class="lead" style="margin-top:10px">💡 Müşteriye tıkla → geçmiş, hızlı tahsilat, ismi değiştir veya müşteriyi sil.</div>`
          : `<div class="empty"><div class="e-ico">🧾</div>Henüz kiralama kaydı yok.<br>"➕ Kiralama Ekle" ile başla.</div>`}
      </div>`;

    view.querySelector("#ik_kira").onclick = () => kiralamaForm(null, "");
    view.querySelector("#ik_tah").onclick = () => tahsilatForm(null, "");
    view.querySelector("#ik_grup").onclick = () => grupForm(yil);
    view.querySelectorAll("tbody tr[data-m]").forEach(tr => tr.onclick = () => musteriDetay(tr.dataset.m));
    Export.wire(view, 'ik', () => ({
      file: "TIYS-Isci-Kiralama", title: "TİYS — İşçi Kiralama Borç Hanesi",
      tables: [{ name: "Müşteri Borç Hanesi", headers: ["Müşteri", "İşçi-Gün", "Hakediş (₺)", "Tahsil (₺)", "Kalan Borç (₺)", "Durum"], rows: ozet.map(o => [o.musteri, o.isciGun, Math.round(o.hakedis), Math.round(o.tahsil), Math.round(o.kalan), o.kalan > 0.5 ? "Borçlu" : "Kapandı"]) }]
    }));
  }

  // ---- Grup & Yevmiye düzenle ----
  function grupForm(yil) {
    Forms.open({
      title: "Grup & Yevmiye Ayarları", icon: "👥",
      record: { grup: grupBuyuk() || "", yil: yil, yevmiye: D.yevmiyeFor(yil) },
      fields: [
        { key: "grup", label: "Grubumdaki İşçi Sayısı", type: "number", required: true, hint: "Yeni kiralamalarda işçi sayısı buradan gelir (ör. 20)" },
        { key: "yil", label: "Yıl", type: "number", required: true, step: "1" },
        { key: "yevmiye", label: "Kişi-Gün Yevmiye (₺)", type: "money", required: true, hint: "Bir işçinin bir günlük ücreti (o yıl için)" }
      ],
      onSave: d => { setGrupBuyuk(d.grup); D.setYevmiye(String(d.yil), d.yevmiye); refresh(); Forms.toast("Grup ayarları kaydedildi ✓"); }
    });
  }

  // ---- Grup kiralama ekle/düzenle (alacak) — tarih aralığı modeli ----
  function kiralamaForm(rec, presetMusteri) {
    const yil = rec && rec.tarih ? yilOf(rec.tarih) : aktifYil();
    const grup = grupBuyuk();
    Forms.open({
      title: "Grup Kiralama", icon: "🧾",
      record: rec || { tarih: bugunISO(), bitis: bugunISO(), musteri: presetMusteri || "", kisi: grup || "", yevmiye: D.yevmiyeFor(yil) },
      fields: [
        { key: "musteri", label: "Müşteri (grubu kiralayan)", type: "text", required: true, datalist: D.musteriList(), placeholder: "Ad Soyad" },
        { key: "tarih", label: "Başlangıç Tarihi", type: "date", required: true },
        { key: "bitis", label: "Bitiş Tarihi", type: "date", required: true },
        { key: "kisi", label: "İşçi Sayısı", type: "number", required: true, hint: grup ? ("Grubun varsayılanı: " + grup + " kişi") : "Kaç işçi gitti?" },
        { key: "yevmiye", label: "Kişi-Gün Yevmiye (₺)", type: "money", required: true, calc: true, hint: "Bu yılın işçilik bedeli (gerekirse değiştir)" }
      ],
      compute: d => {
        const g = gunFark(d.tarih, d.bitis);
        if (g == null) return { yevmiye: "⚠️ Başlangıç ve bitiş tarihini gir" };
        return { yevmiye: g + " gün × " + (d.kisi || 0) + " işçi × " + money(d.yevmiye || 0) + "  =  " + money((d.kisi || 0) * g * (d.yevmiye || 0)) };
      },
      computeSave: d => { const g = gunFark(d.tarih, d.bitis) || 0; return { gun: g, tutar: (d.kisi || 0) * g * (d.yevmiye || 0) }; },
      onSave: data => {
        if (rec && rec.id) D.update("isciKiralamalar", rec.id, data); else D.add("isciKiralamalar", data);
        refresh();
      },
      onDelete: rec && rec.id ? id => { D.remove("isciKiralamalar", id); refresh(); } : null
    });
  }

  // ---- Tahsilat ekle/düzenle (gelir = işçi kiralama) ----
  function tahsilatForm(rec, presetMusteri) {
    Forms.open({
      title: "Tahsilat (Ödeme Al)", icon: "💰",
      record: rec || { tarih: bugunISO(), musteri: presetMusteri || "", tur: "isciKiralama" },
      fields: [
        { key: "musteri", label: "Müşteri", type: "text", required: true, datalist: D.musteriList(), placeholder: "Ad Soyad" },
        { key: "tarih", label: "Tarih", type: "date", required: true },
        { key: "tutar", label: "Alınan Tutar (₺)", type: "money", required: true, placeholder: "0" },
        { key: "not", label: "Not", type: "text", placeholder: "nakit / havale / çek" }
      ],
      onSave: data => {
        data.tur = "isciKiralama";
        data.aciklama = "Tahsilat — " + (data.musteri || "");
        if (rec && rec.id) D.update("gelirler", rec.id, data); else D.add("gelirler", data);
        refresh();
      },
      onDelete: rec && rec.id ? id => { D.remove("gelirler", id); refresh(); } : null
    });
  }

  // ---- Müşteri detay (borç hanesi) ----
  function musteriDetay(musteri) {
    const m = String(musteri).trim();
    const kira = D.coll("isciKiralamalar").filter(k => String(k.musteri || "").trim() === m).map(k => Object.assign({ _t: "kira" }, k));
    const tah = D.tahsilatlar().filter(t => String(t.musteri || "").trim() === m).map(t => Object.assign({ _t: "tah" }, t));
    const hareketler = kira.concat(tah).sort((a, b) => new Date(b.tarih) - new Date(a.tarih));
    const hakedis = kira.reduce((a, x) => a + (x.tutar || 0), 0);
    const tahsil = tah.reduce((a, x) => a + (x.tutar || 0), 0);
    const kalan = hakedis - tahsil;

    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal">
      <div class="modal-head"><h3>👤 ${esc(m)}</h3><button class="x">✕</button></div>
      <div class="modal-body">
        <div class="kpis" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">
          ${miniKpi("teal", "Hakediş", money(hakedis))}
          ${miniKpi("blue", "Tahsil", money(tahsil))}
          ${miniKpi(kalan > 0.5 ? "orange" : "teal", "Kalan Borç", money(kalan))}
        </div>
        ${kalan > 0.5 ? `<div class="lead" style="margin-bottom:10px;color:var(--orange);font-weight:600">🔴 Bu müşterinin ${money(kalan)} borcu var.</div>`
          : (hakedis > 0 ? `<div class="lead" style="margin-bottom:10px;color:var(--teal);font-weight:600">🟢 Borç kapandı.</div>` : "")}
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn primary" data-add-kira>➕ Kiralama</button>
          <button class="btn ghost" data-add-tah>💰 Tahsilat Al</button>
        </div>
        <table class="t"><thead><tr><th>Tarih</th><th>İşlem</th><th>Detay</th><th>Tutar</th><th></th></tr></thead>
        <tbody>${hareketler.length ? hareketler.map(h => h._t === "kira"
          ? `<tr><td>${araliktan(h)}</td><td>🧾 Kiralama</td><td>${num(h.kisi)} işçi × ${num(h.gun)} gün × ${money(h.yevmiye)}</td><td style="color:var(--orange);font-weight:600">+${money(h.tutar)}</td><td><button class="icon-act" data-ek="${h.id}">✏️</button></td></tr>`
          : `<tr><td>${dt(h.tarih)}</td><td>💰 Tahsilat</td><td>${esc(h.not || h.aciklama || "—")}</td><td style="color:var(--teal);font-weight:600">−${money(h.tutar)}</td><td><button class="icon-act" data-et="${h.id}">✏️</button></td></tr>`
        ).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:18px">Kayıt yok</td></tr>`}</tbody></table>
      </div>
      <div class="modal-foot"><button class="btn ghost" data-ad>✏️ İsmi Değiştir</button><button class="btn danger" data-msil>🗑️ Müşteriyi Sil</button><div class="right"><button class="btn ghost" data-ekstre>📄 Ekstre</button><button class="btn ghost" data-cancel>Kapat</button></div></div>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector(".x").onclick = close;
    ov.querySelector("[data-cancel]").onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelector("[data-ekstre]").onclick = () => { close(); musteriEkstre(m); };
    ov.querySelector("[data-ad]").onclick = () => { close(); musteriAdiDegistir(m, () => refresh()); };
    ov.querySelector("[data-msil]").onclick = () => musteriSil(m, () => { close(); refresh(); });
    ov.querySelector("[data-add-kira]").onclick = () => { close(); kiralamaForm(null, m); };
    ov.querySelector("[data-add-tah]").onclick = () => { close(); tahsilatForm(null, m); };
    ov.querySelectorAll("[data-ek]").forEach(b => b.onclick = () => { close(); kiralamaForm(D.coll("isciKiralamalar").find(x => x.id === b.dataset.ek), m); });
    ov.querySelectorAll("[data-et]").forEach(b => b.onclick = () => { close(); tahsilatForm(D.tahsilatlar().find(x => x.id === b.dataset.et), m); });
  }

  // ---- Müşteri adını değiştir (tüm kayıtlarda) ----
  function musteriAdiDegistir(eski, after) {
    Forms.open({
      title: "Müşteri Adını Değiştir", icon: "✏️",
      record: { musteri: eski },
      fields: [{ key: "musteri", label: "Yeni Müşteri Adı", type: "text", required: true, full: true, hint: '"' + eski + '" → tüm kiralama ve tahsilat kayıtlarında güncellenir' }],
      onSave: data => {
        const yeni = String(data.musteri || "").trim();
        if (!yeni || yeni === eski) { if (after) after(); return; }
        const d = D.load();
        (d.isciKiralamalar || []).forEach(k => { if (String(k.musteri || "").trim() === eski) k.musteri = yeni; });
        (d.gelirler || []).forEach(g => { if (g.tur === "isciKiralama" && String(g.musteri || "").trim() === eski) g.musteri = yeni; });
        D.save(); Forms.toast("Müşteri adı güncellendi ✓"); if (after) after();
      }
    });
  }
  // ---- Müşteriyi sil (tüm kiralama + tahsilat kayıtları) ----
  function musteriSil(musteri, after) {
    const d0 = D.load();
    const kSay = (d0.isciKiralamalar || []).filter(k => String(k.musteri || "").trim() === musteri).length;
    const tSay = (d0.gelirler || []).filter(g => g.tur === "isciKiralama" && String(g.musteri || "").trim() === musteri).length;
    if (!confirm('"' + musteri + '" müşterisi silinecek.\n\n' + kSay + " kiralama + " + tSay + " tahsilat kaydı KALICI olarak silinir. Emin misin?")) return;
    const d = D.load();
    d.isciKiralamalar = (d.isciKiralamalar || []).filter(k => String(k.musteri || "").trim() !== musteri);
    d.gelirler = (d.gelirler || []).filter(g => !(g.tur === "isciKiralama" && String(g.musteri || "").trim() === musteri));
    D.save(); Forms.toast(musteri + " silindi"); if (after) after();
  }

  // ---- Müşteri ekstresi (yazdır / WhatsApp / kopyala) ----
  function bugunTR() { try { return D.dateTR(new Date().toISOString()); } catch (e) { return ""; } }
  function musteriEkstre(musteri) {
    const m = String(musteri).trim(), a = D.load().ayarlar;
    const kira = D.coll("isciKiralamalar").filter(k => String(k.musteri || "").trim() === m).sort((x, y) => new Date(x.tarih) - new Date(y.tarih));
    const tah = D.tahsilatlar().filter(t => String(t.musteri || "").trim() === m).sort((x, y) => new Date(x.tarih) - new Date(y.tarih));
    const hakedis = kira.reduce((s, x) => s + (x.tutar || 0), 0);
    const tahsil = tah.reduce((s, x) => s + (x.tutar || 0), 0);
    const kalan = hakedis - tahsil, bugun = bugunTR();

    // düz metin (WhatsApp / kopyala)
    const L = [];
    L.push((a.isletmeAdi || "Tarım İşletmesi").toLocaleUpperCase("tr"));
    L.push("Müşteri Hesap Ekstresi — " + bugun);
    L.push("Müşteri: " + m);
    L.push("");
    L.push("KİRALAMALAR (Hakediş)");
    kira.forEach(k => L.push("• " + araliktan(k) + "  " + num(k.kisi) + " işçi x " + num(k.gun) + " gün x " + money(k.yevmiye) + " = " + money(k.tutar)));
    L.push("Toplam Hakediş: " + money(hakedis));
    L.push("");
    L.push("TAHSİLATLAR (Ödeme)");
    if (tah.length) tah.forEach(t => L.push("• " + D.dateTR(t.tarih) + "  " + money(t.tutar) + (t.not ? " (" + t.not + ")" : "")));
    else L.push("• (ödeme yok)");
    L.push("Toplam Tahsil: " + money(tahsil));
    L.push("");
    L.push(kalan > 0.5 ? ("KALAN BORÇ: " + money(kalan)) : "DURUM: Hesap kapandı ✓");
    const metin = L.join("\n");

    // yazdırma HTML
    const satir = (sol, sag, kalin) => `<tr${kalin ? ' style="font-weight:700;border-top:1px solid #ddd"' : ""}><td style="padding:5px 8px">${sol}</td><td style="padding:5px 8px;text-align:right;white-space:nowrap">${sag}</td></tr>`;
    const html = `<div id="ekstreYazdir" style="font-family:system-ui,Arial,sans-serif;color:#111">
      <h2 style="margin:0 0 2px">${esc(a.isletmeAdi || "Tarım İşletmesi")}</h2>
      <div style="color:#666;margin-bottom:12px">Müşteri Hesap Ekstresi · ${bugun}</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:10px">👤 ${esc(m)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f3f4f6"><td colspan="2" style="text-align:left;padding:6px 8px;font-weight:700">Kiralamalar (Hakediş)</td></tr>
        ${kira.map(k => satir(araliktan(k) + " · " + num(k.kisi) + " işçi × " + num(k.gun) + " gün × " + money(k.yevmiye), money(k.tutar))).join("")}
        ${satir("Toplam Hakediş", money(hakedis), true)}
        <tr style="background:#f3f4f6"><td colspan="2" style="text-align:left;padding:6px 8px;font-weight:700">Tahsilatlar (Ödeme)</td></tr>
        ${tah.length ? tah.map(t => satir(D.dateTR(t.tarih) + (t.not ? " · " + esc(t.not) : ""), money(t.tutar))).join("") : `<tr><td colspan="2" style="padding:5px 8px;color:#888">Ödeme yok</td></tr>`}
        ${satir("Toplam Tahsil", money(tahsil), true)}
      </table>
      <div style="margin-top:14px;padding:10px 12px;border-radius:10px;background:${kalan > 0.5 ? "#fff7ed" : "#ecfdf5"};font-size:16px;font-weight:800;color:${kalan > 0.5 ? "#b45309" : "#047857"}">
        ${kalan > 0.5 ? "KALAN BORÇ: " + money(kalan) : "✓ Hesap kapandı"}</div></div>`;

    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal">
      <div class="modal-head"><h3>📄 ${esc(m)} — Ekstre</h3><button class="x">✕</button></div>
      <div class="modal-body">${html}</div>
      <div class="modal-foot"><button class="btn ghost" data-print>🖨️ Yazdır</button>
        <div class="right"><button class="btn ghost" data-wa>📱 WhatsApp</button><button class="btn primary" data-copy>📋 Kopyala</button></div></div>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector(".x").onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelector("[data-print]").onclick = () => { document.body.classList.add("printing"); window.print(); setTimeout(() => document.body.classList.remove("printing"), 600); };
    ov.querySelector("[data-wa]").onclick = () => { try { window.open("https://wa.me/?text=" + encodeURIComponent(metin), "_blank"); } catch (e) {} };
    ov.querySelector("[data-copy]").onclick = () => { try { navigator.clipboard.writeText(metin); Forms.toast("Ekstre kopyalandı ✓"); } catch (e) { Forms.toast("Kopyalanamadı"); } };
  }

  global.Isci = { render };
})(window);
