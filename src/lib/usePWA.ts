import { useEffect } from 'react';

interface PWAOptions {
  tenantName?: string | null;
  logoUrl?: string | null;
}

export function usePWA({ tenantName, logoUrl }: PWAOptions) {
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
}
