'use strict';
const $ = s => document.querySelector(s);
let W = 1080, H = 1920, FPS = 30;
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mediaURL = p => (window.api.mediaBase || '/media?p=') + encodeURIComponent(p);
const fmt = t => { t = Math.max(0, t); const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); };

// ---------- State ----------
let library = [];            // {id,path,name,kind,dur,thumb,hasAudio}
let proj = newProject();
let dirty = false;
let _sel = null, keepMulti = false; const selSet = new Set(); // _sel = birincil seçim, selSet = tüm seçili klipler
Object.defineProperty(window, 'sel', { get: () => _sel, set: v => { _sel = v; if (!keepMulti) { selSet.clear(); if (v) selSet.add(v); } } });
let time = 0, playing = false, playT0 = 0, wall0 = 0;
let pps = 80;                // pixels per second
const undoS = [], redoS = [];

function newProject() {
  return { v: 1, fmt: { w: 1080, h: 1920, fps: 30 }, tracks: [{ id: uid(), kind: 'visual', clips: [] }, { id: uid(), kind: 'audio', clips: [] }], media: {} };
}
const allClips = () => proj.tracks.flatMap(t => t.clips);
const findClip = id => { for (const t of proj.tracks) { const c = t.clips.find(c => c.id === id); if (c) return { clip: c, track: t }; } return null; };
const mediaOf = c => library.find(m => m.id === c.mediaId) || proj.media[c.mediaId];
const duration = () => allClips().reduce((m, c) => Math.max(m, c.start + c.dur), 0);
const kindOf = c => c.type === 'audio' ? 'audio' : 'visual';

function commit() { undoS.push(JSON.stringify(proj)); if (undoS.length > 150) undoS.shift(); redoS.length = 0; dirty = true; }
function undo() { if (!undoS.length) return; redoS.push(JSON.stringify(proj)); proj = JSON.parse(undoS.pop()); dirty = true; refreshAll(); }
function redo() { if (!redoS.length) return; undoS.push(JSON.stringify(proj)); proj = JSON.parse(redoS.pop()); dirty = true; refreshAll(); }

