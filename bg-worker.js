// Arka plan kaldırma: MODNet (transformers.js, tamamen yerel)
import { pipeline, env, RawImage } from './vendor/transformers.min.js';

env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = new URL('/models/', self.location.href).href;
env.useBrowserCache = false;
env.backends.onnx.wasm.wasmPaths = new URL('/vendor/', self.location.href).href;
env.backends.onnx.wasm.numThreads = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));

let seg = null;
self.onmessage = async (ev) => {
  const { data, width, height } = ev.data;
  try {
    if (!seg) seg = await pipeline('background-removal', 'Xenova/modnet', { dtype: 'q8' });
    const img = new RawImage(new Uint8ClampedArray(data), width, height, 4);
    const out = await seg(img);
    const r = Array.isArray(out) ? out[0] : out;
    const rgba = r.channels === 4 ? r : r.rgba();
    const buf = rgba.data.buffer.slice(0);
    self.postMessage({ type: 'done', data: buf, width: rgba.width, height: rgba.height }, [buf]);
  } catch (e) {
    self.postMessage({ type: 'error', msg: String((e && e.message) || e) });
  }
};
