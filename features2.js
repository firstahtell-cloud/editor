// ===================== Ek özellikler (2) =====================
// 1) Kare dondurma  2) Video efektleri  3) Katmanlar  4) Döndürme tutamacı + metin kutusu genişliği  5) Netlik bloğu
function sizeCv(cv, w, h) { w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } }
const mkCv = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
function dragWin(mv, up) { const m = ev => mv(ev); const u = ev => { removeEventListener('mousemove', m); removeEventListener('mouseup', u); up(ev); }; addEventListener('mousemove', m); addEventListener('mouseup', u); }
Object.assign(ANY_DEF, { bri: 0, con: 0, sat: 0, temp: 0, tint: 0, fade: 0, vig: 0 });

// ---------- 3) Katman sırası ----------
// proj.layers: üstten alta klip id listesi. Yoksa iz (track) sırası kullanılır (eski davranış).
const visTracks = () => proj.tracks.filter(t => t.kind === 'visual');
function trIdx(c) { return visTracks().findIndex(t => t.clips.includes(c)); }
function layerInsert(list, c) { const ti = trIdx(c), i = list.findIndex(x => trIdx(x) > ti); if (i < 0) list.push(c); else list.splice(i, 0, c); }
function visualOrder() {
  const def = visTracks().flatMap(t => t.clips);
  if (!proj.layers || !proj.layers.length) return def;
  const byId = new Map(def.map(c => [c.id, c])), out = [], seen = new Set();
  for (const id of proj.layers) { const c = byId.get(id); if (c && !seen.has(c)) { out.push(c); seen.add(c); } }
  if (out.length !== def.length) for (const c of def) if (!seen.has(c)) layerInsert(out, c);
  return out;
}
function syncLayers() { if (proj.layers) proj.layers = visualOrder().map(c => c.id); }
const overlaps = (a, b) => a.start < b.start + b.dur - 1e-6 && b.start < a.start + a.dur - 1e-6;

