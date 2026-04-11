import type { AmbientSound } from './types';

/**
 * Ambient sound player using Web Audio API synthesis.
 * Generates rain (brown noise), cafe (filtered brown noise), and white noise
 * without any external audio file dependencies.
 */

interface AmbientNodes {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  filterNode?: BiquadFilterNode;
}

let audioCtx: AudioContext | null = null;
let currentNodes: AmbientNodes | null = null;
let currentSound: AmbientSound = 'none';
let currentVolume = 0.5;

const getAudioContext = (): AudioContext => {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
};

/**
 * Generate a buffer of white noise samples.
 */
const createNoiseBuffer = (ctx: AudioContext, durationSeconds = 2): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const frameCount = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
};

/**
 * Convert white noise buffer into brown noise by integration.
 * Brown noise has a -6 dB/octave rolloff, making it low-frequency-heavy
 * (similar to rain or distant thunder).
 */
const createBrownNoiseBuffer = (ctx: AudioContext, durationSeconds = 2): AudioBuffer => {
  const sampleRate = ctx.sampleRate;
  const frameCount = sampleRate * durationSeconds;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < frameCount; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5; // scale to reasonable amplitude
  }

  return buffer;
};

const createNoiseSource = (
  ctx: AudioContext,
  sound: AmbientSound,
): AudioBufferSourceNode => {
  const buffer =
    sound === 'whitenoise'
      ? createNoiseBuffer(ctx)
      : createBrownNoiseBuffer(ctx);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
};

const buildGraph = (ctx: AudioContext, sound: AmbientSound, volume: number): AmbientNodes => {
  const source = createNoiseSource(ctx, sound);
  const gainNode = ctx.createGain();
  gainNode.gain.value = volume;

  if (sound === 'cafe') {
    // For cafe: bandpass filter around voice/activity frequencies (200–3000 Hz)
    // layered with low-pass to give a muffled indoor feel
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1200;
    bandpass.Q.value = 0.5;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3000;

    source.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    return { source, gainNode, filterNode: bandpass };
  }

  if (sound === 'rain') {
    // Rain: high-pass to keep the hiss of rain droplets, slight resonance
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 200;

    source.connect(highpass);
    highpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    return { source, gainNode, filterNode: highpass };
  }

  // White noise: straight through
  source.connect(gainNode);
  gainNode.connect(ctx.destination);

  return { source, gainNode };
};

const stopCurrent = (): void => {
  if (currentNodes) {
    try {
      currentNodes.source.stop();
      currentNodes.source.disconnect();
      currentNodes.gainNode.disconnect();
      currentNodes.filterNode?.disconnect();
    } catch {
      // already stopped
    }
    currentNodes = null;
  }
};

export const ambientPlay = (sound: AmbientSound, volume: number): void => {
  if (sound === 'none') {
    stopCurrent();
    currentSound = 'none';
    return;
  }

  const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;

  // If same sound is already playing, just adjust volume
  if (currentNodes && currentSound === sound) {
    currentNodes.gainNode.gain.setTargetAtTime(normalizedVolume, getAudioContext().currentTime, 0.1);
    currentVolume = normalizedVolume;
    return;
  }

  stopCurrent();

  const ctx = getAudioContext();

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }

  currentNodes = buildGraph(ctx, sound, normalizedVolume);
  currentNodes.source.start();
  currentSound = sound;
  currentVolume = normalizedVolume;
};

export const ambientStop = (): void => {
  stopCurrent();
  currentSound = 'none';
};

export const ambientSetVolume = (volume: number): void => {
  const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
  currentVolume = normalizedVolume;
  if (currentNodes) {
    currentNodes.gainNode.gain.setTargetAtTime(
      normalizedVolume,
      getAudioContext().currentTime,
      0.1,
    );
  }
};

export const ambientIsPlaying = (): boolean => currentNodes !== null;
