import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeftRight, Search, RefreshCw,
  ArrowDownCircle, ArrowUpCircle, AlertCircle, Sliders,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InventoryMovement, InventoryMovementType } from '../../lib/types';
import { fetchMovements, formatPrice } from '../../services/inventoryService';

const TYPE_CONFIG: Record<InventoryMovementType, { label: string; icon: typeof ArrowDownCircle; color: string; bg: string }> = {
  IN: { label: 'Entree', icon: ArrowDownCircle, color: 'text-green-600', bg: 'bg-green-50' },
  OUT: { label: 'Sortie (Vente)', icon: ArrowUpCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
  ADJUSTMENT: { label: 'Ajustement', icon: Sliders, color: 'text-amber-600', bg: 'bg-amber-50' },
  LOSS: { label: 'Perte', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
};

export default function MovementsView() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  const fetchAll = useCallback(async () => {
    const data = await fetchMovements(300);
    setMovements(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('movements_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements' }, fetchAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll]);

  const filtered = movements.filter(m => {
    const matchSearch = (m as any)?.item?.nom?.toLowerCase().includes(search.toLowerCase()) ||
      m.reference?.toLowerCase().includes(search.toLowerCase()) ||
      m.notes?.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || m.type === filterType;
    return matchSearch && matchType;
  });

  const totalIn = movements.filter(m => m.type === 'IN').reduce((s, m) => s + m.total_cost, 0);
  const totalOut = movements.filter(m => m.type === 'OUT').reduce((s, m) => s + m.total_cost, 0);

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
            <ArrowLeftRight size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Mouvements de Stock</h2>
            <p className="text-sm text-gray-500">Historique des entrees et sorties</p>
          </div>
        </div>
        <button onClick={fetchAll} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <ArrowDownCircle size={18} className="text-green-500" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total entrees (achats)</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(totalIn)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <ArrowUpCircle size={18} className="text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-500">Total sorties (ventes)</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{formatPrice(totalOut)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un mouvement..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
        >
          <option value="">Tous les types</option>
          <option value="IN">Entrees</option>
          <option value="OUT">Sorties</option>
          <option value="ADJUSTMENT">Ajustements</option>
          <option value="LOSS">Pertes</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Quantite</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cout</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(m => {
                const config = TYPE_CONFIG[m.type] || TYPE_CONFIG.OUT;
                const Icon = config.icon;
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(m.created_at).toLocaleDateString('fr-FR')} {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg ${config.bg} ${config.color}`}>
                        <Icon size={12} /> {config.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{(m as any)?.item?.nom || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {m.type === 'IN' ? '+' : '-'}{m.qty} {(m as any)?.item?.unit?.symbole || ''}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right">{formatPrice(m.total_cost)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{m.reference || m.notes || '-'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    Aucun mouvement trouve.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
