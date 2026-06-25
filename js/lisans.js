/* TİYS — Lisans + 7 gün deneme. DİREKT SATIŞ (mağaza/IAP yok). Çevrimdışı doğrulama (CryptoJS).
 * Deneme: ilk açılıştan 7 gün tam erişim. Sonra: lisans anahtarı gir (Rıfat Sipahioğlu'ndan satın al) ya da sahip kodu.
 * Anahtarlar gizli değil-değer DEĞİL; geçerli anahtarların SHA256-ilk16 hash'leri gömülü (anahtar geri üretilemez).
 */
(function (global) {
  "use strict";

  const DENEME_GUN = 7;
  const KUR_KEY = "tiys_kurulum_ts";
  const LIS_KEY = "tiys_lisans";   // {tip:'sahip'|'lisansli', anahtar, ts} — bosla()/veri sıfırlama bunu SİLMEZ

  // Geçerli lisans anahtarlarının SHA256-ilk16 hash'leri (anahtarlar LISANS_ANAHTARLARI.txt'de, Rıfat'ta)
  const GECERLI = ["1fa76907283dcf44","ff6b626fd6d53f5a","ba2847ab5ecff62f","d9b5e29838785072","2502d30512aeb30b","d83a5c79702b15db","acc7ac9a24ec4e1e","e377fb04dae95543","6cfc23d5dd4dcb1a","fb084ee4dc7f454f","fa966f2621fe4700","2db2fb6400825103","bc4ce523db4b2b26","a7882d87e10990e6","b8bf5a36c447ad9a","dc4a0e55438c26ac","efc9026a677bfe24","fc31b4dc3870306d","3ada7107ac77d152","b7dcc34891cc264b","a900603aefce67ce","a714192417e59bee","cae86d23249d4e25","a3f0a09ee7ee76aa","900319f509716dc4","4eb7cd7a54ac898b","4457e87112d76bd5","0ae1b65d35b61f23","ead1057d67d567c4","ce6506c4d771716d","5bdf534a60d5f97b","03f382508c28c4ec","c59e0779fd9e63f4","fde319ade77db58d","5cc4842763174ba1","dada83daa4b1f9a8","8d71853290d78b83","62d8818eefc8d875","6101f45401a4ffb5","ce60c8725df12285","59aa873303e629a6","06c479060007d5fb","67c1811e4119e65a","4455169a4f0f8fcd","24145adeac6f5cef","674797f86e9c4783","c04e157e662b6770","8de0ed59c9d2a26f","bc45a62a1bd267f1","9ca5cc431fb7efc7","6f74e31df202d1f7","4a462f2778837951","d5b129feb40ab765","3d9a45a105457959","fc2a82e333c375c5","42707536cb5b784a","6b41f8085d131797","e35a4bb96561d734","bda90edd8c912d30","8e637fbe0075dac5"];
  const SAHIP = "c295597ed3ed70d5";   // SHA256-ilk16("rifatsahip") — Rıfat'ın kendi cihazları için ücretsiz tam erişim

  function h16(s) { try { return global.CryptoJS.SHA256(String(s || "")).toString().slice(0, 16); } catch (e) { return ""; } }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function kurulumTs() {
    let t = get(KUR_KEY);
    if (!t) { t = String(Date.now()); set(KUR_KEY, t); }
    return parseInt(t, 10) || Date.now();
  }
  function lisans() { try { return JSON.parse(get(LIS_KEY) || "null"); } catch (e) { return null; } }
  function denemeGunKalan() { const gecen = (Date.now() - kurulumTs()) / 86400000; return Math.max(0, Math.ceil(DENEME_GUN - gecen)); }

  function durum() {
    const L = lisans();
    if (L && L.tip === "sahip") return { tip: "sahip", erisim: true };
    if (L && L.tip === "lisansli") return { tip: "lisansli", erisim: true, anahtar: L.anahtar };
    const gk = denemeGunKalan();
    if (gk > 0) return { tip: "deneme", erisim: true, gunKalan: gk };
    return { tip: "doldu", erisim: false };
  }
  function erisimVar() { return durum().erisim; }

  // Anahtarı normalize et: TIYS-XXXX-XXXX-XXXX (büyük harf, tire/boşluk toleranslı)
  function normKey(k) {
    const s = String(k || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("TIYS") === 0 && s.length === 16) return "TIYS-" + s.slice(4, 8) + "-" + s.slice(8, 12) + "-" + s.slice(12, 16);
    return null;
  }
  function aktiveEt(girilen) {
    const raw = String(girilen || "").trim();
    if (!raw) return { ok: false, error: "Anahtar boş" };
    if (h16(raw.toLowerCase()) === SAHIP) { set(LIS_KEY, JSON.stringify({ tip: "sahip", ts: Date.now() })); return { ok: true, tip: "sahip" }; }
    const key = normKey(raw);
    if (key && GECERLI.indexOf(h16(key)) >= 0) { set(LIS_KEY, JSON.stringify({ tip: "lisansli", anahtar: key, ts: Date.now() })); return { ok: true, tip: "lisansli", anahtar: key }; }
    return { ok: false, error: "Geçersiz lisans anahtarı" };
  }
  function kaldir() { try { localStorage.removeItem(LIS_KEY); } catch (e) {} }            // test/çıkış
  function denemeyiSifirla() { try { localStorage.removeItem(KUR_KEY); } catch (e) {} }    // test

  global.Lisans = { durum, erisimVar, aktiveEt, denemeGunKalan, kaldir, denemeyiSifirla, DENEME_GUN };
  kurulumTs(); // ilk açılışta deneme damgasını koy
})(window);
