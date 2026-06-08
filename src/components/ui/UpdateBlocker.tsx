import { useState, useEffect } from 'react';
import { RefreshCw, Download, Wifi } from 'lucide-react';

export function UpdateBlocker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Listen for messages from SW
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'SW_UPDATED') {
        setUpdateAvailable(true);
      }
    }
    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check for SW updates
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      // If there's already a waiting worker, show the update
      if (reg.waiting) {
        setUpdateAvailable(true);
        return;
      }

      // Listen for new SW waiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });

      // Check for updates every 60s
      const interval = setInterval(() => { reg.update(); }, 60000);
      return () => clearInterval(interval);
    });

    // Also detect when controllerchange fires (new SW took over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  function handleUpdate() {
    setInstalling(true);
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mb-5">
          {installing
            ? <RefreshCw size={28} className="text-blue-400 animate-spin" />
            : <Download size={28} className="text-blue-400" />
          }
        </div>

        {/* Title */}
        <h2 className="text-white font-bold text-lg mb-2">
          Mise a jour disponible
        </h2>
        <p className="text-white/50 text-sm leading-relaxed mb-6">
          Une nouvelle version de l'application est disponible. Veuillez mettre a jour pour continuer.
        </p>

        {/* Status */}
        {installing && (
          <div className="flex items-center justify-center gap-2 mb-5">
            <Wifi size={12} className="text-blue-400 animate-pulse" />
            <span className="text-blue-400/80 text-xs font-medium">Installation en cours...</span>
          </div>
        )}

        {/* Button */}
        <button
          onClick={handleUpdate}
          disabled={installing}
          className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
        >
          {installing ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              Mise a jour...
            </>
          ) : (
            <>
              <Download size={15} />
              Mettre a jour maintenant
            </>
          )}
        </button>

        <p className="text-white/25 text-[10px] mt-4">
          L'application sera rechargee automatiquement.
        </p>
      </div>
    </div>
  );
}
