// features13.js — Medya düzenleyici (baştan/sondan kesme, ses düzeyi, hız, ton), özel ses efektleri,
// dolapta düzenleme ve Ctrl+G ile gruplama, düzenlenmiş klibi dolaba ekleme, metin/şekillerde efektler.
// Düzenlemeler dosyaya dokunmaz: ayarlar dolaptaki öğede (m.ed / m.preset) ya da özel ses listesinde saklanır.
'use strict';

// ---------- Düzenleme ayarlarını klibe uygula ----------
// ed = { in, out (kaynak saniyesi), vol, speed, pitch }  · görselde ed = { dur }
function applyEd(c, m, e) {
  if (!e || !m) return c;
  if (m.kind === 'image') { if (+e.dur > 0) c.dur = +e.dur; return c; }
  const D = m.dur || c.dur, sp = clamp(+e.speed || 1, 0.25, 4);
  const a = clamp(+e.in || 0, 0, Math.max(0, D - 0.05)), b = clamp(e.out == null ? D : +e.out, a + 0.05, D);
  c.in = a; c.dur = Math.max(1 / FPS, (b - a) / sp);
  if (sp !== 1) c.p.speed = sp; else delete c.p.speed;
  if (e.vol != null && c.type !== 'image') c.p.volume = clamp(+e.vol, 0, 3);
  if (+e.pitch) c.p.pitch = Math.round(+e.pitch); else delete c.p.pitch;
  return c;
}
// Dolap öğesinin kayıtlı düzenlemesi (ed) ve "ayarlarıyla" eklenmiş klip kalıbı (preset)
function applyLibEdits(c, m, ed) {
  applyEd(c, m, ed !== undefined ? ed : m.ed);
  if (m.preset) {
    const P = JSON.parse(JSON.stringify(m.preset));
    Object.assign(c.p, P.p || {}); if (P.in != null) c.in = P.in; if (+P.dur > 0) c.dur = P.dur;
  }
  return c;
}
const edLen = (m, e) => m.kind === 'image' ? (+(e && e.dur) || m.dur || 5) : Math.max(0.05, (((e && e.out != null) ? +e.out : (m.dur || 0)) - ((e && +e.in) || 0)) / ((e && +e.speed) || 1));

