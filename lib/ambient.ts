/**
 * Ambient sound module for focus sessions.
 *
 * Plays a looping background audio track during the WORKING phase and
 * stops it during breaks or idle.  The audio element is lazily created
 * on first play so that browsers / extension contexts that restrict
 * auto-play do not throw at import time.
 */

let audio: HTMLAudioElement | null = null;

/**
 * Build (or reuse) the HTMLAudioElement backed by the extension's
 * bundled ambient sound file.
 */
export const createAudio = (src: string): HTMLAudioElement => {
  if (audio && audio.src === src) {
    return audio;
  }

  if (audio) {
    audio.pause();
    audio.src = '';
  }

  audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0.4;
  return audio;
};

/** Start ambient playback.  Safe to call when already playing. */
export const ambientPlay = (src: string): void => {
  const el = createAudio(src);
  if (!el.paused) return;
  el.play().catch(() => {
    // Autoplay may be blocked — silently ignore.
  });
};

/** Stop ambient playback and reset to the beginning. */
export const ambientClose = (): void => {
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
};
