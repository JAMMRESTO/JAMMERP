import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, ShoppingBag, UtensilsCrossed, ChevronDown, ChevronUp, Printer, Calendar, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, OrderItem } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { buildBillPrintGroup, logPrintJobs } from '../../lib/printService';
import { showToast } from '../shared/Toast';
import { getBusinessDayRange } from '../../lib/businessDay';

type PeriodId = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface PeriodOption {
  id: PeriodId;
  label: string;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: 'week', label: 'Cette semaine' },
  { id: 'month', label: 'Ce mois' },
  { id: 'custom', label: 'Personnalisé' },
];

function getRangeForPeriod(period: PeriodId, customStart: string, customEnd: string): { start: Date; end: Date } {
  if (period === 'custom') {
    const start = customStart ? new Date(customStart + 'T00:00:00') : new Date(0);
    let end = customEnd ? new Date(customEnd + 'T23:59:59.999') : new Date();
    if (end < start) end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }

  const now = new Date();

  if (period === 'today') {
    return getBusinessDayRange(now);
  }

  if (period === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return getBusinessDayRange(yesterday);
  }

  const todayRange = getBusinessDayRange(now);

  if (period === 'week') {
    const start = new Date(todayRange.start);
    const dow = start.getDay();
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));
    return { start, end: todayRange.end };
  }

  if (period === 'month') {
    const start = new Date(todayRange.start);
    start.setDate(1);
    return { start, end: todayRange.end };
  }

  return todayRange;
}

function formatRangeLabel(start: Date, end: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  if (start.toDateString() === end.toDateString()) return fmt(start);
  return `${fmt(start)} — ${fmt(end)}`;
}

