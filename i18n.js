// i18n.js — Dil desteği (Türkçe / English). İlk yüklenen dosya.
// Kod Türkçe yazı üretmeye devam eder; LANG='en' iken ekrana gelen her yazı (metin düğümleri,
// title/placeholder/data-tip öznitelikleri) bu sözlükle anında İngilizceye çevrilir.
// Sözlükte olmayan yazı olduğu gibi kalır. Dil değişince sayfa yeniden yüklenir.
'use strict';
const LANG = (() => { try { return localStorage.getItem('lang') || 'en'; } catch { return 'en'; } })();
document.documentElement.lang = LANG;

const I18N_EN = {
  // ---- Genel / üst çubuk ----
  'Editör': 'Editor', 'Proje adı': 'Project name', 'Projeler': 'Projects', 'Konuşmayı yazıya dök': 'Transcribe speech',
  'Video formatı': 'Video format', 'Kare hızı': 'Frame rate', 'Aramayı temizle': 'Clear search', 'Kaydet': 'Save', 'Metin': 'Text',
  'Otomatik altyazı': 'Auto captions', '9:16 Dikey': '9:16 Vertical', '16:9 YouTube': '16:9 YouTube', '1:1 Kare': '1:1 Square', '4:5 Gönderi': '4:5 Post',
  'Dışa Aktar': 'Export', 'Dışa aktar': 'Export', 'Dolap': 'Library', 'Ekle': 'Add', 'Ara': 'Search', 'Dolapta ara…': 'Search library…', 'Özellikler': 'Properties', 'Klip seç': 'Select a clip',
  'Eğri editörü': 'Curve editor', 'Mıknatıs': 'Magnet', 'Kısayollar': 'Shortcuts', 'İptal': 'Cancel', 'Oluşturmaya başla': 'Start creating',
  'Sürükle-bırak veya Shift+A. Çift tıkla = playhead\'e ekle.': 'Drag & drop or Shift+A. Double-click = add at playhead.',
  'Geri al': 'Undo', 'Yinele': 'Redo', 'Oynat': 'Play', 'Durdur': 'Pause', 'Başa git': 'Go to start', 'Dil': 'Language',
  // ---- Kolaylaştırma (easing) ----
  'Düz (linear)': 'Linear', 'Özel Bezier': 'Custom Bezier', 'Sabit (hold)': 'Hold',
  // ---- Geçişler ----
  'Yok': 'None', 'Solma': 'Fade', 'Kayma ←': 'Slide ←', 'Kayma →': 'Slide →', 'Kayma ↑': 'Slide ↑', 'Kayma ↓': 'Slide ↓', 'Yakınlaşma': 'Zoom in', 'Uzaklaşma': 'Zoom out',
  'Zıplama (pop)': 'Pop', 'Dönerek': 'Spin', 'Bulanık': 'Blur', 'Perde →': 'Wipe →', 'Perde ↓': 'Wipe ↓', 'Takla (yatay)': 'Flip (horizontal)',
  // ---- Dolap / içe aktarma ----
  'İçe aktarılıyor': 'Importing', 'Açılamadı': 'Could not open',
  // ---- Zaman çizelgesi ----
  'Değer keyframe\'i': 'Value keyframe', 'Dönüşüm keyframe\'i': 'Transform keyframe', 'sürükle: zamanı değiştir': 'drag: change time',
  // ---- Özellikler paneli ----
  'Dönüşüm': 'Transform', 'Ölçek': 'Scale', 'Döndürme': 'Rotation', 'Opaklık': 'Opacity', 'Ad': 'Name', 'Başlangıç': 'Start', 'Süre': 'Duration', 'Ses': 'Audio',
  'Giriş': 'In', 'Giriş süresi': 'In duration', 'Çıkış': 'Out', 'Çıkış süresi': 'Out duration', 'Geçişler': 'Transitions',
  'Geçiş (playhead\'deki keyframe\'den sonraki)': 'Easing (after the keyframe at playhead)', 'Tür': 'Type', 'Değerler': 'Values', 'Önceki': 'Previous', 'Sonraki': 'Next',
  'Keyframe ekle (I)': 'Add keyframe (I)', 'Belirme (sn)': 'Fade in (s)', 'Kaybolma (sn)': 'Fade out (s)', 'Belirme / Kaybolma': 'Fade in / out', 'X kayma': 'X offset', 'Y kayma': 'Y offset', 'Daktilo (sn)': 'Typewriter (s)',
  'Yazı': 'Text', 'Font': 'Font', 'Boyut': 'Size', 'Kalın': 'Bold', 'İtalik': 'Italic', 'BÜYÜK HARF': 'UPPERCASE', 'Hizalama': 'Align', 'Sol': 'Left', 'Orta': 'Center', 'Sağ': 'Right',
  'Harf aralığı': 'Letter spacing', 'Satır aralığı': 'Line height', 'Yatay ölçek (en)': 'Horizontal scale', 'Renk': 'Color', 'Gradyan': 'Gradient', 'Alt renk': 'Bottom color',
  'Çerçeve (kontur)': 'Outline', 'Kalınlık': 'Thickness', 'Arka plan': 'Background', 'Açık': 'On', 'Boşluk': 'Padding', 'Köşe yuvarlak': 'Corner radius', 'Işık (glow)': 'Glow',
  'Yayılma': 'Spread', 'Gölge': 'Shadow', 'Bulanıklık': 'Blur', 'Animasyon': 'Animation', 'Hazır stil': 'Preset style', 'Seç…': 'Choose…', 'Altyazı': 'Caption', 'Başlık': 'Title',
  'Neon': 'Neon', 'Altın': 'Gold', 'Etiket': 'Label',
  'Önce görsel/metin klip seç': 'Select a visual/text clip first', 'Playhead klibin üstünde değil': 'Playhead is not over the clip', 'Keyframe eklendi': 'Keyframe added',
  // ---- Projeler ----
  'Proje': 'Project', 'Değişiklikler kaydedilsin mi?': 'Save changes?', 'Bu proje henüz kaydedilmedi.': 'This project has not been saved yet.', 'Kaydetme': 'Don\'t save',
  'Projeyi kaydet': 'Save project', 'Proje adı:': 'Project name:', 'Henüz proje yok. Aşağıdan yeni bir proje oluştur.': 'No projects yet. Create a new one below.',
  'Sil': 'Delete', 'Yedekler (önceki halleri)': 'Backups (earlier versions)', 'Proje silinsin mi?': 'Delete project?', 'Geri yükle': 'Restore',
  'Bu projenin henüz yedeği yok. Her kaydedişte önceki hali otomatik saklanır (en sık 2 dakikada bir, son 30 yedek).': 'This project has no backups yet. The previous version is saved automatically on each save (at most every 2 minutes, last 30 backups).',
  'Kapat': 'Close', 'Kaydedildi ✓': 'Saved ✓', 'Kaydedildi': 'Saved',
  // ---- Dışa aktarma ----
  'Zaman çizelgesi boş': 'Timeline is empty', 'İptal edildi': 'Cancelled', 'Kodlama bitiriliyor…': 'Finishing encoding…', 'Bitti': 'Done',
  'Kalite': 'Quality', 'Yüksek': 'High', 'Normal': 'Normal', 'Küçük dosya': 'Small file', 'Çözünürlük': 'Resolution',
  'Geçiş uygulandı': 'Transition applied', 'Video': 'Video', 'Görsel': 'Image', 'Düz metin': 'Plain text', 'Dolaptan': 'From library', '(dolap boş)': '(library empty)',
  'Giriş geçişi': 'In transition', 'Çıkış geçişi': 'Out transition', 'Keyframe': 'Keyframe', 'Ara…': 'Search…', 'Sonuç yok': 'No results',
  // ---- Renk filtreleri ----
  'Sıcak': 'Warm', 'Soğuk': 'Cool', 'Vintage': 'Vintage', 'Canlı': 'Vivid', 'Sinematik': 'Cinematic', 'Soluk': 'Faded', 'Dramatik': 'Dramatic', 'Siyah-Beyaz': 'Black & white',
  // ---- Şekiller ----
  'Kutu': 'Box', 'Daire': 'Circle', 'Üçgen': 'Triangle', 'Yıldız': 'Star', 'Kalp': 'Heart', 'Ok': 'Arrow', 'Çizgi': 'Line', 'Şekil': 'Shape', 'Genişlik': 'Width', 'Yükseklik': 'Height',
  'Dolgu': 'Fill', 'Dolgu rengi': 'Fill color', 'Çerçeve': 'Frame', 'Kutu genişliği (0 = otomatik)': 'Box width (0 = auto)', 'Çerçeve rengi': 'Border color', 'Çıkartma': 'Sticker',
  // ---- Hız / medya ----
  'Ters oynat': 'Reverse', 'Bu müzik: konuşmada kıs': 'This is music: lower during speech', 'Kısma seviyesi': 'Duck level', 'Hız': 'Speed', 'Sesi otomatik kıs': 'Auto ducking',
  'Yerleşim': 'Fit', 'Sığdır': 'Fit', 'Doldur (kırp)': 'Fill (crop)', 'Bulanık arka plan': 'Blurred background', 'Ters görsel (ayna)': 'Mirror',
  'Parlaklık': 'Brightness', 'Kontrast': 'Contrast', 'Doygunluk': 'Saturation', 'Sıcaklık': 'Temperature', 'Ton': 'Tint', 'Ton (perde)': 'Pitch', 'Ses düzeyi': 'Volume', 'Soluklaştır': 'Fade', 'Vinyet': 'Vignette',
  'Renk ayarı': 'Color adjust', 'Filtre': 'Filter', 'Sıfırla': 'Reset',
  'Mıknatıs açık: silince boşluk kapanır': 'Magnet on: gaps close when deleting', 'Mıknatıs kapalı': 'Magnet off',
  'Bu klipte keyframe yok — I tuşuyla ekle': 'This clip has no keyframes — press I to add', 'Keyframe\'i olan bir klip seç': 'Select a clip with keyframes',
  'Normalize': 'Normalize', 'Seçili keyframe geçişi': 'Selected keyframe easing',
  'Sürükle: keyframe/tutamak · Tekerlek: yakınlaş · Shift+Tekerlek: kaydır · Çift tık: sığdır · X: sil': 'Drag: keyframe/handle · Wheel: zoom · Shift+Wheel: scroll · Double-click: fit · X: delete',
  // ---- Kısayollar listesi ----
  'Oynat / durdur': 'Play / pause', 'Playhead\'de kes': 'Split at playhead', 'Seçili klipleri sil': 'Delete selected clips', 'Ekle menüsü': 'Add menu', 'Metin ekle': 'Add text',
  'Keyframe ekle': 'Add keyframe', 'Mıknatıs aç / kapa': 'Toggle magnet', 'Zaman çizelgesi ↔ Eğri editörü': 'Timeline ↔ Curve editor', 'Ctrl+tık / Shift+tık': 'Ctrl+click / Shift+click',
  'Çoklu seçim': 'Multi-select', 'Boş alanda sürükle': 'Drag on empty area', 'Kutu ile seçim': 'Box select', 'Hepsini seç': 'Select all', 'Kopyala / playhead\'e yapıştır': 'Copy / paste at playhead',
  'Çoğalt': 'Duplicate', 'Başa dön': 'Back to start', 'Zaman çizelgesini yakınlaştır': 'Zoom timeline', 'Tekerlek (önizleme)': 'Wheel (preview)', 'Seçili klibi büyüt / küçült': 'Scale selected clip',
  'Alt+sürükle (eğri)': 'Alt+drag (curve)', 'Eğri editöründe kaydır': 'Pan in curve editor', 'Seçimi kaldır': 'Deselect', 'Bu liste': 'This list', 'Geliştirici araçları': 'Developer tools',
  'Geri al / ileri al': 'Undo / redo', '1 kare geri / ileri': '1 frame back / forward', '1 saniye geri / ileri': '1 second back / forward', 'Ctrl+Tekerlek': 'Ctrl+Wheel',
  // ---- Otomatik altyazı ----
  'Zaman çizelgesinde konuşma içeren video veya ses yok.': 'There is no video or audio with speech on the timeline.', 'Tamam': 'OK',
  'Konuşma bilgisayarında yazıya dökülür, hiçbir yere gönderilmez. İlk kullanımda model bir kez indirilir. "Müzik" olarak işaretli sesler dinlenmez.': 'Speech is transcribed on your computer and never sent anywhere. The model is downloaded once on first use. Audio marked as "music" is skipped.',
  'Türkçe': 'Turkish', 'İngilizce': 'English', 'Otomatik algıla': 'Auto detect', 'Hızlı (81 MB)': 'Fast (81 MB)', 'Kaliteli (253 MB)': 'Accurate (253 MB)', 'Stil': 'Style',
  'Kelime / altyazı': 'Words / caption', 'Konum': 'Position', 'Alt': 'Bottom', 'Üst': 'Top', 'Kelime efekti': 'Word effect', 'Vurgu rengi': 'Highlight color', 'Oluştur': 'Create',
  'Hazırlanıyor…': 'Preparing…', 'Ses hazırlanıyor…': 'Preparing audio…', 'Model yükleniyor…': 'Loading model…', 'Çalışan hatası': 'Worker error',
  'Konuşma bulunamadı': 'No speech found', 'Altyazı oluşturulamadı': 'Could not create captions', 'Ses efekti': 'Sound effect', '(yükleniyor…)': '(loading…)', 'Önceki çalışma': 'Previous work',
  'Pop (harf harf)': 'Pop (per letter)', 'Pop (kelime kelime)': 'Pop (per word)', 'Karaoke (kelime renklenir)': 'Karaoke (words light up)', 'Tek kelime': 'Single word',
  'Vurgu + zıplama': 'Highlight + bounce', 'Kelime vurgusu': 'Word highlight', 'Vurgu büyüklüğü': 'Highlight size',
  // ---- Dolap grupları ----
  'Yeni grup': 'New group', 'Grup adı:': 'Group name:', 'Grup': 'Group', 'Grubu yeniden adlandır': 'Rename group', 'Yeni gruba ekle…': 'Add to new group…', 'Gruba taşı': 'Move to group',
  'Gruptan çıkar': 'Remove from group', 'Dolaptan sil': 'Remove from library', 'Yeniden adlandır': 'Rename', 'Grubu dağıt': 'Ungroup', 'Grubu içindekilerle sil': 'Delete group with contents',
  'Takma ad': 'Alias', 'Takma ad ver…': 'Set alias…', 'Kaldır': 'Remove', 'Playhead\'e ekle': 'Add at playhead', 'Grupsuz': 'Ungrouped', 'Yeni grup…': 'New group…', 'Yeni grup adı': 'New group name',
  'Hepsi için grup': 'Group for all', 'Dosya ekleniyor': 'Adding files', 'Sadece projeye ekle': 'Add to project only', 'Dolaba ekle': 'Add to library',
  'Editör güncellendi. Yeni sürümü kullanmak için yeniden başlat.': 'Editor was updated. Restart to use the new version.', 'Yeniden başlat': 'Restart', 'Sonra': 'Later',
  // ---- Metin animasyonları ----
  'Yukarıdan düş': 'Drop from top', 'Aşağıdan yüksel': 'Rise from bottom', 'Harf harf belir': 'Letter by letter', 'Büyükten küçül': 'Shrink in', 'Dönerek gel': 'Spin in', 'Zıpla': 'Bounce',
  'Bulanıktan netleş': 'Blur in', 'Soldan kay': 'Slide from left', 'Dalga': 'Wave', 'Titreme': 'Shake', 'Nabız': 'Pulse', 'Süzülme': 'Float', 'Gökkuşağı': 'Rainbow', 'Glitch': 'Glitch',
  'Sallanma': 'Wobble', 'Sürekli': 'Loop', 'Sürekli hız': 'Loop speed', 'Animasyon uygulandı': 'Animation applied', 'Metin animasyonu': 'Text animation',
  // ---- Efektler / netlik bloğu / dondurma / katmanlar ----
  'Pikselleştir': 'Pixelate', 'RGB kayması': 'RGB split', 'Parlama': 'Bloom', 'Sarsıntı': 'Camera shake', 'Film greni': 'Film grain', 'Efektler': 'Effects', 'Efektleri sıfırla': 'Reset effects',
  'Netlik bloğu': 'Focus block', 'Netlik bloğu eklendi: dışı bulanık': 'Focus block added: outside is blurred', 'Dikdörtgen': 'Rectangle', 'Elips': 'Ellipse', 'Dış bulanıklık': 'Outside blur',
  'Kenar yumuşaklığı': 'Edge softness', 'Dışı karart': 'Darken outside',
  'Birden fazla blok aynı anda olursa hepsinin içi net kalır. Katmanlarda bloğun üstündekiler bulanıklaşmaz.': 'If several blocks overlap in time, all their insides stay sharp. Layers above the block are not blurred.',
  'Dondur': 'Freeze', 'Bu kareyi dondur (3 sn)': 'Freeze this frame (3 s)',
  'Playhead\'deki kare 3 saniyelik fotoğraf olur, videonun kalanı sağa kayar. Fotoğrafı kenarından sürükleyip uzatabilirsin.': 'The frame at the playhead becomes a 3-second still; the rest of the video shifts right. Drag the still\'s edge to lengthen it.',
  'Önce bir video klip seç': 'Select a video clip first', 'Playhead videonun üzerinde olmalı': 'Playhead must be over the video', 'Kare alınamadı': 'Could not grab frame',
  'Kare donduruluyor…': 'Freezing frame…', 'Kare donduruldu (3 sn)': 'Frame frozen (3 s)',
  'Seçili öğeyi bir öne al': 'Bring selected forward', 'Seçili öğeyi bir arkaya al': 'Send selected backward', 'Sırayı zaman çizelgesindeki iz sırasına döndür': 'Reset order to timeline track order',
  'Katmanlar': 'Layers', 'Katmanlar (L)': 'Layers (L)', 'Üstteki öne çıkar · satırı sürükleyerek sırala': 'Top is in front · drag rows to reorder', 'Öne': 'Forward', 'Arkaya': 'Backward',
  'İz sırasına dön': 'Track order', 'Katman sırası iz sırasına döndü': 'Layer order reset to track order', 'Katman sırası değişti': 'Layer order changed', 'Göster': 'Show', 'Gizle': 'Hide',
  'Sürükle: katman sırası': 'Drag: layer order', 'Playhead\'de görsel öğe yok': 'No visual items at playhead', 'Görsel öğe yok. Shift+A ile metin, video, şekil ekle.': 'No visual items. Add text, video or shapes with Shift+A.',
  'Önce görsel bir öğe seç': 'Select a visual item first', 'Zaten en önde': 'Already at the front', 'Zaten en arkada': 'Already at the back', 'Sadece playhead\'dekiler': 'Only at playhead',
  'Netlik bloğu (dışı bulanık)': 'Focus block (blur outside)', 'Kareyi dondur (seçili video)': 'Freeze frame (selected video)', 'Katmanlar paneli': 'Layers panel',
  'Shift + döndürme tutamacı': 'Shift + rotate handle', '15° adımla döndür': 'Rotate in 15° steps',
  // ---- Sessizlik kesme ----
  'Konuşmadaki boşlukları bul ve kes': 'Find and cut pauses in speech', 'Sessizlikleri kes': 'Cut silences', 'Eşik': 'Threshold', 'En kısa boşluk': 'Shortest pause', 'Kenar payı': 'Padding',
  'Vazgeç': 'Cancel', 'Kes': 'Cut',
  'Zaman çizelgesinde konuşma içeren video veya ses yok. ("Müzik" olarak işaretli sesler dinlenmez.)': 'There is no video or audio with speech on the timeline. (Audio marked as "music" is skipped.)',
  'Ses inceleniyor…': 'Analyzing audio…', 'Ses okunamadı': 'Could not read audio', 'Kırmızı bölgeler kesilecek. Bir bölgeye tıklarsan o boşluk korunur.': 'Red regions will be cut. Click a region to keep that pause.',
  'Bu ayarlarla boşluk bulunamadı': 'No pauses found with these settings', 'Kesilecek boşluk yok': 'Nothing to cut', 'kes': 'cut', 'koru': 'keep',
  // ---- Yeşil ekran ----
  'Saydam renk': 'Key color', 'Kapalı': 'Off', 'Yeşil': 'Green', 'Mavi': 'Blue', 'Özel renk': 'Custom color', 'Önizlemeden renk seç': 'Pick color from preview', 'Tolerans': 'Tolerance',
  'Renk taşmasını azalt': 'Reduce color spill', 'Yeşil ekran': 'Green screen', 'Arkasında görünmesini istediğin videoyu/görseli bu klibin altındaki katmana koy.': 'Put the video/image you want behind it on a layer below this clip.',
  'Önizlemede saydam yapılacak renge tıkla (Esc: vazgeç)': 'Click the color to make transparent in the preview (Esc: cancel)', 'Seçilen renk': 'Selected color',
  'Bu değere keyframe ekle / kaldır': 'Add / remove keyframe for this value', 'Ekrandan renk al': 'Pick color from screen', 'Önceki renk': 'Previous color',
  'Hız rampası sesi hazırlanıyor…': 'Preparing speed ramp audio…', 'Hıza keyframe ekle / kaldır (hız rampası)': 'Add / remove speed keyframe (speed ramp)',
  // ---- Kapak tasarımcısı ----
  'Shorts kapağı': 'Shorts cover', 'YouTube kapağı': 'YouTube cover', 'Kalın kontur': 'Thick outline', 'Sarı gölgeli': 'Yellow shadow', 'Kırmızı kutu': 'Red box', 'Ateş gradyanı': 'Fire gradient',
  'Beyaz kutu': 'White box', 'Altyazı sade': 'Simple caption', 'Kapak kaydedildi ✓': 'Cover saved ✓', 'Videodan kare': 'Frame from video', 'Görsel (dosyadan)': 'Image (from file)',
  'Dolaptaki görseller': 'Images in library', 'Seçili görselin arka planını kaldır': 'Remove background of selected image', 'YAZINI GİR': 'ENTER TEXT', 'Görsel açılamadı': 'Could not open image',
  'Dolapta video yok. Önce bir video ekle.': 'No videos in the library. Add a video first.', 'Önceki kare': 'Previous frame', 'Sonraki kare': 'Next frame', 'Zaman': 'Time', 'Videodan kare seç': 'Pick a frame from video',
  'Bu kareyi kullan': 'Use this frame', 'Kare alınıyor…': 'Grabbing frame…', 'Arka planı kaldır': 'Remove background', 'Önce bir görsel seç (videodan aldığın kare de olur).': 'Select an image first (a frame from a video works too).',
  'Model hazırlanıyor…': 'Preparing model…', 'Arka plan kaldırılıyor… (ilk seferde biraz sürer)': 'Removing background… (takes a while the first time)', 'Arka plan kaldırıldı (Ctrl+Z ile geri alınır)': 'Background removed (Ctrl+Z to undo)',
  'Arka plan kaldırılamadı': 'Could not remove background', 'Kapaktan çık': 'Leave cover', 'Kapak adı': 'Cover name', 'Seçili görselin arka planını kaldırır': 'Removes the background of the selected image',
  'Görsel / Şekil / Çıkartma': 'Image / Shape / Sticker', 'Kapak': 'Cover', 'Bu projenin kapağını tasarla': 'Design a cover for this project', 'Kapak tasarla': 'Design cover', 'Bu projenin hangi kapağı?': 'Which cover for this project?',
  'Kapaklar': 'Covers', 'Henüz kapak yok.': 'No covers yet.', 'Kapak silinsin mi?': 'Delete cover?', 'Kapak stilleri': 'Cover styles', 'En': 'Width', 'Boy': 'Height',
  'Önizlemede kenar tutamaçlarını sürükleyerek de genişletebilirsin.': 'You can also stretch it by dragging the edge handles in the preview.', 'Bu proje': 'This project', 'bu proje': 'this project', '(bu proje)': '(this project)',
  'Projeden kare': 'Frame from project', 'Kayıtlı proje yok.': 'No saved projects.', 'Metin ve altyazıları gizle': 'Hide text and captions',
  'Kare kapağa sığdırılır, boşluklar karenin bulanık hâliyle dolar.': 'The frame is fit to the cover; empty space is filled with a blurred copy.', 'Düzenlenmiş videodan kare seç': 'Pick a frame from the edited video',
  'Kare hazırlanıyor…': 'Preparing frame…', 'Düzenlenmiş videonun (metin, efekt dahil) bir karesini al': 'Grab a frame of the edited video (with text and effects)', 'Projeden kare (düzenlenmiş video)': 'Frame from project (edited video)',
  '1 kare': '1 frame', 'Geri': 'Back', 'JPG olarak kaydet': 'Save as JPG', '(kesik)': '(cutout)', 'Shorts (1080×1920)': 'Shorts (1080×1920)', 'YouTube (1280×720)': 'YouTube (1280×720)',
  // ---- G taşıma / C kırpma / görünüm ----
  'G: önce önizlemede bir öğe seç': 'G: select an item in the preview first', 'Taşı (Blender gibi) · X/Y eksen, Shift hassas, Esc iptal': 'Grab (like Blender) · X/Y axis, Shift fine, Esc cancel',
  'Serbest': 'Free', 'Orijinal': 'Original', 'C: önce bir video ya da görsel seç': 'C: select a video or image first', 'Kırp: kenar/köşeleri sürükle · Enter/C: uygula · Esc: iptal': 'Crop: drag edges/corners · Enter/C: apply · Esc: cancel',
  'Kırpma kaldırıldı': 'Crop removed', 'Kırpıldı (Ctrl+Z ile geri alınır)': 'Cropped (Ctrl+Z to undo)', 'Uygula': 'Apply', 'Kırp (video/görsel) · Enter uygula, Esc iptal': 'Crop (video/image) · Enter apply, Esc cancel',
  'Video dışını gizle (H)': 'Hide everything but the video (H)', 'Video dışını gizle / göster (göz)': 'Hide / show everything but the video', 'Tam ekran (çık: Esc / çift tık)': 'Fullscreen (exit: Esc / double-click)', 'Tam ekran (F)': 'Fullscreen (F)',
  // ---- Ses efektleri ----
  'Geçiş': 'Transition', 'Yükselen / Düşen': 'Risers / Fallers', 'Vuruş / Patlama': 'Hits / Impacts', 'Arayüz': 'UI', 'Zil / Nota': 'Bells / Notes', 'Logo': 'Logo', 'Klavye / Yazma': 'Keyboard / Typing',
  'Nesne / Doğa': 'Objects / Nature', 'Klasik': 'Classic', 'Ara… (ör. vınn, tık, zil, vuruş)': 'Search… (e.g. whoosh, click, bell, hit)', 'Ses efektleri': 'Sound effects',
  'Satıra tıkla: dinle · Çift tık veya + Ekle: playhead\'e ekle': 'Click a row: listen · Double-click or + Add: add at playhead', 'Tümü': 'All', 'Yükleniyor…': 'Loading…', 'Ses efekti…': 'Sound effect…',
  'Uzunluk': 'Length', 'Hız keyframe\'i varken ton ayarı kapalı.': 'Pitch is disabled while the clip has speed keyframes.', 'Ton: perde (yarım ton). Uzunluk: sesi perdesini bozmadan uzatır/kısaltır.': 'Pitch: in semitones. Length: stretches/shortens audio without changing pitch.',
  'Ton ve uzunluk': 'Pitch & length', 'Kapat (Esc)': 'Close (Esc)',
  'Vınn (geçiş)': 'Whoosh (transition)', 'Pop': 'Pop', 'Tık': 'Click', 'Ding': 'Ding', 'Bum (vuruş)': 'Boom (hit)', 'Bum (patlama)': 'Boom (explosion)', 'Yükselen': 'Riser', 'Yükselen (riser)': 'Riser',
  'Düşüş (çizgi film)': 'Fall (cartoon)', 'Bip (sansür)': 'Beep (censor)', 'Hata (buzzer)': 'Error (buzzer)', 'Para (coin)': 'Coin', 'Başarı (ta-da)': 'Success (ta-da)', 'Kalp atışı': 'Heartbeat',
  'Bildirim': 'Notification', 'Kamera (deklanşör)': 'Camera (shutter)',
  // ---- Ana süreçten gelenler ----
  'Medya': 'Media', 'İndirme hatası': 'Download error', 'Model doğrulanamadı (bozuk indirme)': 'Model could not be verified (corrupt download)', 'Model açılıyor…': 'Unpacking model…',
  'Model dosyaları eksik': 'Model files are missing', 'Seste konuşma yok': 'No speech in audio', 'Model hazır': 'Model ready', 'Model indiriliyor…': 'Downloading model…', 'Model indirilemedi': 'Model could not be downloaded',
  'Hata': 'Error',
  // ---- Ana ekran ----
  'Sürüm': 'Version', 'Sürüm 3.8': 'Version 3.8', 'Yeni proje': 'New project'
};
// Değişken içeren yazılar: {} = herhangi bir parça (sırasıyla aktarılır)
const I18N_PAT = [
  ['“{}” kalıcı olarak silinecek.', '“{}” will be permanently deleted.'], ['“{}” silinecek.', '“{}” will be deleted.'],
  ['Proje {} haline döndü (mevcut hali de yedeklendi)', 'Project restored to {} (the current version was backed up too)'],
  ['Dışa aktarılıyor… {}/{} kare', 'Exporting… {}/{} frames'], ['“{}” projesi', 'Project “{}”'], ['“{}” yedekleri', 'Backups of “{}”'], ['{} klip', '{} clips'],
  ['{} klip kopyalandı', '{} clips copied'], ['{} altyazı eklendi', '{} captions added'], ['{} öğe dolaptan silindi', '{} items removed from library'], ['{} öğe', '{} items'],
  ['{} · donmuş {}', '{} · frozen {}'], ['Döndürme: {}° (Shift: 15° adım)', 'Rotation: {}° (Shift: 15° steps)'],
  ['{} – {} ({} sn) · tıkla: {}', '{} – {} ({} s) · click: {}'], ['{} boşluk · video {} sn kısalacak', '{} pauses · video will be {} s shorter'],
  ['{} boşluk kesildi · video {} sn kısaldı (Ctrl+Z ile geri alınır)', '{} pauses cut · video is {} s shorter (Ctrl+Z to undo)'],
  ['{} dosya projeye eklendi (dolaba girmedi)', '{} files added to project (not to library)'], ['{} dosya ekleniyor', 'Adding {} files'],
  ['Taşı ({} ekseni) X {}  Y {} · X/Y: eksen · Shift: hassas · tık/Enter: onayla · Esc/sağ tık: iptal', 'Grab ({} axis) X {}  Y {} · X/Y: axis · Shift: fine · click/Enter: confirm · Esc/right-click: cancel'],
  ['Taşı {}X {}  Y {} · X/Y: eksen · Shift: hassas · tık/Enter: onayla · Esc/sağ tık: iptal', 'Grab {}X {}  Y {} · X/Y: axis · Shift: fine · click/Enter: confirm · Esc/right-click: cancel'],
  ['Kırp: {} × {} · Enter: uygula · Esc: iptal', 'Crop: {} × {} · Enter: apply · Esc: cancel'], ['En {}% · Boy {}%', 'Width {}% · Height {}%'], ['Tam ({}×{})', 'Full ({}×{})'],
  ['Model indiriliyor… {} MB', 'Downloading model… {} MB'], ['Arka plan modeli indiriliyor… ({}', 'Downloading background model… ({}'], ['Model indirilemedi ({}', 'Model could not be downloaded ({}'],
  ['Hata (kod {}', 'Error (code {}'], ['{} ses', '{} sounds'], ['{} sn', '{} s'], ['{} ({} sn)', '{} ({} s)'], ['Proje {}', 'Project {}'], ['Keyframe: {}', 'Keyframe: {}'],
  ['YouTube · {}', 'YouTube · {}'], ['Shorts · {}', 'Shorts · {}'], ['Sürüm {}', 'Version {}'], ['Kaydedildi: {}', 'Saved: {}'], ['Bitti: {}', 'Done: {}']
];

