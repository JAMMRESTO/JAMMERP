import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Phone, Mail, MapPin, Edit2, Trash2, X, Save, Loader2, User, TrendingUp, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Supplier, PurchaseOrder, SupplierInvoice } from '../../types/database';

interface Props {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  invoices: SupplierInvoice[];
  siteId: string | null;
  onRefresh: () => void;
}

export function SuppliersManager({ suppliers, orders, invoices, siteId, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const filtered = suppliers.filter(s =>
    s.is_active && (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_name || '').toLowerCase().includes(search.toLowerCase())
    )
  );

  function openForm(supplier?: Supplier) {
    if (supplier) {
      setEditing(supplier);
      setName(supplier.name);
      setContactName(supplier.contact_name || '');
      setPhone(supplier.phone || '');
      setEmail(supplier.email || '');
      setAddress(supplier.address || '');
      setNotes(supplier.notes || '');
    } else {
      setEditing(null);
      setName('');
      setContactName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    }
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim() || !siteId) return;
    setSaving(true);

    const payload = {
      site_id: siteId,
      name: name.trim(),
      contact_name: contactName.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    if (editing) {
      await supabase.from('suppliers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('suppliers').insert(payload);
    }

    setSaving(false);
    setShowForm(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    await supabase.from('suppliers').update({ is_active: false }).eq('id', id);
    onRefresh();
  }

  function getSupplierStats(supplierId: string) {
    const supplierOrders = orders.filter(o => o.supplier_id === supplierId);
    const supplierInvoices = invoices.filter(i => i.supplier_id === supplierId);
    const totalSpent = supplierInvoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
    const orderCount = supplierOrders.length;
    return { totalSpent, orderCount };
  }

  if (selectedSupplier) {
    const stats = getSupplierStats(selectedSupplier.id);
    const supplierOrders = orders.filter(o => o.supplier_id === selectedSupplier.id);

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedSupplier(null)} className="text-white/40 hover:text-white text-xs flex items-center gap-1 transition-colors">
          <X size={12} /> Retour a la liste
        </button>

        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-lg">{selectedSupplier.name}</h2>
              {selectedSupplier.contact_name && <p className="text-white/50 text-sm">{selectedSupplier.contact_name}</p>}
            </div>
            <button onClick={() => openForm(selectedSupplier)} className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 text-xs transition-colors">
              <Edit2 size={12} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {selectedSupplier.phone && (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Phone size={12} /> {selectedSupplier.phone}
              </div>
            )}
            {selectedSupplier.email && (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <Mail size={12} /> {selectedSupplier.email}
              </div>
            )}
            {selectedSupplier.address && (
              <div className="flex items-center gap-2 text-white/50 text-xs">
                <MapPin size={12} /> {selectedSupplier.address}
              </div>
            )}
          </div>

          {selectedSupplier.notes && (
            <p className="text-white/30 text-xs italic border-t border-white/[0.04] pt-3">{selectedSupplier.notes}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-blue-400" />
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Commandes</span>
            </div>
            <p className="text-white font-bold text-xl">{stats.orderCount}</p>
          </div>
          <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={14} className="text-emerald-400" />
              <span className="text-white/40 text-[10px] uppercase tracking-wider">Total achats</span>
            </div>
            <p className="text-white font-bold text-xl">{stats.totalSpent.toLocaleString('fr-FR')} F</p>
          </div>
        </div>

        {/* Order history */}
        <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] p-4">
          <h3 className="text-white font-semibold text-sm mb-3">Historique des commandes</h3>
          {supplierOrders.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">Aucune commande</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {supplierOrders.map(o => (
                <div key={o.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <div>
                    <span className="text-white text-xs font-medium">BC-{String(o.order_number).padStart(4, '0')}</span>
                    <span className="text-white/30 text-[10px] ml-2">{new Date(o.order_date).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    <span className="text-white/60 text-xs font-medium">{Number(o.total_amount).toLocaleString('fr-FR')} F</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un fournisseur..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-white text-xs placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-colors"
          />
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
        >
          <Plus size={13} /> Ajouter
        </button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Truck size={32} className="mx-auto text-white/10 mb-3" />
          <p className="text-white/30 text-sm">Aucun fournisseur</p>
          <p className="text-white/20 text-xs mt-1">Ajoutez votre premier fournisseur pour commencer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => {
            const stats = getSupplierStats(s.id);
            return (
              <motion.div
                key={s.id}
                layout
                className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors cursor-pointer group"
                onClick={() => setSelectedSupplier(s)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <User size={14} className="text-blue-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{s.name}</p>
                      {s.contact_name && <p className="text-white/40 text-[10px]">{s.contact_name}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openForm(s)} className="p-1.5 rounded bg-white/[0.05] hover:bg-white/[0.1] text-white/40 hover:text-white/70 transition-colors">
                      <Edit2 size={11} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded bg-white/[0.05] hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/[0.04]">
                  <span className="text-white/30 text-[10px]">{stats.orderCount} commande{stats.orderCount !== 1 ? 's' : ''}</span>
                  <span className="text-white/30 text-[10px]">{stats.totalSpent.toLocaleString('fr-FR')} F</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">{editing ? 'Modifier' : 'Nouveau'} fournisseur</h3>
                <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/60 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Nom *</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="Nom du fournisseur" />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Contact principal</label>
                  <input value={contactName} onChange={e => setContactName(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="Nom du contact" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-[10px] font-medium block mb-1">Telephone</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="+221 77..." />
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] font-medium block mb-1">Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="email@fournisseur.com" />
                  </div>
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Adresse</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors" placeholder="Adresse" />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Notes</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 transition-colors resize-none" placeholder="Notes..." />
                </div>
              </div>

              <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editing ? 'Mettre a jour' : 'Creer'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: 'text-white/40 bg-white/[0.04]' },
    ordered: { label: 'Commande', color: 'text-blue-400 bg-blue-500/10' },
    partial: { label: 'Partiel', color: 'text-amber-400 bg-amber-500/10' },
    received: { label: 'Recu', color: 'text-emerald-400 bg-emerald-500/10' },
    cancelled: { label: 'Annule', color: 'text-red-400 bg-red-500/10' },
  };
  const c = config[status] || config.draft;
  return <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${c.color}`}>{c.label}</span>;
}
