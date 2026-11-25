// ===================== Ek özellikler (8): Kapak tasarımı (Shorts 1080×1920, YouTube 1280×720) =====================
// Editörün kendi motorunu kullanır: zaman çizelgesi yok, sadece katmanlar. Kapaklar projeye bağlı ya da ayrı dosya olarak saklanır.
let coverCtx = null, cvTextOnly = false; // { doc, owner: 'proj' | 'file', stash }
const COVER_KIND = { shorts: { fmt: '9:16', out: [1080, 1920], label: 'Shorts kapağı' }, yt: { fmt: '16:9', out: [1280, 720], label: 'YouTube kapağı' } };
const COVER_TEXT = [
  ['Kalın kontur', { font: 'Impact', size: 170, color: '#ffffff', stroke: '#000000', strokeW: 14, upper: true, bold: true }],
  ['Sarı gölgeli', { font: 'Impact', size: 170, color: '#ffe600', stroke: '#000000', strokeW: 10, upper: true, shadow: true, shColor: '#000000', shBlur: 0, shX: 12, shY: 12 }],
  ['Kırmızı kutu', { font: 'Arial Black', size: 120, color: '#ffffff', strokeW: 0, upper: true, bg: true, bgColor: '#e01b24', bgOp: 1, bgPad: 28, bgRad: 14 }],
  ['Neon', { font: 'Segoe UI', size: 140, color: '#ffffff', strokeW: 0, glow: true, glowColor: '#00e5ff', glowBlur: 50 }],
  ['Ateş gradyanı', { font: 'Impact', size: 170, grad: true, color: '#ffd200', color2: '#ff3d00', stroke: '#000000', strokeW: 10, upper: true }],
  ['Beyaz kutu', { font: 'Segoe UI', size: 110, color: '#111111', strokeW: 0, bold: true, bg: true, bgColor: '#ffffff', bgOp: 1, bgPad: 24, bgRad: 18 }],
  ['Altyazı sade', { font: 'Segoe UI', size: 90, color: '#ffffff', stroke: '#000000', strokeW: 5, bold: true }]
];
function newCoverProj(kind) { const p = newProject(); const [w, h] = FORMATS[COVER_KIND[kind].fmt]; p.fmt = { w, h, fps: 30 }; return p; }
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- Giriş / çıkış ----------
function enterCover(doc, owner) {
  if (coverCtx) return;
  if (playing) pause(); closeAddMenu?.();
  coverCtx = { doc, owner, stash: { proj, curId, curName, time, sel, undo: undoS.splice(0), redo: redoS.splice(0), dirty, layersWas: layersOn, home: !inEditor() } };
  proj = clone(doc.proj); sel = null; time = 0; dirty = false; mediaReset();
  document.body.classList.add('covermode'); $('#cvName').value = doc.name || '';
  $('#cvKind').textContent = COVER_KIND[doc.kind].label + (owner === 'proj' ? ' · bu proje' : '');
  enterEditor(); applyFormat(); toggleLayers(true); refreshAll(); renderLib(); fitCanvas(); draw();
}
async function saveCover(quiet) {
  if (!coverCtx) return; const { doc, owner, stash } = coverCtx;
  doc.proj = clone(proj); doc.name = $('#cvName').value.trim() || doc.name || COVER_KIND[doc.kind].label; doc.thumb = makeThumb(); doc.updated = Date.now();
  if (owner === 'proj') { stash.proj.covers = stash.proj.covers || {}; stash.proj.covers[doc.kind] = { proj: doc.proj, thumb: doc.thumb, name: doc.name, updated: doc.updated }; stash.dirty = true; }
  else await window.api.coverSave(doc);
  dirty = false; if (!quiet) { status('Kapak kaydedildi ✓'); setTimeout(() => status(''), 1500); }
}
async function exitCover() {
  if (!coverCtx) return; await saveCover(true);
  const { stash, owner } = coverCtx; coverCtx = null;
  mediaReset(); document.body.classList.remove('covermode');
  proj = stash.proj; curId = stash.curId; curName = stash.curName; time = stash.time; sel = stash.sel; dirty = stash.dirty;
  undoS.length = 0; undoS.push(...stash.undo); redoS.length = 0; redoS.push(...stash.redo);
  applyFormat(); toggleLayers(stash.layersWas); refreshAll(); renderLib();
  if (owner === 'file' || stash.home) showHome(); else { enterEditor(); setTime(time); }
}
function openProjCover(kind) {
  const c = proj.covers && proj.covers[kind];
  enterCover({ id: 'p-' + kind, kind, name: (c && c.name) || COVER_KIND[kind].label, proj: c ? clone(c.proj) : newCoverProj(kind) }, 'proj');
}
async function newFileCover(kind) {
  const l = await window.api.coverList(); let n = l.filter(x => x.kind === kind).length + 1;
  enterCover({ id: uid(), kind, name: `${COVER_KIND[kind].label} ${n}`, proj: newCoverProj(kind) }, 'file');
}
async function openFileCover(id) { const d = await window.api.coverLoad(id); if (d) enterCover(d, 'file'); }

