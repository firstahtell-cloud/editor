// ===================== Ek özellikler (6): renk çarkı =====================
// Windows'ta yerel renk seçici açılmıyor; yerine uygulama içi HSV çarkı.
const hex2rgb = h => { h = String(h || '#000000').trim(); const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h); if (!m) { const r = /rgba?\(([^)]+)\)/.exec(h); if (r) { const [a, b, c] = r[1].split(',').map(x => parseFloat(x)); return [a | 0, b | 0, c | 0]; } return [0, 0, 0]; } let s = m[1]; if (s.length === 3) s = s.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
const rgb2hex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgb2hsv(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; }
function hsv2rgb(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5) * 255, f(3) * 255, f(1) * 255]; }
let cpRecent = []; try { cpRecent = JSON.parse(localStorage.getItem('cpRecent') || '[]'); } catch { }
function paintColorInput(el) { el.style.background = el.value; el.style.borderColor = '#555'; }
function openColorPicker(inp0) {
  let inp = inp0;
  closeColorPicker();
  let [h, s, v] = rgb2hsv(...hex2rgb(inp.value)); const start = inp.value; let changed = false;
  const P = document.createElement('div'); P.id = 'cpop';
  P.innerHTML = `<div class="cpTop"><canvas class="cpW" width="360" height="360"></canvas><canvas class="cpV" width="36" height="360"></canvas></div>
    <div class="cpRow"><span class="cpSw cpOld" title="Önceki renk"></span><span class="cpSw cpNew"></span><input class="cpHex" spellcheck="false" maxlength="7">${'EyeDropper' in window ? '<button class="cpEye" title="Ekrandan renk al">💧</button>' : ''}</div>
    <div class="cpNums"><label>Ton<input class="cpH" type="number" min="0" max="360" step="1"></label><label>Doygunluk<input class="cpS" type="number" min="0" max="100" step="1"></label><label>Parlaklık<input class="cpVv" type="number" min="0" max="100" step="1"></label></div>
    <div class="cpRec">${cpRecent.map(c => `<span class="cpSw" data-c="${c}" style="background:${c}" title="${c}"></span>`).join('')}</div>`;
  document.body.appendChild(P);
  const W = P.querySelector('.cpW'), V = P.querySelector('.cpV'), wx = W.getContext('2d'), vx = V.getContext('2d'), hexI = P.querySelector('.cpHex');
  P.querySelector('.cpOld').style.background = start;
  const r = inp.getBoundingClientRect(), pw = 236, ph = 330;
  P.style.left = Math.max(6, Math.min(innerWidth - pw - 6, r.left - pw + r.width)) + 'px';
  P.style.top = (r.bottom + ph + 6 < innerHeight ? r.bottom + 4 : Math.max(6, r.top - ph - 4)) + 'px';
  const draw = () => {
    const S = 360, c = S / 2, R = c - 8;
    wx.clearRect(0, 0, S, S);
    const cg = wx.createConicGradient(0, c, c); for (let i = 0; i <= 12; i++) cg.addColorStop(i / 12, `hsl(${i * 30},100%,50%)`);
    wx.beginPath(); wx.arc(c, c, R, 0, Math.PI * 2); wx.fillStyle = cg; wx.fill();
    const rg = wx.createRadialGradient(c, c, 0, c, c, R); rg.addColorStop(0, '#fff'); rg.addColorStop(1, 'rgba(255,255,255,0)'); wx.fillStyle = rg; wx.fill();
    wx.fillStyle = `rgba(0,0,0,${1 - v})`; wx.fill();
    const a = h / 180 * Math.PI, mx = c + Math.cos(a) * R * s, my = c + Math.sin(a) * R * s;
    wx.lineWidth = 3; wx.strokeStyle = v > 0.5 ? '#000' : '#fff'; wx.beginPath(); wx.arc(mx, my, 10, 0, Math.PI * 2); wx.stroke();
    const vg = vx.createLinearGradient(0, 0, 0, 360), top = hsv2rgb(h, s, 1); vg.addColorStop(0, rgb2hex(...top)); vg.addColorStop(1, '#000');
    vx.clearRect(0, 0, 36, 360); vx.fillStyle = vg; vx.fillRect(0, 0, 36, 360);
    const vy = (1 - v) * 352 + 4; vx.fillStyle = '#fff'; vx.fillRect(0, vy - 3, 36, 6); vx.strokeStyle = '#000'; vx.lineWidth = 1; vx.strokeRect(0.5, vy - 3, 35, 6);
    const hx = rgb2hex(...hsv2rgb(h, s, v)); P.querySelector('.cpNew').style.background = hx;
    if (document.activeElement !== hexI) hexI.value = hx.toUpperCase();
    for (const [cl, val] of [['.cpH', h], ['.cpS', s * 100], ['.cpVv', v * 100]]) { const e = P.querySelector(cl); if (document.activeElement !== e) e.value = Math.round(val); }
  };
  const apply = (fin) => { if (!inp.isConnected) { const n = inp.dataset.k ? document.querySelector(`#inspBody [data-k="${inp.dataset.k}"]`) : (inp.id && document.getElementById(inp.id)); if (n) { inp = n; P._inp = n; } } const hx = rgb2hex(...hsv2rgb(h, s, v)); if (inp.value !== hx) { inp.value = hx; changed = true; paintColorInput(inp); inp.dispatchEvent(new Event('input', { bubbles: true })); } if (fin && changed) inp.dispatchEvent(new Event('change', { bubbles: true })); };
  const dragOn = (el, f) => el.addEventListener('pointerdown', e => { e.preventDefault(); el.setPointerCapture(e.pointerId); f(e); draw(); apply(); const mv = ev => { f(ev); draw(); apply(); }; const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); apply(true); }; el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); });
  dragOn(W, e => { const b = W.getBoundingClientRect(), x = (e.clientX - b.left) / b.width * 2 - 1, y = (e.clientY - b.top) / b.height * 2 - 1, R = 1 - 16 / 360; h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; s = Math.min(1, Math.hypot(x, y) / R); if (v < 0.02) v = 1; });
  dragOn(V, e => { const b = V.getBoundingClientRect(); v = clamp(1 - (e.clientY - b.top) / b.height, 0, 1); });
  hexI.oninput = () => { if (/^#?[0-9a-f]{6}$/i.test(hexI.value.trim())) { [h, s, v] = rgb2hsv(...hex2rgb(hexI.value.trim())); draw(); apply(true); } };
  P.querySelector('.cpH').oninput = e => { h = clamp(+e.target.value || 0, 0, 360) % 360; draw(); apply(true); };
  P.querySelector('.cpS').oninput = e => { s = clamp(+e.target.value || 0, 0, 100) / 100; draw(); apply(true); };
  P.querySelector('.cpVv').oninput = e => { v = clamp(+e.target.value || 0, 0, 100) / 100; draw(); apply(true); };
  P.querySelector('.cpOld').onclick = () => { [h, s, v] = rgb2hsv(...hex2rgb(start)); draw(); apply(true); };
  P.querySelectorAll('.cpRec .cpSw').forEach(sw => sw.onclick = () => { [h, s, v] = rgb2hsv(...hex2rgb(sw.dataset.c)); draw(); apply(true); });
  const eye = P.querySelector('.cpEye'); if (eye) eye.onclick = async () => { try { const r = await new EyeDropper().open(); [h, s, v] = rgb2hsv(...hex2rgb(r.sRGBHex)); draw(); apply(true); } catch { } };
  P.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' || e.key === 'Enter') closeColorPicker(); });
  P._inp = inp; P._commit = () => { if (changed) { const hx = inp.value; cpRecent = [hx, ...cpRecent.filter(x => x !== hx)].slice(0, 12); try { localStorage.setItem('cpRecent', JSON.stringify(cpRecent)); } catch { } } };
  draw();
}
function closeColorPicker() { const P = document.getElementById('cpop'); if (P) { P._commit?.(); P.remove(); } }
document.addEventListener('mousedown', e => {
  const P = document.getElementById('cpop'); if (P && P.contains(e.target)) return;
  const inp = e.target.closest && e.target.closest('input[type=color]');
  if (inp && !inp.disabled) { e.preventDefault(); e.stopPropagation(); if (P && P._inp === inp) return closeColorPicker(); openColorPicker(inp); return; }
  if (P) closeColorPicker();
}, true);
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('input[type=color]')) e.preventDefault(); }, true);
document.addEventListener('keydown', e => { if (e.target && e.target.type === 'color' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openColorPicker(e.target); } }, true);
new MutationObserver(() => document.querySelectorAll('input[type=color]').forEach(paintColorInput)).observe(document.body, { childList: true, subtree: true });
document.querySelectorAll('input[type=color]').forEach(paintColorInput);
