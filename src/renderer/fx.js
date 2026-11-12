// Audio character. Real recorded samples (assets/sfx) for the vinyl needle drop, surface crackle and lead-out loop and for the
// cassette tape hiss, plus a synthesised tape-saturation chain (soft clipping, head bump, softened highs, wow & flutter) on the music.
(function (S) {
  const F = S.fx = { tape: false, vinyl: false, DROP_SEC: 5.592 };
  const SFX = '../../assets/sfx/';
  let ctx = null, master = null, sfxBus = null, tapeDry = null, tapeWet = null, els = null, gains = null, crackleTimer = null;
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
    const wow = ctx.createDelay(0.05); wow.delayTime.value = 0.008;
    const l1 = ctx.createOscillator(), g1 = ctx.createGain(); l1.frequency.value = 0.55; g1.gain.value = 0.00028; l1.connect(g1); g1.connect(wow.delayTime); l1.start();
    const l2 = ctx.createOscillator(), g2 = ctx.createGain(); l2.frequency.value = 6.3; g2.gain.value = 0.00007; l2.connect(g2); g2.connect(wow.delayTime); l2.start();
    programIn.connect(hp); hp.connect(bump); bump.connect(pre); pre.connect(sat); sat.connect(post); post.connect(lp); lp.connect(dip); dip.connect(wow); wow.connect(tapeWet); tapeWet.connect(master);
    F.apply();
  };
  F.probe = () => { const an = ctx.createAnalyser(); an.fftSize = 2048; sfxBus.connect(an); return an; };   // for tests
  F.state = () => els && Object.fromEntries(Object.entries(els).map(([k, o]) => [k, { paused: o.a.paused, t: +o.a.currentTime.toFixed(2), g: +o.g.gain.value.toFixed(2), rs: o.a.readyState, err: o.a.error && o.a.error.code }]));
  F.vol = v => { F._v = v; if (ctx) sfxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.02); };
  F.apply = () => {
    if (!ctx) return; const t = ctx.currentTime;
    tapeDry.gain.setTargetAtTime(F.tape ? 0 : 1, t, 0.03); tapeWet.gain.setTargetAtTime(F.tape ? 1 : 0, t, 0.03);
    if (!F.tape) F.hiss('off');
    if (!F.vinyl) F.stopVinyl();
  };
  F.setMode = (mode, settings) => { const on = settings.soundFx !== false; F.tape = mode === 'cassette' && on; F.vinyl = mode === 'vinyl' && on; F.apply(); };
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
  const HISS = { up: 1.7, low: 0.3 };
  F.hiss = level => {
    if (!ctx) return; const o = els.hiss;
    if (level === 'off' || !F.tape) { if (F._hiss) { F._hiss = false; halt(o, 600); } return; }
    if (o.a.paused) { try { o.a.currentTime = Math.random() * 30; } catch (e) {} }
    play(o); F._hiss = true; ramp(o.g, HISS[level] ?? 0.3, level === 'low' ? 1.2 : 0.3);
  };
})(window.S);
