// features11.js — Göz (video dışını gizle) + tam ekran
let cleanView = (() => { try { return localStorage.getItem('cleanView') === '1'; } catch { return false; } })();
let fsOn = false;
{
  const tp = $('#transport');
  const g = document.createElement('div'); g.id = 'vwBtns';
  g.innerHTML = `<button id="bEye" title="Video dışını gizle (H)"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
<path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>
<path class="eyGap" d="M4 4L20 20"/><path class="eySl" d="M4 4L20 20"/></svg></button>
<button id="bFull" title="Tam ekran (F)"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
<g class="fsIn"><path d="M14 4h6v6"/><path d="M20 4l-6.5 6.5"/><path d="M10 20H4v-6"/><path d="M4 20l6.5-6.5"/></g>
<g class="fsOut"><path d="M20 10h-6V4"/><path d="M14 10l6.5-6.5"/><path d="M4 14h6v6"/><path d="M10 14l-6.5 6.5"/></g></svg></button>`;
  tp.appendChild(g);
  const sync = () => { $('#bEye').classList.toggle('on', cleanView); document.body.classList.toggle('fsmode', fsOn); };
  sync();
  window.toggleClean = () => { cleanView = !cleanView; try { localStorage.setItem('cleanView', cleanView ? '1' : '0'); } catch { } sync(); draw(); };
  $('#bEye').onclick = e => { e.currentTarget.blur(); toggleClean(); };
  const view = $('#view');
  window.toggleFull = () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); else view.requestFullscreen().catch(() => { }); };
  $('#bFull').onclick = e => { e.currentTarget.blur(); toggleFull(); };
  document.addEventListener('fullscreenchange', () => { fsOn = document.fullscreenElement === view; sync(); fsShow(); fitCanvas(); fsFit(); });
  // tam ekranda videoyu büyüt
  function fsFit() {
    if (!fsOn) return;
    const s = Math.min(cv.width / W, cv.height / H); VIEW = { s, ox: (cv.width - W * s) / 2, oy: (cv.height - H * s) / 2 }; draw();
  }
  new ResizeObserver(fsFit).observe(stage);
  // tam ekranda kontrol çubuğu: fare hareketinde görün, 2.5 sn sonra gizlen
  let hideT = 0;
  function fsShow() { view.classList.add('fsUi'); clearTimeout(hideT); if (fsOn) hideT = setTimeout(() => { if (!tp.matches(':hover')) view.classList.remove('fsUi'); }, 2500); }
  view.addEventListener('mousemove', () => { if (fsOn) fsShow(); });
  // tam ekranda tuvale tıklama = oynat/durdur, çift tık = çık (düzenleme yok)
  let clkT = 0;
  stage.addEventListener('mousedown', e => { if (!fsOn) return; e.stopPropagation(); e.preventDefault(); }, true);
  stage.addEventListener('click', e => { if (!fsOn) return; e.stopPropagation(); clearTimeout(clkT); clkT = setTimeout(() => play(), 220); }, true);
  stage.addEventListener('dblclick', e => { if (!fsOn) return; e.stopPropagation(); clearTimeout(clkT); toggleFull(); }, true);
  stage.addEventListener('wheel', e => { if (fsOn) { e.stopPropagation(); e.preventDefault(); } }, { capture: true, passive: false });
  stage.addEventListener('contextmenu', e => { if (fsOn) { e.stopPropagation(); e.preventDefault(); } }, true);
  // kısayollar: H = göz, F = tam ekran; tam ekranda sadece oynatma kısayolları
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.altKey || e.metaKey || exporting || !inEditor()) return;
    if (!$('#dlg').classList.contains('hidden')) return;
    const a = document.activeElement; if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName) && a.type !== 'range' && a.type !== 'checkbox') return;
    if (typeof coverCtx !== 'undefined' && coverCtx) return;
    const k = String(e.key || '').toLowerCase();
    if (k === 'f') { e.preventDefault(); e.stopImmediatePropagation(); return toggleFull(); }
    if (k === 'h' && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); return toggleClean(); }
    if (fsOn) {
      e.stopImmediatePropagation();
      if (e.key === ' ' || k === 'k') { e.preventDefault(); play(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setTime(time - 5); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setTime(time + 5); }
      else if (e.key === 'Home') { e.preventDefault(); setTime(0); }
      fsShow();
    }
  }, true);
}
{ // video dışını tamamen gizle
  const _r = renderAt;
  renderAt = function (t, c2 = ctx, preview = false, k = 1) {
    _r(t, c2, preview, k);
    if (preview && (cleanView || fsOn)) {
      c2.save(); c2.setTransform(1, 0, 0, 1, 0, 0); c2.globalAlpha = 1; c2.filter = 'none'; c2.globalCompositeOperation = 'source-over';
      const fx = VIEW.ox, fy = VIEW.oy, fw = W * VIEW.s, fh = H * VIEW.s;
      c2.beginPath(); c2.rect(0, 0, c2.canvas.width, c2.canvas.height); c2.rect(fx, fy, fw, fh);
      c2.fillStyle = fsOn ? '#000' : '#0d0d10'; c2.fill('evenodd');
      if (!fsOn) { c2.strokeStyle = '#3a3a46'; c2.lineWidth = 1; c2.strokeRect(fx - 0.5, fy - 0.5, fw + 1, fh + 1); }
      c2.restore();
    }
  };
}
{ // tam ekranda seçim çerçeveleri vs. çizilmesin
  const _d = draw;
  draw = function () {
    if (!fsOn) return _d();
    renderAt(time, ctx, true);
    $('#tc').textContent = fmt(time) + ' / ' + fmt(duration());
    $('#playhead').style.left = (time * pps) + 'px'; $('#phLabel').textContent = fmt(time);
  };
}
SHORTCUTS.push(['H', 'Video dışını gizle / göster (göz)'], ['F', 'Tam ekran (çık: Esc / çift tık)']);
