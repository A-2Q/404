/**
 * Procedural Web Audio Synthesizer for Investigation Room 404.
 * Generates 100% synthetic footsteps, drawer scrapes, paper/metal/glass pickups,
 * keypad tones, door unlock mechanics, and a dynamic psychological horror ambient drone.
 */
export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;
  private droneSub: OscillatorNode | null = null;
  private droneNoiseGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private droneRunning = false;
  private currentTension = 0.12;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer(this.ctx, 2.0);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Slightly warm pink-ish tilt for richer organic SFX
      data[i] = (lastOut + 0.15 * white) / 1.15;
      lastOut = data[i];
    }
    return buffer;
  }

  public startAmbientDrone(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || this.droneRunning) return;

    const now = ctx.currentTime;
    const droneBus = ctx.createGain();
    droneBus.gain.setValueAtTime(0.0001, now);
    droneBus.gain.exponentialRampToValueAtTime(0.24, now + 2.2);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(165, now);
    filter.Q.setValueAtTime(2.6, now);

    // Deep sub foundation (41.2 Hz E1)
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(41.2, now);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.48;
    sub.connect(subGain).connect(filter);

    // Detuned eerie saw/triangle beating pair
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(61.74, now);
    const gainA = ctx.createGain();
    gainA.gain.value = 0.16;
    oscA.connect(gainA).connect(filter);

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(62.45, now);
    const gainB = ctx.createGain();
    gainB.gain.value = 0.2;
    oscB.connect(gainB).connect(filter);

    // Subtle slow LFO modulating filter cutoff for breathing room dread
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.11, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(34, now);
    lfo.connect(lfoGain).connect(filter.frequency);

    // Drafty hollow wind noise through barred window
    if (this.noiseBuffer) {
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;

      const windBand = ctx.createBiquadFilter();
      windBand.type = 'bandpass';
      windBand.frequency.setValueAtTime(320, now);
      windBand.Q.setValueAtTime(4.2, now);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.09, now);

      windSrc.connect(windBand).connect(windGain).connect(droneBus);
      windSrc.start(now);
      this.droneNoiseGain = windGain;
    }

    filter.connect(droneBus).connect(this.masterGain);
    sub.start(now);
    oscA.start(now);
    oscB.start(now);
    lfo.start(now);

    this.droneGain = droneBus;
    this.droneFilter = filter;
    this.droneOscA = oscA;
    this.droneOscB = oscB;
    this.droneSub = sub;
    this.droneRunning = true;
    this.setTension(this.currentTension);
  }

  public setTension(tension: number): void {
    this.currentTension = Math.max(0, Math.min(1, tension));
    if (!this.ctx || !this.droneFilter || !this.droneOscB || !this.droneGain) return;
    const now = this.ctx.currentTime;
    // As truth approaches, ambient drone becomes slightly brighter, louder, and more dissonant
    this.droneFilter.frequency.setTargetAtTime(145 + this.currentTension * 210, now, 0.8);
    this.droneOscB.frequency.setTargetAtTime(62.2 + this.currentTension * 2.1, now, 0.8);
    this.droneGain.gain.setTargetAtTime(0.2 + this.currentTension * 0.16, now, 0.8);
    if (this.droneNoiseGain) {
      this.droneNoiseGain.gain.setTargetAtTime(0.08 + this.currentTension * 0.08, now, 0.8);
    }
  }

  public setPaused(paused: boolean): void {
    if (!this.ctx || !this.droneGain) return;
    const now = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(paused ? 0.0001 : 0.2 + this.currentTension * 0.16, now, 0.15);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.72, this.ctx.currentTime, 0.05);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /** Wooden floorboard footstep thud + subtle timber creak */
  public playFootstep(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const pitchJitter = 0.92 + Math.random() * 0.16;

    // Low heel thump on hollow wooden floor
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(105 * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(38 * pitchJitter, now + 0.095);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.24, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(oscGain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);

    // Sole scuff grit
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520 * pitchJitter, now);
    filter.Q.setValueAtTime(1.8, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.11, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

    noise.connect(filter).connect(nGain).connect(this.masterGain);
    noise.start(now, Math.random() * 1.2, 0.09);

    // Occasional faint old-plank creak
    if (Math.random() < 0.35) {
      const creak = ctx.createOscillator();
      creak.type = 'sawtooth';
      creak.frequency.setValueAtTime(290 * pitchJitter, now + 0.03);
      creak.frequency.linearRampToValueAtTime(235 * pitchJitter, now + 0.16);
      const cFilter = ctx.createBiquadFilter();
      cFilter.type = 'bandpass';
      cFilter.frequency.value = 650;
      cFilter.Q.value = 6;
      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.028, now + 0.03);
      cGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.18);
      creak.connect(cFilter).connect(cGain).connect(this.masterGain);
      creak.start(now + 0.03);
      creak.stop(now + 0.19);
    }
  }

  /** Wooden or metal drawer sliding sound */
  public playDrawerSlide(opening: boolean, isMetal = false): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const dur = 0.42;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const startFreq = isMetal ? (opening ? 920 : 1280) : opening ? 320 : 460;
    const endFreq = isMetal ? (opening ? 1360 : 760) : opening ? 480 : 280;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.linearRampToValueAtTime(endFreq, now + dur);
    filter.Q.setValueAtTime(isMetal ? 5.2 : 2.2, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isMetal ? 0.18 : 0.24, now + 0.06);
    gain.gain.linearRampToValueAtTime(0.14, now + dur - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter).connect(gain).connect(this.masterGain);
    src.start(now, Math.random() * 0.8, dur);

    // End-stop mechanical clack
    const clack = ctx.createOscillator();
    clack.type = 'triangle';
    clack.frequency.setValueAtTime(isMetal ? 260 : 140, now + dur - 0.05);
    clack.frequency.exponentialRampToValueAtTime(52, now + dur + 0.04);
    const clackGain = ctx.createGain();
    clackGain.gain.setValueAtTime(0.22, now + dur - 0.05);
    clackGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.05);
    clack.connect(clackGain).connect(this.masterGain);
    clack.start(now + dur - 0.05);
    clack.stop(now + dur + 0.06);
  }

  /** Crisp paper rustle when inspecting notes/photos */
  public playPaperPickup(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const bursts = [0, 0.06, 0.13];
    for (const offset of bursts) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(1850 + Math.random() * 650, now + offset);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(3200 + Math.random() * 900, now + offset);
      bp.Q.value = 1.4;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(0.18, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.095);

      src.connect(hp).connect(bp).connect(g).connect(this.masterGain);
      src.start(now + offset, Math.random() * 1.1, 0.1);
    }
  }

  /** Oxidized brass metallic clink (key / pocket watch) */
  public playMetalPickup(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const partials = [1180, 2140, 3420, 4890];
    partials.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * (0.96 + Math.random() * 0.08), now);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.0005, now + 0.36 - i * 0.05);

      osc.connect(g).connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  /** Crystalline glass bottle clink */
  public playGlassPickup(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const freqs = [1640, 2980, 4120];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.012);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09 / (idx + 1), now + idx * 0.012);
      g.gain.exponentialRampToValueAtTime(0.0006, now + 0.28);
      osc.connect(g).connect(this.masterGain!);
      osc.start(now + idx * 0.012);
      osc.stop(now + 0.3);
    });
  }

  public playFlashlightClick(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.025);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playLogStamp(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const notes = [330, 440, 554.37];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.075);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, now + idx * 0.075);
      g.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.075 + 0.22);
      osc.connect(g).connect(this.masterGain!);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.24);
    });
  }

  public playKeypadBeep(digit: number): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620 + digit * 48, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playKeypadError(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(145, now + i * 0.14);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.16, now + i * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.11);
      osc.connect(g).connect(this.masterGain);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.12);
    }
  }

  public playDoorUnlock(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    // Confirmation chime
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.35);
      osc.connect(g).connect(this.masterGain!);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.38);
    });

    // Heavy iron deadbolt release clunk
    const bolt = ctx.createOscillator();
    bolt.type = 'triangle';
    bolt.frequency.setValueAtTime(175, now + 0.32);
    bolt.frequency.exponentialRampToValueAtTime(42, now + 0.48);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.32, now + 0.32);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    bolt.connect(bg).connect(this.masterGain);
    bolt.start(now + 0.32);
    bolt.stop(now + 0.52);

    // Slow wooden door creak opening
    const creak = ctx.createOscillator();
    creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(190, now + 0.52);
    creak.frequency.linearRampToValueAtTime(248, now + 1.05);
    creak.frequency.linearRampToValueAtTime(165, now + 1.55);
    const cf = ctx.createBiquadFilter();
    cf.type = 'bandpass';
    cf.frequency.value = 540;
    cf.Q.value = 8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.001, now + 0.52);
    cg.gain.linearRampToValueAtTime(0.08, now + 0.65);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    creak.connect(cf).connect(cg).connect(this.masterGain);
    creak.start(now + 0.52);
    creak.stop(now + 1.65);
  }

  public dispose(): void {
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
      this.droneSub?.stop();
    } catch {
      // Ignore already-stopped oscillators
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.droneRunning = false;
  }
}