// ---------- Easing ----------
const PRESETS = { linear: [0, 0, 1, 1], ease: [.25, .1, .25, 1], easeIn: [.42, 0, 1, 1], easeOut: [0, 0, .58, 1], easeInOut: [.42, 0, .58, 1] };
const PRESET_TR = { linear: 'Düz (linear)', ease: 'Ease', easeIn: 'Ease In', easeOut: 'Ease Out', easeInOut: 'Ease In-Out', bezier: 'Özel Bezier', hold: 'Sabit (hold)' };
function bezier(b, x) {
  const [x1, y1, x2, y2] = b;
  const bx = t => ((1 - 3 * x2 + 3 * x1) * t + (3 * x2 - 6 * x1)) * t * t + 3 * x1 * t;
  const by = t => ((1 - 3 * y2 + 3 * y1) * t + (3 * y2 - 6 * y1)) * t * t + 3 * y1 * t;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 30; i++) { const v = bx(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
  return by(t);
}
function ease(e, x) { if (!e || e.n === 'linear') return x; if (e.n === 'hold') return 0; return bezier(e.b || PRESETS[e.n] || PRESETS.linear, x); }

// ---------- Props / keyframes ----------
const KF_PROPS = ['x', 'y', 'scale', 'rotation', 'opacity'];
function val(c, p, lt) {
  const a = c.kf && c.kf[p];
  if (!a || !a.length) return c.p[p];
  if (lt <= a[0].t) return a[0].v;
  const l = a[a.length - 1]; if (lt >= l.t) return l.v;
  for (let i = 0; i < a.length - 1; i++) {
    const k0 = a[i], k1 = a[i + 1];
    if (lt >= k0.t && lt <= k1.t) { const f = ease(k0.e, (lt - k0.t) / (k1.t - k0.t || 1)); return k0.v + (k1.v - k0.v) * f; }
  }
  return c.p[p];
}
let EPS = 0.5 / FPS;
function setKf(c, p, lt, v) {
  c.kf = c.kf || {}; const a = c.kf[p] = c.kf[p] || [];
  const k = a.find(k => Math.abs(k.t - lt) < EPS);
  if (k) k.v = v; else { a.push({ t: lt, v, e: { n: 'bezier', b: [0.42, 0, 0.58, 1] } }); a.sort((x, y) => x.t - y.t); }
}
function setProp(c, p, v) {
  const lt = time - c.start;
  if (c.kf && c.kf[p] && c.kf[p].length) setKf(c, p, clamp(lt, 0, c.dur), v); else c.p[p] = v;
}

// ---------- Medya (yeniden yazıldı) ----------
// Video kareleri ffmpeg'den gelir (window.api.vidFrame), ses Web Audio ile çalınır.
// Tarayıcının <video> oynatıcısı hiç kullanılmaz: atlama/duraklatma her zaman doğru kareyi verir.
const imgs = new Map(); // mediaId -> Image
const vf = new Map();   // anahtar -> { frames: Map(idx -> ImageBitmap), last, lastIdx, pend: Set, w, h }
const PREVIEW_H = 720;
function vfState(key) { let s = vf.get(key); if (!s) vf.set(key, s = { frames: new Map(), last: null, lastIdx: -1, pend: new Map(), w: 0, h: 0 }); return s; }
const vfSp = c => (c.kf && c.kf.speed && c.kf.speed.length) ? 1 : Math.max(0.05, spd(c)); // index adımı: speed/FPS kaynak saniyesi (oynatırken her ekran karesi = 1 index)
const vfKey = (c, exp) => c.id + (exp ? ':x' : '');
const vfIdx = (c, st) => Math.max(0, Math.round(st * FPS / vfSp(c)));
function vfRequest(c, idx, exp, h) {
  const m = mediaOf(c); if (!m) return Promise.resolve(null);
  const key = vfKey(c, exp), s = vfState(key);
  if (s.frames.has(idx)) return Promise.resolve(s.frames.get(idx));
  if (s.pend.has(idx)) return s.pend.get(idx);
  const sp = vfSp(c);
  const pr = window.api.vidFrame({ key, p: m.path, t: idx * sp / FPS, fps: FPS, h, sp }).then(async f => {
    if (!f) return null;
    const bmp = await createImageBitmap(new Blob([f.jpg], { type: 'image/jpeg' }));
    s.frames.set(idx, bmp); s.w = bmp.width; s.h = bmp.height;
    if (Math.abs(idx - vfWant(c, exp)) <= Math.abs(s.lastIdx - vfWant(c, exp)) || !s.last) { s.last = bmp; s.lastIdx = idx; }
    if (s.frames.size > 24) for (const k of [...s.frames.keys()].sort((a, b) => Math.abs(a - s.lastIdx) - Math.abs(b - s.lastIdx)).slice(24)) { if (s.frames.get(k) !== s.last) s.frames.get(k).close?.(); s.frames.delete(k); }
    return bmp;
  }).catch(() => null).finally(() => { s.pend.delete(idx); if (!exp && !exporting && !playing) draw(); });
  s.pend.set(idx, pr); return pr;
}
function vfWant(c, exp) { return vfIdx(c, srcT(c, (exp ? expT : time) - c.start)); }
// Önizlemede: elde en yakın kareyi hemen döndür, doğrusu yoksa iste (gelince yeniden çizilir)
function videoFrame(c, t, exp) {
  const key = vfKey(c, exp), s = vfState(key), idx = vfIdx(c, srcT(c, t - c.start));
  const have = s.frames.get(idx);
  if (have) { s.last = have; s.lastIdx = idx; }
  else if (!exp) {
    if (s.pend.size < 3) vfRequest(c, idx, false, PREVIEW_H);
    if (playing && !c.p.rev) for (let j = 1; j <= 3 && s.pend.size < 4; j++) if (!s.frames.has(idx + j) && !s.pend.has(idx + j)) vfRequest(c, idx + j, false, PREVIEW_H);
  }
  return s.last;
}
let expT = 0, expH = 1080;
function elFor(c) {
  if (c.type === 'image') {
    let im = imgs.get(c.mediaId); const m = mediaOf(c);
    if (!im && m) { im = new Image(); im.crossOrigin = 'anonymous'; im.src = mediaURL(m.path); im.onload = () => draw(); imgs.set(c.mediaId, im); }
    return im;
  }
  if (c.type === 'video') return videoFrame(c, exporting ? expT : time, exporting);
  return null;
}
function gcEls() {
  const ids = new Set(allClips().map(c => c.id));
  for (const [key, s] of vf) if (!ids.has(key.split(':')[0])) { for (const b of s.frames.values()) b.close?.(); vf.delete(key); window.api.vidClose(key); }
  for (const [id, a] of aud.nodes) if (!ids.has(id)) audStopOne(id);
  for (const c of allClips()) if (hasSound(c)) audBuf(mediaOf(c)); // sesleri önceden hazırla
}
function mediaReset() { audStop(); for (const s of vf.values()) for (const b of s.frames.values()) b.close?.(); vf.clear(); imgs.clear(); window.api.vidClose(null); }
const active = (c, t) => t >= c.start && t < c.start + c.dur;
const spd = c => c.p.speed || 1;
function srcT(c, lt) { const s = spd(c); return c.p.rev ? c.in + (c.dur - lt) * s : c.in + lt * s; }

// ---------- Ses (Web Audio) ----------
const aud = { ctx: null, bufs: new Map(), rev: new Map(), nodes: new Map(), t0: 0, ct0: 0 };
function actx() { if (!aud.ctx) aud.ctx = new AudioContext({ latencyHint: 'interactive' }); return aud.ctx; }
function audBuf(m) {
  if (aud.bufs.has(m.id)) return aud.bufs.get(m.id);
  const pr = window.api.audPcm(m.path).then(b => {
    if (!b) return null;
    const f = new Float32Array(b.buffer, b.byteOffset, Math.floor(b.byteLength / 8) * 2), n = f.length / 2;
    const ab = actx().createBuffer(2, Math.max(1, n), 44100), L = ab.getChannelData(0), R = ab.getChannelData(1);
    for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
    aud.bufs.set(m.id, ab); if (playing) audStart(); return ab;
  }).catch(() => null);
  aud.bufs.set(m.id, pr); return pr;
}
function audRev(m, ab) {
  let r = aud.rev.get(m.id); if (r) return r;
  r = actx().createBuffer(2, ab.length, ab.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const a = ab.getChannelData(ch), b = r.getChannelData(ch); for (let i = 0, n = a.length; i < n; i++) b[i] = a[n - 1 - i]; }
  aud.rev.set(m.id, r); return r;
}
const hasSound = c => (c.type === 'audio' || c.type === 'video') && mediaOf(c) && mediaOf(c).hasAudio !== false;
const clipGain = c => clamp((c.kf && c.kf.volume && c.kf.volume.length ? +val(c, 'volume', time - c.start) : (c.p.volume ?? 1)) * (c.p.duck ? duckFactor(time, c) : 1), 0, 3);
function audStopOne(id) { const n = aud.nodes.get(id); if (n) { try { n.src.stop(); } catch { } n.src.disconnect(); n.g.disconnect(); aud.nodes.delete(id); } }
function audStop() { for (const id of [...aud.nodes.keys()]) audStopOne(id); }
function audStart() { // çalan sesleri şimdiki zamandan yeniden kur
  audStop(); if (!playing) return; const A = actx(), now = A.currentTime, base = time;
  for (const c of allClips()) {
    if (!hasSound(c) || c.start + c.dur <= base) continue;
    const m = mediaOf(c), ab = audBuf(m); if (!(ab instanceof AudioBuffer)) continue;
    const s = spd(c), lt0 = Math.max(0, base - c.start), delay = Math.max(0, c.start - base);
    const st = srcT(c, lt0); const buf = c.p.rev ? audRev(m, ab) : ab;
    const off = c.p.rev ? ab.duration - st : st, len = (c.dur - lt0) * s;
    if (off >= buf.duration || len <= 0) continue;
    const src = A.createBufferSource(); src.buffer = buf; src.playbackRate.value = s;
    const g = A.createGain(); g.gain.value = clipGain(c); src.connect(g).connect(A.destination);
    src.start(now + delay + 0.03, Math.max(0, off), Math.min(len, buf.duration - off)); aud.nodes.set(c.id, { src, g, c });
  }
}
function audTick() { if (!aud.ctx) return; for (const [, n] of aud.nodes) n.g.gain.setTargetAtTime(clipGain(n.c), aud.ctx.currentTime, 0.03); }
function syncEls(play) { if (playing) audTick(); else draw(); } // eski adı korunuyor (başka yerlerden çağrılıyor)
function redrawOnFrame() { }

// ---------- Render ----------
const cv = $('#cv'), ctx = cv.getContext('2d');
function geomOf(c, t) {
  const lt = t - c.start;
  return { x: val(c, 'x', lt), y: val(c, 'y', lt), s: val(c, 'scale', lt), r: val(c, 'rotation', lt), o: val(c, 'opacity', lt) };
}
function srcSize(c, src) {
  if (c.type === 'video') return [src.width || 0, src.height || 0];
  if (c.type === 'image') return [src.naturalWidth, src.naturalHeight];
  return [0, 0];
}
const fitScale = (c, sw, sh) => c.p.fit === 'cover' ? Math.max(W / sw, H / sh) : Math.min(W / sw, H / sh);
function textLines(c) { return String(c.p.text || '').split('\n'); }
const TEXT_DEF = { text: 'Metin', font: 'Segoe UI', size: 110, bold: true, italic: false, upper: false, align: 'center', ls: 0, lh: 1.2,
  color: '#ffffff', grad: false, color2: '#ffcc33', stroke: '#000000', strokeW: 6,
  bg: false, bgColor: '#000000', bgOp: 0.6, bgPad: 30, bgRad: 20,
  glow: false, glowColor: '#00e5ff', glowBlur: 40, shadow: false, shColor: '#000000', shBlur: 12, shX: 8, shY: 8,
  tw: 0, fadeIn: 0, fadeOut: 0, boxW: 0, sx: 1 };
const ANY_DEF = { trIn: 'none', trInD: 0.5, trOut: 'none', trOutD: 0.5 };
const TP = c => Object.assign({}, TEXT_DEF, c.p);
const textFont = p => `${p.italic ? 'italic ' : ''}${p.bold ? 'bold ' : ''}${p.size}px "${p.font}"`;
function textLayout(c, g2) {
  const p = TP(c); g2.font = textFont(p); try { g2.letterSpacing = (p.ls || 0) + 'px'; } catch { }
  let ls = String(p.text || '').split('\n'); if (p.upper) ls = ls.map(l => l.toLocaleUpperCase('tr'));
  if (p.boxW > 0) ls = wrapLines(g2, ls, p.boxW);
  const lh = p.size * (p.lh || 1.2), ws = ls.map(l => g2.measureText(l).width), w = Math.max(10, p.boxW > 0 ? p.boxW : 0, ...ws);
  return { p, ls, ws, lh, w, h: ls.length * lh };
}
// Metin kutusu genişliği verilmişse satırları kelime kelime kaydır (çok uzun kelimeyi harf harf böl)
function wrapLines(g2, ls, mw) {
  const out = [];
  for (const line of ls) {
    if (!line) { out.push(''); continue; } let cur = '';
    for (const word of line.split(' ')) {
      const tr = cur ? cur + ' ' + word : word;
      if (g2.measureText(tr).width <= mw) { cur = tr; continue; }
      if (cur) out.push(cur);
      if (g2.measureText(word).width <= mw) { cur = word; continue; }
      let piece = ''; for (const ch of word) { if (piece && g2.measureText(piece + ch).width > mw) { out.push(piece); piece = ch; } else piece += ch; } cur = piece;
    }
    out.push(cur);
  }
  return out;
}
function rrect(g2, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g2.beginPath(); g2.moveTo(x + r, y); g2.arcTo(x + w, y, x + w, y + h, r); g2.arcTo(x + w, y + h, x, y + h, r); g2.arcTo(x, y + h, x, y, r); g2.arcTo(x, y, x + w, y, r); g2.closePath(); }
function fadeMul(c, lt) { let m = 1; const fi = c.p.fadeIn || 0, fo = c.p.fadeOut || 0; if (fi > 0) m *= clamp(lt / fi, 0, 1); if (fo > 0) m *= clamp((c.dur - lt) / fo, 0, 1); return m; }
function drawText(g2, c, lt) {
  const L = textLayout(c, g2), p = L.p; g2.textBaseline = 'middle'; g2.textAlign = p.align; g2.lineJoin = 'round';
  const y0 = -(L.ls.length - 1) * L.lh / 2, ax = p.align === 'left' ? -L.w / 2 : p.align === 'right' ? L.w / 2 : 0;
  if (p.kStyle && p.kStyle !== 'none' && !(p.tw > 0) && typeof drawKaraoke === 'function' && drawKaraoke(g2, c, L, lt, y0)) { try { g2.letterSpacing = '0px'; } catch { } return; }
  if (p.bg) { const pd = p.bgPad; g2.save(); g2.globalAlpha *= clamp(p.bgOp, 0, 1); g2.fillStyle = p.bgColor; rrect(g2, -L.w / 2 - pd, -L.h / 2 - pd, L.w + pd * 2, L.h + pd * 2, p.bgRad); g2.fill(); g2.restore(); }
  let lines = L.ls;
  if (p.tw > 0) { let n = Math.floor(L.ls.join('').length * clamp(lt / p.tw, 0, 1)); lines = L.ls.map(l => { const s = l.slice(0, Math.max(0, n)); n -= l.length; return s; }); }
  const fill = () => { if (!p.grad) return p.color; const gr = g2.createLinearGradient(0, -L.h / 2, 0, L.h / 2); gr.addColorStop(0, p.color); gr.addColorStop(1, p.color2); return gr; };
  if ((p.tAnim && p.tAnim !== 'none') || (p.tOut && p.tOut !== 'none') || (p.tLoop && p.tLoop !== 'none')) { drawTextAnim(g2, c, L, lines, y0, lt, fill); try { g2.letterSpacing = '0px'; } catch { } return; }
  lines.forEach((l, j) => {
    const y = y0 + j * L.lh; if (!l) return;
    if (p.shadow) { g2.save(); g2.shadowColor = p.shColor; g2.shadowBlur = p.shBlur; g2.shadowOffsetX = p.shX; g2.shadowOffsetY = p.shY; g2.fillStyle = p.shColor; if (p.strokeW > 0) { g2.lineWidth = p.strokeW * 2; g2.strokeStyle = p.shColor; g2.strokeText(l, ax, y); } g2.fillText(l, ax, y); g2.restore(); }
    if (p.glow) { g2.save(); g2.shadowColor = p.glowColor; g2.shadowBlur = p.glowBlur; g2.fillStyle = p.glowColor; for (let k = 0; k < 2; k++) g2.fillText(l, ax, y); g2.restore(); }
    if (p.strokeW > 0) { g2.lineWidth = p.strokeW * 2; g2.strokeStyle = p.stroke; g2.strokeText(l, ax, y); }
    g2.fillStyle = fill(); g2.fillText(l, ax, y);
  });
  try { g2.letterSpacing = '0px'; } catch { }
}
// ---------- Geçişler ----------
const TRANSITIONS = [['none', 'Yok'], ['fade', 'Solma'], ['slideL', 'Kayma ←'], ['slideR', 'Kayma →'], ['slideU', 'Kayma ↑'], ['slideD', 'Kayma ↓'],
  ['zoomIn', 'Yakınlaşma'], ['zoomOut', 'Uzaklaşma'], ['pop', 'Zıplama (pop)'], ['spin', 'Dönerek'], ['blur', 'Bulanık'], ['wipeL', 'Perde →'], ['wipeD', 'Perde ↓'], ['flip', 'Takla (yatay)']];
const TR_ICON = { fade: '◐', slideL: '←', slideR: '→', slideU: '↑', slideD: '↓', zoomIn: '⊕', zoomOut: '⊖', pop: '✦', spin: '↻', blur: '≋', wipeL: '▤', wipeD: '▥', flip: '⇋' };
const outCubic = x => 1 - Math.pow(1 - x, 3);
const outBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function trState(c, lt) {
  const S = { dx: 0, dy: 0, ds: 1, dr: 0, alpha: 1, blur: 0, wipe: null };
  const one = (type, k, dir) => { // k: 0 = tam efekt, 1 = efekt yok ; dir 1 = giriş, -1 = çıkış
    if (!type || type === 'none' || k >= 1) return;
    const e = outCubic(k), a = 1 - e;
    switch (type) {
      case 'fade': S.alpha *= e; break;
      case 'slideL': S.dx += a * W * dir; break;
      case 'slideR': S.dx -= a * W * dir; break;
      case 'slideU': S.dy += a * H * dir; break;
      case 'slideD': S.dy -= a * H * dir; break;
      case 'zoomIn': S.ds *= 1 - 0.7 * a; S.alpha *= e; break;
      case 'zoomOut': S.ds *= 1 + 0.8 * a; S.alpha *= e; break;
      case 'pop': S.ds *= Math.max(0.001, outBack(k)); S.alpha *= Math.min(1, k * 4); break;
      case 'spin': S.dr += a * 270 * dir; S.ds *= Math.max(0.001, e); break;
      case 'blur': S.blur += a * 40; S.alpha *= Math.min(1, k * 2); break;
      case 'wipeL': S.wipe = dir > 0 ? [0, 0, W * e, H] : [W * a, 0, W * e, H]; break;
      case 'wipeD': S.wipe = dir > 0 ? [0, 0, W, H * e] : [0, H * a, W, H * e]; break;
      case 'flip': S.ds *= 1; S.dr += 0; S._flip = (S._flip || 1) * Math.max(0.001, Math.abs(Math.cos(a * Math.PI / 2))); break;
    }
  };
  const p = c.p, di = p.trInD || 0.5, dout = p.trOutD || 0.5;
  one(p.trIn, clamp(lt / di, 0, 1), 1);
  one(p.trOut, clamp((c.dur - lt) / dout, 0, 1), -1);
  if (S._flip) { S.ds *= 1; S.flip = S._flip; }
  return S;
}
function boxOf(c, t) {
  if (typeof evalClip === 'function') c = evalClip(c, t - c.start); // unrotated bbox size (in canvas units, before translation)
  const g = geomOf(c, t);
  if (c.type === 'text') {
    const L = textLayout(c, ctx); const pd = L.p.bg ? L.p.bgPad : 0;
    return { g, w: (L.w + pd * 2) * g.s * (c.p.sx ?? 1), h: (L.h + pd * 2) * g.s };
  }
  if (c.type === 'shape' || c.type === 'focus') return { g, w: (c.p.w || 400) * g.s, h: (c.p.h || 400) * g.s };
  const src = elFor(c); if (!src) return null;
  const [sw, sh] = srcSize(c, src); if (!sw) return null;
  const f = fitScale(c, sw, sh);
  const mx = c.type === 'image' ? (c.p.msx ?? 1) : 1, my = c.type === 'image' ? (c.p.msy ?? 1) : 1;
  const cr = c.p.crop; return { g, w: sw * f * g.s * mx * (cr ? 1 - cr.l - cr.r : 1), h: sh * f * g.s * my * (cr ? 1 - cr.t - cr.b : 1) };
}
let VIEW = { s: 0.3, ox: 0, oy: 0 };
const setView0 = c2 => c2.setTransform(VIEW.s, 0, 0, VIEW.s, VIEW.ox, VIEW.oy);
function renderAt(t, c2 = ctx, preview = false, k = 1) {
  c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalAlpha = 1; c2.filter = 'none';
  if (preview) { c2.fillStyle = '#0d0d10'; c2.fillRect(0, 0, c2.canvas.width, c2.canvas.height); setView0(c2); }
  else if (k !== 1) c2.setTransform(k, 0, 0, k, 0, 0);
  c2.fillStyle = '#000'; c2.fillRect(0, 0, W, H);
  const ks = preview ? VIEW.s : k; // proje pikseli başına tuval pikseli
  const order = (typeof visualOrder === 'function' ? visualOrder() : proj.tracks.filter(tr => tr.kind === 'visual').flatMap(tr => tr.clips)).filter(c => active(c, t) && !c.hidden);
  if (typeof evalClip === 'function') for (let i = 0; i < order.length; i++) order[i] = evalClip(order[i], t - order[i].start); // değer keyframe'leri
  const focus = order.filter(c => c.type === 'focus');
  for (let i = order.length - 1; i >= 0; i--) { // alttan üste
    const c = order[i];
    if (c.type === 'focus') { if (c === focus[0] && typeof applyFocus === 'function') applyFocus(c2, focus, t, preview, ks); continue; }
    const lt = t - c.start, g = geomOf(c, t), T = trState(c, lt);
    if (typeof fxShake === 'function') fxShake(c, lt, T);
    const alpha = clamp(g.o * fadeMul(c, lt) * T.alpha, 0, 1);
    const src = (c.type === 'video' || c.type === 'image') ? elFor(c) : null;
    const ss = src ? srcSize(c, src) : [0, 0];
    if (src && ss[0] && c.p.bgBlur) { c2.save(); c2.globalAlpha = alpha; drawBlurBg(c2, src, ss[0], ss[1], colorFilter(c)); c2.restore(); }
    c2.save(); c2.globalAlpha = alpha;
    if (T.wipe) { c2.beginPath(); c2.rect(T.wipe[0], T.wipe[1], T.wipe[2], T.wipe[3]); c2.clip(); }
    const flt = ((src ? colorFilter(c) : '') + (T.blur > 0.3 ? ` blur(${(T.blur * ks).toFixed(1)}px)` : '') + (src && typeof fxBlurF === 'function' ? fxBlurF(c, ks) : '')).trim();
    if (flt) c2.filter = flt;
    c2.translate(W / 2 + g.x + T.dx, H / 2 + g.y + T.dy); c2.rotate((g.r + T.dr) * Math.PI / 180); c2.scale(g.s * T.ds * (T.flip || 1), g.s * T.ds);
    if (c.type === 'text') { const sx = c.p.sx ?? 1; if (sx !== 1) c2.scale(sx, 1); drawText(c2, c, lt); }
    else if (c.type === 'shape') drawShape(c2, c);
    else if (src && ss[0]) {
      if (c.p.mirror) c2.scale(-1, 1); // ters görsel (yatay ayna)
      if (c.type === 'image') { const mx = c.p.msx ?? 1, my = c.p.msy ?? 1; if (mx !== 1 || my !== 1) c2.scale(mx, my); } // görseli en/boy ayrı genişlet
      const f = fitScale(c, ss[0], ss[1]), dw = ss[0] * f, dh = ss[1] * f;
      if ((c.p.crop || (typeof cropEdit !== 'undefined' && cropEdit && cropEdit.id === c.id)) && typeof cropPre === 'function') cropPre(c2, c, dw, dh); // kırpma
      try { if (typeof drawMediaFx === 'function') drawMediaFx(c2, c, src, dw, dh, t, ks * g.s * T.ds); else c2.drawImage(src, -dw / 2, -dh / 2, dw, dh); } catch { }
      if (c.p.vig > 0) drawVignette(c2, dw, dh, c.p.vig);
    }
    c2.restore();
  }
  if (preview) { // video dışını karart
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalAlpha = 1; c2.filter = 'none';
    const fx = VIEW.ox, fy = VIEW.oy, fw = W * VIEW.s, fh = H * VIEW.s;
    c2.beginPath(); c2.rect(0, 0, c2.canvas.width, c2.canvas.height); c2.rect(fx, fy, fw, fh);
    c2.fillStyle = 'rgba(13,13,16,0.72)'; c2.fill('evenodd');
    c2.strokeStyle = '#3a3a46'; c2.lineWidth = 1; c2.strokeRect(fx - 0.5, fy - 0.5, fw + 1, fh + 1);
  }
}
function draw() {
  renderAt(time, ctx, true); setView0(ctx);
  for (const id of new Set([...selSet, sel].filter(Boolean))) {
    const s = findClip(id); if (!s || kindOf(s.clip) !== 'visual' || !active(s.clip, time)) continue;
    if (typeof cropEdit !== 'undefined' && cropEdit && cropEdit.id === id) continue;
    const b = boxOf(s.clip, time);
    if (b) {
      ctx.save(); ctx.translate(W / 2 + b.g.x, H / 2 + b.g.y); ctx.rotate(b.g.r * Math.PI / 180);
      ctx.strokeStyle = id === sel ? '#6c8cff' : 'rgba(108,140,255,.55)'; ctx.lineWidth = 2 / VIEW.s; ctx.setLineDash([8 / VIEW.s, 5 / VIEW.s]); ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); if (id === sel) { const hs = 14 / VIEW.s; ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.lineWidth = 2 / VIEW.s; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.fillRect(sx * b.w / 2 - hs / 2, sy * b.h / 2 - hs / 2, hs, hs); ctx.strokeRect(sx * b.w / 2 - hs / 2, sy * b.h / 2 - hs / 2, hs, hs); } if (typeof drawHandles2 === 'function') drawHandles2(ctx, b, s.clip); } ctx.restore();
    }
  }
  if (typeof cropOverlay === 'function') cropOverlay(ctx);
  $('#tc').textContent = fmt(time) + ' / ' + fmt(duration());
  $('#playhead').style.left = (time * pps) + 'px'; $('#phLabel').textContent = fmt(time); $('#phLabel').style.transform = time * pps < 34 ? 'translateX(0)' : '';
  if (typeof graphDraw === 'function') graphDraw();
  if (typeof lyPlayhead === 'function') lyPlayhead();
}

