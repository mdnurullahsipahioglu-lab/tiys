/* TİYS — EŞLEŞTİRME KODU ile Senkron (hesap/şifre YOK)
 * 1 cihaz "Yeni eşleştirme" → kod üretir + verisini buluta koyar. Diğer cihazlar o kodu girer → bağlanır.
 * Sonra: KAYDET→buluta it (1.5sn); cihaza gelince/odaklanınca + 25sn'de bir çek. Cihaz değişiminde kayıp yok.
 * Güvenlik: anon tabloyu DÖKEMEZ; sadece kodu bilen RPC (tiys_oku/tiys_yaz) ile erişir. (SUPABASE_eslesme_kurulum.sql)
 */
(function (global) {
  "use strict";

  // ===================== KONFİG (Supabase projenden) =====================
  const SUPABASE_URL = "https://mpibjupaxkhmbrbmzmtk.supabase.co";
  const SUPABASE_ANON = "sb_publishable_2TNH2DCr1l1Y6PqrNnZUXg_Mk6WhN8s"; // publishable (client-safe)
  const KOD_KEY = "tiys_eslesme_kodu";
  const ALFABE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // karışıkları çıkardık: 0/O/1/I/L yok
  // =======================================================================

  let client = null, kod = null, pushTimer = null, lastSync = null;
  let sonBilinenBulut = null;   // gördüğümüz son bulut 'guncelleme' damgası — kendi push'umuzu geri çekmeyiz
  let yerelDegisti = false;     // kullanıcı düzenledi, henüz buluta gitmedi
  let pullEdiyor = false;       // pull import ederken tiys:save tetikleniyor → geri-push döngüsünü engelle
  let durum = "kapali";         // kapali | bagli | senkron | cevrimdisi | hata
  let pollTimer = null, dinleyiciKuruldu = false;

  function configured() { return !!(SUPABASE_URL && SUPABASE_ANON); }
  function libReady() { return !!(global.supabase && global.supabase.createClient); }
  function getClient() {
    if (!configured() || !libReady()) return null;
    if (!client) client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return client;
  }
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

  // Toplam kayıt sayısı — boş bulutla DOLU yereli SİLMEMEK için güvenlik
  function kayitSayisi(veri) {
    if (!veri) return 0;
    let n = 0;
    ["gelirler", "giderler", "tarlalar", "hasatlar", "isler", "isciKiralamalar", "isTakip", "puantaj"].forEach(function (k) {
      if (Array.isArray(veri[k])) n += veri[k].length;
    });
    return n;
  }

  async function restore() {
    const c = getClient(); if (!c) { setDurum("kapali"); return; }
    try { kod = localStorage.getItem(KOD_KEY) || null; } catch (e) { kod = null; }
    if (kod) { setDurum("bagli"); await pull(true); baglantiKur(); }
    else setDurum("kapali");
  }

  // İlk cihaz: kod üret + mevcut yerel veriyi buluta koy
  async function kodOlustur() {
    const c = getClient(); if (!c) return { error: "Bulut yapılandırılmadı (internet?)" };
    kod = kodUret();
    try { localStorage.setItem(KOD_KEY, kod); } catch (e) {}
    sonBilinenBulut = null;
    const r = await push();
    if (r.error) { kod = null; try { localStorage.removeItem(KOD_KEY); } catch (e) {} setDurum("kapali"); return { error: r.error }; }
    baglantiKur();
    return { ok: true, kod: kodGoster(kod) };
  }

  // Diğer cihaz: kodu gir → bulut verisini al (varsa). yerelVar=true ise çağıran ONAY almıştır (yerel değişecek).
  async function kodGir(girilen) {
    const c = getClient(); if (!c) return { error: "Bulut yapılandırılmadı (internet?)" };
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

  // Yerel → bulut (RPC)
  async function push() {
    const c = getClient(); if (!c || !kod) return { error: "Eşleştirilmedi" };
    setDurum("senkron");
    const veri = JSON.parse(DB.exportJSON());
    const { data, error } = await c.rpc("tiys_yaz", { p_kod: kod, p_veri: veri });
    if (error) { setDurum("cevrimdisi"); return { error: error.message }; }
    sonBilinenBulut = (typeof data === "string" ? data : new Date().toISOString());
    yerelDegisti = false; lastSync = new Date(); setDurum("bagli"); return { ok: true };
  }

  // Bulut → yerel (RPC) — GÜVENLİ: boş bulut dolu yereli silmez; sadece daha YENİ bulutu alır;
  // push edilmemiş yerel düzenlemenin üstüne yazmaz; import sırasında geri-push tetiklemez
  async function pull(sessiz) {
    const c = getClient(); if (!c || !kod) return { error: "Eşleştirilmedi" };
    if (yerelDegisti) return { ok: true, beklemede: true };
    const { data, error } = await c.rpc("tiys_oku", { p_kod: kod });
    if (error) { setDurum("cevrimdisi"); return { error: error.message }; }
    const row = Array.isArray(data) ? data[0] : data;
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

  // Cihaz değişiminde kayıp OLMASIN: ayrılırken bekleyeni gönder, gelince çek
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
    }
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden && kod) gelincePull(); }, 25000);
  }
  function baglantiKes() { clearInterval(pollTimer); pollTimer = null; }

  global.Cloud = { configured, libReady, status, restore, kodOlustur, kodGir, kopar, push, pull, kayitSayisi: function () { try { return kayitSayisi(JSON.parse(DB.exportJSON())); } catch (e) { return 0; } } };
  if (document.readyState !== "loading") restore(); else global.addEventListener("DOMContentLoaded", restore);
})(window);
