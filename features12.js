// features12.js — Ses efekti tarayıcısı (kategori + arama + dinleme), ton ve uzunluk ayarı
const SFX_GROUPS = ['Özel', 'Geçiş', 'Yükselen / Düşen', 'Vuruş / Patlama', 'Arayüz', 'Zil / Nota', 'Logo', 'Klavye / Yazma', 'Glitch', 'Nesne / Doğa', 'Klasik'];
let sfxPrev = null, sfxCat = '', sfxQ = '';
function sfxStop() { if (sfxPrev) { try { sfxPrev.a.pause(); } catch { } sfxPrev.row && sfxPrev.row.classList.remove('playing'); sfxPrev = null; } }
function sfxPlay(s, row) {
  const same = sfxPrev && sfxPrev.s === s; sfxStop(); if (same) return;
  const a = new Audio(mediaURL(s.path)), e = (typeof sfxEdOf === 'function' && sfxEdOf(s)) || {};
  a.volume = Math.min(1, 0.85 * (e.vol ?? 1)); a.playbackRate = e.speed || 1; a.preservesPitch = true; // düzenlenmiş aralığı dinlet
  if (e.in) a.currentTime = e.in;
  if (e.out != null) a.ontimeupdate = () => { if (a.currentTime >= e.out) { a.pause(); if (sfxPrev && sfxPrev.a === a) sfxStop(); } };
  a.play().catch(() => { });
  a.onended = () => { if (sfxPrev && sfxPrev.a === a) sfxStop(); };
  sfxPrev = { a, s, row }; row && row.classList.add('playing');
}
// İngilizcede banka seslerinin adı anahtarından türetilir (b_cut_hit__air → Cut hit · air)
function sfxName(s) {
  if (LANG === 'tr' || s.custom) return s.name;
  const m = /^b_(.+?)(?:__(.+))?$/.exec(s.key || ''); if (!m) return T(s.name);
  const sp = x => x.replace(/_/g, ' '), cap = x => x[0].toUpperCase() + x.slice(1);
  if (m[1] === 'fit' && m[2]) { const p = m[2].split('__'); return p[0] === 'key' && p[1] ? 'Key · ' + sp(p[1]) : cap(sp(p[p.length - 1])); } // gerçek kayıttan uyarlananlar
  return cap(sp(m[1])) + (m[2] ? ' · ' + sp(m[2]).replace(/  /g, ' · ') : '');
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
  const all = [...(typeof SFX_CUSTOM !== 'undefined' ? SFX_CUSTOM : []), ...SFX_LIST.map(s => Object.assign(s, { g: s.g || 'Klasik' }))];
  const cats = D.querySelector('.sfxCats');
  cats.innerHTML = [['', 'Tümü', all.length], ...SFX_GROUPS.map(g => [g, g, all.filter(s => s.g === g).length]).filter(x => x[2] || x[0] === 'Özel')]
    .map(([k, n, c]) => `<button data-g="${esc(k)}" class="${k === sfxCat ? 'on' : ''}">${esc(n)}<i>${c}</i></button>`).join('');
  cats.querySelectorAll('button').forEach(b => b.onclick = () => { sfxCat = b.dataset.g; sfxRender(); });
  const words = sfxNorm(sfxQ).split(/\s+/).filter(Boolean);
  const list = all.filter(s => (!sfxCat || s.g === sfxCat) && words.every(w => sfxNorm(s.name + ' ' + s.g + ' ' + sfxName(s) + ' ' + T(s.g)).includes(w)));
  D.querySelector('.sfxCnt').textContent = list.length + ' ses';
  const L = D.querySelector('.sfxList');
  if (!SFX_LIST.length && sfxCat !== 'Özel') { L.innerHTML = '<div class="sfxEmpty">Yükleniyor…</div>'; return; }
  L.innerHTML = list.length ? '' : (sfxCat === 'Özel' && !sfxQ ? '' : '<div class="sfxEmpty">Sonuç yok</div>');
  if (sfxCat === 'Özel') { // kendi ses efektlerin
    const h = document.createElement('div'); h.className = 'sfxOzel';
    h.innerHTML = `<button class="primary" id="sfxAddCustom">+ Ses ekle</button><span>Kendi ses dosyalarını ekle. Editör'ün içine kopyalanır; ✎ ile nereden başlayıp biteceğini, sesini, hızını ve tonunu ayarlayabilirsin.</span>`;
    h.querySelector('#sfxAddCustom').onclick = addCustomSfx; L.appendChild(h);
  }
  let lastG = null;
  for (const s of list) {
    if (!sfxCat && s.g !== lastG) { const h = document.createElement('div'); h.className = 'sfxGh'; h.textContent = s.g; L.appendChild(h); lastG = s.g; }
    const r = document.createElement('div'); r.className = 'sfxRow' + (sfxPrev && sfxPrev.s === s ? ' playing' : '');
    const se = typeof sfxEdOf === 'function' ? sfxEdOf(s) : null, dd = se && s.dur ? edLen({ kind: 'audio', dur: s.dur }, se) : s.dur;
    r.innerHTML = `<span class="sfxPl">▶</span><span class="sfxN" data-noi18n>${esc(sfxName(s))}</span><span class="sfxD${se ? ' ed' : ''}">${se ? '✂ ' : ''}${dd ? dd.toFixed(2) + ' sn' : ''}</span>${s.custom ? '<button class="sfxDel" title="Sil">×</button>' : ''}<button class="sfxEd" title="Düzenle (kes, ses, hız, ton)">✎</button><button class="sfxAdd">+ Ekle</button>`;
    r.onclick = e => { if (e.target.closest('.sfxAdd,.sfxEd,.sfxDel')) return; sfxPlay(s, r); };
    r.querySelector('.sfxEd').onclick = e => { e.stopPropagation(); editSfx(s); };
    if (s.custom) r.querySelector('.sfxDel').onclick = e => { e.stopPropagation(); delCustomSfx(s); };
    r.ondblclick = e => { if (e.target.closest('button')) return; closeSfx(); addSfx(s); };
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
    <div class="row"><label>${T('Ton (perde)')}</label><input id="i_pitch" type="range" min="-12" max="12" step="1" value="${p}" data-tick="0" ${kf ? 'disabled' : ''}><b class="rv pv">${(p > 0 ? '+' : '') + p}</b></div>
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
