import { useState } from 'react';
import { ChevronDown, LogOut, User, ChevronRight, Lock, Shield, Building2 } from 'lucide-react';
import type { Caisse } from '../types/database';

interface Props {
  userName: string;
  userRole: string;
  isSuperAdmin: boolean;
  caisses: Caisse[];
  caisseActive: Caisse | null;
  onSelectCaisse: (c: Caisse) => void;
  onSignOut: () => void;
  currentPage: string;
  onNavigate: (page: string) => void;
  subscriptionDaysLeft: number | null;
  societeNom?: string;
  societeLogo?: string;
}

const ALL_navItems = [
  { id: 'home', label: 'Accueil', roles: ['admin', 'caissier'], superOnly: false },
  { id: 'dashboard', label: 'Tableau de bord', roles: ['admin'], superOnly: false },
  { id: 'encaissement', label: 'Encaissement', roles: ['admin', 'caissier'], superOnly: false },
  { id: 'decaissement', label: 'Decaissement', roles: ['admin', 'caissier'], superOnly: false },
  { id: 'historique', label: 'Historique', roles: ['admin', 'caissier'], superOnly: false },
  { id: 'statistiques', label: 'Statistiques', roles: ['admin'], superOnly: false },
  { id: 'cloture', label: 'Cloture', roles: ['admin', 'caissier'], superOnly: false },
  { id: 'societes', label: 'Societes', roles: ['admin'], superOnly: true },
  { id: 'parametres', label: 'Parametres', roles: ['admin'], superOnly: false },
];

export default function Header({ userName, userRole, isSuperAdmin, caisses, caisseActive, onSelectCaisse, onSignOut, currentPage, onNavigate, subscriptionDaysLeft, societeNom, societeLogo }: Props) {
  const [caisseOpen, setCaisseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = ALL_navItems.filter(item => item.roles.includes(userRole) && (!item.superOnly || isSuperAdmin));

  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <button onClick={() => onNavigate('home')} className="flex items-center gap-2 shrink-0">
          {societeLogo ? (
            <img src={societeLogo} alt="" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white font-black text-xs">{societeNom ? societeNom.slice(0, 2).toUpperCase() : 'MC'}</span>
            </div>
          )}
          <span className="font-black text-gray-900 text-lg hidden sm:block truncate max-w-[180px]">{societeNom || 'MA CAISSE'}</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                currentPage === item.id
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {/* Caisse selector — admins can switch, caissiers see a static badge */}
          <div className="relative">
            {userRole === 'admin' ? (
              <>
                <button
                  onClick={() => setCaisseOpen(!caisseOpen)}
                  className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="hidden sm:block">{caisseActive?.nom ?? 'Caisse'}</span>
                  <ChevronDown size={14} />
                </button>
                {caisseOpen && (
                  <div className="absolute right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[140px] z-50">
                    {caisses.map(c => (
                      <button
                        key={c.id}
                        onClick={() => { onSelectCaisse(c); setCaisseOpen(false); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50 ${caisseActive?.id === c.id ? 'text-emerald-600' : 'text-gray-700'}`}
                      >
                        {caisseActive?.id === c.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        {c.nom}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="hidden sm:block">{caisseActive?.nom ?? 'Caisse'}</span>
              </div>
            )}
          </div>

          {/* User */}
          <div className="flex items-center gap-1">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <User size={13} />
              <span className="max-w-[120px] truncate">{userName}</span>
            </div>
            <button
              onClick={onSignOut}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition"
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-gray-500 hover:bg-gray-50 rounded-xl">
            <div className="space-y-1">
              <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-current transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white py-2 px-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onNavigate(item.id); setMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition ${
                currentPage === item.id ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
