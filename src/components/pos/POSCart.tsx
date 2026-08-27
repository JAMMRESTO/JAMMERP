import { Minus, Plus, Trash2, ShoppingCart, Layers } from 'lucide-react';
import { POSCartItem } from '../../types';
import { formatCurrency, MODES_PAIEMENT } from '../../lib/utils';

interface Props {
  items: POSCartItem[];
  modePaiement: string;
  montantRecu: string;
  tvaEnabled: boolean;
  currencySymbol: string;
  onUpdateQty: (idx: number, qty: number) => void;
  onRemove: (idx: number) => void;
  onModeChange: (mode: string) => void;
  onMontantRecuChange: (v: string) => void;
  onValidate: () => void;
  loading: boolean;
}

export default function POSCart({
  items, modePaiement, montantRecu, tvaEnabled, currencySymbol,
  onUpdateQty, onRemove, onModeChange, onMontantRecuChange, onValidate, loading
}: Props) {
  const totalHT = items.reduce((a, i) => a + i.montant_ht, 0);
  const totalTVA = items.reduce((a, i) => a + i.montant_tva, 0);
  const totalTTC = items.reduce((a, i) => a + i.montant_ttc, 0);
  const recu = parseFloat(montantRecu) || 0;
  const monnaie = Math.max(0, recu - totalTTC);

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-100">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5 text-blue-600" />
        <h3 className="font-bold text-slate-900">Panier</h3>
        <span className="ml-auto text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">{items.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300 px-4">
            <ShoppingCart className="w-10 h-10 mb-2" />
            <p className="text-sm text-center">Cliquez sur un produit pour l'ajouter</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <div key={idx} className="px-4 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800 leading-tight">{item.designation}</span>
                      {item.type_vente === 'conditionnement' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                          <Layers className="w-2.5 h-2.5" />cond.
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5 block">{formatCurrency(item.prix_unitaire, currencySymbol)} / {item.unite_label || 'unité'}</span>
                  </div>
                  <button onClick={() => onRemove(idx)} className="text-red-300 hover:text-red-600 hover:bg-red-50 rounded-lg p-1 flex-shrink-0 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1">
                    <button onClick={() => onUpdateQty(idx, item.quantite - 1)}
                      className="w-7 h-7 rounded-lg bg-white shadow-sm hover:bg-gray-50 flex items-center justify-center text-slate-600 transition-colors">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900">{item.quantite}</span>
                    <button onClick={() => onUpdateQty(idx, item.quantite + 1)}
                      disabled={item.quantite >= item.stock_actuel}
                      className="w-7 h-7 rounded-lg bg-white shadow-sm hover:bg-gray-50 flex items-center justify-center text-slate-600 disabled:opacity-30 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold text-slate-900">{formatCurrency(item.montant_ttc, currencySymbol)}</div>
                    {item.quantite > 1 && (
                      <div className="text-xs text-slate-400">{item.quantite} × {formatCurrency(item.prix_unitaire, currencySymbol)}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-4 py-3 space-y-3">
        {tvaEnabled && (
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-500"><span>Sous-total HT</span><span>{formatCurrency(totalHT, currencySymbol)}</span></div>
            <div className="flex justify-between text-slate-500"><span>TVA</span><span>{formatCurrency(totalTVA, currencySymbol)}</span></div>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-bold text-slate-900">Total</span>
          <span className="text-xl font-bold text-blue-600">{formatCurrency(totalTTC, currencySymbol)}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mode de paiement</label>
          <select value={modePaiement} onChange={e => onModeChange(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        {modePaiement === 'Espèces' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Montant reçu</label>
            <input
              type="number"
              value={montantRecu}
              onChange={e => onMontantRecuChange(e.target.value)}
              min={totalTTC}
              step="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {recu >= totalTTC && totalTTC > 0 && (
              <div className="mt-1.5 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex justify-between text-sm">
                <span className="text-emerald-700 font-medium">Monnaie à rendre</span>
                <span className="text-emerald-700 font-bold">{formatCurrency(monnaie, currencySymbol)}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onValidate}
          disabled={items.length === 0 || loading || (modePaiement === 'Espèces' && recu < totalTTC && totalTTC > 0)}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-600/20"
        >
          {loading ? 'Traitement...' : `Encaisser ${formatCurrency(totalTTC, currencySymbol)}`}
        </button>
      </div>
    </div>
  );
}
