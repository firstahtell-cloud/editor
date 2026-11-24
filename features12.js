// features12.js — Ses efekti tarayıcısı (kategori + arama + dinleme), ton ve uzunluk ayarı
const SFX_GROUPS = ['Geçiş', 'Yükselen / Düşen', 'Vuruş / Patlama', 'Arayüz', 'Zil / Nota', 'Logo', 'Klavye / Yazma', 'Glitch', 'Nesne / Doğa', 'Klasik'];
let sfxPrev = null, sfxCat = '', sfxQ = '';
function sfxStop() { if (sfxPrev) { try { sfxPrev.a.pause(); } catch { } sfxPrev.row && sfxPrev.row.classList.remove('playing'); sfxPrev = null; } }
function sfxPlay(s, row) {
  const same = sfxPrev && sfxPrev.s === s; sfxStop(); if (same) return;
  const a = new Audio(mediaURL(s.path)); a.volume = 0.85; a.play().catch(() => { });
  a.onended = () => { if (sfxPrev && sfxPrev.a === a) sfxStop(); };
  sfxPrev = { a, s, row }; row && row.classList.add('playing');
}
const sfxNorm = t => String(t).toLocaleLowerCase('tr').replace(/[·()]/g, ' ');
function openSfx() {
  if (typeof closeAddMenu === 'function') closeAddMenu();
  let D = $('#sfxDlg');
  if (!D) {
    D = document.createElement('div'); D.id = 'sfxDlg';
    D.innerHTML = `<div class="sfxBox"><div class="sfxHead"><b>Ses efektleri</b><span class="sfxCnt"></span><input class="sfxQ" placeholder="Ara… (ör. vınn, tık, zil, vuruş)" spellcheck="false"><button class="sfxX" title="Kapat (Esc)">×</button></div>
      <div class="sfxBody"><div class="sfxCats"></div><div class="sfxList"></div></div>
      <div class="sfxFoot">Satıra tıkla: dinle · Çift tık veya + Ekle: playhead'e ekle</div></div>`;
    document.body.appendChild(D);
    D.addEventListener('mousedown', e => { if (e.target === D) closeSfx(); });
    D.querySelector('.sfxX').onclick = closeSfx;
    const q = D.querySelector('.sfxQ'); q.oninput = () => { sfxQ = q.value; sfxRender(); };
    D.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') closeSfx(); }, true);
  }
  D.classList.remove('hidden'); sfxRender(); setTimeout(() => D.querySelector('.sfxQ').focus(), 30);
}
function closeSfx() { sfxStop(); const D = $('#sfxDlg'); if (D) D.classList.add('hidden'); }
function sfxRender() {
  const D = $('#sfxDlg'); if (!D) return;
  const all = SFX_LIST.map(s => Object.assign(s, { g: s.g || 'Klasik' }));
  const cats = D.querySelector('.sfxCats');
  cats.innerHTML = [['', 'Tümü', all.length], ...SFX_GROUPS.map(g => [g, g, all.filter(s => s.g === g).length]).filter(x => x[2])]
    .map(([k, n, c]) => `<button data-g="${esc(k)}" class="${k === sfxCat ? 'on' : ''}">${esc(n)}<i>${c}</i></button>`).join('');
  cats.querySelectorAll('button').forEach(b => b.onclick = () => { sfxCat = b.dataset.g; sfxRender(); });
  const words = sfxNorm(sfxQ).split(/\s+/).filter(Boolean);
  const list = all.filter(s => (!sfxCat || s.g === sfxCat) && words.every(w => sfxNorm(s.name + ' ' + s.g).includes(w)));
  D.querySelector('.sfxCnt').textContent = list.length + ' ses';
  const L = D.querySelector('.sfxList');
  if (!SFX_LIST.length) { L.innerHTML = '<div class="sfxEmpty">Yükleniyor…</div>'; return; }
  L.innerHTML = list.length ? '' : '<div class="sfxEmpty">Sonuç yok</div>';
  let lastG = null;
  for (const s of list) {
    if (!sfxCat && s.g !== lastG) { const h = document.createElement('div'); h.className = 'sfxGh'; h.textContent = s.g; L.appendChild(h); lastG = s.g; }
    const r = document.createElement('div'); r.className = 'sfxRow' + (sfxPrev && sfxPrev.s === s ? ' playing' : '');
    r.innerHTML = `<span class="sfxPl">▶</span><span class="sfxN">${esc(s.name)}</span><span class="sfxD">${s.dur ? s.dur.toFixed(2) + ' sn' : ''}</span><button class="sfxAdd">+ Ekle</button>`;
    r.onclick = e => { if (e.target.closest('.sfxAdd')) return; sfxPlay(s, r); };
    r.ondblclick = () => { closeSfx(); addSfx(s); };
    r.querySelector('.sfxAdd').onclick = () => { closeSfx(); addSfx(s); };
    if (sfxPrev && sfxPrev.s === s) sfxPrev.row = r;
    L.appendChild(r);
  }
}
{ const _e = extraMenuItems; extraMenuItems = function () {
  return _e().map(it => it.label === 'Ses efekti' ? { icon: '🔊', label: 'Ses efekti…', act: openSfx } : it);
}; }

