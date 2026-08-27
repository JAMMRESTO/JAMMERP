import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Category, Product, CartItem } from '../../lib/types';
import {
  buildPrintGroupsFromCart,
  logPrintJobs,
  markItemsAsPrinted,
} from '../../lib/printService';
import CategorySidebar from './CategorySidebar';
import POSProductGrid from './POSProductGrid';
import CartPanel from './CartPanel';
import PaymentPanel from './PaymentPanel';
import ProductModal from './ProductModal';
import DirectPaymentModal from '../cashier/DirectPaymentModal';

interface PendingDirectOrder {
  orderId: string;
  ticketNumber: string;
  total: number;
}

export default function POSLayout() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [validating, setValidating] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<PendingDirectOrder | null>(null);
  const [serviceType, setServiceType] = useState<'sur_place' | 'a_emporter'>('sur_place');


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

  const filteredProducts = products.filter(p => {
    let matchCat = true;
    if (selectedCategory) {
      const isParent = categories.some(c => c.id === selectedCategory && !c.parent_id);
      if (isParent) {
        const childIds = categories.filter(c => c.parent_id === selectedCategory).map(c => c.id);
        matchCat = p.category_id === selectedCategory || childIds.includes(p.category_id);
      } else {
        matchCat = p.category_id === selectedCategory;
      }
    }
    const matchSearch = search ? p.nom.toLowerCase().includes(search.toLowerCase()) : true;
    return matchCat && matchSearch;
  });

  const handleUpdateQty = (index: number, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter((_, i) => i !== index));
    } else {
      setCart(prev => prev.map((item, i) => i === index ? { ...item, qty } : item));
    }
  };

  const handleRemove = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddToCart = (item: CartItem) => {
    setCart(prev => [...prev, item]);
  };

  const handleProductClick = (product: Product) => {
    const hasOptions = product.options && product.options.length > 0;
    const hasVariants = product.variant_groups && product.variant_groups.length > 0;
    if (!hasOptions && !hasVariants) {
      handleAddToCart({ product, qty: 1, notes: '', selectedOptions: [] });
    } else {
      setSelectedProduct(product);
    }
  };

  const handleValidate = async (svcType: 'sur_place' | 'a_emporter') => {
    if (cart.length === 0) return;

    const { missingCategories } = await buildPrintGroupsFromCart(cart);
    if (missingCategories.length > 0) {
      setPrintError(`Catégories sans imprimante : ${missingCategories.join(', ')}. Configurez dans l'administration.`);
      return;
    }

    setValidating(true);
    setPrintError(null);

    const cartTotal = cart.reduce((sum, item) => {
      const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
      const variantTotal = item.selectedVariants ? Object.values(item.selectedVariants).reduce((s, v) => s + v.prix_delta, 0) : 0;
      return sum + (item.product.prix + optTotal + variantTotal) * item.qty;
    }, 0);
    const total = cartTotal;

    const { data: newOrder, error } = await supabase.from('orders').insert({
      table_id: null,
      serveur_id: null,
      caissier_id: user?.id,
      order_type: 'DIRECT',
      statut: 'VALIDE',
      total,
    }).select().single();

    if (error || !newOrder) {
      setPrintError('Erreur lors de la création de la commande');
      setValidating(false);
      return;
    }

    const orderId = newOrder.id;
    const ticketNumber = newOrder.ticket_number;
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(cart.map(item => ({
        order_id: orderId,
        product_id: item.product.id,
        nom_snapshot: item.product.nom,
        prix_snapshot: item.product.prix,
        qty: item.qty,
        printed_qty: 0,
        notes: item.notes,
      })))
      .select('id, product_id');

    if (itemsError || !orderItems) {
      setPrintError('Erreur lors de l’ajout des articles');
      setValidating(false);
      return;
    }

    const itemIdByProduct = new Map(orderItems.map(item => [item.product_id, item.id]));
    const optionRows = cart.flatMap(item => {
      const orderItemId = itemIdByProduct.get(item.product.id);
      return orderItemId
        ? item.selectedOptions.map(option => ({
            order_item_id: orderItemId,
            nom_snapshot: option.nom,
            prix_delta_snapshot: option.prix_delta,
          }))
        : [];
    });

    if (optionRows.length > 0) {
      const { error: optionsError } = await supabase.from('order_item_options').insert(optionRows);
      if (optionsError) {
        setPrintError('Erreur lors de l’ajout des options');
        setValidating(false);
        return;
      }
    }

    const { groups } = await buildPrintGroupsFromCart(cart);
    const insertedIds = orderItems.map(item => item.id);
    const tableNom = svcType === 'sur_place' ? 'Sur place' : 'A emporter';
    await Promise.all([
      markItemsAsPrinted(insertedIds),
      logPrintJobs(groups, {
        orderId, tableId: null, tableNom,
        ticketNumber, userId: user?.id || '', type: 'INITIAL',
      }),
    ]);

    setValidating(false);
    setPendingOrder({ orderId, ticketNumber, total });
  };

  const handlePaymentDone = () => {
    setCart([]);
    setPendingOrder(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Desktop layout */}
      <div
        className="hidden md:grid h-full"
        style={{
          gridTemplateColumns: 'clamp(90px, 130px, 130px) 1fr clamp(340px, 420px, 420px)',
          overflow: 'hidden',
        }}
      >
        <CategorySidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
        />

        <POSProductGrid
          products={filteredProducts}
          search={search}
          onSearchChange={setSearch}
          onProductClick={handleProductClick}
        />

        <div
          className="flex flex-col bg-white border-l border-gray-200"
          style={{ overflow: 'hidden' }}
        >
          <div className="px-4 py-2.5 border-b border-gray-200 flex-shrink-0" style={{ background: '#f8f9fa' }}>
            <h2 className="font-bold text-base" style={{ color: '#e91e8c' }}>Vente directe</h2>
          </div>

          <CartPanel
            cart={cart}
            onUpdateQty={handleUpdateQty}
            onRemove={handleRemove}
          />

          <PaymentPanel
            cart={cart}
            onValidate={handleValidate}
            validating={validating}
            printError={printError}
            onClearError={() => setPrintError(null)}
            onClearCart={() => setCart([])}
            serviceType={serviceType}
            onServiceTypeChange={setServiceType}
          />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col h-full md:hidden" style={{ overflow: 'hidden' }}>
        <CategorySidebar
          categories={categories}
          selectedCategory={selectedCategory}
          onSelect={setSelectedCategory}
          mobile
        />

        <POSProductGrid
          products={filteredProducts}
          search={search}
          onSearchChange={setSearch}
          onProductClick={handleProductClick}
        />
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {pendingOrder && (
        <DirectPaymentModal
          orderId={pendingOrder.orderId}
          ticketNumber={pendingOrder.ticketNumber}
          total={pendingOrder.total}
          onClose={() => { setPendingOrder(null); setCart([]); }}
          onDone={handlePaymentDone}
        />
      )}
    </>
  );
}
