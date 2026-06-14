/* TİYS — Bulut Senkron (Supabase: e-posta/şifre giriş + veri eşitleme)
 * Offline-öncelikli: bulut yalnızca giriş yapılınca + internet varken devreye girer.
 * Aşağıdaki KONFİG'i kendi Supabase projenden doldur (URL + anon key).
 */
(function (global) {
  "use strict";

  // ===================== KONFİG (Supabase projenden) =====================
  const SUPABASE_URL = "";        // ör. https://abcd1234.supabase.co
  const SUPABASE_ANON = "";       // anon public key (gizli değil, gömülebilir)
  const TABLE = "tiys_kayit";     // veri tablosu
  // =======================================================================

  let client = null, user = null, pushTimer = null, lastSync = null;

  function configured() { return !!(SUPABASE_URL && SUPABASE_ANON); }
  function libReady() { return !!(global.supabase && global.supabase.createClient); }
  function getClient() {
    if (!configured() || !libReady()) return null;
    if (!client) client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    return client;
  }

  function emit() { try { global.dispatchEvent(new CustomEvent("tiys:cloud")); } catch (e) {} }
  function status() { return { configured: configured(), libReady: libReady(), loggedIn: !!user, email: user && user.email, lastSync }; }

  async function restore() {
    const c = getClient(); if (!c) return;
    try { const { data } = await c.auth.getSession(); user = data && data.session ? data.session.user : null; if (user) await pull(true); } catch (e) {}
    emit();
  }
  async function signUp(email, pass) {
    const c = getClient(); if (!c) return { error: "Bulut yapılandırılmadı" };
    const { data, error } = await c.auth.signUp({ email, password: pass });
    if (error) return { error: cevir(error.message) };
    user = data.user; emit(); return { ok: true, mesaj: "Kayıt oldun. E-postanı doğrulaman gerekebilir." };
  }
  async function signIn(email, pass) {
    const c = getClient(); if (!c) return { error: "Bulut yapılandırılmadı" };
    const { data, error } = await c.auth.signInWithPassword({ email, password: pass });
    if (error) return { error: cevir(error.message) };
    user = data.user; emit(); await pull(true); return { ok: true };
  }
  async function signOut() { const c = getClient(); if (c) await c.auth.signOut(); user = null; emit(); }

  // Yerel veriyi buluta yaz (upsert)
  async function push() {
    const c = getClient(); if (!c || !user) return { error: "Giriş yapılmadı" };
    const veri = JSON.parse(DB.exportJSON());
    const { error } = await c.from(TABLE).upsert({ kullanici_id: user.id, veri, guncelleme: new Date().toISOString() }, { onConflict: "kullanici_id" });
    if (error) return { error: error.message };
    lastSync = new Date(); emit(); return { ok: true };
  }
  // Buluttan çek (yereli değiştirir)
  async function pull(sessiz) {
    const c = getClient(); if (!c || !user) return { error: "Giriş yapılmadı" };
    const { data, error } = await c.from(TABLE).select("veri,guncelleme").eq("kullanici_id", user.id).maybeSingle();
    if (error) return { error: error.message };
    if (data && data.veri) { DB.importJSON(JSON.stringify(data.veri)); lastSync = new Date(); emit(); if (!sessiz && global.FIYS) FIYS.route(); return { ok: true, vardi: true }; }
    return { ok: true, vardi: false };
  }

  // Değişiklikte otomatik buluta yükle (debounce)
  global.addEventListener("tiys:save", () => {
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { push(); }, 2500);
  });

  function cevir(m) {
    m = (m || "").toLowerCase();
    if (m.includes("invalid login")) return "E-posta ya da şifre hatalı.";
    if (m.includes("already registered")) return "Bu e-posta zaten kayıtlı.";
    if (m.includes("password")) return "Şifre en az 6 karakter olmalı.";
    return m;
  }

  global.Cloud = { configured, libReady, status, restore, signUp, signIn, signOut, push, pull };
  // sayfa açılınca oturumu geri yükle
  if (document.readyState !== "loading") restore(); else global.addEventListener("DOMContentLoaded", restore);
})(window);
