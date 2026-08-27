import { useEffect, useState, useCallback, useRef } from 'react';
import { UtensilsCrossed, LogOut, RefreshCw, CreditCard, Printer, ShoppingBag, History, TableProperties, LayoutGrid, ClipboardList, Keyboard, BookOpen, Wallet, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CartProvider, useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { Order, OrderItem } from '../../lib/types';
import { useFeedback } from '../../hooks/useFeedback';
import { setToastCallback } from '../../services/printingHub';
import PaymentModal from './PaymentModal';
import SplitBillModal from './SplitBillModal';
import POSLayout from '../pos/POSLayout';
import SalesHistoryView from './SalesHistoryView';
import CashClosureView from './CashClosureView';
import ExpensesView from './ExpensesView';
import TablesView from '../server/TablesView';
import MenuView from '../server/MenuView';
import CartSheet from '../server/CartSheet';
import OrdersView from '../server/OrdersView';
import StatsBar from './StatsBar';
import PendingOrdersView from './PendingOrdersView';
import LiveClock from '../shared/LiveClock';
import OrderManagerModal from '../server/OrderManagerModal';
import { buildBillPrintGroup, logPrintJobs, retryPendingPrintJobs } from '../../lib/printService';
import { connectQzTray, subscribeQzTrayStatus } from '../../lib/qzTray';

type CashierTab = 'aenvoyer' | 'encaisser' | 'tables' | 'direct' | 'historique' | 'cloture' | 'depenses';
type TableSubTab = 'tables' | 'menu' | 'cart' | 'orders';

function TableOrderSection() {
  const [activeTab, setActiveTab] = useState<TableSubTab>('tables');
  const { cartCount } = useCart();

  const tabs = [
    { id: 'tables' as TableSubTab, label: 'Tables', icon: TableProperties },
    { id: 'menu' as TableSubTab, label: 'Menu', icon: LayoutGrid },
    { id: 'cart' as TableSubTab, label: 'Panier', icon: ShoppingBag, badge: cartCount },
    { id: 'orders' as TableSubTab, label: 'Commandes', icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col pb-16">
      <div className="flex-1">
        {activeTab === 'tables' && <TablesView onTableSelect={() => setActiveTab('menu')} />}
        {activeTab === 'menu' && <MenuView onOrderPlaced={() => setActiveTab('tables')} />}
        {activeTab === 'cart' && <CartSheet onOrderPlaced={() => setActiveTab('tables')} />}
        {activeTab === 'orders' && <OrdersView />}
      </div>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 shadow-lg">
        <div className="flex max-w-4xl mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 relative transition-all min-h-[56px] ${isActive ? 'text-amber-500' : 'text-gray-400'}`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold leading-none">
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-medium ${isActive ? 'text-amber-500' : 'text-gray-400'}`}>{tab.label}</span>
                {isActive && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-amber-500 rounded-full" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function CashierLayout() {
  const { user, logout, hasPermission } = useAuth();
  const [cashierTab, setCashierTab] = useState<CashierTab>('aenvoyer');
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [qzConnected, setQzConnected] = useState(false);
  const [qzReason, setQzReason] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [manageOrder, setManageOrder] = useState<Order | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [printingBill, setPrintingBill] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>({});
  const { feedback } = useFeedback();
  const initialLoadDone = useRef(false);
  const canTakeOrders = hasPermission('can_create_orders');
  const canViewHistory = hasPermission('can_view_sales_history');

  useEffect(() => subscribeQzTrayStatus((connected, reason) => {
    setQzConnected(connected);
    setQzReason(reason);
  }), []);

  useEffect(() => {
    void retryPendingPrintJobs();
    const interval = setInterval(() => void retryPendingPrintJobs(), 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setToastCallback((_msg, type) => {
      if (type === 'error') feedback('error');
    });
  }, [feedback]);

  useEffect(() => {
    const fetchSession = async () => {
      const { data } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveSessionId(data?.id || null);
    };
    fetchSession();
    const channel = supabase
      .channel('cashier_session')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_sessions' }, fetchSession)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, table:tables(nom, statut), serveur:users!orders_serveur_id_fkey(nom)')
      .in('statut', ['VALIDE'])
      .eq('order_type', 'TABLE')
      .in('table.statut', ['OCCUPEE', 'SERVIE', 'A_ENCAISSER'])
      .order('updated_at', { ascending: false });

    const activeOrders = data || [];

    const orderIds = activeOrders.map((o: any) => o.id);
    let paidMap: Record<string, number> = {};
    if (orderIds.length > 0) {
      const { data: payments } = await supabase
        .from('payments')
        .select('order_id, montant')
        .in('order_id', orderIds)
        .eq('pay_status', 'valid');
      paidMap = (payments || []).reduce((acc, p) => {
        acc[p.order_id] = (acc[p.order_id] || 0) + p.montant;
        return acc;
      }, {} as Record<string, number>);
    }
    setPaidAmounts(paidMap);

    setOrders(activeOrders);
    if (!initialLoadDone.current) {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  const loadOrderItems = useCallback(async (orderId: string): Promise<OrderItem[]> => {
    if (orderItems[orderId]) return orderItems[orderId];
    const { data, error } = await supabase
      .from('order_items')
      .select('*, options:order_item_options(*)')
      .eq('order_id', orderId)
      .order('created_at');
    if (error) throw error;
    const items = (data || []) as OrderItem[];
    setOrderItems(current => ({ ...current, [orderId]: items }));
    return items;
  }, [orderItems]);

  useEffect(() => {
    fetchOrders();
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(fetchOrders, 350);
    };
    const channel = supabase
      .channel('cashier_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, scheduleFetch)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  useEffect(() => {
    const billChannel = supabase
      .channel('cashier_bill_jobs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'print_jobs', filter: 'type=eq.BILL' }, () => {
        feedback('print');
      })
      .subscribe();

    return () => { supabase.removeChannel(billChannel); };
  }, [feedback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setCashierTab('aenvoyer');
          break;
        case 'F2':
          e.preventDefault();
          setCashierTab('encaisser');
          break;
        case 'F3':
          e.preventDefault();
          if (canTakeOrders) setCashierTab('tables');
          break;
        case 'F4':
          e.preventDefault();
          setCashierTab('direct');
          break;
        case 'F5':
          e.preventDefault();
          if (canViewHistory) setCashierTab('historique');
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedOrder(null);
          setExpandedOrder(null);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [orders, selectedOrder, canTakeOrders, canViewHistory]);

  const handlePaymentDone = () => {
    setSelectedOrder(null);
    setExpandedOrder(null);
    feedback('payment');
    fetchOrders();
  };

  const handlePrintBill = async (order: Order) => {
    setPrintingBill(order.id);
    const tableNom = (order as any).table?.nom || 'Table';
    const { group, error } = await buildBillPrintGroup(order.id, tableNom);
    if (error || !group) {
      alert(error || 'Imprimante caisse introuvable');
      setPrintingBill(null);
      return;
    }
    await logPrintJobs([group], {
      orderId: order.id, tableId: order.table_id, tableNom,
      ticketNumber: order.ticket_number, userId: user?.id || '', type: 'BILL',
      total: order.total,
    });
    setPrintingBill(null);
    feedback('print');
  };

  const [waitingCount, setWaitingCount] = useState(0);

  const fetchWaitingCount = useCallback(async () => {
    const { count } = await supabase
      .from('print_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'WAITING_CASHIER');
    setWaitingCount(count || 0);
  }, []);

  useEffect(() => {
    fetchWaitingCount();
    const channel = supabase
      .channel('waiting_jobs_count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, fetchWaitingCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchWaitingCount]);

  const encaisserCount = orders.length;
  const billRequestedCount = orders.filter(order => (order as any).table?.statut === 'A_ENCAISSER').length;

  useEffect(() => {
    if (cashierTab === 'tables' && !canTakeOrders) setCashierTab('aenvoyer');
    if (cashierTab === 'historique' && !canViewHistory) setCashierTab('aenvoyer');
  }, [canTakeOrders, canViewHistory, cashierTab]);

  const allTabItems: { id: CashierTab; label: string; labelMobile: string; icon: any; badge?: number; shortcut?: string; visible: boolean }[] = [
    { id: 'aenvoyer', label: 'À envoyer', labelMobile: 'Envoi', icon: Send, badge: waitingCount || undefined, shortcut: 'F1', visible: true },
    { id: 'encaisser', label: 'À encaisser', labelMobile: 'Enc.', icon: CreditCard, badge: encaisserCount || undefined, shortcut: 'F2', visible: true },
    { id: 'tables', label: 'Prendre commande', labelMobile: 'Tables', icon: TableProperties, shortcut: 'F3', visible: canTakeOrders },
    { id: 'direct', label: 'Vente directe', labelMobile: 'Direct', icon: ShoppingBag, shortcut: 'F4', visible: true },
    { id: 'historique', label: 'Historique', labelMobile: 'Histo', icon: History, shortcut: 'F5', visible: canViewHistory },
    { id: 'depenses', label: 'Depenses', labelMobile: 'Dep.', icon: Wallet, visible: true },
    { id: 'cloture', label: 'Clôture', labelMobile: 'Caisse', icon: BookOpen, visible: true },
  ];

  const tabItems = allTabItems.filter(t => t.visible);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <UtensilsCrossed size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-none">THE WEST AFRICAN</p>
              <p className="text-xs text-gray-500 mt-0.5">Caisse</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void connectQzTray()} className={`hidden sm:flex items-center gap-1.5 text-[10px] font-bold ${qzConnected ? 'text-green-600' : 'text-amber-600'} hover:opacity-75 transition-opacity`} title={qzConnected ? 'QZ Tray connecté — cliquer pour reconnecter' : (qzReason || 'QZ Tray hors ligne — cliquer pour reconnecter')}>
              <span className={`w-2 h-2 rounded-full ${qzConnected ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
              {qzConnected ? 'QZ' : 'QZ hors ligne'}
            </button>
            {!qzConnected && qzReason && (
              <span className="hidden md:inline text-[9px] text-amber-600/80 max-w-[180px] truncate" title={qzReason}>
                {qzReason}
              </span>
            )}
            <LiveClock />
            {cashierTab === 'encaisser' && (
              <button onClick={fetchOrders} className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-amber-500 rounded-xl hover:bg-amber-50 transition-all">
                <RefreshCw size={16} />
              </button>
            )}
            <button
              onClick={() => setShowShortcuts(s => !s)}
              className="w-9 h-9 hidden sm:flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all"
              title="Raccourcis clavier"
            >
              <Keyboard size={16} />
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-gray-700">{user?.nom}</p>
              <p className="text-xs text-gray-400">Caissier</p>
            </div>
            <button onClick={logout} className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-all">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 mt-3 max-w-4xl mx-auto">
          {tabItems.map(tab => {
            const Icon = tab.icon;
            const isActive = cashierTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCashierTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.labelMobile}</span>
                {tab.shortcut && (
                  <span className={`hidden lg:inline text-xs px-1 py-0.5 rounded font-mono ${isActive ? 'bg-amber-400/50' : 'bg-gray-200 text-gray-500'}`}>{tab.shortcut}</span>
                )}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${isActive ? 'bg-white text-amber-600' : 'bg-orange-500 text-white'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {(cashierTab === 'encaisser' || cashierTab === 'aenvoyer') && <StatsBar />}

      <main className={`flex-1 overflow-hidden ${cashierTab !== 'direct' ? 'max-w-4xl mx-auto w-full overflow-y-auto scrollbar-thin' : 'w-full'}`}>
        {cashierTab === 'aenvoyer' && (
          <PendingOrdersView />
        )}

        {cashierTab === 'encaisser' && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold text-gray-900">Commandes actives</h1>
                <p className="text-xs text-gray-500 mt-0.5">Toutes les tables occupées et demandes d'addition</p>
              </div>
              {encaisserCount > 0 && (
                <div className="flex gap-2 text-xs">
                  <div className="flex items-center gap-1.5 bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    {encaisserCount} actives · {billRequestedCount} addition(s) demandée(s)
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <CreditCard size={24} className="text-green-500" />
                </div>
                <p className="text-gray-600 font-medium text-sm">Aucune commande en attente</p>
                <p className="text-gray-400 text-xs mt-1">Toutes les tables sont libres</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {orders.map(order => {
                  const isExpanded = expandedOrder === order.id;
                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-2xl overflow-hidden shadow-sm transition-all border-2 ${(order as any).table?.statut === 'A_ENCAISSER' ? 'border-orange-400' : 'border-gray-200'}`}
                    >
                      {(order as any).table?.statut === 'A_ENCAISSER' ? (
                        <div className="bg-orange-500 px-3 py-1 text-xs text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          Addition demandée
                        </div>
                      ) : (
                        <div className="bg-gray-100 px-3 py-1 text-xs text-gray-600 font-bold uppercase tracking-wider">
                          Commande en cours
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-900 text-base">{(order as any).table?.nom || 'Table'}</p>
                              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{order.ticket_number}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <p className="text-xs text-gray-500">{(order as any).serveur?.nom || '—'}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(order.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-gray-900 leading-none">{order.total.toLocaleString('fr-FR')}</p>
                            <p className="text-xs text-gray-400 mt-0.5">FCFA</p>
                            {paidAmounts[order.id] > 0 && (
                              <p className="text-xs text-green-600 font-semibold mt-0.5">
                                Payé: {paidAmounts[order.id].toLocaleString('fr-FR')} / {order.total.toLocaleString('fr-FR')} F
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => {
                              const nextExpanded = isExpanded ? null : order.id;
                              setExpandedOrder(nextExpanded);
                              if (nextExpanded) void loadOrderItems(nextExpanded);
                            }}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-semibold transition-all"
                          >
                            {isExpanded ? 'Masquer' : 'Détail'}
                          </button>
                          <button
                            onClick={() => handlePrintBill(order)}
                            disabled={printingBill === order.id}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1"
                          >
                            {printingBill === order.id
                              ? <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                              : <Printer size={12} />
                            }
                            Addition
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const items = await loadOrderItems(order.id);
                                setManageOrder({ ...order, items } as Order);
                              } catch {
                                alert('Impossible de charger les articles de la commande');
                              }
                            }}
                            className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-700 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          >
                            Gérer
                          </button>
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className={`flex-1 ${(order as any).table?.statut === 'A_ENCAISSER' ? 'bg-orange-500 hover:bg-orange-400' : 'bg-gray-900 hover:bg-gray-800'} text-white py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1`}
                          >
                            <CreditCard size={12} />
                            Encaisser
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-1.5">
                          {(orderItems[order.id] || []).map((item: OrderItem) => (
                            <div key={item.id} className="flex justify-between items-start text-xs">
                              <div className="flex-1 min-w-0">
                                <span className="text-gray-800 font-medium">{item.qty}× {item.nom_snapshot}</span>
                                {(item.options?.length || 0) > 0 && (
                                  <p className="text-amber-500 mt-0.5">{(item.options || []).map((o: any) => o.nom_snapshot).join(', ')}</p>
                                )}
                                {item.notes && <p className="text-gray-400 italic mt-0.5">"{item.notes}"</p>}
                              </div>
                              <span className="text-gray-600 font-semibold ml-3 whitespace-nowrap">
                                {(item.prix_snapshot * item.qty).toLocaleString('fr-FR')} F
                              </span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm">
                            <span className="text-gray-600">Total</span>
                            <span className="text-amber-600">{order.total.toLocaleString('fr-FR')} FCFA</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {cashierTab === 'tables' && (
          <CartProvider>
            <TableOrderSection />
          </CartProvider>
        )}
        {cashierTab === 'direct' && <POSLayout />}
        {cashierTab === 'historique' && <SalesHistoryView />}
        {cashierTab === 'depenses' && (
          <div className="px-4 py-4">
            <ExpensesView sessionId={activeSessionId} />
          </div>
        )}
        {cashierTab === 'cloture' && (
          <div className="px-4 py-4">
            <CashClosureView onZClose={fetchOrders} onZReturn={() => setCashierTab('encaisser')} />
          </div>
        )}
      </main>

      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Keyboard size={18} /> Raccourcis clavier</h3>
            <div className="space-y-2 text-sm">
              {[
                ['F1', 'À envoyer'],
                ['F2', 'À encaisser'],
                ['F3', 'Prendre commande'],
                ['F4', 'Vente directe'],
                ['F5', 'Historique'],
                ['Échap', 'Fermer modal'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-600">{label}</span>
                  <kbd className="px-2 py-1 bg-gray-100 rounded-lg font-mono text-xs font-semibold text-gray-700">{key}</kbd>
                </div>
              ))}
            </div>
            <button onClick={() => setShowShortcuts(false)} className="mt-5 w-full bg-gray-900 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-all">Fermer</button>
          </div>
        </div>
      )}

      {manageOrder && (
        <OrderManagerModal
          order={manageOrder as any}
          onClose={() => setManageOrder(null)}
          onRefresh={() => { fetchOrders(); setManageOrder(null); }}
        />
      )}
      {selectedOrder && selectedOrder.order_type === 'TABLE' && (
        <SplitBillModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDone={handlePaymentDone}
        />
      )}
      {selectedOrder && selectedOrder.order_type === 'DIRECT' && (
        <PaymentModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDone={handlePaymentDone}
        />
      )}

    </div>
  );
}
