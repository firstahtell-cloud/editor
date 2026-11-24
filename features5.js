// ===================== Ek özellikler (5): içe aktarma penceresi =====================
// Yeni dosya eklenince: ad ver, grup seç; "Dolaba ekle" ya da "Sadece projeye ekle" (dolaba girmez).
async function importPaths(paths, opt = {}) {
  const out = [], fresh = [];
  for (const p of paths) {
    let m = library.find(x => x.path === p);
    if (m) { out.push(m); continue; }
    m = { id: uid(), path: p, name: p.split(/[\\/]/).pop(), kind: detectKind(p) };
    status('İçe aktarılıyor: ' + m.name);
    if (!(await probeEl(m))) { status('Açılamadı: ' + m.name); continue; }
    m.hasAudio = m.kind === 'image' ? false : (m.kind === 'audio' ? true : (await window.api.probe(p)).hasAudio);
    fresh.push(m); out.push(m);
  }
  status('');
  if (!fresh.length) return out;
  let mode = 'lib';
  if (!opt.quiet) mode = await importDialog(fresh);
  if (mode === 'cancel') { const f = new Set(fresh); const kept = out.filter(m => !f.has(m)); kept.cancelled = true; return kept; }
  if (mode === 'proj') { fresh.forEach(m => m.projOnly = true); out.projOnly = true; }
  else { for (const m of fresh) library.unshift(m); await window.api.libSave(library); renderLib(); }
  if (mode === 'proj' && opt.place) { commit(); let s = time; for (const m of out) { const c = addMediaClip(m, s); s += c.dur; } refreshAll(); status(`${fresh.length} dosya projeye eklendi (dolaba girmedi)`); setTimeout(() => status(''), 3000); }
  return out;
}
async function importDialog(list) {
  const groups = [...new Set(library.map(m => m.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const gOpts = sel => `<option value="">Grupsuz</option>${groups.map(g => `<option value="${esc(g)}" ${g === sel ? 'selected' : ''}>${esc(g)}</option>`).join('')}<option value="__new">+ Yeni grup…</option>`;
  const icon = m => m.thumb ? `<img src="${m.thumb}">` : `<div class="impic">${m.kind === 'audio' ? '♪' : m.kind === 'image' ? '▨' : '▣'}</div>`;
  const html = `${list.length > 1 ? `<div class="improw imall"><span>Hepsi için grup</span><select id="impAll">${gOpts(lastImpGroup)}</select><input id="impAllNew" class="impnew" placeholder="Yeni grup adı" style="display:none"></div>` : ''}
    <div class="implist">${list.map((m, i) => `<div class="improw" data-i="${i}">${icon(m)}
      <input class="impname" value="${esc(m.name.replace(/\.[^.]+$/, ''))}" title="${esc(m.path)}" spellcheck="false">
      <select class="impg">${gOpts(lastImpGroup)}</select><input class="impnew" placeholder="Yeni grup adı" style="display:none"></div>`).join('')}</div>
    <div class="hint2">"Sadece projeye ekle" dosyayı dolaba koymaz; doğrudan zaman çizelgesine ekler.</div>`;
  const p = dialog({ title: list.length > 1 ? `${list.length} dosya ekleniyor` : 'Dosya ekleniyor', html, wide: true,
    buttons: [{ label: 'İptal', v: 'cancel', cls: 'ghost' }, { label: 'Sadece projeye ekle', v: 'proj' }, { label: 'Dolaba ekle', v: 'lib', cls: 'primary' }] });
  const X = $('#dlg .dextra');
  const wire = (s, n) => { s.onchange = () => { n.style.display = s.value === '__new' ? '' : 'none'; if (s.value === '__new') n.focus(); }; };
  X.querySelectorAll('.improw[data-i]').forEach(r => wire(r.querySelector('.impg'), r.querySelector('.impnew')));
  const all = X.querySelector('#impAll');
  if (all) { const an = X.querySelector('#impAllNew'); wire(all, an); const push = () => X.querySelectorAll('.improw[data-i]').forEach(r => { const s = r.querySelector('.impg'), n = r.querySelector('.impnew'); s.value = all.value; n.value = an.value; n.style.display = all.value === '__new' ? '' : 'none'; }); all.addEventListener('change', push); an.oninput = push; }
  setTimeout(() => { const f = X.querySelector('.impname'); if (f) { f.focus(); f.select(); } }, 30);
  const r = await p;
  if (r.v === 'cancel') return 'cancel';
  X.querySelectorAll('.improw[data-i]').forEach(row => {
    const m = list[+row.dataset.i], nm = row.querySelector('.impname').value.trim(), s = row.querySelector('.impg').value, nw = row.querySelector('.impnew').value.trim();
    if (nm && nm !== m.name) m.alias = nm;
    const g = s === '__new' ? nw : s; if (g) { m.group = g; lastImpGroup = g; } else lastImpGroup = '';
  });
  return r.v;
}
let lastImpGroup = '';

// ---- Güncelleme bildirimi: dosyalar değişince yeniden başlatmayı öner ----
window.api.onUpdated?.(() => {
  if (document.getElementById('updBar')) return;
  const b = document.createElement('div'); b.id = 'updBar';
  b.innerHTML = '<span>Editör güncellendi. Yeni sürümü kullanmak için yeniden başlat.</span><button class="primary" id="updGo">Yeniden başlat</button><button class="ghost" id="updLater">Sonra</button>';
  document.body.appendChild(b);
  $('#updLater').onclick = () => b.remove();
  $('#updGo').onclick = async () => { if (!inEditor() || await askSave()) window.api.relaunch(); };
});
