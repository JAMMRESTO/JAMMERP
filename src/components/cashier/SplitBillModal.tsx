import { useState, useEffect, useCallback } from 'react';
import { X, Check, Banknote, CreditCard, Smartphone, Plus, Minus, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Order, OrderItem, PaymentMethod, PrintGroup, PrintLineItem, Printer } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useFeedback } from '../../hooks/useFeedback';
import { showToast } from '../shared/Toast';
import { getOrCreateSession } from '../../services/cashClosureService';
import { logPrintJobs } from '../../lib/printService';

interface Props {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: 'CASH', label: 'Espèces', icon: <Banknote size={20} /> },
  { id: 'CARD', label: 'Carte', icon: <CreditCard size={20} /> },
  { id: 'WAVE', label: 'Wave', icon: <Smartphone size={20} /> },
  { id: 'ORANGE_MONEY', label: 'Orange Money', icon: <Smartphone size={20} /> },
  { id: 'OTHER', label: 'Autre', icon: <CreditCard size={20} /> },
];

interface PaymentRecord {
  id: string;
  montant: number;
  method: PaymentMethod;
  created_at: string;
}

const CAISSE_PRINTER_KEY = 'restobar_caisse_printer';

function loadCaissePrinter(): Printer | null {
  try {
    const raw = sessionStorage.getItem(CAISSE_PRINTER_KEY);
    return raw ? JSON.parse(raw) as Printer : null;
  } catch { return null; }
}

