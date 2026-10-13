import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, OrderItem } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import OrderManagerModal from './OrderManagerModal';

export default function OrdersView() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [printActionsOrder, setPrintActionsOrder] = useState<Order | null>(null);
  const initialLoadDone = useRef(false);

  const fetchOrders = useCallback(async () => {
    const query = supabase
      .from('orders')
      .select('*, table:tables(nom), items:order_items(*, options:order_item_options(*))')
      .in('statut', ['BROUILLON', 'VALIDE', 'PAYEE', 'CLOTUREE']);

    if (user && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
      query.eq('serveur_id', user.id);
    }

    const { data } = await query.order('created_at', { ascending: false });
    setOrders(data || []);
    if (!initialLoadDone.current) {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [user]);

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('server_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchOrders)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const statutConfig: Record<string, { label: string; bg: string; text: string }> = {
    BROUILLON: { label: 'Brouillon', bg: 'bg-gray-100', text: 'text-gray-600' },
    VALIDE: { label: 'Validée', bg: 'bg-blue-100', text: 'text-blue-700' },
    PAYEE: { label: 'Payée', bg: 'bg-green-100', text: 'text-green-700' },
  };

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Commandes</h2>
        <button onClick={fetchOrders} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-amber-500 rounded-lg hover:bg-amber-50 transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-sm">Aucune commande active</p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-3">
          {orders.map(order => {
            const cfg = statutConfig[order.statut];
            const isOpen = expanded === order.id;
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="flex items-center">
                  <button
                    className="flex-1 flex items-center justify-between p-4 text-left"
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                  >
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{(order as any).table?.nom || 'Table'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{order.ticket_number}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className="font-bold text-amber-600 text-sm">{order.total.toLocaleString('fr-FR')} F</span>
                      {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>
                  <button
                    onClick={() => setPrintActionsOrder(order)}
                    title="Gérer, modifier ou annuler la commande"
                    aria-label="Gérer, modifier ou annuler la commande"
                    className="w-11 h-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all border-l border-gray-50 self-stretch"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-50 px-4 pb-4 pt-2 space-y-2">
                    {((order as any).items || []).map((item: OrderItem) => (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <div>
                          <span className={`text-gray-800 ${item.qty === 0 ? 'line-through text-gray-400' : ''}`}>
                            {item.qty}× {item.nom_snapshot}
                          </span>
                          {item.printed_qty > 0 && item.qty > 0 && (
                            <span className="ml-2 text-xs text-emerald-500 font-medium">✓ imprimé</span>
                          )}
                          {(item as any).options?.length > 0 && (
                            <p className="text-xs text-amber-500">{(item as any).options.map((o: any) => o.nom_snapshot).join(', ')}</p>
                          )}
                          {item.notes && <p className="text-xs text-gray-400 italic">"{item.notes}"</p>}
                        </div>
                        <span className="text-gray-600 font-medium ml-2">{(item.prix_snapshot * item.qty).toLocaleString('fr-FR')} F</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm">
                      <span>Total</span>
                      <span className="text-amber-600">{order.total.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {printActionsOrder && (
        <OrderManagerModal
          order={printActionsOrder as any}
          onClose={() => setPrintActionsOrder(null)}
          onRefresh={() => { fetchOrders(); setPrintActionsOrder(null); }}
        />
      )}
    </div>
  );
}
