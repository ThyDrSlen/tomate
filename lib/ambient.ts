/**
 * Ambient sound playback for Tomate.
 *
 * Design constraints:
 *  - AudioContext is created inside ambientPlay(), never at module scope, so it
 *    is always created in response to a user gesture (satisfies Chrome autoplay policy).
 *  - ctx.resume() is fully awaited before source.start() so Chrome's auto-suspend
 *    policy never silently drops audio (fixes #96).
 *  - ambientClose() tears down the context completely so no AudioContext leaks
 *    across popup open/close cycles.
 */

type AmbientNodes = {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
};

let ctx: AudioContext | null = null;
let currentNodes: AmbientNodes | null = null;

/** Fetch and decode an audio file into an AudioBuffer. */
const loadBuffer = async (audioCtx: AudioContext, url: string): Promise<AudioBuffer> => {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  return audioCtx.decodeAudioData(arrayBuffer);
};

/**
 * Start ambient audio playback.
 *
 * The AudioContext is created here (inside the function) so that it is always
 * created in response to a user interaction, satisfying Chrome's autoplay policy.
 * If a context is already open from a previous call it is reused.
 *
 * @param url     - URL of the audio file to loop
 * @param volume  - Gain value in the range [0, 1]
 */
export const ambientPlay = async (url: string, volume = 0.5): Promise<void> => {
  // Stop any currently playing nodes first.
  ambientStop();

  // Lazily create the AudioContext on first user-triggered play.
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
  }

  // Ensure the context is running before starting nodes.
  // Chrome may auto-suspend even a freshly created context, so we always await
  // resume() regardless of the reported state.
  try {
    await ctx.resume();
  } catch {
    // resume() can throw if the context was closed between the check and the call.
    ctx = new AudioContext();
    await ctx.resume();
  }

  if (ctx.state !== 'running') {
    // Context could not be resumed (e.g. autoplay policy still blocking).
    return;
  }

  const buffer = await loadBuffer(ctx, url);

  // Bail out if ambientStop() was called while we were loading.
  if (!ctx || ctx.state !== 'running') {
    return;
  }

  const gainNode = ctx.createGain();
  gainNode.gain.value = Math.max(0, Math.min(1, volume));
  gainNode.connect(ctx.destination);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gainNode);

  // ctx.resume() is fully awaited above — safe to call start().
  source.start();

  currentNodes = { source, gainNode };
};

/**
 * Stop the ambient audio source nodes but leave the AudioContext open.
 * Call ambientClose() to fully release the context.
 */
export const ambientStop = (): void => {
  if (currentNodes) {
    try {
      currentNodes.source.stop();
    } catch {
      // stop() throws if the source was never started or already stopped.
    }
    currentNodes.source.disconnect();
    currentNodes.gainNode.disconnect();
    currentNodes = null;
  }
};

/**
 * Stop playback and close the AudioContext, releasing all resources.
 *
 * Must be called when the consumer (e.g. the popup) is torn down so that the
 * AudioContext does not leak across popup open/close cycles.
 */
export const ambientClose = async (): Promise<void> => {
  ambientStop();
  if (ctx && ctx.state !== 'closed') {
    try {
      await ctx.close();
    } catch {
      // Ignore errors if the context was already closed externally.
    }
  }
  ctx = null;
};
