// ===================== Ek özellikler (7): ses yükseltme (%200), ses ve hız keyframe'leri =====================
// Hız rampası: kaynak videonun aynı kısmı oynar, hızlanınca klip kısalır. Ses perdesi korunur (önizlemede WSOLA, dışa aktarmada da aynı ses).
Object.assign(ANY_DEF, { volume: 1 });
LABELS.speed = 'Hız'; LABELS.volume = 'Ses'; GCOL.speed = '#ff9f43'; GCOL.volume = '#2ed47a';
const hasSpdKf = c => !!(c && c.kf && c.kf.speed && c.kf.speed.length);
const spdAt = (c, lt) => clamp(+val(c, 'speed', lt) || 1, 0.05, 16);
const srcLenOf = c => c.srcLen ?? c.dur * spd(c);
// ∫0..lt hız — kaynak saniyesi. Tablo, keyframe dizisi başına önbelleklenir.
const SP_H = 1 / 240, spTables = new WeakMap();
function srcAdv(c, lt) {
  const arr = c.kf.speed, sig = JSON.stringify(arr); let T = spTables.get(arr);
  if (!T || T.sig !== sig) { T = { sig, a: [0] }; spTables.set(arr, T); }
  const need = Math.min(Math.ceil(Math.max(0, lt) / SP_H) + 1, 3600 / SP_H);
  while (T.a.length <= need) { const i = T.a.length - 1, t0 = i * SP_H; T.a.push(T.a[i] + (spdAt(c, t0) + spdAt(c, t0 + SP_H)) * SP_H / 2); }
  const x = Math.max(0, lt) / SP_H, i = Math.floor(x), f = x - i; return T.a[i] + ((T.a[i + 1] ?? T.a[i]) - T.a[i]) * f;
}
function solveDur(c, target) { // srcAdv(c, d) = target
  let lo = 0, hi = Math.max(1 / FPS, target / 0.05);
  for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (srcAdv(c, mid) < target) lo = mid; else hi = mid; }
  return Math.max(1 / FPS, hi);
}
{ const _s = srcT; srcT = function (c, lt) { if (!hasSpdKf(c)) return _s(c, lt); const a = srcAdv(c, lt); return c.p.rev ? c.in + srcLenOf(c) - a : c.in + a; }; }
// Keyframe değişince süreyi yeniden hesapla (kaynak uzunluğu sabit), kırpılınca kaynak uzunluğunu güncelle
function fixSpeedClips() {
  for (const c of allClips()) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    if (!hasSpdKf(c)) { if (c.srcLen != null) { c.dur = Math.max(1 / FPS, c.srcLen / spd(c)); delete c.srcLen; delete c.spSig; } continue; }
    const sig = JSON.stringify(c.kf.speed), m = mediaOf(c);
    if (c.srcLen == null) c.srcLen = c.dur * spd(c);
    if (c.spSig !== sig) { c.dur = solveDur(c, c.srcLen); c.spSig = sig; } else c.srcLen = srcAdv(c, c.dur);
    if (m && m.dur && c.in + c.srcLen > m.dur + 1e-3) { c.srcLen = Math.max(0.05, m.dur - c.in); c.dur = solveDur(c, c.srcLen); }
  }
}
{ const _ct = cleanTracksSoft; cleanTracksSoft = function () { fixSpeedClips(); return _ct.apply(this, arguments); }; }
{ const _sp = splitClip; splitClip = function (c, track, t) {
  if (!hasSpdKf(c)) return _sp(c, track, t);
  const lt = t - c.start, adv = srcAdv(c, lt), tot = srcLenOf(c), in0 = c.in, rev = !!c.p.rev;
  const b = _sp(c, track, t); if (!b) return b;
  if (rev) { c.in = in0 + tot - adv; b.in = in0; } else { c.in = in0; b.in = in0 + adv; }
  c.srcLen = adv; b.srcLen = tot - adv;
  for (const x of [c, b]) x.spSig = hasSpdKf(x) ? JSON.stringify(x.kf.speed) : undefined;
  return b;
}; }