// ---------- Playback ----------
function setTime(t) {
  time = clamp(t, 0, duration() + 600);
  if (playing) { aud.t0 = time; aud.ct0 = actx().currentTime; audStart(); }
  draw(); updateKfButtons();
}
function play() {
  if (playing) return pause();
  if (time >= duration() - 0.01) time = 0;
  const A = actx(); A.resume().catch(() => {});
  for (const c of allClips()) if (hasSound(c)) audBuf(mediaOf(c));
  playing = true; aud.t0 = time; aud.ct0 = A.currentTime; $('#bPlay').textContent = '⏸';
  audStart(); requestAnimationFrame(loop);
}
function pause() { playing = false; $('#bPlay').textContent = '▶'; audStop(); draw(); refreshInsp(); }
function loop() {
  if (!playing) return;
  const A = actx(); time = aud.t0 + Math.max(0, A.currentTime - aud.ct0);
  if (time >= duration()) { time = duration(); pause(); return; }
  for (const c of allClips()) if (c.type === 'video' && c.start > time && c.start - time < 0.6) { const idx = vfIdx(c, srcT(c, 0)), st = vfState(vfKey(c, false)); if (!st.frames.has(idx) && !st.pend.has(idx)) vfRequest(c, idx, false, PREVIEW_H); } // sıradaki klibi önceden hazırla
  audTick(); draw(); requestAnimationFrame(loop);
}

// ---------- Library ----------
function detectKind(p) {
  const ext = p.split('.').pop().toLowerCase();
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'image';
  return 'video';
}
function probeEl(m) {
  return new Promise(res => {
    if (m.kind === 'image') {
      const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { const c = document.createElement('canvas'); c.width = 160; c.height = 100; const x = c.getContext('2d'); const f = Math.max(160 / im.naturalWidth, 100 / im.naturalHeight); x.drawImage(im, (160 - im.naturalWidth * f) / 2, (100 - im.naturalHeight * f) / 2, im.naturalWidth * f, im.naturalHeight * f); m.thumb = c.toDataURL('image/jpeg', .7); m.dur = 5; res(true); };
      im.onerror = () => res(false); im.src = mediaURL(m.path); return;
    }
    (async () => {
      const inf = await window.api.vidInfo(m.path); if (!inf || !(inf.dur > 0)) return res(false);
      m.dur = inf.dur; if ('hasAudio' in inf) m.hasAudio = inf.hasAudio; if (m.kind === 'audio') return res(true);
      const key = 'thumb:' + m.id, f = await window.api.vidFrame({ key, p: m.path, t: Math.min(0.5, m.dur / 2), fps: 30, h: 200 }); window.api.vidClose(key);
      if (!f) return res(false);
      const bmp = await createImageBitmap(new Blob([f.jpg], { type: 'image/jpeg' }));
      const c = document.createElement('canvas'); c.width = 160; c.height = 100; const x = c.getContext('2d'); const k = Math.max(160 / bmp.width, 100 / bmp.height);
      x.drawImage(bmp, (160 - bmp.width * k) / 2, (100 - bmp.height * k) / 2, bmp.width * k, bmp.height * k); m.thumb = c.toDataURL('image/jpeg', .7); bmp.close(); res(true);
    })().catch(() => res(false));
  });
}
async function importPaths(paths) {
  const out = [];
  for (const p of paths) {
    let m = library.find(x => x.path === p);
    if (!m) {
      m = { id: uid(), path: p, name: p.split(/[\\/]/).pop(), kind: detectKind(p) };
      status('İçe aktarılıyor: ' + m.name);
      if (!(await probeEl(m))) { status('Açılamadı: ' + m.name); continue; }
      m.hasAudio = m.kind === 'image' ? false : (m.kind === 'audio' ? true : (await window.api.probe(p)).hasAudio);
      library.unshift(m);
    }
    out.push(m);
  }
  await window.api.libSave(library); renderLib(); status('');
  return out;
}
async function renderLib() {
  const L = $('#libList'); L.innerHTML = '';
  for (const m of library) {
    const d = document.createElement('div'); d.className = 'li'; d.draggable = true; d.title = m.path;
    d.innerHTML = (m.thumb ? `<img src="${m.thumb}">` : `<div class="ic">${m.kind === 'audio' ? '♪' : '▣'}</div>`) + `<div class="n"></div><button class="x">×</button>`;
    d.querySelector('.n').textContent = (m.kind === 'audio' ? '♪ ' : '') + m.name;
    d.ondragstart = e => e.dataTransfer.setData('text/media', m.id);
    d.ondblclick = () => { commit(); addMediaClip(m, time); refreshAll(); };
    d.querySelector('.x').onclick = async e => { e.stopPropagation(); library = library.filter(x => x !== m); await window.api.libSave(library); renderLib(); };
    window.api.exists(m.path).then(ok => { if (!ok) d.classList.add('miss'); });
    L.appendChild(d);
  }
}

