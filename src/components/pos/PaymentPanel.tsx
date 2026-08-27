import { CheckCircle, X, AlertCircle, MapPin, ShoppingBag } from 'lucide-react';
import { CartItem } from '../../lib/types';

interface Props {
  cart: CartItem[];
  onValidate: (serviceType: 'sur_place' | 'a_emporter') => void;
  validating: boolean;
  printError: string | null;
  onClearError: () => void;
  onClearCart: () => void;
  serviceType: 'sur_place' | 'a_emporter';
  onServiceTypeChange: (type: 'sur_place' | 'a_emporter') => void;
}

export default function PaymentPanel({
  cart,
  onValidate,
  validating,
  printError,
  onClearError,
  onClearCart,
  serviceType,
  onServiceTypeChange,
}: Props) {
  const cartTotal = cart.reduce((sum, item) => {
    const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
    const variantTotal = item.selectedVariants ? Object.values(item.selectedVariants).reduce((s, v) => s + v.prix_delta, 0) : 0;
    return sum + (item.product.prix + optTotal + variantTotal) * item.qty;
  }, 0);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="flex-shrink-0 bg-white border-t border-gray-200 flex flex-col">
      <div className="grid grid-cols-2 gap-1.5 px-3 pt-3 pb-2">
        <button
          onClick={() => onServiceTypeChange('sur_place')}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 px-1 transition-all border-2 ${
            serviceType === 'sur_place'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
          }`}
        >
          <MapPin size={16} />
          <span className="text-xs font-semibold">Sur place</span>
        </button>
        <button
          onClick={() => onServiceTypeChange('a_emporter')}
          className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 px-1 transition-all border-2 ${
            serviceType === 'a_emporter'
              ? 'bg-amber-500 border-amber-500 text-white'
              : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
          }`}
        >
          <ShoppingBag size={16} />
          <span className="text-xs font-semibold">A emporter</span>
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{cartCount} art.</span>
            {cart.length > 0 && (
              <button
                onClick={onClearCart}
                className="text-gray-400 hover:text-red-500 text-xs flex items-center gap-0.5 transition-colors"
              >
                <X size={11} />
                Vider
              </button>
            )}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-gray-500">Total</span>
            <span className="text-gray-900 font-bold text-xl">
              {cartTotal.toLocaleString('fr-FR')}
              <span className="text-xs font-normal text-gray-500 ml-1">FCFA</span>
            </span>
          </div>
        </div>
      </div>

      {printError && (
        <div className="mx-3 mb-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-start gap-2">
          <AlertCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 flex-1 leading-tight">{printError}</p>
          <button onClick={onClearError} className="text-red-400 hover:text-red-600"><X size={11} /></button>
        </div>
      )}

      <div className="px-3 pb-3">
        <button
          onClick={() => onValidate(serviceType)}
          disabled={validating || cart.length === 0}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 text-sm"
        >
          {validating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle size={16} />
          )}
          {validating ? 'Traitement...' : 'Valider & Encaisser'}
        </button>
      </div>
    </div>
  );
}
