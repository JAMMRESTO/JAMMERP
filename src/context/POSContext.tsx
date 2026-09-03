import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { useRealtimeTable } from '../lib/useRealtimeTable';
import type {
  CartItem, Product, SaleType, Sale, SaleItem, PaymentMethod, Customer, Sauce, SelectedSauce, Flavor, SelectedFlavor
} from '../types/database';

interface POSContextType {
  // Cart
  cart: CartItem[];
  saleType: SaleType;
  tableNumber: string;
  customerName: string;
  selectedCustomer: Customer | null;
  orderNotes: string;
  discountAmount: number;
  sauces: Sauce[];
  flavors: Flavor[];
  setSaleType: (t: SaleType) => void;
  setTableNumber: (v: string) => void;
  setCustomerName: (v: string) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setOrderNotes: (v: string) => void;
  setDiscountAmount: (v: number) => void;
  addToCart: (product: Product, variantLabel?: string, variantPrice?: number, sauces?: SelectedSauce[], flavors?: SelectedFlavor[]) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  updateKitchenNote: (itemId: string, note: string) => void;
  clearCart: () => void;
  // Totals
  subtotal: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  // Checkout
  completeSale: (payments: { method: PaymentMethod; amount: number; reference?: string }[]) => Promise<{ sale: Sale; items: SaleItem[] } | null>;
  deferSale: () => Promise<{ sale: Sale; items: SaleItem[] } | null>;
  loadPendingSale: (saleId: string) => Promise<void>;
  cancelSale: (saleId: string, adminId: string, adminName: string, reason: string) => Promise<boolean>;
  isPendingResume: boolean;
  currentSale: Sale | null;
  currentSaleItems: SaleItem[];
  lastPayments: { method: PaymentMethod; amount: number; reference?: string }[];
}

