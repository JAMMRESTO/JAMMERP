import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Printer, CheckCircle2,
  Utensils, Package, Truck, RotateCcw, Phone, MapPin, Ban
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { AdminPinModal } from './AdminPinModal';
import { esc, fmtNum, fmtAmt, THERMAL_CSS, buildThermalHeader, printViaPopup } from '../../lib/printUtils';
import type { UserWithRole } from '../../types/database';

const saleTypeLabels = {
  dine_in:  { label: 'Sur place',        icon: Utensils },
  takeaway: { label: 'Commandes client', icon: Package },
  delivery: { label: 'Vente directe',    icon: Truck },
};

interface ReceiptModalProps {
  onClose: () => void;
  onNewSale: () => void;
}

export function ReceiptModal({ onClose, onNewSale }: ReceiptModalProps) {
  const { currentSale, currentSaleItems, total, subtotal, taxAmount, discountAmount, saleType, tableNumber, customerName, selectedCustomer, lastPayments, cancelSale } = usePOS();
  const { settings } = useSettings();
  const { currentUser } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);
  const sym = settings.currency_symbol;
  const [showCancelPin, setShowCancelPin] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);

  if (!currentSale) return null;

  const sale = currentSale;
  const SaleTypeIcon = saleTypeLabels[saleType].icon;

  function handlePrint() {
    const fmt = (n: number) => fmtAmt(n, sym);

    const paymentMethodLabels: Record<string, string> = {
      cash: 'Espèces', wave: 'Wave', orange_money: 'Orange Money', card: 'Carte bancaire',
    };

    const dateObj = new Date(sale.created_at);
    const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const row = (left: string, right: string, large = false) =>
      `<div class="row${large ? ' total-row' : ''}"><span class="lbl">${esc(left)}</span><span class="val">${esc(right)}</span></div>`;

    const headerHtml = buildThermalHeader(settings);

    const metaHtml = [
      row(`Ticket N° : ${sale.sale_number}`, ''),
      row(`Date : ${dateStr}`, `Heure : ${timeStr}`),
      ...(tableNumber
        ? [row(`Table : ${tableNumber}`, `Serveur : ${currentUser?.name ?? 'N/A'}`)]
        : [row('Serveur :', currentUser?.name ?? 'N/A')]),
      ...(selectedCustomer
        ? [row('Client :', selectedCustomer.name)]
        : customerName ? [row('Client :', customerName)] : []),
      ...(saleType !== 'dine_in' ? [row('Mode :', saleTypeLabels[saleType].label)] : []),
      `<hr class="sep">`,
    ].join('\n');

    const colHeaderHtml = `<div class="col-header"><span class="qty">Qté</span><span class="desc">Désignation</span><span class="pu">P.U.</span><span class="ttl">Total</span></div>`;

    const itemsHtml = currentSaleItems.map(item => {
      const variant = item.variant_label
        ? `<div style="font-size:10px;padding-left:24px;">[${esc(item.variant_label)}]</div>`
        : '';
      return `<div class="item-row"><span class="qty">${item.quantity}x</span><span class="desc">${esc(item.product_name)}</span><span class="pu">${fmtNum(item.unit_price)}</span><span class="ttl">${fmtNum(item.subtotal)}</span></div>${variant}`;
    }).join('');

    const totalsHtml = [
      `<hr class="sep">`,
      ...(discountAmount > 0 ? [row('Sous-total', fmt(subtotal))] : []),
      ...(discountAmount > 0 ? [row('Remise', `- ${fmt(discountAmount)}`)] : []),
      row(`TVA (${settings.tax_rate}%)`, fmt(taxAmount)),
      `<hr class="sep-solid">`,
      row('TOTAL TTC', fmt(total), true),
      `<hr class="sep-solid">`,
    ].join('\n');

    const paymentsHtml = [
      `<div class="section-title">MODE DE RÈGLEMENT</div>`,
      ...lastPayments.map(p => row(`${paymentMethodLabels[p.method] ?? p.method} :`, fmt(p.amount))),
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
  <title>Ticket #${sale.sale_number}</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  ${headerHtml}
  ${metaHtml}
  ${colHeaderHtml}
  ${itemsHtml}
  ${totalsHtml}
  ${paymentsHtml}
  ${footerHtml}
  <script>window.addEventListener('load',function(){window.print();window.addEventListener('afterprint',function(){window.close();});});<\/script>
</body>
</html>`;

    printViaPopup(html);
    onClose();
  }

  async function handleCancelConfirm(admin: UserWithRole, reason: string) {
    if (!sale) return;
    const ok = await cancelSale(sale.id, admin.id, admin.name, reason);
    if (ok) setIsCancelled(true);
    setShowCancelPin(false);
  }

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-sm bg-gray-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
        >
          {/* Success header */}
          <div className="bg-emerald-600/15 border-b border-emerald-500/20 px-6 py-5 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 15, stiffness: 300 }}
              className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3"
            >
              <CheckCircle2 size={28} className="text-emerald-400" />
            </motion.div>
            <h2 className="text-white font-bold text-xl">Paiement réussi!</h2>
            <p className="text-white/40 text-sm mt-1">
              Ticket #{sale.sale_number}
            </p>
          </div>

          {/* Receipt preview */}
          <div ref={receiptRef} className="p-6 space-y-4">
            {/* Meta */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-white/60">
                <SaleTypeIcon size={14} />
                <span>{saleTypeLabels[saleType].label}</span>
                {tableNumber && <span>· Table {tableNumber}</span>}
                {customerName && <span>· {customerName}</span>}
              </div>
              <span className="text-white/30 text-xs">
                {new Date(sale.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Items */}
            <div className="space-y-2 border-t border-dashed border-white/10 pt-3">
              {currentSaleItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-white/70">
                    <span className="text-white/40 mr-1">{item.quantity}x</span>
                    {item.product_name}
                    {item.variant_label && <span className="text-white/30 text-xs ml-1">({item.variant_label})</span>}
                  </span>
                  <span className="text-white font-medium flex-shrink-0 ml-3">
                    {item.subtotal.toLocaleString('fr-FR')} {sym}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-white/10 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-white/50">
                <span>Sous-total</span>
                <span>{subtotal.toLocaleString('fr-FR')} {sym}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>Remise</span>
                  <span>-{discountAmount.toLocaleString('fr-FR')} {sym}</span>
                </div>
              )}
              <div className="flex justify-between text-white/50">
                <span>TVA</span>
                <span>{taxAmount.toLocaleString('fr-FR')} {sym}</span>
              </div>
              <div className="flex justify-between text-white font-bold text-base pt-1 border-t border-white/10">
                <span>Total payé</span>
                <span className="text-emerald-400">{total.toLocaleString('fr-FR')} {sym}</span>
              </div>
            </div>

            {/* Customer info (takeaway) */}
            {selectedCustomer && saleType === 'takeaway' && (
              <div className="border-t border-dashed border-white/10 pt-3 space-y-1.5">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Client</p>
                <div className="bg-white/4 rounded-xl p-3 space-y-1.5">
                  <p className="text-white font-medium text-sm">{selectedCustomer.name}</p>
                  <div className="flex items-center gap-1.5 text-white/50 text-xs">
                    <Phone size={11} className="flex-shrink-0" />
                    <span>{selectedCustomer.phone}</span>
                  </div>
                  {selectedCustomer.address && (
                    <div className="flex items-start gap-1.5 text-white/50 text-xs">
                      <MapPin size={11} className="flex-shrink-0 mt-0.5" />
                      <span>{selectedCustomer.address}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-white/20 text-xs border-t border-dashed border-white/10 pt-3">
              {settings.receipt_footer}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex flex-col gap-2">
            {isCancelled ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium text-sm">
                <Ban size={16} />
                Vente annulée
              </div>
            ) : (
              <button
                onClick={() => setShowCancelPin(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/30 text-red-400 font-medium text-sm transition-all"
              >
                <Ban size={15} /> Annuler cette vente
              </button>
            )}
            <button
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/8 hover:bg-white/14 border border-white/10 text-white font-medium text-sm transition-all"
            >
              <Printer size={16} /> Imprimer le ticket
            </button>
            <button
              onClick={onNewSale}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/25 transition-all"
            >
              <RotateCcw size={16} /> Nouvelle vente
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>

    <AnimatePresence>
      {showCancelPin && (
        <AdminPinModal
          title="Annulation de vente"
          description={`Annuler le ticket #${sale.sale_number} (${total.toLocaleString('fr-FR')} ${sym})`}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelPin(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}
