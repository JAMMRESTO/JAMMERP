import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Trash2, Plus, Minus, CheckCircle, Receipt,
  AlertCircle, Printer, RefreshCw, StickyNote, X, Send,
} from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  buildPrintGroupsFromOrderItems,
  createPrintJobs,
  markItemsAsPrinted,
  dispatchOrderPrint,
} from '../../lib/printService';
import { showToast } from '../shared/Toast';

interface Props { onOrderPlaced: () => void; }

interface UnprintedInfo {
  hasUnprinted: boolean;
  orderId: string | null;
  ticketNumber: string;
  total: number;
}

export default function CartSheet({ onOrderPlaced }: Props) {
  const { cart, activeTable, removeFromCart, updateQty, updateCartItemNotes, clearCart, cartTotal } = useCart();
  const { user } = useAuth();
  const [action, setAction] = useState<'validate' | 'addition' | 'addons' | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [unprintedInfo, setUnprintedInfo] = useState<UnprintedInfo>({ hasUnprinted: false, orderId: null, ticketNumber: '', total: 0 });
  const [expandedNote, setExpandedNote] = useState<number | null>(null);
  const [pendingNotes, setPendingNotes] = useState<Record<number, string>>({});
  const submittingRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const vibrate = (pattern: number | number[]) => {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  };

  const checkUnprinted = useCallback(async () => {
    if (!activeTable) { setUnprintedInfo({ hasUnprinted: false, orderId: null, ticketNumber: '', total: 0 }); return; }
    const { data: order } = await supabase
      .from('orders')
      .select('id, ticket_number, total, items:order_items(id, qty, printed_qty)')
      .eq('table_id', activeTable.id)
      .in('statut', ['BROUILLON', 'VALIDE'])
      .maybeSingle();
    if (!order) { setUnprintedInfo({ hasUnprinted: false, orderId: null, ticketNumber: '', total: 0 }); return; }
    const hasUnprinted = (order.items || []).some((i: any) => i.qty > i.printed_qty);
    setUnprintedInfo({ hasUnprinted, orderId: order.id, ticketNumber: order.ticket_number || '', total: order.total || 0 });
  }, [activeTable]);

  useEffect(() => {
    if (!activeTable) return;
    checkUnprinted();
    const channel = supabase
      .channel('cart_unprinted')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(checkUnprinted, 400);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(checkUnprinted, 400);
      })
      .subscribe();
    return () => {
      clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [checkUnprinted, activeTable]);

  const handleValidate = async () => {
    if (!activeTable || cart.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setAction('validate');
    setPrintError(null);

    const cartSnapshot = [...cart];
    clearCart();
    setPendingNotes({});
    vibrate([30, 50, 80]);
    showToast('Commande envoyée aux imprimantes', 'success');
    onOrderPlaced();
    setAction(null);
    submittingRef.current = false;

    dispatchOrderPrint({
      cart: cartSnapshot,
      tableId: activeTable.id,
      tableNom: activeTable.nom,
      userId: user?.id || '',
      type: 'INITIAL',
      waitForCashier: false,
    }).then(result => {
      if (result.missingCategories.length > 0) {
        setPrintError(`Catégories sans imprimante : ${result.missingCategories.join(', ')}`);
      }
    }).catch(err => {
      console.error('handleValidate error:', err);
      setPrintError('Erreur lors de l\'envoi de la commande');
    });
  };

  const handleImprimeAjouts = async () => {
    if (!unprintedInfo.orderId || submittingRef.current) return;
    submittingRef.current = true;
    setAction('addons');

    try {
      const { groups, missingCategories } = await buildPrintGroupsFromOrderItems(unprintedInfo.orderId, true);
      if (missingCategories.length > 0) {
        setPrintError(`Catégories sans imprimante : ${missingCategories.join(', ')}`);
        return;
      }

      const { data: unprintedItems } = await supabase.from('order_items').select('id, qty, printed_qty').eq('order_id', unprintedInfo.orderId);
      const toMark = (unprintedItems || []).filter(i => i.qty > i.printed_qty).map(i => i.id);

      await createPrintJobs(groups, {
        orderId: unprintedInfo.orderId,
        tableId: activeTable!.id,
        tableNom: activeTable!.nom,
        ticketNumber: unprintedInfo.ticketNumber,
        userId: user?.id || '',
        type: 'ADDONS',
      }, false);

      await markItemsAsPrinted(toMark);

      vibrate([30, 50, 80]);
      showToast('Ajouts envoyés aux imprimantes', 'success');
      setUnprintedInfo(u => ({ ...u, hasUnprinted: false }));
    } catch (err) {
      console.error('handleImprimeAjouts error:', err);
      setPrintError('Erreur lors de l\'envoi des ajouts');
    } finally {
      setAction(null);
      submittingRef.current = false;
    }
  };

  const handleAddition = async () => {
    if (!activeTable || submittingRef.current) return;
    submittingRef.current = true;
    setAction('addition');
    setPrintError(null);

    try {
      let orderId = unprintedInfo.orderId;
      let ticketNumber = unprintedInfo.ticketNumber;

      if (cart.length > 0) {
        const result = await dispatchOrderPrint({
          cart: [...cart],
          tableId: activeTable.id,
          tableNom: activeTable.nom,
          userId: user?.id || '',
          type: 'INITIAL',
          existingOrderId: orderId || undefined,
          existingTicketNumber: ticketNumber || undefined,
          waitForCashier: false,
        });

        if (result.missingCategories.length > 0) {
          setPrintError(`Catégories sans imprimante : ${result.missingCategories.join(', ')}`);
          return;
        }

        orderId = result.orderId;
        ticketNumber = result.ticketNumber;
        clearCart();
        setPendingNotes({});
      }

      if (!orderId) {
        const { data: existingOrder } = await supabase.from('orders').select('id, ticket_number, total').eq('table_id', activeTable.id).in('statut', ['BROUILLON', 'VALIDE']).maybeSingle();
        orderId = existingOrder?.id || null;
        ticketNumber = existingOrder?.ticket_number || '';
      }

      if (orderId) {
        await supabase.from('orders').update({ statut: 'VALIDE', updated_at: new Date().toISOString() }).eq('id', orderId);
      }
      await supabase.from('tables').update({ statut: 'A_ENCAISSER', locked_by: null }).eq('id', activeTable.id);

      vibrate([30, 50, 80]);
      showToast('Addition demandée — le caissier va s\'en occuper', 'success');
      onOrderPlaced();
    } catch (err) {
      console.error('handleAddition error:', err);
      setPrintError('Erreur lors de la demande d\'addition');
    } finally {
      setAction(null);
      submittingRef.current = false;
    }
  };

  if (!activeTable) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-amber-400" />
        </div>
        <p className="text-gray-700 font-semibold">Aucune table sélectionnée</p>
        <p className="text-gray-400 text-sm mt-1">Sélectionnez une table dans l'onglet Tables</p>
      </div>
    );
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="flex flex-col pb-48">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <ShoppingCart size={20} className="text-amber-500" />
              Panier
            </h2>
            <p className="text-sm font-bold text-amber-600 mt-0.5">{activeTable.nom}</p>
          </div>
          <div className="flex items-center gap-2">
            {unprintedInfo.hasUnprinted && (
              <button
                onClick={handleImprimeAjouts}
                disabled={!!action}
                className="flex items-center gap-1.5 bg-blue-500 active:bg-blue-600 text-white text-xs font-bold px-3 py-2.5 rounded-xl transition-all disabled:opacity-50"
              >
                {action === 'addons'
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send size={13} />}
                Envoyer ajouts
              </button>
            )}
            {unprintedInfo.orderId && !unprintedInfo.hasUnprinted && (
              <button onClick={checkUnprinted} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-amber-500 rounded-xl">
                <RefreshCw size={15} />
              </button>
            )}
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-rose-500 font-semibold flex items-center gap-1 px-2 py-1">
                <Trash2 size={13} /> Vider
              </button>
            )}
          </div>
        </div>
      </div>

      {printError && (
        <div className="mx-4 mb-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertCircle size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-bold text-red-700">Erreur d'envoi</p>
            <p className="text-xs text-red-600 mt-0.5">{printError}</p>
          </div>
          <button onClick={() => setPrintError(null)} className="text-red-400"><X size={14} /></button>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart size={26} className="text-gray-300" />
          </div>
          <p className="text-gray-600 font-semibold">Panier vide</p>
          <p className="text-gray-400 text-sm mt-1">Ajoutez des produits depuis le menu</p>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {cart.map((item, index) => {
            const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
            const lineTotal = (item.product.prix + optTotal) * item.qty;
            const isNoteOpen = expandedNote === index;
            const noteValue = pendingNotes[index] !== undefined ? pendingNotes[index] : item.notes;

            return (
              <div key={index} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-start gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-snug">{item.product.nom}</p>
                    {item.selectedOptions.length > 0 && (
                      <p className="text-xs text-amber-600 font-medium mt-0.5">{item.selectedOptions.map(o => o.nom).join(', ')}</p>
                    )}
                    {noteValue && !isNoteOpen && (
                      <p className="text-xs text-gray-400 italic mt-0.5 truncate">"{noteValue}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setExpandedNote(isNoteOpen ? null : index)}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isNoteOpen || noteValue ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-gray-400'}`}
                    >
                      <StickyNote size={14} />
                    </button>
                    <button onClick={() => removeFromCart(index)} className="w-8 h-8 flex items-center justify-center text-rose-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isNoteOpen && (
                  <div className="px-4 pb-3 -mt-1">
                    <textarea
                      value={noteValue}
                      rows={2}
                      onChange={(e) => setPendingNotes(prev => ({ ...prev, [index]: e.target.value }))}
                      onBlur={() => {
                        if (pendingNotes[index] !== undefined) {
                          updateCartItemNotes(index, pendingNotes[index]);
                        }
                      }}
                      className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-400 bg-amber-50/50 resize-none placeholder-gray-400"
                      placeholder="Note pour la cuisine (ex: sans oignon, bien cuit)..."
                    />
                  </div>
                )}

                <div className="flex items-center justify-between px-4 pb-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => { vibrate(20); updateQty(index, item.qty - 1); }}
                      className="w-10 h-10 bg-gray-100 active:bg-gray-200 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="font-black text-gray-900 text-lg w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => { vibrate(20); updateQty(index, item.qty + 1); }}
                      className="w-10 h-10 bg-amber-100 active:bg-amber-200 text-amber-600 rounded-2xl flex items-center justify-center transition-all active:scale-95"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <span className="font-black text-gray-900 text-base">{lineTotal.toLocaleString('fr-FR')} F</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4">
          <div className="max-w-2xl mx-auto space-y-2">
            <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs">{cartCount} article(s)</p>
                <p className="text-white font-black text-lg leading-none">{cartTotal.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <button
                onClick={handleAddition}
                disabled={!!action}
                className="bg-rose-500 active:bg-rose-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all active:scale-95"
              >
                {action === 'addition'
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Receipt size={15} />}
                Addition
              </button>
            </div>

            <button
              onClick={handleValidate}
              disabled={!!action}
              className="w-full bg-green-500 active:bg-green-600 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-2xl"
            >
              {action === 'validate'
                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <CheckCircle size={22} strokeWidth={2.5} />}
              ENVOYER EN CUISINE
            </button>
          </div>
        </div>
      )}

      {cart.length === 0 && ['OCCUPEE', 'A_ENCAISSER'].includes(activeTable.statut) && (
        <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4">
          <div className="max-w-2xl mx-auto space-y-2">
            {unprintedInfo.hasUnprinted && (
              <button
                onClick={handleImprimeAjouts}
                disabled={!!action}
                className="w-full bg-blue-500 active:bg-blue-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl"
              >
                {action === 'addons'
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Printer size={18} />}
                Envoyer les ajouts
              </button>
            )}
            <button
              onClick={handleAddition}
              disabled={!!action}
              className="w-full bg-rose-500 active:bg-rose-600 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-2xl"
            >
              {action === 'addition'
                ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Receipt size={22} />}
              Demander addition
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
