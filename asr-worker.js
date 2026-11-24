// Otomatik altyazı: Whisper (transformers.js, tamamen yerel)
import { pipeline, env } from './vendor/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL('/models/', self.location.href).href;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = new URL('/vendor/', self.location.href).href;
env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));

let asr = null, loaded = null;
self.onmessage = async (ev) => {
  const { model, audio, language, words } = ev.data;
  try {
    if (!asr || loaded !== model) {
      self.postMessage({ type: 'status', msg: 'Model yükleniyor…' });
      asr = await pipeline('automatic-speech-recognition', model, { dtype: 'q8', device: 'wasm' });
      loaded = model;
    }
    self.postMessage({ type: 'status', msg: 'Konuşma yazıya dökülüyor…' });
    const opts = { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
    if (language && language !== 'auto') opts.language = language;
    let out = null, wl = false;
    if (words) { // kelime kelime zaman (model desteklemiyorsa cümle zamanına düşer)
      try { out = await asr(audio, { ...opts, return_timestamps: 'word' }); wl = Array.isArray(out.chunks) && out.chunks.length > 0; }
      catch (e) { out = null; self.postMessage({ type: 'status', msg: 'Kelime zamanları tahmin edilecek…' }); }
    }
    if (!out || !wl) out = await asr(audio, opts);
    self.postMessage({ type: 'done', words: wl, chunks: out.chunks || [{ timestamp: [0, audio.length / 16000], text: out.text }] });
  } catch (e) {
    self.postMessage({ type: 'error', msg: String(e && e.message || e) });
  }
};
