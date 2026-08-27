import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, Plus, Minus, MessageSquare,
  Printer, CreditCard
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { esc, THERMAL_CSS, buildThermalHeader, printViaPopup } from '../../lib/printUtils';
import type { CartItem, SaleType } from '../../types/database';

function CartItemRow({ item, locked }: { item: CartItem; locked: boolean }) {
  const { removeFromCart, updateQuantity, updateKitchenNote } = usePOS();
  const { settings } = useSettings();
  const [showNote, setShowNote] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 border-b border-white/5">
        {/* Product thumbnail */}
        {item.product.image_url ? (
          <img src={item.product.image_url} alt={item.product.name} className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0 text-sm sm:text-base">🍽️</div>
        )}

        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-[11px] sm:text-xs font-medium leading-tight truncate">{item.product.name}</p>
          <p className="text-white/40 text-[9px] sm:text-[10px] mt-0.5">
            {item.unit_price.toLocaleString('fr-FR')} {settings.currency_symbol}
            {item.variant_label && <span className="ml-1" style={{ color: 'var(--color-primary)' }}>· {item.variant_label}</span>}
          </p>
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {!locked && (
            <button
              onClick={() => updateQuantity(item.id, item.quantity - 1)}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-white/8 hover:bg-red-500/20 text-white/50 hover:text-red-400 flex items-center justify-center transition-all"
            >
              <Minus size={10} className="sm:hidden" />
              <Minus size={11} className="hidden sm:block" />
            </button>
          )}
          <span className="text-white font-bold text-[10px] sm:text-xs w-4 sm:w-5 text-center">{item.quantity}</span>
          {!locked && (
            <button
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-white/8 hover:bg-blue-600/40 text-white/50 hover:text-white flex items-center justify-center transition-all"
            >
              <Plus size={10} className="sm:hidden" />
              <Plus size={11} className="hidden sm:block" />
            </button>
          )}
        </div>

        {/* Subtotal + remove */}
        <div className="flex flex-col items-end flex-shrink-0 gap-0.5 sm:gap-1">
          <span className="text-white font-semibold text-[10px] sm:text-xs">
            {(item.unit_price * item.quantity).toLocaleString('fr-FR')} {settings.currency_symbol}
          </span>
          {!locked && (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button
                onClick={() => setShowNote(s => !s)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center text-white/20 hover:text-amber-400 transition-colors"
              >
                <MessageSquare size={9} className="sm:hidden" />
                <MessageSquare size={10} className="hidden sm:block" />
              </button>
              <button
                onClick={() => removeFromCart(item.id)}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded flex items-center justify-center text-white/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={9} className="sm:hidden" />
                <Trash2 size={10} className="hidden sm:block" />
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showNote && !locked && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <input
              type="text"
              value={item.kitchen_note}
              onChange={e => updateKitchenNote(item.id, e.target.value)}
              placeholder="Note..."
              className="w-full bg-amber-500/5 border border-amber-500/20 rounded-lg px-2 sm:px-2.5 py-1 sm:py-1.5 text-white/80 text-[10px] sm:text-xs placeholder-white/25 focus:outline-none focus:border-amber-500/40 mb-1 sm:mb-1.5"
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const saleTypeKitchenLabel: Record<SaleType, string> = {
  dine_in: 'SUR PLACE',
  takeaway: 'À EMPORTER',
  delivery: 'VENTE DIRECTE',
};

interface CartPanelProps {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const {
    cart, saleType, tableNumber, customerName, selectedCustomer,
    discountAmount,
    clearCart, subtotal, taxAmount, total, itemCount,
    orderNotes, setOrderNotes,
    isPendingResume,
  } = usePOS();
  const { settings } = useSettings();
  const { currentUser } = useAuth();
  const sym = settings.currency_symbol;

  function handlePrintKitchen() {
    if (cart.length === 0) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const row = (left: string, right: string) =>
      `<div class="row"><span class="lbl">${esc(left)}</span><span class="val">${esc(right)}</span></div>`;

    const headerHtml = buildThermalHeader(settings);

    const clientName = selectedCustomer?.name || customerName;

    const metaHtml = [
      `<div class="banner">TICKET CUISINE</div>`,
      row(`Date : ${dateStr}`, `Heure : ${timeStr}`),
      row('Caissier :', currentUser?.name ?? 'N/A'),
      row('Type :', saleTypeKitchenLabel[saleType]),
      ...(saleType === 'dine_in' && tableNumber ? [row('Table :', tableNumber)] : []),
      ...(saleType !== 'dine_in' && clientName ? [row('Client :', clientName)] : []),
      `<hr class="sep-solid">`,
    ].join('\n');

    const itemsHtml = cart.map(item => {
      const variant = item.variant_label
        ? `<div style="font-size:11px;padding-left:28px;font-weight:700;">[${esc(item.variant_label)}]</div>`
        : '';
      const note = item.kitchen_note
        ? `<div style="font-size:11px;padding-left:28px;font-style:italic;">>> ${esc(item.kitchen_note)}</div>`
        : '';
      return `<div class="item-row" style="font-size:14px;">
          <span class="qty" style="font-size:15px;">${item.quantity}x</span>
          <span class="desc" style="font-size:14px;white-space:normal;">${esc(item.product.name)}</span>
        </div>${variant}${note}`;
    }).join('');

    const notesHtml = orderNotes.trim()
      ? [
          `<hr class="sep">`,
          `<div class="section-title">NOTE COMMANDE</div>`,
          `<div style="font-size:12px;font-weight:700;">${esc(orderNotes)}</div>`,
        ].join('\n')
      : '';

    const footerHtml = [
      `<hr class="sep-solid">`,
      `<div class="footer">Ticket de préparation cuisine</div>`,
      `<div class="footer">${esc(dateStr)} · ${esc(timeStr)}</div>`,
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>Ticket cuisine</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  ${headerHtml}
  ${metaHtml}
  ${itemsHtml}
  ${notesHtml}
  ${footerHtml}
  <script>window.addEventListener('load',function(){window.print();window.addEventListener('afterprint',function(){window.close();});});<\/script>
</body>
</html>`;

    printViaPopup(html);
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-white/8">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-white font-semibold text-xs sm:text-sm">Panier</span>
          {itemCount > 0 && (
            <motion.span
              key={itemCount}
              initial={{ scale: 1.4 }}
              animate={{ scale: 1 }}
              className="text-white/60 text-xs sm:text-sm font-medium"
            >
              ({itemCount})
            </motion.span>
          )}
          {isPendingResume && (
            <span className="text-amber-400 text-[9px] sm:text-[10px] font-semibold bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-full">
              En attente
            </span>
          )}
        </div>
        {cart.length > 0 && !isPendingResume && (
          <button
            onClick={clearCart}
            className="text-[10px] sm:text-xs transition-colors font-medium hover:opacity-70"
            style={{ color: 'var(--color-primary)' }}
          >
            Vider
          </button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 min-h-0" style={{ scrollbarWidth: 'none' }}>
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-6 sm:py-8 text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-2 sm:mb-3">
              <CreditCard size={18} className="sm:hidden text-white/20" />
              <CreditCard size={22} className="hidden sm:block text-white/20" />
            </div>
            <p className="text-white/30 text-xs sm:text-sm font-medium">Panier vide</p>
            <p className="text-white/20 text-[10px] sm:text-xs mt-1">Ajoutez des produits</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {cart.map(item => <CartItemRow key={item.id} item={item} locked={isPendingResume} />)}
          </AnimatePresence>
        )}
      </div>

      {/* Bottom section */}
      {cart.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/8">
          {/* Note field */}
          {!isPendingResume && (
            <div className="px-3 sm:px-4 pt-2 sm:pt-3">
              <textarea
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                placeholder="Note..."
                rows={1}
                className="w-full bg-white/4 border border-white/8 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 text-white/70 text-[10px] sm:text-xs placeholder-white/25 focus:outline-none focus:border-white/20 resize-none transition-all"
              />
            </div>
          )}

          {/* Totals */}
          <div className="px-3 sm:px-4 py-2 sm:py-3 space-y-1 sm:space-y-1.5">
            <div className="flex justify-between text-[10px] sm:text-xs text-white/50">
              <span>Sous-total</span>
              <span>{subtotal.toLocaleString('fr-FR')} {sym}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[10px] sm:text-xs" style={{ color: 'var(--color-primary)' }}>
                <span>Remise</span>
                <span>{discountAmount.toLocaleString('fr-FR')} {sym}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] sm:text-xs text-white/50">
              <span>Taxe ({settings.tax_rate}%)</span>
              <span>{taxAmount.toLocaleString('fr-FR')} {sym}</span>
            </div>
            <div className="flex justify-between items-baseline pt-1 sm:pt-1.5 border-t border-white/8">
              <span className="text-white font-bold text-sm sm:text-base">Total</span>
              <span className="font-black text-lg sm:text-xl" style={{ color: 'var(--color-primary)' }}>{total.toLocaleString('fr-FR')} {sym}</span>
            </div>
          </div>

          {/* Action buttons */}
          {isPendingResume ? (
            <motion.button
              onClick={onCheckout}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white transition-all text-xs sm:text-sm font-bold"
            >
              <CreditCard size={14} className="sm:hidden" />
              <CreditCard size={16} className="hidden sm:block" />
              Encaisser
            </motion.button>
          ) : (
            <div className="grid grid-cols-2 gap-0 border-t border-white/8">
              <motion.button
                onClick={handlePrintKitchen}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 text-white/70 hover:text-white hover:bg-white/5 transition-all border-r border-white/8 text-[11px] sm:text-xs font-semibold"
              >
                <Printer size={14} className="sm:hidden" />
                <Printer size={16} className="hidden sm:block" />
                Imprimer
              </motion.button>
              <motion.button
                onClick={onCheckout}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 py-3 sm:py-3.5 text-white transition-all text-[11px] sm:text-xs font-bold"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <CreditCard size={14} className="sm:hidden" />
                <CreditCard size={16} className="hidden sm:block" />
                Encaisser
              </motion.button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