const POSContext = createContext<POSContextType | null>(null);

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function POSProvider({ children, taxRate }: { children: ReactNode; taxRate: number }) {
  const { currentUser } = useAuth();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleType, setSaleType] = useState<SaleType>('delivery');
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orderNotes, setOrderNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [currentSaleItems, setCurrentSaleItems] = useState<SaleItem[]>([]);
  const [lastPayments, setLastPayments] = useState<{ method: PaymentMethod; amount: number; reference?: string }[]>([]);
  const [isPendingResume, setIsPendingResume] = useState(false);
  const [sauces, setSauces] = useState<Sauce[]>([]);
  const [flavors, setFlavors] = useState<Flavor[]>([]);

  useEffect(() => {
    if (!siteId) { setSauces([]); setFlavors([]); return; }
    let cancelled = false;
    (async () => {
      const { data: sauceData } = await supabase
        .from('sauces')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (!cancelled && sauceData) setSauces(sauceData as Sauce[]);
      const { data: flavorData } = await supabase
        .from('flavors')
        .select('*')
        .eq('site_id', siteId)
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (!cancelled && flavorData) setFlavors(flavorData as Flavor[]);
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  useRealtimeTable<Sauce>({
    table: 'sauces',
    siteId,
    onInsert: (row) => { if (row.is_active) setSauces(s => s.some(x => x.id === row.id) ? s : [...s, row]); },
    onUpdate: (row) => setSauces(s => row.is_active ? (s.some(x => x.id === row.id) ? s.map(x => x.id === row.id ? row : x) : [...s, row]) : s.filter(x => x.id !== row.id)),
    onDelete: (row) => setSauces(s => s.filter(x => x.id !== row.id)),
  });

  useRealtimeTable<Flavor>({
    table: 'flavors',
    siteId,
    onInsert: (row) => { if (row.is_active) setFlavors(s => s.some(x => x.id === row.id) ? s : [...s, row]); },
    onUpdate: (row) => setFlavors(s => row.is_active ? (s.some(x => x.id === row.id) ? s.map(x => x.id === row.id ? row : x) : [...s, row]) : s.filter(x => x.id !== row.id)),
    onDelete: (row) => setFlavors(s => s.filter(x => x.id !== row.id)),
  });

  const addToCart = useCallback((product: Product, variantLabel = '', variantPrice?: number, saucesForItem: SelectedSauce[] = [], flavorsForItem: SelectedFlavor[] = []) => {
    const unitPrice = variantPrice ?? product.price;
    const sauceKey = [...saucesForItem].map(s => s.id).sort().join(',');
    const flavorKey = [...flavorsForItem].map(f => f.id).sort().join(',');
    setCart(prev => {
      const existing = prev.find(
        i => i.product.id === product.id
          && i.variant_label === variantLabel
          && [...i.sauces].map(s => s.id).sort().join(',') === sauceKey
          && [...i.flavors].map(f => f.id).sort().join(',') === flavorKey
      );
      if (existing) {
        return prev.map(i =>
          i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, {
        id: uuid(),
        product,
        quantity: 1,
        variant_label: variantLabel,
        kitchen_note: '',
        unit_price: unitPrice,
        sauces: saucesForItem,
        flavors: flavorsForItem,
      }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, qty: number) => {
    if (qty <= 0) {
      setCart(prev => prev.filter(i => i.id !== itemId));
    } else {
      setCart(prev => prev.map(i => i.id === itemId ? { ...i, quantity: qty } : i));
    }
  }, []);

  const updateKitchenNote = useCallback((itemId: string, note: string) => {
    setCart(prev => prev.map(i => i.id === itemId ? { ...i, kitchen_note: note } : i));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountAmount(0);
    setTableNumber('');
    setCustomerName('');
    setSelectedCustomer(null);
    setOrderNotes('');
    setSaleType('delivery');
    setCurrentSale(null);
    setCurrentSaleItems([]);
    setIsPendingResume(false);
  }, []);

  const { subtotal, taxAmount, total, itemCount } = useMemo(() => {
    const sub = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const tax = Math.round((sub - discountAmount) * taxRate / 100);
    const tot = sub - discountAmount + tax;
    const count = cart.reduce((sum, i) => sum + i.quantity, 0);
    return { subtotal: sub, taxAmount: tax, total: tot, itemCount: count };
  }, [cart, discountAmount, taxRate]);

  const completeSale = useCallback(async (
    payments: { method: PaymentMethod; amount: number; reference?: string }[]
  ) => {
    if (cart.length === 0) return null;

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        site_id: siteId,
        sale_type: saleType,
        status: 'paid',
        table_number: tableNumber,
        customer_name: selectedCustomer ? selectedCustomer.name : customerName,
        customer_id: selectedCustomer?.id ?? null,
        notes: orderNotes,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        cashier_id: currentUser?.id ?? null,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saleError || !saleData) return null;
    const sale = saleData as Sale;

    const itemsToInsert = cart.map(i => ({
      site_id: siteId,
      sale_id: sale.id,
      product_id: i.product.id,
      product_name: i.product.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      subtotal: i.unit_price * i.quantity,
      variant_label: i.variant_label,
      kitchen_note: i.kitchen_note,
      sauces: i.sauces ?? [],
      flavors: i.flavors ?? [],
    }));

    const { data: itemsData } = await supabase
      .from('sale_items')
      .insert(itemsToInsert)
      .select();

    const paymentsToInsert = payments.map(p => ({
      site_id: siteId,
      sale_id: sale.id,
      method: p.method,
      amount: p.amount,
      reference: p.reference ?? '',
    }));

    await supabase.from('payments').insert(paymentsToInsert);

    const items = (itemsData ?? []) as SaleItem[];
    setCurrentSale(sale);
    setCurrentSaleItems(items);
    setLastPayments(payments);
    return { sale, items };
  }, [cart, saleType, tableNumber, selectedCustomer, customerName, orderNotes, subtotal, taxAmount, discountAmount, total, currentUser]);

  const deferSale = useCallback(async () => {
    if (cart.length === 0) return null;

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        site_id: siteId,
        sale_type: saleType,
        status: 'open',
        table_number: tableNumber,
        customer_name: selectedCustomer ? selectedCustomer.name : customerName,
        customer_id: selectedCustomer?.id ?? null,
        notes: orderNotes,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        total,
        cashier_id: currentUser?.id ?? null,
        paid_at: null,
      })
      .select()
      .single();

    if (saleError || !saleData) return null;
    const sale = saleData as Sale;

    const itemsToInsert = cart.map(i => ({
      site_id: siteId,
      sale_id: sale.id,
      product_id: i.product.id,
      product_name: i.product.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
      subtotal: i.unit_price * i.quantity,
      variant_label: i.variant_label,
      kitchen_note: i.kitchen_note,
      sauces: i.sauces ?? [],
      flavors: i.flavors ?? [],
    }));

    const { data: itemsData } = await supabase
      .from('sale_items')
      .insert(itemsToInsert)
      .select();

    const items = (itemsData ?? []) as SaleItem[];
    setCurrentSale(sale);
    setCurrentSaleItems(items);
    setLastPayments([]);
    return { sale, items };
  }, [cart, saleType, tableNumber, selectedCustomer, customerName, orderNotes, subtotal, taxAmount, discountAmount, total, currentUser]);

  const loadPendingSale = useCallback(async (saleId: string) => {
    const { data: saleData } = await supabase
      .from('sales')
      .select('*')
      .eq('id', saleId)
      .eq('site_id', siteId)
      .maybeSingle();
    if (!saleData) return;

    const { data: itemsData } = await supabase
      .from('sale_items')
      .select('*, product:products(*)')
      .eq('sale_id', saleId)
      .eq('site_id', siteId);

    const sale = saleData as Sale;

    // Rebuild cart from sale items
    const newCart: CartItem[] = (itemsData ?? []).map((si: SaleItem & { product: Product | null }) => ({
      id: uuid(),
      product: si.product ?? {
        id: si.product_id ?? '',
        name: si.product_name,
        price: si.unit_price,
      } as Product,
      quantity: si.quantity,
      variant_label: si.variant_label,
      kitchen_note: si.kitchen_note,
      unit_price: si.unit_price,
      sauces: Array.isArray(si.sauces) ? (si.sauces as SelectedSauce[]) : [],
      flavors: Array.isArray(si.flavors) ? (si.flavors as SelectedFlavor[]) : [],
    }));

    setCart(newCart);
    setSaleType(sale.sale_type);
    setTableNumber(sale.table_number ?? '');
    setCustomerName(sale.customer_name ?? '');
    setDiscountAmount(sale.discount_amount ?? 0);
    setOrderNotes(sale.notes ?? '');
    setCurrentSale(null);
    setCurrentSaleItems([]);
    setIsPendingResume(true);

    // Delete the pending sale so it's "taken back"
    await supabase.from('sale_items').delete().eq('sale_id', saleId).eq('site_id', siteId);
    await supabase.from('sales').delete().eq('id', saleId).eq('site_id', siteId);
  }, [siteId]);

  const cancelSale = useCallback(async (saleId: string, adminId: string, adminName: string, reason: string): Promise<boolean> => {
    const { error } = await supabase
      .from('sales')
      .update({
        status: 'cancelled',
        cancelled_by: adminId,
        cancelled_by_name: adminName,
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason,
      })
      .eq('id', saleId)
      .eq('site_id', siteId);
    return !error;
  }, [siteId]);

  return (
    <POSContext.Provider value={{
      cart,
      saleType, setSaleType,
      tableNumber, setTableNumber,
      customerName, setCustomerName,
      selectedCustomer, setSelectedCustomer,
      orderNotes, setOrderNotes,
      discountAmount, setDiscountAmount,
      sauces,
      flavors,
      addToCart, removeFromCart, updateQuantity, updateKitchenNote, clearCart,
      subtotal, taxAmount, total, itemCount,
      completeSale, deferSale, loadPendingSale, cancelSale, isPendingResume, currentSale, currentSaleItems, lastPayments,
    }}>
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  const ctx = useContext(POSContext);
  if (!ctx) throw new Error('usePOS must be used within POSProvider');
  return ctx;
}
