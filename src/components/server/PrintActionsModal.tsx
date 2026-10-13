import { useState } from 'react';
import { X, Printer, RotateCcw, SendHorizontal as SendHorizonal, Trash2, ChevronDown, Ban, AlertTriangle } from 'lucide-react';
import { Order, OrderItem } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { reprintOrder, resendToKitchen, cancelLastOrderItem, updateOrderItemQuantity, buildBillPrintGroup, logPrintJobs } from '../../lib/printService';
import { showToast } from '../shared/Toast';
import { supabase } from '../../lib/supabase';
import { logActivity } from '../../lib/activityLogger';

interface Props {
  order: Order & { table?: { nom: string }; items?: OrderItem[] };
  onClose: () => void;
  onRefresh: () => void;
}

export default function PrintActionsModal({ order, onClose, onRefresh }: Props) {
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelItemId, setCancelItemId] = useState<string | null>(null);
  const [showCancelPicker, setShowCancelPicker] = useState(false);
  const [showCancelOrderConfirm, setShowCancelOrderConfirm] = useState(false);

  const canCancelOrder = hasPermission('can_cancel_orders');

  const tableNom = (order as any).table?.nom || 'Table';
  const ticketNumber = order.ticket_number;
  const tableId = order.table_id || undefined;

  const items: OrderItem[] = (order as any).items || [];
  const printableItems = items.filter(i => i.qty > 0);
  const isPaid = order.statut === 'PAYEE' || order.statut === 'CLOTUREE';

  const handleReprint = async () => {
    setLoading('reprint');
    try {
      if (isPaid) {
        const { group, error } = await buildBillPrintGroup(order.id, tableNom);
        if (error || !group) throw new Error(error || 'Imprimante caisse introuvable');
        await logPrintJobs([group], {
          orderId: order.id,
          tableId: order.table_id,
          tableNom,
          ticketNumber,
          userId: user?.id || '',
          type: 'RECEIPT',
          total: order.total,
        });
      } else {
        await reprintOrder(order.id, tableNom, ticketNumber, user?.id || '', tableId);
      }
      showToast(isPaid ? 'Reçu réimprimé' : 'Ticket réimprimé', 'print');
      onRefresh();
    } finally {
      setLoading(null);
    }
  };

  const handleResend = async () => {
    setLoading('resend');
    try {
      await resendToKitchen(order.id, tableNom, ticketNumber, user?.id || '', tableId);
      showToast('Articles non imprimés renvoyés en cuisine', 'print');
      onRefresh();
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelItemId) return;
    setLoading('cancel');
    try {
      await cancelLastOrderItem(order.id, cancelItemId, tableNom, ticketNumber, user?.id || '', tableId);
      showToast('Article annulé', 'success');
      setCancelItemId(null);
      setShowCancelPicker(false);
      onRefresh();
    } catch (error: any) {
      showToast(error?.message || 'Impossible d’annuler l’article', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleQuantityChange = async (item: OrderItem, quantity: number) => {
    if (quantity < 0 || quantity > 100 || quantity === item.qty) return;
    setLoading(`quantity-${item.id}`);
    try {
      if (quantity === 0) {
        await cancelLastOrderItem(order.id, item.id, tableNom, ticketNumber, user?.id || '', tableId);
      } else {
        await updateOrderItemQuantity(item.id, quantity);
      }
      showToast(quantity === 0 ? 'Article annulé' : 'Quantité mise à jour', 'success');
      onRefresh();
    } catch (error: any) {
      showToast(error?.message || 'Impossible de modifier l’article', 'error');
    } finally {
      setLoading(null);
    }
  };

  const handleCancelOrder = async () => {
    setLoading('cancel_order');
    try {
      await supabase
        .from('orders')
        .update({ statut: 'ANNULEE' })
        .eq('id', order.id);

      if (tableId) {
        await supabase
          .from('tables')
          .update({ statut: 'LIBRE', locked_by: null })
          .eq('id', tableId);
      }

      await logActivity(
        user?.id || '',
        'CANCEL_ORDER',
        'order',
        order.id,
        `Commande ${ticketNumber} annulée sur ${tableNom}`
      );

      showToast('Commande annulée', 'success');
      onRefresh();
      onClose();
    } finally {
      setLoading(null);
    }
  };

  const selectedItem = printableItems.find(i => i.id === cancelItemId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-black text-gray-900 text-lg">Gérer la commande</h3>
            <p className="text-sm text-amber-600 font-semibold">{tableNom} · {ticketNumber}</p>
            <p className="text-xs text-gray-500 mt-1">Réimprimer, renvoyer ou annuler des articles</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleReprint}
            disabled={!!loading}
            className="w-full bg-gray-900 active:bg-gray-800 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            {loading === 'reprint'
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Printer size={18} />
            }
            Réimprimer tout le ticket
          </button>

          {!isPaid && <button
            onClick={handleResend}
            disabled={!!loading}
            className="w-full bg-blue-500 active:bg-blue-600 disabled:opacity-50 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
          >
            {loading === 'resend'
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <SendHorizonal size={18} />
            }
            Renvoyer non-imprimés en cuisine
          </button>}

          {!isPaid && <div className="border border-rose-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowCancelPicker(v => !v)}
              disabled={!!loading || printableItems.length === 0}
              className="w-full bg-rose-50 active:bg-rose-100 disabled:opacity-50 py-4 px-4 font-bold text-sm text-rose-700 flex items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={18} />
                Annuler un article
              </div>
              <ChevronDown
                size={16}
                className={`text-rose-400 transition-transform ${showCancelPicker ? 'rotate-180' : ''}`}
              />
            </button>

            {showCancelPicker && (
              <div className="border-t border-rose-100 bg-white">
                <div className="px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
                  {printableItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-gray-700">
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold">{item.nom_snapshot}</span>
                        {item.printed_qty > 0 && (
                          <span className="ml-2 text-xs text-amber-600 font-medium">(déjà imprimé)</span>
                        )}
                      </div>
                      <button
                        onClick={() => setCancelItemId(item.id)}
                        disabled={!!loading}
                        className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 font-bold disabled:opacity-40"
                        aria-label={`Annuler ${item.nom_snapshot}`}
                      >×</button>
                      <button
                        onClick={() => handleQuantityChange(item, item.qty - 1)}
                        disabled={!!loading || item.qty <= 1}
                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold disabled:opacity-40"
                        aria-label={`Diminuer ${item.nom_snapshot}`}
                      >−</button>
                      <span className="w-6 text-center font-black">{item.qty}</span>
                      <button
                        onClick={() => handleQuantityChange(item, item.qty + 1)}
                        disabled={!!loading || item.qty >= 100}
                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 font-bold disabled:opacity-40"
                        aria-label={`Augmenter ${item.nom_snapshot}`}
                      >+</button>
                    </div>
                  ))}
                </div>
                {cancelItemId && (
                  <div className="px-4 pb-4 pt-2 border-t border-rose-50">
                    <p className="text-xs text-gray-500 mb-2">
                      Annuler : <span className="font-bold text-rose-600">{selectedItem?.qty}× {selectedItem?.nom_snapshot}</span>
                      {selectedItem && selectedItem.printed_qty > 0 && ' — un ticket d\'annulation sera imprimé'}
                    </p>
                    <button
                      onClick={handleCancel}
                      disabled={!!loading}
                      className="w-full bg-rose-500 active:bg-rose-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      {loading === 'cancel'
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <RotateCcw size={15} />
                      }
                      Confirmer l'annulation
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>}

          {!isPaid && canCancelOrder && (
            <div className="border border-red-300 rounded-2xl overflow-hidden">
              {!showCancelOrderConfirm ? (
                <button
                  onClick={() => setShowCancelOrderConfirm(true)}
                  disabled={!!loading}
                  className="w-full bg-red-600 active:bg-red-700 disabled:opacity-50 text-white py-4 px-4 font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  <Ban size={18} />
                  Annuler toute la commande
                </button>
              ) : (
                <div className="bg-red-50 px-4 py-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-red-700 text-sm">Confirmer l'annulation</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        La commande <span className="font-bold">{ticketNumber}</span> sera annulée et la table <span className="font-bold">{tableNom}</span> sera libérée. Cette action est irréversible.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelOrderConfirm(false)}
                      disabled={!!loading}
                      className="flex-1 bg-white border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
                    >
                      Retour
                    </button>
                    <button
                      onClick={handleCancelOrder}
                      disabled={!!loading}
                      className="flex-1 bg-red-600 active:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    >
                      {loading === 'cancel_order'
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Ban size={15} />
                      }
                      Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
