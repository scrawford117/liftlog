/**
 * Rest-timer alerts: a chime (Web Audio), vibration where supported (not iOS), and a
 * system notification when the app is in the background but still running.
 *
 * iOS only lets a web app play audio after a user gesture, so `unlockAudio()` must be
 * called from a tap (we do it when a set is checked off).
 */

let ctx: AudioContext | null = null;

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function unlockAudio() {
  try {
    // 'transient' plays even with the ring/silent switch on and only ducks music briefly.
    const nav = navigator as AudioSessionNavigator;
    if (nav.audioSession && nav.audioSession.type !== 'transient') nav.audioSession.type = 'transient';
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    // A silent blip keeps iOS from re-locking the context.
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start();
  } catch {
    // Audio unavailable; alerts fall back to vibration/notification.
  }
}

/** Plays a sequence of short beeps. */
export function playTones(freqs: number[], beepSec = 0.18, gapSec = 0.04, volume = 0.6) {
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  freqs.forEach((freq, i) => {
    const start = t0 + i * (beepSec + gapSec);
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + beepSec);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + beepSec + 0.02);
  });
}

/** Three rising beeps: rest is over. */
export function playChime() {
  playTones([880, 988, 1319]);
}

export function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

async function showNotification() {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification('Rest over', {
      body: 'Time for your next set 💪',
      tag: 'rest-timer',
      icon: 'icon-192.png',
      silent: false,
    });
  } catch {
    // Ignore: no service worker in dev, or the platform refused.
  }
}

export function restOverAlert(opts: { sound: boolean }) {
  if (opts.sound) playChime();
  navigator.vibrate?.([300, 120, 300, 120, 300]);
  if (document.hidden) void showNotification();
}

/** Keeps the screen on (so the timer keeps running) while `active` is true. */
export function keepScreenAwake(): () => void {
  type WakeLockNavigator = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
  const nav = navigator as WakeLockNavigator;
  if (!nav.wakeLock) return () => {};
  let lock: { release: () => Promise<void> } | null = null;
  let stopped = false;
  const acquire = async () => {
    if (stopped || document.hidden) return;
    try {
      lock = await nav.wakeLock!.request('screen');
    } catch {
      lock = null;
    }
  };
  const onVisible = () => { if (!document.hidden) void acquire(); };
  void acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void lock?.release().catch(() => {});
  };
}
