// Audio character. Real recorded samples (assets/sfx) for the vinyl needle drop, surface crackle and lead-out loop and for the
// cassette tape hiss, plus a synthesised tape-saturation chain (soft clipping, head bump, softened highs; no wow & flutter) on the music.
(function (S) {
  const F = S.fx = { tape: false, micro: false, reel: false, vinyl: false, DROP_SEC: 5.592 };
  const SFX = '../../assets/sfx/';
  let ctx = null, master = null, sfxBus = null, tapeDry = null, tapeWet = null, microIn = null, microWet = null, warmWet = null, chowNode = null, microBypass = null, microComp = null, els = null, gains = null, crackleTimer = null;
  F._v = 0.8;

  const sample = (name, loop) => {
    const a = new Audio(); a.src = SFX + name; a.loop = !!loop; a.preload = 'auto';
    const src = ctx.createMediaElementSource(a), g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(sfxBus);
    return { a, g };
  };
  const ramp = (g, v, tc = 0.05) => g.gain.setTargetAtTime(v, ctx.currentTime, tc);

  // Called with the shared AudioContext, the node the music flows through and the output node
  F.init = (c, programIn, out) => {
    if (ctx) return; ctx = c; master = out;
    sfxBus = ctx.createGain(); sfxBus.gain.value = F._v; sfxBus.connect(master);
    els = { drop: sample('needle_drop.ogg'), crackle: sample('vinyl_crackle.ogg', true), lead: sample('lead_out_loop.ogg', true), hiss: sample('tape_hiss_loop.ogg', true) };
    // --- tape saturation: music -> [dry | wet chain] -> master
    tapeDry = ctx.createGain(); tapeWet = ctx.createGain(); tapeWet.gain.value = 0;
    programIn.connect(tapeDry); tapeDry.connect(master);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38;
    const bump = ctx.createBiquadFilter(); bump.type = 'lowshelf'; bump.frequency.value = 110; bump.gain.value = 2.5;
    const pre = ctx.createGain(); pre.gain.value = 0.55;   // headroom: the head bump and a hot master can exceed full scale, and the shaper clips anything past +-1
    const sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 1.1) / Math.tanh(1.1) * 0.9 + x * 0.1; }
    sat.curve = curve; sat.oversample = '2x';
    const post = ctx.createGain(); post.gain.value = 1.0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 13500; lp.Q.value = 0.6;
    const dip = ctx.createBiquadFilter(); dip.type = 'peaking'; dip.frequency.value = 9000; dip.gain.value = -2; dip.Q.value = 0.8;
    programIn.connect(hp); hp.connect(bump); bump.connect(pre); pre.connect(sat); sat.connect(post); post.connect(lp); lp.connect(dip); dip.connect(tapeWet); tapeWet.connect(master);
    // --- reel to reel: a high-fidelity format with no audible hiss - just a little tape warmth (head bump, soft saturation, slightly eased top end)
    warmWet = ctx.createGain(); warmWet.gain.value = 0;
    const wb = ctx.createBiquadFilter(); wb.type = 'lowshelf'; wb.frequency.value = 120; wb.gain.value = 1.6;
    const wp = ctx.createGain(); wp.gain.value = 0.8;
    const ws = ctx.createWaveShaper(), wc = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; wc[i] = Math.tanh(x * 0.7) / Math.tanh(0.7) * 0.5 + x * 0.5; }
    ws.curve = wc; ws.oversample = '2x';
    const wpost = ctx.createGain(); wpost.gain.value = 1.0;
    const wt = ctx.createBiquadFilter(); wt.type = 'highshelf'; wt.frequency.value = 11000; wt.gain.value = -1.5;
    programIn.connect(wb); wb.connect(wp); wp.connect(ws); ws.connect(wpost); wpost.connect(wt); wt.connect(warmWet); warmWet.connect(master);
    buildMicro(programIn);
    F.apply();
  };

  // ---- microcassette: small portable recorder sound ---------------------------------------------------------------
  //  1. band-limit: steep high-pass ~135 Hz, low-pass ~6.5 kHz (2.4 cm/s music speed) and a +3 dB bell at 2 kHz (boxy, telephone-like midrange)
  //  2. ALC: fast attack, slow release, 10:1 compressor - peaks clamp down hard, quiet passages (and the tape hiss, which is fed through
  //     the same chain) swell back up in the pauses
  //  3. tape saturation: ChowTapeModel hysteresis (AudioWorklet port, tapemodel-worklet.js), driven early (no wow & flutter on any tape player)
  F.MICRO = { hp: 135, lp: 6500, bellHz: 2000, bellDb: 3, ratio: 10, thr: -30, drive: 0.75, sat: 0.6, bias: 0.35 };
  function buildMicro(programIn) {
    const M = F.MICRO, bq = (type, f, q = 0.7071, g = 0) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.gain.value = g; return n; };
    microIn = ctx.createGain(); microWet = ctx.createGain(); microWet.gain.value = 0;
    const hp1 = bq('highpass', M.hp), hp2 = bq('highpass', M.hp), lp1 = bq('lowpass', M.lp), lp2 = bq('lowpass', M.lp), bell = bq('peaking', M.bellHz, 0.9, M.bellDb);
    microComp = ctx.createDynamicsCompressor();
    microComp.threshold.value = M.thr; microComp.knee.value = 8; microComp.ratio.value = M.ratio; microComp.attack.value = 0.003; microComp.release.value = 0.35;
    const make = ctx.createGain(); make.gain.value = 2.0;                       // ALC make-up
    const pre = ctx.createGain(); pre.gain.value = 0.9;
    microBypass = ctx.createGain();                                              // used until / unless the worklet is available
    const out = ctx.createGain(); out.gain.value = 1.0;
    programIn.connect(microIn);
    microIn.connect(hp1); hp1.connect(hp2); hp2.connect(lp1); lp1.connect(lp2); lp2.connect(bell); bell.connect(microComp); microComp.connect(make); make.connect(pre);
    pre.connect(microBypass); microBypass.connect(out);
    out.connect(microWet); microWet.connect(master);
    try {
      ctx.audioWorklet.addModule('tapemodel-worklet.js').then(() => {
        chowNode = new AudioWorkletNode(ctx, 'chow-tape', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
        chowNode.parameters.get('drive').value = M.drive; chowNode.parameters.get('sat').value = M.sat; chowNode.parameters.get('bias').value = M.bias;
        pre.disconnect(microBypass); pre.connect(chowNode); chowNode.connect(out); F.chow = true;
      }).catch(() => { F.chow = false; });
    } catch (e) { F.chow = false; }
    // the hiss goes through the recorder's filters and ALC when this deck is active (see F.apply)
    F._hissToMicro = on => { const g = els.hiss.g; try { g.disconnect(); } catch (e) {} g.connect(on ? microIn : sfxBus); };
  }
  F.probeOut = () => { const an = ctx.createAnalyser(); an.fftSize = 4096; master.connect(an); return an; };   // for tests
  F.probe = () => { const an = ctx.createAnalyser(); an.fftSize = 2048; sfxBus.connect(an); return an; };   // for tests
  F.state = () => els && Object.fromEntries(Object.entries(els).map(([k, o]) => [k, { paused: o.a.paused, t: +o.a.currentTime.toFixed(2), g: +o.g.gain.value.toFixed(2), rs: o.a.readyState, err: o.a.error && o.a.error.code }]));
  F.vol = v => { F._v = v; if (ctx) sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.02); };
  F.apply = () => {
    if (!ctx) return; const t = ctx.currentTime;
    tapeDry.gain.setTargetAtTime(F.tape || F.reel ? 0 : 1, t, 0.03); warmWet.gain.setTargetAtTime(F.reel ? 1 : 0, t, 0.03); tapeWet.gain.setTargetAtTime(F.tape && !F.micro ? 1 : 0, t, 0.03); microWet.gain.setTargetAtTime(F.micro ? 1 : 0, t, 0.03);
    F._hissToMicro(F.micro);
    if (!F.tape) F.hiss('off');
    if (!F.vinyl) F.stopVinyl();
  };
  F.setMode = (mode, settings) => { const on = settings.soundFx !== false; F.micro = mode === 'micro' && on; F.tape = (mode === 'cassette' || mode === 'micro') && on; F.reel = mode === 'reel' && on; F.vinyl = mode === 'vinyl' && on; F.apply(); };
  const play = o => { try { const p = o.a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} };
  const halt = (o, ms = 400) => { ramp(o.g, 0, 0.08); setTimeout(() => { if (o.g.gain.value < 0.01) { try { o.a.pause(); } catch (e) {} } }, ms); };

  // ---------- vinyl ----------
  // the full needle-drop recording (thump, then the run-in noise settling); resolves when it has finished
  F.needleDrop = () => new Promise(res => {
    if (!ctx || !F.vinyl) return res();
    const o = els.drop; o.a.currentTime = 0; o.g.gain.cancelScheduledValues(0); o.g.gain.value = 1; play(o);
    const done = () => { o.a.removeEventListener('ended', done); res(); };
    o.a.addEventListener('ended', done);
    setTimeout(done, (F.DROP_SEC + 0.5) * 1000);      // never wait forever if the recording cannot play
  });
  // the needle is set down in the middle of a side: just the first moments of the recording, faded out
  F.needleTap = () => {
    if (!ctx || !F.vinyl) return; const o = els.drop; o.a.currentTime = 0; o.g.gain.cancelScheduledValues(ctx.currentTime);
    o.g.gain.value = 1; play(o); o.g.gain.setTargetAtTime(0, ctx.currentTime + 0.7, 0.12); setTimeout(() => { try { o.a.pause(); } catch (e) {} }, 1500);
  };
  F.stopDrop = () => { if (els) { try { els.drop.a.pause(); } catch (e) {} els.drop.g.gain.value = 0; } };
  // faint random crackle while the music plays: the recording starts at a random place and its level drifts about
  F.surface = on => {
    if (!ctx) return; const o = els.crackle, want = !!on && F.vinyl;
    if (want === !!F._surf) return; F._surf = want;
    clearInterval(crackleTimer);
    if (want) {
      if (o.a.paused) { try { o.a.currentTime = Math.random() * Math.max(1, (o.a.duration || 300) - 20); } catch (e) {} }
      play(o); ramp(o.g, 0.5, 0.4);
      crackleTimer = setInterval(() => ramp(o.g, Math.random() < 0.18 ? 0.05 : 0.25 + Math.random() * 0.6, 0.8), 2500 + Math.random() * 2000);
    } else halt(o);
  };
  // end-of-side lead-out loop; stays on until switched off
  F.leadOut = on => {
    if (!ctx) return; const o = els.lead;
    if (on && F.vinyl) { if (o.a.paused) o.a.currentTime = 0; o.g.gain.cancelScheduledValues(ctx.currentTime); ramp(o.g, 1, 0.05); play(o); F._lead = true; }
    else if (F._lead || !o.a.paused) { F._lead = false; halt(o, 500); }
  };
  F.stopAll = () => { F.stopVinyl(); F.hiss('off'); };
  F.stopVinyl = () => { F.surface(false); F.leadOut(false); F.stopDrop(); };

  // ---------- cassette ----------
  // level: 'up' (leader / end of side), 'low' (under the music), 'off'
  const HISS = { up: 1.7, low: 0.3 }, HISS_MICRO = { up: 0.22, low: 0.4 };   // microcassette hiss: a little louder (and it passes through the recorder's filters first)
  F.hiss = level => {
    if (!ctx) return; const o = els.hiss;
    if (level === 'off' || !F.tape) { if (F._hiss) { F._hiss = false; halt(o, 600); } return; }
    if (o.a.paused) { try { o.a.currentTime = Math.random() * 30; } catch (e) {} }
    play(o); F._hiss = true; ramp(o.g, (F.micro ? HISS_MICRO : HISS)[level] ?? 0.3, level === 'low' ? 1.2 : 0.3);
  };
})(window.S);