// Kapak modunda her öğe tek karede durur
{ const _ct = cleanTracksSoft; cleanTracksSoft = function () { if (coverCtx) { time = 0; for (const c of allClips()) { c.start = 0; c.dur = 10; } } return _ct.apply(this, arguments); }; }
{ const _rl = renderLib; renderLib = function () { if (!coverCtx) return _rl.apply(this, arguments); const all = library; library = all.filter(m => m.kind === 'image'); try { return _rl.apply(this, arguments); } finally { library = all; } }; }
{ const _sp = saveProject; saveProject = async function () { if (coverCtx) return saveCover(); return _sp.apply(this, arguments); }; }
{ const _as = askSave; askSave = async function () { if (coverCtx) { await exitCover(); if (!dirty) return true; } return _as.apply(this, arguments); }; }
setInterval(() => { if (coverCtx && dirty) saveCover(true); }, 10000);
{ const _mi = menuItems; menuItems = function () {
  if (!coverCtx) return _mi.apply(this, arguments);
  if (cvTextOnly) return [{ icon: '𝐓', label: 'Düz metin', act: () => addCoverText(-1) }, { sep: 1 }, ...COVER_TEXT.map(([n], i) => ({ icon: '𝐓', label: n, act: () => addCoverText(i) }))];
  const ex = extraMenuItems().filter(x => /Şekil|Çıkartma|Netlik/.test(x.label || ''));
  return [
    { icon: '𝐓', label: 'Metin', sub: [{ icon: '𝐓', label: 'Düz metin', act: () => addCoverText(-1) }, { sep: 1 }, ...COVER_TEXT.map(([n], i) => ({ icon: '𝐓', label: n, act: () => addCoverText(i) }))] },
    { icon: '🎞', label: 'Videodan kare', act: pickVideoFrame },
    { icon: '▨', label: 'Görsel (dosyadan)', act: () => shiftA('image') },
    { icon: '⧉', label: 'Dolaptaki görseller', sub: library.filter(m => m.kind === 'image').slice(0, 40).map(m => ({ icon: '▨', label: m.alias || m.name, act: () => { commit(); addMediaClip(m, 0); refreshAll(); } })) },
    { sep: 1 }, ...ex,
    { sep: 1 }, { icon: '✂', label: 'Seçili görselin arka planını kaldır', act: removeBg }
  ];
}; }