// ---------- Medya düzenleyici penceresi ----------
let medOpen = null;
function closeMed() { if (medOpen) medOpen.close('cancel'); }
function openMediaEditor(m, ed0, o = {}) {
  closeMed();
  return new Promise(async resolve => {
    if (!m.dur && m.kind !== 'image') { try { const inf = await window.api.vidInfo(m.path); if (inf && inf.dur > 0) m.dur = inf.dur; } catch { } }
    const isImg = m.kind === 'image', isVid = m.kind === 'video', snd = m.kind === 'audio' || (isVid && m.hasAudio !== false);
    const D0 = isImg ? 0 : Math.max(0.05, m.dur || 1);
    const e = { in: 0, out: D0, vol: 1, speed: 1, pitch: 0, dur: 5 };
    if (ed0) Object.assign(e, JSON.parse(JSON.stringify(ed0)));
    if (isImg) e.dur = +(ed0 && ed0.dur) || m.dur || 5;
    else { e.out = clamp(e.out == null ? D0 : +e.out, 0.05, D0); e.in = clamp(+e.in || 0, 0, e.out - 0.05); }
    let cur = e.in; // önizleme konumu (kaynak saniyesi)
    const buttons = o.buttons || [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Tamam', v: 'ok', cls: 'primary' }];
    const D = document.createElement('div'); D.id = 'medDlg'; D.tabIndex = -1;
    D.innerHTML = `<div class="medBox">
      <div class="medHead"><b>${esc(o.title || 'Düzenle')}</b><span class="medFile" data-noi18n>${esc(m.alias || m.name || '')}</span><button class="medX" title="Kapat (Esc)">×</button></div>
      ${o.name != null ? `<div class="row medNameRow"><label>Ad</label><input class="medNm" spellcheck="false" value="${esc(o.name)}"><span></span></div>` : ''}
      ${isImg || isVid ? `<div class="medPrev"><canvas class="medCv"></canvas></div>` : ''}
      ${isImg ? `<div class="row"><label>Süre (sn)</label><input class="medImgDur" type="number" min="0.1" step="0.1" value="${(+e.dur).toFixed(2)}"><span></span></div>` : `
      <div class="medTrim"><canvas class="medWave"></canvas><div class="medDim l"></div><div class="medDim r"></div><div class="medSel"><div class="mh l" title="Başlangıç"></div><div class="mh r" title="Bitiş"></div></div><div class="medPh"></div></div>
      <div class="medTimes"><button class="medPlay" title="Dinle / durdur (Boşluk)">▶</button>
        <label>Başlangıç</label><input class="medIn" type="number" step="0.01" min="0">
        <label>Bitiş</label><input class="medOutN" type="number" step="0.01" min="0">
        <span class="medLen"></span><span class="medTot"></span></div>
      ${snd ? `<div class="row"><label>Ses düzeyi</label><input class="medVol" type="range" min="0" max="3" step="0.01" data-tick="1" value="${e.vol}"><b class="rv medVolV"></b></div>` : ''}
      <div class="row"><label>Hız</label><input class="medSp" type="range" min="0.25" max="4" step="0.05" data-tick="1" value="${e.speed}"><b class="rv medSpV"></b></div>
      ${snd ? `<div class="row"><label>Ton (perde)</label><input class="medPt" type="range" min="-12" max="12" step="1" data-tick="0" value="${e.pitch}"><b class="rv medPtV"></b></div>` : ''}
      <div class="hint2">Kenar tutamaçlarını sürükleyerek nereden başlayıp nerede biteceğini seç. Dosyanın kendisi değişmez.</div>`}
      <div class="medBtns"><button class="medReset">Sıfırla</button><span class="grow"></span></div></div>`;
    document.body.appendChild(D);
    const q = s => D.querySelector(s), B = q('.medBtns');
    buttons.forEach(b => { const el = document.createElement('button'); el.textContent = b.label; if (b.cls) el.className = b.cls; el.onclick = () => close(b.v); B.appendChild(el); });

    // --- önizleme (video karesi / görsel) ---
    const cv = q('.medCv'), cx = cv && cv.getContext('2d');
    const paint = src => { if (!cv) return; const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1; cv.width = Math.max(2, Math.round(r.width * dpr)); cv.height = Math.max(2, Math.round(r.height * dpr)); cx.fillStyle = '#0b0b0e'; cx.fillRect(0, 0, cv.width, cv.height); if (!src) return; const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight; const k = Math.min(cv.width / sw, cv.height / sh); cx.drawImage(src, (cv.width - sw * k) / 2, (cv.height - sh * k) / 2, sw * k, sh * k); };
    const vkey = 'med:' + m.id; let busy = false, next = null, alive = true;
    async function frame(t) {
      if (!isVid || !alive) return; if (busy) { next = t; return; } busy = true;
      try { const f = await window.api.vidFrame({ key: vkey, p: m.path, t, fps: 30, h: 360 }); if (f && alive) { const bmp = await createImageBitmap(new Blob([f.jpg], { type: 'image/jpeg' })); paint(bmp); bmp.close(); } } catch { }
      busy = false; if (next != null) { const n = next; next = null; frame(n); }
    }
    if (isImg) { const im = new Image(); im.onload = () => paint(im); im.src = mediaURL(m.path); }

    // --- kesme çubuğu ---
    const tr = q('.medTrim'), wv = q('.medWave');
    const X = t => t / D0 * 100;
    function lay() {
      if (!tr) return;
      q('.medSel').style.left = X(e.in) + '%'; q('.medSel').style.width = (X(e.out) - X(e.in)) + '%';
      q('.medDim.l').style.width = X(e.in) + '%'; q('.medDim.r').style.left = X(e.out) + '%'; q('.medPh').style.left = X(cur) + '%';
      const fi = q('.medIn'), fo = q('.medOutN'); if (document.activeElement !== fi) fi.value = e.in.toFixed(2); if (document.activeElement !== fo) fo.value = e.out.toFixed(2);
      q('.medLen').textContent = 'Uzunluk: ' + ((e.out - e.in) / e.speed).toFixed(2) + ' sn'; q('.medTot').textContent = '/ ' + D0.toFixed(2) + ' sn';
      if (q('.medVolV')) q('.medVolV').textContent = Math.round(e.vol * 100) + '%';
      q('.medSpV').textContent = (+e.speed).toFixed(2) + '×'; if (q('.medPtV')) q('.medPtV').textContent = (e.pitch > 0 ? '+' : '') + e.pitch;
    }
    async function drawWave() {
      if (!wv) return; const r = wv.getBoundingClientRect(), dpr = devicePixelRatio || 1, w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
      wv.width = w; wv.height = h; const g = wv.getContext('2d'); g.fillStyle = '#17171c'; g.fillRect(0, 0, w, h);
      if (isVid) { // film şeridi
        const n = Math.max(1, Math.round(w / (h * 16 / 9))), fw = w / n;
        for (let i = 0; i < n && alive; i++) { try { const f = await window.api.vidFrame({ key: vkey + ':s', p: m.path, t: (i + 0.5) * D0 / n, fps: 30, h: 90 }); if (!f) continue; const b = await createImageBitmap(new Blob([f.jpg], { type: 'image/jpeg' })); const k = Math.max(fw / b.width, h / b.height); g.save(); g.beginPath(); g.rect(i * fw, 0, fw, h); g.clip(); g.globalAlpha = 0.55; g.drawImage(b, i * fw + (fw - b.width * k) / 2, (h - b.height * k) / 2, b.width * k, b.height * k); g.restore(); b.close(); } catch { } }
        window.api.vidClose(vkey + ':s');
      }
      if (!snd) return;
      let ab = audBuf(m); if (ab && !(ab instanceof AudioBuffer)) ab = await ab; if (!(ab instanceof AudioBuffer) || !alive) return;
      const L = ab.getChannelData(0), Rr = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, per = L.length / w; g.fillStyle = isVid ? 'rgba(120,200,255,.85)' : '#5d7fe6';
      for (let x = 0; x < w; x++) { let mx = 0; const s0 = Math.floor(x * per), s1 = Math.min(L.length, Math.floor((x + 1) * per)); for (let i = s0; i < s1; i += Math.max(1, (s1 - s0) >> 6)) { const v = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (v > mx) mx = v; } const hh = Math.max(1, Math.min(1, mx * 1.15) * h * 0.92); g.fillRect(x, (h - hh) / 2, 1, hh); }
    }
    const tAt = ev => { const r = tr.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1) * D0; };
    if (tr) {
      const drag = (ev, fn) => { ev.preventDefault(); ev.stopPropagation(); stopPlay(); const mv = x => { fn(x); lay(); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); frame(cur); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
      q('.mh.l').onpointerdown = ev => drag(ev, x => { e.in = clamp(tAt(x), 0, e.out - 0.05); cur = e.in; frame(cur); });
      q('.mh.r').onpointerdown = ev => drag(ev, x => { e.out = clamp(tAt(x), e.in + 0.05, D0); cur = e.out; frame(cur); });
      q('.medSel').onpointerdown = ev => { if (ev.target.closest('.mh')) return; const t0 = tAt(ev), a0 = e.in, b0 = e.out; let moved = false; drag(ev, x => { const d = clamp(tAt(x) - t0, -a0, D0 - b0); if (Math.abs(d) > 0.01) moved = true; e.in = a0 + d; e.out = b0 + d; cur = moved ? e.in : t0; frame(cur); }); cur = t0; lay(); frame(cur); };
      tr.onpointerdown = ev => { if (ev.target !== tr && ev.target !== wv && !ev.target.classList.contains('medDim') && ev.target !== q('.medPh')) return; drag(ev, x => { cur = tAt(x); frame(cur); }); cur = tAt(ev); lay(); frame(cur); };
      const fi = q('.medIn'), fo = q('.medOutN');
      fi.onchange = () => { e.in = clamp(+fi.value || 0, 0, e.out - 0.05); cur = e.in; lay(); frame(cur); };
      fo.onchange = () => { e.out = clamp(+fo.value || D0, e.in + 0.05, D0); cur = e.out; lay(); frame(cur); };
      const bind = (s, k, f) => { const el = q(s); if (el) el.oninput = el.onchange = () => { e[k] = f(+el.value); lay(); if (playing_) startPlay(); }; };
      bind('.medVol', 'vol', v => v); bind('.medSp', 'speed', v => Math.abs(v - 1) < 0.04 ? 1 : v); bind('.medPt', 'pitch', v => Math.round(v));
    }
    const di = q('.medImgDur'); if (di) di.onchange = () => { e.dur = Math.max(0.1, +di.value || 5); di.value = e.dur.toFixed(2); };
    q('.medReset').onclick = () => { stopPlay(); Object.assign(e, { in: 0, out: D0, vol: 1, speed: 1, pitch: 0 }); if (isImg) { e.dur = m.dur || 5; di.value = e.dur.toFixed(2); } cur = 0; D.querySelectorAll('input[type=range]').forEach(r => { r.value = r.classList.contains('medVol') || r.classList.contains('medSp') ? 1 : 0; r.dispatchEvent(new Event('input')); }); lay(); frame(0); };

    // --- dinleme (seçilen aralık, hız ve tonla) ---
    let node = null, playing_ = false, raf = 0, frT = 0;
    function stopPlay() { playing_ = false; cancelAnimationFrame(raf); if (node) { try { node.stop(); } catch { } node.disconnect(); node = null; } const p = q('.medPlay'); if (p) p.textContent = '▶'; }
    async function startPlay() {
      stopPlay(); if (!tr) return; playing_ = true; const p = q('.medPlay'); if (p) p.textContent = '⏸';
      const sp = e.speed, len = (e.out - e.in) / sp; let lt0 = (cur >= e.in && cur < e.out - 0.02) ? (cur - e.in) / sp : 0;
      const A = actx(); A.resume().catch(() => { }); const t0 = A.currentTime + 0.03;
      if (snd) {
        let ab = audBuf(m); if (ab && !(ab instanceof AudioBuffer)) ab = await ab; if (!playing_) return;
        if (ab instanceof AudioBuffer) {
          const fake = { id: '__med', type: m.kind, mediaId: m.id, in: e.in, dur: len, p: { speed: sp, pitch: e.pitch }, kf: {} };
          const pr = e.pitch ? Math.pow(2, e.pitch / 12) : 1; let buf, off, rate = 1;
          if (pr !== 1) { buf = pitchedFor(fake, m, ab, pr); off = lt0 * pr; rate = pr; }
          else if (Math.abs(sp - 1) < 1e-6) { buf = ab; off = e.in + lt0; }
          else { buf = stretchedFor(fake, m, ab); off = lt0; }
          const s = A.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate; const gn = A.createGain(); gn.gain.value = e.vol; s.connect(gn).connect(A.destination);
          s.start(t0, Math.max(0, off), Math.max(0.01, (len - lt0) * rate)); node = s; s.onended = () => { if (node === s) stopPlay(); };
        }
      }
      const tick = () => {
        if (!playing_) return; const lt = lt0 + Math.max(0, A.currentTime - t0); cur = Math.min(e.out, e.in + lt * sp); lay();
        if (isVid && performance.now() - frT > 70) { frT = performance.now(); frame(cur); }
        if (lt >= len) { stopPlay(); return; } raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    const pb = q('.medPlay'); if (pb) pb.onclick = () => playing_ ? stopPlay() : startPlay();

    // --- kapatma, klavye ---
    function result() {
      const nm = q('.medNm') ? q('.medNm').value.trim() : undefined;
      if (isImg) return { ed: Math.abs(e.dur - (m.dur || 5)) > 1e-3 ? { dur: +e.dur.toFixed(3) } : null, name: nm };
      const r = {}; if (e.in > 1e-3) r.in = +e.in.toFixed(3); if (e.out < D0 - 1e-3) r.out = +e.out.toFixed(3);
      if (Math.abs(e.vol - 1) > 1e-3) r.vol = +e.vol.toFixed(3); if (Math.abs(e.speed - 1) > 1e-3) r.speed = +e.speed.toFixed(3); if (e.pitch) r.pitch = e.pitch;
      return { ed: Object.keys(r).length ? r : null, name: nm };
    }
    const key = ev => {
      if (!D.isConnected) return; ev.stopPropagation();
      const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement && document.activeElement.tagName) && document.activeElement.type !== 'range';
      if (ev.key === 'Escape') { ev.preventDefault(); close('cancel'); }
      else if (ev.key === 'Enter' && !(typing && document.activeElement.type === 'number')) { const p = buttons.find(b => b.cls === 'primary'); if (p) { ev.preventDefault(); close(p.v); } }
      else if (ev.key === ' ' && !typing) { ev.preventDefault(); playing_ ? stopPlay() : startPlay(); }
    };
    addEventListener('keydown', key, true);
    D.addEventListener('mousedown', ev => { if (ev.target === D) close('cancel'); });
    q('.medX').onclick = () => close('cancel');
    function close(v) {
      if (!alive) return; alive = false; stopPlay(); removeEventListener('keydown', key, true); removeEventListener('resize', onRs);
      if (isVid) window.api.vidClose(vkey); D.remove(); if (medOpen && medOpen.D === D) medOpen = null;
      resolve(v === 'cancel' ? null : Object.assign({ v }, result()));
    }
    const onRs = () => { drawWave(); frame(cur); }; addEventListener('resize', onRs);
    medOpen = { D, close };
    lay(); requestAnimationFrame(() => { drawWave(); frame(cur); const n = q('.medNm'); if (n) { n.focus(); n.select(); } else D.focus(); });
  });
}

// ---------- Özel ses efektleri ----------
let SFX_CUSTOM = [];
const sfxEdMem = (() => { try { return JSON.parse(localStorage.getItem('sfxEd') || '{}'); } catch { return {}; } })();
const sfxEdOf = s => s.custom ? (s.ed || null) : (sfxEdMem[s.key] || null);
function sfxEdSet(s, ed) {
  if (s.custom) { if (ed) s.ed = ed; else delete s.ed; return saveCustomSfx(); }
  if (ed) sfxEdMem[s.key] = ed; else delete sfxEdMem[s.key];
  try { localStorage.setItem('sfxEd', JSON.stringify(sfxEdMem)); } catch { }
}
function saveCustomSfx() { return window.api.sfxCustomSave && window.api.sfxCustomSave(SFX_CUSTOM.map(({ key, name, path, dur, ed }) => ({ key, name, path, dur, ed }))); }
window.api.sfxCustomList && window.api.sfxCustomList().then(l => { SFX_CUSTOM = (l || []).map(s => Object.assign(s, { custom: 1, g: 'Özel' })); if (typeof sfxRender === 'function') sfxRender(); }).catch(() => { });
const sfxMedia = s => ({ id: 'sfx:' + s.key, path: s.path, name: s.name, alias: sfxName(s), kind: 'audio', dur: s.dur, hasAudio: true });
async function editSfx(s) {
  sfxStop();
  const r = await openMediaEditor(sfxMedia(s), sfxEdOf(s), { title: 'Ses efektini düzenle', name: s.custom ? s.name : undefined,
    buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Kaydet', v: 'save' }, { label: 'Playhead\'e ekle', v: 'add', cls: 'primary' }] });
  if (!r) return;
  if (s.custom && r.name) s.name = r.name;
  await sfxEdSet(s, r.ed); sfxRender();
  if (r.v === 'add') { closeSfx(); addSfx(s); }
}
async function addCustomSfx() {
  const paths = await window.api.pickMedia('audio'); if (!paths || !paths.length) return;
  const added = [];
  for (const p of paths) {
    try {
      const dst = await window.api.sfxCustomAdd(p); if (!dst) continue;
      const inf = await window.api.vidInfo(dst);
      const s = { key: 'u_' + uid(), name: p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''), path: dst, g: 'Özel', dur: inf && inf.dur, custom: 1 };
      SFX_CUSTOM.unshift(s); added.push(s);
    } catch { }
  }
  await saveCustomSfx(); sfxCat = 'Özel'; sfxRender();
  if (added.length === 1) editSfx(added[0]);
}
async function delCustomSfx(s) {
  const r = await dialog({ title: 'Ses efekti silinsin mi?', text: `“${s.name}” silinecek.`, buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Sil', v: 'ok', cls: 'primary' }] });
  if (r.v !== 'ok') return;
  SFX_CUSTOM = SFX_CUSTOM.filter(x => x !== s); await saveCustomSfx(); window.api.sfxCustomDel && window.api.sfxCustomDel(s.path); sfxRender();
}

// ---------- Dolap: düzenle, rozet, Ctrl+G ----------
async function editLibItem(m) {
  if (!m) return;
  let ed0 = m.ed;
  if (m.preset) { const P = m.preset, sp = (P.p && P.p.speed) || 1; ed0 = m.kind === 'image' ? { dur: P.dur } : { in: P.in || 0, out: (P.in || 0) + (P.dur || 0) * sp, vol: P.p && P.p.volume, speed: sp, pitch: P.p && P.p.pitch }; }
  const r = await openMediaEditor(m, ed0, { title: 'Dolaptaki öğeyi düzenle', name: m.alias || m.name.replace(/\.[^.]+$/, ''),
    buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Kaydet', v: 'ok', cls: 'primary' }] });
  if (!r) return;
  if (m.preset) { // kalıbın kesme/ses/hız ayarlarını güncelle
    const P = m.preset; P.p = P.p || {}; const c = { type: m.kind, in: P.in || 0, dur: P.dur || m.dur, p: P.p };
    for (const k of ['speed', 'pitch']) delete c.p[k]; if (m.kind !== 'image') c.p.volume = 1;
    applyEd(c, m, r.ed || { in: 0, out: m.dur }); P.in = c.in; P.dur = c.dur;
  } else if (r.ed) m.ed = r.ed; else delete m.ed;
  if (r.name && r.name !== (m.alias || m.name)) m.alias = r.name;
  await saveLib(); status('Kaydedildi ✓'); setTimeout(() => status(''), 1500);
}
{ const _li = libItemEl; libItemEl = function (m) {
  const d = _li(m);
  if (m.ed || m.preset) { const b = document.createElement('span'); b.className = 'led'; b.title = m.preset ? 'Ayarlarıyla eklenmiş klip' : 'Düzenlenmiş'; b.textContent = '✎'; d.appendChild(b); }
  if (m.ed || m.preset) d.dataset.len = edLen(m, m.preset ? null : m.ed).toFixed(1);
  return d;
}; }
let libFocus = false;
document.addEventListener('mousedown', e => { libFocus = !!(e.target.closest && e.target.closest('#lib')); }, true);
addEventListener('keydown', e => {
  if (!(e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyG')) return;
  const ae = document.activeElement; if (ae && ['INPUT', 'TEXTAREA'].includes(ae.tagName)) return;
  if (!libSel.size || !libFocus || medOpen || !$('#dlg').classList.contains('hidden')) return;
  e.preventDefault(); e.stopImmediatePropagation(); newGroupFor();
}, true);

// ---------- Zaman çizelgesi: klibe sağ tık → dolaba ekle (ayarlarıyla) ----------
function clipThumb(c) { // klibin şu anki hâli (efekt, kırpma, renk dahil) küçük resim olarak
  const keep = { proj, time }; let url = null;
  try {
    const cl = JSON.parse(JSON.stringify(c)); cl.start = 0; cl.kf = {}; cl.hidden = false; cl.p.x = 0; cl.p.y = 0;
    proj = Object.assign({}, keep.proj, { tracks: [{ id: 'tt', kind: 'visual', clips: [cl] }], layers: undefined });
    const k = 200 / Math.max(W, H), cv2 = document.createElement('canvas'); cv2.width = Math.round(W * k); cv2.height = Math.round(H * k);
    renderAt(Math.min(c.dur / 2, 0.5), cv2.getContext('2d'), false, k);
    const out = document.createElement('canvas'); out.width = 160; out.height = 100; const g = out.getContext('2d'); const f = Math.max(160 / cv2.width, 100 / cv2.height);
    g.drawImage(cv2, (160 - cv2.width * f) / 2, (100 - cv2.height * f) / 2, cv2.width * f, cv2.height * f); url = out.toDataURL('image/jpeg', 0.75);
  } catch { url = null; } finally { proj = keep.proj; time = keep.time; }
  return url;
}
async function clipToLib(c) {
  const m = mediaOf(c); if (!m) return;
  const P = JSON.parse(JSON.stringify(c.p)); delete P.x; delete P.y; // konum ve keyframe'ler hariç
  const it = { id: uid(), path: m.path, name: m.name, kind: m.kind, dur: m.dur, hasAudio: m.hasAudio, alias: c.name || m.alias || m.name, preset: { p: P, in: c.in, dur: c.dur } };
  it.thumb = (m.kind !== 'audio' && clipThumb(c)) || m.thumb; if (m.group) it.group = m.group;
  library.unshift(it); await saveLib(); draw();
  status('Dolaba eklendi: ' + it.alias); setTimeout(() => status(''), 2500);
}
$('#tracks').addEventListener('contextmenu', e => {
  const ce = e.target.closest('.clip'); if (!ce) return; e.preventDefault();
  const f = findClip(ce.dataset.id); if (!f) return; const c = f.clip;
  if (!selSet.has(c.id)) { sel = c.id; renderTL(); refreshInsp(); }
  const media = (c.type === 'video' || c.type === 'image' || c.type === 'audio') && mediaOf(c);
  ctxMenu(e.clientX, e.clientY, c.name || '', [
    ...(media ? [{ icon: '＋', label: 'Dolaba ekle (ayarlarıyla)', act: () => clipToLib(c) }] : []),
    { icon: '⧉', label: 'Çoğalt', key: 'Ctrl+D', act: duplicateSel },
    { sep: 1 },
    { icon: '✕', label: 'Sil', key: 'Del', act: deleteSel }
  ]);
});

// ---------- Metin ve şekillerde efektler (renk ayarı + bulanıklık, piksel, RGB, parlama, gren, glitch, sarsıntı) ----------
const [fxS, fxSc] = mkCv();
function fxRaster(g2, c, lt, t, kk) { // piksel efektleri için metni/şekli önce ayrı tuvale çiz
  const p = c.p; if (!(+p.fxPix > 0 || +p.fxRgb > 0 || +p.fxGlitch > 0 || +p.fxGlow > 0 || +p.fxGrain > 0)) return false;
  let w, h, paint;
  if (c.type === 'text') {
    const L = textLayout(c, fxSc), P = L.p, pd = P.bg ? P.bgPad : 0;
    const mg = (P.strokeW || 0) + (P.glow ? P.glowBlur : 0) + (P.shadow ? P.shBlur + Math.max(Math.abs(P.shX), Math.abs(P.shY)) : 0) + 12;
    w = L.w + 2 * pd + 2 * mg; h = L.h + 2 * pd + 2 * mg; paint = x => drawText(x, c, lt);
  } else { w = (p.w || 400) + 40; h = (p.h || 400) + 40; paint = x => drawShape(x, c); }
  const R = Math.min(1, 2048 / Math.max(1, w * kk, h * kk)), cw = Math.max(2, Math.ceil(w * kk * R)), ch = Math.max(2, Math.ceil(h * kk * R)), s = cw / w;
  sizeCv(fxS, cw, ch); fxSc.setTransform(1, 0, 0, 1, 0, 0); fxSc.globalAlpha = 1; fxSc.filter = 'none'; fxSc.clearRect(0, 0, cw, ch);
  fxSc.setTransform(s, 0, 0, s, cw / 2, ch / 2); paint(fxSc); fxSc.setTransform(1, 0, 0, 1, 0, 0);
  drawMediaFx(g2, c, fxS, w, h, t, kk);
  return true;
}
function fxGrpHTML(c) {
  const cur = c.p.filt || 'none';
  return `<div class="grp"><h4>Renk ayarı</h4><div class="row"><label>Filtre</label><select id="i_cpreset">${Object.entries(COLOR_PRESETS).map(([k, [n]]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${n}</option>`).join('')}</select><span></span></div>
    ${fieldHTML(c, ['bri', 'Parlaklık', 'range', [-1, 1]])}${fieldHTML(c, ['con', 'Kontrast', 'range', [-1, 1]])}${fieldHTML(c, ['sat', 'Doygunluk', 'range', [-1, 1]])}
    ${fieldHTML(c, ['temp', 'Sıcaklık', 'range', [-1, 1]])}${fieldHTML(c, ['tint', 'Ton', 'range', [-1, 1]])}
    <div class="row"><label></label><button id="i_creset">Sıfırla</button><span></span></div></div>` + fxHTML(c);
}
