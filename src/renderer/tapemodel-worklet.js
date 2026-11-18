// Tape hysteresis for the Web Audio graph (AudioWorklet).
//
// This is a JavaScript port of the magnetic-tape hysteresis core of "ChowTapeModel" (v2.11.4) by Jatin Chowdhury:
//   https://github.com/jatinchowdhury18/AnalogTapeModel      (Plugin/Source/Processors/Hysteresis)
//   paper: J. Chowdhury, "Real-time Physical Modelling for Analog Tape Machines", DAFx-19.
// It implements the Jiles-Atherton model with the plugin's 4-iteration Newton-Raphson solver ("NR4") and the plugin's parameter
// mapping (drive / saturation / bias).  ChowTapeModel is licensed under the GNU General Public License v3, so this file is too -
// see THIRD_PARTY_NOTICES.md.  The plugin's oversampling is replaced by a simple 2x oversampling here.
//
// Parameters (k-rate):  drive 0..1,  sat 0..1,  bias 0..1 (the plugin's "Tape Bias"; the model's `width` is 1 - bias),  mix 0..1
class ChowTapeProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    const p = (name, v) => ({ name, defaultValue: v, minValue: 0, maxValue: 1, automationRate: 'k-rate' });
    return [p('drive', 0.5), p('sat', 0.5), p('bias', 0.5), p('mix', 1)];
  }
  constructor() {
    super();
    this.ch = [];
    this.osFactor = 2;
    this.fs = sampleRate * this.osFactor; this.T = 1 / this.fs; this.Talpha = this.T / 1.9;
    this.last = [NaN, NaN, NaN, NaN];
    this.hp = { Ms: 1, a: 0.25, k: 0.47875, c: 0.17, nc: 0.83, alpha: 1.6e-3 };
    this.cook(0.5, 0.5, 0.5);
    this.port.onmessage = e => { if (e.data === 'reset') this.ch.forEach(s => { s.M1 = s.H1 = s.Hd1 = 0; }); };
  }
  cook(drive, sat, bias) {
    const h = this.hp, width = 1 - bias, al = h.alpha;
    h.Ms = 0.5 + 1.5 * (1 - sat);
    h.a = h.Ms / (0.01 + 6 * drive);
    h.c = Math.sqrt(1 - width) - 0.01;
    h.k = 0.47875;
    h.nc = 1 - h.c;
    h.Ms_oa = h.Ms / h.a;
    h.Ms_oa_talpha = al * h.Ms_oa;
    h.Ms_oa_tc = h.c * h.Ms_oa;
    h.Ms_oa_tc_talpha = al * h.Ms_oa_tc;
    h.Ms_oaSq_tc_talpha = h.Ms_oa_tc_talpha / h.a;
    h.Ms_oaSq_tc_talphaSq = al * h.Ms_oaSq_tc_talpha;
    this.makeup = (1 + 0.6 * width) / (0.5 + 1.5 * (1 - sat));
  }
  // dM/dt of the Jiles-Atherton model; leaves the intermediate values in `t` for the derivative
  hys(M, H, Hd, t) {
    const h = this.hp, al = h.alpha;
    const Q = (H + M * al) / h.a;
    t.Q = Q; t.oQ = 1 / Q; t.oQ2 = t.oQ * t.oQ; t.oQ3 = t.oQ * t.oQ2;
    t.coth = 1 / Math.tanh(Q); t.near = Q < 0.001 && Q > -0.001; t.coth2 = t.coth * t.coth;
    const lang = t.near ? Q / 3 : t.coth - t.oQ;
    t.Md = lang * h.Ms - M;
    const delta = Hd >= 0 ? 1 : -1, sMd = (t.Md > 0) - (t.Md < 0);
    t.kap1 = delta === sMd ? h.nc : 0;
    t.Lp = t.near ? 1 / 3 : t.oQ2 - t.coth2 + 1;
    t.f1d = h.nc * delta * h.k - al * t.Md; t.of1d = 1 / t.f1d;
    const f1 = t.kap1 * t.Md / t.f1d, f2 = t.Lp * h.Ms_oa_tc, f3 = 1 - t.Lp * h.Ms_oa_tc_talpha;
    t.of3 = 1 / f3;
    return Hd * (f1 + f2) * t.of3;
  }
  hysPrime(Hd, dMdt, t) {
    const h = this.hp, al = h.alpha;
    const Lp2 = t.near ? (-2 / 15) * t.Q : 2 * t.coth * (t.coth2 - 1) - 2 * t.oQ3;
    const Md2 = t.Lp * h.Ms_oa_talpha - 1;
    let f1p = Md2 * t.of1d + t.Md * al * Md2 * (t.of1d * t.of1d);
    f1p *= t.kap1;
    const f2p = Lp2 * h.Ms_oaSq_tc_talpha, f3p = Lp2 * (-h.Ms_oaSq_tc_talphaSq);
    return (Hd * (f1p + f2p) - dMdt * f3p) * t.of3;
  }
  step(s, H) {
    const T = this.T, Ta = this.Talpha, t = s.t;
    const Hd = ((1 + 0.75) / T) * (H - s.H1) - 0.75 * s.Hd1;
    let M = s.M1;
    const lastD = this.hys(s.M1, s.H1, s.Hd1, t);
    for (let n = 0; n < 4; n++) {
      const dMdt = this.hys(M, H, Hd, t), dp = this.hysPrime(Hd, dMdt, t);
      M -= (M - s.M1 - Ta * (dMdt + lastD)) / (1 - Ta * dp);
    }
    let hd = Hd;
    if (Number.isNaN(M) || M > 20) { M = 0; hd = 0; }       // instability guard, as in the plugin
    s.M1 = M; s.H1 = H; s.Hd1 = hd;
    return M;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0];
    if (!inp || !inp.length) return true;
    const drive = params.drive[0], sat = params.sat[0], bias = params.bias[0], mix = params.mix[0];
    if (this.last[0] !== drive || this.last[1] !== sat || this.last[2] !== bias) { this.cook(drive, sat, bias); this.last = [drive, sat, bias]; }
    const mk = this.makeup;
    for (let c = 0; c < inp.length; c++) {
      const s = this.ch[c] || (this.ch[c] = { M1: 0, H1: 0, Hd1: 0, prev: 0, dcx: 0, dcy: 0, t: {} });
      const x = inp[c], y = out[c];
      for (let i = 0; i < x.length; i++) {
        // 2x oversampling: linear-interpolated up, averaged down
        const a = this.step(s, (s.prev + x[i]) * 0.5), b = this.step(s, x[i]);
        s.prev = x[i];
        let w = (a + b) * 0.5 * mk;
        const dc = w - s.dcx + 0.9995 * s.dcy; s.dcx = w; s.dcy = dc; w = dc;      // DC blocker
        y[i] = x[i] * (1 - mix) + w * mix;
      }
    }
    return true;
  }
}
registerProcessor('chow-tape', ChowTapeProcessor);
