// ===================== Ek özellikler (9): Blender gibi G ile taşıma =====================
// G: seçili öğeler imleci takip eder. X / Y: eksene kilitle, Shift: hassas, tık / Enter: onayla, Esc / sağ tık: iptal.
let grab = null, lastMouse = null;
addEventListener('mousemove', e => { lastMouse = { x: e.clientX, y: e.clientY, sx: e.shiftKey }; if (grab) grabMove(e); }, true);
function grabStart() {
  const ids = [...new Set([...selSet, sel].filter(Boolean))];
  const cs = ids.map(id => findClip(id)?.clip).filter(c => c && kindOf(c) === 'visual' && active(c, time));
  if (!cs.length) { status('G: önce önizlemede bir öğe seç'); setTimeout(() => status(''), 1800); return; }
  if (playing) pause();
  const r = cv.getBoundingClientRect(), m = lastMouse && lastMouse.x >= r.left && lastMouse.x <= r.right && lastMouse.y >= r.top && lastMouse.y <= r.bottom ? lastMouse : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const [px, py] = canvasPt({ clientX: m.x, clientY: m.y });
  grab = { before: JSON.stringify(proj), cs: cs.map(c => ({ c, x0: val(c, 'x', time - c.start), y0: val(c, 'y', time - c.start) })), px, py, axis: null, acc: [0, 0], last: [px, py] };
  cv.style.cursor = 'move'; grabInfo(0, 0);
}
function grabInfo(dx, dy) { status(`Taşı ${grab.axis ? '(' + grab.axis.toUpperCase() + ' ekseni) ' : ''}X ${Math.round(dx)}  Y ${Math.round(dy)} · X/Y: eksen · Shift: hassas · tık/Enter: onayla · Esc/sağ tık: iptal`); }
function grabMove(e) {
  const [qx, qy] = canvasPt(e), k = e.shiftKey ? 0.1 : 1;
  grab.acc[0] += (qx - grab.last[0]) * k; grab.acc[1] += (qy - grab.last[1]) * k; grab.last = [qx, qy];
  let [dx, dy] = grab.acc; if (grab.axis === 'x') dy = 0; if (grab.axis === 'y') dx = 0;
  for (const g of grab.cs) { setProp(g.c, 'x', Math.round(g.x0 + dx)); setProp(g.c, 'y', Math.round(g.y0 + dy)); }
  grabInfo(dx, dy); draw();
}
function grabEnd(ok) {
  if (!grab) return; const g = grab; grab = null; cv.style.cursor = ''; status('');
  if (ok) { undoS.push(g.before); redoS.length = 0; dirty = true; refreshAll(); }
  else { proj = JSON.parse(g.before); refreshAll(); }
}
addEventListener('keydown', e => {
  if (grab) {
    e.preventDefault(); e.stopImmediatePropagation();
    const k = String(e.key || '').toLowerCase();
    if (k === 'escape') grabEnd(false);
    else if (k === 'enter' || k === ' ') grabEnd(true);
    else if (k === 'x' || k === 'y') { grab.axis = grab.axis === k ? null : k; if (lastMouse) grabMove({ clientX: lastMouse.x, clientY: lastMouse.y, shiftKey: e.shiftKey }); }
    return;
  }
  const ae = document.activeElement, typing = ae && (['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) || ae.isContentEditable);
  if (typing || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || addMenuOpen() || !inEditor() || !$('#dlg').classList.contains('hidden')) return;
  if (e.code === 'KeyG') { e.preventDefault(); e.stopImmediatePropagation(); grabStart(); }
}, true);
addEventListener('mousedown', e => { if (!grab) return; e.preventDefault(); e.stopImmediatePropagation(); grabEnd(e.button === 0); }, true);
addEventListener('contextmenu', e => { if (grab || e.target === cv) { if (grab) { e.preventDefault(); grabEnd(false); } } }, true);
addEventListener('blur', () => grabEnd(false));
SHORTCUTS.push(['G', 'Taşı (Blender gibi) · X/Y eksen, Shift hassas, Esc iptal']);
