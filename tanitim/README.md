# TİYS tanıtım filmi

54 saniyelik, el çizimi kolaj tarzında tanıtım filmi. Görüntü, müzik ve efektlerin hepsi JavaScript ile üretilir; dışarıdan resim ya da müzik dosyası yoktur. Seslendirme Piper TTS (tr_TR-fahrettin-medium) ile üretildi.

- `index.html` — tek dosyalık oynatıcı. Tarayıcıda açıp ▶'ye basmak yeterli (boşluk tuşu: durdur/devam).
- `tiys-tanitim.mp4` — paylaşım için hazır video (1920×1080, 30 fps, -14 LUFS).

## Düzenleme

| Dosya | İçerik |
|---|---|
| `src/timeline.js` | Seslendirme metinleri/zamanları ve efekt zamanları (ses ile görüntü buradan eşlenir) |
| `src/anim.js` | Tüm sahneler ve çizim |
| `src/audio.js` | Müzik, efekt sentezi ve miks |
| `src/vo/*.mp3` | Seslendirme kayıtları |

Değişiklikten sonra:

```sh
python3 tools/build.py                       # index.html'i yeniden üretir
node tools/export.js tiys-tanitim.mp4 30     # MP4 (Playwright + ffmpeg gerekir)
node tools/snap.js klasor 12.5 30            # belirli saniyelerden kare alır
```