// ---------- Clip ops ----------
function trackFor(kind, start, dur, prefer) {
  const free = t => t.kind === kind && !t.clips.some(c => start < c.start + c.dur - 1e-6 && start + dur > c.start + 1e-6);
  if (prefer && free(prefer)) return prefer;
  let t = proj.tracks.find(free);
  if (!t) { t = { id: uid(), kind, clips: [] }; if (kind === 'visual') proj.tracks.unshift(t); else proj.tracks.push(t); }
  return t;
}
const baseP = () => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
function addMediaClip(m, start, prefer) {
  proj.media[m.id] = { id: m.id, path: m.path, name: m.name, alias: m.alias, kind: m.kind, dur: m.dur, hasAudio: m.hasAudio };
  const c = { id: uid(), type: m.kind, mediaId: m.id, name: m.alias || m.name, start, in: 0, dur: m.dur, p: baseP(), kf: {} };
  if (m.kind !== 'image') c.p.volume = 1;
  trackFor(kindOf(c), start, c.dur, prefer).clips.push(c); sel = c.id; return c;
}
function addText() {
  commit();
  const c = { id: uid(), type: 'text', name: 'Metin', start: time, in: 0, dur: 3, p: Object.assign(baseP(), JSON.parse(JSON.stringify(TEXT_DEF))), kf: {} };
  trackFor('visual', c.start, c.dur).clips.push(c); sel = c.id; refreshAll();
}
function deleteSel() {
  const ids = new Set(selSet); if (sel) ids.add(sel); if (!ids.size) return;
  commit();
  for (const tr of proj.tracks) {
    const del = tr.clips.filter(c => ids.has(c.id)).sort((x, y) => y.start - x.start);
    for (const d of del) {
      tr.clips = tr.clips.filter(c => c !== d);
      if (magnet) for (const c of tr.clips) if (c.start >= d.start + d.dur - 1e-6) c.start = Math.max(0, c.start - d.dur);
    }
  }
  sel = null; cleanTracks(); refreshAll();
}
function cleanTracks() {
  proj.tracks = proj.tracks.filter(t => t.clips.length);
  if (!proj.tracks.some(t => t.kind === 'visual')) proj.tracks.unshift({ id: uid(), kind: 'visual', clips: [] });
  if (!proj.tracks.some(t => t.kind === 'audio')) proj.tracks.push({ id: uid(), kind: 'audio', clips: [] });
  gcEls();
}
function splitClip(c, track, t) {
  const lt = t - c.start; if (lt <= EPS || lt >= c.dur - EPS) return false;
  const b = JSON.parse(JSON.stringify(c)); b.id = uid(); b.start = t; b.in = c.p.rev ? c.in : c.in + lt * spd(c); b.dur = c.dur - lt;
  const cIn = c.p.rev ? c.in + (c.dur - lt) * spd(c) : c.in;
  for (const p of Object.keys(c.kf || {})) {
    const a = c.kf[p]; if (!a.length) continue; const v = val(c, p, lt);
    const e = (a.slice().reverse().find(k => k.t <= lt) || a[0]).e;
    c.kf[p] = a.filter(k => k.t < lt - EPS).concat([{ t: lt, v, e: { n: 'bezier', b: [0.42, 0, 0.58, 1] } }]);
    b.kf[p] = [{ t: 0, v, e: JSON.parse(JSON.stringify(e)) }].concat(a.filter(k => k.t > lt + EPS).map(k => ({ ...k, t: k.t - lt })));
  }
  c.dur = lt; c.in = cIn; track.clips.push(b);
  if (proj.layers) { const i = proj.layers.indexOf(c.id); if (i >= 0) proj.layers.splice(i, 0, b.id); }
  return b;
}
function cut() {
  let targets;
  if (sel) targets = [...new Set([...selSet, sel])].map(findClip).filter(f => f && active(f.clip, time));
  else targets = proj.tracks.flatMap(tr => tr.clips.filter(c => active(c, time)).map(c => ({ clip: c, track: tr })));
  if (!targets.length) return;
  commit(); let last = null; for (const f of targets) last = splitClip(f.clip, f.track, time) || last;
  if (last && sel) sel = last.id; refreshAll();
}

// ---------- Timeline ----------
const tlScroll = $('#tlScroll'), tracksEl = $('#tracks'), ruler = $('#ruler');
function renderTL() {
  const total = Math.max(duration() + 10, tlScroll.clientWidth / pps);
  $('#tlInner').style.width = (total * pps) + 'px';
  ruler.innerHTML = '';
  const step = pps > 150 ? 0.5 : pps > 60 ? 1 : pps > 25 ? 2 : 5;
  for (let s = 0; s <= total; s += step) { const sp = document.createElement('span'); sp.style.left = (s * pps) + 'px'; sp.textContent = fmt(s).replace(/\.00$/, ''); ruler.appendChild(sp); }
  tracksEl.innerHTML = '';
  for (const tr of proj.tracks) {
    const te = document.createElement('div'); te.className = 'track'; te.dataset.id = tr.id;
    te.ondragover = e => e.preventDefault();
    te.ondrop = async e => {
      e.preventDefault(); const t = Math.max(0, (e.clientX - te.getBoundingClientRect().left) / pps);
      const id = e.dataTransfer.getData('text/media');
      let ms = id ? [library.find(m => m.id === id)] : await importPaths([...e.dataTransfer.files].map(f => window.api.pathOf(f)));
      commit(); let s = t; for (const m of ms.filter(Boolean)) { const c = addMediaClip(m, s, tr); s += c.dur; } refreshAll();
    };
    for (const c of tr.clips) {
      const ce = document.createElement('div'); ce.className = 'clip ' + c.type + (selSet.has(c.id) || c.id === sel ? ' sel' : '') + (c.p.rev ? ' rev' : '') + (c.hidden ? ' hid' : ''); ce.dataset.id = c.id;
      ce.style.left = (c.start * pps) + 'px'; ce.style.width = Math.max(4, c.dur * pps) + 'px';
      ce.textContent = clipLabel(c); addWave(ce, c);
      const times = new Map(); Object.entries(c.kf || {}).forEach(([p, a]) => a.forEach(k => { const key = k.t.toFixed(3), o = times.get(key) || { tr: false, v: false }; if (KF_PROPS.includes(p)) o.tr = true; else o.v = true; times.set(key, o); }));
      times.forEach((o, k) => { for (const kind of ['tr', 'v']) { if (!o[kind]) continue; const d = document.createElement('div'); d.className = 'd' + (kind === 'v' ? ' v' : '') + (o.tr && o.v ? ' both' : ''); d.style.left = (k * pps) + 'px'; d.title = (kind === 'v' ? 'Değer keyframe\'i' : 'Dönüşüm keyframe\'i') + ' · sürükle: zamanı değiştir'; d.onmousedown = e => dragKf(e, c, +k); ce.appendChild(d); } });
      ['l', 'r'].forEach(s => { const h = document.createElement('div'); h.className = 'h ' + s; h.onmousedown = e => startDrag(e, c, tr, s); ce.appendChild(h); });
      ce.onmousedown = e => startDrag(e, c, tr, 'm');
      te.appendChild(ce);
    }
    tracksEl.appendChild(te);
  }
  if (tlScroll.scrollHeight <= tlScroll.clientHeight + 1) tlScroll.scrollTop = 0;
  draw(); if (typeof updateNav === 'function') updateNav();
  if (typeof renderLayers === 'function') renderLayers();
}
function dragKf(e, c, t0) {
  e.stopPropagation(); e.preventDefault(); if (e.button !== 0) return;
  sel = c.id; if (playing) pause();
  const before = JSON.stringify(proj), x0 = e.clientX; let moved = false, cur = t0;
  const ks = []; for (const p in (c.kf || {})) for (const k of c.kf[p]) if (Math.abs(k.t - t0) < 0.002) ks.push([p, k]);
  const mv = ev => {
    if (Math.abs(ev.clientX - x0) > 2) moved = true; if (!moved) return;
    let nt = clamp(t0 + (ev.clientX - x0) / pps, 0, c.dur);
    const abs = c.start + nt; if (Math.abs(abs - time) * pps < 8) nt = time - c.start; nt = Math.round(nt * FPS) / FPS; nt = clamp(nt, 0, c.dur);
    cur = nt; for (const [p, k] of ks) { k.t = nt; c.kf[p].sort((x, y) => x.t - y.t); }
    renderTL(); status('Keyframe: ' + fmt(c.start + nt));
  };
  const up = () => {
    removeEventListener('mousemove', mv); removeEventListener('mouseup', up); status('');
    if (moved) { for (const [p, k] of ks) c.kf[p] = c.kf[p].filter(x => x === k || Math.abs(x.t - k.t) >= EPS);
      undoS.push(before); redoS.length = 0; dirty = true; }
    setTime(c.start + cur); refreshAll();
  };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
}
function snapPts(except, exSet) {
  const pts = [0, time]; for (const c of allClips()) if (c.id !== except && !(exSet && exSet.has(c.id))) pts.push(c.start, c.start + c.dur); return pts;
}
function snap(v, pts) { const th = 8 / pps; let best = v, bd = th; for (const p of pts) { const d = Math.abs(p - v); if (d < bd) { bd = d; best = p; } } return best; }
function startDrag(e, c, tr, mode) {
  e.stopPropagation(); if (e.button !== 0) return;
  if (e.ctrlKey || e.shiftKey) { // çoklu seçim
    keepMulti = true;
    if (selSet.has(c.id)) { selSet.delete(c.id); sel = selSet.size ? [...selSet][selSet.size - 1] : null; }
    else { selSet.add(c.id); sel = c.id; }
    keepMulti = false; renderTL(); refreshInsp(); return;
  }
  const group = mode === 'm' && selSet.size > 1 && selSet.has(c.id);
  if (group) { keepMulti = true; sel = c.id; keepMulti = false; } else sel = c.id;
  refreshInsp();
  const x0 = e.clientX, y0 = e.clientY, s0 = c.start, d0 = c.dur, i0 = c.in, kf0 = JSON.stringify(c.kf || {});
  const before = JSON.stringify(proj); let moved = false;
  const pts = group ? snapPts(null, selSet) : snapPts(c.id);
  const m = mediaOf(c), isMedia = (c.type === 'video' || c.type === 'audio') && !!m, sp = spd(c), rev = !!c.p.rev;
  const gStarts = group ? allClips().filter(x => selSet.has(x.id)).map(x => [x, x.start]) : null;
  const followers = magnet && mode !== 'm' ? tr.clips.filter(x => x !== c && x.start >= s0 + d0 - 1e-6).map(x => [x, x.start]) : [];
  // komşular: kesilmiş parçayı geri almak için (roll) veya yer açmak için (itme)
  const after = tr.clips.filter(x => x !== c && x.start >= s0 + d0 - 1e-3), before_ = tr.clips.filter(x => x !== c && x.start + x.dur <= s0 + 1e-3);
  const next = after.sort((x, y) => x.start - y.start)[0], prev = before_.sort((x, y) => (y.start + y.dur) - (x.start + x.dur))[0];
  const contig = (A, B, aIn, aDur) => A && B && A.mediaId && A.mediaId === B.mediaId && !A.p.rev && !B.p.rev && spd(A) === spd(B) && Math.abs(B.start - (A === c ? s0 + d0 : A.start + A.dur)) < 0.02 && Math.abs(B.in - (aIn + aDur * spd(A))) < 0.05;
  const rollNext = isMedia && next && contig(c, next, i0, d0), rollPrev = isMedia && prev && prev.mediaId === c.mediaId && !prev.p.rev && !rev && spd(prev) === sp && Math.abs(prev.start + prev.dur - s0) < 0.02 && Math.abs(i0 - (prev.in + prev.dur * sp)) < 0.05;
  const nx0 = next && { start: next.start, in: next.in, dur: next.dur, kf: JSON.stringify(next.kf || {}) }, pv0 = prev && { dur: prev.dur };
  const pushers = next ? after.map(x => [x, x.start]) : [];
  if (!group) { document.querySelectorAll('.clip.sel').forEach(x => x.classList.remove('sel')); e.currentTarget.closest('.clip').classList.add('sel'); }
  const mv = ev => {
    const dt = (ev.clientX - x0) / pps; if (Math.abs(ev.clientX - x0) > 2 || Math.abs(ev.clientY - y0) > 2) moved = true; if (!moved) return;
    if (mode === 'm' && group) {
      const minS = Math.min(...gStarts.map(([, s]) => s));
      let d = snap(s0 + dt, pts) - s0; d = Math.max(d, -minS);
      for (const [x, s] of gStarts) x.start = s + d;
    } else if (mode === 'm') {
      let ns = Math.max(0, s0 + dt); const ne = snap(ns + d0, pts) - d0; ns = snap(ns, pts); if (Math.abs(ns - (s0 + dt)) > Math.abs(ne - (s0 + dt))) ns = ne; c.start = Math.max(0, ns);
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.track');
      const nt = over && proj.tracks.find(t => t.id === over.dataset.id);
      if (nt && nt !== tr && nt.kind === tr.kind) { tr.clips = tr.clips.filter(x => x !== c); nt.clips.push(c); tr = nt; if (proj.layers) proj.layers = proj.layers.filter(id => id !== c.id); }
    } else if (mode === 'r') {
      const maxD = isMedia ? (rev ? d0 + i0 / sp : (m.dur - i0) / sp) : Infinity;
      let lim = maxD; if (rollNext) lim = Math.min(lim, d0 + nx0.dur - 1 / FPS);
      c.dur = clamp(snap(s0 + d0 + dt, pts) - s0, 1 / FPS, lim);
      if (isMedia && rev) c.in = i0 + (d0 - c.dur) * sp;
      if (rollNext) { // kesilen parçayı geri al: sonraki parça kısalır
        const g = c.dur - d0; next.start = nx0.start + g; next.in = nx0.in + g * sp; next.dur = nx0.dur - g;
        const k = JSON.parse(nx0.kf); for (const p in k) k[p].forEach(x => x.t -= g); next.kf = k;
      } else if (magnet) { for (const [x, s] of followers) x.start = s + (c.dur - d0); }
      else if (next) { const over = Math.max(0, s0 + c.dur - nx0.start); for (const [x, s] of pushers) x.start = s + over; }
    } else {
      let delta = snap(s0 + dt, pts) - s0;
      let lo = magnet ? -1e9 : -s0;
      if (isMedia) lo = Math.max(lo, rev ? d0 - (m.dur - i0) / sp : -i0 / sp);
      if (!magnet && prev) lo = Math.max(lo, rollPrev ? -(pv0.dur - 1 / FPS) : (prev.start + prev.dur) - s0);
      delta = clamp(delta, lo, d0 - 1 / FPS);
      c.dur = d0 - delta;
      if (rollPrev && !magnet) prev.dur = pv0.dur + Math.min(0, delta);
      if (isMedia) c.in = rev ? i0 : i0 + delta * sp;
      if (magnet) { c.start = s0; for (const [x, s] of followers) x.start = s - delta; } else c.start = s0 + delta;
      const k = JSON.parse(kf0); for (const p in k) k[p].forEach(x => x.t -= delta); c.kf = k;
    }
    renderTL();
  };
  const up = () => {
    removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
    if (moved) { undoS.push(before); redoS.length = 0; dirty = true; refreshAll(); } else { renderTL(); }
  };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
}
function seekFromEvent(e) { const r = $('#tlInner').getBoundingClientRect(); setTime((e.clientX - r.left) / pps); }
ruler.onmousedown = e => { if (playing) pause(); seekFromEvent(e); const mv = ev => seekFromEvent(ev); const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up); };
tracksEl.onmousedown = e => { if (e.target === tracksEl || e.target.classList.contains('track')) startMarquee(e); };
tlScroll.addEventListener('wheel', e => {
  if (!e.ctrlKey) return; e.preventDefault();
  const r = tlScroll.getBoundingClientRect(), tAt = (e.clientX - r.left + tlScroll.scrollLeft) / pps;
  pps = clamp(pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 5, 600); renderTL(); tlScroll.scrollLeft = tAt * pps - (e.clientX - r.left);
}, { passive: false });