function saveCaissePrinter(p: Printer) {
  try { sessionStorage.setItem(CAISSE_PRINTER_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

async function fetchCaissePrinter(): Promise<Printer | null> {
  const cached = loadCaissePrinter();
  if (cached) return cached;
  const { data } = await supabase
    .from('printers')
    .select('*')
    .eq('type', 'CAISSE')
    .eq('active', true)
    .maybeSingle();
  if (data) {
    saveCaissePrinter(data as Printer);
    return data as Printer;
  }
  return null;
}

export default function SplitBillModal({ order, onClose, onDone }: Props) {
  const { user } = useAuth();
  const { feedback } = useFeedback();
  const [items, setItems] = useState<(OrderItem & { options: any[] })[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [selections, setSelections] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [montantRecu, setMontantRecu] = useState('');
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [loading, setLoading] = useState(true);

  const tableNom = (order as any).table?.nom || 'Table';
  const ticketNumber = order.ticket_number;

  const fetchData = useCallback(async () => {
    const [itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('order_items')
        .select('*, options:order_item_options(*)')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('payments')
        .select('id, montant, method, created_at')
        .eq('order_id', order.id)
        .eq('pay_status', 'valid')
        .order('created_at', { ascending: true }),
    ]);

    const itemsData = (itemsRes.data || []) as unknown as (OrderItem & { options: any[] })[];
    const paymentsData = (paymentsRes.data || []) as unknown as PaymentRecord[];
    setItems(itemsData);
    setPayments(paymentsData);
    setLoading(false);
  }, [order.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const itemLineTotal = (item: OrderItem & { options: any[] }): number => {
    const optionsDelta = (item.options || []).reduce((s: number, o: any) => s + (o.prix_delta_snapshot || 0), 0);
    return (item.prix_snapshot + optionsDelta) * item.qty;
  };

  const itemUnitPrice = (item: OrderItem & { options: any[] }): number => {
    const optionsDelta = (item.options || []).reduce((s: number, o: any) => s + (o.prix_delta_snapshot || 0), 0);
    return item.prix_snapshot + optionsDelta;
  };

  const totalBill = items.reduce((s, i) => s + itemLineTotal(i), 0);
  const totalPaid = payments.reduce((s, p) => s + p.montant, 0);
  const remainingBalance = totalBill - totalPaid;

  const printableItems = items.filter(i => i.qty > 0);

  const remainingQty = (item: OrderItem): number => {
    return item.qty - (item.paid_qty || 0);
  };

  const selectedAmount = printableItems.reduce((s, item) => {
    const sel = selections[item.id] || 0;
    return s + sel * itemUnitPrice(item);
  }, 0);

  const hasSelection = Object.values(selections).some(v => v > 0);
  const allPaid = printableItems.length > 0 && printableItems.every(i => remainingQty(i) === 0);

  const handleSelectQty = (item: OrderItem & { options: any[] }, delta: number) => {
    const current = selections[item.id] || 0;
    const max = remainingQty(item);
    const next = Math.max(0, Math.min(max, current + delta));
    setSelections(prev => ({ ...prev, [item.id]: next }));
  };

  const handleSelectAll = () => {
    const newSel: Record<string, number> = {};
    printableItems.forEach(item => {
      const rem = remainingQty(item);
      if (rem > 0) newSel[item.id] = rem;
    });
    setSelections(newSel);
  };

  const handleClearSelection = () => {
    setSelections({});
  };

  const monnaie = method === 'CASH' && montantRecu
    ? Math.max(0, parseInt(montantRecu.replace(/\s/g, ''), 10) - selectedAmount)
    : 0;

  const canConfirm = !saving && hasSelection && selectedAmount > 0 &&
    !(method === 'CASH' && montantRecu !== '' && parseInt(montantRecu) < selectedAmount);

  const handlePay = async () => {
    if (!hasSelection) return;
    setSaving(true);
    try {
      const session = await getOrCreateSession({ userId: user?.id || '', openingFloat: 0 });

      const paidQtyUpdates = printableItems
        .filter(item => (selections[item.id] || 0) > 0)
        .map(item => ({
          id: item.id,
          paid_qty: (item.paid_qty || 0) + (selections[item.id] || 0),
        }));

      const tablePromise = order.table_id
        ? supabase.from('tables').select('statut').eq('id', order.table_id).maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [paymentRes, batchRes] = await Promise.all([
        supabase.from('payments').insert({
          order_id: order.id,
          mode: method === 'CASH' ? 'ESPECES' : 'AUTRE',
          method,
          montant: selectedAmount,
          reference,
          caissier_id: user?.id,
          session_id: session?.id || null,
          pay_status: 'valid',
          paid_at: new Date().toISOString(),
        }),
        supabase.rpc('batch_update_paid_qty', { items: paidQtyUpdates }),
      ]);

      if (paymentRes.error || batchRes.error) throw paymentRes.error || batchRes.error;

      // Fire-and-forget receipt printing
      void printSplitReceipt(selectedAmount).catch(err => console.error('Split receipt print error:', err));

      // Re-fetch items from DB to get accurate paid_qty values
      const { data: refreshedItems } = await supabase
        .from('order_items')
        .select('id, qty, paid_qty')
        .eq('order_id', order.id);

      const allItemsPaid = (refreshedItems || []).length > 0 && (refreshedItems || []).every(item => (item.paid_qty || 0) >= item.qty);

      if (allItemsPaid) {
        const { data: table } = await tablePromise;
        const shouldFreeTable = table?.statut === 'A_ENCAISSER';

        await Promise.all([
          supabase.from('orders').update({
            statut: 'PAYEE',
            updated_at: new Date().toISOString(),
          }).eq('id', order.id),
          shouldFreeTable
            ? supabase.from('tables').update({ statut: 'LIBRE', locked_by: null }).eq('id', order.table_id)
            : Promise.resolve(),
        ]);

        feedback('payment', 100);
        showToast('Addition entièrement réglée', 'success');
        onDone();
      } else {
        feedback('payment', 100);
        showToast(`Paiement partiel: ${selectedAmount.toLocaleString('fr-FR')} FCFA`, 'success');
        setSelections({});
        setMontantRecu('');
        setReference('');
        setMethod('CASH');
        await fetchData();
      }
    } catch (err) {
      showToast('Erreur lors du paiement', 'error');
    } finally {
      setSaving(false);
    }
  };

  const printSplitReceipt = async (amount: number) => {
    const caissePrinter = await fetchCaissePrinter();
    if (!caissePrinter) {
      showToast('Aucune imprimante caisse trouvée', 'error');
      return;
    }

    const selectedItems = printableItems
      .filter(item => (selections[item.id] || 0) > 0)
      .map(item => {
        const selQty = selections[item.id] || 0;
        const optionsDelta = (item.options || []).reduce((s: number, o: any) => s + (o.prix_delta_snapshot || 0), 0);
        const lineItem: PrintLineItem = {
          orderItemId: item.id,
          nom: item.nom_snapshot,
          qty: selQty,
          notes: item.notes || undefined,
          options: item.options?.length > 0 ? item.options.map((o: any) => o.nom_snapshot) : undefined,
          unitPrice: item.prix_snapshot + optionsDelta,
        };
        return lineItem;
      });

    const group: PrintGroup = {
      printer: caissePrinter,
      printerType: 'CAISSE',
      station: 'cashier',
      items: selectedItems,
    };

    await logPrintJobs([group], {
      orderId: order.id,
      tableId: order.table_id || null,
      tableNom,
      ticketNumber,
      userId: user?.id || '',
      type: 'RECEIPT',
      total: amount,
      montantRecu: method === 'CASH' && montantRecu ? parseInt(montantRecu.replace(/\s/g, ''), 10) : undefined,
      monnaie: method === 'CASH' ? monnaie : undefined,
      paymentMethod: method,
    });
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      let shouldFreeTable = false;
      if (order.table_id) {
        const { data: table } = await supabase
          .from('tables')
          .select('statut')
          .eq('id', order.table_id)
          .maybeSingle();
        shouldFreeTable = table?.statut === 'A_ENCAISSER';
      }

      await Promise.all([
        supabase.from('orders').update({
          statut: 'PAYEE',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id),
        shouldFreeTable
          ? supabase.from('tables').update({ statut: 'LIBRE', locked_by: null }).eq('id', order.table_id)
          : Promise.resolve(),
      ]);

      onDone();
    } catch {
      showToast('Erreur lors de la finalisation', 'error');
    } finally {
      setFinishing(false);
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000].filter(a => a >= selectedAmount);
  const displayed = [...new Set([selectedAmount, ...quickAmounts])].slice(0, 5);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Partage d'addition</h3>
            <p className="text-sm text-gray-500">{tableNom} · {ticketNumber}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500 font-medium">Total: {totalBill.toLocaleString('fr-FR')} F</span>
            <span className="text-green-600 font-semibold">Payé: {totalPaid.toLocaleString('fr-FR')} F</span>
            <span className="text-orange-600 font-semibold">Reste: {remainingBalance.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-green-500 rounded-full transition-all duration-500"
              style={{ width: `${totalBill > 0 ? (totalPaid / totalBill) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {allPaid ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={32} className="text-green-500" />
              </div>
              <p className="text-gray-900 font-bold text-lg">Addition entièrement réglée</p>
              <p className="text-gray-500 text-sm mt-1">Tous les articles ont été payés</p>
            </div>
          ) : payments.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Paiements déjà effectués</p>
              <div className="space-y-1.5">
                {payments.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-green-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{i + 1}</span>
                      <span className="text-xs text-gray-600">Client {i + 1}</span>
                    </div>
                    <span className="text-sm font-bold text-green-700">{p.montant.toLocaleString('fr-FR')} F</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!allPaid && (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Articles à payer</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    onClick={handleClearSelection}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Effacer
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {printableItems.map(item => {
                  const remQty = remainingQty(item);
                  const selQty = selections[item.id] || 0;
                  const isFullyPaid = remQty === 0;
                  const unitP = itemUnitPrice(item);

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border-2 transition-all ${
                        isFullyPaid
                          ? 'border-green-200 bg-green-50 opacity-60'
                          : selQty > 0
                            ? 'border-amber-400 bg-amber-50'
                            : 'border-gray-100 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between p-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 text-sm">{item.nom_snapshot}</p>
                            {isFullyPaid && (
                              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">Payé</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {unitP.toLocaleString('fr-FR')} F
                            {item.options?.length > 0 && ` · ${item.options.map((o: any) => o.nom_snapshot).join(', ')}`}
                          </p>
                          {item.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>}
                        </div>

                        {!isFullyPaid && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleSelectQty(item, -1)}
                              disabled={selQty === 0}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition-all"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="font-bold text-gray-900 text-sm w-8 text-center">{selQty}</span>
                            <button
                              onClick={() => handleSelectQty(item, 1)}
                              disabled={selQty >= remQty}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 hover:bg-amber-200 disabled:opacity-30 transition-all"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {selQty > 0 && !isFullyPaid && (
                        <div className="px-3 pb-2 -mt-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-600 font-medium">Sous-total: {selQty}/{remQty} restant</span>
                            <span className="text-amber-700 font-bold">{(selQty * unitP).toLocaleString('fr-FR')} F</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Payment section */}
        {!allPaid && (
          <div className="flex-shrink-0 border-t border-gray-100 bg-white rounded-b-3xl sm:rounded-b-2xl">
            {hasSelection && (
              <div className="px-6 pt-3 pb-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Ticket client</span>
                  <span className="text-2xl font-bold text-amber-600">{selectedAmount.toLocaleString('fr-FR')} F</span>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Mode de paiement</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {METHODS.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all ${method === m.id ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}
                      >
                        <span className={method === m.id ? 'text-amber-500' : 'text-gray-400'}>{m.icon}</span>
                        <span className={`text-[10px] font-semibold leading-tight text-center ${method === m.id ? 'text-amber-700' : 'text-gray-500'}`}>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {method === 'CASH' && (
                  <div className="mt-3">
                    <input
                      type="number"
                      value={montantRecu}
                      onChange={e => setMontantRecu(e.target.value)}
                      placeholder="Montant reçu..."
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-base font-bold focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {displayed.map(amount => (
                        <button
                          key={amount}
                          onClick={() => setMontantRecu(amount.toString())}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            parseInt(montantRecu) === amount ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-700 hover:border-amber-300'
                          }`}
                        >
                          {amount === selectedAmount ? 'Exact' : `${amount.toLocaleString('fr-FR')}`}
                        </button>
                      ))}
                    </div>
                    {montantRecu && parseInt(montantRecu) >= selectedAmount && (
                      <div className="mt-2 flex justify-between items-center bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                        <span className="text-xs font-medium text-green-700">Monnaie</span>
                        <span className="text-lg font-bold text-green-700">{monnaie.toLocaleString('fr-FR')} F</span>
                      </div>
                    )}
                  </div>
                )}

                {method !== 'CASH' && (
                  <input
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="Référence (optionnel)..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-3 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  />
                )}
              </div>
            )}

            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-3.5 rounded-2xl font-semibold transition-all">
                  Fermer
                </button>
                <button
                  onClick={handlePay}
                  disabled={!canConfirm}
                  className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Check size={18} />
                  {saving ? 'En cours...' : hasSelection ? `Encaisser ${selectedAmount.toLocaleString('fr-FR')} F` : 'Encaisser'}
                </button>
              </div>
            </div>
          </div>
        )}

        {allPaid && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 bg-white rounded-b-3xl sm:rounded-b-2xl">
            <button onClick={handleFinish} disabled={finishing} className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white py-3.5 rounded-2xl font-bold transition-all active:scale-95">
              {finishing ? 'Finalisation...' : 'Terminer'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

