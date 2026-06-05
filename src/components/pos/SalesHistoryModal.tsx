import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Receipt, Loader2, Utensils, Package, Truck, Ban, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';
import { AdminPinModal } from './AdminPinModal';
import type { Sale, UserWithRole } from '../../types/database';

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

interface SalesHistoryModalProps {
  onClose: () => void;
}

export function SalesHistoryModal({ onClose }: SalesHistoryModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { cancelSale } = usePOS();
  const { settings } = useSettings();
  const sym = settings.currency_symbol;

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);
    setSales((data ?? []) as Sale[]);
    setLoading(false);
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
                  <h2 className="text-white font-bold text-base">Ventes du jour</h2>
                  <p className="text-white/40 text-xs mt-0.5">{sales.length} vente{sales.length > 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
              >
                <X size={16} />
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
                  <p className="text-white/40 text-sm font-medium">Aucune vente aujourd'hui</p>
                </div>
              ) : (
                sales.map((sale, i) => {
                  const cfg = saleTypeLabels[sale.sale_type] ?? saleTypeLabels.delivery;
                  const Icon = cfg.icon;
                  const stCfg = statusLabels[sale.status] ?? statusLabels.paid;
                  const isCancelled = sale.status === 'cancelled';
                  const justCancelled = cancelSuccess === sale.id;

                  return (
                    <motion.div
                      key={sale.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all
                        ${isCancelled ? 'bg-red-500/5 border-red-500/15 opacity-70' : 'bg-white/4 border-white/8 hover:border-white/14 hover:bg-white/6'}
                        ${justCancelled ? 'ring-2 ring-red-500/40' : ''}`}
                    >
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
                      <div className="text-right flex-shrink-0 mr-2">
                        <p className={`font-bold text-sm ${isCancelled ? 'text-white/30 line-through' : 'text-white'}`}>
                          {sale.total.toLocaleString('fr-FR')}
                        </p>
                        <p className="text-white/30 text-[10px]">{sym}</p>
                      </div>

                      {/* Cancel button */}
                      {!isCancelled && (
                        <motion.button
                          onClick={() => setCancelTarget(sale)}
                          whileTap={{ scale: 0.95 }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600/15 hover:bg-red-600/25 border border-red-500/25 hover:border-red-500/40 text-red-400 text-xs font-semibold transition-all flex-shrink-0"
                        >
                          <Ban size={13} />
                          <span className="hidden sm:inline">Annuler</span>
                        </motion.button>
                      )}

                      {justCancelled && (
                        <div className="flex items-center gap-1 text-red-400 text-xs">
                          <CheckCircle2 size={14} />
                        </div>
                      )}
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