// ---------- Preview drag ----------
function canvasPt(e) { const r = cv.getBoundingClientRect(), k = cv.width / r.width; return [((e.clientX - r.left) * k - VIEW.ox) / VIEW.s, ((e.clientY - r.top) * k - VIEW.oy) / VIEW.s]; }
cv.onmousedown = e => {
  if (typeof handleDown2 === 'function' && handleDown2(e)) return; // döndürme / kenar tutamaçları
  const [px, py] = canvasPt(e);
  { // köşeden tutup büyütme
    const cs = sel && findClip(sel)?.clip;
    if (cs && kindOf(cs) === 'visual' && active(cs, time)) {
      const b = boxOf(cs, time);
      if (b) {
        const a2 = b.g.r * Math.PI / 180, cx = W / 2 + b.g.x, cy = H / 2 + b.g.y, tol = 16 / VIEW.s;
        const corner = [[-1, -1], [1, -1], [1, 1], [-1, 1]].find(([sx, sy]) => { const lx = sx * b.w / 2, ly = sy * b.h / 2; return Math.hypot(cx + lx * Math.cos(a2) - ly * Math.sin(a2) - px, cy + lx * Math.sin(a2) + ly * Math.cos(a2) - py) < tol; });
        if (corner) {
          const lt = time - cs.start, s0 = val(cs, 'scale', lt), d0 = Math.hypot(px - cx, py - cy) || 1, before = JSON.stringify(proj); let moved = false;
          const mv = ev => { const [qx, qy] = canvasPt(ev); moved = true; setProp(cs, 'scale', +Math.max(0.02, s0 * Math.hypot(qx - cx, qy - cy) / d0).toFixed(3)); draw(); };
          const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) { undoS.push(before); redoS.length = 0; dirty = true; refreshAll(); } };
          addEventListener('mousemove', mv); addEventListener('mouseup', up); return;
        }
      }
    }
  }
  // hit test top-most
  let hit = null; const ordH = typeof visualOrder === 'function' ? visualOrder() : proj.tracks.filter(t => t.kind === 'visual').flatMap(t => t.clips);
  for (const tr of [{ clips: ordH }]) { for (const c of tr.clips) { if (!active(c, time) || c.hidden) continue; const b = boxOf(c, time); if (!b) continue; const a = -b.g.r * Math.PI / 180, dx = px - W / 2 - b.g.x, dy = py - H / 2 - b.g.y; const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a); if (Math.abs(rx) <= b.w / 2 && Math.abs(ry) <= b.h / 2) { hit = c; break; } } if (hit) break; }
  const cur = sel && findClip(sel)?.clip;
  const c = (cur && kindOf(cur) === 'visual' && active(cur, time) && hit === cur) ? cur : hit;
  if (!c) { sel = null; refreshAll(); return; }
  sel = c.id; renderTL(); refreshInsp();
  const lt = time - c.start, x0 = val(c, 'x', lt), y0 = val(c, 'y', lt), before = JSON.stringify(proj); let moved = false;
  const mv = ev => { const [qx, qy] = canvasPt(ev); moved = true; setProp(c, 'x', Math.round(x0 + qx - px)); setProp(c, 'y', Math.round(y0 + qy - py)); draw(); };
  const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); if (moved) { undoS.push(before); redoS.length = 0; dirty = true; refreshAll(); } };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
};
cv.addEventListener('mousemove', e => { const cs = sel && findClip(sel)?.clip; let cur = ''; if (cs && kindOf(cs) === 'visual' && active(cs, time)) { const b = boxOf(cs, time); if (b) { const [px, py] = canvasPt(e), a2 = b.g.r * Math.PI / 180, cx = W / 2 + b.g.x, cy = H / 2 + b.g.y; for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = sx * b.w / 2, ly = sy * b.h / 2; if (Math.hypot(cx + lx * Math.cos(a2) - ly * Math.sin(a2) - px, cy + lx * Math.sin(a2) + ly * Math.cos(a2) - py) < 16 / VIEW.s) cur = sx * sy > 0 ? 'nwse-resize' : 'nesw-resize'; } } } cv.style.cursor = cur; });
cv.addEventListener('wheel', e => {
  const c = sel && findClip(sel)?.clip; if (!c || kindOf(c) !== 'visual') return; e.preventDefault();
  commit(); const lt = time - c.start; setProp(c, 'scale', +(val(c, 'scale', lt) * (e.deltaY < 0 ? 1.05 : 1 / 1.05)).toFixed(3)); refreshInsp(); renderTL();
}, { passive: false });

