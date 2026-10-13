import { useEffect, useState, useCallback } from 'react';
import {
  ShoppingCart, Plus, Search, RefreshCw, X, Check,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InventoryItem, InventoryUnit, InventoryMovement } from '../../lib/types';
import {
  fetchInventoryItems, fetchInventoryUnits,
  fetchMovements, recordPurchase,
  formatStockQty, formatPrice,
} from '../../services/inventoryService';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../shared/Toast';

interface PurchaseForm {
  item_id: string;
  qty: string;
  unit_id: string;
  unit_cost: string;
  supplier: string;
  notes: string;
}

const emptyForm: PurchaseForm = { item_id: '', qty: '', unit_id: '', unit_cost: '', supplier: '', notes: '' };

export default function PurchasesView() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const [itemsData, unitsData, movData] = await Promise.all([
      fetchInventoryItems(),
      fetchInventoryUnits(),
      fetchMovements(100),
    ]);
    setItems(itemsData);
    setUnits(unitsData);
    setMovements(movData.filter(m => m.type === 'IN'));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('purchases_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const activeItems = items.filter(i => i.actif);

  const openCreate = () => {
    setForm({ ...emptyForm, item_id: activeItems[0]?.id || '', unit_id: activeItems[0]?.unit_id || '' });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.item_id || !form.qty || !form.unit_id || !form.unit_cost) return;
    setSaving(true);
    try {
      await recordPurchase(
        form.item_id,
        Number(form.qty),
        form.unit_id,
        Number(form.unit_cost),
        form.supplier,
        form.notes,
        user?.id || null
      );
      showToast('Achat enregistre', 'success');
      setShowModal(false);
      setForm(emptyForm);
      fetchAll();
    } catch {
      showToast('Erreur lors de l\'enregistrement', 'error');
    }
    setSaving(false);
  };

  const selectedItem = items.find(i => i.id === form.item_id);
  const selectedUnit = units.find(u => u.id === form.unit_id);
  const baseUnit = units.find(u => u.famille === selectedUnit?.famille && u.is_base);
  const totalCost = (Number(form.qty) || 0) * (Number(form.unit_cost) || 0);
  const baseQty = selectedUnit ? (Number(form.qty) || 0) * selectedUnit.base_factor : 0;

  const filteredMovements = movements.filter(m =>
    (m as any)?.item?.nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.reference?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Achats & Reception</h2>
            <p className="text-sm text-gray-500">Enregistrer les entrees de stock</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-all">
            <RefreshCw size={16} />
          </button>
          <button onClick={openCreate} disabled={activeItems.length === 0} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <Plus size={16} /> Nouvel achat
          </button>
        </div>
      </div>

      {activeItems.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          Aucun article d'inventaire actif. Creez d'abord des articles dans la page Stock.
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un achat..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Quantite</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prix unit.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Fournisseur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredMovements.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(m.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{(m as any)?.item?.nom || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{m.qty} {(m as any)?.item?.unit?.symbole || ''}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-right">{formatPrice(m.unit_cost)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">{formatPrice(m.total_cost)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{m.reference || '-'}</td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    Aucun achat enregistre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 text-lg">Nouvel achat</h3>
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Article</label>
                <select
                  value={form.item_id}
                  onChange={e => {
                    const item = items.find(i => i.id === e.target.value);
                    setForm(f => ({ ...f, item_id: e.target.value, unit_id: item?.unit_id || '' }));
                  }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                >
                  {activeItems.map(i => (
                    <option key={i.id} value={i.id}>{i.nom} (Stock: {formatStockQty(i.stock_qty, i.unit)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Quantite</label>
                  <input
                    type="number"
                    value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Unite d'achat</label>
                  <select
                    value={form.unit_id}
                    onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  >
                    {selectedItem && units.filter(u => u.famille === units.find(uu => uu.id === selectedItem.unit_id)?.famille).map(u => (
                      <option key={u.id} value={u.id}>{u.nom} ({u.symbole})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Prix d'achat unitaire (FCFA)</label>
                <input
                  type="number"
                  value={form.unit_cost}
                  onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
              {selectedUnit && baseUnit && selectedUnit.id !== baseUnit.id && form.qty && (
                <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-xs text-blue-700">
                  Conversion: {form.qty} {selectedUnit.symbole} = {baseQty} {baseUnit.symbole}
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Fournisseur (optionnel)</label>
                <input
                  type="text"
                  value={form.supplier}
                  onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                  placeholder="Nom du fournisseur..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Notes (optionnel)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Notes..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none"
                />
              </div>
              {totalCost > 0 && (
                <div className="bg-gray-900 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Cout total</span>
                  <span className="text-white text-lg font-bold">{formatPrice(totalCost)}</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={() => { setShowModal(false); setForm(emptyForm); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-all">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving || !form.item_id || !form.qty || !form.unit_cost} className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                <Check size={18} /> {saving ? 'En cours...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
