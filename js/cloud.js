/* TİYS — Bulut Senkron (Supabase) — YAKIN GERÇEK ZAMANLI, çoklu cihaz, veri-kaybına karşı korumalı
 * Model: giriş yapılınca; KAYDET→buluta it (1.5sn), cihaza GELİNCE/odaklanınca + 25sn'de bir + Realtime ile çek.
 * Cihaz değiştirince kayıp olmasın: AYRILIRKEN bekleyen değişikliği hemen gönder, GELİRKEN bulutu çek.
 */
(function (global) {
  "use strict";

  // ===================== KONFİG (Supabase projenden) =====================
  const SUPABASE_URL = "https://mpibjupaxkhmbrbmzmtk.supabase.co";
  const SUPABASE_ANON = "sb_publishable_2TNH2DCr1l1Y6PqrNnZUXg_Mk6WhN8s"; // publishable (client-safe, gömülebilir)
  const TABLE = "tiys_kayit";     // veri tablosu
  // =======================================================================

  let client = null, user = null, pushTimer = null, lastSync = null;
  let sonBilinenBulut = null;   // gördüğümüz son bulut 'guncelleme' damgası — kendi push'umuzu geri çekmeyiz
  let yerelDegisti = false;     // kullanıcı düzenledi, henüz buluta gitmedi
  let pullEdiyor = false;       // pull import ederken tiys:save tetikleniyor → geri-push döngüsünü engelle
  let durum = "kapali";         // kapali | bagli | senkron | cevrimdisi | hata
  let realtimeKanal = null, pollTimer = null, dinleyiciKuruldu = false;

  function configured() { return !!(SUPABASE_URL && SUPABASE_ANON); }
  function libReady() { return !!(global.supabase && global.supabase.createClient); }
  function getClient() {
    if (!configured() || !libReady()) return null;
    if (!client) client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return client;
  }

  function emit() { try { global.dispatchEvent(new CustomEvent("tiys:cloud")); } catch (e) {} }
  function setDurum(d) { durum = d; emit(); }
  function status() { return { configured: configured(), libReady: libReady(), loggedIn: !!user, email: user && user.email, lastSync, durum }; }

  // Toplam kayıt sayısı — boş bulutla DOLU yereli SİLMEMEK için güvenlik ([[project-asistia-owner-unlock]] 'bomboş' dersi)
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
    try {
      const { data } = await c.auth.getSession();
      user = data && data.session ? data.session.user : null;
      if (user) { setDurum("bagli"); await pull(true); baglantiKur(); }
      else setDurum("kapali");
    } catch (e) { setDurum("hata"); }
  }
  async function signUp(email, pass) {
    const c = getClient(); if (!c) return { error: "Bulut yapılandırılmadı" };
    const { data, error } = await c.auth.signUp({ email, password: pass });
    if (error) return { error: cevir(error.message) };
    if (data && data.session) { user = data.user; setDurum("bagli"); await push(); baglantiKur(); return { ok: true, mesaj: "Kayıt olundu ✓" }; }
    return { ok: true, mesaj: "Kayıt oldun! E-postana gelen doğrulama bağlantısına bir kez tıkla, sonra 'Giriş Yap' de." };
  }
  async function signIn(email, pass) {
    const c = getClient(); if (!c) return { error: "Bulut yapılandırılmadı" };
    const { data, error } = await c.auth.signInWithPassword({ email, password: pass });
    if (error) return { error: cevir(error.message) };
    user = data.user; setDurum("bagli"); await pull(true); baglantiKur(); return { ok: true };
  }
  async function signOut() { const c = getClient(); if (c) await c.auth.signOut(); user = null; baglantiKes(); setDurum("kapali"); }

  // Yerel → bulut (upsert)
  async function push() {
    const c = getClient(); if (!c || !user) return { error: "Giriş yapılmadı" };
    setDurum("senkron");
    const veri = JSON.parse(DB.exportJSON());
    const guncelleme = new Date().toISOString();
    const { error } = await c.from(TABLE).upsert({ kullanici_id: user.id, veri, guncelleme }, { onConflict: "kullanici_id" });
    if (error) { setDurum("cevrimdisi"); return { error: error.message }; }
    sonBilinenBulut = guncelleme;   // kendi yazdığımız = bilinen bulut durumu (pull'da geri çekmeyiz)
    yerelDegisti = false; lastSync = new Date(); setDurum("bagli"); return { ok: true };
  }

  // Bulut → yerel — GÜVENLİ: (1) boş bulut DOLU yereli silmez (2) sadece daha YENİ bulutu alır
  // (3) push edilmemiş yerel düzenlemenin üstüne yazmaz (4) import sırasında geri-push tetiklemez
  async function pull(sessiz) {
    const c = getClient(); if (!c || !user) return { error: "Giriş yapılmadı" };
    if (yerelDegisti) { return { ok: true, beklemede: true }; }   // önce kendi değişikliğimiz gitsin (çağıran flush eder)
    const { data, error } = await c.from(TABLE).select("veri,guncelleme").eq("kullanici_id", user.id).maybeSingle();
    if (error) { setDurum("cevrimdisi"); return { error: error.message }; }
    if (!data || !data.veri) return { ok: true, vardi: false };
    // GÜVENLİK: bulut boş ama yerelde veri varsa SİLME
    const yerel = JSON.parse(DB.exportJSON());
    if (kayitSayisi(data.veri) === 0 && kayitSayisi(yerel) > 0) { setDurum("bagli"); return { ok: true, korundu: true }; }
    // Sadece gördüğümüzden daha YENİ bulutu al (kendi push'umuzu / bayat kopyayı tekrar alma)
    if (data.guncelleme && sonBilinenBulut && data.guncelleme <= sonBilinenBulut) { setDurum("bagli"); return { ok: true, guncel: true }; }
    pullEdiyor = true;
    try { DB.importJSON(JSON.stringify(data.veri)); } finally { pullEdiyor = false; }
    sonBilinenBulut = data.guncelleme || sonBilinenBulut;
    lastSync = new Date(); setDurum("bagli");
    if (!sessiz && global.FIYS) FIYS.route();
    return { ok: true, vardi: true };
  }

  // KAYDET → kullanıcı düzenledi → kısa debounce ile buluta it
  global.addEventListener("tiys:save", function () {
    if (!user || pullEdiyor) return;          // pull import'u kullanıcı düzenlemesi sayılmaz
    yerelDegisti = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push(); }, 1500);
  });

  // Cihaz değiştirince kayıp OLMASIN: ayrılırken bekleyeni hemen gönder, gelirken bulutu çek
  function flushPush() { if (user && yerelDegisti) { clearTimeout(pushTimer); push(); } }
  function gelincePull() { if (!user) return; if (yerelDegisti) flushPush(); else pull(false); }

  function baglantiKur() {
    if (dinleyiciKuruldu) { pollBaslat(); realtimeKur(); return; }
    dinleyiciKuruldu = true;
    try {
      document.addEventListener("visibilitychange", function () { if (document.hidden) flushPush(); else gelincePull(); });
    } catch (e) {}
    global.addEventListener("focus", gelincePull);
    global.addEventListener("blur", flushPush);
    global.addEventListener("pagehide", flushPush);
    global.addEventListener("beforeunload", flushPush);
    pollBaslat();
    realtimeKur();
  }
  function pollBaslat() {
    clearInterval(pollTimer);
    pollTimer = setInterval(function () { if (!document.hidden && user) gelincePull(); }, 25000);
  }
  function realtimeKur() {
    // Supabase Realtime (tablo realtime kapalıysa sessizce çalışmaz; poll/odak yedeği zaten var)
    try {
      const c = getClient();
      if (c && c.channel && !realtimeKanal && user) {
        realtimeKanal = c.channel("tiys-" + user.id)
          .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: "kullanici_id=eq." + user.id }, function () { if (!yerelDegisti) pull(false); })
          .subscribe();
      }
    } catch (e) {}
  }
  function baglantiKes() {
    clearInterval(pollTimer); pollTimer = null;
    try { if (realtimeKanal) { getClient().removeChannel(realtimeKanal); realtimeKanal = null; } } catch (e) {}
  }

  function cevir(m) {
    m = (m || "").toLowerCase();
    if (m.includes("invalid login")) return "E-posta ya da şifre hatalı.";
    if (m.includes("already registered")) return "Bu e-posta zaten kayıtlı, giriş yap.";
    if (m.includes("not confirmed")) return "E-posta doğrulanmamış.";
    if (m.includes("disabled")) return "E-posta girişi kapalı (Supabase'den açılmalı).";
    if (m.includes("invalid") && m.includes("email")) return "Geçersiz e-posta adresi.";
    if (m.includes("password")) return "Şifre en az 6 karakter olmalı.";
    return m;
  }

  global.Cloud = { configured, libReady, status, restore, signUp, signIn, signOut, push, pull };
  // sayfa açılınca oturumu geri yükle
  if (document.readyState !== "loading") restore(); else global.addEventListener("DOMContentLoaded", restore);
})(window);
