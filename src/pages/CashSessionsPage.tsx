import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Unlock, TrendingUp, ShoppingBag, Banknote,
  Smartphone, CreditCard, ChevronDown, CheckCircle2,
  AlertTriangle, ArrowUpRight, ArrowDownRight, Minus,
  RefreshCw, Loader2, Calendar, X, Receipt
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../context/TenantContext';
import { useSettings } from '../context/SettingsContext';
import type { CashSession, PaymentMethod } from '../types/database';

function fmt(n: number, sym: string) {
  return `${n.toLocaleString('fr-FR')} ${sym}`;
}

function diffIcon(d: number) {
  if (d === 0) return <Minus size={12} className="text-white/40" />;
  if (d > 0) return <ArrowUpRight size={12} className="text-blue-400" />;
  return <ArrowDownRight size={12} className="text-red-400" />;
}

function diffColor(d: number) {
  if (d === 0) return 'text-white/40';
  if (d > 0) return 'text-blue-400';
  return 'text-red-400';
}

const METHOD_CONFIG: { id: PaymentMethod; label: string; icon: typeof Banknote; color: string }[] = [
  { id: 'cash', label: 'Espèces', icon: Banknote, color: 'text-emerald-400' },
  { id: 'wave', label: 'Wave', icon: Smartphone, color: 'text-blue-400' },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone, color: 'text-orange-400' },
  { id: 'card', label: 'Carte', icon: CreditCard, color: 'text-violet-400' },
];