// ---------- Araçlar ----------
function addCoverText(i) {
  commit(); const [n, pre] = i < 0 ? ['Metin', {}] : COVER_TEXT[i];
  const c = { id: uid(), type: 'text', name: n, start: 0, in: 0, dur: 10, p: Object.assign(baseP(), clone(TEXT_DEF), clone(pre), { text: T('YAZINI GİR') }), kf: {} };
  if (W > H) c.p.size = Math.round(c.p.size * 0.9);
  trackFor('visual', 0, 10).clips.push(c);
  if (proj.layers) proj.layers.unshift(c.id);
  sel = c.id; refreshAll();
}
async function addImageFile(path, name, opts = {}) {
  const m = { id: uid(), path, name, kind: 'image' };
  if (!(await probeEl(m))) { status('Görsel açılamadı'); return null; }
  commit(); const c = addMediaClip(m, 0); Object.assign(c.p, opts.p || {});
  const ids = visualOrder().map(x => x.id).filter(x => x !== c.id);
  if (opts.bottom) ids.push(c.id); else ids.unshift(c.id);
  proj.layers = ids; refreshAll(); return c;
}
async function pickVideoFrame() {
  const vids = library.filter(m => m.kind === 'video');
  if (!vids.length) return dialog({ title: 'Videodan kare', text: 'Dolapta video yok. Önce bir video ekle.', buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] });
  let cur = vids[0], t = Math.min(1, (cur.dur || 1) / 2), url = null, seq = 0;
  const html = `<div class="vfp"><div class="vfl">${vids.map((m, i) => `<div class="vfi${i ? '' : ' on'}" data-i="${i}">${m.thumb ? `<img src="${m.thumb}">` : '<div class="impic">▣</div>'}<span>${esc(m.alias || m.name)}</span></div>`).join('')}</div>
    <div class="vfr"><div class="vfimg"><img id="vfImg"></div><div class="row"><label>Zaman</label><input id="vfT" type="range" min="0" max="1" step="0.001" value="0"><span id="vfTv"></span></div>
    <div class="vfnav"><button id="vfPrev" title="Önceki kare">◀ 1 kare</button><button id="vfNext" title="Sonraki kare">1 kare ▶</button></div></div></div>`;
  const pr = dialog({ title: 'Videodan kare seç', html, wide: true, buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Bu kareyi kullan', v: 'ok', cls: 'primary' }] });
  const X = $('#dlg .dextra'), img = X.querySelector('#vfImg'), sl = X.querySelector('#vfT'), tv = X.querySelector('#vfTv');
  const show = async () => {
    const my = ++seq; sl.value = cur.dur ? t / cur.dur : 0; if (sl._rsv && typeof rsPaint === 'function') rsPaint(sl); tv.textContent = fmt(t);
    const f = await window.api.vidFrame({ key: 'coverpick', p: cur.path, t, fps: 30, h: 540, sp: 1 }); if (my !== seq || !f) return;
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(new Blob([f.jpg], { type: 'image/jpeg' })); img.src = url;
  };
  X.querySelectorAll('.vfi').forEach(el => el.onclick = () => { X.querySelectorAll('.vfi').forEach(x => x.classList.remove('on')); el.classList.add('on'); cur = vids[+el.dataset.i]; t = Math.min(t, cur.dur || 0); show(); });
  sl.addEventListener('input', () => { t = +sl.value * (cur.dur || 0); show(); });
  X.querySelector('#vfPrev').onclick = () => { t = Math.max(0, t - 1 / 30); show(); };
  X.querySelector('#vfNext').onclick = () => { t = Math.min(cur.dur || 0, t + 1 / 30); show(); };
  show();
  const r = await pr; window.api.vidClose('coverpick'); if (url) URL.revokeObjectURL(url);
  if (r.v !== 'ok') return;
  status('Kare alınıyor…'); const p = await window.api.vidStill({ p: cur.path, t: Math.round(t * 30) / 30 }); status('');
  if (!p) return status('Kare alınamadı');
  await addImageFile(p, `${cur.alias || cur.name} · ${fmt(t)}`, { bottom: true, p: { fit: 'cover' } });
}

// ---------- Arka plan kaldırma (Xenova/modnet, tamamen yerel) ----------
let bgWorker = null;
async function removeBg() {
  const c = sel && findClip(sel)?.clip; const m = c && mediaOf(c);
  if (!c || c.type !== 'image' || !m) return dialog({ title: 'Arka planı kaldır', text: 'Önce bir görsel seç (videodan aldığın kare de olur).', buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] });
  const modal = (txt, p) => { $('#modal').classList.remove('hidden'); $('#mText').textContent = txt; $('#mBar').style.width = Math.round((p || 0) * 100) + '%'; };
  const off = window.api.onBgProgress?.(d => modal(d.msg, d.p));
  try {
    modal('Model hazırlanıyor…', 0);
    await window.api.bgEnsure();
    modal('Arka plan kaldırılıyor… (ilk seferde biraz sürer)', 1);
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = mediaURL(m.path); });
    const cvs = document.createElement('canvas'); cvs.width = im.naturalWidth; cvs.height = im.naturalHeight; const x = cvs.getContext('2d'); x.drawImage(im, 0, 0);
    const id = x.getImageData(0, 0, cvs.width, cvs.height);
    if (!bgWorker) bgWorker = new Worker('bg-worker.js', { type: 'module' });
    const out = await new Promise((res, rej) => { bgWorker.onmessage = ev => ev.data.type === 'done' ? res(ev.data) : ev.data.type === 'error' ? rej(new Error(ev.data.msg)) : null; bgWorker.postMessage({ data: id.data.buffer, width: id.width, height: id.height }, [id.data.buffer]); });
    const o = document.createElement('canvas'); o.width = out.width; o.height = out.height; o.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
    const png = await new Promise(r => o.toBlob(r, 'image/png'));
    const path = await window.api.bgSavePng(new Uint8Array(await png.arrayBuffer()));
    const nm = { id: uid(), path, name: (m.alias || m.name) + ' (kesik)', kind: 'image' }; await probeEl(nm);
    commit(); proj.media[nm.id] = { id: nm.id, path: nm.path, name: nm.name, kind: 'image', dur: nm.dur, hasAudio: false };
    c.mediaId = nm.id; c.name = nm.name; refreshAll(); status('Arka plan kaldırıldı (Ctrl+Z ile geri alınır)'); setTimeout(() => status(''), 3000);
  } catch (e) {
    dialog({ title: 'Arka plan kaldırılamadı', text: String(e.message || e), buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] });
  } finally { $('#modal').classList.add('hidden'); off && off(); }
}

