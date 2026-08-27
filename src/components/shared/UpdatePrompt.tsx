import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles } from 'lucide-react';

const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const [updating, setUpdating] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (err) => console.error('SW register error:', err),
    onRegisteredSW: (_swUrl, registration) => {
      registrationRef.current = registration ?? null;
      checkForWaitingWorker(registration);
      registration?.update().catch(() => {});
    },
  });

  const checkForWaitingWorker = (registration?: ServiceWorkerRegistration | null) => {
    const reg = registration ?? registrationRef.current;
    if (!reg) return;
    if (reg.waiting) {
      setNeedRefresh(true);
      setShow(true);
    }
  };

  useEffect(() => {
    if (needRefresh) setShow(true);
  }, [needRefresh]);

  useEffect(() => {
    const triggerUpdate = () => {
      registrationRef.current?.update().then(() => checkForWaitingWorker()).catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') triggerUpdate();
    };
    const onFocus = () => triggerUpdate();
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) triggerUpdate();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    const interval = window.setInterval(triggerUpdate, UPDATE_INTERVAL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
      window.clearInterval(interval);
    };
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    await updateServiceWorker(true);
  };

  const handleClose = () => {
    setShow(false);
    setNeedRefresh(false);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm bg-gray-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500" />

        <div className="flex flex-col items-center p-7 pt-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full" />
            <div className="relative w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
              {updating ? (
                <RefreshCw size={28} className="text-black animate-spin" />
              ) : (
                <Sparkles size={28} className="text-black" />
              )}
            </div>
          </div>

          <h2 className="text-white font-black text-xl text-center tracking-tight">
            Mise à jour disponible
          </h2>
          <p className="text-gray-400 text-sm mt-2 text-center leading-relaxed">
            Une nouvelle version de THE WEST AFRICAN a été publiée. Mettez à jour maintenant pour profiter des dernières améliorations.
          </p>
        </div>

        <div className="px-6 pb-7">
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20"
          >
            {updating ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Mise à jour...
              </>
            ) : (
              <>
                <RefreshCw size={18} />
                Mettre à jour
              </>
            )}
          </button>
          <button
            onClick={handleClose}
            disabled={updating}
            className="w-full mt-2 py-2.5 text-gray-500 hover:text-gray-300 disabled:opacity-40 text-xs font-medium transition-colors"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
