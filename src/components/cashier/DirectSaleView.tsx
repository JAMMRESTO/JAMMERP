import { useState, useEffect, useCallback } from 'react';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X,
  CheckCircle, ChevronDown, StickyNote, Package, Hammer,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Category, Product, ProductOption, CartItem } from '../../lib/types';
import {
  buildPrintGroupsFromCart,
} from '../../lib/printService';
import { printFabrication } from '../../services/fabrication';
import { showToast } from '../shared/Toast';
import DirectPaymentModal from './DirectPaymentModal';

interface PendingDirectOrder {
  orderId: string;
  ticketNumber: string;
  total: number;
}

interface DirectOrderRpcResult {
  order_id: string;
  ticket_number: string;
}

export default function DirectSaleView() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState('');
  const [modalOptions, setModalOptions] = useState<ProductOption[]>([]);
  const [validating, setValidating] = useState(false);
  const [fabricating, setFabricating] = useState(false);
  const [fabricationDone, setFabricationDone] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingDirectOrder | null>(null);
  const [discount, setDiscount] = useState('');
  const [showCart, setShowCart] = useState(false);

  const fetchData = useCallback(async () => {
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('categories').select('*, printer:printers(*)').eq('actif', true).order('ordre'),
      supabase.from('products').select('*, options:product_options(*), category:categories!category_id(*)').eq('actif', true).order('nom'),
    ]);
    setCategories(cats || []);
    setProducts(prods || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const parentCats = categories.filter(c => !c.parent_id);
  const subCats = categories.filter(c => !!c.parent_id);

  const activeParentId = selectedCategory
    ? (parentCats.find(p => p.id === selectedCategory)
        ? selectedCategory
        : subCats.find(s => s.id === selectedCategory)?.parent_id || null)
    : null;

  const filteredProducts = products.filter(p => {
    let matchCat = true;
    if (selectedCategory) {
      const isParent = parentCats.some(c => c.id === selectedCategory);
      if (isParent) {
        const childIds = subCats.filter(s => s.parent_id === selectedCategory).map(s => s.id);
        matchCat = p.category_id === selectedCategory || childIds.includes(p.category_id);
      } else {
        matchCat = p.category_id === selectedCategory;
      }
    }
    const matchSearch = search ? p.nom.toLowerCase().includes(search.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  const cartTotal = cart.reduce((sum, item) => {
    const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
    return sum + (item.product.prix + optTotal) * item.qty;
  }, 0);

  const discountAmount = discount ? Math.min(parseFloat(discount) || 0, cartTotal) : 0;
  const finalTotal = Math.max(0, cartTotal - discountAmount);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setModalQty(1);
    setModalNotes('');
    setModalOptions([]);
  };

  const toggleOption = (opt: ProductOption) => {
    setModalOptions(prev =>
      prev.find(o => o.id === opt.id) ? prev.filter(o => o.id !== opt.id) : [...prev, opt]
    );
  };

  const addToCart = () => {
    if (!selectedProduct) return;
    setCart(prev => [...prev, {
      product: selectedProduct,
      qty: modalQty,
      notes: modalNotes,
      selectedOptions: modalOptions,
    }]);
    setSelectedProduct(null);
    setFabricationDone(false);
  };

  const handleFabrication = async () => {
    if (cart.length === 0) return;
    setFabricating(true);

    const { data, error } = await supabase.rpc('save_direct_order', {
      p_order_id: activeOrderId,
      p_caissier_id: user?.id || null,
      p_total: cartTotal,
      p_status: 'BROUILLON',
      p_items: cart.map(item => ({
        product_id: item.product.id,
        nom_snapshot: item.product.nom,
        prix_snapshot: item.product.prix,
        qty: item.qty,
        notes: item.notes,
        options: item.selectedOptions.map(option => ({
          nom_snapshot: option.nom,
          prix_delta_snapshot: option.prix_delta,
        })),
      })),
    });

    if (error || !data?.[0]) {
      setFabricating(false);
      showToast('Erreur lors de l’enregistrement de la commande', 'error');
      return;
    }

    const savedOrder = data[0] as DirectOrderRpcResult;
    const orderId = savedOrder.order_id;
    setActiveOrderId(orderId);

    const result = await printFabrication(cart, orderId, user?.id || '');

    setFabricating(false);

    if (result.noPrinterConfigured) {
      showToast('Aucune imprimante Bar/Cuisine liée aux catégories. Configurez dans Administration.', 'error');
      return;
    }

    if (result.allAlreadyPrinted) {
      showToast('Tout a déjà été envoyé en fabrication.', 'info');
      return;
    }

    if (result.failCount > 0 && result.successCount === 0) {
      showToast(`Echec impression : ${result.failedPrinters.join(', ')}`, 'error');
      return;
    }

    if (result.failCount > 0) {
      showToast(`Partiellement envoyé. Echec : ${result.failedPrinters.join(', ')}`, 'error');
    } else {
      showToast(`Fabrication envoyée (${result.successCount} imprimante${result.successCount > 1 ? 's' : ''})`, 'print');
    }

    setFabricationDone(true);
    setTimeout(() => setFabricationDone(false), 4000);
  };

  const updateQty = (index: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index));
    } else {
      setCart(prev => prev.map((item, i) => i === index ? { ...item, qty } : item));
    }
    setFabricationDone(false);
  };

  const handleValidateAndPrint = async () => {
    if (cart.length === 0) return;

    const { missingCategories } = await buildPrintGroupsFromCart(cart);
    if (missingCategories.length > 0) {
      showToast(`Catégories sans imprimante : ${missingCategories.join(', ')}`, 'error');
      return;
    }

    setValidating(true);

    const total = finalTotal;

    const { data, error } = await supabase.rpc('save_direct_order', {
      p_order_id: activeOrderId,
      p_caissier_id: user?.id || null,
      p_total: total,
      p_status: 'VALIDE',
      p_items: cart.map(item => ({
        product_id: item.product.id,
        nom_snapshot: item.product.nom,
        prix_snapshot: item.product.prix,
        qty: item.qty,
        notes: item.notes,
        options: item.selectedOptions.map(option => ({
          nom_snapshot: option.nom,
          prix_delta_snapshot: option.prix_delta,
        })),
      })),
    });

    if (error || !data?.[0]) {
      setValidating(false);
      showToast('Erreur lors de l’enregistrement de la commande', 'error');
      return;
    }

    const savedOrder = data[0] as DirectOrderRpcResult;
    const orderId = savedOrder.order_id;
    setActiveOrderId(orderId);
    setValidating(false);
    setPendingOrder({ orderId, ticketNumber: savedOrder.ticket_number, total });
  };

  const handlePaymentDone = () => {
    setCart([]);
    setDiscount('');
    setPendingOrder(null);
    setActiveOrderId(null);
    setShowCart(false);
    setFabricationDone(false);
  };

  const modalOptTotal = modalOptions.reduce((s, o) => s + o.prix_delta, 0);
  const modalLineTotal = selectedProduct ? (selectedProduct.prix + modalOptTotal) * modalQty : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 pt-3 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-amber-400/30 transition-all"
            />
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="relative w-11 h-11 flex items-center justify-center bg-amber-500 rounded-xl text-white flex-shrink-0"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${!selectedCategory ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Tout
          </button>
          {parentCats.map(cat => {
            const catSubs = subCats.filter(s => s.parent_id === cat.id);
            const isActive = activeParentId === cat.id;
            return (
              <div key={cat.id} className="contents">
                <button
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {cat.nom}
                </button>
                {isActive && catSubs.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedCategory(sub.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${selectedCategory === sub.id ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-500 border-gray-200 hover:border-amber-200 hover:text-amber-600'}`}
                  >
                    › {sub.nom}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto px-4 py-3 ${cart.length > 0 ? 'pb-28' : ''}`}>
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-400 text-sm">Aucun produit trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => openProduct(product)}
                className="bg-white rounded-xl border border-gray-100 p-2 text-left hover:border-amber-300 hover:shadow-md transition-all active:scale-95 flex items-center gap-3"
              >
                <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.nom} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <Package size={18} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{product.nom}</p>
                  <p className="text-amber-600 font-bold text-sm mt-0.5">{product.prix.toLocaleString('fr-FR')} F</p>
                  {product.options && product.options.length > 0 && (
                    <p className="text-xs text-gray-400 flex items-center gap-1"><ChevronDown size={10} /> options</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl px-4 py-3">
          <div className="flex gap-3">
            <button
              onClick={handleFabrication}
              disabled={fabricating || validating}
              className={`flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                fabricationDone
                  ? 'bg-blue-700 text-white shadow-md'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
              }`}
            >
              {fabricating
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : fabricationDone
                  ? <CheckCircle size={18} />
                  : <Hammer size={18} />
              }
              <span className="text-sm font-bold">
                {fabricationDone ? 'Envoyé !' : 'FABRICATION'}
              </span>
            </button>

            <button
              onClick={() => setShowCart(true)}
              className="flex-1 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white shadow-md transition-all active:scale-95"
            >
              <ShoppingCart size={18} />
              <span className="text-sm font-bold">Valider · {finalTotal.toLocaleString('fr-FR')} F</span>
            </button>
          </div>
        </div>
      )}

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">{selectedProduct.nom}</h3>
                <p className="text-sm text-amber-600 font-semibold">{selectedProduct.prix.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {selectedProduct.options && selectedProduct.options.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Options</p>
                  <div className="space-y-2">
                    {selectedProduct.options.map(opt => {
                      const checked = modalOptions.find(o => o.id === opt.id);
                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleOption(opt)}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${checked ? 'border-amber-400 bg-amber-50' : 'border-gray-100 bg-gray-50'}`}
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

              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <StickyNote size={14} /> Notes cuisine
                </p>
                <textarea
                  value={modalNotes}
                  onChange={e => setModalNotes(e.target.value)}
                  placeholder="Instructions spéciales..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">Quantité</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setModalQty(q => Math.max(1, q - 1))} className="w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-all">
                    <Minus size={16} />
                  </button>
                  <span className="font-bold text-lg w-6 text-center">{modalQty}</span>
                  <button onClick={() => setModalQty(q => q + 1)} className="w-9 h-9 bg-amber-100 hover:bg-amber-200 text-amber-600 rounded-full flex items-center justify-center transition-all">
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <button
                onClick={addToCart}
                className="w-full bg-amber-500 hover:bg-amber-400 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <ShoppingCart size={18} />
                Ajouter · {modalLineTotal.toLocaleString('fr-FR')} FCFA
              </button>
            </div>
          </div>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={18} className="text-amber-500" />
                Panier — Vente directe
              </h3>
              <button onClick={() => setShowCart(false)} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {cart.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">Panier vide</p>
              ) : (
                <>
                  {cart.map((item, index) => {
                    const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
                    const lineTotal = (item.product.prix + optTotal) * item.qty;
                    return (
                      <div key={index} className="bg-gray-50 rounded-2xl p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{item.product.nom}</p>
                            {item.selectedOptions.length > 0 && (
                              <p className="text-xs text-amber-600 mt-0.5">{item.selectedOptions.map(o => o.nom).join(', ')}</p>
                            )}
                            {item.notes && <p className="text-xs text-gray-400 italic mt-0.5">"{item.notes}"</p>}
                          </div>
                          <button onClick={() => setCart(prev => prev.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500 transition-all">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(index, item.qty - 1)} className="w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:border-gray-300 transition-all">
                              <Minus size={12} />
                            </button>
                            <span className="font-bold text-sm w-4 text-center">{item.qty}</span>
                            <button onClick={() => updateQty(index, item.qty + 1)} className="w-7 h-7 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center hover:bg-amber-200 transition-all">
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="font-bold text-sm text-gray-900">{lineTotal.toLocaleString('fr-FR')} F</span>
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-2 border-t border-gray-100">
                    <label className="text-sm font-semibold text-gray-700 block mb-1.5">Remise (FCFA)</label>
                    <input
                      type="number"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    />
                  </div>

                  <div className="bg-gray-900 rounded-2xl p-4">
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-gray-400 mb-1">
                        <span>Sous-total</span>
                        <span>{cartTotal.toLocaleString('fr-FR')} F</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-green-400 mb-1">
                        <span>Remise</span>
                        <span>-{discountAmount.toLocaleString('fr-FR')} F</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 text-sm">Total</span>
                      <span className="text-white font-bold text-2xl">{finalTotal.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>

                  <button
                    onClick={() => { setShowCart(false); handleFabrication(); }}
                    disabled={fabricating || validating}
                    className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 ${
                      fabricationDone
                        ? 'bg-blue-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {fabricating
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : fabricationDone
                        ? <CheckCircle size={20} />
                        : <Hammer size={20} />
                    }
                    {fabricationDone ? 'Envoyé en fabrication !' : 'FABRICATION'}
                  </button>

                  <button
                    onClick={handleValidateAndPrint}
                    disabled={validating || cart.length === 0}
                    className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    {validating
                      ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <CheckCircle size={20} />
                    }
                    Valider & Imprimer
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {pendingOrder && (
        <DirectPaymentModal
          orderId={pendingOrder.orderId}
          ticketNumber={pendingOrder.ticketNumber}
          total={pendingOrder.total}
          onClose={() => { setPendingOrder(null); setCart([]); setDiscount(''); setShowCart(false); }}
          onDone={handlePaymentDone}
        />
      )}
    </div>
  );
}
