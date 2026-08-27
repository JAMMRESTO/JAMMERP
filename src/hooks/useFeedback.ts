import { useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';

type SoundType = 'add' | 'print' | 'payment' | 'error';

function playBeep(freq: number, duration: number, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
    setTimeout(() => ctx.close(), duration + 100);
  } catch {
  }
}

export function useFeedback() {
  const { settings } = useSettings();

  const vibrate = useCallback((ms = 50) => {
    if (!settings.vibrationEnabled) return;
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {
    }
  }, [settings.vibrationEnabled]);

  const sound = useCallback((type: SoundType) => {
    if (!settings.soundEnabled) return;
    switch (type) {
      case 'add':
        playBeep(880, 80);
        break;
      case 'print':
        playBeep(660, 80);
        setTimeout(() => playBeep(880, 80), 120);
        break;
      case 'payment':
        playBeep(523, 100);
        setTimeout(() => playBeep(659, 100), 130);
        setTimeout(() => playBeep(784, 150), 260);
        break;
      case 'error':
        playBeep(220, 200, 0.4);
        setTimeout(() => playBeep(180, 200, 0.4), 250);
        break;
    }
  }, [settings.soundEnabled]);

  const feedback = useCallback((type: SoundType, vibMs = 50) => {
    sound(type);
    vibrate(vibMs);
  }, [sound, vibrate]);

  return { sound, vibrate, feedback };
}
