const { app, BrowserWindow, ipcMain, dialog, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { Readable } = require('stream');
const MEDIA_MIME = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska', '.webm': 'video/webm', '.avi': 'video/x-msvideo', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

let ffmpegPath = process.env.EDITOR_FFMPEG || [path.join(__dirname, 'ffmpeg.exe'), path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')].find(p => { try { return require('original-fs').existsSync(p); } catch { return false; } }) || path.join(__dirname, 'ffmpeg.exe');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);

// ---- MEDYA_SUNUCU_BAŞ: video dosyalarını parça parça (Range) veren yerel sunucu ----
const http = require('http');
const MEDIA_TOKEN = crypto.randomBytes(16).toString('hex');
let mediaBase = '';
function startMediaServer() {
  return new Promise(resolve => {
    const srv = http.createServer(async (req, res) => {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Cache-Control': 'no-store' };
      try {
        if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/m' || u.searchParams.get('t') !== MEDIA_TOKEN) { res.writeHead(403, cors); return res.end(); }
        const p = u.searchParams.get('p') || '';
        const st = await fs.promises.stat(p); const size = st.size;
        const h = { ...cors, 'Content-Type': MEDIA_MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        let start = 0, end = size - 1, status = 200;
        if (m) {
          if (m[1] === '' && m[2] !== '') start = Math.max(0, size - +m[2]);
          else { start = +m[1] || 0; if (m[2] !== '') end = Math.min(+m[2], size - 1); }
          if (start >= size || start > end) { res.writeHead(416, { ...h, 'Content-Range': `bytes */${size}` }); return res.end(); }
          status = 206; h['Content-Range'] = `bytes ${start}-${end}/${size}`;
        }
        h['Content-Length'] = String(end - start + 1);
        res.writeHead(status, h);
        if (req.method === 'HEAD') return res.end();
        const rs = fs.createReadStream(p, { start, end }); rs.pipe(res);
        res.on('close', () => rs.destroy()); rs.on('error', () => res.destroy());
      } catch (err) { if (!res.headersSent) res.writeHead(404, cors); res.end(); }
    });
    srv.listen(0, '127.0.0.1', () => { mediaBase = `http://127.0.0.1:${srv.address().port}/m?t=${MEDIA_TOKEN}&p=`; resolve(); });
  });
}
// ---- MEDYA_SUNUCU_SON ----
ipcMain.on('media:base', e => { e.returnValue = mediaBase; });

const userDir = () => app.getPath('userData');
const libFile = () => path.join(userDir(), 'library.json');
const autoFile = () => path.join(userDir(), 'autosave.json');
const modelsDir = () => process.env.EDITOR_MODELS || path.join(userDir(), 'models');
let win, allowClose = false;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.txt': 'text/plain', '.png': 'image/png', '.svg': 'image/svg+xml' };
const isoHeaders = h => { h.set('Cache-Control', 'no-store'); h.set('Cross-Origin-Opener-Policy', 'same-origin'); h.set('Cross-Origin-Embedder-Policy', 'require-corp'); h.set('Cross-Origin-Resource-Policy', 'same-origin'); return h; };
function inside(base, p) { const r = path.resolve(base, p); return r.startsWith(path.resolve(base)) ? r : null; }

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 900, minWidth: 800, minHeight: 550,
    backgroundColor: '#141416', autoHideMenuBar: true, title: 'Editör 3.6',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.removeMenu();
  // ---- Tanı günlüğü: userData/editor-log.txt ----
  const LOG = path.join(app.getPath('userData'), 'editor-log.txt');
  const lg = s => { try { fs.appendFileSync(LOG, new Date().toISOString() + ' ' + s + '\n'); } catch { } };
  try { if (fs.existsSync(LOG) && fs.statSync(LOG).size > 2e6) fs.unlinkSync(LOG); } catch { }
  lg('BAŞLADI sürüm=3.6 klasör=' + __dirname);
  win.webContents.on('console-message', (e, level, message, line, sourceId) => { if (level >= 2 || /^\[TANI\]/.test(message)) lg(`[${level}] ${message} (${String(sourceId).split('/').pop()}:${line})`); });
  win.webContents.on('preload-error', (e, p, err) => lg('PRELOAD HATA ' + err));
  win.webContents.on('render-process-gone', (e, d) => lg('RENDER ÇÖKTÜ ' + JSON.stringify(d)));
  win.webContents.on('did-fail-load', (e, code, desc, url) => lg('YÜKLENEMEDİ ' + code + ' ' + desc + ' ' + url));
  win.loadURL('app://editor/index.html');

  // Uygulama dosyaları açıkken değişirse (güncelleme) kullanıcıya haber ver
  try { let tm = null; fs.watch(__dirname, (ev, f) => { if (!f || !/\.(js|html|css)$/.test(f)) return; clearTimeout(tm); tm = setTimeout(() => { lg('GÜNCELLEME algılandı: ' + f); win && !win.isDestroyed() && win.webContents.send('app:updated'); }, 1500); }); } catch (e) { lg('izleme başlatılamadı ' + e); }
  win.on('close', e => { if (allowClose) return; e.preventDefault(); win.webContents.send('app:close-req'); });
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type === 'keyDown' && i.key === 'F12') win.webContents.toggleDevTools();
  });
}

