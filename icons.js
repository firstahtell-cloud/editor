// icons.js — Düğmeleri çizgi ikonlara çevirir, üzerine gelince bilgi balonu gösterir, ana ekrana dil seçici ekler. Son yüklenen dosya.
'use strict';
const ICON_P = {
  save: '<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3"/><path d="M7 21v-7h10v7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  text: '<path d="M4 7V5h16v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
  captions: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M6 12h4M13 12h5M6 15.5h7M16 15.5h2"/>',
  silence: '<path d="M3 10v4M6.5 7v10M10 4v16"/><circle cx="15.5" cy="8" r="2"/><circle cx="15.5" cy="16" r="2"/><path d="M21.5 5l-4.3 9.4M17.2 9.6L21.5 19"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  imagePlus: '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M16 5h6M19 2v6"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
  upload: '<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  skipBack: '<path d="M19 20L9 12l10-8z" fill="currentColor"/><path d="M5 5v14"/>',
  curve: '<path d="M3 19c6 0 7-14 13-14 2.5 0 4 1.5 5 3"/><circle cx="3" cy="19" r="1.6" fill="currentColor"/><circle cx="16" cy="5" r="1.6" fill="currentColor"/>',
  magnet: '<path d="M5 4h4v7a3 3 0 0 0 6 0V4h4v7a7 7 0 0 1-14 0z"/><path d="M5 8h4M15 8h4"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  diamond: '<path d="M12 3l9 9-9 9-9-9z"/>',
  reset: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  chevL: '<path d="M15 18l-6-6 6-6"/>', chevR: '<path d="M9 18l6-6-6-6"/>',
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/>',
  droplet: '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M19 12l-7 7-7-7"/>', back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  rows: '<path d="M4 6h16M4 12h11M4 18h7"/><path d="M17 15l3 3-3 3"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4"/>',
  clap: '<path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 11L3.3 7.4a1 1 0 0 1 .8-1.2l13.7-2.6a1 1 0 0 1 1.2.8l.6 3.2z"/><path d="M8.3 5.5l2.2 3.6M13.3 4.6l2.2 3.6"/>',
  wand: '<path d="M4 20L15 9"/><path d="M15 3v3M18 6h3M19.5 2.5L18 4M12 4.5L10.5 3M20.5 11L19 9.5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/>',
  fit: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>'
};
const icon = (n, s = 18) => `<svg class="ic" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_P[n] || ''}</svg>`;

// [seçici, ikon (ya da yazıya göre ikon seçen fonksiyon), { tip, key, label }]
// label: ikonun yanında kısa yazı da kalsın (true = düğmenin kendi yazısı)
const ICON_RULES = [
  ['#bSave', 'save'], ['#bHome', 'grid'], ['#bUndo', 'undo', { tip: 'Geri al' }], ['#bRedo', 'redo', { tip: 'Yinele' }],
  ['#bText', 'text', { tip: 'Metin ekle' }], ['#bSubs', 'captions'], ['#bSil', 'silence'], ['#bCover', 'image'], ['#bExport', 'upload', { label: true }],
  ['#bImport', 'plus', { tip: 'Ekle' }], ['#libQgo', 'search'], ['#libQx', 'x'],
  ['#bStart', 'skipBack', { tip: 'Başa git', key: 'Home' }], ['#bPlay', t => t.includes('⏸') ? 'pause' : 'play', { tip: 'Oynat / durdur', key: 'Space' }], ['#bLayers', 'layers'],
  ['#bAdd', 'plus', { tip: 'Ekle menüsü', key: 'Shift+A' }], ['#bGraph', 'curve'], ['#bMagnet', 'magnet', { tip: 'Mıknatıs', key: 'M' }], ['#bKeys', 'keyboard'],
  ['#kfAll', 'diamond', { tip: 'Keyframe ekle', key: 'I' }], ['#kfPrev', 'chevL', { tip: 'Önceki' }], ['#kfNext', 'chevR', { tip: 'Sonraki' }],
  ['#i_creset,#i_ptreset,button[data-a="reset"]', 'reset', { tip: 'Sıfırla' }], ['#i_fxreset', 'reset'], ['#i_freeze', 'snow', { label: 'Dondur' }], ['#i_chpick', 'droplet'], ['#gFitB', 'fit'],
  ['#lyUp', 'up'], ['#lyDn', 'down'], ['#lyReset', 'rows'], ['.lye', t => t.includes('◌') ? 'eyeOff' : 'eye'],
  ['#projGrid .px,#coverGrid .px', 'trash', { tip: 'Sil' }], ['#projGrid .pbk', 'history'],
  ['#cvBack', 'back'], ['#cvFrame', 'film'], ['#cvProjFrame', 'clap'], ['#cvText', 'text', { tip: 'Metin' }], ['#cvAdd', 'imagePlus'], ['#cvBg', 'wand'], ['#cvSave', 'save'], ['#cvJpg', 'download', { label: 'JPG' }],
  ['.sfxAdd', 'plus', { tip: 'Ekle' }], ['.sfxX', 'x'], ['.sfxEd,.impEd', 'edit'], ['.sfxDel', 'trash', { tip: 'Sil' }], ['#sfxAddCustom', 'plus', { label: true }],
  ['.medPlay', t => t.includes('⏸') ? 'pause' : 'play'], ['.medX', 'x'], ['.medReset', 'reset', { tip: 'Sıfırla' }]
];
const ICON_SEL = ICON_RULES.map(r => r[0]).join(',');
const icClean = s => String(s || '').replace(/^[^\p{L}\p{N}]+/u, '').replace(/[\s▾▶]+$/u, '').trim();
const icIsKey = s => s.split(' / ').every(p => /^((Ctrl|Shift|Alt)\+)*([A-Z0-9?]|F\d+|Tab|Space|Home|Esc|Enter)$/.test(p.trim()));
function icRawText(el) { let t = ''; el.childNodes.forEach(n => { if (n.nodeType === 3) t += n.nodeValue; else if (n.nodeType === 1 && !n.classList.contains('ic') && !n.classList.contains('icl')) t += n.textContent; }); return t.trim(); }
function iconize(el) {
  const rule = ICON_RULES.find(r => el.matches(r[0])); if (!rule) return;
  const o = rule[2] || {}, raw = icRawText(el), has = !!el.querySelector(':scope > svg.ic');
  if (has && !raw) return; // zaten ikon
  const ic = typeof rule[1] === 'function' ? rule[1](raw) : rule[1];
  if (!el.dataset.tip) {
    const label = o.tip || icClean(raw), ttl = el.getAttribute('title');
    if (ttl) { if (icIsKey(ttl)) el.dataset.key = ttl; else if (icClean(ttl) !== label) { if (label) el.dataset.tip2 = ttl; else el.dataset.tip = ttl; } el.removeAttribute('title'); }
    if (o.key) el.dataset.key = o.key;
    if (label) el.dataset.tip = label;
    if (el.dataset.tip) el.setAttribute('aria-label', el.dataset.tip);
  }
  const lb = o.label === true ? icClean(raw) || el.dataset.lb : o.label; if (lb) el.dataset.lb = lb;
  el.classList.add('icb'); if (lb) el.classList.add('icbl');
  el.innerHTML = icon(ic) + (lb ? `<span class="icl">${esc(lb)}</span>` : '');
}
function iconScan(root) {
  if (root.nodeType !== 1) { if (root.parentElement && root.parentElement.matches(ICON_SEL)) iconize(root.parentElement); return; }
  if (root.matches(ICON_SEL)) iconize(root);
  root.querySelectorAll(ICON_SEL).forEach(iconize);
}
iconScan(document.body);
new MutationObserver(ms => { for (const m of ms) { if (m.target.nodeType === 1 && m.target.matches && m.target.matches(ICON_SEL)) iconize(m.target); m.addedNodes.forEach(iconScan); } })
  .observe(document.body, { subtree: true, childList: true, characterData: true });

