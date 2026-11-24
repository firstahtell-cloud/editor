// ===================== Ek özellikler (3) =====================
// 1) Kelime kelime altyazı  2) Sessizlikleri otomatik kesme  3) Yeşil ekran

// ---------- 1) Kelime kelime altyazı ----------
const syllW = w => Math.max(1, (String(w).match(/[aeıioöuüâîûAEIİOÖUÜ]/g) || []).length) + 0.4; // hece sayısı ≈ söyleme süresi
const K_STYLES = [['none', 'Yok'], ['karaoke', 'Karaoke (kelime renklenir)'], ['single', 'Tek kelime'], ['bounce', 'Vurgu + zıplama']];
Object.assign(TEXT_DEF, { kStyle: 'none', kColor: '#ffd23f', kScale: 1.25 });
{ const g = TEXT_GROUPS.find(x => x[0] === 'Animasyon'); g[1].unshift(['kStyle', 'Kelime vurgusu', 'sel', K_STYLES], ['kColor', 'Vurgu rengi', 'color'], ['kScale', 'Vurgu büyüklüğü', 'num', 0.05]); }
// Kelime zamanları (klibe göre saniye). Metin değiştiyse ya da zaman yoksa hece ağırlığıyla tahmin edilir.
function wordTimes(c, toks) {
  const ws = c.p.words;
  if (Array.isArray(ws) && ws.length === toks.length) return ws.map(w => [w.s, w.e]);
  const wt = toks.map(syllW), tot = wt.reduce((a, b) => a + b, 0) || 1; let t = 0;
  return wt.map(x => { const d = c.dur * x / tot, r = [t, t + d]; t += d; return r; });
}
function drawWordStr(g2, p, txt, x, y, color) {
  if (p.shadow) { g2.save(); g2.shadowColor = p.shColor; g2.shadowBlur = p.shBlur; g2.shadowOffsetX = p.shX; g2.shadowOffsetY = p.shY; g2.fillStyle = p.shColor; if (p.strokeW > 0) { g2.lineWidth = p.strokeW * 2; g2.strokeStyle = p.shColor; g2.strokeText(txt, x, y); } g2.fillText(txt, x, y); g2.restore(); }
  if (p.glow) { g2.save(); g2.shadowColor = p.glowColor; g2.shadowBlur = p.glowBlur; g2.fillStyle = p.glowColor; g2.fillText(txt, x, y); g2.fillText(txt, x, y); g2.restore(); }
  if (p.strokeW > 0) { g2.lineWidth = p.strokeW * 2; g2.strokeStyle = p.stroke; g2.strokeText(txt, x, y); }
  g2.fillStyle = color; g2.fillText(txt, x, y);
}
function drawKaraoke(g2, c, L, lt, y0) {
  const p = L.p, toks = [];
  L.ls.forEach((line, j) => {
    const lw = L.ws[j], x0 = p.align === 'left' ? -L.w / 2 : p.align === 'right' ? L.w / 2 - lw : -lw / 2; let pos = 0;
    for (const part of line.split(' ')) { if (part) toks.push({ w: part, x: x0 + g2.measureText(line.slice(0, pos)).width, y: y0 + j * L.lh, cw: g2.measureText(part).width }); pos += part.length + 1; }
  });
  if (!toks.length) return false;
  const tm = wordTimes(c, toks.map(t => t.w)); let cur = -1;
  for (let i = 0; i < tm.length; i++) if (lt >= tm[i][0] - 1e-3) cur = i;
  const base = () => { if (!p.grad) return p.color; const gr = g2.createLinearGradient(0, -L.h / 2, 0, L.h / 2); gr.addColorStop(0, p.color); gr.addColorStop(1, p.color2); return gr; };
  g2.textAlign = 'left'; g2.textBaseline = 'middle';
  if (p.kStyle === 'single') { // tek kelime: ortada, sırayla
    if (cur < 0) return true; const t = toks[cur], k = clamp((lt - tm[cur][0]) / 0.14, 0, 1), s = Math.max(0.01, 0.55 + 0.45 * outBack(k));
    g2.save(); g2.scale(s, s);
    if (p.bg) { const pd = p.bgPad; g2.save(); g2.globalAlpha *= clamp(p.bgOp, 0, 1); g2.fillStyle = p.bgColor; rrect(g2, -t.cw / 2 - pd, -L.lh / 2 - pd, t.cw + pd * 2, L.lh + pd * 2, p.bgRad); g2.fill(); g2.restore(); }
    drawWordStr(g2, p, t.w, -t.cw / 2, 0, base()); g2.restore(); return true;
  }
  if (p.bg) { const pd = p.bgPad; g2.save(); g2.globalAlpha *= clamp(p.bgOp, 0, 1); g2.fillStyle = p.bgColor; rrect(g2, -L.w / 2 - pd, -L.h / 2 - pd, L.w + pd * 2, L.h + pd * 2, p.bgRad); g2.fill(); g2.restore(); }
  toks.forEach((t, i) => { if (i !== cur) drawWordStr(g2, p, t.w, t.x, t.y, base()); });
  if (cur >= 0) {
    const t = toks[cur];
    if (p.kStyle === 'bounce') {
      const k = clamp((lt - tm[cur][0]) / 0.2, 0, 1), sc = Math.max(0.01, 1 + ((p.kScale ?? 1.25) - 1) * outBack(k)), dy = -L.lh * 0.08 * Math.sin(Math.PI * k);
      g2.save(); g2.translate(t.x + t.cw / 2, t.y + dy); g2.scale(sc, sc); drawWordStr(g2, p, t.w, -t.cw / 2, 0, p.kColor); g2.restore();
    } else drawWordStr(g2, p, t.w, t.x, t.y, p.kColor);
  }
  return true;
}

