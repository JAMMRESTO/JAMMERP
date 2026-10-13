import { X, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Product, ProductOption, ProductVariant, CartItem } from '../../lib/types';

interface Props {
  product: Product;
  onAdd: (item: CartItem) => void;
  onClose: () => void;
}

export default function ProductModal({ product, onAdd, onClose }: Props) {
  const [qty, setQty] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<ProductOption[]>([]);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductVariant>>(() => {
    const defaults: Record<string, ProductVariant> = {};
    if (product.variant_groups) {
      for (const group of product.variant_groups) {
        const def = (group.variants || []).find(v => v.default_selected && v.actif);
        if (def) defaults[group.id] = def;
      }
    }
    return defaults;
  });

  const toggleOption = (opt: ProductOption) => {
    setSelectedOptions(prev =>
      prev.find(o => o.id === opt.id) ? prev.filter(o => o.id !== opt.id) : [...prev, opt]
    );
  };

  const optTotal = selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
  const variantTotal = Object.values(selectedVariants).reduce((s, v) => s + v.prix_delta, 0);
  const lineTotal = (product.prix + optTotal + variantTotal) * qty;

  const handleAdd = () => {
    onAdd({ product, qty, notes: '', selectedOptions, selectedVariants });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h3 className="font-bold text-gray-900">{product.nom}</h3>
            <p className="text-sm text-amber-600 font-semibold mt-0.5">{product.prix.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {product.variant_groups && product.variant_groups.length > 0 && (
            <div className="space-y-4">
              {product.variant_groups.map(group => {
                const activeVariants = (group.variants || []).filter(v => v.actif);
                if (activeVariants.length === 0) return null;
                return (
                  <div key={group.id}>
                    <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                      {group.nom}
                      {group.required && <span className="text-red-500 text-xs">*</span>}
                    </p>
                    <div className="space-y-2">
                      {activeVariants.map(v => {
                        const isSelected = selectedVariants[group.id]?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariants(prev => ({ ...prev, [group.id]: v }))}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                              isSelected ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? 'border-white bg-white' : 'border-gray-300'}`}>
                                {isSelected && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                              </div>
                              <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>{v.nom}</span>
                            </div>
                            <span className={`text-xs font-semibold ${isSelected ? 'text-amber-300' : v.prix_delta > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {v.prix_delta > 0 ? `+${v.prix_delta.toLocaleString('fr-FR')} F` : v.prix_delta === 0 ? 'Inclus' : `${v.prix_delta.toLocaleString('fr-FR')} F`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {product.options && product.options.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Options</p>
              <div className="space-y-2">
                {product.options.map(opt => {
                  const checked = !!selectedOptions.find(o => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleOption(opt)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                        checked ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <span className={`text-sm font-medium ${checked ? 'text-amber-700' : 'text-gray-700'}`}>{opt.nom}</span>
                      {opt.prix_delta !== 0 && (
                        <span className={`text-xs font-semibold ${checked ? 'text-amber-600' : 'text-gray-500'}`}>
                          {opt.prix_delta > 0 ? '+' : ''}{opt.prix_delta.toLocaleString('fr-FR')} F
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Quantité</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all"
              >
                <Minus size={16} />
              </button>
              <span className="font-bold text-lg w-6 text-center">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="w-9 h-9 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-full flex items-center justify-center transition-all"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <button
            onClick={handleAdd}
            className="w-full bg-amber-500 hover:bg-amber-400 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            <ShoppingCart size={18} />
            Ajouter · {lineTotal.toLocaleString('fr-FR')} FCFA
          </button>
        </div>
      </div>
    </div>
  );
}
