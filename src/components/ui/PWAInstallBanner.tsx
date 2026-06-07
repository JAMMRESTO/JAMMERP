import { Download, X, Smartphone } from 'lucide-react';
import { useState } from 'react';

interface Props {
  tenantName: string;
  logoUrl: string | null;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

export function PWAInstallBanner({ tenantName, logoUrl, onInstall, onDismiss }: Props) {
  const [installing, setInstalling] = useState(false);

  async function handleInstall() {
    setInstalling(true);
    await onInstall();
    setInstalling(false);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm mx-4 mb-4 sm:mb-0 bg-gray-900 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-400">
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
              <p className="text-white/40 text-xs mt-0.5">Application de gestion</p>
            </div>
          </div>

          {/* Benefits */}
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

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/50 text-sm font-medium transition-all active:scale-[0.98]"
            >
              Plus tard
            </button>
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
          </div>
        </div>
      </div>
    </div>
  );
}
