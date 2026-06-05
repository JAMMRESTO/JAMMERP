import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, RotateCcw, Loader2, Utensils, Package, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';
import type { Sale } from '../../types/database';

const saleTypeLabels: Record<string, { label: string; icon: typeof Utensils; color: string }> = {
  dine_in:  { label: 'Sur place',        icon: Utensils, color: 'text-blue-400' },
  takeaway: { label: 'Commandes client', icon: Package,  color: 'text-emerald-400' },
  delivery: { label: 'Vente directe',    icon: Truck,    color: 'text-amber-400' },
};

interface PendingTicketsModalProps {
  onClose: () => void;
  onResumed: () => void;
}

export function PendingTicketsModal({ onClose, onResumed }: PendingTicketsModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { loadPendingSale } = usePOS();
  const { settings } = useSettings();
  const sym = settings.currency_symbol;
  const [tickets, setTickets] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumingId, setResumingId] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    setLoading(true);
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('site_id', siteId)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    setTickets((data ?? []) as Sale[]);
    setLoading(false);
  }

  async function handleResume(saleId: string) {
    setResumingId(saleId);
    await loadPendingSale(saleId);
    setResumingId(null);
    onResumed();
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
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
          className="w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                <Clock size={17} className="text-amber-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Tickets en attente</h2>
                <p className="text-white/40 text-xs mt-0.5">{tickets.length} ticket{tickets.length > 1 ? 's' : ''} à encaisser</p>
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
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
                  <Clock size={24} className="text-white/20" />
                </div>
                <p className="text-white/40 text-sm font-medium">Aucun ticket en attente</p>
                <p className="text-white/20 text-xs mt-1">Les tickets différés apparaîtront ici</p>
              </div>
            ) : (
              tickets.map((ticket, i) => {
                const cfg = saleTypeLabels[ticket.sale_type] ?? saleTypeLabels.delivery;
                const Icon = cfg.icon;
                const isResuming = resumingId === ticket.id;
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-white/4 border border-white/8 hover:border-white/14 hover:bg-white/6 transition-all"
                  >
                    {/* Type icon */}
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className={cfg.color} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm">
                          #{ticket.sale_number.toString().padStart(4, '0')}
                        </span>
                        <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                        {ticket.table_number && (
                          <span className="text-white/40 text-[10px]">· Table {ticket.table_number}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {ticket.customer_name && (
                          <span className="text-white/50 text-xs truncate">{ticket.customer_name}</span>
                        )}
                        <span className="text-white/25 text-[10px] flex-shrink-0">
                          {formatDate(ticket.created_at)} à {formatTime(ticket.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="text-right flex-shrink-0 mr-2">
                      <p className="text-white font-bold text-sm">{ticket.total.toLocaleString('fr-FR')}</p>
                      <p className="text-white/30 text-[10px]">{sym}</p>
                    </div>

                    {/* Resume button */}
                    <motion.button
                      onClick={() => handleResume(ticket.id)}
                      disabled={isResuming || resumingId !== null}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold transition-all flex-shrink-0"
                    >
                      {isResuming ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      <span className="hidden sm:inline">Reprendre</span>
                    </motion.button>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
