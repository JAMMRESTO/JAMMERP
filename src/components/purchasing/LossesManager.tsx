import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save, Loader2, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Loss, Product, Ingredient, LossReason } from '../../types/database';

interface Props {
  losses: Loss[];
  products: Product[];
  ingredients: Ingredient[];
  siteId: string | null;
  onRefresh: () => void;
}

const REASON_CONFIG: Record<LossReason, { label: string; color: string }> = {
  breakage: { label: 'Casse', color: 'text-red-400 bg-red-500/10' },
  expiry: { label: 'Peremption', color: 'text-amber-400 bg-amber-500/10' },
  production_error: { label: 'Erreur production', color: 'text-orange-400 bg-orange-500/10' },
  other: { label: 'Autre', color: 'text-white/50 bg-white/[0.05]' },
};

type Period = 'day' | 'week' | 'month';

export function LossesManager({ losses, products, ingredients, siteId, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState<Period>('week');

  // Form state
  const [itemType, setItemType] = useState<'product' | 'ingredient'>('product');
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<LossReason>('breakage');
  const [notes, setNotes] = useState('');

  const filteredLosses = useMemo(() => {
    const now = new Date();
    let cutoff: Date;
    if (period === 'day') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    return losses.filter(l => new Date(l.declared_at) >= cutoff);
  }, [losses, period]);

  const totalLossCost = filteredLosses.reduce((sum, l) => sum + Number(l.total_cost), 0);
  const lossByReason = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLosses.forEach(l => {
      map[l.reason] = (map[l.reason] || 0) + Number(l.total_cost);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredLosses]);

  async function handleDeclare() {
    if (!siteId || !selectedId || quantity <= 0) return;
    setSaving(true);

    let itemName = '';
    let unit = 'pcs';
    let unitCost = 0;

    if (itemType === 'product') {
      const prod = products.find(p => p.id === selectedId);
      if (prod) {
        itemName = prod.name;
        unit = prod.unit || 'pcs';
        unitCost = prod.cost_price || 0;
        if (prod.track_stock) {
          await supabase.from('products').update({ stock: Math.max(0, (prod.stock || 0) - quantity) }).eq('id', prod.id);
        }
      }
    } else {
      const ing = ingredients.find(i => i.id === selectedId);
      if (ing) {
        itemName = ing.name;
        unit = ing.unit;
        unitCost = Number(ing.cost_per_unit);
        await supabase.from('ingredients').update({ stock: Math.max(0, Number(ing.stock) - quantity) }).eq('id', ing.id);
      }
    }

    await supabase.from('losses').insert({
      site_id: siteId,
      product_id: itemType === 'product' ? selectedId : null,
      ingredient_id: itemType === 'ingredient' ? selectedId : null,
      item_name: itemName,
      quantity,
      unit,
      unit_cost: unitCost,
      total_cost: unitCost * quantity,
      reason,
      notes: notes.trim() || null,
    });

    setSaving(false);
    setShowForm(false);
    setSelectedId('');
    setQuantity(1);
    setNotes('');
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5">
          {([['day', 'Aujourd\'hui'], ['week', '7 jours'], ['month', '30 jours']] as [Period, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                period === id ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:text-white/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors">
          <Plus size={13} /> Declarer une perte
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-400" />
            <span className="text-white/40 text-[10px] uppercase tracking-wider">Total pertes</span>
          </div>
          <p className="text-white font-bold text-xl">{totalLossCost.toLocaleString('fr-FR')} F</p>
          <p className="text-white/30 text-[10px]">{filteredLosses.length} declaration{filteredLosses.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 sm:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-400" />
            <span className="text-white/40 text-[10px] uppercase tracking-wider">Par motif</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lossByReason.map(([r, cost]) => {
              const cfg = REASON_CONFIG[r as LossReason] || REASON_CONFIG.other;
              return (
                <span key={r} className={`px-2 py-1 rounded text-[10px] font-medium ${cfg.color}`}>
                  {cfg.label}: {cost.toLocaleString('fr-FR')} F
                </span>
              );
            })}
            {lossByReason.length === 0 && <span className="text-white/20 text-[10px]">Aucune perte sur cette periode</span>}
          </div>
        </div>
      </div>

      {/* Losses list */}
      {filteredLosses.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <TrendingDown size={28} className="text-amber-400" />
          </div>
          <p className="text-white/70 text-sm font-medium">Aucune perte declaree</p>
          <p className="text-white/40 text-xs mt-1.5 max-w-xs mx-auto">Declarez les pertes (casse, peremption, erreurs) pour suivre et reduire le gaspillage.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLosses.map(loss => {
            const cfg = REASON_CONFIG[loss.reason as LossReason] || REASON_CONFIG.other;
            return (
              <div key={loss.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-white font-medium text-xs">{loss.item_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-white/30 text-[10px] flex items-center gap-1">
                        <Calendar size={9} />
                        {new Date(loss.declared_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-medium text-xs">-{Number(loss.total_cost).toLocaleString('fr-FR')} F</p>
                  <p className="text-white/30 text-[10px]">{Number(loss.quantity)} {loss.unit}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Declare Loss Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">Declarer une perte</h3>
                <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/60"><X size={16} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Type d'article</label>
                  <div className="flex gap-2">
                    <button onClick={() => { setItemType('product'); setSelectedId(''); }} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${itemType === 'product' ? 'bg-white/[0.08] text-white' : 'bg-white/[0.03] text-white/40'}`}>Produit</button>
                    <button onClick={() => { setItemType('ingredient'); setSelectedId(''); }} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${itemType === 'ingredient' ? 'bg-white/[0.08] text-white' : 'bg-white/[0.03] text-white/40'}`}>Ingredient</button>
                  </div>
                </div>

                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Article *</label>
                  <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40">
                    <option value="">Selectionner...</option>
                    {itemType === 'product'
                      ? products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                      : ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)
                    }
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-[10px] font-medium block mb-1">Quantite *</label>
                    <input type="number" min={0.01} step={0.01} value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] font-medium block mb-1">Motif *</label>
                    <select value={reason} onChange={e => setReason(e.target.value as LossReason)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40">
                      {Object.entries(REASON_CONFIG).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 resize-none" placeholder="Details supplementaires..." />
                </div>
              </div>

              <button onClick={handleDeclare} disabled={saving || !selectedId || quantity <= 0} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Declarer la perte
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
