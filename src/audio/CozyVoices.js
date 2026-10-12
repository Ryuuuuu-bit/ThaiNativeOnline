// Original, lightly inharmonic felt-key / wooden-bar voices. No soundfont,
// recording or external download: the same instrument renders offline previews.
const hz = midi => 440 * 2 ** ((midi - 69) / 12);

export function cozyNote(ctx, dest, midi, time, duration, gain, pan = 0, wooden = false) {
  if (!(gain > 0)) return;
  const output = ctx.createGain(), stereo = ctx.createStereoPanner();
  stereo.pan.value = pan; output.connect(stereo); stereo.connect(dest);
  const end = time + duration, attack = Math.min(.012, duration * .1);
  output.gain.setValueAtTime(0, time);
  output.gain.linearRampToValueAtTime(gain, time + attack);
  output.gain.setValueAtTime(gain, Math.max(time + attack, end - .18));
  output.gain.linearRampToValueAtTime(0, end);
  // The fundamental carries the body; upper partials fade before the tail.
  const partials = wooden ? [[1, .9, 1.3], [3.98, .11, .24], [9.97, .025, .10]]
    : [[1, .8, 2.1], [2.002, .23, 1.1], [3.009, .09, .58], [4.019, .028, .24]];
  let remaining = partials.length;
  for (const [ratio, level, decay] of partials) {
    const osc = ctx.createOscillator(), envelope = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = hz(midi) * ratio;
    envelope.gain.setValueAtTime(level, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.00001, level * Math.exp(-duration / decay)), end);
    osc.connect(envelope); envelope.connect(output);
    osc.onended = () => {
      osc.disconnect(); envelope.disconnect();
      if (--remaining === 0) { output.disconnect(); stereo.disconnect(); }
    };
    osc.start(time); osc.stop(end + .01);
  }
}
