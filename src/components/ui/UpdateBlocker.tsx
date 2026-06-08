import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Download, AlertCircle } from 'lucide-react';

const CHECK_INTERVAL = 30_000; // 30s
const VERSION_KEY = 'senresto_build_version';

export function UpdateBlocker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [reloading, setReloading] = useState(false);
  const initialVersion = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkVersion() {
      try {
        const res = await fetch('/build-version.json?_=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const remoteVersion = data.v as string;
        if (!remoteVersion) return;

        if (!initialVersion.current) {
          // First load: store the current version
          const stored = localStorage.getItem(VERSION_KEY);
          if (stored && stored !== remoteVersion) {
            // App loaded with old cached version, new build is live
            if (active) setUpdateAvailable(true);
          }
          initialVersion.current = remoteVersion;
          localStorage.setItem(VERSION_KEY, remoteVersion);
        } else if (remoteVersion !== initialVersion.current) {
          // Version changed while the app is open
          if (active) setUpdateAvailable(true);
        }
      } catch {
        // network error — skip
      }
    }

    checkVersion();
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  function handleUpdate() {
    setReloading(true);
    // Clear caches then reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        Promise.all(names.map((n) => caches.delete(n))).then(() => {
          window.location.reload();
        });
      });
    } else {
      window.location.reload();
    }
  }

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-600" />

        <div className="p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mb-5">
            {reloading
              ? <RefreshCw size={28} className="text-blue-400 animate-spin" />
              : <AlertCircle size={28} className="text-blue-400" />
            }
          </div>

          {/* Title */}
          <h2 className="text-white font-bold text-lg mb-2">
            Nouvelle version disponible
          </h2>
          <p className="text-white/50 text-sm leading-relaxed mb-8">
            L'application a ete mise a jour. Veuillez actualiser pour utiliser la derniere version.
          </p>

          {/* Button */}
          <button
            onClick={handleUpdate}
            disabled={reloading}
            className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2.5"
          >
            {reloading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Actualisation...
              </>
            ) : (
              <>
                <Download size={15} />
                Actualiser maintenant
              </>
            )}
          </button>

          <p className="text-white/20 text-[10px] mt-5">
            La page va se recharger automatiquement.
          </p>
        </div>
      </div>
    </div>
  );
}
