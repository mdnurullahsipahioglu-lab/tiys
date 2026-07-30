/* TİYS — Genel form motoru (şema → modal → doğrula → kaydet) */
(function (global) {
  "use strict";

  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
  }

  // <option> listesi üret (string ya da {v,l})
  function optHTML(opts, val) {
    return (opts || []).map(o => {
      const ov = typeof o === "string" ? o : o.v, ol = typeof o === "string" ? o : o.l;
      return `<option value="${ov}" ${String(val) === String(ov) ? "selected" : ""}>${ol}</option>`;
    }).join("");
  }

  // datetime-local için ISO → input değeri (yerel)
  function toInputDate(v) { if (!v) return ""; return String(v).slice(0, 10); }
  function toInputDateTime(v) { if (!v) return ""; const s = String(v); return s.length >= 16 ? s.slice(0, 16) : (s.length === 10 ? s + "T00:00" : s); }

  function fieldHTML(f, rec) {
    const val = rec[f.key] != null ? rec[f.key] : (f.default != null ? f.default : "");
    const req = f.required ? ' <span class="req">*</span>' : "";
    let input;
    if (f.type === "select") {
      const opts = f.optionsFor ? f.optionsFor(rec[f.dependsOn]) : (f.options || []);
      input = `<select data-k="${f.key}">${optHTML(opts, val)}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea data-k="${f.key}" placeholder="${f.placeholder || ""}">${val || ""}</textarea>`;
    } else if (f.type === "date") {
      input = `<input type="date" data-k="${f.key}" value="${toInputDate(val)}">`;
    } else if (f.type === "datetime") {
      input = `<input type="datetime-local" data-k="${f.key}" value="${toInputDateTime(val)}">`;
    } else if (f.type === "number" || f.type === "money") {
      input = `<input type="number" step="${f.step || "any"}" data-k="${f.key}" value="${val}" placeholder="${f.placeholder || ""}">`;
    } else {
      const hasDl = f.datalist && f.datalist.length;
      const lst = hasDl ? ` list="dl_${f.key}"` : "";
      const dlEl = hasDl ? `<datalist id="dl_${f.key}">${f.datalist.map(o => `<option value="${String(o).replace(/"/g, "&quot;")}"></option>`).join("")}</datalist>` : "";
      input = `<input type="text" data-k="${f.key}"${lst} value="${val != null ? String(val).replace(/"/g, "&quot;") : ""}" placeholder="${f.placeholder || ""}">${dlEl}`;
    }
    return `<div class="field ${f.full ? "full" : ""}"><label>${f.label}${req}</label>${input}
      ${f.hint ? `<div class="hint">${f.hint}</div>` : ""}${f.calc ? `<div class="calc" data-calc="${f.key}"></div>` : ""}</div>`;
  }

  function open(opts) {
    const rec = Object.assign({}, opts.record || {});
    const isEdit = !!(opts.record && opts.record.id);
    const ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = `<div class="modal">
      <div class="modal-head"><h3>${opts.icon || ""} ${opts.title}</h3><button class="x">✕</button></div>
      <div class="modal-body"><div class="form-grid">${opts.fields.map(f => fieldHTML(f, rec)).join("")}</div></div>
      <div class="modal-foot">
        ${isEdit && opts.onDelete ? `<button class="btn danger" data-del>🗑️ Sil</button>` : "<span></span>"}
        <div class="right"><button class="btn ghost" data-cancel>Vazgeç</button>
        <button class="btn primary" data-save>${isEdit ? "Güncelle" : "Kaydet"}</button></div>
      </div></div>`;
    document.body.appendChild(ov);

    const close = () => ov.remove();
    ov.querySelector(".x").onclick = close;
    ov.querySelector("[data-cancel]").onclick = close;
    ov.onclick = e => { if (e.target === ov) close(); };

    function collect() {
      const out = Object.assign({}, rec);
      ov.querySelectorAll("[data-k]").forEach(el => {
        const k = el.dataset.k, f = opts.fields.find(x => x.key === k);
        let v = el.value;
        if (f && (f.type === "number" || f.type === "money")) v = v === "" ? null : Number(v);
        out[k] = v;
      });
      return out;
    }
    // canlı otomatik hesap
    function recalc() {
      if (!opts.compute) return;
      const data = collect(), res = opts.compute(data) || {};
      Object.keys(res).forEach(k => { const el = ov.querySelector(`[data-calc="${k}"]`); if (el) el.textContent = res[k]; });
    }
    ov.querySelectorAll("[data-k]").forEach(el => el.addEventListener("input", recalc));
    recalc();
    // bağımlı seçimler (ör. ürün → çeşit)
    opts.fields.forEach(f => {
      if (!f.dependsOn || !f.optionsFor) return;
      const parent = ov.querySelector(`[data-k="${f.dependsOn}"]`), self = ov.querySelector(`[data-k="${f.key}"]`);
      if (parent && self) parent.addEventListener("change", () => { self.innerHTML = optHTML(f.optionsFor(parent.value), self.value); });
    });

    ov.querySelector("[data-save]").onclick = () => {
      const data = collect();
      const miss = opts.fields.filter(f => f.required && (data[f.key] == null || data[f.key] === "")).map(f => f.label);
      if (miss.length) { toast("Zorunlu alan: " + miss.join(", ")); return; }
      if (opts.compute) Object.assign(data, opts.computeSave ? opts.computeSave(data) : {});
      opts.onSave(data); close(); toast(isEdit ? "Güncellendi ✓" : "Kaydedildi ✓");
    };
    if (isEdit && opts.onDelete) {
      ov.querySelector("[data-del]").onclick = () => {
        if (confirm("Bu kaydı silmek istediğine emin misin?")) { opts.onDelete(rec.id); close(); toast("Silindi"); }
      };
    }
  }

  global.Forms = { open, toast };
})(window);