function SessionRow({ session, sym, onClick }: { session: CashSession; sym: string; onClick: () => void }) {
  const diff = session.cash_difference;
  const openedAt = new Date(session.opened_at);
  const closedAt = session.closed_at ? new Date(session.closed_at) : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/12 rounded-xl p-4 cursor-pointer transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            session.status === 'closed' ? 'bg-emerald-500/12 border border-emerald-500/20' : 'bg-amber-500/12 border border-amber-500/20'
          }`}>
            {session.status === 'closed'
              ? <Lock size={15} className="text-emerald-400" />
              : <Unlock size={15} className="text-amber-400" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">Session #{String(session.session_number).padStart(4, '0')}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                session.status === 'closed'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {session.status === 'closed' ? 'Fermée' : 'En cours'}
              </span>
            </div>
            <p className="text-white/40 text-[10px] mt-0.5">
              {openedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}
              {openedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {closedAt && ` → ${closedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-emerald-400 font-black text-base leading-tight">{fmt(session.total_sales, sym)}</p>
          <p className="text-white/40 text-[10px]">{session.sales_count} vente{session.sales_count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {session.status === 'closed' && (
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/6">
          <div className="flex items-center gap-1.5">
            {diffIcon(diff)}
            <span className={`text-xs font-semibold ${diffColor(diff)}`}>
              Écart {diff >= 0 ? '+' : ''}{fmt(diff, sym)}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {METHOD_CONFIG.filter(m => session[`total_${m.id}` as keyof CashSession] as number > 0).map(m => (
              <div key={m.id} className="flex items-center gap-1">
                <m.icon size={11} className={m.color} />
                <span className="text-white/50 text-[10px]">{fmt(session[`total_${m.id}` as keyof CashSession] as number, sym)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SessionDetailModal({ session, sym, onClose }: { session: CashSession; sym: string; onClose: () => void }) {
  const diff = session.cash_difference;
  const openedAt = new Date(session.opened_at);
  const closedAt = session.closed_at ? new Date(session.closed_at) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Receipt size={16} className="text-white/60" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Session #{String(session.session_number).padStart(4, '0')}</h2>
              <p className="text-white/40 text-[10px]">
                {openedAt.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {/* Horaires */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/4 rounded-xl p-3 border border-white/6">
              <p className="text-white/40 text-[10px] mb-1">Ouverture</p>
              <p className="text-white font-semibold text-sm">
                {openedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="bg-white/4 rounded-xl p-3 border border-white/6">
              <p className="text-white/40 text-[10px] mb-1">Fermeture</p>
              <p className="text-white font-semibold text-sm">
                {closedAt ? closedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-emerald-500/8 rounded-xl p-3 border border-emerald-500/15">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={12} className="text-emerald-400" />
                <span className="text-emerald-300/60 text-[10px]">Chiffre d'affaires</span>
              </div>
              <p className="text-emerald-400 font-black text-lg">{fmt(session.total_sales, sym)}</p>
            </div>
            <div className="bg-white/4 rounded-xl p-3 border border-white/6">
              <div className="flex items-center gap-1.5 mb-1">
                <ShoppingBag size={12} className="text-white/40" />
                <span className="text-white/40 text-[10px]">Ventes</span>
              </div>
              <p className="text-white font-black text-lg">{session.sales_count}</p>
            </div>
          </div>

          {/* Détail par méthode */}
          <div>
            <p className="text-white/40 text-[11px] font-medium mb-2">Encaissements par méthode</p>
            <div className="space-y-1.5">
              {METHOD_CONFIG.map(m => {
                const val = session[`total_${m.id}` as keyof CashSession] as number;
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-white/3 rounded-xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <m.icon size={13} className={m.color} />
                      <span className="text-white/60 text-xs">{m.label}</span>
                    </div>
                    <span className={`font-semibold text-sm ${val > 0 ? 'text-white' : 'text-white/25'}`}>
                      {fmt(val, sym)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comptage caisse */}
          {session.status === 'closed' && (
            <div>
              <p className="text-white/40 text-[11px] font-medium mb-2">Comptage caisse</p>
              <div className="bg-white/3 rounded-xl border border-white/6 p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Fonds initial</span>
                  <span className="text-white/70">{fmt(session.opening_balance, sym)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Espèces attendues</span>
                  <span className="text-white/70">{fmt(session.expected_cash, sym)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Espèces comptées</span>
                  <span className="text-white/70">{fmt(session.actual_cash, sym)}</span>
                </div>
                <div className={`flex justify-between text-xs font-bold pt-1.5 border-t border-white/6 ${diffColor(diff)}`}>
                  <div className="flex items-center gap-1.5">
                    {diffIcon(diff)}
                    <span>Écart</span>
                  </div>
                  <span>{diff >= 0 ? '+' : ''}{fmt(diff, sym)}</span>
                </div>
              </div>
              {diff !== 0 && (
                <div className={`flex items-start gap-2 p-3 rounded-xl mt-2 ${
                  diff > 0 ? 'bg-blue-500/8 border border-blue-500/20' : 'bg-red-500/8 border border-red-500/20'
                }`}>
                  <AlertTriangle size={13} className={diff > 0 ? 'text-blue-400 mt-0.5' : 'text-red-400 mt-0.5'} />
                  <p className={`text-xs ${diff > 0 ? 'text-blue-300' : 'text-red-300'}`}>
                    {diff > 0 ? 'Excédent de caisse' : 'Manque en caisse'} : {fmt(Math.abs(diff), sym)}
                  </p>
                </div>
              )}
              {diff === 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl mt-2 bg-emerald-500/8 border border-emerald-500/20">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  <p className="text-emerald-300 text-xs">Caisse équilibrée</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {session.notes && (
            <div>
              <p className="text-white/40 text-[11px] font-medium mb-1.5">Notes</p>
              <p className="text-white/60 text-sm bg-white/3 rounded-xl border border-white/6 p-3">{session.notes}</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function CashSessionsPage() {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { settings } = useSettings();
  const sym = settings.currency_symbol;

  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CashSession | null>(null);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const query = supabase.from('cash_sessions').select('*').eq('site_id', siteId).order('opened_at', { ascending: false }).limit(100);
    const { data } = await query;
    setSessions((data ?? []) as CashSession[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const filtered = sessions.filter(s => filter === 'all' ? true : s.status === filter);

  // KPI globaux
  const totalRevenue = sessions.filter(s => s.status === 'closed').reduce((a, s) => a + s.total_sales, 0);
  const totalSales = sessions.filter(s => s.status === 'closed').reduce((a, s) => a + s.sales_count, 0);
  const openSession = sessions.find(s => s.status === 'open');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-950">
      {/* KPI banner */}
      <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-white/6 bg-gray-900/40">
        <div className="bg-white/3 rounded-xl p-3 border border-white/6">
          <p className="text-white/40 text-[10px] mb-1">CA total (clôturé)</p>
          <p className="text-emerald-400 font-black text-base sm:text-lg leading-tight">{fmt(totalRevenue, sym)}</p>
        </div>
        <div className="bg-white/3 rounded-xl p-3 border border-white/6">
          <p className="text-white/40 text-[10px] mb-1">Ventes totales</p>
          <p className="text-white font-black text-base sm:text-lg leading-tight">{totalSales}</p>
        </div>
        <div className="bg-white/3 rounded-xl p-3 border border-white/6">
          <p className="text-white/40 text-[10px] mb-1">Fermetures</p>
          <p className="text-white font-black text-base sm:text-lg leading-tight">{sessions.filter(s => s.status === 'closed').length}</p>
        </div>
      </div>

      {/* Session ouverte banner */}
      {openSession && (
        <div className="flex-shrink-0 mx-4 sm:mx-6 mt-4">
          <div className="flex items-center gap-3 p-3 bg-amber-500/8 border border-amber-500/25 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-amber-300 text-xs font-medium flex-1">
              Session #{String(openSession.session_number).padStart(4, '0')} en cours depuis {new Date(openSession.opened_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 sm:px-6 py-3">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/8">
          {([['all', 'Tout'], ['open', 'En cours'], ['closed', 'Fermées']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === id ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-xs transition-all">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Actualiser
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6 space-y-2" style={{ scrollbarWidth: 'thin' }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-white/20 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-3">
              <Calendar size={22} className="text-white/20" />
            </div>
            <p className="text-white/30 font-medium text-sm">Aucune session</p>
            <p className="text-white/20 text-xs mt-1">Les clôtures apparaîtront ici</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(s => (
              <SessionRow key={s.id} session={s} sym={sym} onClick={() => setSelected(s)} />
            ))}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {selected && (
          <SessionDetailModal session={selected} sym={sym} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