// ---------- Perdeyi koruyan zaman esnetme (WSOLA) ----------
const stCache = new Map(), monoCache = new WeakMap();
function monoOf(buf) { let m = monoCache.get(buf); if (m) return m; const L = buf.getChannelData(0), R = buf.getChannelData(1); m = new Float32Array(L.length); for (let i = 0; i < L.length; i++) m[i] = (L[i] + R[i]) * 0.5; monoCache.set(buf, m); return m; }
function stretchKey(c, m) { return [m.id, c.in.toFixed(4), srcLenOf(c).toFixed(4), c.dur.toFixed(4), !!c.p.rev, spd(c), hasSpdKf(c) ? JSON.stringify(c.kf.speed) : ''].join('|'); }
function stretchedFor(c, m, ab) {
  const key = stretchKey(c, m); if (stCache.has(key)) return stCache.get(key);
  const src = c.p.rev ? audRev(m, ab) : ab, SR = src.sampleRate, L = src.getChannelData(0), R = src.getChannelData(1), n = L.length, mono = monoOf(src);
  const N = Math.max(1, Math.ceil(c.dur * SR)), W = 1536, Hs = W / 2, tol = 480, out = actx().createBuffer(2, N, SR), oL = out.getChannelData(0), oR = out.getChannelData(1);
  const win = new Float32Array(W); for (let k = 0; k < W; k++) win[k] = 0.5 - 0.5 * Math.cos(2 * Math.PI * k / W);
  let prev = -1;
  for (let o = 0; o < N; o += Hs) {
    const T = srcT(c, o / SR); let p = Math.round((c.p.rev ? ab.duration - T : T) * SR);
    if (prev >= 0) { // önceki parçanın doğal devamına en çok benzeyen yeri ara
      const tg = prev + Hs; let best = 0, bv = -Infinity;
      for (let d = -tol; d <= tol; d += 8) { const q = p + d; if (q < 0 || q + W > n || tg + W > n) continue; let s = 0; for (let k = 0; k < W; k += 16) s += mono[q + k] * mono[tg + k]; if (s > bv) { bv = s; best = d; } }
      p += best;
    }
    p = clamp(p, 0, Math.max(0, n - 1));
    for (let k = 0; k < W && o + k < N; k++) { const q = p + k; if (q >= n) break; const w = win[k]; oL[o + k] += L[q] * w; oR[o + k] += R[q] * w; }
    prev = p;
  }
  if (stCache.size > 40) stCache.delete(stCache.keys().next().value);
  stCache.set(key, out); return out;
}
const pitchRate = c => (c.type === 'audio' || c.type === 'video') && !hasSpdKf(c) && +c.p.pitch ? Math.pow(2, clamp(+c.p.pitch, -24, 24) / 12) : 1;
function pitchedFor(c, m, ab, pr) { // tonu değiştir: önce perdeyi koruyarak dur*pr uzunluğa esnet, sonra pr hızında çal
  const px = Object.assign({}, c, { dur: c.dur * pr, kf: Object.assign({}, c.kf || {}, { speed: [] }), p: Object.assign({}, c.p, { speed: spd(c) / pr }) });
  delete px.srcLen; delete px.spSig;
  return stretchedFor(px, m, ab);
}
audStart = function () {
  audStop(); if (!playing) return; const A = actx(), now = A.currentTime, base = time;
  for (const c of allClips()) {
    if (!hasSound(c) || c.start + c.dur <= base) continue;
    const m = mediaOf(c), ab = audBuf(m); if (!(ab instanceof AudioBuffer)) continue;
    const lt0 = Math.max(0, base - c.start), delay = Math.max(0, c.start - base);
    const pr = pitchRate(c), plain = !hasSpdKf(c) && Math.abs(spd(c) - 1) < 1e-6 && pr === 1;
    let buf, off, rate = 1;
    if (pr !== 1) { buf = pitchedFor(c, m, ab, pr); off = lt0 * pr; rate = pr; }
    else if (plain) { buf = c.p.rev ? audRev(m, ab) : ab; const st = srcT(c, lt0); off = c.p.rev ? ab.duration - st : st; }
    else { buf = stretchedFor(c, m, ab); off = lt0; }
    const len = (c.dur - lt0) * rate; if (!buf || off >= buf.duration || len <= 0) continue;
    const s = A.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    const g = A.createGain(); g.gain.value = clipGain(c); s.connect(g).connect(A.destination);
    s.start(now + delay + 0.03, Math.max(0, off), Math.min(len, buf.duration - off)); aud.nodes.set(c.id, { src: s, g, c });
  }
};

