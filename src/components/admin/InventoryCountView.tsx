import { useEffect, useState, useCallback } from 'react';
import {
  ClipboardCheck, Plus, Check,
  AlertCircle, History, FileCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { InventoryItem, InventoryCount, InventoryCountLine } from '../../lib/types';
import {
  fetchInventoryItems, formatStockQty,
} from '../../services/inventoryService';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../shared/Toast';

export default function InventoryCountView() {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [counts, setCounts] = useState<InventoryCount[]>([]);
  const [activeCountId, setActiveCountId] = useState<string | null>(null);
  const [lines, setLines] = useState<InventoryCountLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [finalizing, setFinalizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchAll = useCallback(async () => {
    const [itemsData, countsData] = await Promise.all([
      fetchInventoryItems(),
      supabase.from('inventory_counts').select('*').order('created_at', { ascending: false }),
    ]);
    setItems(itemsData.filter(i => i.actif));
    setCounts((countsData.data || []) as InventoryCount[]);
    const inProgress = (countsData.data || []).find((c: any) => c.status === 'in_progress');
    if (inProgress) {
      setActiveCountId(inProgress.id);
      await fetchLines(inProgress.id);
    }
    setLoading(false);
  }, []);

  const fetchLines = async (countId: string) => {
    const { data } = await supabase
      .from('inventory_count_lines')
      .select('*, item:inventory_items(nom, unit:inventory_units(symbole))')
      .eq('count_id', countId)
      .order('item:inventory_items(nom)');
    setLines((data || []) as InventoryCountLine[]);
  };

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel('invcount_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_counts' }, fetchAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_count_lines' }, () => {
        if (activeCountId) fetchLines(activeCountId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAll, activeCountId]);

  const startCount = async () => {
    const { data } = await supabase
      .from('inventory_counts')
      .insert({ status: 'in_progress', created_by: user?.id || null })
      .select()
      .single();

    if (!data) return;
    const countId = (data as any).id;
    setActiveCountId(countId);

    const activeItems = items.filter(i => i.actif);
    const lineInserts = activeItems.map((item, idx) => ({
      count_id: countId,
      item_id: item.id,
      theoretical_qty: item.stock_qty,
      ordre: idx,
    }));
    if (lineInserts.length > 0) {
      await supabase.from('inventory_count_lines').insert(lineInserts);
    }
    await fetchLines(countId);
    showToast('Inventaire demarre', 'success');
  };

  const updateCountedQty = async (lineId: string, qty: string) => {
    const countedQty = qty === '' ? null : Number(qty);
    const line = lines.find(l => l.id === lineId);
    const difference = countedQty !== null ? countedQty - (line?.theoretical_qty || 0) : 0;
    setLines(prev => prev.map(l => l.id === lineId ? { ...l, counted_qty: countedQty, difference } : l));
    await supabase
      .from('inventory_count_lines')
      .update({ counted_qty: countedQty, difference })
      .eq('id', lineId);
  };

  const finalizeCount = async () => {
    if (!activeCountId) return;
    if (!confirm('Finaliser l\'inventaire ? Le stock sera ajuste selon les ecarts constates.')) return;
    setFinalizing(true);
    const { data } = await supabase.rpc('finalize_inventory_count', {
      p_count_id: activeCountId,
      p_created_by: user?.id || null,
    });
    setFinalizing(false);
    const adjusted = (data as any) || 0;
    showToast(`Inventaire finalise - ${adjusted} ajustement(s) applique(s)`, 'success');
    setActiveCountId(null);
    setLines([]);
    fetchAll();
  };

  const cancelCount = async () => {
    if (!activeCountId) return;
    if (!confirm('Annuler cet inventaire ? Les donnees saisies seront perdues.')) return;
    await supabase.from('inventory_count_lines').delete().eq('count_id', activeCountId);
    await supabase.from('inventory_counts').delete().eq('id', activeCountId);
    setActiveCountId(null);
    setLines([]);
    fetchAll();
    showToast('Inventaire annule', 'info');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <History size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Historique des inventaires</h2>
              <p className="text-sm text-gray-500">Sessions de prise d'inventaire</p>
            </div>
          </div>
          <button onClick={() => setShowHistory(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            Retour
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Finalise le</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {counts.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    {c.status === 'finalized' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        <Check size={12} /> Finalise
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                        <AlertCircle size={12} /> En cours
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.finalized_at ? new Date(c.finalized_at).toLocaleDateString('fr-FR') : '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{c.notes || '-'}</td>
                </tr>
              ))}
              {counts.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">Aucun inventaire enregistre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!activeCountId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
              <ClipboardCheck size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Prise d'Inventaire</h2>
              <p className="text-sm text-gray-500">Comparer le stock theorique avec le stock physique</p>
            </div>
          </div>
          <button onClick={() => setShowHistory(true)} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <History size={16} /> Historique
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileCheck size={32} className="text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Demarrer un inventaire</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            Comptez physiquement chaque article en stock. Le systeme comparera avec le stock theorique
            et creera des ajustements automatiquement.
          </p>
          <button onClick={startCount} disabled={items.length === 0} className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold transition-all">
            <Plus size={18} /> Demarrer l'inventaire
          </button>
          {items.length === 0 && (
            <p className="text-xs text-gray-400 mt-3">Aucun article actif. Creez d'abord des articles dans la page Stock.</p>
          )}
        </div>
      </div>
    );
  }

  const countedLines = lines.filter(l => l.counted_qty !== null);
  const diffLines = lines.filter(l => l.counted_qty !== null && l.difference !== 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">Inventaire en cours</h2>
            <p className="text-sm text-gray-500">{countedLines.length} / {lines.length} articles comptes - {diffLines.length} ecart(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={cancelCount} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            Annuler
          </button>
          <button onClick={finalizeCount} disabled={finalizing || countedLines.length === 0} className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all">
            <Check size={16} /> {finalizing ? 'Finalisation...' : 'Finaliser'}
          </button>
        </div>
      </div>

      {diffLines.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">{diffLines.length} ecart(s) detecte(s)</span>
          </div>
          <div className="space-y-1">
            {diffLines.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{(l as any)?.item?.nom || 'N/A'}</span>
                <span className={l.difference < 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                  {l.difference > 0 ? '+' : ''}{l.difference} {(l as any)?.item?.unit?.symbole || ''}
                </span>
              </div>
            ))}
            {diffLines.length > 5 && <p className="text-xs text-gray-400">...et {diffLines.length - 5} autre(s)</p>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Article</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Theorique</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Compte</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ecart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lines.map(line => {
                const symbole = (line as any)?.item?.unit?.symbole || '';
                return (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{(line as any)?.item?.nom || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{formatStockQty(line.theoretical_qty, (line as any)?.item?.unit)}</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        value={line.counted_qty ?? ''}
                        onChange={e => updateCountedQty(line.id, e.target.value)}
                        placeholder="-"
                        className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      />
                    </td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right ${
                      line.counted_qty === null ? 'text-gray-300' :
                      line.difference === 0 ? 'text-gray-400' :
                      line.difference < 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {line.counted_qty === null ? '-' : `${line.difference > 0 ? '+' : ''}${line.difference} ${symbole}`}
                    </td>
                  </tr>
                );
              })}
              {lines.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">Aucun article a compter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
