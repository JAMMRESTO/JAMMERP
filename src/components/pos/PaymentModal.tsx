import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Banknote, Smartphone, CreditCard,
  Plus, CheckCircle2, Loader2, ChevronRight, Clock,
  type LucideIcon
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { esc, fmtNum, fmtAmt, THERMAL_CSS, buildThermalHeader, printViaIframe } from '../../lib/printUtils';
import type { PaymentMethod, SaleItem, Sale } from '../../types/database';

const methods: { id: PaymentMethod; label: string; icon: LucideIcon; color: string }[] = [
  { id: 'cash', label: 'Espèces', icon: Banknote, color: '#10B981' },
  { id: 'wave', label: 'Wave', icon: Smartphone, color: '#3B82F6' },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone, color: '#F97316' },
  { id: 'card', label: 'Carte', icon: CreditCard, color: '#8B5CF6' },
];

interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  reference: string;
}

const saleTypeLabels: Record<string, string> = {
  dine_in:  'Sur place',
  takeaway: 'Commandes client',
  delivery: 'Vente directe',
};

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (result: { sale: import('../../types/database').Sale; items: import('../../types/database').SaleItem[]; payments: { method: import('../../types/database').PaymentMethod; amount: number; reference?: string }[] }) => void;
  onDeferred: () => void;
}