const I18N = (() => {
  if (LANG === 'tr') return { tx: s => s };
  const dict = new Map(), norm = s => s.replace(/\s+/g, ' ').trim();
  for (const k in I18N_EN) dict.set(norm(k), I18N_EN[k]);
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pats = I18N_PAT.map(([k, v]) => [new RegExp('^' + esc(norm(k)).replace(/\\\{\\\}/g, '(.+?)') + '$'), v]);
  const cache = new Map();
  const PRE = /^[^\p{L}\p{N}“"(«']+/u, POST = /[\s:▾▶✓…]+$/u;
  const byDict = s => dict.has(s) ? dict.get(s) : null;
  function byPat(s) { for (const [re, v] of pats) { const m = s.match(re); if (m) { let i = 1; return v.replace(/\{\}/g, () => m[i++]); } } return null; }
  function one(s) { // önce sözlük, sonra kalıplar; kenardaki simgeleri ayırarak da dene
    const pre = (s.match(PRE) || [''])[0], rest = s.slice(pre.length);
    const post = (rest.match(POST) || [''])[0], core = rest.slice(0, rest.length - post.length);
    for (const f of [byDict, byPat]) {
      let r = f(s); if (r != null) return r;
      if (pre) { r = f(rest); if (r != null) return pre + r; }
      if (post && core) { r = f(core); if (r != null) return pre + r + post; }
    }
    return null;
  }
  const SEPS = [/( · | — | – |\n)/, /(: )/];
  function seg(s, lv = 0) { // önce ' · ' / ' — ' / satır sonu, olmazsa ': ' ile bölünmüş parçalar
    if (lv >= SEPS.length) return null;
    const parts = s.split(SEPS[lv]); if (parts.length < 2) return seg(s, lv + 1);
    let hit = false; const out = parts.map((p, i) => { if (i % 2 || !/\p{L}/u.test(p)) return p; const t = p.trim(); let r = one(t); if (r == null) r = seg(t, lv + 1); if (r == null) return p; hit = true; return p.replace(t, r); });
    return hit ? out.join('') : null;
  }
  function tx(s) {
    if (s == null) return s; s = String(s);
    if (!/\p{L}/u.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = norm(s);
    let r = one(core); if (r == null) r = seg(core);
    const out = r == null ? s : lead + r + trail;
    if (cache.size > 5000) cache.clear(); cache.set(s, out); return out;
  }
  // ---- Ekrandaki yazıları çevir ----
  const ATTRS = ['title', 'placeholder', 'data-tip', 'data-tip2', 'aria-label'];
  const SKIP = el => !el || el.closest('script,style,textarea,[contenteditable="true"],[data-noi18n]');
  // Kullanıcının verdiği adlar (proje, dosya, klip, katman) çevrilmez
  const USER = '.pn,#libList .n,.lyn,.clip,.gc,.vfi span,.sfxN';
  function trText(n) { const p = n.parentElement; if (!p || SKIP(p) || p.closest(USER)) return; const v = n.nodeValue, t = tx(v); if (t !== v) n.nodeValue = t; }
  function trAttr(el, a) { const v = el.getAttribute(a); if (v == null) return; const t = tx(v); if (t !== v) el.setAttribute(a, t); }
  function trEl(el) {
    if (el.nodeType === 3) return trText(el);
    if (el.nodeType !== 1 || SKIP(el)) return;
    for (const a of ATTRS) if (el.hasAttribute(a)) trAttr(el, a);
    if (el.tagName === 'INPUT' && el.type === 'button' && el.value) el.value = tx(el.value);
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) trText(n); else if (!SKIP(n)) for (const a of ATTRS) if (n.hasAttribute(a)) trAttr(n, a); }
  }
  const mo = new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'childList') m.addedNodes.forEach(trEl);
      else if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes' && !SKIP(m.target)) trAttr(m.target, m.attributeName);
    }
  });
  const start = () => { trEl(document.body); mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  return { tx };
})();
// Kodda doğrudan kullanılan çeviri: T('Türkçe') → dile göre yazı
function T(s) { return I18N.tx(s); }
function setLang(l) {
  if (l === LANG) return;
  try { localStorage.setItem('lang', l); } catch { }
  try { window.api && window.api.setLang && window.api.setLang(l); } catch { }
  location.reload();
}
document.title = LANG === 'tr' ? 'Editör 3.8' : 'Editor 3.8';
try { window.api && window.api.setLang && window.api.setLang(LANG); } catch { } // ana süreç (dosya diyalogları) aynı dili kullansın
