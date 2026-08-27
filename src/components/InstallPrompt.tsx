import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Already installed or dismissed this session
    if (sessionStorage.getItem('pwa-install-dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if ((window.navigator as Navigator & { standalone?: boolean }).standalone) return;

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) && !('MSStream' in window);

    if (ios) {
      setIsIos(true);
      // Show iOS instructions after a short delay
      setTimeout(() => setShow(true), 1500);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShow(true), 1500);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('pwa-install-dismissed', '1');
  };

  if (!show || dismissed) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-white rounded-t-3xl shadow-2xl px-6 pt-6 pb-8 max-w-lg mx-auto">
          {/* Handle */}
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-emerald-400 font-black text-lg">MC</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-gray-900 leading-tight">Installer Ma Caisse</h2>
              <p className="text-sm text-gray-500 mt-1">
                Accédez rapidement à votre caisse depuis l'écran d'accueil, même sans connexion.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition shrink-0 -mt-1 -mr-1"
            >
              <X size={18} />
            </button>
          </div>

          {/* Benefits */}
          <div className="space-y-2.5 mb-6">
            {[
              'Accès rapide depuis l\'écran d\'accueil',
              'Fonctionne hors connexion',
              'Expérience plein écran sans navigateur',
            ].map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <span className="text-sm text-gray-700">{b}</span>
              </div>
            ))}
          </div>

          {isIos ? (
            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone size={16} className="text-gray-600" />
                <span className="text-sm font-semibold text-gray-700">Comment installer sur iPhone / iPad</span>
              </div>
              <ol className="space-y-2">
                {[
                  'Appuyez sur le bouton Partager dans Safari',
                  'Faites défiler et appuyez sur "Sur l\'écran d\'accueil"',
                  'Appuyez sur "Ajouter" pour confirmer',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-600">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold py-4 rounded-2xl transition active:scale-[0.98]"
            >
              <Download size={18} />
              Installer l'application
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-3 transition"
          >
            Continuer dans le navigateur
          </button>
        </div>
      </div>
    </>
  );
}