export default function SalesHistoryView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodId>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const { user } = useAuth();

  const initialLoadDone = useRef(true);

  const fetchOrders = useCallback(async () => {
    const { start, end } = getRangeForPeriod(period, customStart, customEnd);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    const { data } = await supabase
      .from('orders')
      .select('*, table:tables(nom), serveur:users!orders_serveur_id_fkey(nom), caissier:users!orders_caissier_id_fkey(nom), items:order_items(*, options:order_item_options(*))')
      .in('statut', ['PAYEE', 'VALIDE', 'ANNULEE', 'CLOTUREE'])
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
      .limit(500);

    setOrders(data || []);
    if (initialLoadDone.current) {
      setLoading(false);
      initialLoadDone.current = false;
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const totalPaye = orders
    .filter(o => o.statut === 'PAYEE' || o.statut === 'CLOTUREE')
    .reduce((sum, o) => sum + (o.total || 0), 0);

  const paidCount = orders.filter(o => o.statut === 'PAYEE' || o.statut === 'CLOTUREE').length;
  const cancelledCount = orders.filter(o => o.statut === 'ANNULEE').length;
  const pendingCount = orders.filter(o => o.statut === 'VALIDE').length;

  const handleReprintReceipt = async (order: Order) => {
    setPrintingOrderId(order.id);
    try {
      const tableNom = (order as any).table?.nom || 'Vente directe';
      const { group, error } = await buildBillPrintGroup(order.id, tableNom);
      if (error || !group) {
        showToast(error || 'Imprimante caisse introuvable', 'error');
        return;
      }
      await logPrintJobs([group], {
        orderId: order.id,
        tableId: order.table_id,
        tableNom,
        ticketNumber: order.ticket_number,
        userId: user?.id || '',
        type: 'RECEIPT',
        total: order.total,
      });
      showToast('Reçu réimprimé', 'print');
    } catch {
      showToast('Erreur lors de la réimpression', 'error');
    } finally {
      setPrintingOrderId(null);
    }
  };

  const statusColor: Record<string, string> = {
    PAYEE: 'bg-green-100 text-green-700',
    CLOTUREE: 'bg-gray-200 text-gray-700',
    VALIDE: 'bg-blue-100 text-blue-700',
    ANNULEE: 'bg-red-100 text-red-600',
    BROUILLON: 'bg-gray-100 text-gray-600',
  };

  const statusLabel: Record<string, string> = {
    PAYEE: 'Payée',
    CLOTUREE: 'Clôturée',
    VALIDE: 'En cours',
    ANNULEE: 'Annulée',
    BROUILLON: 'Brouillon',
  };

  const { start: currentStart, end: currentEnd } = getRangeForPeriod(period, customStart, customEnd);

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Historique des ventes</h2>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <Calendar size={11} />
              {formatRangeLabel(currentStart, currentEnd)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-xs text-gray-500">Total encaissé</p>
              <p className="font-bold text-green-600 text-sm">{totalPaye.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <button onClick={fetchOrders} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-amber-500 rounded-xl hover:bg-amber-50 transition-all">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
            {PERIOD_OPTIONS.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setPeriod(p.id);
                  setShowCustomPicker(p.id === 'custom');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  period === p.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {showCustomPicker && (
          <div className="mt-3 flex items-end gap-3 flex-wrap bg-gray-50 rounded-xl p-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Date début</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">Date fin</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              onClick={fetchOrders}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all"
            >
              <Filter size={14} />
              Appliquer
            </button>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600 font-medium">
            {paidCount} encaissée{paidCount > 1 ? 's' : ''}
          </span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-blue-600 font-medium">
              {pendingCount} en cours
            </span>
          )}
          {cancelledCount > 0 && (
            <span className="flex items-center gap-1 text-red-500 font-medium">
              {cancelledCount} annulée{cancelledCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Calendar size={32} className="text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm">Aucune commande pour cette période</p>
        </div>
      ) : (
        <div className="px-4 pb-4 space-y-2">
          {orders.map(order => {
            const isExpanded = expandedOrder === order.id;
            const isDirect = order.order_type === 'DIRECT';
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${isDirect ? 'bg-blue-100' : 'bg-amber-100'}`}>
                          {isDirect
                            ? <ShoppingBag size={12} className="text-blue-600" />
                            : <UtensilsCrossed size={12} className="text-amber-600" />
                          }
                        </div>
                        <p className="font-bold text-gray-900 text-sm">
                          {isDirect ? 'Vente directe' : ((order as any).table?.nom || 'Table')}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor[order.statut] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[order.statut] || order.statut}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{order.ticket_number}</p>
                      <p className="text-xs text-gray-400">
                        {isDirect
                          ? `Caissier: ${(order as any).caissier?.nom || '—'}`
                          : `Serveur: ${(order as any).serveur?.nom || '—'}`
                        }
                      </p>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {new Date(order.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right ml-4 flex flex-col items-end gap-2">
                      <p className="font-bold text-gray-900">{order.total.toLocaleString('fr-FR')} <span className="text-xs text-gray-500 font-normal">FCFA</span></p>
                      <div className="flex items-center gap-2">
                        {(order.statut === 'PAYEE' || order.statut === 'CLOTUREE') && (
                          <button
                            onClick={() => handleReprintReceipt(order)}
                            disabled={printingOrderId === order.id}
                            className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 disabled:opacity-50 transition-all"
                          >
                            {printingOrderId === order.id
                              ? <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                              : <Printer size={14} />}
                            Réimprimer
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-500 transition-all"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          {isExpanded ? 'Masquer' : 'Détail'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                    {((order as any).items || []).map((item: OrderItem & { options: any[] }) => (
                      <div key={item.id} className="flex justify-between items-start text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-800 font-medium">{item.qty}× {item.nom_snapshot}</span>
                          {item.options?.length > 0 && (
                            <p className="text-xs text-amber-500 mt-0.5">{item.options.map((o: any) => o.nom_snapshot).join(', ')}</p>
                          )}
                          {item.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>}
                        </div>
                        <span className="text-gray-600 font-semibold ml-4 whitespace-nowrap text-xs">
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
  );
}