// ---------- JPG kaydet ----------
async function exportCoverJpg() {
  if (!coverCtx) return; const [ow, oh] = COVER_KIND[coverCtx.doc.kind].out;
  const o = document.createElement('canvas'); o.width = ow; o.height = oh; const x = o.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, ow, oh);
  const sl = sel; sel = null; renderAt(0, x, false, ow / W); sel = sl;
  let q = 0.92, b; do { b = await new Promise(r => o.toBlob(r, 'image/jpeg', q)); q -= 0.07; } while (b.size > 1.95 * 1048576 && q > 0.4);
  const name = ($('#cvName').value.trim() || COVER_KIND[coverCtx.doc.kind].label).replace(/[\\/:*?"<>|]/g, '_') + '.jpg';
  const p = await window.api.coverSaveJpg({ name, data: new Uint8Array(await b.arrayBuffer()) });
  if (p) { status('Kaydedildi: ' + p); setTimeout(() => status(''), 4000); }
}

// ---------- Arayüz ----------
(() => {
  const bar = document.createElement('div'); bar.id = 'coverBar';
  bar.innerHTML = `<button id="cvBack" title="Kapaktan çık">← Geri</button><span id="cvKind"></span><input id="cvName" spellcheck="false" placeholder="Kapak adı">
    <span class="sep"></span><button id="cvFrame">🎞 Videodan kare</button><button id="cvText">𝐓 Metin ▾</button><button id="cvAdd">＋ Görsel / Şekil / Çıkartma</button><button id="cvBg" title="Seçili görselin arka planını kaldırır">✂ Arka planı kaldır</button>
    <span class="grow"></span><button id="cvSave">💾 Kaydet</button><button id="cvJpg" class="primary">⬇ JPG olarak kaydet</button>`;
  $('#top').appendChild(bar);
  const cb = document.createElement('button'); cb.id = 'bCover'; cb.textContent = '🖼 Kapak'; cb.title = 'Bu projenin kapağını tasarla'; $('#bExport').before(cb);
  cb.onclick = async () => { const r = await dialog({ title: 'Kapak tasarla', text: 'Bu projenin hangi kapağı?', buttons: [{ label: 'İptal', v: 'x', cls: 'ghost' }, { label: '▯ Shorts (1080×1920)', v: 'shorts' }, { label: '▭ YouTube (1280×720)', v: 'yt', cls: 'primary' }] }); if (r.v === 'shorts' || r.v === 'yt') openProjCover(r.v); };
  $('#cvBack').onclick = exitCover; $('#cvSave').onclick = () => saveCover(); $('#cvJpg').onclick = exportCoverJpg; $('#cvFrame').onclick = pickVideoFrame; $('#cvBg').onclick = removeBg;
  $('#cvName').onchange = () => { dirty = true; };
  $('#cvAdd').onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); openAddMenu(r.left + 40, r.bottom + 18); };
  $('#cvText').onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); cvTextOnly = true; try { openAddMenu(r.left + 40, r.bottom + 18); } finally { cvTextOnly = false; } };
})();
// Açılış ekranında "Kapaklar" bölümü
{ const _sh = showHome; showHome = async function () {
  const r = await _sh.apply(this, arguments);
  let G = $('#coverGrid');
  if (!G) { const h = document.createElement('div'); h.className = 'hsub cvh'; h.innerHTML = 'Kapaklar <button id="hNewShorts">+ Shorts kapağı</button><button id="hNewYt">+ YouTube kapağı</button>'; $('#projGrid').after(h); G = document.createElement('div'); G.id = 'coverGrid'; h.after(G); $('#hNewShorts').onclick = () => newFileCover('shorts'); $('#hNewYt').onclick = () => newFileCover('yt'); }
  const list = await window.api.coverList(); G.innerHTML = list.length ? '' : '<div class="hempty">Henüz kapak yok.</div>';
  for (const p of list) {
    const d = document.createElement('div'); d.className = 'pc cvc ' + p.kind;
    d.innerHTML = `<div class="pt">${p.thumb ? `<img src="${p.thumb}">` : ''}</div><div class="pn"></div><div class="pd"></div><button class="px" title="Sil">×</button>`;
    d.querySelector('.pn').textContent = p.name; d.querySelector('.pd').textContent = (p.kind === 'yt' ? 'YouTube · ' : 'Shorts · ') + new Date(p.updated).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    d.onclick = () => openFileCover(p.id);
    d.querySelector('.px').onclick = async e => { e.stopPropagation(); const q = await dialog({ title: 'Kapak silinsin mi?', text: `“${p.name}” silinecek.`, buttons: [{ label: 'İptal', v: 'c', cls: 'ghost' }, { label: 'Sil', v: 'd', cls: 'primary' }] }); if (q.v === 'd') { await window.api.coverDelete(p.id); showHome(); } };
    G.appendChild(d);
  }
  return r;
}; }
if (!inEditor()) showHome();