// ---------- 2) Sessizlikleri kes ----------
let silOn = false, silDb = null, silRegs = [], silSkip = new Set();
const SIL_HOP = 0.01; // 10 ms
(() => {
  const b = document.createElement('button'); b.id = 'bSil'; b.title = 'Konuşmadaki boşlukları bul ve kes'; b.textContent = '✂ Sessizlikleri kes'; $('#bSubs').after(b); b.onclick = () => silOn ? silClose() : silOpen();
  const d = document.createElement('div'); d.id = 'silPanel'; d.className = 'hidden';
  d.innerHTML = `<b>Sessizlikleri kes</b>
    <div class="row"><label>Eşik</label><input id="silThr" type="range" min="-60" max="-20" step="1" value="-40"><span class="rv" id="silThrV"></span></div>
    <div class="row"><label>En kısa boşluk</label><input id="silMin" type="range" min="0.15" max="2" step="0.05" value="0.5"><span class="rv" id="silMinV"></span></div>
    <div class="row"><label>Kenar payı</label><input id="silPad" type="range" min="0" max="0.4" step="0.01" value="0.1"><span class="rv" id="silPadV"></span></div>
    <span id="silInfo"></span><span class="grow"></span><button id="silCancel">Vazgeç</button><button id="silGo" class="primary">✂ Kes</button>`;
  $('#tlBar').after(d);
  ['silThr', 'silMin', 'silPad'].forEach(id => $('#' + id).addEventListener('input', () => { silSkip.clear(); silCompute(); }));
  $('#silCancel').onclick = silClose; $('#silGo').onclick = silCut;
})();
async function silOpen() {
  if (playing) pause();
  const audio = audioList(true), D = duration();
  if (!audio.length || D <= 0) return dialog({ title: 'Sessizlikleri kes', text: 'Zaman çizelgesinde konuşma içeren video veya ses yok. ("Müzik" olarak işaretli sesler dinlenmez.)', buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] });
  status('Ses inceleniyor…');
  try {
    const pcm = await window.api.asrAudio({ audio, duration: D });
    const u8 = new Uint8Array(pcm), f = new Float32Array(u8.buffer.slice(u8.byteOffset, u8.byteOffset + (u8.byteLength & ~3)));
    const hop = Math.round(16000 * SIL_HOP), n = Math.floor(f.length / hop); silDb = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = i * hop, e = j + hop; j < e; j++) s += f[j] * f[j]; silDb[i] = 10 * Math.log10(s / hop + 1e-12); }
  } catch (e) { status(''); return dialog({ title: 'Sessizlikleri kes', text: 'Ses okunamadı: ' + (e.message || e), buttons: [{ label: 'Tamam', v: 'ok', cls: 'primary' }] }); }
  silOn = true; silSkip.clear(); $('#silPanel').classList.remove('hidden'); $('#bSil').classList.add('on');
  if (typeof layersOn !== 'undefined' && layersOn) toggleLayers(false);
  silCompute(); status('Kırmızı bölgeler kesilecek. Bir bölgeye tıklarsan o boşluk korunur.');
}
function silClose() { silOn = false; silDb = null; silRegs = []; $('#silPanel').classList.add('hidden'); $('#bSil')?.classList.remove('on'); silBands(); status(''); }
function silCompute() {
  if (!silDb) return;
  const thr = +$('#silThr').value, mn = +$('#silMin').value, pad = +$('#silPad').value, D = duration(), n = silDb.length, regs = [];
  $('#silThrV').textContent = thr + ' dB'; $('#silMinV').textContent = mn.toFixed(2) + ' sn'; $('#silPadV').textContent = pad.toFixed(2) + ' sn';
  let st = -1;
  for (let i = 0; i <= n; i++) {
    const q = i < n && silDb[i] < thr;
    if (q && st < 0) st = i;
    if (!q && st >= 0) {
      const a = st * SIL_HOP, b = i === n ? Math.max(i * SIL_HOP, D) : i * SIL_HOP;
      if (b - a >= mn) { const a2 = st === 0 ? 0 : a + pad, b2 = i === n ? b : b - pad; if (b2 - a2 > 0.05) regs.push([a2, Math.min(b2, D)]); }
      st = -1;
    }
  }
  silRegs = regs; silBands();
}
function silBands() {
  document.querySelectorAll('.silband').forEach(x => x.remove());
  if (!silOn) return;
  const host = $('#tlInner'); let tot = 0, cnt = 0;
  silRegs.forEach(([a, b], i) => {
    const keep = silSkip.has(i); if (!keep) { tot += b - a; cnt++; }
    const e = document.createElement('div'); e.className = 'silband' + (keep ? ' keep' : ''); e.style.left = (a * pps) + 'px'; e.style.width = Math.max(2, (b - a) * pps) + 'px';
    e.title = `${fmt(a)} – ${fmt(b)} (${(b - a).toFixed(2)} sn) · tıkla: ${keep ? 'kes' : 'koru'}`;
    e.onmousedown = ev => { ev.stopPropagation(); ev.preventDefault(); keep ? silSkip.delete(i) : silSkip.add(i); silBands(); };
    host.appendChild(e);
  });
  $('#silInfo').textContent = silRegs.length ? `${cnt} boşluk · video ${tot.toFixed(1)} sn kısalacak` : 'Bu ayarlarla boşluk bulunamadı';
  $('#silGo').disabled = !cnt;
}
{ const _r = renderTL; renderTL = function () { const r = _r.apply(this, arguments); if (silOn) silBands(); return r; }; }
// [a,b] aralığını tüm izlerden çıkar, sonrasını sola kaydır. Müzik (otomatik kısılan) ve metinler bölünmez, sadece kısalır.
function rippleCut(a, b) {
  const len = b - a;
  for (const tr of proj.tracks) for (const c of [...tr.clips]) {
    const s = c.start, e = c.start + c.dur;
    if (e <= a + 1e-6) continue;
    if (s >= b - 1e-6) { c.start -= len; continue; }
    const split = (c.type === 'video' || c.type === 'audio') && !c.p.duck;
    if (split) {
      if (s >= a - 1e-6 && e <= b + 1e-6) { tr.clips = tr.clips.filter(x => x !== c); continue; }
      let mid = c; if (a - s > EPS) { const r = splitClip(c, tr, a); if (r) mid = r; }
      if (mid.start + mid.dur - b > EPS) { const r = splitClip(mid, tr, b); if (r) r.start -= len; }
      tr.clips = tr.clips.filter(x => x !== mid);
    } else {
      const cs = Math.max(s, a), ce = Math.min(e, b), cl = ce - cs, l0 = cs - s;
      const sh = t => t > l0 ? Math.max(l0, t - cl) : t;
      for (const p in (c.kf || {})) c.kf[p].forEach(k => k.t = sh(k.t));
      if (Array.isArray(c.p.words)) c.p.words.forEach(w => { w.s = +sh(w.s).toFixed(3); w.e = +sh(w.e).toFixed(3); });
      c.dur -= cl; if (s > a) c.start = a;
      if (c.dur < 1 / FPS) tr.clips = tr.clips.filter(x => x !== c);
    }
  }
}
function silCut() {
  const regs = silRegs.filter((r, i) => !silSkip.has(i)).map(([a, b]) => [Math.round(a * FPS) / FPS, Math.round(b * FPS) / FPS]).filter(([a, b]) => b - a >= 1 / FPS).sort((x, y) => y[0] - x[0]);
  if (!regs.length) return status('Kesilecek boşluk yok');
  commit(); let tot = 0; for (const [a, b] of regs) { rippleCut(a, b); tot += b - a; }
  const n = regs.length; silClose(); refreshAll(); setTime(Math.min(time, duration()));
  status(`${n} boşluk kesildi · video ${tot.toFixed(1)} sn kısaldı (Ctrl+Z ile geri alınır)`); setTimeout(() => status(''), 5000);
}

