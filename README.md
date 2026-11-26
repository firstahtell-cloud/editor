# Editör

Windows için Electron tabanlı, kişisel kullanıma yönelik bir video editörü. Kısa dikey videolar (Shorts/Reels) ve YouTube videoları için yapıldı. Arayüz **İngilizce ve Türkçe** (ana ekranın sağ üstünden değiştirilir; varsayılan İngilizce).

*A personal video editor for Windows (Electron). UI in English and Turkish — switch from the top-right of the home screen.*

**Sürüm 4.0**

## Kurulum (en kolay yol)

1. [Releases](../../releases) sayfasından `Editor-4.0-win64.zip` dosyasını indir.
2. Zip'i istediğin bir klasöre aç (ör. `Belgeler\EditorApp`).
3. `Editor.exe`'yi çalıştır.

Kurulum programı yoktur; klasörü silmek kaldırmak için yeterlidir. Projeler, dolap ve ayarlar `%APPDATA%\Editor` klasöründe tutulur.

> Windows SmartScreen "bilinmeyen yayıncı" uyarısı verebilir: **Ek bilgi → Yine de çalıştır**.

## Kaynaktan çalıştırma

Gerekenler: [Node.js](https://nodejs.org) ve `ffmpeg.exe` ([gyan.dev](https://www.gyan.dev/ffmpeg/builds/) "essentials" derlemesi).

```powershell
git clone https://github.com/firstahtell-cloud/editor.git
cd editor
# ffmpeg.exe dosyasını bu klasöre koy (veya EDITOR_FFMPEG ortam değişkeniyle yolunu ver)
npm install
npx electron .
```

## Özellikler

- **Medya düzenleyici:** dosyayı eklerken, dolapta (sağ tık) veya ses efektlerinde ✎ ile baştan/sondan kesme, ses düzeyi, hız ve ton; dosyanın kendisi değişmez
- **Özel ses efektleri:** kendi seslerini "Özel" sekmesine ekle
- **Dolap:** Ctrl+G ile gruplama; zaman çizelgesindeki klibi sağ tık → "Dolaba ekle (ayarlarıyla)"
- **Arayüz:** çizgi ikonlu düğmeler, üzerine gelince açıklama ve kısayol gösteren bilgi balonları; İngilizce / Türkçe
- **Zaman çizelgesi:** çoklu iz, kesme (K), silme (X), mıknatıs (M), geri al / yinele, otomatik kayıt ve proje yedekleri (⟲)
- **Video:** kareler ffmpeg ile çözülür, kare doğru atlama; hız 0.25×–4× ve hız rampası, kare dondurma
- **Keyframe'ler:** konum, ölçek, döndürme, opaklık, ses ve hız için; eğri editörü (Tab)
- **Metin ve altyazı:** Whisper ile otomatik altyazı (çevrimdışı), kelime zamanlamalı ve karaoke altyazı
- **Görüntü:** efektler (video, görsel, metin ve şekillerde), videoyu/görseli en-boy ayrı esnetme, yeşil ekran (damlalıkla renk seçimi), kırpma (C), ayna, arka plan bulanıklığı, netlik bloğu, Katmanlar paneli
- **Ses:** %300'e kadar ses, ton değiştirme (±12 yarım ton), perdeyi koruyarak uzatma, sessizlik kesme, 250+ ses efekti tarayıcısı
- **Kapak tasarımcısı:** Shorts 1080×1920 ve YouTube 1280×720, hazır metin stilleri, arka plan silme (MODNet), ≤2 MB JPG dışa aktarma
- **Dışa aktarma:** 9:16, 16:9, 1:1, 4:5; 24/30/60 fps; MP4 (ffmpeg)

## Kısayollar

| Tuş | İş |
|---|---|
| Boşluk | Oynat / durdur |
| ← / → | Bir kare (Shift ile 1 sn) |
| Home | Başa git |
| K | Kes |
| X / Delete | Sil |
| I | Keyframe ekle |
| M | Mıknatıs |
| Tab | Eğri editörü |
| Shift+A | Ekle menüsü |
| G | Taşı (X/Y ekseni, Shift hassas, Esc iptal) |
| C | Kırp |
| H | Temiz görünüm (yalnız video) |
| F | Tam ekran |
| Ctrl+S | Kaydet |
| Ctrl+Z / Ctrl+Y | Geri al / Yinele |
| ? veya F1 | Tüm kısayollar |

## Dosya yapısı

- `main.js` — ana süreç: yerel medya sunucusu, ffmpeg ile kare çözme, ses, dışa aktarma, proje/kapak kaydı, model indirme
- `preload.js` — `window.api` köprüsü
- `app.js` — çekirdek: çizim, oynatma, zaman çizelgesi, kısayollar
- `i18n.js` — dil desteği (sözlük; ekrandaki yazıları seçili dile çevirir)
- `icons.js` — çizgi ikonlar, bilgi balonu, dil seçici
- `features13.js` — medya düzenleyici, özel ses efektleri, dolap düzenleme
- `features*.js` — ek özellikler (sırayla yüklenir, aynı global kapsamı paylaşır)
- `style.css`, `index.html` — arayüz
- `sfxpack.bin/.json` — ses efekti bankası
- `vendor/` — Transformers.js ve ONNX Runtime (altyazı ve arka plan silme)

## Lisans

Editör'ün kodu [MIT](LICENSE) lisanslıdır. Kullanılan üçüncü taraf bileşenler (FFmpeg GPLv3 dahil) için bkz. [THIRD_PARTY.md](THIRD_PARTY.md).
