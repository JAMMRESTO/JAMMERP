import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function UpdatePrompt() {
  const [visible, setVisible] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const handler = () => {
      setVisible(true);
      // Auto-reload after 4 seconds if user doesn't act
      setTimeout(() => window.location.reload(), 4000);
    };
    window.addEventListener('app-update-available', handler);
    return () => window.removeEventListener('app-update-available', handler);
  }, []);

  if (!visible) return null;

  const handleUpdate = () => {
    setReloading(true);
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-emerald-500 w-full" />

        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <RefreshCw size={26} className="text-emerald-600" />
          </div>

          <div>
            <h2 className="text-lg font-black text-gray-900">Mise à jour disponible</h2>
            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
              Une nouvelle version de MA CAISSE est disponible.<br />
              Veuillez mettre à jour pour continuer.
            </p>
          </div>

          <button
            onClick={handleUpdate}
            disabled={reloading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm flex items-center justify-center gap-2"
          >
            <RefreshCw size={15} className={reloading ? 'animate-spin' : ''} />
            {reloading ? 'Mise à jour en cours...' : 'Mettre à jour maintenant'}
          </button>
        </div>
      </div>
    </div>
  );
}
