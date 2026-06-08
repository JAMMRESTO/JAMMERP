import { Download, Smartphone, Share, PlusSquare } from 'lucide-react';
import { useState } from 'react';

interface Props {
  tenantName: string;
  logoUrl: string | null;
  showIOSGuide?: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

export function PWAInstallBanner({ tenantName, logoUrl, showIOSGuide, onInstall, onDismiss }: Props) {
  const [installing, setInstalling] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    await onInstall();
    setInstalling(false);
  }

  return (
    <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-gray-900 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header accent */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-600" />

        <div className="p-6">
          {/* App icon + name */}
          <div className="flex items-center gap-4 mb-5">
            <div className="relative flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={tenantName}
                  className="w-16 h-16 rounded-2xl object-cover border border-white/[0.1] shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center border border-white/[0.1] shadow-lg">
                  <Smartphone size={28} className="text-white" />
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center border-2 border-gray-900">
                <Download size={10} className="text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-lg leading-tight truncate">
                {tenantName}
              </h3>
              <p className="text-white/40 text-xs mt-0.5">Installer l'application</p>
            </div>
          </div>

          {showIOSGuide ? (
            /* iOS Safari: manual instructions */
            <div className="space-y-4 mb-6">
              <p className="text-white/60 text-xs">Pour installer sur votre appareil :</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <Share size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">1. Appuyez sur Partager</p>
                    <p className="text-white/35 text-[10px]">L'icone en bas de Safari</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <PlusSquare size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white text-xs font-semibold">2. "Sur l'ecran d'accueil"</p>
                    <p className="text-white/35 text-[10px]">Faites defiler et appuyez dessus</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Chrome/Edge: auto install */
            <div className="space-y-2 mb-6">
              {[
                'Acces rapide depuis votre ecran d\'accueil',
                'Fonctionne meme hors connexion',
                'Experience plein ecran sans barre de navigation',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  </div>
                  <p className="text-white/55 text-xs leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/40 text-xs font-medium transition-all active:scale-[0.98]"
            >
              Plus tard
            </button>
            {!showIOSGuide && (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {installing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Download size={15} />
                    Installer
                  </>
                )}
              </button>
            )}
            {showIOSGuide && (
              <button
                onClick={onDismiss}
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all active:scale-[0.98]"
              >
                J'ai compris
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