// ---------- 2) Video efektleri ----------
const FX = [['fxBlur', 'Bulanıklık'], ['fxPix', 'Pikselleştir'], ['fxRgb', 'RGB kayması'], ['fxGlow', 'Parlama'], ['fxShake', 'Sarsıntı'], ['fxGrain', 'Film greni'], ['fxGlitch', 'Glitch']];
FX.forEach(([k]) => ANY_DEF[k] = 0);
function fxHTML(c) {
  return `<div class="grp"><h4>Efektler</h4>${FX.map(([k, n]) => fieldHTML(c, [k, n, 'range'])).join('')}
    <div class="row"><label></label><button id="i_fxreset">Efektleri sıfırla</button><span></span></div></div>`;
}
function fxBlurF(c, ks) { const b = +c.p.fxBlur || 0; return b > 0 ? ` blur(${(b * 40 * ks).toFixed(1)}px)` : ''; }
const smoothN = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return rnd(i, s) * (1 - u) + rnd(i + 1, s) * u - 0.5; };
function fxShake(c, lt, T) {
  const a = +c.p.fxShake || 0; if (!(a > 0)) return;
  const x = (c.start + lt) * 14;
  T.dx += smoothN(x, 1) * a * 70; T.dy += smoothN(x, 2) * a * 70; T.dr += smoothN(x, 3) * a * 5;
  if (c.type === 'video' || c.type === 'image') T.ds *= 1 + a * 0.14; // kenarlar görünmesin
}
const [fxP, fxPc] = mkCv(), [fxA, fxAc] = mkCv(), [fxB, fxBc] = mkCv(), [fxC, fxCc] = mkCv(), [fxT, fxTc] = mkCv();
let noiseCv = null;
function noisePat(g) {
  if (!noiseCv) {
    noiseCv = document.createElement('canvas'); noiseCv.width = noiseCv.height = 256;
    const x = noiseCv.getContext('2d'), id = x.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = (rnd(i, 7) * 255) | 0; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    x.putImageData(id, 0, 0);
  }
  return g.createPattern(noiseCv, 'repeat');
}
function drawMediaFx(g, c, src, dw, dh, t, kk) {
  const p = c.p, pix = +p.fxPix || 0, rgb0 = +p.fxRgb || 0, gl = +p.fxGlitch || 0, glow = +p.fxGlow || 0, grain = +p.fxGrain || 0;
  if (!(pix > 0 || rgb0 > 0 || gl > 0 || glow > 0 || grain > 0)) { g.drawImage(src, -dw / 2, -dh / 2, dw, dh); return; }
  const fr = Math.floor(t * FPS + 1e-6);
  const R = Math.min(1, 1440 / Math.max(1, dw * kk, dh * kk)), rw = Math.max(2, Math.round(dw * kk * R)), rh = Math.max(2, Math.round(dh * kk * R));
  let img = src, nearest = false;
  if (pix > 0) { // pikselleştir: küçült, sonra keskin büyüt
    const bs = 4 + pix * 56; sizeCv(fxP, Math.ceil(dw / bs), Math.ceil(dh / bs));
    fxPc.imageSmoothingEnabled = true; fxPc.clearRect(0, 0, fxP.width, fxP.height); fxPc.drawImage(src, 0, 0, fxP.width, fxP.height); img = fxP; nearest = true;
  }
  const seed = Math.floor(t * 12), burst = gl > 0 && rnd(seed, 1) < 0.2 + gl * 0.6;
  const rgb = Math.max(rgb0, burst ? gl * 0.6 : 0);
  if (burst || rgb > 0) {
    sizeCv(fxA, rw, rh); fxAc.imageSmoothingEnabled = !nearest; fxAc.clearRect(0, 0, rw, rh); fxAc.drawImage(img, 0, 0, rw, rh); img = fxA; nearest = false;
    if (burst) { // glitch: yatay şeritler kayar
      sizeCv(fxB, rw, rh); fxBc.clearRect(0, 0, rw, rh); fxBc.drawImage(fxA, 0, 0);
      const n = 2 + Math.floor(rnd(seed, 2) * 7 * gl);
      for (let i = 0; i < n; i++) { const y = rnd(seed, 10 + i) * rh, h = (0.015 + rnd(seed, 20 + i) * 0.1) * rh, dx = (rnd(seed, 30 + i) - 0.5) * gl * 0.3 * rw; fxBc.drawImage(fxA, 0, y, rw, h, dx, y, rw, h); }
      img = fxB;
    }
    if (rgb > 0) { // RGB kayması: kanalları ayrı ayrı kaydır
      const d = rgb * 0.03 * rw * (burst && rnd(seed, 3) < 0.5 ? -1 : 1);
      sizeCv(fxC, rw, rh); sizeCv(fxT, rw, rh); fxCc.clearRect(0, 0, rw, rh); fxCc.globalCompositeOperation = 'lighter';
      for (const [col, ox] of [['#ff0000', -d], ['#00ff00', 0], ['#0000ff', d]]) {
        fxTc.globalCompositeOperation = 'source-over'; fxTc.clearRect(0, 0, rw, rh); fxTc.drawImage(img, 0, 0);
        fxTc.globalCompositeOperation = 'multiply'; fxTc.fillStyle = col; fxTc.fillRect(0, 0, rw, rh);
        fxTc.globalCompositeOperation = 'destination-in'; fxTc.drawImage(img, 0, 0);
        fxCc.drawImage(fxT, ox, 0);
      }
      fxCc.globalCompositeOperation = 'source-over'; img = fxC;
    }
  }
  const sm = g.imageSmoothingEnabled; if (nearest) g.imageSmoothingEnabled = false;
  g.drawImage(img, -dw / 2, -dh / 2, dw, dh); g.imageSmoothingEnabled = sm;
  if (glow > 0) { // parlama: bulanık kopyayı ekran modunda üstüne bindir
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha *= Math.min(1, glow * 1.1);
    g.filter = ((g.filter && g.filter !== 'none' ? g.filter + ' ' : '') + `blur(${((8 + glow * 30) * kk).toFixed(1)}px) brightness(1.2)`).trim();
    if (nearest) g.imageSmoothingEnabled = false; g.drawImage(img, -dw / 2, -dh / 2, dw, dh); g.restore();
  }
  if (grain > 0) { // film greni
    g.save(); g.beginPath(); g.rect(-dw / 2, -dh / 2, dw, dh); g.clip(); g.filter = 'none';
    g.globalCompositeOperation = 'overlay'; g.globalAlpha *= Math.min(1, grain * 0.75);
    const pat = noisePat(g); pat.setTransform(new DOMMatrix().scale(1.6 / Math.max(0.01, kk)).translate(rnd(fr, 1) * 256, rnd(fr, 2) * 256));
    g.fillStyle = pat; g.fillRect(-dw / 2, -dh / 2, dw, dh); g.restore();
  }
}

