import { useEffect, useState, useRef } from 'react';
import { CheckCircle, Clock, ChefHat, Utensils, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface KitchenOrder {
  id: string;
  ticket_number: string;
  table_nom: string;
  serveur_nom: string;
  created_at: string;
  statut: string;
  items: KitchenItem[];
  minutesAgo: number;
}

interface KitchenItem {
  id: string;
  nom: string;
  qty: number;
  notes: string;
  options: string[];
  printed_qty: number;
  done: boolean;
}

const STATION_COLORS = [
  'border-orange-400 bg-orange-50',
  'border-blue-400 bg-blue-50',
  'border-emerald-400 bg-emerald-50',
  'border-rose-400 bg-rose-50',
  'border-amber-400 bg-amber-50',
];

function minutesSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function urgencyClass(mins: number): string {
  if (mins >= 20) return 'bg-red-500';
  if (mins >= 10) return 'bg-amber-400';
  return 'bg-emerald-500';
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`
        id, ticket_number, created_at, statut,
        table:tables(nom),
        serveur:users(nom),
        items:order_items(
          id, nom_snapshot, qty, notes, printed_qty,
          options:order_item_options(nom_snapshot)
        )
      `)
      .in('statut', ['BROUILLON', 'VALIDE'])
      .order('created_at', { ascending: true });

    if (!data) {
      if (!initialLoadDone.current) { setLoading(false); initialLoadDone.current = true; }
      return;
    }

    const mapped: KitchenOrder[] = data
      .filter(o => {
        const items = (o.items || []).filter((i: any) => i.qty > 0);
        return items.length > 0;
      })
      .map(o => ({
        id: o.id,
        ticket_number: o.ticket_number,
        table_nom: (o.table as any)?.nom || 'Table',
        serveur_nom: (o.serveur as any)?.nom || '',
        created_at: o.created_at,
        statut: o.statut,
        minutesAgo: minutesSince(o.created_at),
        items: (o.items || [])
          .filter((i: any) => i.qty > 0)
          .map((i: any) => ({
            id: i.id,
            nom: i.nom_snapshot,
            qty: i.qty,
            notes: i.notes || '',
            options: (i.options || []).map((o: any) => o.nom_snapshot),
            printed_qty: i.printed_qty || 0,
            done: doneIds.has(i.id),
          })),
      }));

    setOrders(mapped);
    if (!initialLoadDone.current) {
      setLoading(false);
      initialLoadDone.current = true;
    }
  };

  useEffect(() => {
    fetchOrders();
    const dataInterval = setInterval(fetchOrders, 2000);
    const tickInterval = setInterval(() => setNow(Date.now()), 30000);
    return () => { clearInterval(dataInterval); clearInterval(tickInterval); };
  }, []);

  const toggleItemDone = (orderId: string, itemId: string) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, items: o.items.map(i => i.id === itemId ? { ...i, done: !i.done } : i) };
    }));
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const markOrderDone = async (orderId: string) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      const order = orders.find(o => o.id === orderId);
      order?.items.forEach(i => next.add(i.id));
      return next;
    });
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, statut: 'SERVIE', items: o.items.map(i => ({ ...i, done: true })) };
    }));

    if (navigator.vibrate) navigator.vibrate([30, 50, 80]);
  };

  const activeOrders = orders.filter(o => {
    const allDone = o.items.every(i => i.done);
    return !allDone;
  });

  const doneOrders = orders.filter(o => {
    const allDone = o.items.every(i => i.done);
    return allDone;
  });

  if (loading) {
    return (
      <div className="h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
            <ChefHat size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-white text-xl tracking-wide">CUISINE</h1>
            <p className="text-xs text-gray-400">
              {now && new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-3xl font-black text-amber-400">{activeOrders.length}</p>
            <p className="text-xs text-gray-500">en cours</p>
          </div>
          <button onClick={fetchOrders} className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 rounded-xl transition-all">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="flex-1 p-4">
        {activeOrders.length === 0 && doneOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center h-96 text-gray-600">
            <Utensils size={48} className="mb-4 text-gray-700" />
            <p className="text-xl font-bold text-gray-500">Aucune commande</p>
            <p className="text-sm mt-1">La cuisine est libre !</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeOrders.map((order, idx) => {
            const mins = minutesSince(order.created_at);
            const colorClass = STATION_COLORS[idx % STATION_COLORS.length];
            const allDone = order.items.every(i => i.done);

            return (
              <div
                key={order.id}
                className={`rounded-2xl border-2 overflow-hidden flex flex-col ${colorClass} ${allDone ? 'opacity-60' : ''}`}
              >
                <div className="px-4 py-3 flex items-center justify-between border-b border-black/10">
                  <div>
                    <p className="font-black text-gray-900 text-lg leading-none">{order.table_nom}</p>
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">{order.ticket_number}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs font-bold text-white px-2.5 py-1 rounded-full ${urgencyClass(mins)}`}>
                      <Clock size={10} />
                      {mins < 1 ? '<1' : mins}m
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 space-y-2">
                  {order.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggleItemDone(order.id, item.id)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 transition-all active:scale-[0.97] ${
                        item.done
                          ? 'bg-white/30 opacity-50'
                          : 'bg-white/60 hover:bg-white/80 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          item.done ? 'bg-emerald-500 border-emerald-500' : 'border-gray-400 bg-white'
                        }`}>
                          {item.done && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-black text-gray-900 text-sm ${item.done ? 'line-through text-gray-400' : ''}`}>
                            {item.qty}× {item.nom}
                          </p>
                          {item.options.length > 0 && (
                            <p className="text-xs text-gray-600 mt-0.5">{item.options.join(', ')}</p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-700 italic mt-0.5 font-medium">"{item.notes}"</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="px-3 pb-3">
                  <button
                    onClick={() => markOrderDone(order.id)}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white py-3 rounded-xl font-black text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16} />
                    TABLE SERVIE
                  </button>
                </div>
              </div>
            );
          })}

          {doneOrders.map(order => (
            <div key={order.id} className="rounded-2xl border-2 border-gray-700 bg-gray-900 overflow-hidden opacity-40">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-black text-gray-400 text-lg leading-none">{order.table_nom}</p>
                  <p className="text-xs text-gray-600 font-mono">{order.ticket_number}</p>
                </div>
                <CheckCircle size={20} className="text-emerald-600" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
