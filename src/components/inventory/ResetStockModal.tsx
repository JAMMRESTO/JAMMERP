import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/Toast';

interface ResetStockModalProps {
  siteId: string;
  onClose: () => void;
  onDone: () => void;
}

interface ResetResult {
  products_reset: number;
  components_reset: number;
}

export function ResetStockModal({ siteId, onClose, onDone }: ResetStockModalProps) {
  const toast = useToast();
  const [resetting, setResetting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = confirmText.trim().toUpperCase() === 'RESET';

  async function handleConfirm() {
    if (!canConfirm) return;
    setResetting(true);
    const { data, error } = await supabase.rpc('reset_site_stock', { p_site_id: siteId });
    setResetting(false);

    const result = data as ResetResult | null;
    if (error || !result) {
      toast('error', 'Impossible de remettre le stock à zéro');
      return;
    }

    toast('success', `Stock remis à zéro : ${result.products_reset} produit(s), ${result.components_reset} composant(s)`);
    onDone();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 space-y-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Remettre tout le stock à zéro</h3>
              <p className="text-white/50 text-sm mt-1">
                Le stock de tous les produits suivis et de tous les composants de ce site passera à 0.
                Chaque remise à zéro est enregistrée dans l'historique des mouvements.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-xs font-medium block mb-1.5">
              Pour confirmer, tapez <span className="text-red-400 font-bold">RESET</span> ci-dessous
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-red-500/40 transition-all uppercase"
              disabled={resetting}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} disabled={resetting} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition-all disabled:opacity-40">
              Annuler
            </button>
            <button type="button" onClick={handleConfirm} disabled={!canConfirm || resetting} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {resetting && <Loader2 size={14} className="animate-spin" />}
              Confirmer la remise à zéro
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
