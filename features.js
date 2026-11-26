'use strict';
// =====================================================================
//  Editör 2.1 — ek özellikler
// =====================================================================
Object.assign(ANY_DEF, { speed: 1, rev: false, duck: false, duckLvl: 0.25, fit: 'contain', bgBlur: false,
  bri: 0, con: 0, sat: 0, temp: 0, tint: 0, fade: 0, vig: 0 });

// ---------- 11) Formatlar ----------
const FORMATS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };
function applyFormat() {
  const f = proj.fmt || (proj.fmt = { w: 1080, h: 1920, fps: 30 });
  if (W !== f.w || H !== f.h || FPS !== f.fps) { W = f.w; H = f.h; FPS = f.fps; EPS = 0.5 / FPS; fitCanvas(); }
  const key = Object.keys(FORMATS).find(k => FORMATS[k][0] === W && FORMATS[k][1] === H) || '9:16';
  $('#fmtSel').value = key; $('#fpsSel').value = String(FPS);
}
$('#fmtSel').onchange = e => { commit(); const [w, h] = FORMATS[e.target.value]; proj.fmt = { ...proj.fmt, w, h }; refreshAll(); e.target.blur(); };
$('#fpsSel').onchange = e => { commit(); proj.fmt = { ...proj.fmt, fps: +e.target.value }; refreshAll(); e.target.blur(); };
async function exportDialog() {
  const m = Math.min(W, H);
  const r = await dialog({
    title: 'Dışa aktar', text: `${W}×${H} · ${FPS} fps · ${fmt(duration())}`,
    html: `<div class="row"><label>Kalite</label><select id="xQ"><option value="16">Yüksek</option><option value="20" selected>Normal</option><option value="26">Küçük dosya</option></select><span></span></div>
      <div class="row"><label>Çözünürlük</label><select id="xR"><option value="1">Tam (${W}×${H})</option>${m > 720 ? `<option value="${720 / m}">720p</option>` : ''}${m > 540 ? `<option value="${540 / m}">540p</option>` : ''}</select><span></span></div>`,
    buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Dışa aktar', v: 'ok', cls: 'primary' }]
  });
  if (r.v !== 'ok') return null;
  return { crf: +$('#xQ').value, scale: +$('#xR').value };
}

