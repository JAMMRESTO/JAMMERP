import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Loader2, Utensils, Package, Truck, Ban, CheckCircle2, Printer, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';
import { usePrinter } from '../../context/PrinterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/Toast';
import { AdminPinModal } from './AdminPinModal';
import { printReceipt, printCancelledReceipt, type EscposReceiptData, type EscposCancelledReceiptData } from '../../lib/escpos';
import { buildSaleReceiptHtml, buildCancelledReceiptHtml, printViaIframe } from '../../lib/printUtils';
import type { Sale, SaleItem, Payment, UserWithRole } from '../../types/database';

const saleTypeLabels: Record<string, { label: string; icon: typeof Utensils; color: string }> = {
  dine_in:  { label: 'Sur place',        icon: Utensils, color: 'text-blue-400' },
  takeaway: { label: 'Commandes client', icon: Package,  color: 'text-emerald-400' },
  delivery: { label: 'Vente directe',    icon: Truck,    color: 'text-amber-400' },
};

const statusLabels: Record<string, { label: string; color: string }> = {
  paid:      { label: 'Payé',     color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' },
  open:      { label: 'En cours', color: 'text-amber-400 bg-amber-500/15 border-amber-500/25' },
  cancelled: { label: 'Annulé',   color: 'text-red-400 bg-red-500/15 border-red-500/25' },
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte',
};

interface SalesHistoryModalProps {
  onClose: () => void;
}

interface SaleDetails {
  items: SaleItem[];
  payments: Payment[];
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function SalesHistoryModal({ onClose }: SalesHistoryModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { cancelSale } = usePOS();
  const { settings } = useSettings();
  const { connected: printerConnected } = usePrinter();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const sym = settings.currency_symbol;

  const isAdmin = !!currentUser?.role?.permissions?.all;

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [saleDetails, setSaleDetails] = useState<Record<string, SaleDetails>>({});
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return toDateInput(d);
  });

  const loadSales = useCallback(async (dateStr: string) => {
    if (!siteId) return;
    setLoading(true);
    const start = new Date(dateStr + 'T00:00:00');
    const end = new Date(dateStr + 'T23:59:59.999');
    let query = supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (!isAdmin && currentUser?.id) {
      query = query.eq('cashier_id', currentUser.id);
    }

    const { data } = await query
      .order('created_at', { ascending: false })
      .limit(100);

    const loadedSales = (data ?? []) as Sale[];
    setSales(loadedSales);
    setSaleDetails({});

    if (loadedSales.length > 0) {
      const saleIds = loadedSales.map(sale => sale.id);
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from('sale_items').select('*').eq('site_id', siteId).in('sale_id', saleIds),
        supabase.from('payments').select('*').eq('site_id', siteId).in('sale_id', saleIds),
      ]);

      const details: Record<string, SaleDetails> = {};
      for (const sale of loadedSales) {
        details[sale.id] = {
          items: ((itemsRes.data ?? []).filter(item => item.sale_id === sale.id)) as SaleItem[],
          payments: ((paymentsRes.data ?? []).filter(payment => payment.sale_id === sale.id)) as Payment[],
        };
      }
      setSaleDetails(details);
    }

    setLoading(false);
  }, [siteId, isAdmin, currentUser?.id]);

  useEffect(() => {
    loadSales(selectedDate);
  }, [loadSales, selectedDate]);

  function shiftDate(days: number) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toDateInput(d));
  }

  function formatDateLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.getTime() === today.getTime()) return "Aujourd'hui";
    if (d.getTime() === yesterday.getTime()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  async function handleCancelConfirm(admin: UserWithRole, reason: string) {
    if (!cancelTarget) return;
    const ok = await cancelSale(cancelTarget.id, admin.id, admin.name, reason);
    if (ok) {
      setSales(prev => prev.map(s =>
        s.id === cancelTarget.id
          ? { ...s, status: 'cancelled' as const, cancelled_by: admin.id, cancelled_by_name: admin.name, cancelled_at: new Date().toISOString(), cancel_reason: reason }
          : s
      ));
      setCancelSuccess(cancelTarget.id);
      setTimeout(() => setCancelSuccess(null), 2000);
    }
    setCancelTarget(null);
  }

  async function handleReprint(sale: Sale) {
    setPrintingId(sale.id);
    try {
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from('sale_items').select('*').eq('sale_id', sale.id).eq('site_id', siteId),
        supabase.from('payments').select('*').eq('sale_id', sale.id).eq('site_id', siteId),
      ]);
      const items = (itemsRes.data ?? []) as SaleItem[];
      const payments = (paymentsRes.data ?? []) as Payment[];

      const receiptData: EscposReceiptData = {
        saleNumber: sale.sale_number.toString(),
        createdAt: sale.created_at,
        saleType: sale.sale_type,
        tableNumber: sale.table_number || null,
        cashierName: sale.customer_name || null,
        customerName: sale.customer_name || null,
        items: items.map(i => ({
          quantity: i.quantity,
          product_name: i.product_name,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
          variant_label: i.variant_label || null,
          sauces: i.sauces ?? [],
          flavors: i.flavors ?? [],
        })),
        payments: payments.map(p => ({ method: p.method, amount: p.amount })),
        subtotal: sale.subtotal,
        taxAmount: sale.tax_amount,
        discountAmount: sale.discount_amount,
        total: sale.total,
      };

      if (printerConnected) {
        const ok = await printReceipt(receiptData, settings);
        if (ok) toast('success', 'Ticket réimprimé');
        else toast('error', "Échec de l'impression");
      } else {
        const html = buildSaleReceiptHtml(receiptData, settings);
        printViaIframe(html);
        toast('success', 'Ticket envoyé vers le navigateur');
      }
    } catch {
      toast('error', 'Erreur lors de la récupération du ticket');
    }
    setPrintingId(null);
  }

  async function handlePrintCancelled(sale: Sale) {
    setPrintingId(sale.id);
    try {
      const [itemsRes, paymentsRes] = await Promise.all([
        supabase.from('sale_items').select('*').eq('sale_id', sale.id).eq('site_id', siteId),
        supabase.from('payments').select('*').eq('sale_id', sale.id).eq('site_id', siteId),
      ]);
      const items = (itemsRes.data ?? []) as SaleItem[];
      const payments = (paymentsRes.data ?? []) as Payment[];

      const receiptData: EscposCancelledReceiptData = {
        saleNumber: sale.sale_number.toString(),
        createdAt: sale.created_at,
        saleType: sale.sale_type,
        tableNumber: sale.table_number || null,
        cashierName: sale.customer_name || null,
        customerName: sale.customer_name || null,
        items: items.map(i => ({
          quantity: i.quantity,
          product_name: i.product_name,
          unit_price: i.unit_price,
          subtotal: i.subtotal,
          variant_label: i.variant_label || null,
          sauces: i.sauces ?? [],
          flavors: i.flavors ?? [],
        })),
        payments: payments.map(p => ({ method: p.method, amount: p.amount })),
        subtotal: sale.subtotal,
        taxAmount: sale.tax_amount,
        discountAmount: sale.discount_amount,
        total: sale.total,
        cancelledByName: sale.cancelled_by_name || null,
        cancelledAt: sale.cancelled_at || null,
        cancelReason: sale.cancel_reason || null,
      };

      if (printerConnected) {
        const ok = await printCancelledReceipt(receiptData, settings);
        if (!ok) {
          toast('error', 'Erreur impression ticket annulé');
        }
      } else {
        const html = buildCancelledReceiptHtml(receiptData, settings);
        printViaIframe(html);
      }
    } catch {
      toast('error', 'Erreur lors de la récupération du ticket');
    }
    setPrintingId(null);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <>
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
            className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                  <Receipt size={17} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Historique des ventes</h2>
                  <p className="text-white/40 text-xs mt-0.5 capitalize">
                    {formatDateLabel(selectedDate)} · {sales.length} vente{sales.length > 1 ? 's' : ''}
                    {isAdmin ? ' · Toutes les ventes' : ' · Mes ventes'}
                  </p>
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
                  className="w-full bg-white/8 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/40 transition-all"
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
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="text-white/30 animate-spin" />
                </div>
              ) : sales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                    <Receipt size={24} className="text-white/20" />
                  </div>
                  <p className="text-white/40 text-sm font-medium">Aucune vente pour cette date</p>
                </div>
              ) : (
                sales.map((sale, i) => {
                  const cfg = saleTypeLabels[sale.sale_type] ?? saleTypeLabels.delivery;
                  const Icon = cfg.icon;
                  const stCfg = statusLabels[sale.status] ?? statusLabels.paid;
                  const isCancelled = sale.status === 'cancelled';
                  const justCancelled = cancelSuccess === sale.id;
                  const isPaid = sale.status === 'paid';
                  const details = saleDetails[sale.id];

                  return (
                    <motion.div
                      key={sale.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`rounded-xl border transition-all overflow-hidden
                        ${isCancelled ? 'bg-red-500/5 border-red-500/15' : 'bg-white/4 border-white/8 hover:border-white/14'}
                        ${justCancelled ? 'ring-2 ring-red-500/40' : ''}`}
                    >
                      {/* Row */}
                      <div className="flex items-center gap-3 p-3.5">
                        {/* Type icon */}
                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Icon size={16} className={cfg.color} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold text-sm">
                              #{sale.sale_number.toString().padStart(4, '0')}
                            </span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${stCfg.color}`}>
                              {stCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {sale.customer_name && (
                              <span className="text-white/50 text-xs truncate">{sale.customer_name}</span>
                            )}
                            <span className="text-white/25 text-[10px] flex-shrink-0">
                              {formatTime(sale.created_at)}
                            </span>
                            {isCancelled && sale.cancel_reason && (
                              <span className="text-red-400/60 text-[10px] truncate">
                                {sale.cancel_reason}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Total */}
                        <div className="text-right flex-shrink-0 mr-1">
                          <p className={`font-bold text-sm ${isCancelled ? 'text-white/30 line-through' : 'text-white'}`}>
                            {sale.total.toLocaleString('fr-FR')}
                          </p>
                          <p className="text-white/30 text-[10px]">{sym}</p>
                        </div>

                        {/* Reprint button (paid) */}
                        {isPaid && (
                          <motion.button
                            onClick={() => handleReprint(sale)}
                            disabled={printingId === sale.id}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/25 hover:border-blue-500/40 text-blue-400 text-xs font-semibold transition-all flex-shrink-0 disabled:opacity-40"
                            title="Réimprimer le ticket"
                          >
                            {printingId === sale.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Printer size={13} />
                            }
                          </motion.button>
                        )}

                        {/* Cancel button */}
                        {!isCancelled && (
                          <motion.button
                            onClick={() => setCancelTarget(sale)}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/25 hover:border-red-500/40 text-red-400 text-xs font-semibold transition-all flex-shrink-0"
                            title="Annuler la vente"
                          >
                            <Ban size={13} />
                          </motion.button>
                        )}

                        {/* Print cancelled ticket button */}
                        {isCancelled && (
                          <motion.button
                            onClick={() => handlePrintCancelled(sale)}
                            disabled={printingId === sale.id}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/90 text-xs font-medium transition-all flex-shrink-0 disabled:opacity-40"
                            title="Imprimer le ticket annulé"
                          >
                            {printingId === sale.id
                              ? <Loader2 size={13} className="animate-spin" />
                              : <Printer size={13} />
                            }
                          </motion.button>
                        )}

                        {justCancelled && (
                          <div className="flex items-center gap-1 text-red-400 text-xs">
                            <CheckCircle2 size={14} />
                          </div>
                        )}
                      </div>

                      {/* Sale details shown by default */}
                      <div className="border-t border-white/6 p-3 bg-black/20 space-y-1.5">
                        {details?.items && details.items.length > 0 ? (
                          details.items.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2 py-1.5 px-2 rounded-lg bg-white/3">
                              <span className="text-white/50 text-xs font-mono flex-shrink-0 w-8">{item.quantity}x</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white/80 text-xs font-medium">{item.product_name}</p>
                                {item.variant_label && <p className="text-white/40 text-[10px] mt-0.5">{item.variant_label}</p>}
                                {item.sauces && item.sauces.length > 0 && (
                                  <p className="text-white/40 text-[10px] mt-0.5">Sauces: {item.sauces.map(s => s.name).join(', ')}</p>
                                )}
                                {item.flavors && item.flavors.length > 0 && (
                                  <p className="text-white/40 text-[10px] mt-0.5">Goûts: {item.flavors.map(f => f.name).join(', ')}</p>
                                )}
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-white/60 text-xs">{item.unit_price.toLocaleString('fr-FR')} {sym}</p>
                                <p className="text-white/80 text-xs font-semibold">{item.subtotal.toLocaleString('fr-FR')} {sym}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-white/30 text-xs text-center py-2">Aucun article</p>
                        )}

                        {details?.payments && details.payments.length > 0 && (
                          <div className="pt-2 mt-1 border-t border-white/6">
                            <p className="text-white/40 text-[10px] font-medium mb-1.5 px-2">Paiements</p>
                            {details.payments.map((payment, idx) => (
                              <div key={idx} className="flex items-center justify-between px-2 py-1">
                                <span className="text-white/50 text-[11px]">{paymentMethodLabels[payment.method] ?? payment.method}</span>
                                <span className="text-white/70 text-[11px] font-medium">{payment.amount.toLocaleString('fr-FR')} {sym}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 mt-1 border-t border-white/6 px-2 space-y-1">
                          {sale.discount_amount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-white/40 text-[11px]">Sous-total</span>
                              <span className="text-white/60 text-[11px]">{sale.subtotal.toLocaleString('fr-FR')} {sym}</span>
                            </div>
                          )}
                          {sale.discount_amount > 0 && (
                            <div className="flex justify-between">
                              <span className="text-white/40 text-[11px]">Remise</span>
                              <span className="text-red-400/80 text-[11px]">-{sale.discount_amount.toLocaleString('fr-FR')} {sym}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-white/40 text-[11px]">TVA ({settings.tax_rate}%)</span>
                            <span className="text-white/60 text-[11px]">{sale.tax_amount.toLocaleString('fr-FR')} {sym}</span>
                          </div>
                          <div className="flex justify-between font-bold pt-1 border-t border-white/6">
                            <span className="text-white/70 text-xs">Total</span>
                            <span className="text-white text-xs">{sale.total.toLocaleString('fr-FR')} {sym}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Admin PIN modal */}
      <AnimatePresence>
        {cancelTarget && (
          <AdminPinModal
            title="Annulation de ticket"
            description={`Annuler le ticket #${cancelTarget.sale_number} (${cancelTarget.total.toLocaleString('fr-FR')} ${sym})`}
            onConfirm={handleCancelConfirm}
            onClose={() => setCancelTarget(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