// ---------- Inspector ----------
const LABELS = { x: 'X', y: 'Y', scale: 'Ölçek', rotation: 'Döndürme', opacity: 'Opaklık' };
const STEPS = { x: 1, y: 1, scale: 0.01, rotation: 1, opacity: 0.01 };
function refreshInsp() {
  const B = $('#inspBody'); const f = sel && findClip(sel);
  if (!f) { B.innerHTML = '<div class="empty">Klip seç</div>'; return; }
  const c = f.clip, lt = clamp(time - c.start, 0, c.dur);
  let h = `<div class="row"><label>Ad</label><input id="i_name" spellcheck="false" value="${esc(c.name || '')}"><span></span></div>
  <div class="row"><label>Başlangıç</label><input id="i_start" type="number" step="0.01" value="${c.start.toFixed(2)}"><span></span></div>
  <div class="row"><label>Süre</label><input id="i_dur" type="number" step="0.01" value="${c.dur.toFixed(2)}"><span></span></div>`;
  if (c.type === 'video' || c.type === 'audio') h += fieldHTML(c, ['volume', 'Ses', 'range', [0, 3]]);
  if (c.type === 'video' || c.type === 'audio') h += mediaInspHTML(c);
  if (c.type === 'video' || c.type === 'image') h += visualMediaInspHTML(c);
  if (c.type === 'shape') h += shapeInspHTML(c);
  if (c.type === 'focus' && typeof focusInspHTML === 'function') h += focusInspHTML(c);
  if (c.type === 'text') h += textInspHTML(c);
  if (kindOf(c) === 'visual') h += `<div class="grp"><h4>Geçişler</h4>${fieldHTML(c, ['trIn', 'Giriş', 'sel', TRANSITIONS])}${fieldHTML(c, ['trInD', 'Giriş süresi', 'num', 0.1])}${fieldHTML(c, ['trOut', 'Çıkış', 'sel', TRANSITIONS])}${fieldHTML(c, ['trOutD', 'Çıkış süresi', 'num', 0.1])}</div>`;
  if (kindOf(c) === 'visual') h += `<div class="grp"><h4>Belirme / Kaybolma</h4>${fieldHTML(c, ['fadeIn', 'Belirme (sn)', 'num', 0.1])}${fieldHTML(c, ['fadeOut', 'Kaybolma (sn)', 'num', 0.1])}</div>`;
  if (kindOf(c) === 'visual') {
    h += `<div class="grp"><h4>Dönüşüm · ◆ = keyframe</h4>`;
    for (const p of KF_PROPS) h += `<div class="row"><label>${LABELS[p]}</label><input id="k_${p}" type="number" step="${STEPS[p]}" value="${+val(c, p, lt).toFixed(3)}"><button class="kf" id="b_${p}">◆</button></div>`;
    h += `<div class="row"><label></label><button id="kfAll">◆ Keyframe ekle (I)</button><span></span></div></div>
      <div class="grp" id="easeGrp"><h4>Geçiş (playhead'deki keyframe'den sonraki)</h4>
      <div class="row"><label>Tür</label><select id="e_n">${Object.entries(PRESET_TR).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><span></span></div>
      <canvas id="bez" width="520" height="300"></canvas>
      <div class="row" style="margin-top:6px"><label>Değerler</label><input id="e_b" placeholder="x1,y1,x2,y2"><span></span></div>
      <div class="row"><label></label><button id="kfPrev">◀ Önceki</button><button id="kfNext">▶</button></div></div>`;
  }
  B.innerHTML = h;
  if (c.type === 'text') $('#i_text').value = TP(c).text;
  const num = (id, fn) => { const el = $('#' + id); if (el) el.onchange = () => { commit(); fn(el); refreshAll(); }; };
  const nm = $('#i_name'); nm.onchange = () => { commit(); c.name = nm.value.trim() || c.name; renderTL(); };
  num('i_start', el => c.start = Math.max(0, +el.value || 0));
  num('i_dur', el => { const m = mediaOf(c); const mx = (c.type === 'video' || c.type === 'audio') && m ? (c.p.rev ? c.dur + c.in / spd(c) : (m.dur - c.in) / spd(c)) : Infinity; c.dur = clamp(+el.value || 0.1, 1 / FPS, mx); });
  if (c.type === 'text') {
    const t = $('#i_text'); t.onfocus = () => commit(); t.oninput = () => { c.p.text = t.value; dirty = true; draw(); }; t.onblur = () => renderTL();
    $('#i_preset').onchange = e => { const pr = TEXT_PRESETS[e.target.value]; if (!pr) return; commit(); Object.assign(c.p, pr); refreshAll(); };
    const fi = $('#f_font'); if (fi) fi.addEventListener('pointerdown', loadSystemFonts, { once: true });
  }
  bindFields(c); bindExtra(c);
  if (kindOf(c) === 'visual') {
    for (const p of KF_PROPS) {
      num('k_' + p, el => setProp(c, p, +el.value));
      $('#b_' + p).onclick = () => { commit(); toggleKf(c, p); refreshAll(); };
    }
    $('#kfAll').onclick = insertKfAll;
    $('#kfPrev').onclick = () => jumpKf(c, -1); $('#kfNext').onclick = () => jumpKf(c, 1);
    setupEase(c);
  }
  updateKfButtons();
}
const TEXT_PRESETS = {
  altyazi: { font: 'Segoe UI', size: 70, bold: true, italic: false, upper: false, color: '#ffffff', grad: false, strokeW: 0, bg: true, bgColor: '#000000', bgOp: 0.65, bgPad: 22, bgRad: 14, glow: false, shadow: false },
  baslik: { font: 'Impact', size: 150, bold: false, upper: true, color: '#ffffff', grad: false, stroke: '#000000', strokeW: 10, bg: false, glow: false, shadow: true, shColor: '#000000', shBlur: 0, shX: 10, shY: 10 },
  neon: { font: 'Segoe UI', size: 120, bold: true, upper: false, color: '#ffffff', grad: false, strokeW: 0, bg: false, glow: true, glowColor: '#00e5ff', glowBlur: 45, shadow: false },
  altin: { font: 'Georgia', size: 130, bold: true, color: '#fff3b0', grad: true, color2: '#d18b00', stroke: '#3a2400', strokeW: 5, bg: false, glow: false, shadow: true, shColor: '#000000', shBlur: 20, shX: 0, shY: 10 },
  etiket: { font: 'Segoe UI', size: 80, bold: true, upper: true, color: '#111111', grad: false, strokeW: 0, bg: true, bgColor: '#ffcc33', bgOp: 1, bgPad: 26, bgRad: 40, glow: false, shadow: false }
};
const TEXT_GROUPS = [
  ['Yazı', [['font', 'Font', 'font'], ['size', 'Boyut', 'num', 1], ['bold', 'Kalın', 'chk'], ['italic', 'İtalik', 'chk'], ['upper', 'BÜYÜK HARF', 'chk'],
    ['align', 'Hizalama', 'sel', [['left', 'Sol'], ['center', 'Orta'], ['right', 'Sağ']]], ['ls', 'Harf aralığı', 'num', 1], ['lh', 'Satır aralığı', 'num', 0.05], ['boxW', 'Kutu genişliği (0 = otomatik)', 'num', 10], ['sx', 'Yatay ölçek (en)', 'range', [0.3, 2]]]],
  ['Renk', [['color', 'Renk', 'color'], ['grad', 'Gradyan', 'chk'], ['color2', 'Alt renk', 'color']]],
  ['Çerçeve (kontur)', [['stroke', 'Renk', 'color'], ['strokeW', 'Kalınlık', 'num', 1]]],
  ['Arka plan', [['bg', 'Açık', 'chk'], ['bgColor', 'Renk', 'color'], ['bgOp', 'Opaklık', 'range'], ['bgPad', 'Boşluk', 'num', 1], ['bgRad', 'Köşe yuvarlak', 'num', 1]]],
  ['Işık (glow)', [['glow', 'Açık', 'chk'], ['glowColor', 'Renk', 'color'], ['glowBlur', 'Yayılma', 'num', 1]]],
  ['Gölge', [['shadow', 'Açık', 'chk'], ['shColor', 'Renk', 'color'], ['shBlur', 'Bulanıklık', 'num', 1], ['shX', 'X kayma', 'num', 1], ['shY', 'Y kayma', 'num', 1]]],
  ['Animasyon', [['tw', 'Daktilo (sn)', 'num', 0.1]]]
];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function fieldHTML(c, [k, label, type, extra]) {
  const v = (c.kf && c.kf[k] && c.kf[k].length) ? +(+val(c, k, clamp(time - c.start, 0, c.dur))).toFixed(4) : (c.p[k] ?? TEXT_DEF[k] ?? ANY_DEF[k]); let inp;
  if (type === 'chk') inp = `<input data-k="${k}" data-t="chk" type="checkbox" ${v ? 'checked' : ''} style="width:auto">`;
  else if (type === 'color') inp = `<input data-k="${k}" data-t="str" type="color" value="${v}">`;
  else if (type === 'range') inp = `<input data-k="${k}" data-t="num" type="range" min="${extra ? extra[0] : 0}" max="${extra ? extra[1] : 1}" step="0.01" value="${v}">`;
  else if (type === 'sel') inp = `<select data-k="${k}" data-t="str">${extra.map(([o, n]) => `<option value="${o}" ${o === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
  else if (type === 'font') inp = `<input id="f_font" data-k="${k}" data-t="str" list="fontList" value="${esc(v)}">`;
  else inp = `<input data-k="${k}" data-t="num" type="number" step="${extra || 1}" value="${v}">`;
  return `<div class="row"><label>${label}</label>${inp}<span></span></div>`;
}
function textInspHTML(c) {
  let h = `<div class="grp"><h4>Metin</h4><textarea id="i_text" rows="3"></textarea>
    <div class="row" style="margin-top:6px"><label>Hazır stil</label><select id="i_preset"><option value="">Seç…</option><option value="altyazi">Altyazı</option><option value="baslik">Başlık</option><option value="neon">Neon</option><option value="altin">Altın</option><option value="etiket">Etiket</option></select><span></span></div></div>`;
  for (const [title, fs] of TEXT_GROUPS) h += `<div class="grp"><h4>${title}</h4>${fs.map(f => fieldHTML(c, f)).join('')}</div>`;
  return h;
}
function bindFields(c) {
  document.querySelectorAll('#inspBody [data-k]').forEach(el => {
    const k = el.dataset.k, t = el.dataset.t;
    const get = () => t === 'chk' ? el.checked : t === 'num' ? (+el.value || 0) : el.value;
    const apply = () => { if (!el._c) { commit(); el._c = true; } if (c.kf && c.kf[k] && c.kf[k].length) setKf(c, k, clamp(time - c.start, 0, c.dur), get()); else c.p[k] = get(); dirty = true; draw(); };
    if (t === 'chk' || el.tagName === 'SELECT') el.onchange = () => { apply(); el._c = false; refreshAll(); };
    else { el.oninput = apply; el.onchange = () => { el._c = false; renderTL(); }; }
  });
}
let fontsLoaded = false;
async function loadSystemFonts() {
  if (fontsLoaded || !window.queryLocalFonts) return; fontsLoaded = true;
  try { const fs = await window.queryLocalFonts(); const fam = [...new Set(fs.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'tr')); $('#fontList').innerHTML = fam.map(f => `<option value="${esc(f)}">`).join(''); } catch (e) { fontsLoaded = false; }
}
function insertKfAll() {
  const f = sel && findClip(sel); if (!f || kindOf(f.clip) !== 'visual') return status('Önce görsel/metin klip seç');
  const c = f.clip; if (time < c.start || time > c.start + c.dur) return status('Playhead klibin üstünde değil');
  commit(); const lt = clamp(time - c.start, 0, c.dur); KF_PROPS.forEach(p => setKf(c, p, lt, val(c, p, lt))); refreshAll();
  status('Keyframe eklendi'); setTimeout(() => status(''), 1000);
}
function toggleKf(c, p) {
  const lt = clamp(time - c.start, 0, c.dur); c.kf = c.kf || {}; const a = c.kf[p] || [];
  const i = a.findIndex(k => Math.abs(k.t - lt) < EPS);
  if (i >= 0) { const v = val(c, p, lt); a.splice(i, 1); if (!a.length) c.p[p] = v; }
  else setKf(c, p, lt, val(c, p, lt));
}
function kfsAt(c) { const lt = time - c.start; const out = []; for (const p in (c.kf || {})) for (const k of c.kf[p]) if (Math.abs(k.t - lt) < EPS) out.push(k); return out; }
function jumpKf(c, dir) {
  const ts = [...new Set(Object.values(c.kf || {}).flat().map(k => c.start + k.t))].sort((a, b) => a - b);
  const t = dir > 0 ? ts.find(x => x > time + EPS) : ts.reverse().find(x => x < time - EPS);
  if (t != null) { setTime(t); refreshInsp(); }
}
function updateKfButtons() {
  const f = sel && findClip(sel); if (!f) return; const c = f.clip; const lt = time - c.start;
  for (const p of KF_PROPS) {
    const b = $('#b_' + p); if (!b) continue; const a = (c.kf || {})[p] || [];
    b.classList.toggle('on', a.some(k => Math.abs(k.t - lt) < EPS)); b.style.opacity = a.length ? 1 : .5;
    const inp = $('#k_' + p); if (inp && document.activeElement !== inp) inp.value = +val(c, p, clamp(lt, 0, c.dur)).toFixed(3);
  }
  const g = $('#easeGrp'); if (g) { const ks = kfsAt(c); g.style.opacity = ks.length ? 1 : .35; g.style.pointerEvents = ks.length ? 'auto' : 'none'; if (ks.length) loadEase(ks[0].e); }
}
let bezCur = null;
function loadEase(e) {
  const n = $('#e_n'); if (!n) return; n.value = e.n || 'linear';
  bezCur = (e.b || PRESETS[e.n] || PRESETS.linear).slice(); $('#e_b').value = bezCur.map(v => +v.toFixed(3)).join(', '); drawBez(e.n === 'hold');
}
function applyEase(c, e) { for (const k of kfsAt(c)) k.e = JSON.parse(JSON.stringify(e)); dirty = true; draw(); }
function setupEase(c) {
  const n = $('#e_n'), bi = $('#e_b'), bc = $('#bez');
  n.onchange = () => { commit(); const v = n.value; const e = v === 'hold' ? { n: 'hold' } : { n: v, b: (v === 'bezier' ? bezCur : PRESETS[v]).slice() }; applyEase(c, e); loadEase(e); };
  bi.onchange = () => { const a = bi.value.split(',').map(Number); if (a.length === 4 && a.every(isFinite)) { commit(); a[0] = clamp(a[0], 0, 1); a[2] = clamp(a[2], 0, 1); const e = { n: 'bezier', b: a }; applyEase(c, e); loadEase(e); } };
  const toUnit = ev => { const r = bc.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width * 520, y = (ev.clientY - r.top) / r.height * 300; return [clamp((x - 30) / 460, 0, 1), (270 - y) / 180]; };
  bc.onmousedown = ev => {
    const [ux, uy0] = toUnit(ev); const uy = uy0 * 1;
    const d1 = Math.hypot(ux - bezCur[0], (uy - bezCur[1]) * .6), d2 = Math.hypot(ux - bezCur[2], (uy - bezCur[3]) * .6);
    const which = d1 < d2 ? 0 : 2; commit();
    const mv = e2 => { const [a, b] = toUnit(e2); bezCur[which] = +a.toFixed(3); bezCur[which + 1] = +clamp(b, -0.5, 1.5).toFixed(3); const e = { n: 'bezier', b: bezCur.slice() }; applyEase(c, e); n.value = 'bezier'; bi.value = bezCur.join(', '); drawBez(false); };
    mv(ev); const up = () => { removeEventListener('mousemove', mv); removeEventListener('mouseup', up); }; addEventListener('mousemove', mv); addEventListener('mouseup', up);
  };
}
function drawBez(hold) {
  const bc = $('#bez'); if (!bc) return; const g = bc.getContext('2d'); g.clearRect(0, 0, 520, 300);
  const X = u => 30 + u * 460, Y = v => 270 - v * 180;
  g.strokeStyle = '#2e2e36'; g.lineWidth = 1; g.strokeRect(X(0), Y(1), 460, 180);
  g.strokeStyle = '#ffcc33'; g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 100; i++) { const x = i / 100; const y = hold ? (x < 1 ? 0 : 1) : bezier(bezCur, x); i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); } g.stroke();
  if (hold) return;
  g.strokeStyle = '#6c8cff'; g.lineWidth = 2;
  [[0, 0, bezCur[0], bezCur[1]], [1, 1, bezCur[2], bezCur[3]]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(X(a), Y(b)); g.lineTo(X(c2), Y(d)); g.stroke(); g.fillStyle = '#6c8cff'; g.beginPath(); g.arc(X(c2), Y(d), 9, 0, 7); g.fill(); });
}

