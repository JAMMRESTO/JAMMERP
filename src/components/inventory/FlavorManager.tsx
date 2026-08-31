import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Pencil, Trash2, Check, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../ui/Toast';
import { useRealtimeTable } from '../../lib/useRealtimeTable';
import type { Flavor } from '../../types/database';

interface FlavorManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export function FlavorManagerModal({ open, onClose }: FlavorManagerModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const toast = useToast();
  const [flavors, setFlavors] = useState<Flavor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Flavor | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!siteId) return;
    setLoading(true);
    const { data } = await supabase
      .from('flavors')
      .select('*')
      .eq('site_id', siteId)
      .order('sort_order')
      .order('name');
    if (data) setFlavors(data as Flavor[]);
    setLoading(false);
  }, [siteId]);

  useEffect(() => { if (open) load(); }, [open, load]);

  useRealtimeTable<Flavor>({
    table: 'flavors',
    siteId,
    onInsert: (row) => setFlavors(s => s.some(x => x.id === row.id) ? s : [...s, row].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))),
    onUpdate: (row) => setFlavors(s => s.map(x => x.id === row.id ? row : x)),
    onDelete: (row) => setFlavors(s => s.filter(x => x.id !== row.id)),
  });

  async function handleToggleActive(f: Flavor) {
    await supabase.from('flavors').update({ is_active: !f.is_active, updated_at: new Date().toISOString() }).eq('id', f.id);
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce gout ?')) return;
    const { error } = await supabase.from('flavors').delete().eq('id', id);
    if (error) { toast('error', 'Suppression impossible'); return; }
    toast('success', 'Gout supprimé');
  }

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 safe-pt safe-pb safe-pl safe-pr"
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
              <h2 className="text-white font-semibold text-lg">Catalogue des gouts</h2>
              <p className="text-white/40 text-xs">Gouts proposés pour vos produits</p>
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
            ) : flavors.length === 0 && !showForm ? (
              <div className="py-12 text-center">
                <p className="text-white/40 text-sm">Aucun gout enregistré</p>
                <button
                  onClick={() => { setEditing(null); setShowForm(true); }}
                  className="mt-3 inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <Plus size={14} /> Ajouter un gout
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {flavors.map(f => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${f.is_active ? 'bg-white/3 border-white/8' : 'bg-white/2 border-white/5 opacity-60'}`}
                  >
                    <GripVertical size={14} className="text-white/20 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{f.name}</p>
                    </div>
                    <button
                      onClick={() => handleToggleActive(f)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${f.is_active ? 'bg-emerald-500' : 'bg-white/10'}`}
                      title={f.is_active ? 'Désactiver' : 'Activer'}
                    >
                      <motion.div animate={{ x: f.is_active ? 16 : 2 }} className="absolute top-1 w-3 h-3 bg-white rounded-full" />
                    </button>
                    <button
                      onClick={() => { setEditing(f); setShowForm(true); }}
                      className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/80 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
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
            <span className="text-white/40 text-xs">{flavors.length} gout{flavors.length > 1 ? 's' : ''}</span>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Nouveau gout
            </button>
          </div>
        </motion.div>

        <AnimatePresence>
          {showForm && (
            <FlavorFormModal
              flavor={editing}
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

interface FlavorFormModalProps {
  flavor: Flavor | null;
  siteId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function FlavorFormModal({ flavor, siteId, onClose, onSaved }: FlavorFormModalProps) {
  const toast = useToast();
  const [name, setName] = useState(flavor?.name ?? '');
  const [isActive, setIsActive] = useState(flavor?.is_active ?? true);
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
    const { error } = flavor
      ? await supabase.from('flavors').update(payload).eq('id', flavor.id)
      : await supabase.from('flavors').insert(payload);
    setSaving(false);
    if (error) { toast('error', 'Enregistrement impossible'); return; }
    toast('success', flavor ? 'Gout modifié' : 'Gout ajouté');
    onSaved();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 safe-pt safe-pb safe-pl safe-pr"
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
          <h3 className="text-white font-semibold">{flavor ? 'Modifier le gout' : 'Nouveau gout'}</h3>
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
            placeholder="Ex: Piquant, Nature, BBQ..."
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
          <span className="text-white/80 text-sm">Gout actif</span>
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
