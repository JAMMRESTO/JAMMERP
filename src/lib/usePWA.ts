import { useEffect, useState, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAOptions {
  tenantName?: string | null;
  logoUrl?: string | null;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let globalListenerAttached = false;

export function usePWA({ tenantName, logoUrl }: PWAOptions) {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const dismissedKey = 'senresto_pwa_dismissed';
  const [isDismissed, setIsDismissed] = useState(() => {
    const stored = localStorage.getItem(dismissedKey);
    if (!stored) return false;
    const dismissed = parseInt(stored, 10);
    return Date.now() - dismissed < 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    if (!globalListenerAttached) {
      globalListenerAttached = true;
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e as BeforeInstallPromptEvent;
        window.dispatchEvent(new CustomEvent('pwa-can-install'));
      });

      window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        window.dispatchEvent(new CustomEvent('pwa-installed'));
      });
    }

    if (deferredPrompt) {
      setCanInstall(true);
    }

    const onCanInstall = () => setCanInstall(true);
    const onInstalled = () => {
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener('pwa-can-install', onCanInstall);
    window.addEventListener('pwa-installed', onInstalled);

    return () => {
      window.removeEventListener('pwa-can-install', onCanInstall);
      window.removeEventListener('pwa-installed', onInstalled);
    };
  }, []);

  useEffect(() => {
    const appName = tenantName || 'SENRESTO';
    document.title = appName;

    const metaTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (metaTitle) metaTitle.setAttribute('content', appName);

    const iconUrl = logoUrl || '/Logo_restaurant.png';

    const manifest = {
      name: appName,
      short_name: appName.length > 12 ? appName.slice(0, 12) : appName,
      description: `${appName} — Gestion de restaurant`,
      start_url: '/',
      display: 'standalone' as const,
      background_color: '#0f172a',
      theme_color: '#0f172a',
      orientation: 'any' as const,
      icons: [
        { src: iconUrl, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: iconUrl, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (link) {
      link.href = url;
    } else {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = url;
      document.head.appendChild(link);
    }

    const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (appleIcon) appleIcon.href = iconUrl;

    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) favicon.href = iconUrl;

    return () => URL.revokeObjectURL(url);
  }, [tenantName, logoUrl]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt = null;
      return true;
    }
    return false;
  }, []);

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    localStorage.setItem(dismissedKey, Date.now().toString());
  }, []);

  const showBanner = canInstall && !isInstalled && !isDismissed;

  return { canInstall, isInstalled, showBanner, promptInstall, dismiss };
}