// ---- Kapak metin stilleri Özellikler'deki "Hazır stil" listesinde de; görsel en/boy alanları ----
const TEXT_KEEP = new Set(['text', 'x', 'y', 'scale', 'rotation', 'opacity']);
COVER_TEXT.forEach(([n, pre], i) => { const full = {}; for (const [k, v] of Object.entries(TEXT_DEF)) if (!TEXT_KEEP.has(k)) full[k] = clone(v); TEXT_PRESETS['cv' + i] = Object.assign(full, clone(pre)); });
{ const _r = refreshInsp; refreshInsp = function () {
  const r = _r.apply(this, arguments); const s = $('#i_preset');
  if (s && !s.querySelector('optgroup')) { const g = document.createElement('optgroup'); g.label = 'Kapak stilleri'; g.innerHTML = COVER_TEXT.map(([n], i) => `<option value="cv${i}">${esc(n)}</option>`).join(''); s.appendChild(g); }
  return r;
}; }
Object.assign(ANY_DEF, { msx: 1, msy: 1 });
{ const _v = visualMediaInspHTML; visualMediaInspHTML = function (c) {
  const h = _v(c); if (c.type !== 'image') return h;
  return `<div class="grp"><h4>Boyut</h4>${fieldHTML(c, ['msx', 'En', 'range', [0.1, 3]])}${fieldHTML(c, ['msy', 'Boy', 'range', [0.1, 3]])}<div class="hint2">Önizlemede kenar tutamaçlarını sürükleyerek de genişletebilirsin.</div></div>` + h;
}; }