// ---------- Ton (yarım ton) ve uzunluk ----------
{ const _m = mediaInspHTML; mediaInspHTML = function (c) {
  let h = _m(c); if (!hasSound(c)) return h;
  const kf = hasSpdKf(c), p = +c.p.pitch || 0, ln = 1 / spd(c);
  h += `<div class="grp"><h4>Ton ve uzunluk</h4>
    <div class="row"><label>Ton</label><input id="i_pitch" type="range" min="-12" max="12" step="1" value="${p}" data-tick="0" ${kf ? 'disabled' : ''}><b class="rv pv">${(p > 0 ? '+' : '') + p}</b></div>
    ${c.type === 'audio' ? `<div class="row"><label>Uzunluk</label><input id="i_len" type="range" min="0.25" max="4" step="0.05" value="${ln.toFixed(2)}" data-tick="1" ${kf ? 'disabled' : ''}><b class="rv pv">${ln.toFixed(2)}×</b></div>` : ''}
    <div class="row"><label></label><button id="i_ptreset">Sıfırla</button><span></span></div>
    <div class="hint2">${kf ? 'Hız keyframe\'i varken ton ayarı kapalı.' : 'Ton: perde (yarım ton). Uzunluk: sesi perdesini bozmadan uzatır/kısaltır.'}</div></div>`;
  return h;
}; }
{ const _b = bindExtra; bindExtra = function (c) {
  _b(c);
  const pt = $('#i_pitch'), ln = $('#i_len'), rs = $('#i_ptreset');
  const restart = () => { if (playing) audStart(); };
  if (pt) {
    pt.oninput = () => { const v = Math.round(+pt.value); pt.parentElement.querySelector('.pv').textContent = (v > 0 ? '+' : '') + v; };
    pt.onchange = () => { commit(); let v = Math.round(+pt.value); if (Math.abs(v) < 1) v = 0; if (v) c.p.pitch = v; else delete c.p.pitch; refreshAll(); restart(); };
  }
  if (ln) {
    ln.oninput = () => { let v = +ln.value; if (Math.abs(v - 1) < 0.06) v = 1; ln.parentElement.querySelector('.pv').textContent = v.toFixed(2) + '×'; };
    ln.onchange = () => { let v = +ln.value; if (Math.abs(v - 1) < 0.06) v = 1; const s = $('#i_speed'); if (s) { s.value = (1 / v).toFixed(4); s.onchange(); } restart(); };
  }
  if (rs) rs.onclick = () => { commit(); delete c.p.pitch; const s = $('#i_speed'); if (s && spd(c) !== 1 && !hasSpdKf(c)) { s.value = 1; s.onchange(); } else refreshAll(); restart(); };
}; }