// ---------- Bilgi balonu (tooltip) ----------
{
  const tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip);
  let cur = null, tm = null;
  const hide = () => { clearTimeout(tm); tm = null; cur = null; tip.classList.remove('on'); };
  const show = el => {
    const t = el.dataset.tip; if (!t) return;
    tip.innerHTML = `<b></b>` + (el.dataset.key ? `<kbd></kbd>` : '') + (el.dataset.tip2 ? `<div></div>` : '');
    tip.querySelector('b').textContent = t; if (el.dataset.key) tip.querySelector('kbd').textContent = el.dataset.key; if (el.dataset.tip2) tip.querySelector('div').textContent = el.dataset.tip2;
    tip.classList.add('on'); const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8; if (y + th > innerHeight - 4) y = r.top - th - 8;
    tip.style.left = Math.max(4, Math.min(innerWidth - tw - 4, x)) + 'px'; tip.style.top = Math.max(4, y) + 'px';
  };
  document.addEventListener('mouseover', e => {
    let el = e.target.closest && e.target.closest('[data-tip],[title]');
    if (el && el.hasAttribute('title')) { const t = el.getAttribute('title'); el.removeAttribute('title'); if (t && !el.dataset.tip) el.dataset.tip = t; }
    if (el && !el.dataset.tip) el = null;
    if (el === cur) return; hide(); if (!el) return;
    cur = el; tm = setTimeout(() => { if (cur === el && el.isConnected) show(el); }, tip.dataset.warm ? 60 : 380);
  }, true);
  let cool = null;
  document.addEventListener('mouseout', e => { if (cur && !cur.contains(e.relatedTarget)) { if (tip.classList.contains('on')) { tip.dataset.warm = 1; clearTimeout(cool); cool = setTimeout(() => delete tip.dataset.warm, 600); } hide(); } }, true);
  addEventListener('mousedown', hide, true); addEventListener('wheel', hide, true); addEventListener('keydown', hide, true); addEventListener('blur', hide);
}

// ---------- Dil seçici (ana ekran sağ üst) ----------
{
  const hh = document.querySelector('#home .hhead');
  if (hh) {
    const d = document.createElement('div'); d.id = 'langSw';
    d.innerHTML = icon('globe', 16) + [['en', 'EN', 'English'], ['tr', 'TR', 'Türkçe']].map(([k, n, full]) => `<button data-l="${k}" data-noi18n class="${k === LANG ? 'on' : ''}" data-tip="${full}">${n}</button>`).join('');
    d.querySelectorAll('button').forEach(b => b.onclick = () => setLang(b.dataset.l));
    hh.appendChild(d);
  }
}
