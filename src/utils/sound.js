import confetti from 'canvas-confetti';

// Every sound is synthesised with the Web Audio API — there are no audio files
// to download, so it all works offline.
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  setMuted(muted) {
    this.muted = Boolean(muted);
  }

  /** iOS only lets audio start from a tap, so this is called on every tap sound. */
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  tone({ freq, endFreq, start = 0, duration, gain, type = 'sine' }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + duration);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.01);
  }

  /** Crisp UI click. */
  playTap() {
    if (this.muted || !this.init()) return;
    this.tone({ freq: 680, endFreq: 220, duration: 0.045, gain: 0.12 });
  }

  /** Gentle rising triple chime: rest is over. */
  playRestChime() {
    if (this.muted || !this.init()) return;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      this.tone({ freq, start: i * 0.14, duration: 0.35, gain: 0.18, type: 'triangle' });
    });
  }

  /** Brighter four-note run for a PR or a finished workout. */
  playFanfare() {
    if (this.muted || !this.init()) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.tone({ freq, start: i * 0.11, duration: 0.42, gain: 0.17, type: 'triangle' });
    });
  }

  burst(particleCount, origin) {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    confetti({
      particleCount,
      spread: 70,
      startVelocity: 38,
      origin,
      colors: ['#10B981', '#D4AF37', '#0A84FF', '#F5F5F0'],
      disableForReducedMotion: true,
    });
  }

  /** Confetti still fires when muted — only the sound is silenced. */
  playPRCelebration() {
    this.playFanfare();
    this.burst(55, { y: 0.7 });
  }

  playWorkoutComplete() {
    this.playFanfare();
    this.burst(90, { x: 0.25, y: 0.75 });
    this.burst(90, { x: 0.75, y: 0.75 });
  }
}

export const sound = new SoundEngine();
