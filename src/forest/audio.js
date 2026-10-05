// Big-forest soundscape synthesized with Web Audio: wind in the canopy,
// several bird species placed around the listener, a long reverb tail for
// the space between the trees, and footsteps crunching in snow.
// Nothing is downloaded and nothing plays until the player turns it on.

const rand = (a, b) => a + Math.random() * (b - a);

export function createForestAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ac = new Ctx();
  const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const dry = ac.createGain(); dry.gain.value = .8; dry.connect(master);
  const reverb = ac.createConvolver(), wet = ac.createGain(); wet.gain.value = .55;
  reverb.connect(wet); wet.connect(master);

  // Impulse response: diffuse decaying noise with early reflections off trunks.
  const irLength = ac.sampleRate * 3.4, ir = ac.createBuffer(2, irLength, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < irLength; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 3.2) * (i < ac.sampleRate * .012 ? 0 : 1);
    for (let r = 0; r < 14; r++) d[Math.floor(rand(.015, .12) * ac.sampleRate)] += rand(-.6, .6);
  }
  reverb.buffer = ir;

  const noiseBuffer = (() => {
    // Brown-ish noise is warmer than white noise for wind.
    const b = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return b;
  })();
  const whiteBuffer = (() => {
    const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  // ----- Wind and canopy rustle (continuous, modulated by gusts) -----
  const windGain = ac.createGain(); windGain.gain.value = .0; windGain.connect(dry); windGain.connect(reverb);
  const windSrc = ac.createBufferSource(); windSrc.buffer = noiseBuffer; windSrc.loop = true;
  const windFilter = ac.createBiquadFilter(); windFilter.type = 'lowpass'; windFilter.frequency.value = 500; windFilter.Q.value = .7;
  windSrc.connect(windFilter); windFilter.connect(windGain); windSrc.start();
  const rustleGain = ac.createGain(); rustleGain.gain.value = 0;
  const rustleSrc = ac.createBufferSource(); rustleSrc.buffer = whiteBuffer; rustleSrc.loop = true;
  const rustleFilter = ac.createBiquadFilter(); rustleFilter.type = 'bandpass'; rustleFilter.frequency.value = 4200; rustleFilter.Q.value = .5;
  const rustlePan = ac.createStereoPanner();
  rustleSrc.connect(rustleFilter); rustleFilter.connect(rustleGain); rustleGain.connect(rustlePan); rustlePan.connect(dry); rustleSrc.start();

  let windStrength = .55, enabled = false, timers = [];

  // A bird voice: panned, attenuated and darkened with distance, sent to the reverb.
  function voice(distance = rand(.2, 1)) {
    const out = ac.createGain(), pan = ac.createStereoPanner(), tone = ac.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 12000 - distance * 8000;
    out.gain.value = .5 * (1.1 - distance); pan.pan.value = rand(-.95, .95);
    out.connect(tone); tone.connect(pan); pan.connect(dry);
    const send = ac.createGain(); send.gain.value = .25 + distance * .7; pan.connect(send); send.connect(reverb);
    setTimeout(() => { out.disconnect(); send.disconnect(); }, 6000);
    return out;
  }
  function note(out, t, dur, f0, f1, vol, { type = 'sine', vibrato = 0, vibratoRate = 30 } = {}) {
    const osc = ac.createOscillator(), g = ac.createGain(); osc.type = type;
    osc.frequency.setValueAtTime(f0, t); osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (vibrato) {
      const lfo = ac.createOscillator(), depth = ac.createGain(); lfo.frequency.value = vibratoRate; depth.gain.value = vibrato;
      lfo.connect(depth); depth.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + .02);
    }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.012, dur * .25));
    g.gain.setValueAtTime(vol, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur + .02);
  }

  const species = {
    // Fast descending trill, like a chaffinch.
    trill() {
      const out = voice(), t = ac.currentTime + .05, n = Math.floor(rand(8, 14)), base = rand(3600, 4600);
      for (let i = 0; i < n; i++) { const f = base * (1 - i / n * .35); note(out, t + i * .065, .055, f * 1.15, f * .82, .12); }
      note(out, t + n * .065 + .02, .22, base * .9, base * .55, .14, { vibrato: 120, vibratoRate: 45 });
    },
    // Two-note "tea-cher" whistle, repeated, like a great tit.
    teacher() {
      const out = voice(), t = ac.currentTime + .05, hi = rand(5200, 6200), lo = hi * rand(.68, .76), reps = Math.floor(rand(3, 6));
      for (let i = 0; i < reps; i++) { note(out, t + i * .38, .1, hi, hi * .97, .1); note(out, t + i * .38 + .15, .14, lo, lo * .96, .11); }
    },
    // Wandering melodic phrase with vibrato, like a robin or warbler.
    warble() {
      const out = voice(rand(.1, .6)), t = ac.currentTime + .05, n = Math.floor(rand(6, 11));
      let time = t;
      for (let i = 0; i < n; i++) {
        const f = rand(2400, 6800), d = rand(.06, .22);
        note(out, time, d, f, f * rand(.75, 1.3), rand(.06, .12), { vibrato: rand(0, 160), vibratoRate: rand(25, 60) });
        time += d + rand(.01, .08);
      }
    },
    // Soft distant hoot pair, like a cuckoo or dove across the valley.
    cuckoo() {
      const out = voice(rand(.7, 1)), t = ac.currentTime + .05, f = rand(620, 760);
      for (let r = 0; r < Math.floor(rand(2, 5)); r++) {
        note(out, t + r * 1.05, .28, f, f * .98, .22, { type: 'triangle' }); note(out, t + r * 1.05 + .36, .38, f * .8, f * .78, .2, { type: 'triangle' });
      }
    },
    // Woodpecker drumming: rapid knocks that speed up and fade.
    woodpecker() {
      const out = voice(rand(.4, .9)), t = ac.currentTime + .05, n = Math.floor(rand(12, 22));
      let time = t;
      for (let i = 0; i < n; i++) {
        const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
        src.buffer = whiteBuffer; bp.type = 'bandpass'; bp.frequency.value = rand(900, 1300); bp.Q.value = 8;
        g.gain.setValueAtTime(.9 * (1 - i / n * .6), time); g.gain.exponentialRampToValueAtTime(.001, time + .03);
        src.connect(bp); bp.connect(g); g.connect(out); src.start(time, rand(0, 1.5), .04);
        time += .05 - i * .0012;
      }
    },
    // High thin "tsee" contact calls from small birds in the canopy.
    tsee() {
      const out = voice(rand(.2, .7)), t = ac.currentTime + .05;
      for (let i = 0; i < Math.floor(rand(1, 4)); i++) { const f = rand(7000, 8400); note(out, t + i * rand(.25, .5), .16, f, f * 1.04, .05); }
    },
    // Occasional raven/crow caw: harsh, nasal, far away.
    crow() {
      const out = voice(rand(.6, 1)), t = ac.currentTime + .05;
      for (let i = 0; i < Math.floor(rand(1, 4)); i++) {
        const osc = ac.createOscillator(), f1 = ac.createBiquadFilter(), g = ac.createGain(), st = t + i * .55;
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(rand(380, 460), st); osc.frequency.linearRampToValueAtTime(rand(300, 340), st + .32);
        f1.type = 'bandpass'; f1.frequency.value = 1300; f1.Q.value = 3;
        g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(.12, st + .03); g.gain.exponentialRampToValueAtTime(.001, st + .36);
        osc.connect(f1); f1.connect(g); g.connect(out); osc.start(st); osc.stop(st + .38);
      }
    },
  };
  // How often each species sings (seconds between songs).
  const schedule = { trill: [5, 12], teacher: [7, 16], warble: [4, 10], cuckoo: [14, 30], woodpecker: [16, 34], tsee: [3, 8], crow: [25, 55] };

  function loop(name) {
    const [a, b] = schedule[name];
    timers.push(setTimeout(() => { if (!enabled) return; species[name](); loop(name); }, rand(a, b) * 1000));
  }
  let gustTimer;
  function gusts() {
    // Each gust swells the wind and canopy rustle, then lets them settle.
    const t = ac.currentTime, peak = .15 + windStrength * .55, len = rand(2.5, 6);
    windGain.gain.cancelScheduledValues(t); windGain.gain.setTargetAtTime(peak, t, len * .3); windGain.gain.setTargetAtTime(peak * .45, t + len * .6, len * .4);
    windFilter.frequency.setTargetAtTime(380 + windStrength * 700, t, len * .3); windFilter.frequency.setTargetAtTime(320 + windStrength * 300, t + len * .6, len * .4);
    rustleGain.gain.cancelScheduledValues(t); rustleGain.gain.setTargetAtTime(.025 + windStrength * .07, t, len * .25); rustleGain.gain.setTargetAtTime(.01 + windStrength * .02, t + len * .5, len * .4);
    rustlePan.pan.setTargetAtTime(rand(-.7, .7), t, len * .5);
    gustTimer = setTimeout(gusts, len * 1000 * rand(.8, 1.3));
  }

  return {
    get enabled() { return enabled; },
    async toggle() {
      await ac.resume(); enabled = !enabled;
      master.gain.setTargetAtTime(enabled ? .9 : 0, ac.currentTime, .4);
      timers.forEach(clearTimeout); timers = []; clearTimeout(gustTimer);
      if (enabled) {
        gusts(); Object.keys(schedule).forEach(loop);
        setTimeout(() => enabled && species.warble(), 600); setTimeout(() => enabled && species.trill(), 2200);
      }
      return enabled;
    },
    setWind(value) { windStrength = value; },
    // Footstep in snow: a short crunchy burst of filtered grains.
    step() {
      if (!enabled) return;
      const t = ac.currentTime, src = ac.createBufferSource(), hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = whiteBuffer; hp.type = 'highpass'; hp.frequency.value = rand(700, 1100); lp.type = 'lowpass'; lp.frequency.value = rand(3500, 5200);
      g.gain.setValueAtTime(0, t);
      for (let i = 0; i < 6; i++) g.gain.linearRampToValueAtTime(rand(.06, .18), t + .012 + i * .022), g.gain.linearRampToValueAtTime(rand(.01, .04), t + .022 + i * .022);
      g.gain.exponentialRampToValueAtTime(.0005, t + .2);
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(dry); src.start(t, rand(0, 1.7), .22);
    },
  };
}
