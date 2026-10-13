import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { CartItem } from '../../lib/types';

interface Props {
  cart: CartItem[];
  onUpdateQty: (index: number, qty: number) => void;
  onRemove: (index: number) => void;
}

export default function CartPanel({ cart, onUpdateQty, onRemove }: Props) {
  if (cart.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2 overflow-y-auto bg-white">
        <ShoppingCart size={32} className="opacity-20" />
        <p className="text-xs text-gray-300">Sélectionnez un article</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 w-full">Article</th>
            <th className="text-center px-2 py-2 font-semibold text-gray-500 whitespace-nowrap">Qte</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-500 whitespace-nowrap">Px Total</th>
            <th className="px-2 py-2 w-6"></th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item, index) => {
            const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
            const variantTotal = item.selectedVariants ? Object.values(item.selectedVariants).reduce((s, v) => s + v.prix_delta, 0) : 0;
            const lineTotal = (item.product.prix + optTotal + variantTotal) * item.qty;
            const variantNames = item.selectedVariants ? Object.values(item.selectedVariants).map(v => v.nom) : [];
            const displayName = variantNames.length > 0
              ? `${item.product.nom} - ${variantNames.join(', ')}`
              : item.product.nom;
            return (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2">
                  <p className="font-semibold text-gray-900 text-xs leading-tight truncate max-w-[120px]">{displayName}</p>
                  {item.selectedOptions.length > 0 && (
                    <p className="text-amber-500 text-xs truncate">{item.selectedOptions.map(o => o.nom).join(', ')}</p>
                  )}
                  {item.notes && (
                    <p className="text-gray-400 italic text-xs truncate">"{item.notes}"</p>
                  )}
                </td>
                <td className="px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onUpdateQty(index, item.qty - 1)}
                      className="w-5 h-5 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center transition-all"
                    >
                      <Minus size={9} />
                    </button>
                    <span className="font-bold text-gray-900 w-4 text-center text-xs">{item.qty}</span>
                    <button
                      onClick={() => onUpdateQty(index, item.qty + 1)}
                      className="w-5 h-5 bg-amber-100 text-amber-600 hover:bg-amber-200 rounded flex items-center justify-center transition-all"
                    >
                      <Plus size={9} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="font-semibold text-gray-900 whitespace-nowrap">{lineTotal.toLocaleString('fr-FR')}</span>
                </td>
                <td className="px-2 py-2">
                  <button
                    onClick={() => onRemove(index)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