// ---------- 5) Netlik bloğu ----------
const FOCUS_DEF = { shape: 'rect', w: 620, h: 420, rad: 40, fBlur: 0.5, feather: 0.25, dim: 0 };
const [fcA, fcAc] = mkCv(), [fcM, fcMc] = mkCv();
function focusPath(g, p) { if (p.shape === 'ellipse') { g.beginPath(); g.ellipse(0, 0, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); } else rrect(g, -p.w / 2, -p.h / 2, p.w, p.h, p.rad || 0); }
// Alttaki her şeyi, blokların dışında kalan yerlerde bulanıklaştırır (birden çok blok = birleşik net alan)
function applyFocus(c2, list, t, preview, ks) {
  const cw = c2.canvas.width, ch = c2.canvas.height; sizeCv(fcA, cw, ch); sizeCv(fcM, cw, ch);
  let strength = 0, dim = 0, blur = 0;
  fcMc.setTransform(1, 0, 0, 1, 0, 0); fcMc.clearRect(0, 0, cw, ch);
  for (const c of list) {
    const p = Object.assign({}, FOCUS_DEF, c.p), lt = t - c.start, g = geomOf(c, t), T = trState(c, lt);
    const a = clamp(g.o * fadeMul(c, lt) * T.alpha, 0, 1); if (a <= 0) continue;
    strength = Math.max(strength, a); dim = Math.max(dim, (+p.dim || 0)); blur = Math.max(blur, +p.fBlur || 0);
    if (preview) fcMc.setTransform(VIEW.s, 0, 0, VIEW.s, VIEW.ox, VIEW.oy); else fcMc.setTransform(ks, 0, 0, ks, 0, 0);
    fcMc.translate(W / 2 + g.x + T.dx, H / 2 + g.y + T.dy); fcMc.rotate((g.r + T.dr) * Math.PI / 180); fcMc.scale(g.s * T.ds, g.s * T.ds);
    const fe = (+p.feather || 0) * Math.min(p.w, p.h) * 0.35 * g.s * ks;
    fcMc.filter = fe > 0.5 ? `blur(${fe.toFixed(1)}px)` : 'none'; fcMc.fillStyle = '#fff'; focusPath(fcMc, p); fcMc.fill(); fcMc.filter = 'none';
  }
  if (strength <= 0.001) return;
  fcAc.setTransform(1, 0, 0, 1, 0, 0); fcAc.globalCompositeOperation = 'source-over'; fcAc.clearRect(0, 0, cw, ch);
  const bp = blur * 60 * ks; fcAc.filter = bp > 0.3 ? `blur(${bp.toFixed(1)}px)` : 'none'; fcAc.drawImage(c2.canvas, 0, 0); fcAc.filter = 'none';
  if (dim > 0) { fcAc.fillStyle = `rgba(0,0,0,${(dim * 0.85).toFixed(3)})`; fcAc.fillRect(0, 0, cw, ch); }
  fcAc.globalCompositeOperation = 'destination-out'; fcAc.drawImage(fcM, 0, 0); fcAc.globalCompositeOperation = 'source-over';
  c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalAlpha = strength; c2.filter = 'none'; c2.globalCompositeOperation = 'source-over';
  if (preview) { c2.beginPath(); c2.rect(VIEW.ox, VIEW.oy, W * VIEW.s, H * VIEW.s); c2.clip(); }
  c2.drawImage(fcA, 0, 0); c2.restore();
}
function addFocus() {
  commit();
  const c = { id: uid(), type: 'focus', name: 'Netlik bloğu', start: time, in: 0, dur: 3, p: Object.assign(baseP(), JSON.parse(JSON.stringify(FOCUS_DEF))), kf: {} };
  // medyanın hemen üstüne koy: üstteki metinler net kalsın
  const vis = visTracks(), mi = vis.findIndex(t => t.clips.some(x => (x.type === 'video' || x.type === 'image') && overlaps(x, c)));
  let tr = null;
  if (mi > 0) { const up = vis[mi - 1]; if (up.clips.every(x => x.type === 'focus') && !up.clips.some(x => overlaps(x, c))) tr = up; }
  if (!tr && mi >= 0) { tr = { id: uid(), kind: 'visual', clips: [] }; proj.tracks.splice(proj.tracks.indexOf(vis[mi]), 0, tr); }
  if (!tr) tr = trackFor('visual', c.start, c.dur);
  tr.clips.push(c); sel = c.id; refreshAll(); status('Netlik bloğu eklendi: dışı bulanık'); setTimeout(() => status(''), 2500);
}
function focusInspHTML(c) {
  return `<div class="grp"><h4>Netlik bloğu</h4>${fieldHTML(c, ['shape', 'Şekil', 'sel', [['rect', 'Dikdörtgen'], ['ellipse', 'Elips']]])}
    ${fieldHTML(c, ['w', 'Genişlik', 'num', 1])}${fieldHTML(c, ['h', 'Yükseklik', 'num', 1])}${fieldHTML(c, ['rad', 'Köşe yuvarlak', 'num', 1])}
    ${fieldHTML(c, ['fBlur', 'Dış bulanıklık', 'range'])}${fieldHTML(c, ['feather', 'Kenar yumuşaklığı', 'range'])}${fieldHTML(c, ['dim', 'Dışı karart', 'range'])}
    <div class="hint2">Birden fazla blok aynı anda olursa hepsinin içi net kalır. Katmanlarda bloğun üstündekiler bulanıklaşmaz.</div></div>`;
}

