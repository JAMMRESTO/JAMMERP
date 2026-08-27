import { useState } from 'react';
import { X, Banknote, CreditCard, Smartphone, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PaymentMethod } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { buildBillPrintGroup, logPrintJobs, buildPrintGroupsFromOrderItems, markItemsAsPrinted } from '../../lib/printService';
import { getOrCreateSession } from '../../services/cashClosureService';

interface Props {
  orderId: string;
  ticketNumber: string;
  total: number;
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

export default function DirectPaymentModal({ orderId, ticketNumber, total, onClose, onDone }: Props) {
  const { user } = useAuth();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [montantRecu, setMontantRecu] = useState('');
  const [saving, setSaving] = useState(false);

  const monnaie = method === 'CASH' && montantRecu
    ? Math.max(0, parseInt(montantRecu.replace(/\s/g, ''), 10) - total)
    : 0;

  const handlePay = async () => {
    setSaving(true);
    try {
      const session = await getOrCreateSession({ userId: user?.id || '', openingFloat: 0 });

      const receivedAmount = method === 'CASH' && montantRecu
        ? parseInt(montantRecu.replace(/\s/g, ''), 10)
        : undefined;

      const [{ error: paymentError }, { error: orderError }] = await Promise.all([
        supabase.from('payments').insert({
          order_id: orderId,
          mode: method === 'CASH' ? 'ESPECES' : 'AUTRE',
          method,
          montant: total,
          reference,
          caissier_id: user?.id,
          session_id: session?.id || null,
          pay_status: 'valid',
          paid_at: new Date().toISOString(),
        }),
        supabase.from('orders').update({
          statut: 'PAYEE',
          updated_at: new Date().toISOString(),
        }).eq('id', orderId),
      ]);

      if (paymentError || orderError) throw paymentError || orderError;
      onDone();

      void (async () => {
        const { group } = await buildBillPrintGroup(orderId, 'Vente directe');
        if (group) {
          await logPrintJobs([group], {
            orderId, tableId: null, tableNom: 'Vente directe',
            ticketNumber, userId: user?.id || '', type: 'RECEIPT',
            total, montantRecu: receivedAmount,
            monnaie: method === 'CASH' ? monnaie : undefined,
            paymentMethod: method,
          });
        }

        const { groups: orderGroups } = await buildPrintGroupsFromOrderItems(orderId, true);
        if (orderGroups.length > 0) {
          await logPrintJobs(orderGroups, {
            orderId, tableId: null, tableNom: 'Vente directe',
            ticketNumber, userId: user?.id || '', type: 'INITIAL',
          });
          await markItemsAsPrinted(orderGroups
            .flatMap(g => g.items.map(i => i.orderItemId).filter(Boolean) as string[]));
        }
      })().catch(error => console.error('Direct payment print error:', error));
    } finally {
      setSaving(false);
    }
  };

  const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000].filter(a => a >= total);
  const displayed = [...new Set([total, ...quickAmounts])].slice(0, 5);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Encaissement</h3>
            <p className="text-sm text-gray-500">Vente directe · {ticketNumber}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-900 rounded-2xl p-5 text-center">
            <p className="text-gray-400 text-sm mb-1">Montant à encaisser</p>
            <p className="text-4xl font-bold text-white">{total.toLocaleString('fr-FR')}</p>
            <p className="text-gray-400 text-sm mt-1">FCFA</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Mode de paiement</p>
            <div className="grid grid-cols-5 gap-2">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all ${method === m.id ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}
                >
                  <span className={method === m.id ? 'text-amber-500' : 'text-gray-400'}>{m.icon}</span>
                  <span className={`text-xs font-semibold leading-tight text-center ${method === m.id ? 'text-amber-700' : 'text-gray-500'}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {method === 'CASH' && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Montant reçu</p>
              <input
                type="number"
                value={montantRecu}
                onChange={e => setMontantRecu(e.target.value)}
                placeholder="Saisir le montant..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {displayed.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setMontantRecu(amount.toString())}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      parseInt(montantRecu) === amount ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-gray-200 text-gray-700 hover:border-amber-300'
                    }`}
                  >
                    {amount === total ? 'Exact' : `${amount.toLocaleString('fr-FR')} F`}
                  </button>
                ))}
              </div>
              {montantRecu && parseInt(montantRecu) >= total && (
                <div className="mt-3 flex justify-between items-center bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-green-700">Monnaie à rendre</span>
                  <span className="text-xl font-bold text-green-700">{monnaie.toLocaleString('fr-FR')} F</span>
                </div>
              )}
            </div>
          )}

          {method !== 'CASH' && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Référence (optionnel)</label>
              <input
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="N° transaction..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-700 py-4 rounded-2xl font-semibold transition-all">
              Annuler
            </button>
            <button
              onClick={handlePay}
              disabled={saving || (method === 'CASH' && montantRecu !== '' && parseInt(montantRecu) < total)}
              className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Check size={20} />
              {saving ? 'En cours...' : 'Confirmer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
