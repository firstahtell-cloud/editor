const { contextBridge, ipcRenderer, webUtils } = require('electron');
const inv = (c, a) => ipcRenderer.invoke(c, a);
contextBridge.exposeInMainWorld('api', {
  mediaBase: ipcRenderer.sendSync('media:base'),
  libLoad: () => inv('lib:load'), libSave: d => inv('lib:save', d),
  autoLoad: () => inv('auto:load'), autoSave: d => inv('auto:save', d),
  exists: p => inv('file:exists', p),
  probe: p => inv('probe', p),
  peaks: p => inv('peaks', p), vidFrame: d => inv('vid:frame', d), vidClose: k => inv('vid:close', k), vidInfo: p => inv('vid:info', p), vidStill: d => inv('vid:still', d), audPcm: p => inv('aud:pcm', p), audTmpWav: d => inv('aud:tmpwav', d), sfxList: () => inv('sfx:list'),
  pickMedia: k => inv('dlg:media', k),
  expStart: c => inv('exp:start', c), expFrame: b => inv('exp:frame', b),
  expEnd: () => inv('exp:end'), expCancel: () => inv('exp:cancel'),
  onExpDone: cb => ipcRenderer.on('exp:done', (e, d) => cb(d)),
  asrEnsure: k => inv('asr:ensure', k), asrAudio: d => inv('asr:audio', d),
  onAsrProgress: cb => ipcRenderer.on('asr:progress', (e, d) => cb(d)),
  pathOf: f => webUtils.getPathForFile(f),
  projList: () => inv('projs:list'), projLoad: id => inv('projs:load', id), projSave: d => inv('projs:save', d), projDelete: id => inv('projs:delete', id),
  projBackups: id => inv('projs:backups', id), projRestore: (id, f) => inv('projs:restore', id, f),
  coverList: () => inv('covers:list'), coverLoad: id => inv('covers:load', id), coverSave: d => inv('covers:save', d), coverDelete: id => inv('covers:delete', id), coverSaveJpg: d => inv('cover:saveJpg', d),
  bgEnsure: () => inv('bg:ensure'), bgSavePng: d => inv('bg:savePng', d), onBgProgress: cb => { const h = (e, d) => cb(d); ipcRenderer.on('bg:progress', h); return () => ipcRenderer.removeListener('bg:progress', h); },
  relaunch: () => inv('app:relaunch'), setLang: l => inv('app:setLang', l), onUpdated: cb => ipcRenderer.on('app:updated', () => cb()),
  quit: () => inv('app:quit'), onCloseReq: cb => ipcRenderer.on('app:close-req', () => cb())
});
