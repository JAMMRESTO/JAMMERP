import { useState, useEffect } from 'react';
import { Download, X, Monitor, Smartphone, Apple } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'android' | 'ios' | 'windows' | 'mac' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/win/.test(ua)) return 'windows';
  if (/mac/.test(ua)) return 'mac';
  return 'other';
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [platform] = useState<Platform>(detectPlatform());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem('pwa_install_dismissed')) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (platform === 'ios') {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(timer);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [platform]);

  const handleInstall = async () => {
    if (platform === 'ios') {
      setShowIosGuide(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem('pwa_install_dismissed', '1');
  };

  if (!show || dismissed || isStandalone()) return null;

  const PlatformIcon = platform === 'ios' || platform === 'mac' ? Apple
    : platform === 'windows' ? Monitor
    : Smartphone;

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
        <div className="bg-gray-800 border border-amber-500/30 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="flex-shrink-0 w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center">
              <PlatformIcon size={20} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Installer THE WEST AFRICAN</p>
              <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
                {platform === 'ios'
                  ? 'Ajoutez l\'app à votre écran d\'accueil pour un accès rapide.'
                  : 'Installez l\'application pour un accès rapide et hors-ligne.'}
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors p-0.5"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex border-t border-gray-700/50">
            <button
              onClick={handleDismiss}
              className="flex-1 py-3 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-colors"
            >
              Plus tard
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-3 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5 border-l border-gray-700/50"
            >
              <Download size={14} />
              Installer
            </button>
          </div>
        </div>
      </div>

      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white font-semibold">Installer sur iPhone / iPad</h3>
              <button onClick={() => { setShowIosGuide(false); setShow(false); }} className="text-gray-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">1</span>
                <p className="text-gray-300 text-sm pt-0.5">
                  Appuyez sur le bouton <strong className="text-white">Partager</strong> <span className="inline-block border border-gray-500 rounded px-1 py-0.5 text-xs mx-0.5">⬆</span> en bas de Safari
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">2</span>
                <p className="text-gray-300 text-sm pt-0.5">
                  Faites défiler et appuyez sur <strong className="text-white">« Sur l'écran d'accueil »</strong>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center">3</span>
                <p className="text-gray-300 text-sm pt-0.5">
                  Appuyez sur <strong className="text-white">Ajouter</strong> en haut à droite
                </p>
              </div>
            </div>
            <div className="p-4 pt-0">
              <button
                onClick={() => { setShowIosGuide(false); setShow(false); sessionStorage.setItem('pwa_install_dismissed', '1'); }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl text-sm transition-colors"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
