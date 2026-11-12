// Real level meters: taps the <audio> element with Web Audio and reports per-channel peak/RMS in dB.
(function (S) {
  const M = S.meter = { ok: true, ready: false, lvl: [-90, -90], peak: [-90, -90] };
  let ctx, pin, an = [], bufs = [];
  // the context (and the effects bus) exists before the first track plays so the needle-drop can sound in the lead-in
  M.ensure = () => {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)(); M.ctx = ctx;
      pin = ctx.createGain(); const out = ctx.createGain(), lim = ctx.createDynamicsCompressor();   // safety limiter: nothing the effects add can clip the output
      lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.12;
      out.connect(lim); lim.connect(ctx.destination);
      S.fx.init(ctx, pin, out); S.fx.vol(S.app ? S.app.audio.volume : 0.8);
      return true;
    } catch (e) { M.ok = false; return false; }
  };
  M.attach = audio => {
    if (M.ready) return;
    try {
      if (!M.ensure()) return;
      const src = ctx.createMediaElementSource(audio), split = ctx.createChannelSplitter(2);
      src.connect(pin); src.connect(split);
      for (let i = 0; i < 2; i++) { const a = ctx.createAnalyser(); a.fftSize = 1024; a.smoothingTimeConstant = 0; split.connect(a, i); an.push(a); bufs.push(new Float32Array(a.fftSize)); }
      M.ready = true;
    } catch (e) { M.ok = false; }
  };
  M.resume = () => { M.ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  // dB of the instantaneous signal level over the last ~23 ms (mono sources feed both meters)
  M.read = () => {
    if (!M.ready || !M.ok) return null;
    const out = [];
    for (let i = 0; i < 2; i++) {
      an[i].getFloatTimeDomainData(bufs[i]);
      let pk = 0, sum = 0; const b = bufs[i];
      for (let k = 0; k < b.length; k++) { const v = Math.abs(b[k]); if (v > pk) pk = v; sum += v * v; }
      const rms = Math.sqrt(sum / b.length);
      out.push(20 * Math.log10(Math.max(1e-5, pk * 0.5 + rms * 0.9)));
    }
    return out;
  };
})(window.S);
