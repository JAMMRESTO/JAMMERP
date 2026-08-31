import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Check, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../ui/Toast';
import { useRealtimeTable } from '../../lib/useRealtimeTable';
import type { Sauce } from '../../types/database';

interface SauceManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function SauceManagerModal({ open, onClose }: SauceManagerModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const toast = useToast();
  const [sauces, setSauces] = useState<Sauce[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sauce | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const { data } = await supabase
      .from('sauces')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order')
      .order('name');
    if (data) setSauces(data as Sauce[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useRealtimeTable<Sauce>({
    table: 'sauces',
    siteId,
    onInsert: (row) => setSauces(s => s.some(x => x.id === row.id) ? s : [...s, row].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))),
    onUpdate: (row) => setSauces(s => s.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setSauces(s => s.filter(x => x.id !== row.id)),
  });

  async function handleToggleActive(s: Sauce) {
    await supabase.from('sauces').update({ is_active: !s.is_active, updated_at: new Date().toISOString() }).eq('id', s.id);
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette sauce ?')) return;
    const { error } = await supabase.from('sauces').delete().eq('id', id);
    if (error) { toast('error', 'Suppression impossible'); return; }
    toast('success', 'Sauce supprimée');
  }

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="glass-card rounded-2xl border border-white/10 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div>
              <h2 className="text-white font-semibold text-lg">Catalogue des sauces</h2>
              <p className="text-white/40 text-xs">Sauces incluses proposées pour vos produits</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/8 text-white/50 hover:text-white/90 transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {loading ? (
              <div className="py-12 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
              </div>
            ) : sauces.length === 0 && !showForm ? (
              <div className="py-12 text-center">
                <p className="text-white/40 text-sm">Aucune sauce enregistrée</p>
                <button
                  onClick={() => { setEditing(null); setShowForm(true); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <Plus size={14} /> Ajouter une sauce
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {sauces.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${s.is_active ? 'bg-white/3 border-white/8' : 'bg-white/2 border-white/5 opacity-60'}`}
                  >
                    <GripVertical size={14} className="text-white/20 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{s.name}</p>
                    </div>
                    <button
                      onClick={() => handleToggleActive(s)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${s.is_active ? 'bg-emerald-500' : 'bg-white/10'}`}
                      title={s.is_active ? 'Désactiver' : 'Activer'}
                    >
                      <motion.div animate={{ x: s.is_active ? 16 : 2 }} className="absolute top-1 w-3 h-3 bg-white rounded-full" />
                    </button>
                    <button
                      onClick={() => { setEditing(s); setShowForm(true); }}
                      className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-5 py-3 border-t border-white/8 flex items-center justify-between">
            <span className="text-white/40 text-xs">{sauces.length} sauce{sauces.length > 1 ? 's' : ''}</span>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Nouvelle sauce
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <SauceFormModal
              sauce={editing}
              siteId={siteId}
              onClose={() => setShowForm(false)}
              onSaved={() => { setShowForm(false); }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

interface SauceFormModalProps {
  sauce: Sauce | null;
  siteId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function SauceFormModal({ sauce, siteId, onClose, onSaved }: SauceFormModalProps) {
  const toast = useToast();
  const [name, setName] = useState(sauce?.name ?? '');
  const [isActive, setIsActive] = useState(sauce?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId) return;
    const trimmed = name.trim();
    if (!trimmed) { toast('error', 'Le nom est requis'); return; }
    setSaving(true);
    const payload = {
      site_id: siteId,
      name: trimmed,
      price_supplement: 0,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    const { error } = sauce
      ? await supabase.from('sauces').update(payload).eq('id', sauce.id)
      : await supabase.from('sauces').insert(payload);
    setSaving(false);
    if (error) { toast('error', 'Enregistrement impossible'); return; }
    toast('success', sauce ? 'Sauce modifiée' : 'Sauce ajoutée');
    onSaved();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.form
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        className="glass-card rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">{sauce ? 'Modifier la sauce' : 'Nouvelle sauce'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-white/50 hover:text-white/90 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div>
          <label className="text-white/60 text-sm font-medium block mb-1.5">Nom</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="Ex: Mayonnaise, Ketchup..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
          />
        </div>
        <label className="flex items-center gap-3 py-1 cursor-pointer">
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-white/10'}`}
          >
            <motion.div animate={{ x: isActive ? 20 : 2 }} className="absolute top-1 w-4 h-4 bg-white rounded-full" />
          </button>
          <span className="text-white/80 text-sm">Sauce active</span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors">
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            {saving ? '...' : <><Check size={14} /> Enregistrer</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