// ---------- Dışa aktarma: hız rampalı kliplerin sesi önceden hazırlanır; ses keyframe'i ffmpeg ifadesine çevrilir ----------
const tmpWav = new Map(); // klip id -> { key, path }
async function ensureTmpWavs() {
  for (const c of allClips()) {
    if ((c.type !== 'video' && c.type !== 'audio') || !hasSpdKf(c)) continue;
    const m = mediaOf(c); if (!m || !(m.hasAudio || m.kind === 'audio')) continue;
    const key = stretchKey(c, m), cur = tmpWav.get(c.id); if (cur && cur.key === key) continue;
    let ab = audBuf(m); if (ab && typeof ab.then === 'function') ab = await ab; if (!(ab instanceof AudioBuffer)) continue;
    status('Hız rampası sesi hazırlanıyor…');
    const b = stretchedFor(c, m, ab), L = b.getChannelData(0), R = b.getChannelData(1), il = new Float32Array(L.length * 2);
    for (let i = 0; i < L.length; i++) { il[2 * i] = L[i]; il[2 * i + 1] = R[i]; }
    const path = await window.api.audTmpWav({ name: c.id, sr: b.sampleRate, data: new Uint8Array(il.buffer) });
    if (path) tmpWav.set(c.id, { key, path });
  }
  status('');
}
function volExpr(c) {
  const a = (c.kf && c.kf.volume) || []; if (!a.length) return null;
  const pts = [];
  for (let i = 0; i < a.length; i++) { pts.push(a[i].t); if (i < a.length - 1) for (let j = 1; j < 6; j++) pts.push(a[i].t + (a[i + 1].t - a[i].t) * j / 6); }
  const vs = pts.map(t => clamp(+val(c, 'volume', t), 0, 3));
  let e = vs[0].toFixed(4);
  for (let i = 0; i < pts.length - 1; i++) { const d = pts[i + 1] - pts[i], dv = vs[i + 1] - vs[i]; if (d > 1e-4 && Math.abs(dv) > 1e-5) e += `+(${dv.toFixed(4)})*clip((t-${pts[i].toFixed(4)})/${d.toFixed(4)},0,1)`; }
  return e;
}
audioList = function (forAsr) {
  const out = [];
  for (const c of allClips()) {
    if (c.type !== 'video' && c.type !== 'audio') continue;
    const m = mediaOf(c); if (!m || !(m.hasAudio || m.kind === 'audio')) continue;
    const vk = c.kf && c.kf.volume && c.kf.volume.length;
    if (!vk && (c.p.volume ?? 1) <= 0) continue;
    if (forAsr && c.p.duck) continue;
    const e = { path: m.path, in: c.in, dur: c.dur, start: c.start, volume: forAsr ? 1 : clamp(c.p.volume ?? 1, 0, 3), speed: spd(c), pitch: forAsr || hasSpdKf(c) ? 0 : clamp(+c.p.pitch || 0, -24, 24), rev: !!c.p.rev, duck: !forAsr && c.p.duck ? duckExpr(c) : null, volExpr: forAsr ? null : volExpr(c) };
    if (hasSpdKf(c)) { const t = tmpWav.get(c.id); if (!t || t.key !== stretchKey(c, m)) continue; Object.assign(e, { path: t.path, in: 0, speed: 1, rev: false }); }
    out.push(e);
  }
  return out;
};
{ const _e = exportVideo; exportVideo = async function () { await ensureTmpWavs(); return _e.apply(this, arguments); }; }
{ const _s = silOpen; silOpen = async function () { await ensureTmpWavs(); return _s.apply(this, arguments); }; }
{ const _a = autoSubtitles; autoSubtitles = async function () { await ensureTmpWavs(); return _a.apply(this, arguments); }; }
document.querySelectorAll('#bExport').forEach(b => b.onclick = () => exportVideo());
{ const b = $('#bSubs'); if (b) b.onclick = () => autoSubtitles(); }
{ const b = $('#bSil'); if (b) b.onclick = () => silOn ? silClose() : silOpen(); }

// ---------- Denetçi: hız için ◆, hız alanı keyframe'e yazar ----------
{ const _b = bindExtra; bindExtra = function (c) {
  _b(c); const s = $('#i_speed'); if (!s) return;
  const row = s.parentElement;
  if (!row.querySelector('.kfv')) {
    const b = document.createElement('button'); b.className = 'kf kfv'; b.dataset.k = 'speed'; b.textContent = '◆'; b.title = 'Hıza keyframe ekle / kaldır (hız rampası)';
    b.onclick = () => { commit(); if (!hasSpdKf(c)) c.srcLen = c.dur * spd(c); toggleValKf(c, 'speed'); refreshAll(); };
    row.classList.add('kfrow'); row.appendChild(b);
  }
  const orig = s.onchange;
  s.onchange = () => {
    if (!hasSpdKf(c)) return orig && orig();
    commit(); const nw = Math.round(+s.value * 100) / 100; setKf(c, 'speed', clamp(time - c.start, 0, c.dur), nw); refreshAll();
  };
}; }
{ const _u = updateKfButtons; updateKfButtons = function () {
  _u(); const c = sel && findClip(sel)?.clip, s = $('#i_speed'); if (!c || !s) return;
  const b = s.parentElement.querySelector('.kfv'); const lt = clamp(time - c.start, 0, c.dur);
  if (b) { const a = (c.kf || {}).speed || []; b.classList.toggle('on', a.some(x => Math.abs(x.t - lt) < EPS)); b.classList.toggle('has', a.length > 0); }
  if (hasSpdKf(c) && document.activeElement !== s) { const v = spdAt(c, lt); s.value = v; if (s._rsv && typeof rsPaint === 'function') rsPaint(s); const sp = s.nextElementSibling; if (sp) sp.textContent = v.toFixed(2) + '×'; }
}; }

// ---------- Ses çubuğu: 1'de (normal) işaret, yaklaşınca 1'e yapışır ----------
{ const _r = refreshInsp; refreshInsp = function () { const r = _r.apply(this, arguments); const v = document.querySelector('#inspBody [data-k="volume"]'); if (v) v.dataset.tick = '1'; return r; }; }
document.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.k === 'volume' && t.type === 'range' && Math.abs(+t.value - 1) < 0.08 && +t.value !== 1) t.value = 1; }, true);