// ---------- 4) Renk ayarı ----------
const COLOR_KEYS = ['bri', 'con', 'sat', 'temp', 'tint', 'fade', 'vig'];
const COLOR_PRESETS = {
  none: ['Yok', {}], sicak: ['Sıcak', { temp: .35, sat: .1 }], soguk: ['Soğuk', { temp: -.35, tint: .05 }],
  sb: ['Siyah-Beyaz', { sat: -1, con: .15 }], vintage: ['Vintage', { fade: .3, temp: .25, sat: -.25, vig: .4 }],
  canli: ['Canlı', { sat: .45, con: .15 }], sinema: ['Sinematik', { con: .2, sat: -.15, temp: .12, tint: -.08, vig: .35 }],
  soluk: ['Soluk', { fade: .4, con: -.15, sat: -.2 }], dram: ['Dramatik', { con: .4, sat: -.3, bri: -.05, vig: .5 }]
};
const mmul = (A, B) => { const R = []; for (let i = 0; i < 5; i++) { R[i] = []; for (let j = 0; j < 5; j++) { let s = 0; for (let k = 0; k < 5; k++) s += A[i][k] * B[k][j]; R[i][j] = s; } } return R; };
const mdiag = (r, g, b, o = [0, 0, 0]) => [[r, 0, 0, 0, o[0]], [0, g, 0, 0, o[1]], [0, 0, b, 0, o[2]], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]];
function colorMatrix(p) {
  const b = p.bri || 0, c = p.con || 0, s = p.sat || 0, t = p.temp || 0, ti = p.tint || 0, f = p.fade || 0;
  let M = mdiag(1 + 0.25 * t, 1 - 0.2 * ti, 1 - 0.25 * t);
  const sv = 1 + s, lr = .2126, lg = .7152, lb = .0722;
  M = mmul([[lr * (1 - sv) + sv, lg * (1 - sv), lb * (1 - sv), 0, 0], [lr * (1 - sv), lg * (1 - sv) + sv, lb * (1 - sv), 0, 0], [lr * (1 - sv), lg * (1 - sv), lb * (1 - sv) + sv, 0, 0], [0, 0, 0, 1, 0], [0, 0, 0, 0, 1]], M);
  const k = 1 + c; M = mmul(mdiag(k, k, k, [0.5 * (1 - k), 0.5 * (1 - k), 0.5 * (1 - k)]), M);
  M = mmul(mdiag(1, 1, 1, [b * .35, b * .35, b * .35]), M);
  const fk = 1 - 0.35 * f; M = mmul(mdiag(fk, fk, fk, [.175 * f, .175 * f, .175 * f]), M);
  return M.slice(0, 4).flat();
}
const cfCache = new Map();
function colorFilter(c) {
  const p = c.p; if (!(p.bri || p.con || p.sat || p.temp || p.tint || p.fade)) return '';
  const key = ['bri', 'con', 'sat', 'temp', 'tint', 'fade'].map(k => (+p[k] || 0).toFixed(3)).join('_');
  let id = cfCache.get(key);
  if (!id) {
    id = 'cf' + cfCache.size;
    const NS = 'http://www.w3.org/2000/svg', fl = document.createElementNS(NS, 'filter'), cm = document.createElementNS(NS, 'feColorMatrix');
    fl.setAttribute('id', id); fl.setAttribute('color-interpolation-filters', 'sRGB');
    cm.setAttribute('type', 'matrix'); cm.setAttribute('values', colorMatrix(p).map(v => +v.toFixed(5)).join(' '));
    fl.appendChild(cm); $('#fxdefs defs').appendChild(fl); cfCache.set(key, id);
  }
  return `url(#${id})`;
}
function drawVignette(g, w, h, amt) {
  const r = Math.hypot(w, h) / 2, gr = g.createRadialGradient(0, 0, r * 0.35, 0, 0, r);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${clamp(amt, 0, 1) * 0.9})`);
  g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
}
// ---------- 5) Bulanık arka plan ----------
const blurCv = document.createElement('canvas'), blurCtx = blurCv.getContext('2d');
function drawBlurBg(g, src, sw, sh, cf = '') {
  const bw = Math.max(8, Math.round(W / 14)), bh = Math.max(8, Math.round(H / 14));
  if (blurCv.width !== bw || blurCv.height !== bh) { blurCv.width = bw; blurCv.height = bh; }
  const f = Math.max(bw / sw, bh / sh);
  blurCtx.filter = 'blur(1.5px)'; blurCtx.drawImage(src, (bw - sw * f) / 2, (bh - sh * f) / 2, sw * f, sh * f);
  g.save(); g.beginPath(); g.rect(0, 0, W, H); g.clip(); g.imageSmoothingQuality = 'high'; g.filter = (cf + ' brightness(0.72)').trim();
  g.drawImage(blurCv, 2, 2, bw - 4, bh - 4, -W * 0.03, -H * 0.03, W * 1.06, H * 1.06); g.restore();
}

// ---------- 9) Şekiller ve çıkartmalar ----------
const SHAPES = [['rect', 'Kutu', '■'], ['circle', 'Daire', '●'], ['tri', 'Üçgen', '▲'], ['star', 'Yıldız', '★'], ['heart', 'Kalp', '♥'], ['arrow', 'Ok', '➜'], ['line', 'Çizgi', '━']];
const SHAPE_DEF = { shape: 'rect', w: 500, h: 500, fillOn: true, fill: '#ffcc33', strokeW: 0, stroke: '#ffffff', rad: 0, shShadow: false };
function shapePath(g, p) {
  const w = p.w, h = p.h, x = w / 2, y = h / 2;
  g.beginPath();
  switch (p.shape) {
    case 'circle': g.ellipse(0, 0, x, y, 0, 0, Math.PI * 2); break;
    case 'tri': g.moveTo(0, -y); g.lineTo(x, y); g.lineTo(-x, y); g.closePath(); break;
    case 'star': for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.42 : 1, a = -Math.PI / 2 + i * Math.PI / 5; i ? g.lineTo(Math.cos(a) * x * r, Math.sin(a) * y * r) : g.moveTo(Math.cos(a) * x * r, Math.sin(a) * y * r); } g.closePath(); break;
    case 'heart': g.moveTo(0, y); g.bezierCurveTo(-x * 1.15, y * 0.15, -x * 1.0, -y * 1.05, 0, -y * 0.42); g.bezierCurveTo(x * 1.0, -y * 1.05, x * 1.15, y * 0.15, 0, y); g.closePath(); break;
    case 'arrow': { const hh = Math.min(w * 0.45, h * 1.0), s = h * 0.18; g.moveTo(-x, -s); g.lineTo(x - hh, -s); g.lineTo(x - hh, -y); g.lineTo(x, 0); g.lineTo(x - hh, y); g.lineTo(x - hh, s); g.lineTo(-x, s); g.closePath(); break; }
    default: rrect(g, -x, -y, w, h, p.shape === 'line' ? h / 2 : (p.rad || 0));
  }
}
function drawShape(g, c) {
  const p = Object.assign({}, SHAPE_DEF, c.p); shapePath(g, p);
  if (p.shShadow) { g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 30; g.shadowOffsetY = 12; }
  if (p.fillOn) { g.fillStyle = p.fill; g.fill(); }
  g.shadowColor = 'transparent';
  if (p.strokeW > 0) { g.lineJoin = 'round'; g.lineWidth = p.strokeW; g.strokeStyle = p.stroke; g.stroke(); }
}
function addShape(kind) {
  commit();
  const extra = kind === 'line' ? { w: 700, h: 18 } : kind === 'arrow' ? { w: 600, h: 260 } : {};
  const c = { id: uid(), type: 'shape', name: (SHAPES.find(s => s[0] === kind) || [, 'Şekil'])[1], start: time, in: 0, dur: 3, p: Object.assign(baseP(), SHAPE_DEF, { shape: kind }, extra), kf: {} };
  trackFor('visual', c.start, c.dur).clips.push(c); sel = c.id; refreshAll();
}
function shapeInspHTML(c) {
  return `<div class="grp"><h4>Şekil</h4>${fieldHTML(c, ['shape', 'Tür', 'sel', SHAPES.map(([k, n]) => [k, n])])}${fieldHTML(c, ['w', 'Genişlik', 'num', 1])}${fieldHTML(c, ['h', 'Yükseklik', 'num', 1])}
    ${fieldHTML(c, ['fillOn', 'Dolgu', 'chk'])}${fieldHTML(c, ['fill', 'Dolgu rengi', 'color'])}${fieldHTML(c, ['strokeW', 'Çerçeve', 'num', 1])}${fieldHTML(c, ['stroke', 'Çerçeve rengi', 'color'])}
    ${fieldHTML(c, ['rad', 'Köşe yuvarlak', 'num', 1])}${fieldHTML(c, ['shShadow', 'Gölge', 'chk'])}</div>`;
}
const STICKERS = ['😀', '😂', '🤣', '😍', '😎', '🤯', '😭', '😱', '🤔', '🥳', '😡', '👀', '💀', '🔥', '💯', '❤️', '💔', '👍', '👎', '👏', '🙏', '💪', '✨', '⭐', '⚡', '🎉', '💥', '🚀', '✅', '❌', '⚠️', '❓', '❗', '➡️', '⬅️', '⬆️', '⬇️', '🎮', '🎵', '📌'];
function addSticker(em) {
  addText(); const c = findClip(sel).clip;
  Object.assign(c.p, { text: em, font: 'Segoe UI Emoji', size: 300, bold: false, strokeW: 0, bg: false, glow: false, shadow: false, upper: false });
  c.name = 'Çıkartma'; refreshAll();
}

// ---------- 2) Ses dalgası ----------
const peaksCache = new Map(), peaksPending = new Set();
let tlQueued = false;
function scheduleTL() { if (tlQueued) return; tlQueued = true; requestAnimationFrame(() => { tlQueued = false; renderTL(); }); }
function ensurePeaks(m) {
  if (!m || !(m.hasAudio || m.kind === 'audio')) return null;
  if (peaksCache.has(m.id)) return peaksCache.get(m.id);
  if (!peaksPending.has(m.id)) {
    peaksPending.add(m.id);
    window.api.peaks(m.path).then(r => { if (r && r.data) peaksCache.set(m.id, { rate: r.rate, d: new Uint8Array(r.data) }); peaksPending.delete(m.id); duckCache = null; scheduleTL(); }).catch(() => peaksPending.delete(m.id));
  }
  return null;
}
function addWave(ce, c) {
  if (c.type !== 'video' && c.type !== 'audio') return;
  const m = mediaOf(c), P = ensurePeaks(m); if (!P) return;
  const wpx = Math.round(Math.min(Math.max(4, c.dur * pps), 6000)), hh = c.type === 'audio' ? 36 : 16;
  const cv2 = document.createElement('canvas'); cv2.className = 'wave'; cv2.width = wpx; cv2.height = hh; cv2.style.height = hh + 'px';
  const g = cv2.getContext('2d'), vol = Math.min(1.5, c.p.volume ?? 1);
  g.fillStyle = c.type === 'audio' ? 'rgba(220,255,235,0.55)' : 'rgba(255,255,255,0.35)';
  for (let x = 0; x < wpx; x++) {
    const a = srcT(c, x / wpx * c.dur), b = srcT(c, (x + 1) / wpx * c.dur);
    const i0 = Math.floor(Math.min(a, b) * P.rate), i1 = Math.max(i0 + 1, Math.ceil(Math.max(a, b) * P.rate));
    let mx = 0; for (let i = i0; i < i1 && i < P.d.length; i++) if (P.d[i] > mx) mx = P.d[i];
    const v = Math.min(1, mx / 255 * vol) * hh;
    if (c.type === 'audio') g.fillRect(x, (hh - v) / 2, 1, Math.max(1, v)); else g.fillRect(x, hh - v, 1, Math.max(0.5, v));
  }
  ce.appendChild(cv2);
}
function clipLabel(c) {
  if (c.type === 'text') return (c.name === 'Çıkartma' ? '' : '𝐓 ') + (c.p.text || '').split('\n')[0];
  if (c.type === 'shape') return ((SHAPES.find(s => s[0] === c.p.shape) || [, , '◆'])[2]) + ' ' + c.name;
  let s = c.name; const sp = spd(c); if (sp !== 1) s += ` · ${sp}×`; if (c.p.rev) s += ' · ⟲'; if (c.p.duck) s += ' · 🔉'; return s;
}

// ---------- 8) Sesi otomatik kısma (ducking) ----------
let duckCache = null, duckKey = '';
const DUCK_R = 0.12;
function speechSegs() {
  const voices = allClips().filter(c => (c.type === 'video' || c.type === 'audio') && !c.p.duck && (c.p.volume ?? 1) > 0);
  const key = JSON.stringify(voices.map(c => [c.mediaId, c.start, c.in, c.dur, c.p.speed, c.p.rev, c.p.volume])) + '|' + peaksCache.size;
  if (duckCache && key === duckKey) return duckCache;
  const STEP = 0.05, n = Math.ceil(duration() / STEP) + 1, on = new Uint8Array(n);
  for (const c of voices) {
    const m = mediaOf(c); if (!m || !m.hasAudio) continue; const P = ensurePeaks(m); if (!P) continue;
    const vol = c.p.volume ?? 1;
    for (let i = Math.max(0, Math.floor(c.start / STEP)); i < n && i * STEP < c.start + c.dur; i++) {
      const lt = i * STEP - c.start; if (lt < 0) continue;
      const j = Math.floor(srcT(c, lt) * P.rate); let mx = 0; for (let q = j; q < j + 5 && q < P.d.length; q++) if (P.d[q] > mx) mx = P.d[q];
      if (mx / 255 * vol > 0.08) on[i] = 1;
    }
  }
  const segs = []; let a = -1, last = -1;
  for (let i = 0; i < n; i++) { if (on[i]) { if (a < 0) a = i; last = i; } else if (a >= 0 && (i - last) * STEP > 0.35) { segs.push([a * STEP, (last + 1) * STEP]); a = -1; } }
  if (a >= 0) segs.push([a * STEP, (last + 1) * STEP]);
  duckKey = key; duckCache = segs.filter(s => s[1] - s[0] >= 0.15); return duckCache;
}
function duckFactor(t, c) {
  const L = c.p.duckLvl ?? 0.25; let w = 0;
  for (const [a, b] of speechSegs()) { if (t < a - DUCK_R) break; w = Math.max(w, clamp(Math.min((t - a + DUCK_R) / DUCK_R, (b + DUCK_R - t) / DUCK_R), 0, 1)); }
  return 1 - (1 - L) * w;
}
function duckExpr(c) {
  const L = c.p.duckLvl ?? 0.25, segs = speechSegs(); if (!segs.length) return null;
  return `1-${(1 - L).toFixed(3)}*(` + segs.map(([a, b]) => `clip(min((t-${(a - DUCK_R).toFixed(3)})/${DUCK_R},(${(b + DUCK_R).toFixed(3)}-t)/${DUCK_R}),0,1)`).join('+') + ')';
}
function audioList(forAsr) {
  const out = [];
  for (const c of allClips()) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const m = mediaOf(c); if (!m || !(m.hasAudio || m.kind === 'audio') || (c.p.volume ?? 1) <= 0) continue;
    if (forAsr && c.p.duck) continue;
    out.push({ path: m.path, in: c.in, dur: c.dur, start: c.start, volume: forAsr ? 1 : (c.p.volume ?? 1), speed: spd(c), rev: !!c.p.rev, duck: !forAsr && c.p.duck ? duckExpr(c) : null });
  }
  return out;
}

// ---------- 3) Hız + medya özellikleri ----------
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
function mediaInspHTML(c) {
  const sp = spd(c), list = SPEEDS.includes(sp) ? SPEEDS : [...SPEEDS, sp].sort((a, b) => a - b);
  return `<div class="grp"><h4>Hız</h4><div class="row"><label>Hız</label><input id="i_speed" type="range" min="0.1" max="4" step="0.05" value="${sp}"><span class="rv sp">${sp.toFixed(2)}×</span></div>
    <div class="row"><label></label><div class="spq">${[0.5, 1, 1.5, 2, 3].map(v => `<button data-sp="${v}">${v}×</button>`).join('')}</div><span></span></div>
    ${fieldHTML(c, ['rev', 'Ters oynat', 'chk'])}</div>
    <div class="grp"><h4>Sesi otomatik kıs</h4>${fieldHTML(c, ['duck', 'Bu müzik: konuşmada kıs', 'chk'])}${fieldHTML(c, ['duckLvl', 'Kısma seviyesi', 'range'])}</div>`;
}
function visualMediaInspHTML(c) {
  const cur = c.p.filt || 'none';
  return `<div class="grp"><h4>Çerçeve</h4>${fieldHTML(c, ['fit', 'Yerleşim', 'sel', [['contain', 'Sığdır'], ['cover', 'Doldur (kırp)']]])}${fieldHTML(c, ['bgBlur', 'Bulanık arka plan', 'chk'])}${fieldHTML(c, ['mirror', 'Ters görsel (ayna)', 'chk'])}</div>
    <div class="grp"><h4>Renk ayarı</h4><div class="row"><label>Filtre</label><select id="i_cpreset">${Object.entries(COLOR_PRESETS).map(([k, [n]]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${n}</option>`).join('')}</select><span></span></div>
    ${fieldHTML(c, ['bri', 'Parlaklık', 'range', [-1, 1]])}${fieldHTML(c, ['con', 'Kontrast', 'range', [-1, 1]])}${fieldHTML(c, ['sat', 'Doygunluk', 'range', [-1, 1]])}
    ${fieldHTML(c, ['temp', 'Sıcaklık', 'range', [-1, 1]])}${fieldHTML(c, ['tint', 'Ton', 'range', [-1, 1]])}${fieldHTML(c, ['fade', 'Soluklaştır', 'range'])}${fieldHTML(c, ['vig', 'Vinyet', 'range'])}
    <div class="row"><label></label><button id="i_creset">Sıfırla</button><span></span></div></div>`;
}
function bindExtra(c) {
  const s = $('#i_speed');
  document.querySelectorAll('.spq [data-sp]').forEach(b => b.onclick = () => { s.value = b.dataset.sp; s.onchange(); });
  if (s) s.oninput = () => { s.nextElementSibling.textContent = (+s.value).toFixed(2) + '×'; };
  if (s) s.onchange = () => {
    commit(); const old = spd(c), nw = Math.round(+s.value * 100) / 100, m = mediaOf(c);
    let d = c.dur * old / nw; if (m) d = Math.min(d, (m.dur - c.in) / nw);
    const f = d / c.dur; for (const p in (c.kf || {})) c.kf[p].forEach(k => k.t *= f);
    c.dur = Math.max(1 / FPS, d); c.p.speed = nw; refreshAll();
  };
  const cp = $('#i_cpreset');
  if (cp) cp.onchange = () => { commit(); COLOR_KEYS.forEach(k => c.p[k] = 0); Object.assign(c.p, COLOR_PRESETS[cp.value][1]); c.p.filt = cp.value; refreshAll(); };
  const cr = $('#i_creset');
  if (cr) cr.onclick = () => { commit(); COLOR_KEYS.forEach(k => c.p[k] = 0); c.p.filt = 'none'; refreshAll(); };
}

// ---------- 6) Çoklu seçim, kutu seçimi, kopyala/yapıştır ----------
function startMarquee(e) {
  if (e.button !== 0) return;
  const inner = $('#tlInner'), x0 = e.clientX, y0 = e.clientY; let box = null;
  const base = (e.ctrlKey || e.shiftKey) ? new Set(selSet) : new Set();
  const mv = ev => {
    if (!box && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!box) { box = document.createElement('div'); box.className = 'marq'; inner.appendChild(box); if (playing) pause(); }
    const r = inner.getBoundingClientRect(), l = Math.min(x0, ev.clientX), t = Math.min(y0, ev.clientY), rr = Math.max(x0, ev.clientX), b = Math.max(y0, ev.clientY);
    Object.assign(box.style, { left: (l - r.left) + 'px', top: (t - r.top) + 'px', width: (rr - l) + 'px', height: (b - t) + 'px' });
    const ids = new Set(base);
    document.querySelectorAll('#tracks .clip').forEach(el => { const q = el.getBoundingClientRect(); if (q.right > l && q.left < rr && q.bottom > t && q.top < b) ids.add(el.dataset.id); });
    keepMulti = true; selSet.clear(); ids.forEach(i => selSet.add(i)); sel = ids.size ? [...ids][ids.size - 1] : null; keepMulti = false;
    document.querySelectorAll('#tracks .clip').forEach(el => el.classList.toggle('sel', selSet.has(el.dataset.id)));
  };
  const up = ev => {
    removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
    if (box) { box.remove(); refreshInsp(); draw(); return; }
    sel = null; if (playing) pause(); seekFromEvent(ev); refreshInsp(); renderTL();
  };
  addEventListener('mousemove', mv); addEventListener('mouseup', up);
}
const selIds = () => { const s = new Set(selSet); if (sel) s.add(sel); return s; };
let clipboard = null;
function copySel() {
  const ids = selIds(), cl = allClips().filter(c => ids.has(c.id)); if (!cl.length) return;
  const t0 = Math.min(...cl.map(c => c.start));
  clipboard = cl.map(c => ({ c: JSON.parse(JSON.stringify(c)), off: c.start - t0, kind: kindOf(c) }));
  status(`${cl.length} klip kopyalandı`); setTimeout(() => status(''), 1200);
}
function pasteClips(at) {
  if (!clipboard) return; commit(); keepMulti = true; selSet.clear();
  for (const it of clipboard) { const c = JSON.parse(JSON.stringify(it.c)); c.id = uid(); c.start = Math.max(0, at + it.off); trackFor(it.kind, c.start, c.dur).clips.push(c); selSet.add(c.id); _sel = c.id; }
  keepMulti = false; refreshAll();
}
function duplicateSel() { const ids = selIds(), cl = allClips().filter(c => ids.has(c.id)); if (!cl.length) return; copySel(); pasteClips(Math.max(...cl.map(c => c.start + c.dur))); }
function selectAll() { const cl = allClips(); keepMulti = true; selSet.clear(); cl.forEach(c => selSet.add(c.id)); _sel = cl[0]?.id || null; keepMulti = false; renderTL(); refreshInsp(); }

// ---------- 7) Mıknatıs ----------
let magnet = false; try { magnet = localStorage.getItem('magnet') === '1'; } catch { }
function toggleMagnet() {
  magnet = !magnet; try { localStorage.setItem('magnet', magnet ? '1' : '0'); } catch { }
  $('#bMagnet').classList.toggle('on', magnet); status(magnet ? 'Mıknatıs açık: silince boşluk kapanır' : 'Mıknatıs kapalı'); setTimeout(() => status(''), 1500);
}
$('#bMagnet').classList.toggle('on', magnet); $('#bMagnet').onclick = toggleMagnet;

// ---------- 10) Eğri editörü (Blender Graph Editor) ----------
let graphOn = false, gView = null, gNorm = false, gSel = [], gFrozen = null, gClipId = null, gMap = null, gHandles = [], gKeys = [], gSideKey = '';
const gHidden = new Set();
const GCOL = { x: '#ff6b6b', y: '#5be08a', scale: '#5aa9ff', rotation: '#ffcc33', opacity: '#c88cff' };
const gcv = $('#gCv'), gctx = gcv.getContext('2d');
function toggleGraph(on = !graphOn) {
  graphOn = on; $('#graph').classList.toggle('hidden', !on); $('#tlScroll').classList.toggle('hidden', on); $('#tlNav').classList.toggle('hidden', on);
  $('#bGraph').classList.toggle('on', on); gSideKey = '';
  if (on) { gView = null; gSel = []; gResize(); } else renderTL();
}
$('#bGraph').onclick = () => toggleGraph();
function gClip() { const f = sel && findClip(sel); return f && kindOf(f.clip) === 'visual' ? f.clip : null; }
function gResize() { const r = gcv.getBoundingClientRect(), dpr = devicePixelRatio || 1; gcv.width = Math.max(10, Math.round(r.width * dpr)); gcv.height = Math.max(10, Math.round(r.height * dpr)); graphDraw(); }
new ResizeObserver(() => { if (graphOn) gResize(); }).observe($('#graph'));
const gProps = c => Object.keys(c.kf || {}).filter(p => c.kf[p] && c.kf[p].length).sort((a, b) => (KF_PROPS.indexOf(a) + 1 || 99) - (KF_PROPS.indexOf(b) + 1 || 99));
function gFit(c) { const pad = Math.max(0.2, c.dur * 0.08); gView = { t0: c.start - pad, t1: c.start + c.dur + pad }; }
function gRanges(c, props) {
  const R = {}; let lo = Infinity, hi = -Infinity;
  for (const p of props) {
    let mn = Infinity, mx = -Infinity;
    for (const k of c.kf[p]) { mn = Math.min(mn, k.v); mx = Math.max(mx, k.v); }
    for (let i = 0; i <= 80; i++) { const v = val(c, p, c.dur * i / 80); mn = Math.min(mn, v); mx = Math.max(mx, v); }
    if (mx - mn < 1e-9) { mn -= 1; mx += 1; }
    R[p] = [mn, mx]; lo = Math.min(lo, mn); hi = Math.max(hi, mx);
  }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  const pad = (hi - lo) * 0.12 || 1; return { R, lo: lo - pad, hi: hi + pad };
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))), n = x / p; return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p; }
const segB = k => (k.e && k.e.b) || PRESETS[k.e && k.e.n] || PRESETS.linear;
function graphDraw() {
  if (!graphOn) return;
  const g = gctx, cw = gcv.width, ch = gcv.height, dpr = devicePixelRatio || 1;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#16161a'; g.fillRect(0, 0, cw, ch);
  const c = gClip(); renderGSide(c);
  if (!c || !gProps(c).length) {
    g.fillStyle = '#8a8a96'; g.font = `${13 * dpr}px Segoe UI, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(T(c ? 'Bu klipte keyframe yok — I tuşuyla ekle' : 'Keyframe\'i olan bir klip seç'),cw / 2, ch / 2); gMap = null; return;
  }
  if (gClipId !== c.id || !gView) { gClipId = c.id; gFit(c); gSel = []; }
  const props = gProps(c).filter(p => !gHidden.has(p));
  const rg = gFrozen || gRanges(c, props);
  const PADT = 20 * dpr, PADB = 10 * dpr, LW = 54 * dpr;
  const X = t => LW + (t - gView.t0) / (gView.t1 - gView.t0) * (cw - LW);
  const Tinv = px => gView.t0 + (px - LW) / (cw - LW) * (gView.t1 - gView.t0);
  const nv = (p, v) => gNorm ? (v - rg.R[p][0]) / (rg.R[p][1] - rg.R[p][0]) : v;
  const [lo, hi] = gNorm ? [-0.12, 1.12] : [rg.lo, rg.hi];
  const Yn = n => PADT + (1 - (n - lo) / (hi - lo)) * (ch - PADT - PADB);
  const Y = (p, v) => Yn(nv(p, v));
  const Vinv = (p, py) => { const n = lo + (1 - (py - PADT) / (ch - PADT - PADB)) * (hi - lo); return gNorm ? rg.R[p][0] + n * (rg.R[p][1] - rg.R[p][0]) : n; };
  gMap = { X, Y, Tinv, Vinv, c, props, dpr, rg };
  g.fillStyle = 'rgba(108,140,255,0.07)'; g.fillRect(X(c.start), 0, X(c.start + c.dur) - X(c.start), ch);
  g.font = `${10 * dpr}px Consolas, monospace`; g.lineWidth = 1; g.strokeStyle = '#25252c'; g.fillStyle = '#6a6a76';
  const stepT = niceStep((gView.t1 - gView.t0) / Math.max(2, (cw - LW) / (90 * dpr)));
  g.textAlign = 'left'; g.textBaseline = 'top';
  for (let t = Math.ceil(gView.t0 / stepT) * stepT; t <= gView.t1; t += stepT) { const x = Math.round(X(t)) + .5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ch); g.stroke(); if (t >= 0) g.fillText(fmt(t), x + 3 * dpr, 3 * dpr); }
  const stepV = niceStep((hi - lo) / Math.max(2, ch / (38 * dpr)));
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) { const y = Math.round(Yn(v)) + .5; g.beginPath(); g.moveTo(LW, y); g.lineTo(cw, y); g.stroke(); g.fillText(String(+v.toFixed(3)), LW - 6 * dpr, y); }
  for (const p of props) {
    g.strokeStyle = GCOL[p]; g.lineWidth = 2 * dpr; g.beginPath();
    for (let px = LW; px <= cw; px += 2) { const v = val(c, p, clamp(Tinv(px) - c.start, 0, c.dur)), y = Y(p, v); px === LW ? g.moveTo(px, y) : g.lineTo(px, y); }
    g.stroke();
  }
  const all = []; props.forEach(p => c.kf[p].forEach((k, i) => all.push({ p, k, i })));
  const showAll = all.length <= 16; gHandles = [];
  for (const { p, k, i } of all) {
    const a = c.kf[p], isSel = gSel.some(s => s.k === k); if (!showAll && !isSel) continue;
    if (i < a.length - 1 && k.e?.n !== 'hold') { const k1 = a[i + 1], b = segB(k); gHandles.push({ p, k0: k, k1, which: 0, x: X(c.start + k.t + b[0] * (k1.t - k.t)), y: Y(p, k.v + b[1] * (k1.v - k.v)), ox: X(c.start + k.t), oy: Y(p, k.v) }); }
    if (i > 0 && a[i - 1].e?.n !== 'hold') { const k0 = a[i - 1], b = segB(k0); gHandles.push({ p, k0, k1: k, which: 2, x: X(c.start + k0.t + b[2] * (k.t - k0.t)), y: Y(p, k0.v + b[3] * (k.v - k0.v)), ox: X(c.start + k.t), oy: Y(p, k.v) }); }
  }
  for (const h of gHandles) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = dpr; g.beginPath(); g.moveTo(h.ox, h.oy); g.lineTo(h.x, h.y); g.stroke(); g.fillStyle = GCOL[h.p]; g.beginPath(); g.arc(h.x, h.y, 4 * dpr, 0, 7); g.fill(); }
  gKeys = all.map(({ p, k }) => ({ p, k, x: X(c.start + k.t), y: Y(p, k.v) }));
  for (const q of gKeys) {
    const s = gSel.some(z => z.k === q.k), r = (s ? 6.5 : 5) * dpr;
    g.fillStyle = s ? '#ffffff' : GCOL[q.p]; g.strokeStyle = '#000'; g.lineWidth = 1.5 * dpr;
    g.beginPath(); g.moveTo(q.x, q.y - r); g.lineTo(q.x + r, q.y); g.lineTo(q.x, q.y + r); g.lineTo(q.x - r, q.y); g.closePath(); g.fill(); g.stroke();
  }
  const px = X(time); g.strokeStyle = '#ff4d5e'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(px, 0); g.lineTo(px, ch); g.stroke();
}
function renderGSide(c) {
  const props = c ? gProps(c) : [];
  const key = (c ? c.id : '') + '|' + props.join() + '|' + [...gHidden].join() + '|' + gNorm + '|' + gSel.length + '|' + (gSel[0]?.k.e?.n || '');
  if (key === gSideKey) return; gSideKey = key;
  const S = $('#gSide');
  S.innerHTML = `<div class="gt">Eğri editörü</div><div class="gc">${c ? esc(clipLabel(c)) : '—'}</div>` +
    props.map(p => `<label class="gp"><input type="checkbox" data-p="${p}" ${gHidden.has(p) ? '' : 'checked'}><i style="background:${GCOL[p]}"></i>${LABELS[p]}</label>`).join('') +
    (props.length ? `<label class="gp"><input type="checkbox" id="gNorm" ${gNorm ? 'checked' : ''}>Normalize</label><button id="gFitB">Sığdır</button>` : '') +
    (gSel.length ? `<div class="gs">Seçili keyframe geçişi<select id="gEase">${Object.entries(PRESET_TR).map(([k, v]) => `<option value="${k}" ${(gSel[0].k.e?.n || 'linear') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : '') +
    `<div class="gs" style="font-size:11px">Sürükle: keyframe/tutamak · Tekerlek: yakınlaş · Shift+Tekerlek: kaydır · Çift tık: sığdır · X: sil</div>`;
  S.querySelectorAll('[data-p]').forEach(i => i.onchange = () => { i.checked ? gHidden.delete(i.dataset.p) : gHidden.add(i.dataset.p); graphDraw(); });
  const nb = $('#gNorm'); if (nb) nb.onchange = e => { gNorm = e.target.checked; graphDraw(); };
  const fb = $('#gFitB'); if (fb) fb.onclick = () => { const c2 = gClip(); if (c2) { gFit(c2); graphDraw(); } };
  const ge = $('#gEase'); if (ge) ge.onchange = () => { commit(); const v = ge.value; for (const s of gSel) s.k.e = v === 'hold' ? { n: 'hold' } : { n: v, b: (PRESETS[v] || [0.42, 0, 0.58, 1]).slice() }; gSideKey = ''; refreshInsp(); draw(); };
}
gcv.onmousedown = e => {
  if (!gMap) return;
  const r = gcv.getBoundingClientRect(), dpr = gMap.dpr, mx = (e.clientX - r.left) * dpr, my = (e.clientY - r.top) * dpr, c = gMap.c;
  const P = ev => [(ev.clientX - r.left) * dpr, (ev.clientY - r.top) * dpr];
  const near = (x, y) => Math.hypot(x - mx, y - my) < 9 * dpr;
  const bind = (mv, up) => { const u = ev => { removeEventListener('mousemove', mv); removeEventListener('mouseup', u); up && up(ev); }; addEventListener('mousemove', mv); addEventListener('mouseup', u); };
  if (e.button === 1 || (e.button === 0 && e.altKey)) { // kaydır
    e.preventDefault(); const v0 = { ...gView }, t0 = gMap.Tinv(mx);
    return bind(ev => { const d = gMap.Tinv(P(ev)[0]) - t0; gView = { t0: v0.t0 - d, t1: v0.t1 - d }; graphDraw(); });
  }
  if (e.button !== 0) return;
  const before = JSON.stringify(proj); let moved = false;
  const h = gHandles.find(q => near(q.x, q.y)), kk = !h && gKeys.find(q => near(q.x, q.y));
  gFrozen = gMap.rg;
  if (h) {
    bind(ev => {
      moved = true; const [px, py] = P(ev), t = gMap.Tinv(px), v = gMap.Vinv(h.p, py), dt = h.k1.t - h.k0.t, dv = h.k1.v - h.k0.v, b = segB(h.k0).slice();
      b[h.which] = +clamp((t - c.start - h.k0.t) / (dt || 1), 0, 1).toFixed(4);
      if (Math.abs(dv) > 1e-9) b[h.which + 1] = +clamp((v - h.k0.v) / dv, -3, 4).toFixed(4);
      h.k0.e = { n: 'bezier', b }; gSideKey = ''; draw();
    }, () => { gFrozen = null; if (moved) { undoS.push(before); redoS.length = 0; dirty = true; } refreshInsp(); draw(); });
  } else if (kk) {
    if (e.shiftKey) { const i = gSel.findIndex(s => s.k === kk.k); i >= 0 ? gSel.splice(i, 1) : gSel.push({ p: kk.p, k: kk.k }); }
    else if (!gSel.some(s => s.k === kk.k)) gSel = [{ p: kk.p, k: kk.k }];
    gSideKey = ''; graphDraw();
    const st = gSel.map(s => ({ s, t: s.k.t, v: s.k.v })), T0 = gMap.Tinv(mx);
    bind(ev => {
      const [px, py] = P(ev); if (!moved && Math.hypot(px - mx, py - my) < 3 * dpr) return; moved = true;
      const dT = gMap.Tinv(px) - T0;
      for (const o of st) {
        o.s.k.t = clamp(Math.round((o.t + dT) * FPS) / FPS, 0, c.dur);
        if (!ev.ctrlKey) o.s.k.v = +(o.v + gMap.Vinv(o.s.p, py) - gMap.Vinv(o.s.p, my)).toFixed(4);
        c.kf[o.s.p].sort((a, b) => a.t - b.t);
      }
      draw(); updateKfButtons();
    }, () => {
      gFrozen = null;
      if (moved) { for (const o of st) c.kf[o.s.p] = c.kf[o.s.p].filter(x => x === o.s.k || Math.abs(x.t - o.s.k.t) >= EPS); undoS.push(before); redoS.length = 0; dirty = true; refreshAll(); }
      else draw();
    });
  } else {
    gFrozen = null; gSel = []; gSideKey = ''; if (playing) pause();
    setTime(gMap.Tinv(mx));
    bind(ev => setTime(Math.max(0, gMap.Tinv(P(ev)[0]))));
  }
};
gcv.addEventListener('wheel', e => {
  if (!gMap || !gView) return; e.preventDefault();
  const r = gcv.getBoundingClientRect(), mx = (e.clientX - r.left) * gMap.dpr;
  if (e.shiftKey) { const d = (gView.t1 - gView.t0) * 0.1 * Math.sign(e.deltaY || e.deltaX); gView.t0 += d; gView.t1 += d; }
  else { const t = gMap.Tinv(mx), f = e.deltaY < 0 ? 0.85 : 1 / 0.85; gView.t0 = t - (t - gView.t0) * f; gView.t1 = t + (gView.t1 - t) * f; }
  graphDraw();
}, { passive: false });
gcv.ondblclick = () => { const c = gClip(); if (c) { gFit(c); graphDraw(); } };
function graphDeleteSel() {
  if (!graphOn || !gSel.length || !gMap) return false;
  commit(); const c = gMap.c;
  for (const s of gSel) { const a = c.kf[s.p] || [], i = a.indexOf(s.k); if (i >= 0) { const v = s.k.v; a.splice(i, 1); if (!a.length) c.p[s.p] = v; } }
  gSel = []; gSideKey = ''; refreshAll(); return true;
}

// ---------- 12) Kısayol listesi ----------
const SHORTCUTS = [['Space', 'Oynat / durdur'], ['K', "Playhead'de kes"], ['X / Delete', 'Seçili klipleri sil'], ['Shift+A', 'Ekle menüsü'], ['T', 'Metin ekle'], ['I', 'Keyframe ekle'],
  ['M', 'Mıknatıs aç / kapa'], ['Tab', 'Zaman çizelgesi ↔ Eğri editörü'], ['Ctrl+tık / Shift+tık', 'Çoklu seçim'], ['Boş alanda sürükle', 'Kutu ile seçim'], ['Ctrl+A', 'Hepsini seç'],
  ['Ctrl+C / Ctrl+V', 'Kopyala / playhead\'e yapıştır'], ['Ctrl+D', 'Çoğalt'], ['Ctrl+Z / Ctrl+Y', 'Geri al / ileri al'], ['Ctrl+S', 'Kaydet'], ['← / →', '1 kare geri / ileri'],
  ['Shift+← / →', '1 saniye geri / ileri'], ['Home', 'Başa dön'], ['Ctrl+Tekerlek', 'Zaman çizelgesini yakınlaştır'], ['Tekerlek (önizleme)', 'Seçili klibi büyüt / küçült'],
  ['Alt+sürükle (eğri)', 'Eğri editöründe kaydır'], ['Esc', 'Seçimi kaldır'], ['? / F1', 'Bu liste'], ['F12', 'Geliştirici araçları']];
function showShortcuts() { dialog({ title: 'Kısayollar', wide: true, html: `<div class="kbgrid">${SHORTCUTS.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('')}</div>`, buttons: [{ label: 'Kapat', v: 'ok', cls: 'primary' }] }); }
$('#bKeys').onclick = showShortcuts;

// ---------- 1) Otomatik altyazı ----------
let asrWorker = null, asrBusy = false;
window.api.onAsrProgress(d => { if (asrBusy) { $('#mText').textContent = d.msg; $('#mBar').style.width = (d.p * 100) + '%'; } });
async function autoSubtitles() {
  if (playing) pause();
  const audio = audioList(true), D = duration();
  if (!audio.length || D <= 0) return dialog({ title: 'Otomatik altyazı', text: 'Zaman çizelgesinde konuşma içeren video veya ses yok.', buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] });
  const styles = [['altyazi', 'Altyazı'], ['baslik', 'Başlık'], ['neon', 'Neon'], ['altin', 'Altın'], ['etiket', 'Etiket']];
  const r = await dialog({
    title: 'Otomatik altyazı', text: 'Konuşma bilgisayarında yazıya dökülür, hiçbir yere gönderilmez. İlk kullanımda model bir kez indirilir. "Müzik" olarak işaretli sesler dinlenmez.',
    html: `<div class="row"><label>Dil</label><select id="sLang"><option value="turkish">Türkçe</option><option value="english">İngilizce</option><option value="auto">Otomatik algıla</option></select><span></span></div>
      <div class="row"><label>Kalite</label><select id="sModel"><option value="small">Kaliteli (253 MB)</option><option value="base">Hızlı (81 MB)</option></select><span></span></div>
      <div class="row"><label>Stil</label><select id="sStyle">${styles.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select><span></span></div>
      <div class="row"><label>Kelime / altyazı</label><input id="sWords" type="number" value="4" min="1" max="15"><span></span></div>
      <div class="row"><label>Konum</label><select id="sPos"><option value="0.28">Alt</option><option value="0">Orta</option><option value="-0.3">Üst</option></select><span></span></div>
      <div class="row"><label>Kelime efekti</label><select id="sK">${K_STYLES.map(([k, n]) => `<option value="${k}" ${k === 'karaoke' ? 'selected' : ''}>${n}</option>`).join('')}</select><span></span></div>
      <div class="row"><label>Vurgu rengi</label><input id="sKC" type="color" value="#ffd23f"><span></span></div>`,
    buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Oluştur', v: 'ok', cls: 'primary' }]
  });
  if (r.v !== 'ok') return;
  const kStyle = $('#sK').value, kColor = $('#sKC').value, lang = $('#sLang').value, mkey = $('#sModel').value, style = $('#sStyle').value, perN = clamp(+$('#sWords').value || 4, 1, 15), pos = +$('#sPos').value;
  asrBusy = true; let cancelled = false, t0 = performance.now(), timer = null;
  $('#mText').textContent = 'Hazırlanıyor…'; $('#mBar').style.width = '0%'; $('#modal').classList.remove('hidden');
  $('#mCancel').onclick = () => { cancelled = true; if (asrWorker) { asrWorker.terminate(); asrWorker = null; } finish('İptal edildi'); };
  const finish = msg => { asrBusy = false; clearInterval(timer); $('#modal').classList.add('hidden'); if (msg) { status(msg); setTimeout(() => status(''), 4000); } };
  try {
    const model = await window.api.asrEnsure(mkey); if (cancelled) return;
    $('#mText').textContent = 'Ses hazırlanıyor…'; $('#mBar').style.width = '100%';
    const pcm = await window.api.asrAudio({ audio, duration: D }); if (cancelled) return;
    const u8 = new Uint8Array(pcm), f32 = new Float32Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    if (!asrWorker) asrWorker = new Worker('asr-worker.js', { type: 'module' });
    let phase = 'Model yükleniyor…';
    timer = setInterval(() => { $('#mText').textContent = `${phase} (${Math.round((performance.now() - t0) / 1000)} sn)`; }, 500);
    const R = await new Promise((res, rej) => {
      asrWorker.onmessage = ev => { const d = ev.data; if (d.type === 'status') phase = d.msg; else if (d.type === 'done') res({ chunks: d.chunks, words: !!d.words }); else if (d.type === 'error') rej(new Error(d.msg)); };
      asrWorker.onerror = ev => rej(new Error(ev.message || 'Çalışan hatası'));
      asrWorker.postMessage({ model, audio: f32, language: lang, words: kStyle !== 'none' }, [f32.buffer]);
    });
    if (cancelled) return;
    const n = buildSubtitles(R.chunks, D, style, perN, pos, { kStyle, kColor, wordLevel: R.words });
    finish(n ? `${n} altyazı eklendi` : 'Konuşma bulunamadı');
  } catch (err) { if (!cancelled) { finish(); dialog({ title: 'Altyazı oluşturulamadı', text: String(err.message || err), buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] }); } }
}
function buildSubtitles(chunks, D, style, perN, pos, K = {}) {
  // önce kelime listesi: Whisper kelime zamanı verdiyse onu, vermediyse cümle süresini hece ağırlığıyla kelimelere dağıt
  const words = [];
  if (K.wordLevel) for (const ch of chunks) {
    const w = String(ch.text || '').trim(); let [s, e] = ch.timestamp || []; if (!w || s == null || /^[\[\(].*[\]\)]$/.test(w)) continue;
    if (e == null || e < s) e = s + 0.3; if (/^[.,!?;:…]+$/.test(w) && words.length) { words[words.length - 1].w += w; continue; } words.push({ w, s, e: Math.min(D, e) });
  } else chunks.forEach((ch, idx) => {
    const text = String(ch.text || '').replace(/\s+/g, ' ').trim(); if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) return;
    let [s, e] = ch.timestamp || [0, D]; if (s == null) s = 0; if (e == null) e = chunks[idx + 1]?.timestamp?.[0] ?? Math.min(D, s + 4); e = Math.min(D, Math.max(e, s + 0.3));
    const ws = text.split(' '), wt = ws.map(syllW), tot = wt.reduce((x, y) => x + y, 0); let t = s;
    ws.forEach((w, i) => { const d = (e - s) * wt[i] / tot; words.push({ w, s: t, e: t + d }); t += d; });
  });
  const groups = []; let g = [];
  for (const w of words) { if (g.length && (g.length >= perN || w.s - g[g.length - 1].e > 0.6)) { groups.push(g); g = []; } g.push(w); }
  if (g.length) groups.push(g);
  const items = groups.map((g, i) => {
    const s = g[0].s, nx = groups[i + 1]?.[0].s; let e = Math.max(g[g.length - 1].e, s + 0.25);
    if (nx != null) e = nx - e < 0.35 ? nx : Math.min(e, nx);
    return [s, Math.max(0.2, e - s), g.map(w => w.w).join(' '), g.map(w => ({ w: w.w, s: +(w.s - s).toFixed(3), e: +(w.e - s).toFixed(3) }))];
  });
  if (!items.length) return 0;
  commit();
  const tr = { id: uid(), kind: 'visual', clips: [] }; proj.tracks.unshift(tr);
  const sc = Math.min(W, H) / 1080;
  for (const [s, d, txt, wl] of items) {
    const p = Object.assign(baseP(), JSON.parse(JSON.stringify(TEXT_DEF)), JSON.parse(JSON.stringify(TEXT_PRESETS[style] || {})), { text: txt, y: Math.round(H * pos) });
    p.size = Math.round((p.size || 80) * sc * (style === 'altyazi' ? 1.05 : 0.8));
    if (K.kStyle && K.kStyle !== 'none') { p.kStyle = K.kStyle; p.kColor = K.kColor || '#ffd23f'; p.words = wl; }
    tr.clips.push({ id: uid(), type: 'text', name: 'Altyazı', start: +s.toFixed(3), in: 0, dur: +d.toFixed(3), p, kf: {} });
  }
  sel = null; refreshAll(); return items.length;
}
$('#bSubs').onclick = autoSubtitles;

// ---------- Ekle menüsü ek öğeleri ----------
function extraMenuItems() {
  return [
    { icon: '◆', label: 'Şekil', sub: SHAPES.map(([k, n, ic]) => ({ icon: ic, label: n, act: () => addShape(k) })) },
    { icon: '☺', label: 'Çıkartma', sub: STICKERS.map(s => ({ icon: s, label: s, act: () => addSticker(s) })) },
    { icon: '🔊', label: 'Ses efekti', sub: SFX_LIST.length ? SFX_LIST.map(s => ({ icon: '♪', label: s.name, act: () => addSfx(s) })) : [{ label: '(yükleniyor…)', disabled: 1 }] },
    { icon: '✎', label: 'Otomatik altyazı', act: autoSubtitles }
  ];
}

// ---------- Başlat ----------
(async () => {
  library = await window.api.libLoad(); renderLib();
  try { const l = await window.api.projList(); if (!l.length) { const s = await window.api.autoLoad(); if (s && s.proj && s.proj.tracks && s.proj.tracks.some(t => t.clips.length)) await window.api.projSave({ id: uid(), name: 'Önceki çalışma', time: 0, thumb: '', proj: s.proj }); } } catch { }
  refreshAll(); showHome();
})();

// ---------- Dolap: gruplar, silme, çoklu seçim ----------
const libSel = new Set();
function libItemEl(m) {
  const d = document.createElement('div'); d.className = 'li' + (libSel.has(m.id) ? ' lsel' : ''); d.draggable = true; d.title = m.path;
  d.innerHTML = (m.thumb ? `<img src="${m.thumb}">` : `<div class="ic">${m.kind === 'audio' ? '♪' : '▣'}</div>`) + `<div class="n"></div><button class="x" title="Sil">×</button>`;
  const nEl = d.querySelector('.n'); nEl.innerHTML = (m.kind === 'audio' ? '♪ ' : '') + hl(m.alias || m.name);
  if (libQuery && m.alias && !norm(m.alias).includes(libQuery) && norm(m.name).includes(libQuery)) nEl.insertAdjacentHTML('afterend', `<div class="n n2">${hl(m.name)}</div>`); if (m.alias) d.title = m.alias + '\n' + m.path;
  d.querySelector('.n').ondblclick = e => { e.stopPropagation(); aliasItem(m); };
  d.ondragstart = e => e.dataTransfer.setData('text/media', m.id);
  d.onclick = e => { if (e.ctrlKey || e.shiftKey) { libSel.has(m.id) ? libSel.delete(m.id) : libSel.add(m.id); } else { libSel.clear(); libSel.add(m.id); } renderLib(); };
  d.ondblclick = () => { commit(); addMediaClip(m, time); refreshAll(); };
  d.oncontextmenu = e => { e.preventDefault(); if (!libSel.has(m.id)) { libSel.clear(); libSel.add(m.id); renderLib(); } libMenu(e.clientX, e.clientY); };
  d.querySelector('.x').onclick = e => { e.stopPropagation(); if (!libSel.has(m.id)) { libSel.clear(); libSel.add(m.id); } libDelete(); };
  window.api.exists(m.path).then(ok => { if (!ok) d.classList.add('miss'); });
  return d;
}
function renderLib() {
  const L = $('#libList'); L.innerHTML = '';
  const shown = library.filter(m => !libQuery || norm(m.alias || '').includes(libQuery) || norm(m.name).includes(libQuery));
  const groups = [...new Set(shown.map(m => m.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  for (const g of groups) {
    const sec = document.createElement('div'); sec.className = 'lgrp';
    const hd = document.createElement('div'); hd.className = 'lgh'; hd.textContent = g;
    hd.oncontextmenu = e => { e.preventDefault(); grpMenu(e.clientX, e.clientY, g); };
    hd.ondblclick = () => renameGroup(g);
    const gr = document.createElement('div'); gr.className = 'lgrid';
    shown.filter(m => m.group === g).forEach(m => gr.appendChild(libItemEl(m)));
    sec.append(hd, gr);
    sec.ondragover = e => { if (e.dataTransfer.types.includes('text/media')) { e.preventDefault(); sec.classList.add('over'); } };
    sec.ondragleave = () => sec.classList.remove('over');
    sec.ondrop = e => { e.preventDefault(); e.stopPropagation(); sec.classList.remove('over'); const id = e.dataTransfer.getData('text/media'); const m = library.find(x => x.id === id); if (m) { (libSel.has(id) ? library.filter(x => libSel.has(x.id)) : [m]).forEach(x => x.group = g); saveLib(); } };
    L.appendChild(sec);
  }
  const rest = shown.filter(m => !m.group);
  if (libQuery && !shown.length) { L.innerHTML = '<div class="lnone">Sonuç yok</div>'; return; }
  const gr = document.createElement('div'); gr.className = 'lgrid lrest';
  rest.forEach(m => gr.appendChild(libItemEl(m)));
  gr.ondragover = e => { if (e.dataTransfer.types.includes('text/media')) e.preventDefault(); };
  gr.ondrop = e => { const id = e.dataTransfer.getData('text/media'); const m = library.find(x => x.id === id); if (m && m.group) { e.preventDefault(); e.stopPropagation(); (libSel.has(id) ? library.filter(x => libSel.has(x.id)) : [m]).forEach(x => delete x.group); saveLib(); } };
  L.appendChild(gr);
}
async function saveLib() { await window.api.libSave(library); renderLib(); }
function libDelete() {
  const n = libSel.size; if (!n) return;
  library = library.filter(m => !libSel.has(m.id)); libSel.clear(); saveLib();
  status(`${n} öğe dolaptan silindi`); setTimeout(() => status(''), 1500);
}
async function newGroupFor() {
  const r = await dialog({ title: 'Yeni grup', text: 'Grup adı:', input: 'Grup ' + (new Set(library.map(m => m.group).filter(Boolean)).size + 1), buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Oluştur', v: 'ok', cls: 'primary' }] });
  const name = r.text.trim(); if (r.v !== 'ok' || !name) return;
  library.filter(m => libSel.has(m.id)).forEach(m => m.group = name); saveLib();
}
async function renameGroup(g) {
  const r = await dialog({ title: 'Grubu yeniden adlandır', input: g, buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Kaydet', v: 'ok', cls: 'primary' }] });
  const name = r.text.trim(); if (r.v !== 'ok' || !name) return;
  library.forEach(m => { if (m.group === g) m.group = name; }); saveLib();
}
function ctxMenu(x, y, title, items) {
  closeAddMenu();
  menuRoot = document.createElement('div'); menuRoot.id = 'bmenuRoot';
  const m = document.createElement('div'); m.className = 'bmenu'; m.innerHTML = `<div class="bt"></div><div class="blist"></div>`; m.querySelector('.bt').textContent = title;
  menuRoot.appendChild(m); document.body.appendChild(menuRoot); buildList(items, m.querySelector('.blist'), 0);
  const r = m.getBoundingClientRect(); m.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px'; m.style.top = clamp(y, 4, innerHeight - r.height - 4) + 'px';
}
function libMenu(x, y) {
  const groups = [...new Set(library.map(m => m.group).filter(Boolean))];
  const inGroup = library.some(m => libSel.has(m.id) && m.group);
  ctxMenu(x, y, libSel.size > 1 ? `${libSel.size} öğe` : 'Dolap', [
    { icon: '▶', label: "Playhead'e ekle", act: () => { commit(); let s = time; library.filter(m => libSel.has(m.id)).forEach(m => { const c = addMediaClip(m, s); s += c.dur; }); refreshAll(); } },
    ...(libSel.size === 1 ? [{ icon: '✂', label: 'Düzenle (kes, ses, hız)…', act: () => editLibItem(library.find(m => libSel.has(m.id))) }, { icon: '✎', label: 'Takma ad ver…', key: 'F2', act: () => aliasItem(library.find(m => libSel.has(m.id))) }] : []),
    { sep: 1 },
    { icon: '＋', label: 'Yeni gruba ekle…', key: 'Ctrl+G', act: newGroupFor },
    ...(groups.length ? [{ icon: '⧉', label: 'Gruba taşı', sub: groups.map(g => ({ icon: '▤', label: g, act: () => { library.filter(m => libSel.has(m.id)).forEach(m => m.group = g); saveLib(); } })) }] : []),
    ...(inGroup ? [{ icon: '⤴', label: 'Gruptan çıkar', act: () => { library.filter(m => libSel.has(m.id)).forEach(m => delete m.group); saveLib(); } }] : []),
    { sep: 1 },
    { icon: '✕', label: 'Dolaptan sil', key: 'Del', act: libDelete }
  ]);
}
function grpMenu(x, y, g) {
  ctxMenu(x, y, g, [
    { icon: '✎', label: 'Yeniden adlandır', act: () => renameGroup(g) },
    { icon: '⤴', label: 'Grubu dağıt', act: () => { library.forEach(m => { if (m.group === g) delete m.group; }); saveLib(); } },
    { icon: '✕', label: 'Grubu içindekilerle sil', act: () => { library = library.filter(m => m.group !== g); saveLib(); } }
  ]);
}
$('#libList').addEventListener('keydown', e => e.stopPropagation());
$('#lib').addEventListener('mousedown', e => { if (e.target.id === 'libList') { libSel.clear(); renderLib(); } });
addEventListener('keydown', e => { if ((e.key === 'Delete') && libSel.size && document.activeElement === document.body && $('#lib').matches(':hover')) { e.stopImmediatePropagation(); libDelete(); } }, true);

async function aliasItem(m) {
  if (!m) return;
  const r = await dialog({ title: 'Takma ad', text: m.name, input: m.alias || m.name.replace(/\.[^.]+$/, ''), buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, ...(m.alias ? [{ label: 'Kaldır', v: 'del' }] : []), { label: 'Kaydet', v: 'ok', cls: 'primary' }] });
  if (r.v === 'cancel') return;
  const old = m.alias || m.name, nw = r.v === 'del' ? '' : r.text.trim();
  if (nw) m.alias = nw; else delete m.alias;
  if (proj.media[m.id]) proj.media[m.id].alias = m.alias;
  for (const c of allClips()) if (c.mediaId === m.id && c.name === old) c.name = m.alias || m.name;
  dirty = true; await saveLib(); renderTL(); refreshInsp();
}
addEventListener('keydown', e => { if (e.key === 'F2' && libSel.size === 1 && $('#lib').matches(':hover') && !$('#dlg').classList.contains('hidden') === false) { e.preventDefault(); e.stopImmediatePropagation(); aliasItem(library.find(m => libSel.has(m.id))); } }, true);

// ---- Dolap arama ----
let libQuery = '';
const norm = s => String(s || '').toLocaleLowerCase('tr');
function hl(text) {
  const t = String(text); if (!libQuery) return esc(t);
  const low = norm(t); let out = '', i = 0, j;
  while ((j = low.indexOf(libQuery, i)) >= 0 && libQuery) { out += esc(t.slice(i, j)) + '<mark>' + esc(t.slice(j, j + libQuery.length)) + '</mark>'; i = j + libQuery.length; }
  return out + esc(t.slice(i));
}
const libQ = $('#libQ');
function doLibSearch() { libQuery = norm(libQ.value.trim()); $('#libQx').style.visibility = libQ.value ? 'visible' : 'hidden'; renderLib(); }
libQ.oninput = doLibSearch;
libQ.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') doLibSearch(); if (e.key === 'Escape') { libQ.value = ''; doLibSearch(); libQ.blur(); } };
$('#libQgo').onclick = doLibSearch;
$('#libQx').onclick = () => { libQ.value = ''; doLibSearch(); libQ.focus(); };
$('#libQx').style.visibility = 'hidden';

// ---- Açılır listeler: yerel açılır pencere yerine uygulama içi menü (Windows'ta güvenilir) ----
document.addEventListener('mousedown', e => {
  const s = e.target.closest && e.target.closest('select'); if (!s || e.button !== 0 || s.disabled) return;
  e.preventDefault(); e.stopPropagation();
  if (menuRoot && menuRoot._for === s) return closeAddMenu();
  const r = s.getBoundingClientRect();
  ctxMenu(r.left, r.bottom + 2, '', [...s.options].map(o => ({ icon: o.selected ? '✓' : '', label: o.textContent, act: () => { if (s.value !== o.value) { s.value = o.value; s.dispatchEvent(new Event('change', { bubbles: true })); } } })));
  menuRoot._for = s;
  const m = menuRoot.querySelector('.bmenu'); m.style.minWidth = Math.max(r.width, 120) + 'px'; const bt = m.querySelector('.bt'); if (bt) bt.remove();
  const mr = m.getBoundingClientRect(); if (mr.bottom > innerHeight - 4) m.style.top = Math.max(4, r.top - mr.height - 2) + 'px';
}, true);

// ---------- Hazır metin animasyonları ----------
const T_IN = [['none', 'Yok'], ['pop', 'Pop (harf harf)'], ['popWord', 'Pop (kelime kelime)'], ['drop', 'Yukarıdan düş'], ['rise', 'Aşağıdan yüksel'], ['fadeL', 'Harf harf belir'], ['zoomL', 'Büyükten küçül'], ['spinL', 'Dönerek gel'], ['bounce', 'Zıpla'], ['blurL', 'Bulanıktan netleş'], ['slideL', 'Soldan kay']];
const T_LOOP = [['none', 'Yok'], ['wave', 'Dalga'], ['shake', 'Titreme'], ['pulse', 'Nabız'], ['float', 'Süzülme'], ['rainbow', 'Gökkuşağı'], ['glitch', 'Glitch'], ['wiggle', 'Sallanma']];
Object.assign(TEXT_DEF, { tAnim: 'none', tAnimD: 0.6, tOut: 'none', tLoop: 'none', tLoopS: 1 });
{ const g = TEXT_GROUPS.find(x => x[0] === 'Animasyon'); g[1].unshift(['tAnim', 'Giriş', 'sel', T_IN], ['tAnimD', 'Giriş süresi', 'num', 0.1], ['tOut', 'Çıkış', 'sel', T_IN], ['tLoop', 'Sürekli', 'sel', T_LOOP], ['tLoopS', 'Sürekli hız', 'num', 0.1]); }
const rnd = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
function charFx(type, k, w, lh) { // k: 0 başlangıç → 1 bitti
  const S = { dx: 0, dy: 0, s: 1, r: 0, a: 1, blur: 0 }; if (k >= 1) return S; const e = outCubic(k), q = 1 - e;
  switch (type) {
    case 'pop': case 'popWord': S.s = Math.max(0.001, outBack(k)); S.a = Math.min(1, k * 3); break;
    case 'drop': S.dy = -lh * 1.5 * (1 - outBack(k)); S.a = Math.min(1, k * 2); break;
    case 'rise': S.dy = lh * q; S.a = e; break;
    case 'fadeL': S.a = e; break;
    case 'zoomL': S.s = 1 + 2.5 * q; S.a = e; break;
    case 'spinL': S.r = -180 * q; S.s = Math.max(0.001, e); break;
    case 'bounce': { const b = 1 - Math.abs(Math.cos(k * Math.PI * 2.5)) * (1 - k); S.dy = -lh * 0.8 * (1 - b) * (1 - k); S.a = Math.min(1, k * 4); break; }
    case 'blurL': S.blur = 18 * q; S.a = e; break;
    case 'slideL': S.dx = -w * 3 * q; S.a = e; break;
  }
  return S;
}
function drawTextAnim(g2, c, L, lines, y0, lt, fill) {
  const p = L.p, D = Math.max(0.05, p.tAnimD || 0.6), sp = p.tLoopS || 1;
  const total = L.ls.join('').length, stag = Math.min(0.06, D * 0.8 / Math.max(1, total)), dur = D - stag * Math.max(0, total - 1) > 0.15 ? D - stag * Math.max(0, total - 1) : 0.15;
  let gi = 0, wi = 0; const words = [];
  g2.textAlign = 'center';
  L.ls.forEach((full, j) => {
    const vis = lines[j] || '', y = y0 + j * L.lh, lw = L.ws[j];
    const x0 = p.align === 'left' ? -L.w / 2 : p.align === 'right' ? L.w / 2 - lw : -lw / 2;
    for (let i = 0; i < full.length; i++, gi++) {
      const ch = full[i]; if (ch === ' ') { wi++; continue; }
      if (i >= vis.length) continue;
      const xa = g2.measureText(full.slice(0, i)).width, cw = g2.measureText(ch).width, cx = x0 + xa + cw / 2;
      const idx = p.tAnim === 'popWord' ? wi : gi, n = p.tAnim === 'popWord' ? Math.max(1, full.split(' ').length) : total;
      const st = p.tAnim === 'popWord' ? Math.min(0.15, D * 0.7 / n) : stag;
      let F = charFx(p.tAnim, clamp((lt - idx * st) / dur, 0, 1), cw, L.lh);
      if (p.tOut && p.tOut !== 'none') { const ko = clamp((c.dur - lt - (total - 1 - gi) * stag * 0.5) / dur, 0, 1); if (ko < 1) { const O = charFx(p.tOut, ko, cw, L.lh); F = { dx: F.dx + O.dx, dy: F.dy + O.dy, s: F.s * O.s, r: F.r + O.r, a: F.a * O.a, blur: F.blur + O.blur }; } }
      let col = null; const T = lt * sp;
      switch (p.tLoop) {
        case 'wave': F.dy += Math.sin(T * 6 - gi * 0.6) * L.lh * 0.12; break;
        case 'shake': F.dx += (rnd(gi, Math.floor(T * 20)) - 0.5) * cw * 0.18; F.dy += (rnd(gi + 99, Math.floor(T * 20)) - 0.5) * L.lh * 0.1; break;
        case 'pulse': F.s *= 1 + Math.sin(T * 6) * 0.08; break;
        case 'float': F.dy += Math.sin(T * 2.5 + gi * 0.35) * L.lh * 0.06; break;
        case 'wiggle': F.r += Math.sin(T * 8 + gi) * 10; break;
        case 'rainbow': col = `hsl(${(gi * 25 + T * 180) % 360},90%,60%)`; break;
        case 'glitch': if (rnd(gi, Math.floor(T * 12)) > 0.85) { F.dx += (rnd(gi, Math.floor(T * 30)) - 0.5) * cw * 0.6; col = rnd(gi + 7, Math.floor(T * 12)) > 0.5 ? '#ff2e63' : '#08d9d6'; } break;
      }
      if (F.a <= 0.001) continue;
      g2.save(); g2.globalAlpha *= clamp(F.a, 0, 1); if (F.blur > 0.3) g2.filter = `blur(${F.blur.toFixed(1)}px)`;
      g2.translate(cx + F.dx, y + F.dy); g2.rotate(F.r * Math.PI / 180); g2.scale(F.s, F.s);
      if (p.shadow) { g2.save(); g2.shadowColor = p.shColor; g2.shadowBlur = p.shBlur; g2.shadowOffsetX = p.shX; g2.shadowOffsetY = p.shY; g2.fillStyle = p.shColor; g2.fillText(ch, 0, 0); g2.restore(); }
      if (p.glow) { g2.save(); g2.shadowColor = p.glowColor; g2.shadowBlur = p.glowBlur; g2.fillStyle = p.glowColor; g2.fillText(ch, 0, 0); g2.fillText(ch, 0, 0); g2.restore(); }
      if (p.strokeW > 0) { g2.lineWidth = p.strokeW * 2; g2.strokeStyle = p.stroke; g2.strokeText(ch, 0, 0); }
      g2.fillStyle = col || fill(); g2.fillText(ch, 0, 0);
      g2.restore();
    }
    wi++;
  });
}
function applyTextAnim(k, v) {
  let f = sel && findClip(sel);
  if (!f || f.clip.type !== 'text') { addText(); f = findClip(sel); } else commit();
  f.clip.p[k] = v; refreshAll(); status('Animasyon uygulandı'); setTimeout(() => status(''), 1200);
}
{
  const old = extraMenuItems;
  extraMenuItems = () => [...old(), { icon: '✦', label: 'Metin animasyonu', sub: [
    ...T_IN.slice(1).map(([k, n]) => ({ icon: '⇥', label: 'Giriş: ' + n, act: () => applyTextAnim('tAnim', k) })), { sep: 1 },
    ...T_IN.slice(1).map(([k, n]) => ({ icon: '⇤', label: 'Çıkış: ' + n, act: () => applyTextAnim('tOut', k) })), { sep: 1 },
    ...T_LOOP.slice(1).map(([k, n]) => ({ icon: '∿', label: 'Sürekli: ' + n, act: () => applyTextAnim('tLoop', k) }))] }];
}

// ---- Kaydırıcıların yanında değer göster ----
function showRangeVals() { document.querySelectorAll('#inspBody input[type=range]:not(#i_speed)').forEach(r => { const s = r.nextElementSibling; if (s && s.tagName === 'SPAN') { s.className = 'rv'; s.textContent = (+r.value).toFixed(2); } }); }
document.addEventListener('input', e => { if (e.target.type === 'range' && e.target.id !== 'i_speed') { const s = e.target.nextElementSibling; if (s && s.tagName === 'SPAN') { s.className = 'rv'; s.textContent = (+e.target.value).toFixed(2); } } });
new MutationObserver(showRangeVals).observe($('#inspBody'), { childList: true });

// ---------- Ses efektleri (Shift+A → Ses efekti) ----------
let SFX_LIST = [];
window.api.sfxList().then(l => { SFX_LIST = l || []; }).catch(() => {});
async function addSfx(s) {
  const [m] = await importPaths([s.path], { quiet: true }); if (!m) return;
  if (!m.alias || (s.custom && m.alias !== s.name)) { m.alias = s.name; await window.api.libSave(library); renderLib(); }
  commit(); addMediaClip(m, time, undefined, typeof sfxEdOf === 'function' ? sfxEdOf(s) : undefined); refreshAll(); status(s.name + ' eklendi'); setTimeout(() => status(''), 2500);
}

// ---------- Kaydırıcılar: kendi çizdiğimiz çubuk (Windows'ta yerel çizim güvenilir değil) ----------
function rsDecorate(r) {
  if (r._rsv || !r.parentElement || !r.parentElement.classList.contains('row')) return;
  const v = document.createElement('div'); v.className = 'rsv'; v.innerHTML = '<i class="rs-tr"></i><i class="rs-fl"></i><i class="rs-th"></i>';
  if (r.dataset.tick != null) { const mn = r.min === '' ? 0 : +r.min, mx = r.max === '' ? 100 : +r.max, k = (+r.dataset.tick - mn) / (mx - mn); const t = document.createElement('i'); t.className = 'rs-tick'; t.style.left = `calc((100% - 15px) * ${k} + 7.5px)`; v.insertBefore(t, v.lastChild); }
  r.parentElement.insertBefore(v, r); r._rsv = v; r.classList.add('rs-in'); rsPaint(r);
  // Sürüklemeyi kendimiz okuyoruz: Windows'ta yerel kaydırıcının genişliği 0 sayılıp hep en küçük değere gidiyordu
  const setFrom = e => {
    const rc = v.getBoundingClientRect(); if (rc.width <= 15) return;
    const mn = r.min === '' ? 0 : +r.min, mx = r.max === '' ? 100 : +r.max, st = r.step === 'any' ? 0 : (+r.step || 1);
    let val = mn + Math.min(1, Math.max(0, (e.clientX - rc.left - 7.5) / (rc.width - 15))) * (mx - mn);
    if (st) val = Math.min(mx, Math.max(mn, mn + Math.round((val - mn) / st) * st));
    const s = String(+val.toFixed(6)); if (r.value === s) return;
    r.value = s; rsPaint(r); r.dispatchEvent(new Event('input', { bubbles: true }));
  };
  v.addEventListener('pointerdown', e => {
    if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); v.setPointerCapture(e.pointerId); v.classList.add('drag'); const v0 = r.value; if (typeof r.onpointerdown === 'function') r.onpointerdown(e); setFrom(e);
    const mv = ev => setFrom(ev);
    const up = () => { v.removeEventListener('pointermove', mv); v.removeEventListener('pointerup', up); v.removeEventListener('pointercancel', up); v.classList.remove('drag'); if (r.value !== v0) r.dispatchEvent(new Event('change', { bubbles: true })); };
    v.addEventListener('pointermove', mv); v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  });
}
function rsPaint(r) {
  const v = r._rsv; if (!v) return; const mn = r.min === '' ? 0 : +r.min, mx = r.max === '' ? 100 : +r.max, k = mx > mn ? Math.min(1, Math.max(0, (+r.value - mn) / (mx - mn))) : 0;
  v.style.setProperty('--k', k);
}
const rsScan = () => document.querySelectorAll('.row > input[type=range]').forEach(r => r._rsv ? rsPaint(r) : rsDecorate(r));
new MutationObserver(rsScan).observe(document.body, { childList: true, subtree: true });
document.addEventListener('input', e => { if (e.target._rsv) rsPaint(e.target); }, true);
document.addEventListener('change', e => { if (e.target._rsv) rsPaint(e.target); }, true);
rsScan();
