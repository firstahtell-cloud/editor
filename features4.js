// ===================== Ek özellikler (4): değer keyframe'leri =====================
// Efekt, renk, metin, netlik bloğu vb. sayısal değerler de keyframe'lenebilir. Bu keyframe'ler mavi gösterilir.
const KF_NO = new Set(['trInD', 'trOutD', 'fadeIn', 'fadeOut', 'tw', 'tAnimD', 'tLoopS', 'duckLvl']);
const isValKf = k => !KF_PROPS.includes(k);
const VAL_COLS = ['#4da3ff', '#2f7dff', '#6cc4ff', '#3b5bff', '#7fb2ff', '#1fa0e0', '#5a8cff', '#98c8ff'];
const baseV = (c, k) => c.p[k] ?? TEXT_DEF[k] ?? ANY_DEF[k] ?? 0;
const curV = (c, k) => (c.kf && c.kf[k] && c.kf[k].length) ? val(c, k, clamp(time - c.start, 0, c.dur)) : baseV(c, k);
// Çizim için: keyframe'li değerleri o anki değerle doldurulmuş kopya
function evalClip(c, lt) {
  const kf = c.kf; if (!kf) return c; let o = null;
  for (const k in kf) { if (!isValKf(k) || !kf[k] || !kf[k].length) continue; if (!o) o = { ...c, p: { ...c.p } }; o.p[k] = val(c, k, clamp(lt, 0, c.dur)); }
  return o || c;
}
function toggleValKf(c, k) {
  const lt = clamp(time - c.start, 0, c.dur); c.kf = c.kf || {}; const a = c.kf[k] || [];
  const i = a.findIndex(x => Math.abs(x.t - lt) < EPS);
  if (i >= 0) { const v = val(c, k, lt); a.splice(i, 1); if (!a.length) { delete c.kf[k]; c.p[k] = v; } }
  else setKf(c, k, lt, +curV(c, k) || 0);
}
// Denetçide sayısal alanlara ◆ ekle
function addValKfButtons(c) {
  if (kindOf(c) !== 'visual' && c.type !== 'audio') return;
  let ci = 0;
  document.querySelectorAll('#inspBody .row > [data-k][data-t="num"]').forEach(el => {
    const k = el.dataset.k; if (KF_NO.has(k)) return;
    const row = el.parentElement, lab = row.querySelector('label');
    if (lab && !LABELS[k]) LABELS[k] = lab.textContent.trim();
    if (!GCOL[k]) GCOL[k] = VAL_COLS[(ci++) % VAL_COLS.length];
    const b = document.createElement('button'); b.className = 'kf kfv'; b.dataset.k = k; b.textContent = '◆'; b.title = 'Bu değere keyframe ekle / kaldır';
    b.onclick = () => { commit(); toggleValKf(c, k); refreshAll(); };
    row.classList.add('kfrow'); row.appendChild(b);
  });
  updateValKf(c);
}
function updateValKf(c) {
  const lt = clamp(time - c.start, 0, c.dur);
  document.querySelectorAll('#inspBody .kfv').forEach(b => {
    const k = b.dataset.k, a = (c.kf || {})[k] || [];
    b.classList.toggle('on', a.some(x => Math.abs(x.t - lt) < EPS)); b.classList.toggle('has', a.length > 0);
    const inp = b.parentElement.querySelector('[data-k]');
    if (a.length && inp && document.activeElement !== inp) {
      const v = val(c, k, lt); inp.value = inp.type === 'range' ? v : +(+v).toFixed(3);
      if (inp._rsv && typeof rsPaint === 'function') rsPaint(inp);
      const s = inp.nextElementSibling; if (inp.type === 'range' && s && s.tagName === 'SPAN') s.textContent = (+v).toFixed(2);
    }
  });
}
{ const _r = refreshInsp; refreshInsp = function () { const r = _r.apply(this, arguments); const c = sel && findClip(sel)?.clip; if (c) addValKfButtons(c); return r; }; }
{ const _u = updateKfButtons; updateKfButtons = function () { _u(); const c = sel && findClip(sel)?.clip; if (c) updateValKf(c); }; }

console.log('[TANI] yüklendi: features2=' + (typeof visualOrder === 'function') + ' features3=' + (typeof silOpen === 'function') + ' features4=' + (typeof evalClip === 'function') + ' bSil=' + !!document.getElementById('bSil') + ' bLayers=' + !!document.getElementById('bLayers'));