// ---------- Save / load ----------
function refreshAll() { if (typeof applyFormat === 'function') applyFormat(); cleanTracksSoft(); renderTL(); refreshInsp(); if (!playing) syncEls(false); draw(); }
function cleanTracksSoft() { gcEls(); if (typeof syncLayers === 'function') syncLayers(); }
function status(s) { $('#status').textContent = s; }
// ---- Projeler ----
let curId = null, curName = '';
function makeThumb() {
  const th = Math.round(270 * H / W); const c = document.createElement('canvas'); c.width = 270; c.height = th; const g = c.getContext('2d');
  const o = document.createElement('canvas'); o.width = W; o.height = H; renderAt(time, o.getContext('2d'));
  g.drawImage(o, 0, 0, 270, th); return c.toDataURL('image/jpeg', 0.75);
}
async function defaultName() { const l = await window.api.projList(); let n = l.length + 1; while (l.some(p => p.name === 'Proje ' + n)) n++; return 'Proje ' + n; }
async function saveProject(name) {
  if (playing) pause();
  if (!curId) curId = uid();
  curName = (name || curName || '').trim() || await defaultName(); $('#projName').value = curName;
  await window.api.projSave({ id: curId, name: curName, time, thumb: makeThumb(), proj });
  dirty = false; status('Kaydedildi ✓'); setTimeout(() => status(''), 1500);
}
function dialog({ title, text = '', input = null, buttons, html = '', wide = false }) {
  return new Promise(res => {
    const D = $('#dlg'); D.querySelector('.dtitle').textContent = title; D.querySelector('.dtext').textContent = text;
    let X = D.querySelector('.dextra'); if (!X) { X = document.createElement('div'); X.className = 'dextra'; D.querySelector('.dtext').after(X); }
    X.innerHTML = html; X.style.display = html ? '' : 'none'; D.querySelector('.dbox').classList.toggle('wide', wide);
    const inp = D.querySelector('.dinput'); inp.style.display = input === null ? 'none' : ''; inp.value = input || '';
    const B = D.querySelector('.dbtns'); B.innerHTML = '';
    const done = v => { D.classList.add('hidden'); D.onkeydown = null; res({ v, text: inp.value }); };
    buttons.forEach(b => { const el = document.createElement('button'); el.textContent = b.label; if (b.cls) el.className = b.cls; el.onclick = () => done(b.v); B.appendChild(el); });
    D.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') done('cancel'); if (e.key === 'Enter') { const p = buttons.find(b => b.cls === 'primary'); if (p) done(p.v); } };
    D.classList.remove('hidden'); setTimeout(() => (input !== null ? (inp.focus(), inp.select()) : B.querySelector('.primary')?.focus()), 0);
  });
}
// true => devam edilebilir
async function askSave() {
  if (playing) pause();
  const r = await dialog({ title: 'Değişiklikler kaydedilsin mi?', text: curName ? `“${curName}” projesi` : 'Bu proje henüz kaydedilmedi.', buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Kaydetme', v: 'no' }, { label: 'Kaydet', v: 'yes', cls: 'primary' }] });
  if (r.v === 'cancel') return false;
  if (r.v === 'no') return true;
  const n = await dialog({ title: 'Projeyi kaydet', text: 'Proje adı:', input: curName || await defaultName(), buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Kaydet', v: 'ok', cls: 'primary' }] });
  if (n.v === 'cancel') return false;
  await saveProject(n.text); return true;
}
const inEditor = () => $('#home').classList.contains('hidden');
async function showHome() {
  if (playing) pause(); closeAddMenu();
  $('#home').classList.remove('hidden');
  const G = $('#projGrid'); const list = await window.api.projList(); G.innerHTML = '';
  if (!list.length) G.innerHTML = '<div class="hempty">Henüz proje yok. Aşağıdan yeni bir proje oluştur.</div>';
  for (const p of list) {
    const d = document.createElement('div'); d.className = 'pc';
    d.innerHTML = `<div class="pt">${p.thumb ? `<img src="${p.thumb}">` : ''}</div><div class="pn"></div><div class="pd"></div><button class="px" title="Sil">×</button><button class="pbk" title="Yedekler (önceki halleri)">⟲</button>`;
    d.querySelector('.pn').textContent = p.name; d.querySelector('.pd').textContent = new Date(p.updated).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    d.onclick = () => openProject(p.id);
    d.querySelector('.px').onclick = async e => { e.stopPropagation(); const r = await dialog({ title: 'Proje silinsin mi?', text: `“${p.name}” kalıcı olarak silinecek.`, buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Sil', v: 'del', cls: 'primary' }] }); if (r.v === 'del') { await window.api.projDelete(p.id); showHome(); } };
    d.querySelector('.pbk').onclick = e => { e.stopPropagation(); projBackupsDlg(p); };
    G.appendChild(d);
  }
}
async function projBackupsDlg(p) {
  const list = await window.api.projBackups(p.id);
  const fmtD = t => new Date(t).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
  const html = list.length ? `<div class="bklist">${list.map((b, i) => `<div class="bkrow"><span>${fmtD(b.time)}</span><span class="bkn">${b.clips} klip</span><button data-i="${i}">Geri yükle</button></div>`).join('')}</div>`
    : '<div class="hint2">Bu projenin henüz yedeği yok. Her kaydedişte önceki hali otomatik saklanır (en sık 2 dakikada bir, son 30 yedek).</div>';
  const pr = dialog({ title: `“${p.name}” yedekleri`, html, wide: true, buttons: [{ label: 'Kapat', v: 'x', cls: 'ghost' }] });
  $('#dlg .dextra').querySelectorAll('.bkrow button').forEach(b => b.onclick = async () => {
    const bk = list[+b.dataset.i];
    const ok = await window.api.projRestore(p.id, bk.file);
    $('#dlg .dbtns button')?.click(); await pr;
    if (ok) { status(`Proje ${fmtD(bk.time)} haline döndü (mevcut hali de yedeklendi)`); setTimeout(() => status(''), 4000); }
    showHome();
  });
  await pr;
}
function enterEditor() { $('#home').classList.add('hidden'); fitCanvas(); renderTL(); }
async function openProject(id) {
  const d = await window.api.projLoad(id); if (!d) return;
  curId = d.id; curName = d.name; $('#projName').value = curName;
  await loadProjectData(d.proj); enterEditor(); setTime(d.time || 0); dirty = false;
}
function newProjectStart() {
  mediaReset();
  proj = newProject(); curId = null; curName = ''; $('#projName').value = ''; dirty = false; sel = null; time = 0; undoS.length = redoS.length = 0;
  enterEditor(); refreshAll();
}
$('#bCreate').onclick = newProjectStart;
$('#bHome').onclick = async () => { if (await askSave()) showHome(); };
$('#projName').onchange = e => { curName = e.target.value.trim(); dirty = true; };
$('#projName').onkeydown = e => { if (e.key === 'Enter') e.target.blur(); };
window.api.onCloseReq(async () => { if (exporting) return; if (!inEditor() || await askSave()) window.api.quit(); });
async function loadProjectData(data) {
  proj = data; if (!proj.fmt) proj.fmt = { w: 1080, h: 1920, fps: 30 }; sel = null; undoS.length = redoS.length = 0;
  for (const m of Object.values(proj.media || {})) if (!library.find(x => x.id === m.id)) library.push(m);
  mediaReset(); time = 0; refreshAll(); renderLib();
}
setInterval(() => { if (dirty && inEditor() && !(typeof coverCtx !== 'undefined' && coverCtx)) window.api.autoSave({ proj, curId, curName }); }, 15000);

// ---------- Export ----------
let exporting = false, cancelExp = false;
async function exportVideo() {
  const D = duration(); if (D <= 0) return status('Zaman çizelgesi boş');
  if (playing) pause();
  const opt = await exportDialog(); if (!opt) return;
  const audio = audioList(false);
  const ow = Math.round(W * opt.scale / 2) * 2, oh = Math.round(H * opt.scale / 2) * 2;
  const out = await window.api.expStart({ w: ow, h: oh, fps: FPS, duration: D, audio, crf: opt.crf }); if (!out) return;
  exporting = true; cancelExp = false; $('#mCancel').onclick = () => { cancelExp = true; }; $('#modal').classList.remove('hidden');
  const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh; const ox = oc.getContext('2d', { willReadFrequently: true });
  const N = Math.ceil(D * FPS);
  audStop(); expH = oh;
  for (let f = 0; f < N && !cancelExp; f++) {
    const t = f / FPS;
    expT = t;
    await Promise.all(allClips().filter(c => c.type === 'video' && active(c, t)).map(c => { const idx = vfIdx(c, srcT(c, t - c.start)); return vfRequest(c, idx, true, expH).then(b => { const s = vfState(vfKey(c, true)); if (b) { s.last = b; s.lastIdx = idx; } }); }));
    renderAt(t, ox, false, ow / W);
    const ok = await window.api.expFrame(ox.getImageData(0, 0, ow, oh).data.buffer);
    if (!ok) break;
    if (f % 3 === 0) { $('#mText').textContent = `Dışa aktarılıyor… ${f}/${N} kare`; $('#mBar').style.width = (f / N * 100) + '%'; }
  }
  if (cancelExp) { await window.api.expCancel(); finishExp(); status('İptal edildi'); } else { $('#mText').textContent = 'Kodlama bitiriliyor…'; await window.api.expEnd(); }
}
function finishExp() { exporting = false; for (const [key, s] of [...vf]) if (key.endsWith(':x')) { for (const b of s.frames.values()) b.close?.(); vf.delete(key); window.api.vidClose(key); } $('#modal').classList.add('hidden'); draw(); }
window.api.onExpDone(d => { if (!exporting) return; finishExp(); status(d.code === 0 ? 'Bitti: ' + d.file : 'Hata (kod ' + d.code + ')'); if (d.code !== 0 && !cancelExp) console.error(d.log); });

// ---------- Wiring ----------
$('#bPlay').onclick = play; $('#bStart').onclick = () => { if (playing) pause(); setTime(0); };
$('#bText').onclick = addText; $('#bUndo').onclick = undo; $('#bRedo').onclick = redo;
$('#bSave').onclick = () => saveProject(); $('#bExport').onclick = exportVideo;
async function shiftA(kind) { const ps = await window.api.pickMedia(kind); if (!ps.length) return; const ms = await importPaths(ps); commit(); let s = time; for (const m of ms) { const c = addMediaClip(m, s); s += c.dur; } refreshAll(); }
$('#bImport').onclick = async () => { const ps = await window.api.pickMedia(); if (ps.length) await importPaths(ps, { place: true }); };
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', async e => { e.preventDefault(); if (e.target.closest('.track')) return; const fs = [...e.dataTransfer.files]; if (fs.length) await importPaths(fs.map(f => window.api.pathOf(f)), { place: true }); });
document.addEventListener('keydown', e => {
  if (exporting || !inEditor() || !$('#dlg').classList.contains('hidden')) return;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
  const k = String(e.key || "").toLowerCase(); if (!k) return;
  if (e.ctrlKey && k === 's') { e.preventDefault(); return saveProject(); }
  if (typing) { if (e.key === 'Escape') document.activeElement.blur(); return; }
  if (addMenuOpen()) return;
  if (e.ctrlKey && k === 'z' && !e.shiftKey) { e.preventDefault(); return undo(); }
  if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return redo(); }
  if (e.ctrlKey && e.code === 'KeyA') { e.preventDefault(); return selectAll(); }
  if (e.ctrlKey && e.code === 'KeyC') { e.preventDefault(); return copySel(); }
  if (e.ctrlKey && e.code === 'KeyV') { e.preventDefault(); return pasteClips(time); }
  if (e.ctrlKey && e.code === 'KeyD') { e.preventDefault(); return duplicateSel(); }
  if (e.ctrlKey) return;
  if (e.key === '?' || e.key === 'F1') { e.preventDefault(); return showShortcuts(); }
  if (e.key === 'Tab') { e.preventDefault(); return toggleGraph(); }
  if (e.shiftKey && (e.code === 'KeyA' || k === 'a')) { e.preventDefault(); return openAddMenu(mouseX, mouseY); }
  if (k === 'x' || e.key === 'Delete') { e.preventDefault(); if (graphDeleteSel()) return; return deleteSel(); }
  if (e.code === 'KeyM' && !e.shiftKey) { e.preventDefault(); return toggleMagnet(); }
  if (k === 'k') { e.preventDefault(); return cut(); }
  if (k === 't') { e.preventDefault(); return addText(); }
  if (k === 'i') { e.preventDefault(); return insertKfAll(); }
  if (e.key === ' ') { e.preventDefault(); return play(); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); if (playing) pause(); return setTime(time - (e.shiftKey ? 1 : 1 / FPS)); }
  if (e.key === 'ArrowRight') { e.preventDefault(); if (playing) pause(); return setTime(time + (e.shiftKey ? 1 : 1 / FPS)); }
  if (e.key === 'Home') { if (playing) pause(); return setTime(0); }
  if (e.key === 'Escape') { sel = null; refreshAll(); }
});
new ResizeObserver(() => renderTL()).observe(tlScroll);
// ---- Zaman çubuğu (Blender tarzı kaydırma/yakınlaştırma) ----
const nav = $('#tlNav'), thumb = $('#navThumb');
function contentSec() { return Math.max(duration() + 10, tlScroll.clientWidth / pps); }
function updateNav() {
  const tot = contentSec() * pps, nw = nav.clientWidth, vw = tlScroll.clientWidth;
  const w = Math.max(24, Math.min(nw, vw / tot * nw)), l = Math.min(nw - w, tlScroll.scrollLeft / tot * nw);
  thumb.style.left = l + 'px'; thumb.style.width = w + 'px';
}
tlScroll.addEventListener('scroll', updateNav);
function setView(t0, t1) { const vw = tlScroll.clientWidth; t1 = Math.max(t1, t0 + 0.2); pps = clamp(vw / (t1 - t0), 5, 600); renderTL(); tlScroll.scrollLeft = t0 * pps; updateNav(); }
thumb.onmousedown = e => {
  e.preventDefault(); e.stopPropagation();
  const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'm';
  const nw = nav.clientWidth, cs = contentSec(), x0 = e.clientX, sl0 = tlScroll.scrollLeft;
  const vt0 = tlScroll.scrollLeft / pps, vt1 = vt0 + tlScroll.clientWidth / pps; thumb.classList.add('on');
  const mv = ev => {
    const dt = (ev.clientX - x0) / nw * cs;
    if (mode === 'm') { tlScroll.scrollLeft = sl0 + (ev.clientX - x0) / nw * cs * pps; }
    else if (mode === 'l') setView(clamp(vt0 + dt, 0, vt1 - 0.2), vt1);
    else setView(vt0, Math.max(vt0 + 0.2, vt1 + dt));
  };
  const up = () => { thumb.classList.remove('on'); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
};
nav.onmousedown = e => { if (e.target !== nav) return; const r = nav.getBoundingClientRect(); const t = (e.clientX - r.left) / r.width * contentSec(); tlScroll.scrollLeft = t * pps - tlScroll.clientWidth / 2; };
nav.ondblclick = () => setView(0, Math.max(duration(), 1) * 1.02);
// ---- Canvas fit ----
const stage = $('#stage');
function fitCanvas() {
  const r = stage.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  const cw = Math.max(10, Math.round(r.width * dpr)), ch = Math.max(10, Math.round(r.height * dpr));
  cv.width = cw; cv.height = ch;
  const s = Math.min(cw * 0.62 / W, ch * 0.86 / H); VIEW = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2 }; draw();
}
new ResizeObserver(fitCanvas).observe(stage);
// ---- Splitters ----
const LIM = { lw: [140, 600], rw: [200, 650], tlh: [120, 700] };
function setSize(k, v) { v = clamp(v, ...LIM[k]); if (k !== 'tlh') v = Math.min(v, innerWidth - 400 - (k === 'lw' ? sizes.rw : sizes.lw)); else v = Math.min(v, Math.max(120, innerHeight * 0.6)); sizes[k] = v; document.documentElement.style.setProperty('--' + k, v + 'px'); }
let sizes = { lw: 240, rw: 290, tlh: 280 }; try { Object.assign(sizes, JSON.parse(localStorage.getItem('sizes') || '{}')); } catch { }
const applySizes = () => ['lw', 'rw', 'tlh'].forEach(k => setSize(k, sizes[k])); applySizes();
addEventListener('resize', () => { const m = { lw: 140, rw: 200 }; const over = sizes.lw + sizes.rw + 400 - innerWidth; if (over > 0) { const f = Math.max(0, (sizes.lw + sizes.rw - over)) / (sizes.lw + sizes.rw); sizes.lw = Math.max(m.lw, sizes.lw * f); sizes.rw = Math.max(m.rw, sizes.rw * f); } applySizes(); });
document.querySelectorAll('.split').forEach(sp => sp.onmousedown = e => {
  e.preventDefault(); const k = sp.dataset.k, x0 = e.clientX, y0 = e.clientY, v0 = sizes[k]; sp.classList.add('on');
  const mv = ev => { const d = k === 'lw' ? ev.clientX - x0 : k === 'rw' ? x0 - ev.clientX : y0 - ev.clientY; setSize(k, v0 + d); };
  const up = () => { sp.classList.remove('on'); removeEventListener('mousemove', mv); removeEventListener('mouseup', up); try { localStorage.setItem('sizes', JSON.stringify(sizes)); } catch { } };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
});
// ---- Ekle menüsü ----
// ---- Blender tarzı Ekle menüsü (Shift+A) ----
let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; }, true);
// input dışına tıklanınca odağı bırak (kısayollar çalışsın)
addEventListener('mousedown', e => { const ae = document.activeElement; if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) && !e.target.closest('input,textarea,select')) ae.blur(); }, true);
function selVisual() { const f = sel && findClip(sel); return f && kindOf(f.clip) === 'visual' ? f.clip : null; }
function applyTr(which, type) { const c = selVisual(); if (!c) return status('Önce görsel/metin klip seç'); commit(); c.p[which] = type; if (!c.p[which + 'D']) c.p[which + 'D'] = 0.5; refreshAll(); status('Geçiş uygulandı'); setTimeout(() => status(''), 1200); }
function addTextPreset(k) { addText(); const c = findClip(sel).clip; if (k) Object.assign(c.p, JSON.parse(JSON.stringify(TEXT_PRESETS[k]))); refreshAll(); }
function menuItems() {
  return [
    { icon: '▣', label: 'Video', act: () => shiftA('video') },
    { icon: '♪', label: 'Ses', act: () => shiftA('audio') },
    { icon: '▨', label: 'Görsel', act: () => shiftA('image') },
    { icon: '𝐓', label: 'Metin', sub: [{ icon: '𝐓', label: 'Düz metin', act: () => addTextPreset() }, { sep: 1 },
      ...[['altyazi', 'Altyazı'], ['baslik', 'Başlık'], ['neon', 'Neon'], ['altin', 'Altın'], ['etiket', 'Etiket']].map(([k, n]) => ({ icon: '𝐓', label: n, act: () => addTextPreset(k) }))] },
    ...extraMenuItems(),
    { sep: 1 },
    { icon: '⧉', label: 'Dolaptan', sub: library.length ? library.slice(0, 40).map(m => ({ icon: m.kind === 'audio' ? '♪' : m.kind === 'image' ? '▨' : '▣', label: m.name, act: () => { commit(); addMediaClip(m, time); refreshAll(); } })) : [{ label: '(dolap boş)', disabled: 1 }] },
    { sep: 1 },
    { icon: '⇥', label: 'Giriş geçişi', sub: TRANSITIONS.map(([k, n]) => ({ icon: TR_ICON[k] || '∅', label: n, act: () => applyTr('trIn', k) })) },
    { icon: '⇤', label: 'Çıkış geçişi', sub: TRANSITIONS.map(([k, n]) => ({ icon: TR_ICON[k] || '∅', label: n, act: () => applyTr('trOut', k) })) },
    { sep: 1 },
    { icon: '◆', label: 'Keyframe', key: 'I', act: insertKfAll }
  ];
}
let menuRoot = null;
const addMenuOpen = () => !!menuRoot;
function closeAddMenu() { if (menuRoot) { menuRoot.remove(); menuRoot = null; } }
function placeMenu(el, x, y) { document.body.appendChild(el); const r = el.getBoundingClientRect(); el.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px'; el.style.top = clamp(y, 4, innerHeight - r.height - 4) + 'px'; }
function buildList(items, host, depth) {
  host.innerHTML = '';
  for (const it of items) {
    if (it.sep) { const s = document.createElement('div'); s.className = 'bsep'; host.appendChild(s); continue; }
    const d = document.createElement('div'); d.className = 'bi' + (it.disabled ? ' dis' : '');
    d.innerHTML = `<span class="bic"></span><span class="bl"></span>${it.sub ? '<span class="ba">▸</span>' : it.key ? `<span class="bk">${it.key}</span>` : ''}`;
    d.querySelector('.bic').textContent = it.icon || ''; d.querySelector('.bl').textContent = it.label;
    d.onmouseenter = () => {
      host.querySelectorAll('.bi.on').forEach(x => x.classList.remove('on')); d.classList.add('on');
      menuRoot.querySelectorAll('.bmenu.sub').forEach(s => { if (+s.dataset.depth > depth) s.remove(); });
      if (it.sub) {
        const sm = document.createElement('div'); sm.className = 'bmenu sub'; sm.dataset.depth = depth + 1; menuRoot.appendChild(sm);
        const lst = document.createElement('div'); sm.appendChild(lst); buildList(it.sub, lst, depth + 1);
        const r = d.getBoundingClientRect(); sm.style.left = r.right + 'px'; sm.style.top = (r.top - 5) + 'px';
        const sr = sm.getBoundingClientRect();
        if (sr.right > innerWidth) sm.style.left = (r.left - sr.width) + 'px';
        if (sr.bottom > innerHeight) sm.style.top = Math.max(4, innerHeight - sr.height - 4) + 'px';
      }
    };
    d.onmousedown = e => { e.preventDefault(); e.stopPropagation(); if (it.disabled || it.sub) return; closeAddMenu(); it.act(); };
    host.appendChild(d);
  }
}
function openAddMenu(x, y) {
  closeAddMenu(); if (playing) pause();
  menuRoot = document.createElement('div'); menuRoot.id = 'bmenuRoot';
  const m = document.createElement('div'); m.className = 'bmenu';
  m.innerHTML = '<div class="bt">Ekle</div><div class="bs"><span>⌕</span><input placeholder="Ara…" spellcheck="false"></div><div class="blist"></div>';
  menuRoot.appendChild(m); document.body.appendChild(menuRoot);
  const items = menuItems(), list = m.querySelector('.blist'), inp = m.querySelector('input');
  buildList(items, list, 0);
  const flat = []; const walk = (arr, path) => arr.forEach(it => { if (it.sep || it.disabled) return; if (it.sub) walk(it.sub, path.concat(it.label)); else flat.push({ ...it, label: path.length ? path.join(' ▸ ') + ' ▸ ' + it.label : it.label }); }); walk(items, []);
  inp.oninput = () => {
    menuRoot.querySelectorAll('.bmenu.sub').forEach(s => s.remove());
    const q = inp.value.trim().toLocaleLowerCase('tr');
    if (!q) return buildList(items, list, 0);
    const res = flat.filter(it => it.label.toLocaleLowerCase('tr').includes(q)).slice(0, 15);
    buildList(res.length ? res : [{ label: 'Sonuç yok', disabled: 1 }], list, 0);
    const first = list.querySelector('.bi'); if (first && res.length) first.classList.add('on');
  };
  inp.onkeydown = e => {
    e.stopPropagation();
    const its = [...list.querySelectorAll('.bi:not(.dis)')]; let i = its.findIndex(x => x.classList.contains('on'));
    if (e.key === 'Escape') { e.preventDefault(); return closeAddMenu(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); i = (i + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length; its.forEach(x => x.classList.remove('on')); its[i]?.classList.add('on'); its[i]?.onmouseenter(); }
    if (e.key === 'Enter') { e.preventDefault(); const t = its[i >= 0 ? i : 0]; if (t) t.onmousedown(new MouseEvent('mousedown')); }
  };
  // menüyü imleç ilk öğenin üstünde olacak şekilde aç (Blender gibi)
  m.style.left = '0px'; m.style.top = '0px';
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x - 40, 4, innerWidth - r.width - 4) + 'px'; m.style.top = clamp(y - 14, 4, innerHeight - r.height - 4) + 'px';
  setTimeout(() => inp.focus(), 0);
}
addEventListener('mousedown', e => { if (menuRoot && !e.target.closest('#bmenuRoot')) closeAddMenu(); });
addEventListener('keydown', e => { if (menuRoot && e.key === 'Escape') closeAddMenu(); });
addEventListener('blur', closeAddMenu);
$('#bAdd').onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); openAddMenu(r.left + 40, r.bottom + 18); };


