/* TİYS — EŞLEŞTİRME KODU ile Senkron (hesap/şifre/SQL YOK) — Pantry (getpantry.cloud)
 * 1 cihaz "Yeni eşleştirme" → 8 haneli kod üretir + verisini buluta koyar. Diğer cihazlar o kodu girer → bağlanır.
 * Sonra: KAYDET→buluta it (1.5sn); cihaza gelince/odaklanınca + 25sn'de bir çek; internet gelince otomatik senkron.
 * Çevrimdışı çalışır (tarlada internet yok): yerel her zaman ana kaynak; bağlanınca eşitlenir. Cihaz değişiminde kayıp yok.
 */
(function (global) {
  "use strict";

  // ===================== KONFİG =====================
  const PANTRY_ID = "7ea60ce2-b66d-4c99-8993-7704ed5aca40";   // getpantry.cloud pantry kimliği (Rıfat, 2026-06-22; herkese ortak)
  const PANTRY_BASE = "https://getpantry.cloud/apiv1/pantry";
  const KOD_KEY = "tiys_eslesme_kodu";
  const ALFABE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // karışıkları çıkardık: 0/O/1/I/L yok
  // ==================================================

  let kod = null, pushTimer = null, lastSync = null;
  let sonBilinenBulut = null;   // gördüğümüz son bulut 'guncelleme' damgası — kendi push'umuzu geri çekmeyiz
  let yerelDegisti = false;     // kullanıcı düzenledi, henüz buluta gitmedi
  let pullEdiyor = false;       // pull import ederken tiys:save tetikleniyor → geri-push döngüsünü engelle
  let durum = "kapali";         // kapali | bagli | senkron | cevrimdisi | hata
  let pollTimer = null, dinleyiciKuruldu = false;

  function configured() { return !!PANTRY_ID && PANTRY_ID.indexOf("__") !== 0; }
  function libReady() { return typeof global.fetch === "function"; }
  function emit() { try { global.dispatchEvent(new CustomEvent("tiys:cloud")); } catch (e) {} }
  function setDurum(d) { durum = d; emit(); }
  function kodGoster(k) { return k ? (k.slice(0, 4) + "-" + k.slice(4)) : null; }
  function status() { return { configured: configured(), libReady: libReady(), paired: !!kod, kod: kodGoster(kod), lastSync, durum }; }

  function kodUret() {
    let bytes;
    try { bytes = new Uint8Array(8); (global.crypto || global.msCrypto).getRandomValues(bytes); }
    catch (e) { bytes = []; for (var i = 0; i < 8; i++) bytes.push(Math.floor(Math.random() * 256)); }
    let s = ""; for (var j = 0; j < 8; j++) s += ALFABE[bytes[j] % ALFABE.length];
    return s; // normalize (tiresiz) saklanır; gösterimde tire eklenir
  }
  function kodNormalize(x) { return (x || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase(); }
  function basketAdi(k) { return "tiys-" + k; }   // pantry sepeti adı = kod (namespace'li)

  // Toplam kayıt sayısı — boş bulutla DOLU yereli SİLMEMEK için güvenlik
  function kayitSayisi(veri) {
    if (!veri) return 0;
    let n = 0;
    ["gelirler", "giderler", "tarlalar", "hasatlar", "isler", "isciKiralamalar", "isTakip", "puantaj"].forEach(function (k) {
      if (Array.isArray(veri[k])) n += veri[k].length;
    });
    return n;
  }

  // ---- Pantry HTTP (fetch + CORS) ----
  async function pantryYaz(basket, payload) {   // POST = sepeti tamamen değiştir
    const res = await fetch(PANTRY_BASE + "/" + PANTRY_ID + "/basket/" + encodeURIComponent(basket), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("yaz HTTP " + res.status);
    return true;
  }
  async function pantryOku(basket) {            // GET; sepet yoksa 400 → null
    const res = await fetch(PANTRY_BASE + "/" + PANTRY_ID + "/basket/" + encodeURIComponent(basket), {
      method: "GET", headers: { "Accept": "application/json" }
    });
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new Error("oku HTTP " + res.status);
    return await res.json();
  }

  async function restore() {
    if (!configured() || !libReady()) { setDurum("kapali"); return; }
    try { kod = localStorage.getItem(KOD_KEY) || null; } catch (e) { kod = null; }
    if (kod) { setDurum("bagli"); await pull(true); baglantiKur(); }
    else setDurum("kapali");
  }

  // İlk cihaz: kod üret + mevcut yerel veriyi buluta koy
  async function kodOlustur() {
    if (!configured()) return { error: "Bulut yapılandırılmadı" };
    kod = kodUret();
    try { localStorage.setItem(KOD_KEY, kod); } catch (e) {}
    sonBilinenBulut = null;
    const r = await push();
    if (r.error) { kod = null; try { localStorage.removeItem(KOD_KEY); } catch (e) {} setDurum("kapali"); return { error: r.error }; }
    baglantiKur();
    return { ok: true, kod: kodGoster(kod) };
  }

  // Diğer cihaz: kodu gir → bulut verisini al (varsa)
  async function kodGir(girilen) {
    if (!configured()) return { error: "Bulut yapılandırılmadı" };
    const n = kodNormalize(girilen);
    if (n.length < 8) return { error: "Kod 8 karakter olmalı (ör. ABCD-EFGH)" };
    kod = n; try { localStorage.setItem(KOD_KEY, kod); } catch (e) {}
    sonBilinenBulut = null;
    const r = await pull(true);
    if (r.error) { kod = null; try { localStorage.removeItem(KOD_KEY); } catch (e) {} setDurum("kapali"); return { error: r.error }; }
    if (!r.vardi && !r.korundu) { await push(); }   // bu kodda bulut boştu → bu cihazın verisini yükle
    baglantiKur();
    return { ok: true, vardiVeri: !!r.vardi };
  }

  function kopar() {
    kod = null; sonBilinenBulut = null; yerelDegisti = false;
    try { localStorage.removeItem(KOD_KEY); } catch (e) {}
    baglantiKes(); setDurum("kapali");
  }

  // Yerel → bulut
  async function push() {
    if (!configured() || !kod) return { error: "Eşleştirilmedi" };
    setDurum("senkron");
    let payload;
    try {
      const veri = JSON.parse(DB.exportJSON());
      payload = { guncelleme: new Date().toISOString(), sayi: kayitSayisi(veri), veri: veri };
    } catch (e) { setDurum("hata"); return { error: "veri okunamadı" }; }
    try {
      await pantryYaz(basketAdi(kod), payload);
      sonBilinenBulut = payload.guncelleme;
      yerelDegisti = false; lastSync = new Date(); setDurum("bagli"); return { ok: true };
    } catch (e) { setDurum("cevrimdisi"); return { error: String(e.message || e) }; }
  }

  // Bulut → yerel — GÜVENLİ: boş bulut dolu yereli silmez; sadece daha YENİ bulutu alır;
  // push edilmemiş yerel düzenlemenin üstüne yazmaz; import sırasında geri-push tetiklemez
  async function pull(sessiz) {
    if (!configured() || !kod) return { error: "Eşleştirilmedi" };
    if (yerelDegisti) return { ok: true, beklemede: true };
    let row;
    try { row = await pantryOku(basketAdi(kod)); }
    catch (e) { setDurum("cevrimdisi"); return { error: String(e.message || e) }; }
    if (!row || !row.veri) return { ok: true, vardi: false };
    const yerel = JSON.parse(DB.exportJSON());
    if (kayitSayisi(row.veri) === 0 && kayitSayisi(yerel) > 0) { setDurum("bagli"); return { ok: true, korundu: true }; }
    if (row.guncelleme && sonBilinenBulut && row.guncelleme <= sonBilinenBulut) { setDurum("bagli"); return { ok: true, guncel: true }; }
    pullEdiyor = true;
    try { DB.importJSON(JSON.stringify(row.veri)); } finally { pullEdiyor = false; }
    sonBilinenBulut = row.guncelleme || sonBilinenBulut;
    lastSync = new Date(); setDurum("bagli");
    if (!sessiz && global.FIYS) FIYS.route();
    return { ok: true, vardi: true };
  }

  // KAYDET → kullanıcı düzenledi → kısa debounce ile buluta it
  global.addEventListener("tiys:save", function () {
    if (!kod || pullEdiyor) return;
    yerelDegisti = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(); }, 1500);
  });

  // Cihaz değişiminde / internet gelince kayıp OLMASIN
  function flushPush() { if (kod && yerelDegisti) { clearTimeout(pushTimer); push(); } }
  function gelincePull() { if (!kod) return; if (yerelDegisti) flushPush(); else pull(false); }

  function baglantiKur() {
    if (!dinleyiciKuruldu) {
      dinleyiciKuruldu = true;
      try { document.addEventListener("visibilitychange", function () { if (document.hidden) flushPush(); else gelincePull(); }); } catch (e) {}
      global.addEventListener("focus", gelincePull);
      global.addEventListener("blur", flushPush);
      global.addEventListener("pagehide", flushPush);
      global.addEventListener("beforeunload", flushPush);
      global.addEventListener("online", gelincePull);   // internet gelince otomatik senkron (tarladan eve dönünce)
    }
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden && kod) gelincePull(); }, 25000);
  }
  function baglantiKes() { clearInterval(pollTimer); pollTimer = null; }

  global.Cloud = { configured, libReady, status, restore, kodOlustur, kodGir, kopar, push, pull, kayitSayisi: function () { try { return kayitSayisi(JSON.parse(DB.exportJSON())); } catch (e) { return 0; } } };
  if (document.readyState !== "loading") restore(); else global.addEventListener("DOMContentLoaded", restore);
})(window);