function printDeferredTicket(
  sale: Sale,
  items: SaleItem[],
  settings: { restaurant_name: string; address?: string; phone?: string; currency_symbol: string; tax_rate: number; receipt_footer?: string; legal_form?: string; capital?: string; vat_number?: string; siret?: string },
  saleType: string,
  tableNumber: string,
  customerName: string,
  cashierName: string,
  subtotal: number,
  taxAmount: number,
  discountAmount: number,
  total: number,
) {
  const sym = settings.currency_symbol;
  const fmt = (n: number) => fmtAmt(n, sym);
  const dateObj = new Date(sale.created_at);
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const row = (left: string, right: string, large = false) =>
    `<div class="row${large ? ' total-row' : ''}"><span class="lbl">${esc(left)}</span><span class="val">${esc(right)}</span></div>`;

  const headerHtml = buildThermalHeader(settings);

  const pendingBanner = `<div class="banner">*** EN ATTENTE DE PAIEMENT ***</div>`;

  const metaHtml = [
    row(`Ticket N° : ${sale.sale_number}`, ''),
    row(`Date : ${dateStr}`, `Heure : ${timeStr}`),
    ...(tableNumber ? [row(`Table : ${tableNumber}`, `Serveur : ${cashierName}`)] : [row(`Serveur :`, cashierName)]),
    ...(customerName ? [row('Client :', customerName)] : []),
    ...(saleType !== 'dine_in' ? [row('Mode :', saleTypeLabels[saleType] ?? saleType)] : []),
    `<hr class="sep">`,
  ].join('\n');

  const colHeaderHtml = `<div class="col-header"><span class="qty">Qté</span><span class="desc">Désignation</span><span class="pu">P.U.</span><span class="ttl">Total</span></div>`;

  const itemsHtml = items.map(item =>
    `<div class="item-row"><span class="qty">${item.quantity}x</span><span class="desc">${esc(item.product_name)}</span><span class="pu">${fmtNum(item.unit_price)}</span><span class="ttl">${fmtNum(item.subtotal)}</span></div>`
  ).join('');

  const totalsHtml = [
    `<hr class="sep">`,
    ...(discountAmount > 0 ? [row('Sous-total', fmt(subtotal)), row('Remise', `- ${fmt(discountAmount)}`)] : []),
    row(`TVA (${settings.tax_rate}%)`, fmt(taxAmount)),
    `<hr class="sep-solid">`,
    row('TOTAL TTC', fmt(total), true),
    `<hr class="sep-solid">`,
    `<div class="center" style="font-size:12px;font-weight:700;padding:3px 0;">À RÉGLER ULTÉRIEUREMENT</div>`,
    `<hr class="sep">`,
  ].join('\n');

  const footerHtml = [
    `<div class="footer">${esc(settings.receipt_footer || 'Merci de votre visite !')}</div>`,
    `<div class="footer">À bientôt.</div>`,
    `<hr class="sep">`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>Ticket #${sale.sale_number} (attente)</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  ${headerHtml}
  ${pendingBanner}
  ${metaHtml}
  ${colHeaderHtml}
  ${itemsHtml}
  ${totalsHtml}
  ${footerHtml}
  <script>window.addEventListener('load',function(){window.print();window.addEventListener('afterprint',function(){window.close();});});<\/script>
</body>
</html>`;

  printViaIframe(html);
}

export function PaymentModal({ onClose, onSuccess, onDeferred }: PaymentModalProps) {
  const { total, subtotal, taxAmount, discountAmount, completeSale, deferSale, isPendingResume, saleType, tableNumber, customerName, cart } = usePOS();
  const { settings } = useSettings();
  const { currentUser } = useAuth();
  const sym = settings.currency_symbol;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [splitMode, setSplitMode] = useState(false);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [cashInput, setCashInput] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);

  const cashAmount = parseFloat(cashInput) || 0;
  const change = cashAmount - total;
  const paidSoFar = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - paidSoFar;

  function addSplitPayment() {
    if (remaining <= 0) return;
    const amount = remaining;
    setPayments(prev => [...prev, { method: selectedMethod, amount, reference }]);
    setReference('');
  }

  function removeSplitPayment(i: number) {
    setPayments(prev => prev.filter((_, idx) => idx !== i));
  }

  const quickAmounts = [
    total, Math.ceil(total / 500) * 500,
    Math.ceil(total / 1000) * 1000, Math.ceil(total / 2000) * 2000,
  ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4);

  async function handleDefer() {
    setLoading(true);
    const result = await deferSale();
    setLoading(false);
    if (result) {
      printDeferredTicket(
        result.sale, result.items, settings,
        saleType, tableNumber, customerName,
        currentUser?.name ?? 'Caissier',
        subtotal, taxAmount, discountAmount, total,
      );
      onDeferred();
    }
  }

  async function handlePay() {
    setLoading(true);
    let paymentsToSubmit: { method: PaymentMethod; amount: number; reference?: string }[];

    if (splitMode) {
      if (remaining > 0) {
        setLoading(false);
        return;
      }
      paymentsToSubmit = payments;
    } else {
      paymentsToSubmit = [{
        method: selectedMethod,
        amount: total,
        reference: selectedMethod !== 'cash' ? reference : undefined,
      }];
    }

    const result = await completeSale(paymentsToSubmit);
    setLoading(false);
    if (result) {
      onSuccess({ sale: result.sale, items: result.items, payments: paymentsToSubmit });
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-lg bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/8">
            <div>
              <h2 className="text-white font-bold text-base sm:text-lg">Paiement</h2>
              <p className="text-white/40 text-[10px] sm:text-xs mt-0.5">
                {saleType === 'dine_in' && tableNumber ? `Table ${tableNumber}` :
                 saleType === 'delivery' ? `Vente directe — ${customerName || 'Client'}` :
                 saleType === 'takeaway' ? `Commandes client — ${customerName || 'Client'}` : ''}
                {' · '}{cart.length} article{cart.length > 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
            >
              <X size={16} className="sm:hidden" />
              <X size={17} className="hidden sm:block" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* Total */}
            <div className="text-center py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-blue-600/10 border border-blue-500/20">
              <p className="text-white/50 text-xs sm:text-sm mb-1">Montant à payer</p>
              <p className="text-2xl sm:text-4xl font-black text-white">
                {total.toLocaleString('fr-FR')}
                <span className="text-lg sm:text-2xl text-white/50 ml-1 sm:ml-2">{sym}</span>
              </p>
              <div className="flex items-center justify-center gap-2 sm:gap-4 mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-white/30">
                <span>HT: {subtotal.toLocaleString('fr-FR')}</span>
                {discountAmount > 0 && <span className="text-amber-400">-{discountAmount.toLocaleString('fr-FR')}</span>}
                <span>TVA: {taxAmount.toLocaleString('fr-FR')}</span>
              </div>
            </div>

            {/* Split toggle */}
            <div className="flex items-center justify-between">
              <p className="text-white/60 text-xs sm:text-sm font-medium">Mode de paiement</p>
              <button
                onClick={() => { setSplitMode(s => !s); setPayments([]); }}
                className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-all
                  ${splitMode ? 'bg-blue-600/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
              >
                <Plus size={10} className="sm:hidden" />
                <Plus size={11} className="hidden sm:block" />
                <span className="hidden sm:inline">Paiement mixte</span>
                <span className="sm:hidden">Mixte</span>
              </button>
            </div>

            {/* Payment methods */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {methods.map(m => {
                const Icon = m.icon;
                const active = selectedMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMethod(m.id)}
                    className={`flex flex-col items-center gap-1 sm:gap-1.5 p-2 sm:p-3 rounded-xl sm:rounded-2xl border text-[10px] sm:text-xs font-medium transition-all
                      ${active
                        ? 'text-white border-opacity-60 shadow-lg'
                        : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8'
                      }`}
                    style={active ? {
                      backgroundColor: m.color + '22',
                      borderColor: m.color + '60',
                      boxShadow: `0 4px 14px ${m.color}25`,
                    } : {}}
                  >
                    <Icon size={16} className="sm:hidden" style={active ? { color: m.color } : {}} />
                    <Icon size={18} className="hidden sm:block" style={active ? { color: m.color } : {}} />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Reference input for digital methods */}
            {selectedMethod !== 'cash' && (
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="Référence (optionnel)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            )}

            {/* Cash change calculator */}
            {selectedMethod === 'cash' && !splitMode && (
              <div className="space-y-2 sm:space-y-3">
                <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                  {quickAmounts.map(amt => (
                    <button
                      key={amt}
                      onClick={() => setCashInput(String(amt))}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-medium transition-all
                        ${parseFloat(cashInput) === amt
                          ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8'}`}
                    >
                      {amt.toLocaleString('fr-FR')} {sym}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={cashInput}
                    onChange={e => setCashInput(e.target.value)}
                    placeholder="Montant reçu"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-white text-xs sm:text-sm placeholder-white/25 focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  {cashAmount >= total && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-white/40 text-[9px] sm:text-[10px]">Monnaie</p>
                      <p className="text-emerald-400 font-bold text-xs sm:text-sm">{change.toLocaleString('fr-FR')} {sym}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Split mode payments list */}
            {splitMode && (
              <div className="space-y-1.5 sm:space-y-2">
                <AnimatePresence>
                  {payments.map((p, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15"
                    >
                      <CheckCircle2 size={12} className="sm:hidden text-emerald-400 flex-shrink-0" />
                      <CheckCircle2 size={14} className="hidden sm:block text-emerald-400 flex-shrink-0" />
                      <span className="text-white/70 text-xs sm:text-sm flex-1 capitalize">
                        {methods.find(m => m.id === p.method)?.label} — {p.amount.toLocaleString('fr-FR')} {sym}
                      </span>
                      <button onClick={() => removeSplitPayment(i)} className="text-white/30 hover:text-red-400 transition-colors">
                        <X size={12} className="sm:hidden" />
                        <X size={13} className="hidden sm:block" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {remaining > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 p-2 sm:p-3 rounded-xl bg-white/5 border border-white/10">
                      <span className="text-white/50 text-[10px] sm:text-xs">
                        Restant: <strong className="text-white">{remaining.toLocaleString('fr-FR')} {sym}</strong>
                      </span>
                    </div>
                    <button
                      onClick={addSplitPayment}
                      className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-xs font-medium transition-all"
                    >
                      <Plus size={11} className="sm:hidden" />
                      <Plus size={13} className="hidden sm:block" />
                      <span className="hidden sm:inline">Ajouter</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Defer button — only for dine_in and takeaway, hidden when resuming a pending ticket */}
            {!isPendingResume && (saleType === 'dine_in' || saleType === 'takeaway') && <motion.button
              onClick={handleDefer}
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-semibold text-sm sm:text-sm transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-400"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <>
                  <Clock size={15} />
                  Payer plus tard
                </>
              )}
            </motion.button>}

            {/* Pay button */}
            <motion.button
              onClick={handlePay}
              disabled={loading || (splitMode && remaining > 0) || (!splitMode && selectedMethod === 'cash' && cashAmount > 0 && cashAmount < total)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base shadow-2xl transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
            >
              {loading ? (
                <Loader2 size={16} className="sm:hidden animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={16} className="sm:hidden" />
                  <CheckCircle2 size={18} className="hidden sm:block" />
                  <span className="hidden sm:inline">Confirmer le paiement</span>
                  <span className="sm:hidden">Confirmer</span>
                  <ChevronRight size={14} className="sm:hidden" />
                  <ChevronRight size={16} className="hidden sm:block" />
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
