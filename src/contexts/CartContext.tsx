import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CartItem, Product, ProductOption, ProductVariant, Table, OrderType } from '../lib/types';
import { supabase } from '../lib/supabase';

interface CartContextType {
  activeTable: Table | null;
  setActiveTable: (t: Table | null) => void;
  selectTable: (t: Table, userId: string) => Promise<{ ok: boolean; lockedBy?: string }>;
  releaseTable: (userId: string) => Promise<void>;
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  cart: CartItem[];
  addToCart: (product: Product, qty: number, notes: string, options: ProductOption[], variants?: Record<string, ProductVariant>) => void;
  updateQty: (index: number, qty: number) => void;
  updateCartItemNotes: (index: number, notes: string) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [activeTable, setActiveTable] = useState<Table | null>(null);
  const [orderType, setOrderType] = useState<OrderType>('TABLE');
  const [cart, setCart] = useState<CartItem[]>([]);

  const selectTable = useCallback(async (table: Table, userId: string): Promise<{ ok: boolean; lockedBy?: string }> => {
    const { data: fresh } = await supabase
      .from('tables')
      .select('id, statut, locked_by, locked_by_user:users!tables_locked_by_fkey(nom)')
      .eq('id', table.id)
      .maybeSingle();

    if (fresh && fresh.locked_by && fresh.locked_by !== userId) {
      const name = (fresh.locked_by_user as { nom?: string } | null)?.nom || 'un autre serveur';
      return { ok: false, lockedBy: name };
    }

    // Don't lock a table that is already LIBRE or A_ENCAISSER — the DB trigger would clear it anyway
    if (fresh && (fresh.statut === 'LIBRE' || fresh.statut === 'A_ENCAISSER')) {
      setActiveTable({ ...table, locked_by: userId });
      return { ok: true };
    }

    await supabase
      .from('tables')
      .update({ locked_by: userId })
      .eq('id', table.id)
      .neq('statut', 'LIBRE');

    setActiveTable({ ...table, locked_by: userId });
    return { ok: true };
  }, []);

  const releaseTable = useCallback(async (userId: string) => {
    if (!activeTable) return;
    await supabase
      .from('tables')
      .update({ locked_by: null })
      .eq('id', activeTable.id)
      .eq('locked_by', userId);
    setActiveTable(null);
  }, [activeTable]);

  const addToCart = (product: Product, qty: number, notes: string, options: ProductOption[], variants?: Record<string, ProductVariant>) => {
    setCart(prev => [...prev, { product, qty, notes, selectedOptions: options, selectedVariants: variants || {} }]);
  };

  const updateQty = (index: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(index);
      return;
    }
    setCart(prev => prev.map((item, i) => i === index ? { ...item, qty } : item));
  };

  const updateCartItemNotes = (index: number, notes: string) => {
    setCart(prev => prev.map((item, i) => i === index ? { ...item, notes } : item));
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => {
    const optionsTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
    const variantsTotal = Object.values(item.selectedVariants || {}).reduce((s, v) => s + v.prix_delta, 0);
    return sum + (item.product.prix + optionsTotal + variantsTotal) * item.qty;
  }, 0);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <CartContext.Provider value={{ activeTable, setActiveTable, selectTable, releaseTable, orderType, setOrderType, cart, addToCart, updateQty, updateCartItemNotes, removeFromCart, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
