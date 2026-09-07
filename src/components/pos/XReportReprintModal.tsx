import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileBarChart, Loader2, Printer, ChevronLeft, ChevronRight, Calendar, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrinter } from '../../context/PrinterContext';
import { useToast } from '../ui/Toast';
import { printXReport } from '../../lib/escpos';
import type { PaymentMethod, CashSession } from '../../types/database';

interface XReportReprintModalProps {
  onClose: () => void;
}

interface SalesSummary {
  total_sales: number;
  sales_count: number;
  by_method: Record<PaymentMethod, number>;
  by_category: { name: string; count: number; total: number }[];
  by_user: { name: string; products: { name: string; qty: number }[] }[];
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function XReportReprintModal({ onClose }: XReportReprintModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { currentUser } = useAuth();
  const { settings } = useSettings();
  const sym = settings.currency_symbol;
  const { connected: printerConnected } = usePrinter();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDateInput(d);
  });
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const loadSessions = useCallback(async (dateStr: string) => {
    if (!siteId) return;
    setLoading(true);
    const start = new Date(dateStr + 'T00:00:00');
    const end = new Date(dateStr + 'T23:59:59.999');
    const { data } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', 'closed')
      .gte('closed_at', start.toISOString())
      .lte('closed_at', end.toISOString())
      .order('closed_at', { ascending: false });
    setSessions((data ?? []) as CashSession[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => {
    loadSessions(selectedDate);
  }, [loadSessions, selectedDate]);

  function shiftDate(days: number) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateInput(d));
  }

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.getTime() === today.getTime()) return "Aujourd'hui";
    if (d.getTime() === yesterday.getTime()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  async function loadSummaryForSession(session: CashSession): Promise<SalesSummary> {
    const byMethod: Record<PaymentMethod, number> = { cash: 0, wave: 0, orange_money: 0, card: 0 };
    let byCategory: { name: string; count: number; total: number }[] = [];
    let byUser: { name: string; products: { name: string; qty: number }[] }[] = [];

    const { data: salesData } = await supabase
      .from('sales')
      .select('id, total, cashier_id')
      .eq('site_id', siteId)
      .eq('status', 'paid')
      .gte('paid_at', session.opened_at)
      .lte('paid_at', session.closed_at ?? new Date().toISOString());

    const saleIds = (salesData ?? []).map(s => s.id);
    const totalSales = (salesData ?? []).reduce((s, v) => s + v.total, 0);

    if (saleIds.length > 0) {
      const [{ data: paymentsData }, { data: itemsData }] = await Promise.all([
        supabase.from('payments').select('method, amount').eq('site_id', siteId).in('sale_id', saleIds),
        supabase.from('sale_items').select('sale_id, quantity, product_name, subtotal, product:products(category:categories(name))').eq('site_id', siteId).in('sale_id', saleIds),
      ]);

      const cashierIds = [...new Set((salesData ?? []).map(s => s.cashier_id).filter(Boolean))] as string[];
      const cashierNameMap: Record<string, string> = {};
      if (cashierIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', cashierIds);
        for (const user of usersData ?? []) cashierNameMap[user.id] = user.name;
      }

      const userProductMap = new Map<string, Map<string, number>>();
      const saleCashierMap = new Map((salesData ?? []).map(sale => [sale.id, sale.cashier_id ?? '']));
      for (const item of itemsData ?? []) {
        const cashierId = saleCashierMap.get(item.sale_id) ?? '';
        const userName = cashierId ? (cashierNameMap[cashierId] ?? 'UTILISATEUR NON RENSEIGNÉ') : 'UTILISATEUR NON RENSEIGNÉ';
        if (!userProductMap.has(userName)) userProductMap.set(userName, new Map());
        const productMap = userProductMap.get(userName)!;
        productMap.set(item.product_name, (productMap.get(item.product_name) ?? 0) + item.quantity);
      }
      byUser = Array.from(userProductMap.entries()).map(([name, productMap]) => ({
        name,
        products: Array.from(productMap.entries()).map(([productName, qty]) => ({ name: productName, qty })).sort((a, b) => b.qty - a.qty),
      }));

      for (const p of paymentsData ?? []) {
        byMethod[p.method as PaymentMethod] = (byMethod[p.method as PaymentMethod] ?? 0) + p.amount;
      }

      const catMap = new Map<string, { count: number; total: number }>();
      for (const item of itemsData ?? []) {
        const catName = (item as any).product?.category?.name ?? 'Sans catégorie';
        const existing = catMap.get(catName) ?? { count: 0, total: 0 };
        existing.count += item.quantity;
        existing.total += item.subtotal;
        catMap.set(catName, existing);
      }
      byCategory = Array.from(catMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.total - a.total);
    }

    return { total_sales: totalSales, sales_count: saleIds.length, by_method: byMethod, by_category: byCategory, by_user: byUser };
  }

  async function handleReprint(session: CashSession) {
    setPrintingId(session.id);
    try {
      const summary = await loadSummaryForSession(session);

      if (printerConnected) {
        const ok = await printXReport(
          {
            sessionNumber: session.session_number,
            openedAt: session.opened_at,
            closedAt: session.closed_at ?? new Date().toISOString(),
            cashierName: currentUser?.name ?? 'Caissier',
            salesCount: summary.sales_count,
            totalSales: summary.total_sales,
            byMethod: {
              cash: session.total_cash,
              wave: session.total_wave,
              orange_money: session.total_orange_money,
              card: session.total_card,
            },
            byCategory: summary.by_category,
            byUser: summary.by_user,
            openingBalance: session.opening_balance,
            expectedCash: session.expected_cash,
            actualCash: session.actual_cash,
            cashDifference: session.cash_difference,
            notes: session.notes,
          },
          {
            restaurant_name: settings.restaurant_name,
            address: settings.address,
            phone: settings.phone,
            vat_number: settings.vat_number,
            siret: settings.siret,
            currency_symbol: sym,
          },
        );
        if (ok) toast('success', 'X de caisse réimprimé');
        else toast('error', "Échec de l'impression du X de caisse");
      } else {
        toast('error', 'Imprimante non connectée — branchement requis');
      }
    } catch {
      toast('error', 'Erreur lors de la récupération de la session');
    }
    setPrintingId(null);
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <FileBarChart size={17} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Réimpression X de caisse</h2>
                <p className="text-white/40 text-xs mt-0.5 capitalize">{formatDateLabel(selectedDate)}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Date selector */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/8 flex-shrink-0 bg-white/3">
            <button
              onClick={() => shiftDate(-1)}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all flex-shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex-1 relative">
              <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                max={toDateInput(new Date())}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="w-full bg-white/8 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-all"
                style={{ colorScheme: 'dark' }}
              />
            </div>
            <button
              onClick={() => shiftDate(1)}
              disabled={selectedDate >= toDateInput(new Date())}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setSelectedDate(toDateInput(d)); }}
              disabled={selectedDate === toDateInput(new Date())}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[10px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            >
              Auj.
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ scrollbarWidth: 'thin' }}>
            {!printerConnected && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 mb-2">
                <Lock size={14} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-300 text-xs">Imprimante non connectée. Branchez l'imprimante thermique pour réimprimer.</p>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="text-white/30 animate-spin" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <FileBarChart size={24} className="text-white/20" />
                </div>
                <p className="text-white/40 text-sm font-medium">Aucune session fermée pour cette date</p>
                <p className="text-white/30 text-xs mt-1">Choisissez une autre date</p>
              </div>
            ) : (
              sessions.map((session, i) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3.5 rounded-xl border bg-white/4 border-white/8 hover:border-white/14 hover:bg-white/6 transition-all"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Lock size={15} className="text-emerald-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">
                        Session #{String(session.session_number).padStart(4, '0')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-white/50 text-xs">
                        {fmtTime(session.opened_at)} → {session.closed_at ? fmtTime(session.closed_at) : '—'}
                      </span>
                      <span className="text-white/40 text-xs">{session.sales_count} vente{session.sales_count > 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-emerald-400 font-bold text-sm">{session.total_sales.toLocaleString('fr-FR')}</p>
                    <p className="text-white/30 text-[10px]">{sym}</p>
                  </div>

                  {/* Reprint button */}
                  <motion.button
                    onClick={() => handleReprint(session)}
                    disabled={printingId === session.id || !printerConnected}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/25 hover:border-amber-500/40 text-amber-400 text-xs font-semibold transition-all flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {printingId === session.id
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Printer size={13} />
                    }
                    <span className="hidden sm:inline">X</span>
                  </motion.button>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
