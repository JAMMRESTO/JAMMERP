import { ChevronDown, LogOut, Monitor } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Caisse } from '../hooks/useCaisse';

interface Props {
  userName: string;
  userRole: string;
  caisses: Caisse[];
  caisseActive: Caisse | null;
  onSelectCaisse: (id: string) => void;
  onSignOut: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  societeNom?: string;
  licenseClient?: string;
  licenseDaysRemaining?: number;
}

export default function Header({ userName, userRole, caisses, caisseActive, onSelectCaisse, onSignOut, currentPage, onNavigate, societeNom, licenseClient, licenseDaysRemaining }: Props) {
  const [showCaisses, setShowCaisses] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowCaisses(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems = userRole === 'admin'
    ? [
        { key: 'home', label: 'Accueil' },
        { key: 'encaissement', label: 'Encaissement' },
        { key: 'decaissement', label: 'Decaissement' },
        { key: 'historique', label: 'Historique' },
        { key: 'cloture', label: 'Cloture' },
        { key: 'statistiques', label: 'Statistiques' },
        { key: 'parametres', label: 'Parametres' },
      ]
    : [
        { key: 'home', label: 'Accueil' },
        { key: 'encaissement', label: 'Encaissement' },
        { key: 'decaissement', label: 'Decaissement' },
        { key: 'historique', label: 'Historique' },
        { key: 'cloture', label: 'Cloture' },
      ];

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
          <span className="text-white font-black text-xs">MC</span>
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-bold text-gray-900 leading-none">{societeNom || 'Ma Caisse'}</p>
          <p className="text-[10px] text-gray-400">{licenseClient || 'Desktop'}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-none">
        {navItems.map(item => (
          <button key={item.key} onClick={() => onNavigate(item.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              currentPage === item.key ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Caisse selector */}
      {caisses.length > 0 && (
        <div className="relative shrink-0" ref={dropRef}>
          <button onClick={() => setShowCaisses(!showCaisses)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 transition">
            <Monitor size={12} />
            <span className="max-w-[80px] truncate">{caisseActive?.nom || 'Caisse'}</span>
            <ChevronDown size={12} />
          </button>
          {showCaisses && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[160px]">
              {caisses.map(c => (
                <button key={c.id} onClick={() => { onSelectCaisse(c.id); setShowCaisses(false); }}
                  className={`w-full text-left px-4 py-2 text-xs font-medium transition ${
                    c.id === caisseActive?.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'
                  }`}>
                  {c.nom}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* License days + User */}
      <div className="flex items-center gap-2 shrink-0">
        {licenseDaysRemaining !== undefined && licenseDaysRemaining <= 30 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            licenseDaysRemaining <= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {licenseDaysRemaining}j
          </span>
        )}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-gray-800 leading-none">{userName}</p>
          <p className="text-[10px] text-gray-400 capitalize">{userRole}</p>
        </div>
        <button onClick={onSignOut} className="p-1.5 text-gray-400 hover:text-red-500 transition" title="Deconnexion">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
