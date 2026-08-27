import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

interface Props {
  onInstall: () => void;
  onDismiss: () => void;
  isIOS?: boolean;
}

function IOSShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function IOSNativeShareIcon() {
  return (
    <svg viewBox="0 0 60 60" className="w-7 h-7" fill="none">
      <rect width="60" height="60" rx="13" fill="#007AFF"/>
      <path d="M30 8v26M22 16l8-8 8 8" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 28v18h24V28" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IOSAddHomeIcon() {
  return (
    <svg viewBox="0 0 60 60" className="w-7 h-7" fill="none">
      <rect width="60" height="60" rx="13" fill="#f0f0f0"/>
      <rect x="8" y="8" width="44" height="44" rx="10" stroke="#333" strokeWidth="3"/>
      <path d="M30 18v24M18 30h24" stroke="#333" strokeWidth="3.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function InstallBanner({ onInstall, onDismiss, isIOS = false }: Props) {
  const [arrowVisible, setArrowVisible] = useState(true);

  useEffect(() => {
    if (!isIOS) return;
    const interval = setInterval(() => {
      setArrowVisible(v => !v);
    }, 1200);
    return () => clearInterval(interval);
  }, [isIOS]);

  if (isIOS) {
    return (
      <>
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden" style={{ maxHeight: '90vh' }}>
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-7 pb-5 text-center">
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-16 h-16 rounded-2xl mx-auto mb-3 shadow-lg overflow-hidden bg-white p-1">
                <img
                  src="/Logo_moderne_SUNUFACTURE_avec_icone_stylisee.png"
                  alt="SUNUFACTURE"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <h2 className="text-lg font-bold text-white mb-0.5">Installer SUNUFACTURE</h2>
              <p className="text-slate-400 text-xs">Acces rapide depuis votre ecran d'accueil</p>
            </div>

            <div className="px-5 py-5 space-y-4">
              <p className="text-center text-sm font-semibold text-slate-700">
                2 etapes simples dans Safari
              </p>

              <div className="space-y-3">
                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">1</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-800 text-sm font-semibold mb-1">
                      Touchez le bouton Partager
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-blue-600 text-white rounded-xl px-3 py-1.5 shadow-sm">
                        <IOSNativeShareIcon />
                        <span className="text-xs font-semibold">Partager</span>
                      </div>
                      <span className="text-slate-500 text-xs">en bas de Safari</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-800 text-sm font-semibold mb-1">
                      Sur l'ecran d'accueil
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm">
                        <IOSAddHomeIcon />
                        <span className="text-xs font-medium text-slate-700">Sur l'ecran d'accueil</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-blue-700 text-xs leading-relaxed">
                  L'app s'ouvrira en plein ecran, sans barre Safari - comme une vraie application
                </p>
              </div>

              <button
                onClick={onDismiss}
                className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
              >
                Continuer sur le navigateur
              </button>
            </div>
          </div>
        </div>

        <div
          className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center pointer-events-none"
          style={{ paddingBottom: '2px' }}
        >
          <div
            className="flex flex-col items-center gap-1 transition-all duration-500"
            style={{ opacity: arrowVisible ? 1 : 0.3, transform: arrowVisible ? 'translateY(0)' : 'translateY(6px)' }}
          >
            <div className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg whitespace-nowrap">
              Bouton ici
            </div>
            <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-blue-600 drop-shadow-lg" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-8 pb-6 text-center">
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg overflow-hidden bg-white p-1">
            <img
              src="/Logo_moderne_SUNUFACTURE_avec_icone_stylisee.png"
              alt="SUNUFACTURE"
              className="w-full h-full object-contain rounded-xl"
            />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">SUNUFACTURE</h2>
          <p className="text-slate-400 text-sm">Facturation professionnelle</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-slate-600 text-sm text-center leading-relaxed">
            Installez l'application sur votre appareil pour un acces rapide, meme hors connexion.
          </p>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-[11px] font-medium text-slate-600">Rapide</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[11px] font-medium text-slate-600">Hors ligne</span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <span className="text-[11px] font-medium text-slate-600">Notifications</span>
            </div>
          </div>

          <button
            onClick={onInstall}
            className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
          >
            <Download className="w-5 h-5" />
            Installer l'application
          </button>

          <button
            onClick={onDismiss}
            className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Continuer sur le navigateur
          </button>
        </div>
      </div>
    </div>
  );
}
