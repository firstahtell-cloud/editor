# Üçüncü taraf bileşenler

Editör'ün kendi kodu MIT lisanslıdır (bkz. `LICENSE`). Aşağıdaki bileşenler kendi lisanslarıyla gelir.

| Bileşen | Sürüm | Lisans | Nerede | Kaynak |
|---|---|---|---|---|
| Electron | 33.2.1 | MIT | Release zip'i (`Editor.exe` ve yanındaki dosyalar) | https://github.com/electron/electron |
| Chromium (Electron içinde) | — | BSD ve diğerleri | Release zip'i, `LICENSES.chromium.html` | https://www.chromium.org |
| FFmpeg (gyan.dev "essentials" derlemesi) | 6.0 | **GPLv3** | Release zip'i, `resources/app/ffmpeg.exe` (depoda yok) | https://ffmpeg.org/download.html · derleme: https://www.gyan.dev/ffmpeg/builds/ |
| Transformers.js | 3.7.6 | Apache-2.0 | `vendor/transformers.min.js` | https://github.com/huggingface/transformers.js |
| ONNX Runtime Web | — | MIT | `vendor/ort-wasm-simd-threaded.jsep.*` | https://github.com/microsoft/onnxruntime |
| earshot ses bankası | — | MIT | `sfxpack.bin`, `sfxpack.json` | https://github.com/Leonxlnx/earshot (Leon Lin) |

## Çalışırken indirilen modeller

Bu modeller depoda ve zip'te yoktur; ilk kullanımda indirilir ve kendi lisanslarına tabidir.

- **Whisper** (otomatik altyazı): `Xenova/whisper-tiny / base / small`, OpenAI Whisper'dan dönüştürülmüş, MIT.
- **MODNet** (arka plan silme): `Xenova/modnet`, Hugging Face üzerinden. Lisans için model sayfasına bakın: https://huggingface.co/Xenova/modnet

## FFmpeg hakkında

`ffmpeg.exe`, Editör'den ayrı bir programdır ve Editör onu yalnızca komut satırından çalıştırır. FFmpeg GPLv3 ile dağıtılır; kaynak kodu yukarıdaki bağlantılardan edinilebilir.
