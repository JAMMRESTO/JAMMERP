import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Plus, Phone, MapPin, User, CheckCircle, Save, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import type { Customer } from '../../types/database';

interface CustomerPickerModalProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  onClose: () => void;
}

type View = 'list' | 'create';

export function CustomerPickerModal({ selectedCustomer, onSelect, onClose }: CustomerPickerModalProps) {
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [view, setView] = useState<View>('list');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (view === 'list') setTimeout(() => searchRef.current?.focus(), 100);
  }, [view]);

  async function loadCustomers() {
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('name');
    if (data) setCustomers(data as Customer[]);
    setLoading(false);
  }

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.address.toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    setFormError('');
    if (!form.name.trim()) { setFormError('Le nom est requis'); return; }
    if (!form.phone.trim()) { setFormError('Le téléphone est requis'); return; }

    setSaving(true);
    const { data, error } = await supabase
      .from('customers')
      .insert({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), notes: form.notes.trim(), site_id: siteId })
      .select()
      .single();
    setSaving(false);

    if (error) {
      setFormError('Erreur lors de la création du client.');
      return;
    }

    const newCustomer = data as Customer;
    setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name)));
    onSelect(newCustomer);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            {view === 'create' && (
              <button
                onClick={() => { setView('list'); setFormError(''); setForm({ name: '', phone: '', address: '', notes: '' }); }}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
            )}
            <div>
              <h2 className="text-white font-semibold text-base">
                {view === 'list' ? 'Client — À emporter' : 'Nouveau client'}
              </h2>
              {view === 'list' && (
                <p className="text-white/40 text-xs mt-0.5">{customers.length} client(s) enregistré(s)</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
            >
              {/* Search */}
              <div className="px-4 pt-4 pb-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par nom ou téléphone..."
                    className="w-full bg-gray-800 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-xs placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                  />
                </div>
              </div>

              {/* List */}
              <div className="px-4 pb-4 max-h-[50vh] overflow-y-auto space-y-1.5" style={{ scrollbarWidth: 'none' }}>
                {loading ? (
                  <div className="space-y-2 pt-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-sm">
                    {search ? 'Aucun client trouvé' : 'Aucun client enregistré'}
                  </div>
                ) : (
                  filtered.map(customer => {
                    const isSelected = selectedCustomer?.id === customer.id;
                    return (
                      <motion.button
                        key={customer.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { onSelect(customer); onClose(); }}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                          ${isSelected
                            ? 'bg-blue-600/15 border-blue-500/40'
                            : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15'}`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm
                          ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-white/8 text-white/50'}`}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm truncate ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                            {customer.name}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-white/40 text-[11px]">
                              <Phone size={9} /> {customer.phone}
                            </span>
                            {customer.address && (
                              <span className="flex items-center gap-1 text-white/30 text-[11px] truncate">
                                <MapPin size={9} /> {customer.address}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <CheckCircle size={15} className="text-blue-400 flex-shrink-0" />}
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 pb-4 border-t border-white/8 pt-3 flex gap-2">
                {selectedCustomer && (
                  <button
                    onClick={() => { onSelect(null); onClose(); }}
                    className="flex-1 py-2.5 rounded-xl text-white/40 hover:text-white/70 text-xs font-medium hover:bg-white/5 transition-all border border-white/8 hover:border-white/15"
                  >
                    Sans client
                  </button>
                )}
                <button
                  onClick={() => setView('create')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-lg shadow-blue-600/20"
                >
                  <Plus size={13} /> Nouveau client
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.15 }}
              className="p-5 space-y-3"
            >
              {/* Name */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 flex items-center gap-1.5">
                  <User size={11} /> Nom complet *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Prénom Nom"
                  autoFocus
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 flex items-center gap-1.5">
                  <Phone size={11} /> Téléphone *
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+221 77 000 00 00"
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Address */}
              <div>
                <label className="text-white/50 text-xs mb-1.5 flex items-center gap-1.5">
                  <MapPin size={11} /> Adresse
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Quartier, rue, numéro..."
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-blue-500/50 transition-all"
                />
              </div>

              {/* Error */}
              {formError && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              {/* Save */}
              <button
                onClick={handleCreate}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20 mt-1"
              >
                <Save size={14} />
                {saving ? 'Enregistrement...' : 'Créer le client'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