// ---------- 1) Kare dondurma ----------
function freezeHTML(c) {
  return `<div class="grp"><h4>Dondur</h4><div class="row"><label></label><button id="i_freeze">❄ Bu kareyi dondur (3 sn)</button><span></span></div>
    <div class="hint2">Playhead'deki kare 3 saniyelik fotoğraf olur, videonun kalanı sağa kayar. Fotoğrafı kenarından sürükleyip uzatabilirsin.</div></div>`;
}
async function freezeFrame(c) {
  const f = c && findClip(c.id); if (!f || c.type !== 'video') return status('Önce bir video klip seç');
  if (!active(c, time)) return status("Playhead videonun üzerinde olmalı");
  if (playing) pause();
  const m = mediaOf(c); if (!m) return;
  const t0 = time, lt = t0 - c.start, D = 3;
  const st = vfIdx(c, srcT(c, lt)) * vfSp(c) / FPS; // önizlemede görünen kareyle aynı
  status('Kare donduruluyor…');
  const pth = await window.api.vidStill({ p: m.path, t: st }); if (!pth) return status('Kare alınamadı');
  const [im] = await importPaths([pth], { quiet: true }); if (!im) return status('Kare alınamadı');
  if (!im.alias) { im.alias = `${c.name} · donmuş ${fmt(t0)}`; await saveLib(); }
  const skip = new Set(['speed', 'rev', 'volume', 'duck', 'duckLvl', 'trIn', 'trOut', 'trInD', 'trOutD', 'fadeIn', 'fadeOut']);
  const sp = {}; for (const [k, v] of Object.entries(c.p)) if (!skip.has(k)) sp[k] = JSON.parse(JSON.stringify(v));
  for (const k of new Set([...KF_PROPS, ...Object.keys(c.kf || {})])) sp[k] = val(c, k, lt);
  commit();
  const tr = f.track; let b = null;
  if (lt > EPS && lt < c.dur - EPS) b = splitClip(c, tr, t0);
  for (const x of tr.clips) if (x.start >= t0 - 1e-6) x.start += D; // sonrası kayar
  proj.media[im.id] = { id: im.id, path: im.path, name: im.name, alias: im.alias, kind: 'image', dur: im.dur, hasAudio: false };
  const s = { id: uid(), type: 'image', mediaId: im.id, name: im.alias, start: t0, in: 0, dur: D, p: sp, kf: {}, frozen: true };
  tr.clips.push(s);
  if (proj.layers) { const i = proj.layers.indexOf((b || c).id); if (i >= 0) proj.layers.splice(i, 0, s.id); }
  sel = s.id; refreshAll(); status('Kare donduruldu (3 sn)'); setTimeout(() => status(''), 2500);
}

