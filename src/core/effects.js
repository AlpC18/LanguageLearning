// Tiny synthesized sounds + vibration (no audio files). Off when the learner disables effects.
let enabled = true;
let ctx;
export const setEffects = (on) => { enabled = on !== false; };

function tones(freqs, step = 0.11, type = 'sine') {
  try {
    ctx ??= new AudioContext();
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * step;
      osc.type = type;
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + step);
    });
  } catch {
    /* audio unavailable (e.g. autoplay policy): stay silent */
  }
}

export function answerEffect(correct) {
  if (!enabled) return;
  tones(correct ? [660, 880] : [240, 180], 0.11, correct ? 'sine' : 'triangle');
  if (!correct) navigator.vibrate?.(120);
}

export function finishEffect() {
  if (enabled) tones([523, 659, 784, 1047], 0.1);
}