ipcMain.handle('app:relaunch', () => { allowClose = true; app.relaunch(); app.exit(0); });
app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(true));
  session.defaultSession.setPermissionCheckHandler(() => true);
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    try {
      if (u.pathname === '/media') { // kullanıcı dosyaları (Range destekli)
        const p = u.searchParams.get('p') || '';
        const st = await fs.promises.stat(p); const size = st.size;
        const h = isoHeaders(new Headers({ 'Content-Type': MEDIA_MIME[path.extname(p).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' }));
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
        let start = 0, end = size - 1, status = 200;
        if (m) {
          if (m[1] === '' && m[2] !== '') { start = Math.max(0, size - +m[2]); }
          else { start = +m[1] || 0; if (m[2] !== '') end = Math.min(+m[2], size - 1); }
          if (start >= size || start > end) { h.set('Content-Range', `bytes */${size}`); return new Response(null, { status: 416, headers: h }); }
          status = 206; h.set('Content-Range', `bytes ${start}-${end}/${size}`);
        }
        h.set('Content-Length', String(end - start + 1));
        const body = Readable.toWeb(fs.createReadStream(p, { start, end }));
        return new Response(body, { status, headers: h });
      }
      let file;
      if (u.pathname.startsWith('/models/')) file = inside(modelsDir(), decodeURIComponent(u.pathname.slice(8)));
      else file = inside(__dirname, decodeURIComponent(u.pathname.slice(1)) || 'index.html');
      if (!file || !fs.existsSync(file)) return new Response('not found', { status: 404, headers: isoHeaders(new Headers()) });
      const data = await fs.promises.readFile(file);
      const h = isoHeaders(new Headers({ 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': String(data.length) }));
      return new Response(data, { status: 200, headers: h });
    } catch (err) { return new Response(String(err), { status: 500, headers: isoHeaders(new Headers()) }); }
  });
  await startMediaServer();
  try { await session.defaultSession.clearCache(); await session.defaultSession.clearCodeCaches({}); } catch { }
  createWindow();
});
app.on('window-all-closed', () => app.quit());

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

ipcMain.handle('lib:load', () => readJSON(libFile(), []));
ipcMain.handle('lib:save', (e, data) => { fs.writeFileSync(libFile(), JSON.stringify(data)); return true; });
ipcMain.handle('auto:load', () => readJSON(autoFile(), null));
ipcMain.handle('auto:save', (e, data) => { fs.writeFileSync(autoFile(), JSON.stringify(data)); return true; });
ipcMain.handle('file:exists', (e, p) => fs.existsSync(p));

const EXT = { video: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v'], audio: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'], image: ['png', 'jpg', 'jpeg', 'webp', 'gif'] };
const NAMES = { video: 'Video', audio: 'Ses', image: 'Görsel' };
ipcMain.handle('dlg:media', async (e, kind) => {
  const filters = kind && EXT[kind] ? [{ name: NAMES[kind], extensions: EXT[kind] }] : [{ name: 'Medya', extensions: [...EXT.video, ...EXT.audio, ...EXT.image] }];
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'], filters });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('probe', (e, p) => new Promise(res => {
  const pr = spawn(ffmpegPath, ['-hide_banner', '-i', p], { windowsHide: true });
  let s = ''; pr.stderr.on('data', d => s += d);
  pr.on('close', () => res({ hasAudio: /Stream #.*Audio:/.test(s) }));
  pr.on('error', () => res({ hasAudio: false }));
}));

// ---- VIDEO_ÇEKİRDEK_BAŞ ----
// Video kareleri tarayıcının video oynatıcısıyla değil, doğrudan ffmpeg ile çözülür.
// Her klip için sıralı kare akışı (oturum) tutulur: oynatırken kareler sırayla okunur,
// başka bir noktaya atlanınca oturum o noktadan yeniden başlatılır.
const vdec = new Map(); // key -> oturum
function vKill(s) { if (!s) return; s.dead = true; try { s.proc.kill(); } catch { } for (const w of s.waiters) w.res(s.last || null); s.waiters = []; }
function vStart(key, p, t0, fps, h, sp = 1) {
  vKill(vdec.get(key));
  const args = ['-v', 'error', '-nostdin', '-ss', Math.max(0, t0).toFixed(4), '-i', p, '-an', '-sn', '-dn',
    '-vf', `${sp !== 1 ? `setpts=PTS/${sp},` : ''}fps=${fps},scale=-2:'min(${h},ih)':flags=bilinear`, '-q:v', '4', '-f', 'image2pipe', '-c:v', 'mjpeg', 'pipe:1'];
  const proc = spawn(ffmpegPath, args, { windowsHide: true });
  const s = { key, p, t0, fps, h, sp, proc, idx: 0, ready: [], waiters: [], buf: Buffer.alloc(0), last: null, ended: false, dead: false };
  proc.stdout.on('data', d => {
    s.buf = s.buf.length ? Buffer.concat([s.buf, d]) : d;
    for (;;) { // JPEG: FFD8 ... FFD9
      const a = s.buf.indexOf(Buffer.from([0xff, 0xd8])); if (a < 0) { s.buf = Buffer.alloc(0); break; }
      const b = s.buf.indexOf(Buffer.from([0xff, 0xd9]), a + 2); if (b < 0) { if (a > 0) s.buf = s.buf.subarray(a); break; }
      const jpg = Buffer.from(s.buf.subarray(a, b + 2)); s.buf = s.buf.subarray(b + 2);
      vPush(s, { i: s.idx++, jpg });
    }
  });
  proc.stderr.on('data', () => { });
  const fin = () => { s.ended = true; for (const w of s.waiters) w.res(s.last || null); s.waiters = []; };
  proc.on('close', fin); proc.on('error', fin);
  vdec.set(key, s); return s;
}
function vPush(s, f) {
  s.last = f; s.ready.push(f);
  s.waiters = s.waiters.filter(w => { if (w.k <= f.i) { w.res(f); return false; } return true; });
  if (s.waiters.length) { const minK = Math.min(...s.waiters.map(w => w.k)); s.ready = s.ready.filter(x => x.i >= minK - 1); }
  s.ready = s.ready.slice(-12);
  if (!s.waiters.length && s.ready.length >= 8) s.proc.stdout.pause();
}
function vGet(key, p, t, fps, h, sp = 1) {
  return new Promise(res => {
    let s = vdec.get(key);
    const kOf = s => Math.round((t - s.t0) * s.fps / s.sp);
    if (!s || s.dead || s.p !== p || s.fps !== fps || s.h !== h || s.sp !== sp) s = vStart(key, p, t, fps, h, sp);
    let k = kOf(s);
    const have = s.ready.find(x => x.i === k); if (have) return res(have);
    const lo = s.ready.length ? s.ready[0].i : s.idx;
    if (k < lo || k > s.idx + Math.max(4, fps * 1.5)) { s = vStart(key, p, t, fps, h, sp); k = 0; }
    else if (s.ended && k >= s.idx) return res(s.last);
    const w = { k, res: f => { clearTimeout(tm); res(f); } }; const tm = setTimeout(() => { s.waiters = s.waiters.filter(x => x !== w); res(s.last || null); }, 10000);
    s.waiters.push(w); s.proc.stdout.resume();
  }).then(f => f ? { i: f.i, jpg: f.jpg } : null);
}
ipcMain.handle('vid:frame', (e, { key, p, t, fps, h, sp }) => vGet(key, p, t, fps, h, sp || 1));
ipcMain.handle('vid:close', (e, key) => { if (key) { vKill(vdec.get(key)); vdec.delete(key); } else { for (const s of vdec.values()) vKill(s); vdec.clear(); } return true; });
ipcMain.handle('vid:info', (e, p) => new Promise(res => {
  const pr = spawn(ffmpegPath, ['-hide_banner', '-i', p], { windowsHide: true });
  let s = ''; pr.stderr.on('data', d => s += d);
  pr.on('close', () => {
    const v = /Stream #[^\n]*Video:[^\n]*?(\d{2,5})x(\d{2,5})[^\n]*/.exec(s), f = /(\d+(?:\.\d+)?) (?:fps|tbr)/.exec(v ? v[0] : '');
    const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(s);
    let w = v ? +v[1] : 0, hh = v ? +v[2] : 0; const rot = /rotat\w*\s*[:=]\s*(-?\d+)/.exec(s); if (rot && Math.abs(+rot[1]) % 180 === 90) [w, hh] = [hh, w];
    res({ w, h: hh, fps: f ? +f[1] : 30, dur: d ? (+d[1]) * 3600 + (+d[2]) * 60 + (+d[3]) : 0, hasAudio: /Stream #.*Audio:/.test(s) });
  });
  pr.on('error', () => res(null));
}));
// Önizleme sesi: dosyanın sesi ham PCM olarak (Web Audio ile çalınır)
ipcMain.handle('aud:pcm', (e, p) => new Promise(res => {
  const pr = spawn(ffmpegPath, ['-v', 'error', '-nostdin', '-i', p, '-vn', '-ac', '2', '-ar', '44100', '-f', 'f32le', 'pipe:1'], { windowsHide: true });
  const out = []; pr.stdout.on('data', d => out.push(d));
  pr.on('close', () => { const b = Buffer.concat(out); res(b.length >= 8 ? b : null); }); pr.on('error', () => res(null));
}));
app.on('before-quit', () => { for (const s of vdec.values()) vKill(s); });
// Kare dondurma: tek kareyi tam çözünürlükte JPEG olarak kaydet
ipcMain.handle('vid:still', (e, { p, t }) => new Promise(res => {
  const dir = path.join(userDir(), 'donmus'); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, crypto.createHash('md5').update(p).digest('hex').slice(0, 10) + '_' + Math.round(t * 1000) + '.jpg');
  if (fs.existsSync(out)) return res(out);
  const pr = spawn(ffmpegPath, ['-v', 'error', '-nostdin', '-ss', Math.max(0, t).toFixed(4), '-i', p, '-frames:v', '1', '-q:v', '2', '-y', out], { windowsHide: true });
  pr.on('close', code => res(code === 0 && fs.existsSync(out) ? out : null)); pr.on('error', () => res(null));
}));
// ---- VIDEO_ÇEKİRDEK_SON ----

// ---- Ses dalgası (peaks) ----
const PEAK_RATE = 100;
ipcMain.handle('peaks', async (e, p) => {
  let st; try { st = fs.statSync(p); } catch { return null; }
  const dir = path.join(userDir(), 'peaks'); fs.mkdirSync(dir, { recursive: true });
  const key = crypto.createHash('md5').update(p + '|' + st.size + '|' + st.mtimeMs).digest('hex');
  const cf = path.join(dir, key + '.bin');
  if (fs.existsSync(cf)) return { rate: PEAK_RATE, data: fs.readFileSync(cf) };
  return new Promise(res => {
    const SR = 8000, per = SR / PEAK_RATE;
    const pr = spawn(ffmpegPath, ['-v', 'error', '-i', p, '-vn', '-ac', '1', '-ar', String(SR), '-f', 's16le', 'pipe:1'], { windowsHide: true });
    const out = []; let cur = 0, n = 0, rest = Buffer.alloc(0);
    pr.stdout.on('data', d => {
      const b = rest.length ? Buffer.concat([rest, d]) : d; const len = b.length - (b.length % 2);
      for (let i = 0; i < len; i += 2) { const v = Math.abs(b.readInt16LE(i)); if (v > cur) cur = v; if (++n >= per) { out.push(Math.min(255, Math.round(cur / 32768 * 255))); cur = 0; n = 0; } }
      rest = b.subarray(len);
    });
    pr.on('close', () => { if (n) out.push(Math.min(255, Math.round(cur / 32768 * 255))); const buf = Buffer.from(out); try { fs.writeFileSync(cf, buf); } catch { } res({ rate: PEAK_RATE, data: buf }); });
    pr.on('error', () => res(null));
  });
});

// ---- Ses grafiği (dışa aktarma ve altyazı için ortak) ----
function tempoChain(s) { const f = []; let x = s; while (x > 2) { f.push(2); x /= 2; } while (x < 0.5) { f.push(0.5); x /= 0.5; } if (Math.abs(x - 1) > 1e-4) f.push(x); return f.map(v => `atempo=${v.toFixed(5)}`).join(','); }
function audioGraph(audio, duration, base) {
  const inputs = [], filters = [], labels = [];
  audio.forEach((a, i) => {
    inputs.push('-i', a.path);
    const sp = a.speed || 1, chain = [`atrim=start=${a.in.toFixed(4)}:duration=${(a.dur * sp).toFixed(4)}`, 'asetpts=PTS-STARTPTS'];
    if (a.rev) chain.push('areverse');
    const t = tempoChain(sp); if (t) chain.push(t);
    chain.push(a.volExpr ? `volume='${a.volExpr}':eval=frame` : `volume=${a.volume}`, `adelay=${Math.round(a.start * 1000)}:all=1`);
    if (a.duck) chain.push(`volume='${a.duck}':eval=frame`);
    const pr = a.pitch ? Math.pow(2, a.pitch / 12) : 1; // ton: en sonda (gecikmeden sonra, yoksa adelay bozuluyor), süre değişmez
    if (pr !== 1) chain.push('aresample=48000', `asetrate=${Math.round(48000 * pr)}`, 'aresample=48000', tempoChain(1 / pr));
    filters.push(`[${base + i}:a]${chain.join(',')}[a${i}]`); labels.push(`[a${i}]`);
  });
  if (!labels.length) return null;
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:duration=longest,apad,atrim=duration=${duration.toFixed(4)}[aout]`);
  return { inputs, graph: filters.join(';') };
}

// Hız rampalı kliplerin hazır sesi (renderer'da perde korunarak esnetildi) → geçici WAV
ipcMain.handle('aud:tmpwav', (e, { name, sr, data }) => {
  try {
    const dir = path.join(userDir(), 'tmp'); fs.mkdirSync(dir, { recursive: true });
    const pcm = Buffer.from(data.buffer ? data.buffer : data, data.byteOffset || 0, data.byteLength || data.length), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
    h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    const p = path.join(dir, String(name).replace(/[^\w-]/g, '') + '.wav'); fs.writeFileSync(p, Buffer.concat([h, pcm])); return p;
  } catch (err) { return null; }
});

// ---- Export ----
let ff = null;
ipcMain.handle('exp:start', async (e, cfg) => {
  const r = process.env.EDITOR_TEST_OUT ? { filePath: process.env.EDITOR_TEST_OUT } : await dialog.showSaveDialog(win, { filters: [{ name: 'MP4', extensions: ['mp4'] }], defaultPath: 'video.mp4' });
  if (r.canceled) return null;
  const { w, h, fps, duration, audio, crf } = cfg;
  const args = ['-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', 'pipe:0'];
  const g = audioGraph(audio, duration, 1);
  if (g) args.push(...g.inputs, '-filter_complex', g.graph, '-map', '0:v', '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf || 18), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', String(duration), r.filePath);
  ff = spawn(ffmpegPath, args, { windowsHide: true });
  let log = '';
  ff.stderr.on('data', d => { log = (log + d).slice(-4000); });
  ff.on('close', code => { win.webContents.send('exp:done', { code, log, file: r.filePath }); ff = null; });
  ff.stdin.on('error', () => {});
  return r.filePath;
});
ipcMain.handle('exp:frame', (e, buf) => new Promise(res => {
  if (!ff) return res(false);
  if (ff.stdin.write(Buffer.from(buf))) res(true); else ff.stdin.once('drain', () => res(true));
}));
ipcMain.handle('exp:end', () => { if (ff) ff.stdin.end(); return true; });
ipcMain.handle('exp:cancel', () => { if (ff) { ff.kill(); ff = null; } return true; });

// ---- Otomatik altyazı: model indirme + ses çıkarma ----
const MODELS = {
  base: { id: 'Xenova/whisper-base', url: 'https://registry.npmjs.org/sts-whisper-base/-/sts-whisper-base-1.0.0.tgz', sri: 'sha512-lBXHIZX66KiR4+TMl2zCB4NO/Ih3Vp06l1yDjYtG9rROlLVPq3s7DiBtTRkeFQiDh0Zl3x+OmRuse17Fyjq20w==', size: 81 },
  small: { id: 'Xenova/whisper-small', url: 'https://registry.npmjs.org/sts-whisper-small/-/sts-whisper-small-1.0.0.tgz', sri: 'sha512-NoW0Id+PSL22BoV+34HXs0uT0et1Y63Cks/QCosYe0khaGMr6y/fBEup2k1+5fut3jxrZg1k1SrZ0gOpAU/LsQ==', size: 253 },
  tiny: { id: 'Xenova/whisper-tiny', url: 'https://registry.npmjs.org/sts-whisper-tiny/-/sts-whisper-tiny-1.0.0.tgz', sri: null, size: 45 }
};
const modelReady = id => fs.existsSync(path.join(modelsDir(), id, 'onnx', 'decoder_model_merged_quantized.onnx')) && fs.existsSync(path.join(modelsDir(), id, 'tokenizer.json'));
function untar(buf, destRoot, strip) { // basit ustar çözücü
  let off = 0;
  while (off + 512 <= buf.length) {
    const hdr = buf.subarray(off, off + 512); if (hdr.every(b => b === 0)) break;
    const str = (a, b) => hdr.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100); const prefix = str(345, 500); if (prefix) name = prefix + '/' + name;
    const size = parseInt(str(124, 136).trim() || '0', 8); const type = String.fromCharCode(hdr[156] || 48);
    off += 512;
    if ((type === '0' || type === '\0') && name.startsWith(strip)) {
      const rel = name.slice(strip.length); const dst = inside(destRoot, rel);
      if (dst && rel) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst, buf.subarray(off, off + size)); }
    }
    off += Math.ceil(size / 512) * 512;
  }
}
ipcMain.handle('asr:ensure', async (e, key) => {
  const M = MODELS[key]; if (!M) throw new Error('model yok');
  if (modelReady(M.id)) return M.id;
  const send = (p, msg) => win.webContents.send('asr:progress', { p, msg });
  send(0, 'Model indiriliyor…');
  const resp = await net.fetch(M.url); if (!resp.ok) throw new Error('İndirme hatası: ' + resp.status);
  const total = +resp.headers.get('content-length') || M.size * 1048576 * 0.75; const reader = resp.body.getReader(); const parts = []; let got = 0, last = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(Buffer.from(value)); got += value.length; if (Date.now() - last > 250) { last = Date.now(); send(Math.min(0.99, got / total), `Model indiriliyor… ${(got / 1048576).toFixed(0)} MB`); } }
  const tgz = Buffer.concat(parts);
  if (M.sri) { const h = 'sha512-' + crypto.createHash('sha512').update(tgz).digest('base64'); if (h !== M.sri) throw new Error('Model doğrulanamadı (bozuk indirme)'); }
  send(1, 'Model açılıyor…');
  untar(zlib.gunzipSync(tgz), modelsDir(), 'package/models/');
  if (!modelReady(M.id)) throw new Error('Model dosyaları eksik');
  return M.id;
});
ipcMain.handle('asr:audio', (e, { audio, duration }) => new Promise((res, rej) => {
  const g = audioGraph(audio, duration, 0); if (!g) return rej(new Error('Seste konuşma yok'));
  const pr = spawn(ffmpegPath, ['-v', 'error', ...g.inputs, '-filter_complex', g.graph, '-map', '[aout]', '-ac', '1', '-ar', '16000', '-f', 'f32le', 'pipe:1'], { windowsHide: true });
  const out = []; let err = '';
  pr.stdout.on('data', d => out.push(d)); pr.stderr.on('data', d => err += d);
  pr.on('close', code => code === 0 ? res(Buffer.concat(out)) : rej(new Error('ffmpeg: ' + err.slice(-300))));
  pr.on('error', rej);
}));

// ---- SFX_BAŞ: ses efektleri (kod ile üretilir, dış dosya gerekmez) ----
const SFX_VER = 2, SR = 44100;
function wav(samples, gain = 1) {
  let pk = 0; for (const v of samples) pk = Math.max(pk, Math.abs(v)); const g = pk > 0 ? 0.89 * gain / pk : 1;
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * g)) * 32767), 44 + i * 2));
  return b;
}
function synth(dur, fn) { const n = Math.round(dur * SR), out = new Float32Array(n); const st = {}; for (let i = 0; i < n; i++) out[i] = fn(i / SR, i / n, st); const f = Math.min(n, 64); for (let i = 0; i < f; i++) out[n - 1 - i] *= i / f; return out; }
const noise = () => Math.random() * 2 - 1;
function svf(st, k, x, f, q) { const s = st[k] || (st[k] = { l: 0, b: 0 }); const F = 2 * Math.sin(Math.PI * Math.min(f, SR / 6) / SR); const h = x - s.l - q * s.b; s.b += F * h; s.l += F * s.b; return s; }
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const sq = ph => (ph % 1 < 0.5 ? 1 : -1), saw = ph => 2 * (ph % 1) - 1;
function osc(st, k, f) { st[k] = (st[k] || 0) + f / SR; return st[k]; }
const SFX = [
  ['vinn', 'Vınn (geçiş)', synth(0.7, (t, p, st) => svf(st, 'a', noise(), 300 + 4000 * Math.sin(Math.PI * p), 0.5).b * Math.sin(Math.PI * p) ** 1.5)],
  ['pop', 'Pop', synth(0.14, (t, p, st) => Math.sin(2 * Math.PI * osc(st, 'o', 900 * Math.exp(-t * 25) + 180)) * env(t, 0.002, 0.04))],
  ['tik', 'Tık', synth(0.05, (t, p, st) => svf(st, 'a', noise(), 3000, 0.3).b * env(t, 0.0005, 0.006) + Math.sin(2 * Math.PI * 1800 * t) * env(t, 0.0005, 0.01) * 0.5)],
  ['ding', 'Ding', synth(1.6, (t) => [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.9, 0.1]].reduce((s, [m, a]) => s + a * Math.sin(2 * Math.PI * 1320 * m * t) * Math.exp(-t * (2 + m)), 0) * env(t, 0.002, 9))],
  ['bum', 'Bum (patlama)', synth(1.4, (t, p, st) => Math.sin(2 * Math.PI * osc(st, 'o', 30 + 70 * Math.exp(-t * 6))) * env(t, 0.005, 0.45) + svf(st, 'a', noise(), 600 * Math.exp(-t * 2) + 80, 0.7).l * env(t, 0.002, 0.25) * 1.2)],
  ['yukselen', 'Yükselen (riser)', synth(2.2, (t, p, st) => (saw(osc(st, 'o', 120 + 900 * p * p)) * 0.4 + svf(st, 'a', noise(), 500 + 7000 * p * p, 0.6).b) * p ** 2 * (p > 0.97 ? (1 - p) / 0.03 : 1))],
  ['dusus', 'Düşüş (çizgi film)', synth(1.0, (t, p, st) => Math.sin(2 * Math.PI * osc(st, 'o', 1400 * Math.pow(0.12, p) * (1 + 0.04 * Math.sin(2 * Math.PI * 9 * t)))) * (1 - p * 0.6)), 0.6],
  ['bip', 'Bip (sansür)', synth(0.8, (t) => Math.sin(2 * Math.PI * 1000 * t) * Math.min(1, t / 0.005)), 0.45],
  ['hata', 'Hata (buzzer)', synth(0.6, (t, p, st) => svf(st, 'a', sq(osc(st, 'o', 140)) + sq(osc(st, 'p', 147)), 1800, 0.8).l * (t % 0.3 < 0.25 ? 1 : 0.15)), 0.6],
  ['para', 'Para (coin)', synth(0.55, (t, p, st) => sq(osc(st, 'o', t < 0.08 ? 988 : 1319)) * 0.5 * (t < 0.08 ? 1 : Math.exp(-(t - 0.08) * 6))), 0.5],
  ['basari', 'Başarı (ta-da)', synth(1.5, (t) => [[0, 523.25], [0.12, 659.25], [0.24, 783.99], [0.36, 1046.5]].reduce((s, [d, f]) => s + (t >= d ? (Math.sin(2 * Math.PI * f * (t - d)) + 0.3 * Math.sin(4 * Math.PI * f * (t - d))) * Math.exp(-(t - d) * 2.5) : 0), 0))],
  ['kalp', 'Kalp atışı', synth(1.6, (t, p, st) => { const b = x => x >= 0 ? Math.sin(2 * Math.PI * 55 * x) * Math.exp(-x * 25) : 0; const u = t % 0.8; return b(u) + 0.7 * b(u - 0.18); })],
  ['zil', 'Bildirim', synth(0.7, (t) => [[0, 1568], [0.11, 2093]].reduce((s, [d, f]) => s + (t >= d ? Math.sin(2 * Math.PI * f * (t - d)) * Math.exp(-(t - d) * 9) : 0), 0))],
  ['kayit', 'Kamera (deklanşör)', synth(0.35, (t, p, st) => svf(st, 'a', noise(), 2500, 0.4).b * (env(t, 0.001, 0.02) + (t > 0.12 ? env(t - 0.12, 0.001, 0.03) : 0)))]
];
const SFX_KEEP = { dusus: 1, bip: 1, hata: 1, para: 1, basari: 1, kalp: 1 }; // banka karşılığı olmayan klasikler
const SFX_NEWNAME = { vinn: 'Vınn (geçiş)', pop: 'Pop', tik: 'Tık', ding: 'Ding', bum: 'Bum (vuruş)', yukselen: 'Yükselen', zil: 'Bildirim', kayit: 'Kamera (deklanşör)' };
function ensureSfx(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const vf = path.join(dir, 'version.txt'); const fresh = !fs.existsSync(vf) || fs.readFileSync(vf, 'utf8') !== String(SFX_VER);
  let pk = null; try { pk = JSON.parse(fs.readFileSync(path.join(__dirname, 'sfxpack.json'), 'utf8')); } catch { }
  let bin = null; const getBin = () => bin || (bin = fs.readFileSync(path.join(__dirname, 'sfxpack.bin')));
  const list = [];
  for (const [k, name, s, gain] of SFX) {
    const p = path.join(dir, 'sfx-' + k + '.wav'), lg = pk && pk.legacy[k];
    if (fresh || !fs.existsSync(p)) { if (lg) fs.writeFileSync(p, getBin().subarray(lg.o, lg.o + lg.l)); else fs.writeFileSync(p, wav(s, gain)); }
    list.push({ key: k, name: SFX_NEWNAME[k] || name, path: p, g: lg ? 'Klasik' : 'Klasik', legacy: 1 });
  }
  if (pk) {
    const bd = path.join(dir, 'bank'); fs.mkdirSync(bd, { recursive: true });
    for (const it of pk.items) {
      const p = path.join(bd, it.f);
      if (fresh || !fs.existsSync(p)) fs.writeFileSync(p, getBin().subarray(it.o, it.o + it.l));
      list.push({ key: it.k, name: it.n, path: p, g: it.g, dur: it.d });
    }
  }
  fs.writeFileSync(vf, String(SFX_VER)); return list;
}
// ---- SFX_SON ----
ipcMain.handle('sfx:list', () => ensureSfx(path.join(userDir(), 'sfx')));

// ---- Projeler ----
const projDir = () => { const d = path.join(userDir(), 'projects'); fs.mkdirSync(d, { recursive: true }); return d; };
const pfile = id => path.join(projDir(), String(id).replace(/[^a-z0-9_-]/gi, '') + '.json');
ipcMain.handle('projs:list', () => fs.readdirSync(projDir()).filter(f => f.endsWith('.json')).map(f => {
  const d = readJSON(path.join(projDir(), f), null); return d && { id: d.id, name: d.name, updated: d.updated, thumb: d.thumb, time: d.time };
}).filter(Boolean).sort((a, b) => b.updated - a.updated));
ipcMain.handle('projs:load', (e, id) => readJSON(pfile(id), null));
// ---- Otomatik proje yedeği: kaydetmeden önce eski hali saklanır (en fazla 30, en sık 2 dakikada bir) ----
const bakDir = id => path.join(projDir(), 'yedekler', String(id).replace(/[^\w-]/g, ''));
function backupProj(id, force) {
  try {
    const src = pfile(id); if (!fs.existsSync(src)) return;
    const dir = bakDir(id); fs.mkdirSync(dir, { recursive: true });
    const list = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
    const last = list.length ? +list[list.length - 1].replace('.json', '') : 0;
    if (!force && Date.now() - last < 120000) return;
    fs.copyFileSync(src, path.join(dir, Date.now() + '.json'));
    const all = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); while (all.length > 30) fs.unlinkSync(path.join(dir, all.shift()));
  } catch { }
}
ipcMain.handle('projs:save', (e, d) => { backupProj(d.id); d.updated = Date.now(); fs.writeFileSync(pfile(d.id), JSON.stringify(d)); return true; });
ipcMain.handle('projs:delete', (e, id) => { backupProj(id, true); try { fs.unlinkSync(pfile(id)); } catch { } return true; });
// ---- Kapaklar (ayrı kapak dosyaları) ----
const coverDir = () => { const d = path.join(userDir(), 'covers'); fs.mkdirSync(d, { recursive: true }); return d; };
const cfile = id => path.join(coverDir(), String(id).replace(/[^\w-]/g, '') + '.json');
ipcMain.handle('covers:list', () => fs.readdirSync(coverDir()).filter(f => f.endsWith('.json')).map(f => { const d = readJSON(path.join(coverDir(), f), null); return d && { id: d.id, name: d.name, kind: d.kind, updated: d.updated, thumb: d.thumb }; }).filter(Boolean).sort((a, b) => b.updated - a.updated));
ipcMain.handle('covers:load', (e, id) => readJSON(cfile(id), null));
ipcMain.handle('covers:save', (e, d) => { d.updated = Date.now(); fs.writeFileSync(cfile(d.id), JSON.stringify(d)); return true; });
ipcMain.handle('covers:delete', (e, id) => { try { fs.unlinkSync(cfile(id)); } catch { } return true; });
ipcMain.handle('cover:saveJpg', async (e, { name, data }) => {
  const r = await dialog.showSaveDialog(win, { title: 'Kapağı kaydet', defaultPath: path.join(app.getPath('pictures'), name || 'kapak.jpg'), filters: [{ name: 'JPG', extensions: ['jpg'] }] });
  if (r.canceled || !r.filePath) return null; fs.writeFileSync(r.filePath, Buffer.from(data)); return r.filePath;
});
// ---- Arka plan kaldırma modeli (Xenova/modnet, ~7 MB, Hugging Face'ten bir kez iner) ----
const BG_ID = 'Xenova/modnet', BG_FILES = ['config.json', 'preprocessor_config.json', 'onnx/model_quantized.onnx'];
ipcMain.handle('bg:ensure', async () => {
  const root = path.join(modelsDir(), BG_ID); const miss = BG_FILES.filter(f => !fs.existsSync(path.join(root, f))); if (!miss.length) return true;
  const send = (p, msg) => win && win.webContents.send('bg:progress', { p, msg });
  for (let i = 0; i < miss.length; i++) {
    const f = miss[i]; send(i / miss.length, 'Arka plan modeli indiriliyor… (' + (i + 1) + '/' + miss.length + ')');
    const resp = await net.fetch('https://huggingface.co/' + BG_ID + '/resolve/main/' + f); if (!resp.ok) throw new Error('Model indirilemedi (' + resp.status + '): ' + f);
    const buf = Buffer.from(await resp.arrayBuffer()); const dst = path.join(root, f); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.writeFileSync(dst + '.part', buf); fs.renameSync(dst + '.part', dst);
  }
  send(1, 'Model hazır'); return true;
});
ipcMain.handle('bg:savePng', (e, data) => { const d = path.join(userDir(), 'kesik'); fs.mkdirSync(d, { recursive: true }); const p = path.join(d, Date.now() + '_' + Math.random().toString(36).slice(2, 7) + '.png'); fs.writeFileSync(p, Buffer.from(data)); return p; });
ipcMain.handle('projs:backups', (e, id) => { try { const dir = bakDir(id); return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().reverse().map(f => { const d = readJSON(path.join(dir, f), null); return { file: f, time: +f.replace('.json', ''), name: d && d.name, clips: d && d.proj ? d.proj.tracks.reduce((n, t) => n + t.clips.length, 0) : 0 }; }); } catch { return []; } });
ipcMain.handle('projs:restore', (e, id, file) => { try { const src = path.join(bakDir(id), path.basename(file)); if (!fs.existsSync(src)) return false; backupProj(id, true); const d = readJSON(src, null); if (!d) return false; d.updated = Date.now(); fs.writeFileSync(pfile(id), JSON.stringify(d)); return true; } catch { return false; } });
ipcMain.handle('app:quit', () => { allowClose = true; win.close(); });
