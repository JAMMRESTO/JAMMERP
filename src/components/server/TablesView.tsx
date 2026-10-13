import { useEffect, useState, useCallback, useRef } from 'react';
import { Receipt, Lock, Send, Unlock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Zone, Table, TableStatut } from '../../lib/types';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../shared/Toast';

interface Props {
  onTableSelect: () => void;
}

const statutConfig: Record<TableStatut, {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}> = {
  LIBRE: {
    label: 'Libre',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-400',
  },
  OCCUPEE: {
    label: 'Occupée',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  A_ENCAISSER: {
    label: 'À encaisser',
    bg: 'bg-rose-50',
    border: 'border-rose-300',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
  },
  SERVIE: {
    label: 'Servie',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
};

export default function TablesView({ onTableSelect }: Props) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<(Table & { _serveur_nom?: string | null })[]>([]);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [additionLoading, setAdditionLoading] = useState<string | null>(null);
  const [lockError, setLockError] = useState<{ tableId: string; lockedBy: string } | null>(null);
  const [pendingTableIds, setPendingTableIds] = useState<Set<string>>(new Set());
  const { selectTable, activeTable } = useCart();
  const { user } = useAuth();
  const initialLoadDone = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const fetchData = useCallback(async () => {
    const [zonesRes, tablesRes] = await Promise.all([
      supabase.from('zones').select('*').order('ordre'),
      supabase.from('tables').select('*, locked_by_user:users!tables_locked_by_fkey(nom)').order('nom'),
    ]);

    const tablesRaw: Table[] = tablesRes.data || [];

    const occupiedIds = tablesRaw
      .filter(t => ['OCCUPEE', 'SERVIE', 'A_ENCAISSER'].includes(t.statut))
      .map(t => t.id);

    const serveurByTable: Record<string, string> = {};
    if (occupiedIds.length > 0) {
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('table_id, serveur:users!orders_serveur_id_fkey(nom)')
        .in('table_id', occupiedIds)
        .in('statut', ['BROUILLON', 'VALIDE']);
      for (const order of activeOrders || []) {
        const serveur = Array.isArray(order.serveur) ? order.serveur[0] : order.serveur;
        if (order.table_id && serveur?.nom && !serveurByTable[order.table_id]) {
          serveurByTable[order.table_id] = serveur.nom;
        }
      }
    }

    const enriched = tablesRaw.map(t => ({
      ...t,
      _serveur_nom: serveurByTable[t.id] || null,
    }));

    setZones(zonesRes.data || []);
    setTables(enriched as (Table & { _serveur_nom: string | null })[]);
    if (!initialLoadDone.current) {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  const fetchPendingTables = useCallback(async () => {
    const { data } = await supabase
      .from('print_jobs')
      .select('table_id')
      .eq('status', 'WAITING_CASHIER')
      .not('table_id', 'is', null);
    const ids = new Set<string>((data || []).map((r: any) => r.table_id).filter(Boolean));
    setPendingTableIds(ids);
  }, []);

  useEffect(() => {
    fetchData();
    fetchPendingTables();
    const channel = supabase
      .channel('tables_changes_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(fetchData, 400);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(fetchPendingTables, 400);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [fetchData, fetchPendingTables]);

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  };

  const handleForceUnlock = async (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('tables').update({ locked_by: null }).eq('id', table.id);
    showToast(`Verrou forcé libéré sur ${table.nom}`, 'success');
    fetchData();
  };

  const handleTableTap = (table: Table) => {
    if (!user) return;

    const isLockedByOther = table.locked_by && table.locked_by !== user.id;
    if (isLockedByOther) {
      const name = (table.locked_by_user as { nom?: string } | null)?.nom || 'un autre serveur';
      setLockError({ tableId: table.id, lockedBy: name });
      vibrate([20, 30, 20]);
      setTimeout(() => setLockError(null), 3000);
      return;
    }

    vibrate(30);
    // Navigate immediately for instant feel; verify lock in background
    onTableSelect();
    selectTable(table, user.id).then(result => {
      if (!result.ok) {
        setLockError({ tableId: table.id, lockedBy: result.lockedBy || 'un autre serveur' });
        vibrate([20, 30, 20]);
        setTimeout(() => setLockError(null), 3000);
      }
    });
  };

  const handleDemanderAddition = useCallback(async (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    if (additionLoading) return;
    vibrate([20, 50, 20]);
    setAdditionLoading(table.id);

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, ticket_number')
      .eq('table_id', table.id)
      .in('statut', ['BROUILLON', 'VALIDE'])
      .maybeSingle();

    const orderId = existingOrder?.id || null;

    if (orderId) {
      await supabase.from('orders').update({ statut: 'VALIDE', updated_at: new Date().toISOString() }).eq('id', orderId);
    }
    await supabase.from('tables').update({ statut: 'A_ENCAISSER', locked_by: null }).eq('id', table.id);

    setAdditionLoading(null);
    await fetchData();
  }, [additionLoading, fetchData]);

  const displayedTables = activeZone === 'all' ? tables : tables.filter(t => t.zone_id === activeZone);

  const counts: Partial<Record<TableStatut, number>> = {
    LIBRE: tables.filter(t => t.statut === 'LIBRE').length,
    OCCUPEE: tables.filter(t => t.statut === 'OCCUPEE').length,
    A_ENCAISSER: tables.filter(t => t.statut === 'A_ENCAISSER').length,
  };

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-bold text-gray-900 mb-3">Plan de salle</h2>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {(Object.entries(counts) as [TableStatut, number][]).map(([statut, count]) => {
            const cfg = statutConfig[statut];
            if (!cfg) return null;
            return (
              <div key={statut} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-2.5 text-center`}>
                <p className={`text-xl font-black ${cfg.text}`}>{count}</p>
                <p className="text-xs text-gray-500 leading-tight mt-0.5">{cfg.label}</p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setActiveZone('all')}
            className={`px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeZone === 'all' ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
          >
            Toutes
          </button>
          {zones.map(z => (
            <button
              key={z.id}
              onClick={() => setActiveZone(z.id)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeZone === z.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
            >
              {z.nom}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-9 h-9 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 pb-28">
          {zones
            .filter(z => activeZone === 'all' || z.id === activeZone)
            .map(zone => {
              const zoneTables = displayedTables.filter(t => t.zone_id === zone.id);
              if (zoneTables.length === 0) return null;
              return (
                <div key={zone.id} className="mb-6">
                  {activeZone === 'all' && (
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">{zone.nom}</h3>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {zoneTables.map(table => {
                      const cfg = statutConfig[table.statut] ?? statutConfig['OCCUPEE'];
                      const isSelected = activeTable?.id === table.id;
                      const isLockedByOther = table.locked_by && table.locked_by !== user?.id;
                      const canForceUnlock = isLockedByOther && (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN');
                      const tappable = !isLockedByOther;
                      const canRequestBill = table.statut === 'OCCUPEE';
                      const isLoadingAddition = additionLoading === table.id;
                      const hasPendingJob = pendingTableIds.has(table.id);
                      const showLockError = lockError?.tableId === table.id;
                      const lockedByName = (table.locked_by_user as { nom?: string } | null)?.nom;
                      const serveurNom = table._serveur_nom || (isLockedByOther ? lockedByName : null);

                      return (
                        <button
                          key={table.id}
                          onClick={() => handleTableTap(table)}
                          disabled={!tappable}
                          className={[
                            isLockedByOther ? 'bg-gray-100' : cfg.bg,
                            'border-2 rounded-3xl p-3 flex flex-col items-center gap-1.5',
                            'transition-all active:scale-95 min-h-[90px] relative',
                            showLockError ? 'border-red-400 shadow-lg shadow-red-100' :
                              isSelected ? 'border-amber-400 shadow-lg shadow-amber-100' :
                              isLockedByOther ? 'border-gray-300' : cfg.border,
                            isLockedByOther ? 'cursor-not-allowed' : 'cursor-pointer',
                            table.statut === 'A_ENCAISSER' && !isLockedByOther ? 'animate-pulse' : '',
                          ].join(' ')}
                        >
                          {isSelected && !isLockedByOther && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-sm" />
                          )}
                          {isLockedByOther && (
                            <span className="absolute top-2 right-2">
                              <Lock size={11} className="text-gray-400" />
                            </span>
                          )}
                          {canForceUnlock && (
                            <button
                              onClick={(e) => handleForceUnlock(table, e)}
                              title="Forcer le déblocage"
                              className="absolute bottom-2 right-2 w-7 h-7 flex items-center justify-center bg-gray-200 hover:bg-amber-400 text-gray-500 hover:text-white rounded-lg transition-all active:scale-90"
                            >
                              <Unlock size={12} />
                            </button>
                          )}
                          {hasPendingJob && !isLockedByOther && (
                            <span className="absolute top-2 left-2 flex items-center gap-0.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              <Send size={8} />
                            </span>
                          )}

                          <div className={`w-3 h-3 rounded-full ${isLockedByOther ? 'bg-gray-300' : cfg.dot} mt-0.5`} />
                          <span className={`font-black text-base leading-none text-center mt-0.5 ${isLockedByOther ? 'text-gray-400' : 'text-gray-900'}`}>{table.nom}</span>

                          {isLockedByOther ? (
                            <span className="text-[10px] font-semibold text-gray-400 leading-none text-center px-1">
                              {showLockError ? `Pris par ${lockError.lockedBy}` : lockedByName || 'Occupé'}
                            </span>
                          ) : (
                            <>
                              <span className={`text-xs font-semibold ${cfg.text} leading-none`}>{cfg.label}</span>
                              {serveurNom && (
                                <span className="text-[10px] font-medium text-gray-400 leading-none text-center px-1 -mt-0.5 truncate w-full">
                                  {serveurNom}
                                </span>
                              )}
                            </>
                          )}

                          {canRequestBill && !isLockedByOther && (
                            <button
                              onClick={(e) => handleDemanderAddition(table, e)}
                              disabled={!!isLoadingAddition}
                              className="mt-2 w-full bg-rose-500 active:bg-rose-600 disabled:opacity-60 text-white rounded-xl py-2 text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                            >
                              {isLoadingAddition
                                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <Receipt size={11} />
                              }
                              Addition
                            </button>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          {displayedTables.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-sm">Aucune table dans cette zone</p>
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <div className="flex flex-wrap gap-3 justify-center">
          {(Object.entries(counts) as [TableStatut, number][]).map(([statut]) => {
            const cfg = statutConfig[statut];
            if (!cfg) return null;
            return (
              <div key={statut} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Lock size={10} className="text-gray-400" />
            En cours par un serveur
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Send size={8} />
            </span>
            En attente caissier
          </div>
        </div>
      </div>
    </div>
  );
}
