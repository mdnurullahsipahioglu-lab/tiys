/* TİYS — Dışa/İçe Aktarma: Excel (SheetJS, gerektiğinde yüklenir) + Word (.doc) + Excel içe aktarma */
(function (global) {
  "use strict";
  var XLSX_SRC = "vendor/xlsx.full.min.js?v=3";

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function clean(v) {
    var s = String(v == null ? "" : v);
    if (s.indexOf("<") >= 0) { var d = document.createElement("div"); d.innerHTML = s; s = d.textContent || d.innerText || ""; }
    return s.replace(/\s+/g, " ").trim();
  }
  function dl(blob, name) {
    var u = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
  }
  function safe(name) { return String(name || "tiys-aktarim").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60); }
  function tarihEk() { try { const d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); } catch (e) { return ""; } } // yerel gün
  function sheetName(n) { return (safe(n).replace(/[\[\]]/g, "").slice(0, 31)) || "Sayfa"; }

  function ensureXLSX(cb) {
    if (global.XLSX) return cb();
    var s = document.createElement("script");
    s.src = XLSX_SRC;
    s.onload = function () { cb(); };
    s.onerror = function () { alert("Excel modülü yüklenemedi (vendor/xlsx). Sayfayı yenileyip tekrar deneyin."); };
    document.head.appendChild(s);
  }

  // tables: [{name, headers:[...], rows:[[...],...]}]
  function excel(file, tables) {
    ensureXLSX(function () {
      try {
        var wb = XLSX.utils.book_new();
        (tables || []).forEach(function (t, i) {
          var aoa = [t.headers || []].concat(t.rows || []);
          var ws = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, ws, sheetName(t.name || ("Sayfa" + (i + 1))));
        });
        if (!wb.SheetNames.length) { alert("Aktarılacak veri yok."); return; }
        XLSX.writeFile(wb, safe(file) + "-" + tarihEk() + ".xlsx");
      } catch (e) { alert("Excel oluşturulamadı: " + e.message); }
    });
  }

  function word(file, title, tables) {
    var h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;color:#111}h1{font-size:17pt;margin:0 0 2pt}h2{font-size:13pt;color:#166534;margin:16pt 0 6pt}' +
      '.meta{color:#666;font-size:10pt;margin-bottom:10pt}table{border-collapse:collapse;width:100%;font-size:10.5pt;margin-bottom:10pt}' +
      'th,td{border:1px solid #999;padding:4pt 7pt;text-align:left}th{background:#16a34a;color:#fff}</style></head><body>';
    h += '<h1>' + esc(title) + '</h1><div class="meta">' + esc(tarihEk()) + '</div>';
    (tables || []).forEach(function (t) {
      h += '<h2>' + esc(t.name || "") + '</h2><table><thead><tr>' + (t.headers || []).map(function (x) { return '<th>' + esc(x) + '</th>'; }).join("") + '</tr></thead><tbody>';
      h += (t.rows || []).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join("") + '</tr>'; }).join("");
      h += '</tbody></table>';
    });
    h += '</body></html>';
    dl(new Blob(['﻿' + h], { type: "application/msword" }), safe(file) + "-" + tarihEk() + ".doc");
  }

  function importExcel(file, cb) {
    ensureXLSX(function () {
      var r = new FileReader();
      r.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
          var out = {};
          wb.SheetNames.forEach(function (n) { out[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: "" }); });
          cb(null, out);
        } catch (err) { cb(err); }
      };
      r.onerror = function () { cb(new Error("Dosya okunamadı")); };
      r.readAsArrayBuffer(file);
    });
  }

  // Buton çifti (Excel + Word). name = benzersiz anahtar (aynı sayfada).
  function bar(name) {
    return '<button class="btn ghost" data-xls="' + name + '" title="Excel (.xlsx) indir">📊 Excel</button>' +
           '<button class="btn ghost" data-doc="' + name + '" title="Word (.doc) indir">📄 Word</button>';
  }
  // build() → {file, title, tables}
  function wire(root, name, build) {
    var x = root.querySelector('[data-xls="' + name + '"]');
    if (x) x.onclick = function () { var b = build(); if (!b || !b.tables || !b.tables.length || !b.tables[0].rows.length) { alert("Aktarılacak kayıt yok."); return; } excel(b.file, b.tables); };
    var d = root.querySelector('[data-doc="' + name + '"]');
    if (d) d.onclick = function () { var b = build(); if (!b || !b.tables || !b.tables.length || !b.tables[0].rows.length) { alert("Aktarılacak kayıt yok."); return; } word(b.file, b.title || b.file, b.tables); };
  }

  // İçe-aktar butonu (liste sayfaları için, Excel ver'in yanına)
  function importBtn(name) {
    return '<button class="btn ghost" data-xlsimp="' + name + '" title="Excel (.xlsx) dosyasından kayıt ekle">📥 Excel\'den Al</button>';
  }
  // İçe-aktar butonunu bağla: dosya seç → ilk sayfanın satırlarını onRows'a ver
  function wireImport(root, name, onRows) {
    var b = root.querySelector('[data-xlsimp="' + name + '"]');
    if (!b) return;
    b.onclick = function () {
      var inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xlsx,.xls";
      inp.onchange = function (e) {
        var f = e.target.files[0]; if (!f) return;
        importExcel(f, function (err, out) {
          if (err) { alert("Excel okunamadı: " + (err.message || err)); return; }
          var sheet = Object.keys(out || {})[0];
          onRows((sheet && out[sheet]) || []);
        });
      };
      inp.click();
    };
  }

  global.Export = { excel: excel, word: word, importExcel: importExcel, bar: bar, importBtn: importBtn, wire: wire, wireImport: wireImport, clean: clean };
})(window);