// ---------- Düzenlenmiş videodan (projeden) kare ----------
// Projenin o anki birleşik görüntüsü (metin, altyazı, efekt dahil) tek kare olarak alınır; üstüne kendi öğelerini eklersin.
const projDur = p => Math.max(0, ...p.tracks.flatMap(t => t.clips.map(c => c.start + c.dur)));
async function captureProjFrame(pd, t, hideText, outH) {
  const keep = { proj, W, H, FPS, EPS };
  const P = clone(pd); if (hideText) for (const c of P.tracks.flatMap(x => x.clips)) if (c.type === 'text') c.hidden = true;
  const swap = () => { proj = P; W = P.fmt.w; H = P.fmt.h; FPS = P.fmt.fps || 30; EPS = 0.5 / FPS; }, back = () => { proj = keep.proj; W = keep.W; H = keep.H; FPS = keep.FPS; EPS = keep.EPS; };
  const ow = Math.round(P.fmt.w * outH / P.fmt.h), o = document.createElement('canvas'); o.width = ow; o.height = outH; const x = o.getContext('2d');
  let waits = [];
  swap();
  try {
    expT = t; expH = outH;
    for (const c of allClips()) {
      if (!active(c, t) || c.hidden) continue;
      if (c.type === 'video') { const idx = vfIdx(c, srcT(c, t - c.start)); waits.push(vfRequest(c, idx, true, outH).then(b => { const s = vfState(vfKey(c, true)); if (b) { s.last = b; s.lastIdx = idx; } })); }
      if (c.type === 'image') { const im = elFor(c); if (im && !im.complete) waits.push(new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })); }
    }
  } finally { back(); }
  await Promise.all(waits);
  swap(); const ex = exporting; exporting = true;
  try { expT = t; x.fillStyle = '#000'; x.fillRect(0, 0, ow, outH); renderAt(t, x, false, ow / W); }
  finally { exporting = ex; back(); }
  return o;
}
async function pickProjectFrame() {
  const srcs = [];
  if (coverCtx && coverCtx.owner === 'proj') srcs.push({ id: '__cur', name: (coverCtx.stash.curName || 'Bu proje') + ' (bu proje)', get: async () => coverCtx.stash.proj });
  for (const p of await window.api.projList()) if (!(coverCtx && coverCtx.owner === 'proj' && p.id === coverCtx.stash.curId)) srcs.push({ id: p.id, name: p.name, thumb: p.thumb, get: async () => (await window.api.projLoad(p.id))?.proj });
  if (!srcs.length) return dialog({ title: 'Projeden kare', text: 'Kayıtlı proje yok.', buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] });
  let cur = null, pd = null, t = 0, D = 0, hide = false, seq = 0, url = null;
  const html = `<div class="vfp"><div class="vfl">${srcs.map((s, i) => `<div class="vfi" data-i="${i}">${s.thumb ? `<img src="${s.thumb}">` : '<div class="impic">▣</div>'}<span>${esc(s.name)}</span></div>`).join('')}</div>
    <div class="vfr"><div class="vfimg"><img id="pfImg"></div>
    <div class="row"><label>Zaman</label><input id="pfT" type="range" min="0" max="1" step="0.0005" value="0"><span id="pfTv"></span></div>
    <div class="vfnav"><button id="pfPrev">◀ 1 kare</button><button id="pfNext">1 kare ▶</button><label class="pfchk"><input type="checkbox" id="pfHide" style="width:auto"> Metin ve altyazıları gizle</label></div>
    <div class="hint2">Kare kapağa sığdırılır, boşluklar karenin bulanık hâliyle dolar.</div></div></div>`;
  const pr = dialog({ title: 'Düzenlenmiş videodan kare seç', html, wide: true, buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Bu kareyi kullan', v: 'ok', cls: 'primary' }] });
  const X = $('#dlg .dextra'), img = X.querySelector('#pfImg'), sl = X.querySelector('#pfT'), tv = X.querySelector('#pfTv');
  const show = async () => {
    if (!pd) return; const my = ++seq; sl.value = D ? t / D : 0; if (sl._rsv && typeof rsPaint === 'function') rsPaint(sl); tv.textContent = fmt(t);
    const c = await captureProjFrame(pd, t, hide, 480); if (my !== seq) return;
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)); if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(b); img.src = url;
  };
  const choose = async i => { X.querySelectorAll('.vfi').forEach((x, j) => x.classList.toggle('on', j === i)); cur = srcs[i]; pd = await cur.get(); if (!pd) return; D = projDur(pd); t = Math.min(t, D); show(); };
  X.querySelectorAll('.vfi').forEach(el => el.onclick = () => choose(+el.dataset.i));
  sl.addEventListener('input', () => { t = +sl.value * D; show(); });
  const step = () => 1 / ((pd && pd.fmt.fps) || 30);
  X.querySelector('#pfPrev').onclick = () => { t = Math.max(0, t - step()); show(); };
  X.querySelector('#pfNext').onclick = () => { t = Math.min(D, t + step()); show(); };
  X.querySelector('#pfHide').onchange = e => { hide = e.target.checked; show(); };
  choose(0);
  const r = await pr; if (url) URL.revokeObjectURL(url);
  if (r.v !== 'ok' || !pd) return;
  status('Kare hazırlanıyor…');
  const c = await captureProjFrame(pd, t, hide, pd.fmt.h);
  for (const k of [...vf.keys()]) if (k.endsWith(':x')) { vf.delete(k); window.api.vidClose(k); }
  const png = await new Promise(rs => c.toBlob(rs, 'image/png'));
  const path = await window.api.bgSavePng(new Uint8Array(await png.arrayBuffer())); status('');
  await addImageFile(path, `${cur.name} · ${fmt(t)}`, { bottom: true, p: { fit: 'contain', bgBlur: true } });
}
(() => {
  const b = document.createElement('button'); b.id = 'cvProjFrame'; b.textContent = '🎬 Projeden kare'; b.title = 'Düzenlenmiş videonun (metin, efekt dahil) bir karesini al'; $('#cvFrame').after(b); b.onclick = pickProjectFrame;
})();
{ const _mi = menuItems; menuItems = function () { const a = _mi.apply(this, arguments); if (coverCtx && !cvTextOnly) { const i = a.findIndex(x => x.label === 'Videodan kare'); a.splice(i + 1, 0, { icon: '🎬', label: 'Projeden kare (düzenlenmiş video)', act: pickProjectFrame }); } return a; }; }