// ---------- 3) Yeşil ekran ----------
Object.assign(ANY_DEF, { chroma: 'none', chTol: 0.4, chSoft: 0.3, chSpill: 0.5, chColor: '#00b140' });
function chromaHTML(c) {
  return `<div class="grp"><h4>Yeşil ekran</h4>${fieldHTML(c, ['chroma', 'Saydam renk', 'sel', [['none', 'Kapalı'], ['green', 'Yeşil'], ['blue', 'Mavi'], ['custom', 'Özel renk']]])}
    ${c.p.chroma === 'custom' ? fieldHTML(c, ['chColor', 'Renk', 'color']) + `<div class="row"><label></label><button id="i_chpick">💧 Önizlemeden renk seç</button><span></span></div>` : ''}
    ${fieldHTML(c, ['chTol', 'Tolerans', 'range'])}${fieldHTML(c, ['chSoft', 'Kenar yumuşaklığı', 'range'])}${fieldHTML(c, ['chSpill', 'Renk taşmasını azalt', 'range'])}
    <div class="hint2">Arkasında görünmesini istediğin videoyu/görseli bu klibin altındaki katmana koy.</div></div>`;
}
const ckCache = new Map();
function chromaKey(c, src, dw, dh, kk) {
  const sw = src.naturalWidth || src.videoWidth || src.width, sh = src.naturalHeight || src.videoHeight || src.height; if (!sw || !sh) return src;
  const cap = exporting ? 1920 : 1280, R = Math.min(1, cap / Math.max(1, dw * kk, dh * kk));
  const rw = Math.max(2, Math.round(Math.min(sw, dw * kk * R))), rh = Math.max(2, Math.round(rw * sh / sw));
  const P = c.p, key = [P.chroma, P.chColor, P.chTol ?? 0.4, P.chSoft ?? 0.3, P.chSpill ?? 0.5, rw, rh].join('|');
  let e = ckCache.get(c.id); if (e && e.src === src && e.key === key) return e.cv;
  if (!e) { if (ckCache.size > 24) ckCache.clear(); e = { cv: document.createElement('canvas') }; e.x = e.cv.getContext('2d', { willReadFrequently: true }); ckCache.set(c.id, e); }
  sizeCv(e.cv, rw, rh); e.x.clearRect(0, 0, rw, rh); e.x.drawImage(src, 0, 0, rw, rh);
  const id = e.x.getImageData(0, 0, rw, rh), d = id.data, blue = P.chroma === 'blue';
  const t0 = 0.02 + (P.chTol ?? 0.4) * 0.28, t1 = t0 + 0.01 + (P.chSoft ?? 0.3) * 0.3, inv = 1 / (t1 - t0), keep = 1 - (P.chSpill ?? 0.5);
  if (P.chroma === 'custom') { // özel renk: renk tonu (Cb/Cr) uzaklığına göre
    const [kr, kg, kb] = hex2rgb(P.chColor || '#00b140'), kcb = -0.1687 * kr - 0.3313 * kg + 0.5 * kb, kcr = 0.5 * kr - 0.4187 * kg - 0.0813 * kb;
    const c0 = 8 + (P.chTol ?? 0.4) * 70, c1 = c0 + 2 + (P.chSoft ?? 0.3) * 60, sp = P.chSpill ?? 0.5;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], cb = -0.1687 * r - 0.3313 * g + 0.5 * b, cr = 0.5 * r - 0.4187 * g - 0.0813 * b, dist = Math.hypot(cb - kcb, cr - kcr);
      if (dist >= c1 + 30) continue;
      if (dist < c1 + 30 && sp > 0) { const y = 0.299 * r + 0.587 * g + 0.114 * b, k = sp * clamp(1 - (dist - c0) / (c1 + 30 - c0), 0, 1); d[i] = r + (y - r) * k; d[i + 1] = g + (y - g) * k; d[i + 2] = b + (y - b) * k; }
      if (dist < c1) d[i + 3] = dist <= c0 ? 0 : d[i + 3] * (dist - c0) / (c1 - c0);
    }
    e.x.putImageData(id, 0, 0); e.src = src; e.key = key; return e.cv;
  }
  const ki = blue ? 2 : 1, o1 = 0, o2 = blue ? 1 : 2;
  for (let i = 0; i < d.length; i += 4) {
    const k = d[i + ki], a = d[i + o1], b = d[i + o2], mx = a > b ? a : b, diff = (k - mx) / 255;
    if (diff <= 0) continue;
    d[i + ki] = mx + (k - mx) * keep; // yeşil/mavi taşmasını azalt
    if (diff > t0) d[i + 3] = diff >= t1 ? 0 : d[i + 3] * (1 - (diff - t0) * inv);
  }
  e.x.putImageData(id, 0, 0); e.src = src; e.key = key; return e.cv;
}
{ const _d = drawMediaFx; drawMediaFx = function (g, c, src, dw, dh, t, kk) { if (c.p.chroma === 'green' || c.p.chroma === 'blue' || c.p.chroma === 'custom') src = chromaKey(c, src, dw, dh, kk); return _d(g, c, src, dw, dh, t, kk); }; }
{ const _v = visualMediaInspHTML; visualMediaInspHTML = function (c) { return _v(c) + chromaHTML(c); }; }
{ const _e = extraMenuItems; extraMenuItems = function () { const a = _e(); const i = a.findIndex(x => x.label === 'Otomatik altyazı'); a.splice(i + 1, 0, { icon: '✂', label: 'Sessizlikleri kes', act: silOpen }); return a; }; }

