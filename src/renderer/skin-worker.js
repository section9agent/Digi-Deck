// Background worker for skin.js: recolours one picture off the main thread.
importScripts('skin-pixels.js');
onmessage = async ev => {
  const { id, bmp, w, h, d } = ev.data;
  try {
    const c = new OffscreenCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    const im = x.getImageData(0, 0, w, h); self.recolorPixels(im.data, w, h, d, false); x.putImageData(im, 0, 0);
    postMessage({ id, blob: await c.convertToBlob({ type: 'image/png' }) });
  } catch (e) { postMessage({ id, err: String(e) }); }
};