// ---------- 4) Döndürme tutamacı, kenar tutamaçları ----------
const sideModes = c => c.type === 'text' ? ['l', 'r'] : (c.type === 'shape' || c.type === 'focus' || c.type === 'image' || c.type === 'video') ? ['l', 'r', 't', 'b'] : [];
const SIDE = { l: [-1, 0], r: [1, 0], t: [0, -1], b: [0, 1] };
const ROT_L = () => 46 / VIEW.s;
function drawHandles2(g, b, c) {
  const k = 1 / VIEW.s; g.setLineDash([]);
  if (c.type === 'focus' && (c.p.shape === 'ellipse')) { g.save(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5 * k; g.setLineDash([6 * k, 4 * k]); g.beginPath(); g.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); g.stroke(); g.restore(); }
  g.strokeStyle = '#6c8cff'; g.lineWidth = 2 * k;
  g.beginPath(); g.moveTo(0, -b.h / 2); g.lineTo(0, -b.h / 2 - ROT_L()); g.stroke();
  g.beginPath(); g.arc(0, -b.h / 2 - ROT_L(), 9 * k, 0, Math.PI * 2); g.fillStyle = '#6c8cff'; g.fill(); g.strokeStyle = '#fff'; g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 1.5 * k; g.beginPath(); g.arc(0, -b.h / 2 - ROT_L(), 4.5 * k, -2.3, 1.6); g.stroke();
  for (const s of sideModes(c)) {
    const [sx, sy] = SIDE[s], hw = (sx ? 7 : 18) * k, hh = (sx ? 18 : 7) * k;
    g.fillStyle = '#fff'; g.strokeStyle = '#6c8cff'; g.lineWidth = 2 * k; rrect(g, sx * b.w / 2 - hw / 2, sy * b.h / 2 - hh / 2, hw, hh, 3 * k); g.fill(); g.stroke();
  }
}
function localPt(b, px, py) { const a = -b.g.r * Math.PI / 180, dx = px - W / 2 - b.g.x, dy = py - H / 2 - b.g.y; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
function handleAt(cs, b, px, py) {
  const [lx, ly] = localPt(b, px, py), tol = 14 / VIEW.s;
  if (Math.hypot(lx, ly + b.h / 2 + ROT_L()) < tol) return 'rot';
  for (const s of sideModes(cs)) { const [sx, sy] = SIDE[s]; if (Math.hypot(lx - sx * b.w / 2, ly - sy * b.h / 2) < tol) return s; }
  return null;
}
function handleDown2(e) {
  const cs = sel && findClip(sel)?.clip; if (!cs || kindOf(cs) !== 'visual' || !active(cs, time)) return false;
  const b = boxOf(cs, time); if (!b) return false;
  const [px, py] = canvasPt(e), h = handleAt(cs, b, px, py); if (!h) return false;
  if (playing) pause();
  const before = JSON.stringify(proj), lt = time - cs.start, cx = W / 2 + b.g.x, cy = H / 2 + b.g.y; let moved = false;
  const done = () => { status(''); if (moved) { undoS.push(before); redoS.length = 0; dirty = true; refreshAll(); } };
  if (h === 'rot') {
    const r0 = val(cs, 'rotation', lt), a0 = Math.atan2(py - cy, px - cx);
    dragWin(ev => {
      const [qx, qy] = canvasPt(ev); let r = r0 + (Math.atan2(qy - cy, qx - cx) - a0) * 180 / Math.PI;
      if (ev.shiftKey) r = Math.round(r / 15) * 15; else { const s = Math.round(r / 90) * 90; if (Math.abs(r - s) < 3) r = s; }
      r = Math.round(r * 10) / 10; setProp(cs, 'rotation', r); moved = true; status(`Döndürme: ${r}° (Shift: 15° adım)`); draw();
    }, done);
    return true;
  }
  const g = b.g, [sx, sy] = SIDE[h], bw0 = b.w / (cs.p.msx ?? 1), bh0 = b.h / (cs.p.msy ?? 1);
  dragWin(ev => {
    const [qx, qy] = canvasPt(ev), [lx, ly] = localPt(b, qx, qy); moved = true;
    if (cs.type === 'text') {
      const P = TP(cs), xs = cs.p.sx ?? 1, pd = P.bg ? P.bgPad : 0;
      cs.p.boxW = Math.round(Math.max(P.size * 0.8, 2 * Math.abs(lx) / (g.s * xs) - 2 * pd));
      status(`Kutu genişliği: ${cs.p.boxW}px (alanda: 0 = otomatik)`);
    } else if (cs.type === 'image' || cs.type === 'video') { // görsel/video: en/boy ayrı (oran bozulabilir)
      if (sx) cs.p.msx = Math.round(clamp(2 * Math.abs(lx) / bw0, 0.05, 10) * 1000) / 1000; else cs.p.msy = Math.round(clamp(2 * Math.abs(ly) / bh0, 0.05, 10) * 1000) / 1000;
      status(`En ${Math.round((cs.p.msx ?? 1) * 100)}% · Boy ${Math.round((cs.p.msy ?? 1) * 100)}%`);
    } else if (sx) cs.p.w = Math.max(10, Math.round(2 * Math.abs(lx) / g.s));
    else cs.p.h = Math.max(10, Math.round(2 * Math.abs(ly) / g.s));
    draw();
  }, done);
  return true;
}
function axisCursor(deg) { const a = ((deg % 180) + 180) % 180; return a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize'; }
cv.addEventListener('mousemove', e => {
  const cs = sel && findClip(sel)?.clip; if (!cs || kindOf(cs) !== 'visual' || !active(cs, time)) return;
  const b = boxOf(cs, time); if (!b) return; const [px, py] = canvasPt(e), h = handleAt(cs, b, px, py);
  if (h === 'rot') cv.style.cursor = 'grab'; else if (h) cv.style.cursor = axisCursor(b.g.r + (h === 'l' || h === 'r' ? 0 : 90));
});

// ---------- 3) Katmanlar paneli ----------
let layersOn = false, lyOnlyNow = false, lyDragging = false, lySig = '';
(() => {
  const bl = document.createElement('button'); bl.id = 'bLayers'; bl.title = 'Katmanlar (L)'; bl.textContent = '☰ Katmanlar'; $('#bPlay').after(bl);
  bl.onclick = () => toggleLayers();
  const d = document.createElement('div'); d.id = 'layers'; d.className = 'hidden';
  d.innerHTML = `<div class="lyBar"><b>Katmanlar</b><span>Üstteki öne çıkar · satırı sürükleyerek sırala</span>
    <label class="lychk"><input type="checkbox" id="lyNow" style="width:auto"> Sadece playhead'dekiler</label><span class="grow"></span>
    <button class="tbtn" id="lyUp" title="Seçili öğeyi bir öne al">▲ Öne</button><button class="tbtn" id="lyDn" title="Seçili öğeyi bir arkaya al">▼ Arkaya</button>
    <button class="tbtn" id="lyReset" title="Sırayı zaman çizelgesindeki iz sırasına döndür">İz sırasına dön</button></div><div id="lyList"></div>`;
  $('#graph').after(d);
  $('#lyNow').onchange = e => { lyOnlyNow = e.target.checked; renderLayers(); };
  $('#lyUp').onclick = () => layerStep(-1); $('#lyDn').onclick = () => layerStep(1);
  $('#lyReset').onclick = () => { if (!proj.layers) return; commit(); delete proj.layers; refreshAll(); status('Katman sırası iz sırasına döndü'); setTimeout(() => status(''), 2000); };
  const L = $('#lyList');
  L.onclick = e => { const b = e.target.closest('.lye'); if (!b) return; const c = findClip(b.closest('.ly').dataset.id)?.clip; if (!c) return; commit(); c.hidden = !c.hidden; if (!c.hidden) delete c.hidden; refreshAll(); };
  L.onmousedown = e => {
    const row = e.target.closest('.ly'); if (!row || e.target.closest('.lye') || e.button !== 0) return;
    e.preventDefault(); const id = row.dataset.id, c = findClip(id)?.clip; if (!c) return;
    sel = id; L.querySelectorAll('.ly.sel').forEach(x => x.classList.remove('sel')); row.classList.add('sel'); refreshInsp();
    if (!active(c, time)) setTime(c.start); else draw();
    const y0 = e.clientY; let drag = false, tgt = null, after = false;
    const clear = () => L.querySelectorAll('.drop-before,.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
    dragWin(ev => {
      if (!drag && Math.abs(ev.clientY - y0) < 4) return;
      drag = true; lyDragging = true; row.classList.add('dragging'); clear();
      const over = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.ly');
      if (over && over !== row && L.contains(over)) { const r = over.getBoundingClientRect(); tgt = over.dataset.id; after = ev.clientY > r.top + r.height / 2; over.classList.add(after ? 'drop-after' : 'drop-before'); } else tgt = null;
      const lr = L.getBoundingClientRect(); if (ev.clientY < lr.top + 20) L.scrollTop -= 10; else if (ev.clientY > lr.bottom - 20) L.scrollTop += 10;
    }, () => {
      lyDragging = false; clear(); row.classList.remove('dragging');
      if (drag && tgt && tgt !== id) {
        const ids = visualOrder().map(x => x.id).filter(x => x !== id); let i = ids.indexOf(tgt); if (after) i++;
        ids.splice(i, 0, id); commit(); proj.layers = ids; refreshAll(); status('Katman sırası değişti'); setTimeout(() => status(''), 1500);
      } else renderTL();
    });
  };
})();
function toggleLayers(on = !layersOn) {
  if (on && typeof graphOn !== 'undefined' && graphOn) toggleGraph(false);
  layersOn = on; $('#layers').classList.toggle('hidden', !on); $('#tlScroll').classList.toggle('hidden', on); $('#tlNav').classList.toggle('hidden', on);
  $('#bLayers').classList.toggle('on', on); if (on) renderLayers(); else renderTL();
}
{ const _tg = toggleGraph; toggleGraph = function (on = !graphOn) { if (on && layersOn) toggleLayers(false); return _tg(on); }; }
const LY_ICON = { text: '𝐓', video: '▣', image: '▨', shape: '◆', focus: '◎' };
const lyLabel = c => c.type === 'text' ? (String(c.p.text || '').split('\n')[0] || c.name || 'Metin') : (c.name || '') + (c.type === 'video' && spd(c) !== 1 ? ` · ${spd(c)}×` : '');
function renderLayers() {
  if (!layersOn) return;
  const L = $('#lyList'), ord = visualOrder(), D = Math.max(duration(), 0.01), ids = selIds();
  const rows = ord.filter(c => !lyOnlyNow || active(c, time)); lySig = rows.map(c => c.id).join();
  L.innerHTML = rows.length ? rows.map(c => `<div class="ly${ids.has(c.id) ? ' sel' : ''}${c.hidden ? ' hid' : ''}${active(c, time) ? ' now' : ''}" data-id="${c.id}">
    <span class="lyh" title="Sürükle: katman sırası">⠿</span><button class="lye" title="${c.hidden ? 'Göster' : 'Gizle'}">${c.hidden ? '◌' : '👁'}</button>
    <span class="lyi">${c.frozen ? '❄' : LY_ICON[c.type] || '▣'}</span><span class="lyn">${esc(lyLabel(c))}</span>
    <span class="lyt"><i class="${c.type}" style="left:${(c.start / D * 100).toFixed(3)}%;width:${Math.max(0.6, c.dur / D * 100).toFixed(3)}%"></i></span></div>`).join('')
    : `<div class="lyempty">${lyOnlyNow ? "Playhead'de görsel öğe yok" : 'Görsel öğe yok. Shift+A ile metin, video, şekil ekle.'}</div>`;
  lyPlayhead(true);
}
function lyPlayhead(noRerender) {
  if (!layersOn) return; const L = $('#lyList'); L.style.setProperty('--ph', (time / Math.max(duration(), 0.01) * 100).toFixed(3) + '%');
  if (!noRerender && lyOnlyNow && !lyDragging) { const s = visualOrder().filter(c => active(c, time)).map(c => c.id).join(); if (s !== lySig) renderLayers(); }
  else if (!noRerender && !lyDragging) L.querySelectorAll('.ly').forEach(r => { const c = findClip(r.dataset.id)?.clip; if (c) r.classList.toggle('now', active(c, time)); });
}
function layerStep(dir) {
  const c = sel && findClip(sel)?.clip; if (!c || kindOf(c) !== 'visual') return status('Önce görsel bir öğe seç');
  const ord = visualOrder(), i = ord.indexOf(c); let j = i + dir;
  while (j >= 0 && j < ord.length && !overlaps(ord[j], c)) j += dir; // aynı anda görünen bir sonraki öğenin önüne/arkasına
  if (j < 0 || j >= ord.length) return status(dir < 0 ? 'Zaten en önde' : 'Zaten en arkada');
  const ids = ord.map(x => x.id); ids.splice(i, 1); ids.splice(ids.indexOf(ord[j].id) + (dir > 0 ? 1 : 0), 0, c.id);
  commit(); proj.layers = ids; refreshAll();
}
addEventListener('keydown', e => {
  const ae = document.activeElement, typing = ae && (['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) || ae.isContentEditable);
  if (typing || e.ctrlKey || e.altKey || e.metaKey || addMenuOpen() || !inEditor() || !$('#dlg').classList.contains('hidden')) return;
  if (e.code === 'KeyL' && !e.shiftKey) { e.preventDefault(); toggleLayers(); }
});

// ---------- Mevcut fonksiyonlara bağlama ----------
{ const _v = visualMediaInspHTML; visualMediaInspHTML = function (c) { return (c.type === 'video' ? freezeHTML(c) : '') + _v(c) + fxHTML(c); }; }
{ const _b = bindExtra; bindExtra = function (c) {
  _b(c);
  const fz = $('#i_freeze'); if (fz) fz.onclick = () => freezeFrame(c);
  const fr = $('#i_fxreset'); if (fr) fr.onclick = () => { commit(); FX.forEach(([k]) => delete c.p[k]); refreshAll(); };
}; }
{ const _e = extraMenuItems; extraMenuItems = function () {
  const a = _e(); a.splice(2, 0, { icon: '◎', label: 'Netlik bloğu (dışı bulanık)', act: addFocus }, { icon: '❄', label: 'Kareyi dondur (seçili video)', act: () => freezeFrame(sel && findClip(sel)?.clip) }); return a;
}; }
{ const _cl = clipLabel; clipLabel = function (c) { if (c.type === 'focus') return '◎ ' + (c.name || 'Netlik bloğu'); return (c.frozen ? '❄ ' : '') + _cl(c); }; }
SHORTCUTS.push(['L', 'Katmanlar paneli'], ['Shift + döndürme tutamacı', '15° adımla döndür']);