// ---- Özel renk: önizlemeye tıklayıp rengi al (saydamlık kapalıyken okunur) ----
let chPicking = null;
{ const _b = bindExtra; bindExtra = function (c) {
  _b(c); const b = $('#i_chpick'); if (!b) return;
  b.onclick = () => { chPicking = c.id; cv.style.cursor = 'crosshair'; status('Önizlemede saydam yapılacak renge tıkla (Esc: vazgeç)'); };
}; }
cv.addEventListener('mousedown', e => {
  if (!chPicking) return; e.preventDefault(); e.stopImmediatePropagation();
  const c = findClip(chPicking)?.clip; chPicking = null; cv.style.cursor = ''; status('');
  if (!c) return;
  const r = cv.getBoundingClientRect(), x = Math.round((e.clientX - r.left) * cv.width / r.width), y = Math.round((e.clientY - r.top) * cv.height / r.height);
  const old = c.p.chroma; c.p.chroma = 'none'; draw(); const px = ctx.getImageData(x, y, 1, 1).data; c.p.chroma = old;
  commit(); c.p.chColor = rgb2hex(px[0], px[1], px[2]); refreshAll(); status('Seçilen renk: ' + c.p.chColor.toUpperCase()); setTimeout(() => status(''), 2500);
}, true);
addEventListener('keydown', e => { if (chPicking && e.key === 'Escape') { chPicking = null; cv.style.cursor = ''; status(''); } }, true);
