import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, Package, AlertTriangle,
  Boxes, TrendingUp, Search, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InventoryItem, InventoryUnit } from '../../lib/types';
import {
  fetchInventoryItems, fetchInventoryUnits,
  saveInventoryItem, deleteInventoryItem,
  formatStockQty, formatPrice,
} from '../../services/inventoryService';

interface ItemForm {
  nom: string;
  category: string;
  unit_id: string;
  alert_threshold: string;
  actif: boolean;
}

const emptyForm: ItemForm = { nom: '', category: 'General', unit_id: '', alert_threshold: '', actif: true };

export default function InventoryManager() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    const [itemsData, unitsData] = await Promise.all([
      fetchInventoryItems(),
      fetchInventoryUnits(),
    ]);
    setItems(itemsData);
    setUnits(unitsData);
    if (!form.unit_id && unitsData.length > 0) {
      setForm(f => ({ ...f, unit_id: unitsData[0].id }) as ItemForm);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('inventory_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...emptyForm, unit_id: units[0]?.id || '' });
    setShowModal(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditItem(item);
    setForm({
      nom: item.nom,
      category: item.category,
      unit_id: item.unit_id,
      alert_threshold: String(item.alert_threshold || ''),
      actif: item.actif,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nom || !form.unit_id) return;
    setSaving(true);
    await saveInventoryItem({
      id: editItem?.id,
      nom: form.nom,
      category: form.category || 'General',
      unit_id: form.unit_id,
      alert_threshold: Number(form.alert_threshold) || 0,
      actif: form.actif,
    });
    setSaving(false);
    setShowModal(false);
    setEditItem(null);
    setForm(emptyForm);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet article ? Les mouvements seront aussi supprimes.')) return;
    await deleteInventoryItem(id);
    fetchAll();
  };

  const filtered = items.filter(i =>
    i.nom.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = items.reduce((sum, i) => sum + i.stock_qty * i.avg_purchase_price, 0);
  const lowStockItems = items.filter(i => i.actif && i.alert_threshold > 0 && i.stock_qty <= i.alert_threshold);
  const activeCount = items.filter(i => i.actif).length;



  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <Boxes size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Gestion du Stock</h2>
            <p className="text-sm text-gray-500">{activeCount} articles actifs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-all">
            <RefreshCw size={16} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <Plus size={16} /> Nouvel article
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <TrendingUp size={18} className="text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-500">Valorisation totale</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(totalValue)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
              <Package size={18} className="text-amber-500" />
            </div>
            <span className="text-sm font-medium text-gray-500">Articles actifs</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{activeCount}</p>
        </div>
        <div className={`rounded-2xl p-5 border ${lowStockItems.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${lowStockItems.length > 0 ? 'bg-red-100' : 'bg-green-50'}`}>
              <AlertTriangle size={18} className={lowStockItems.length > 0 ? 'text-red-500' : 'text-green-500'} />
            </div>
            <span className="text-sm font-medium text-gray-500">Alertes stock bas</span>
          </div>
          <p className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>{lowStockItems.length}</p>
        </div>
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-semibold text-red-700">Stock bas - reapprovisionnement necessaire</span>
          </div>
          <div className="space-y-2">
            {lowStockItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5">
                <span className="text-sm font-medium text-gray-700">{item.nom}</span>
                <span className="text-sm font-bold text-red-600">
                  {formatStockQty(item.stock_qty, item.unit)} / seuil {formatStockQty(item.alert_threshold, item.unit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un article..."
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all"
        />
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Categorie</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Prix moyen</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valeur</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => {
                const isLow = item.alert_threshold > 0 && item.stock_qty <= item.alert_threshold;
                const value = item.stock_qty * item.avg_purchase_price;
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.nom}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.category}</td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${isLow ? 'text-red-600' : 'text-gray-700'}`}>
                      {formatStockQty(item.stock_qty, item.unit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{formatPrice(item.avg_purchase_price)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right">{formatPrice(value)}</td>
                    <td className="px-4 py-3 text-center">
                      {item.actif ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">Actif</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Inactif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-all">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    Aucun article trouve. Cliquez sur "Nouvel article" pour commencer.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">{editItem ? 'Modifier' : 'Nouvel article'}</h3>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(emptyForm); }} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Nom</label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Poulet cru"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Categorie</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="Ex: Viandes, Boissons..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Unite de stock</label>
                <select
                  value={form.unit_id}
                  onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.id}>{u.nom} ({u.symbole}){u.is_base ? ' - base' : ''}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Le stock est stocke dans l'unite de base ({units.find(u => u.id === form.unit_id)?.symbole || ''}). Les conversions sont automatiques.</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Seuil d'alerte</label>
                <input
                  type="number"
                  value={form.alert_threshold}
                  onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
                <p className="text-xs text-gray-400 mt-1">Alerte quand le stock descend en dessous de ce seuil.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.actif}
                  onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm font-medium text-gray-700">Article actif</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(emptyForm); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-all">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving || !form.nom || !form.unit_id} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-3 rounded-xl font-bold transition-all">
                {saving ? 'En cours...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
