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
  function bugunISO() { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "2026-06-14"; } }
  function aktifYil() { let y; try { y = new Date().getFullYear(); } catch (e) { y = 2026; } return String(y); }
  function yilOf(tarih) { const s = String(tarih || ""); return s.length >= 4 ? s.slice(0, 4) : aktifYil(); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  let _view = null;
  function refresh() { if (_view) render(_view); }

  function render(view) {
    _view = view;
    const ozet = D.musteriOzet();
    const toplamHakedis = ozet.reduce((a, x) => a + x.hakedis, 0);
    const toplamTahsil = ozet.reduce((a, x) => a + x.tahsil, 0);
    const toplamKalan = toplamHakedis - toplamTahsil;
    const borclu = ozet.filter(o => o.kalan > 0.5).length;
    const yil = aktifYil(), yev = D.yevmiyeFor(yil);

    view.innerHTML = `
      <div class="page-head">
        <div><h2 style="margin:0">İşçi Kiralama</h2><div class="lead">Yıllık yevmiye · müşteri borç hanesi · tahsilat takibi</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" id="ik_kira">➕ Kiralama Ekle</button>
          <button class="btn ghost" id="ik_tah">💰 Tahsilat Ekle</button>
        </div>
      </div>

      <div class="panel" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div class="lead" style="margin:0">${yil} yılı kişi-gün yevmiyesi</div>
          <div style="font-size:24px;font-weight:800;color:var(--teal)">${money(yev)} <span style="font-size:13px;font-weight:500;color:var(--muted)">/ kişi / gün</span></div>
          <div class="lead" style="margin-top:2px">Yeni kiralamalarda işçilik = işçi × gün × bu tutar (her kayıtta değiştirilebilir)</div>
        </div>
        <button class="btn ghost" id="ik_yev">✏️ Yevmiyeyi Düzenle</button>
      </div>

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
          <div class="lead" style="margin-top:10px">💡 Bir müşteriye tıkla → kiralama/ödeme geçmişi ve hızlı tahsilat.</div>`
          : `<div class="empty"><div class="e-ico">🧾</div>Henüz kiralama kaydı yok.<br>"➕ Kiralama Ekle" ile başla.</div>`}
      </div>`;

    view.querySelector("#ik_kira").onclick = () => kiralamaForm(null, "");
    view.querySelector("#ik_tah").onclick = () => tahsilatForm(null, "");
    view.querySelector("#ik_yev").onclick = () => yevmiyeForm(yil);
    view.querySelectorAll("tbody tr[data-m]").forEach(tr => tr.onclick = () => musteriDetay(tr.dataset.m));
  }

  // ---- Yevmiye düzenle ----
  function yevmiyeForm(yil) {
    Forms.open({
      title: "Yıllık Kişi-Gün Yevmiyesi", icon: "✏️",
      record: { yil: yil, yevmiye: D.yevmiyeFor(yil) },
      fields: [
        { key: "yil", label: "Yıl", type: "number", required: true, step: "1" },
        { key: "yevmiye", label: "Kişi-Gün Yevmiye (₺)", type: "money", required: true, hint: "Bir işçinin bir günlük ücreti" }
      ],
      onSave: d => { D.setYevmiye(String(d.yil), d.yevmiye); refresh(); Forms.toast("Yevmiye kaydedildi ✓"); }
    });
  }

  // ---- Kiralama ekle/düzenle (alacak) ----
  function kiralamaForm(rec, presetMusteri) {
    const yil = rec && rec.tarih ? yilOf(rec.tarih) : aktifYil();
    Forms.open({
      title: "İşçi Kiralama", icon: "🧾",
      record: rec || { tarih: bugunISO(), musteri: presetMusteri || "", gun: 1, yevmiye: D.yevmiyeFor(yil) },
      fields: [
        { key: "musteri", label: "Müşteri", type: "text", required: true, datalist: D.musteriList(), placeholder: "Ad Soyad" },
        { key: "tarih", label: "Tarih", type: "date", required: true },
        { key: "kisi", label: "İşçi Sayısı", type: "number", required: true, placeholder: "ör. 12" },
        { key: "gun", label: "Gün Sayısı", type: "number", required: true, placeholder: "ör. 3" },
        { key: "yevmiye", label: "Kişi-Gün Yevmiye (₺)", type: "money", required: true, calc: true, hint: "Yıl yevmiyesinden geldi; değiştirebilirsin" }
      ],
      compute: d => ({ yevmiye: "Toplam işçilik = " + money((d.kisi || 0) * (d.gun || 0) * (d.yevmiye || 0)) }),
      computeSave: d => ({ tutar: (d.kisi || 0) * (d.gun || 0) * (d.yevmiye || 0) }),
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
          ? `<tr><td>${dt(h.tarih)}</td><td>🧾 Kiralama</td><td>${num(h.kisi)} işçi × ${num(h.gun)} gün × ${money(h.yevmiye)}</td><td style="color:var(--orange);font-weight:600">+${money(h.tutar)}</td><td><button class="icon-act" data-ek="${h.id}">✏️</button></td></tr>`
          : `<tr><td>${dt(h.tarih)}</td><td>💰 Tahsilat</td><td>${esc(h.not || h.aciklama || "—")}</td><td style="color:var(--teal);font-weight:600">−${money(h.tutar)}</td><td><button class="icon-act" data-et="${h.id}">✏️</button></td></tr>`
        ).join("") : `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:18px">Kayıt yok</td></tr>`}</tbody></table>
      </div>
      <div class="modal-foot"><span></span><div class="right"><button class="btn ghost" data-cancel>Kapat</button></div></div>
    </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector(".x").onclick = close;
    ov.querySelector("[data-cancel]").onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };
    ov.querySelector("[data-add-kira]").onclick = () => { close(); kiralamaForm(null, m); };
    ov.querySelector("[data-add-tah]").onclick = () => { close(); tahsilatForm(null, m); };
    ov.querySelectorAll("[data-ek]").forEach(b => b.onclick = () => { close(); kiralamaForm(D.coll("isciKiralamalar").find(x => x.id === b.dataset.ek), m); });
    ov.querySelectorAll("[data-et]").forEach(b => b.onclick = () => { close(); tahsilatForm(D.tahsilatlar().find(x => x.id === b.dataset.et), m); });
  }

  global.Isci = { render };
})(window);
