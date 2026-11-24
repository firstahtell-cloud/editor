// ===================== Ek özellikler (10): Kırpma (C) =====================
// Video ya da görsel seçiliyken C: kenar/köşeleri sürükle, içini sürükleyerek kaydır. Oran: Serbest, Orijinal, 1:1, 9:16, 16:9, 4:5.
// Enter/C: uygula, Esc: iptal. Kırpılan kısım yerinde kalır.
let cropEdit = null; // { id, w:{l,t,r,b}, ratio, before }
const CROP0 = () => ({ l: 0, t: 0, r: 0, b: 0 });
const CROP_RATIOS = [['free', 'Serbest'], ['orig', 'Orijinal'], [1, '1:1'], [9 / 16, '9:16'], [16 / 9, '16:9'], [4 / 5, '4:5']];
function cropPre(c2, c, dw, dh) {
  const cr = c.p.crop || CROP0(), editing = cropEdit && cropEdit.id === c.id;
  if (!editing) { const cw = (1 - cr.l - cr.r) * dw, ch = (1 - cr.t - cr.b) * dh; c2.beginPath(); c2.rect(-cw / 2, -ch / 2, cw, ch); c2.clip(); }
  c2.translate(-(cr.l - cr.r) * dw / 2, -(cr.t - cr.b) * dh / 2);
}
function cropGeo(c) { // seçili klibin dünya → yerel dönüşümü için gerekenler
  const src = elFor(c); if (!src) return null; const [sw, sh] = srcSize(c, src); if (!sw) return null;
  const f = fitScale(c, sw, sh), dw = sw * f, dh = sh * f, g = geomOf(evalClip ? evalClip(c, time - c.start) : c, time);
  const mx = c.type === 'image' ? (c.p.msx ?? 1) : 1, my = c.type === 'image' ? (c.p.msy ?? 1) : 1, cr = c.p.crop || CROP0();
  return { g, dw, dh, mx, my, ox: (cr.l - cr.r) * dw / 2, oy: (cr.t - cr.b) * dh / 2 };
}
function cropToFrac(G, px, py) { // dünya noktası → tam görsel üzerinde 0..1 kesir
  const a = -G.g.r * Math.PI / 180, dx = px - W / 2 - G.g.x, dy = py - H / 2 - G.g.y;
  const lx = (dx * Math.cos(a) - dy * Math.sin(a)) / (G.g.s * G.mx), ly = (dx * Math.sin(a) + dy * Math.cos(a)) / (G.g.s * G.my);
  return [(lx + G.ox + G.dw / 2) / G.dw, (ly + G.oy + G.dh / 2) / G.dh];
}
function cropOverlay(g2) {
  if (!cropEdit) return; const c = findClip(cropEdit.id)?.clip; if (!c || !active(c, time)) return; const G = cropGeo(c); if (!G) return;
  const w = cropEdit.w, k = 1 / VIEW.s;
  g2.save(); g2.translate(W / 2 + G.g.x, H / 2 + G.g.y); g2.rotate(G.g.r * Math.PI / 180); g2.scale(G.g.s * G.mx, G.g.s * G.my);
  const kx = k / (G.g.s * G.mx), ky = k / (G.g.s * G.my);
  const X0 = -G.ox - G.dw / 2, Y0 = -G.oy - G.dh / 2, x1 = X0 + w.l * G.dw, y1 = Y0 + w.t * G.dh, x2 = X0 + (1 - w.r) * G.dw, y2 = Y0 + (1 - w.b) * G.dh;
  g2.beginPath(); g2.rect(X0, Y0, G.dw, G.dh); g2.rect(x1, y1, x2 - x1, y2 - y1); g2.fillStyle = 'rgba(0,0,0,.6)'; g2.fill('evenodd');
  g2.strokeStyle = 'rgba(255,255,255,.35)'; g2.lineWidth = kx; g2.beginPath();
  for (const f of [1 / 3, 2 / 3]) { g2.moveTo(x1 + (x2 - x1) * f, y1); g2.lineTo(x1 + (x2 - x1) * f, y2); g2.moveTo(x1, y1 + (y2 - y1) * f); g2.lineTo(x2, y1 + (y2 - y1) * f); }
  g2.stroke(); g2.strokeStyle = '#fff'; g2.lineWidth = 2 * kx; g2.strokeRect(x1, y1, x2 - x1, y2 - y1);
  g2.fillStyle = '#fff'; for (const [x, y] of [[x1, y1], [x2, y1], [x1, y2], [x2, y2]]) g2.fillRect(x - 7 * kx, y - 7 * ky, 14 * kx, 14 * ky);
  for (const [x, y, hz] of [[(x1 + x2) / 2, y1, 1], [(x1 + x2) / 2, y2, 1], [x1, (y1 + y2) / 2, 0], [x2, (y1 + y2) / 2, 0]]) { const hw = hz ? 26 * kx : 5 * kx, hh = hz ? 5 * ky : 26 * ky; g2.fillRect(x - hw / 2, y - hh / 2, hw, hh); }
  g2.restore();
}
function cropRatioVal(c, G) { const r = cropEdit.ratio; if (r === 'free' || r == null) return null; if (r === 'orig') return (G.dw * G.mx) / (G.dh * G.my); return r; }
function cropFitRatio(G, rt, w) { // oranı uygula: mevcut alanın merkezinde, sığabilen en büyük
  if (!rt) return w; const full = (G.dw * G.mx) / (G.dh * G.my), cxf = (w.l + 1 - w.r) / 2, cyf = (w.t + 1 - w.b) / 2;
  let wf = 1 - w.l - w.r, hf = wf * full / rt; if (hf > 1 - w.t - w.b + 1e-9) { hf = Math.min(1, 1 - w.t - w.b); wf = hf * rt / full; }
  if (wf > 1) { wf = 1; hf = wf * full / rt; } if (hf > 1) { hf = 1; wf = hf * rt / full; }
  let l = clamp(cxf - wf / 2, 0, 1 - wf), t = clamp(cyf - hf / 2, 0, 1 - hf); return { l, t, r: 1 - l - wf, b: 1 - t - hf };
}
function cropStart() {
  const c = sel && findClip(sel)?.clip; if (!c || (c.type !== 'image' && c.type !== 'video') || !active(c, time)) { status('C: önce bir video ya da görsel seç'); setTimeout(() => status(''), 1800); return; }
  if (playing) pause();
  cropEdit = { id: c.id, w: { ...CROP0(), ...(c.p.crop || {}) }, ratio: 'free', before: JSON.stringify(proj) };
  cropBar(true); status('Kırp: kenar/köşeleri sürükle · Enter/C: uygula · Esc: iptal'); draw();
}
function cropEnd(ok) {
  if (!cropEdit) return; const E = cropEdit; cropEdit = null; cropBar(false); status('');
  const c = findClip(E.id)?.clip; if (!c) return draw();
  if (!ok) { proj = JSON.parse(E.before); return refreshAll(); }
  const G = cropGeo(c); const w = E.w, none = w.l < 1e-4 && w.t < 1e-4 && w.r < 1e-4 && w.b < 1e-4;
  if (G) { // kırpılan kısım yerinde kalsın: konumu yeni merkeze göre kaydır
    const nox = (w.l - w.r) * G.dw / 2, noy = (w.t - w.b) * G.dh / 2, a = G.g.r * Math.PI / 180;
    const ddx = (nox - G.ox) * G.g.s * G.mx, ddy = (noy - G.oy) * G.g.s * G.my, wx = ddx * Math.cos(a) - ddy * Math.sin(a), wy = ddx * Math.sin(a) + ddy * Math.cos(a);
    if (c.kf && c.kf.x && c.kf.x.length) c.kf.x.forEach(k => k.v += wx); else c.p.x = (c.p.x || 0) + wx;
    if (c.kf && c.kf.y && c.kf.y.length) c.kf.y.forEach(k => k.v += wy); else c.p.y = (c.p.y || 0) + wy;
  }
  if (none) delete c.p.crop; else c.p.crop = { l: +w.l.toFixed(5), t: +w.t.toFixed(5), r: +w.r.toFixed(5), b: +w.b.toFixed(5) };
  undoS.push(E.before); redoS.length = 0; dirty = true; refreshAll(); status(none ? 'Kırpma kaldırıldı' : 'Kırpıldı (Ctrl+Z ile geri alınır)'); setTimeout(() => status(''), 2000);
}
function cropBar(on) {
  let b = $('#cropBar');
  if (!b) {
    b = document.createElement('div'); b.id = 'cropBar';
    b.innerHTML = CROP_RATIOS.map(([v, n]) => `<button data-r="${v}">${n}</button>`).join('') + '<span class="sep"></span><button data-a="reset">Sıfırla</button><button data-a="cancel">✕ İptal</button><button data-a="ok" class="primary">✓ Uygula</button>';
    cv.parentElement.appendChild(b);
    b.onmousedown = e => e.stopPropagation();
    b.onclick = e => {
      const t = e.target.closest('button'); if (!t || !cropEdit) return;
      if (t.dataset.a === 'ok') return cropEnd(true); if (t.dataset.a === 'cancel') return cropEnd(false);
      const c = findClip(cropEdit.id)?.clip, G = c && cropGeo(c); if (!G) return;
      if (t.dataset.a === 'reset') { cropEdit.w = CROP0(); cropEdit.ratio = 'free'; }
      else { const r = t.dataset.r; cropEdit.ratio = r === 'free' || r === 'orig' ? r : +r; cropEdit.w = cropFitRatio(G, cropRatioVal(c, G), cropEdit.ratio === 'orig' ? CROP0() : cropEdit.w); }
      cropBar(true); draw();
    };
  }
  b.classList.toggle('on', !!on);
  if (on) b.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('sel', String(cropEdit.ratio) === x.dataset.r || (typeof cropEdit.ratio === 'number' && Math.abs(+x.dataset.r - cropEdit.ratio) < 1e-6)));
}
cv.addEventListener('mousedown', e => {
  if (!cropEdit || e.button !== 0) return; e.preventDefault(); e.stopImmediatePropagation();
  const c = findClip(cropEdit.id)?.clip; if (!c) return; const G = cropGeo(c); if (!G) return;
  const [px, py] = canvasPt(e), [u, v] = cropToFrac(G, px, py), w0 = { ...cropEdit.w };
  const tu = 14 / VIEW.s / (G.g.s * G.mx * G.dw), tv = 14 / VIEW.s / (G.g.s * G.my * G.dh);
  const L = w0.l, R = 1 - w0.r, T = w0.t, B = 1 - w0.b;
  const nl = Math.abs(u - L) < tu, nr = Math.abs(u - R) < tu, nt = Math.abs(v - T) < tv, nb = Math.abs(v - B) < tv, inX = u > L - tu && u < R + tu, inY = v > T - tv && v < B + tv;
  let mode = ((nt && inX) ? 't' : (nb && inX) ? 'b' : '') + ((nl && inY) ? 'l' : (nr && inY) ? 'r' : '');
  if (!mode && u > L && u < R && v > T && v < B) mode = 'move';
  if (!mode) return;
  const MIN = 0.03, rt = cropRatioVal(c, G), full = (G.dw * G.mx) / (G.dh * G.my);
  dragWin(ev => {
    const [qx, qy] = canvasPt(ev), [uu, vv] = cropToFrac(G, qx, qy), du = uu - u, dv = vv - v; let w = { ...w0 };
    if (mode === 'move') { const ww = 1 - w0.l - w0.r, hh = 1 - w0.t - w0.b; w.l = clamp(w0.l + du, 0, 1 - ww); w.r = 1 - w.l - ww; w.t = clamp(w0.t + dv, 0, 1 - hh); w.b = 1 - w.t - hh; }
    else {
      if (mode.includes('l')) w.l = clamp(w0.l + du, 0, 1 - w0.r - MIN);
      if (mode.includes('r')) w.r = clamp(w0.r - du, 0, 1 - w0.l - MIN);
      if (mode.includes('t')) w.t = clamp(w0.t + dv, 0, 1 - w0.b - MIN);
      if (mode.includes('b')) w.b = clamp(w0.b - dv, 0, 1 - w0.t - MIN);
      if (rt) { // oran kilitli: diğer boyutu ayarla, karşı kenar sabit
        const horiz = mode.includes('l') || mode.includes('r');
        if (horiz) { let hf = (1 - w.l - w.r) * full / rt; if (mode.includes('t')) w.t = 1 - w.b - hf; else if (mode.includes('b')) w.b = 1 - w.t - hf; else { const cy = (w0.t + 1 - w0.b) / 2; w.t = cy - hf / 2; w.b = 1 - cy - hf / 2; } }
        else { const wf = (1 - w.t - w.b) * rt / full, cx = (w0.l + 1 - w0.r) / 2; w.l = cx - wf / 2; w.r = 1 - cx - wf / 2; }
        if (w.l < 0 || w.r < 0 || w.t < 0 || w.b < 0) return; // sınır dışına taşma
      }
    }
    cropEdit.w = w; draw();
    status(`Kırp: ${Math.round((1 - w.l - w.r) * G.dw * G.mx)} × ${Math.round((1 - w.t - w.b) * G.dh * G.my)} · Enter: uygula · Esc: iptal`);
  }, () => {});
}, true);
addEventListener('keydown', e => {
  const ae = document.activeElement, typing = ae && (['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) || ae.isContentEditable);
  if (cropEdit) {
    if (typing) return; const k = String(e.key || '').toLowerCase();
    if (k === 'escape') { e.preventDefault(); e.stopImmediatePropagation(); cropEnd(false); }
    else if (k === 'enter' || (e.code === 'KeyC' && !e.ctrlKey && !e.metaKey)) { e.preventDefault(); e.stopImmediatePropagation(); cropEnd(true); }
    return;
  }
  if (typing || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || addMenuOpen() || !inEditor() || !$('#dlg').classList.contains('hidden')) return;
  if (e.code === 'KeyC') { e.preventDefault(); e.stopImmediatePropagation(); cropStart(); }
}, true);
{ const _r = refreshAll; refreshAll = function () { if (cropEdit && !findClip(cropEdit.id)) { cropEdit = null; cropBar(false); } return _r.apply(this, arguments); }; }
SHORTCUTS.push(['C', 'Kırp (video/görsel) · Enter uygula, Esc iptal']);
