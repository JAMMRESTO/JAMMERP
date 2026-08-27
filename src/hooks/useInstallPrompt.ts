import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice] = useState(isIOS);
  const [dismissed, setDismissed] = useState(() => {
    const val = localStorage.getItem('pwa-install-dismissed');
    if (!val) return false;
    const ts = parseInt(val, 10);
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => setIsInstalled(true);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
  }

  const showIOSPrompt = isIOSDevice && !isInstalled && !dismissed;
  const showAndroidPrompt = !!deferredPrompt && !isInstalled && !dismissed;
  const showPrompt = showIOSPrompt || showAndroidPrompt;

  return { showPrompt, showIOSPrompt, showAndroidPrompt, install, dismiss, isInstalled };
}
