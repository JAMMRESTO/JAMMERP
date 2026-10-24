import { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';
import { useSettings } from './SettingsContext';
import { useRealtimeTable } from '../lib/useRealtimeTable';
import type {
  CartItem, Product, SaleType, Sale, SaleItem, PaymentMethod, Customer, Sauce, SelectedSauce, Flavor, SelectedFlavor,
  ProductComposition, ProductComponent
} from '../types/database';

export interface ComponentAvailabilityResult {
  available: boolean;
  componentName?: string;
  shortBy?: number;
  // For drink-choice products: which drink component IDs are available
  availableDrinkComponentIds: string[];
}

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
  addToCart: (product: Product, variantLabel?: string, variantPrice?: number, sauces?: SelectedSauce[], flavors?: SelectedFlavor[], menuDrink?: string | null) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  updateKitchenNote: (itemId: string, note: string) => void;
  clearCart: () => void;
  // Totals
  subtotal: number;
  taxAmount: number;
  total: number;
  itemCount: number;
  // Component stock availability
  checkProductAvailability: (productId: string, additionalQty?: number, drinkComponentId?: string | null) => ComponentAvailabilityResult;
  canIncreaseQty: (cartItemId: string) => ComponentAvailabilityResult;
  // Checkout
  completeSale: (payments: { method: PaymentMethod; amount: number; reference?: string }[]) => Promise<{ sale: Sale; items: SaleItem[] } | { error: string; componentName?: string; needed?: number; available?: number } | null>;
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
  const { settings } = useSettings();
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
  const [compositions, setCompositions] = useState<ProductComposition[]>([]);
  const [componentStock, setComponentStock] = useState<Record<string, number>>({});
  const [componentNames, setComponentNames] = useState<Record<string, string>>({});

  const reloadSaucesFlavors = useCallback(async () => {
    if (!siteId) { setSauces([]); setFlavors([]); return; }
    const { data: sauceData } = await supabase
      .from('sauces')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (sauceData) setSauces(sauceData as Sauce[]);
    const { data: flavorData } = await supabase
      .from('flavors')
      .select('*')
      .eq('site_id', siteId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (flavorData) setFlavors(flavorData as Flavor[]);
  }, [siteId]);

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

  // Load product compositions + component stock
  useEffect(() => {
    if (!siteId) { setCompositions([]); setComponentStock({}); setComponentNames({}); return; }
    let cancelled = false;
    (async () => {
      const [compRes, compProdRes] = await Promise.all([
        supabase.from('product_compositions').select('id, product_id, component_id, quantity_per_unit, is_drink, drink_choice').eq('site_id', siteId),
        supabase.from('product_components').select('id, name, stock').eq('site_id', siteId).eq('is_active', true),
      ]);
      if (cancelled) return;
      if (compRes.data) setCompositions(compRes.data as ProductComposition[]);
      if (compProdRes.data) {
        const stockMap: Record<string, number> = {};
        const nameMap: Record<string, string> = {};
        (compProdRes.data as ProductComponent[]).forEach(c => {
          stockMap[c.id] = Number(c.stock);
          nameMap[c.id] = c.name;
        });
        setComponentStock(stockMap);
        setComponentNames(nameMap);
      }
    })();
    return () => { cancelled = true; };
  }, [siteId]);

  // Realtime: refresh component stock on changes
  useRealtimeTable<ProductComponent>({
    table: 'product_components',
    siteId,
    onUpdate: (row) => {
      setComponentStock(prev => ({ ...prev, [row.id]: Number(row.stock) }));
      setComponentNames(prev => ({ ...prev, [row.id]: row.name }));
    },
    onInsert: (row) => {
      setComponentStock(prev => ({ ...prev, [row.id]: Number(row.stock) }));
      setComponentNames(prev => ({ ...prev, [row.id]: row.name }));
    },
    onDelete: (row) => {
      setComponentStock(prev => { const n = { ...prev }; delete n[row.id]; return n; });
    },
    onReconnect: async () => {
      if (!siteId) return;
      const { data } = await supabase.from('product_components').select('id, name, stock').eq('site_id', siteId).eq('is_active', true);
      if (data) {
        const stockMap: Record<string, number> = {};
        const nameMap: Record<string, string> = {};
        (data as ProductComponent[]).forEach(c => { stockMap[c.id] = Number(c.stock); nameMap[c.id] = c.name; });
        setComponentStock(stockMap);
        setComponentNames(nameMap);
      }
    },
  });

  // Compute component usage across the current cart
  const cartComponentUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    for (const item of cart) {
      const itemComps = compositions.filter(c => c.product_id === item.product.id);
      for (const comp of itemComps) {
        // For drink-choice compositions, the actual drink component is selected at order time
        // but we don't track which one was picked in the cart item. Use the fixed composition qty.
        if (!comp.is_drink || comp.drink_choice === 'fixed') {
          usage[comp.component_id] = (usage[comp.component_id] ?? 0) + comp.quantity_per_unit * item.quantity;
        }
      }
    }
    return usage;
  }, [cart, compositions]);

  const checkProductAvailability = useCallback((productId: string, additionalQty = 1, drinkComponentId: string | null = null): ComponentAvailabilityResult => {
    if (!settings.component_stock_enabled) return { available: true, availableDrinkComponentIds: [] };
    const productComps = compositions.filter(c => c.product_id === productId);
    if (productComps.length === 0) return { available: true, availableDrinkComponentIds: [] };

    const availableDrinkIds: string[] = [];
    let blockingComp: { name: string; shortBy: number } | null = null;

    for (const comp of productComps) {
      if (comp.is_drink && comp.drink_choice === 'choice') {
        // For drink-choice: check if the specified drink component has stock
        if (drinkComponentId) {
          const stock = componentStock[drinkComponentId] ?? 0;
          const used = cartComponentUsage[drinkComponentId] ?? 0;
          const needed = comp.quantity_per_unit * additionalQty;
          if (stock - used >= needed) {
            if (!availableDrinkIds.includes(drinkComponentId)) availableDrinkIds.push(drinkComponentId);
          }
        } else {
          // No specific drink selected yet — find all available drink components
          // Get all drink components linked to this product
          const drinkComps = productComps.filter(c => c.is_drink && c.drink_choice === 'choice');
          // Actually, drink_choice='choice' means the component is a placeholder;
          // the actual drink is selected from drink products. We need to check
          // which drink components (linked to drink products) have stock.
          // For now, check the composition's own component_id as one option
          const stock = componentStock[comp.component_id] ?? 0;
          const used = cartComponentUsage[comp.component_id] ?? 0;
          const needed = comp.quantity_per_unit * additionalQty;
          if (stock - used >= needed) {
            if (!availableDrinkIds.includes(comp.component_id)) availableDrinkIds.push(comp.component_id);
          }
        }
      } else {
        // Fixed component or fixed drink
        const stock = componentStock[comp.component_id] ?? 0;
        const used = cartComponentUsage[comp.component_id] ?? 0;
        const needed = comp.quantity_per_unit * additionalQty;
        if (stock - used < needed) {
          const shortBy = needed - (stock - used);
          if (!blockingComp || shortBy > blockingComp.shortBy) {
            blockingComp = { name: componentNames[comp.component_id] ?? 'Composant', shortBy };
          }
        }
      }
    }

    // For drink-choice products, if no drink option is available, block the product
    const hasDrinkChoice = productComps.some(c => c.is_drink && c.drink_choice === 'choice');
    if (hasDrinkChoice && !drinkComponentId && availableDrinkIds.length === 0 && !blockingComp) {
      blockingComp = { name: 'Boisson', shortBy: 1 };
    }

    return {
      available: !blockingComp,
      componentName: blockingComp?.name,
      shortBy: blockingComp?.shortBy,
      availableDrinkComponentIds: availableDrinkIds,
    };
  }, [settings.component_stock_enabled, compositions, componentStock, cartComponentUsage, componentNames]);

  const canIncreaseQty = useCallback((cartItemId: string): ComponentAvailabilityResult => {
    const item = cart.find(i => i.id === cartItemId);
    if (!item) return { available: true, availableDrinkComponentIds: [] };
    return checkProductAvailability(item.product.id, 1, item.drink_component_id ?? null);
  }, [cart, checkProductAvailability]);

  useRealtimeTable<Sauce>({
    table: 'sauces',
    siteId,
    onInsert: (row) => { if (row.is_active) setSauces(s => s.some(x => x.id === row.id) ? s : [...s, row]); },
    onUpdate: (row) => setSauces(s => row.is_active ? (s.some(x => x.id === row.id) ? s.map(x => x.id === row.id ? row : x) : [...s, row]) : s.filter(x => x.id !== row.id)),
    onDelete: (row) => setSauces(s => s.filter(x => x.id !== row.id)),
    onReconnect: () => { reloadSaucesFlavors(); },
  });

  useRealtimeTable<Flavor>({
    table: 'flavors',
    siteId,
    onInsert: (row) => { if (row.is_active) setFlavors(s => s.some(x => x.id === row.id) ? s : [...s, row]); },
    onUpdate: (row) => setFlavors(s => row.is_active ? (s.some(x => x.id === row.id) ? s.map(x => x.id === row.id ? row : x) : [...s, row]) : s.filter(x => x.id !== row.id)),
    onDelete: (row) => setFlavors(s => s.filter(x => x.id !== row.id)),
    onReconnect: () => { reloadSaucesFlavors(); },
  });

  const addToCart = useCallback((product: Product, variantLabel = '', variantPrice?: number, saucesForItem: SelectedSauce[] = [], flavorsForItem: SelectedFlavor[] = [], menuDrink: string | null = null) => {
    const unitPrice = variantPrice ?? product.price;
    const sauceKey = [...saucesForItem].map(s => s.id).sort().join(',');
    const flavorKey = [...flavorsForItem].map(f => f.id).sort().join(',');
    setCart(prev => {
      const existing = prev.find(
        i => i.product.id === product.id
          && i.variant_label === variantLabel
          && [...i.sauces].map(s => s.id).sort().join(',') === sauceKey
          && [...i.flavors].map(f => f.id).sort().join(',') === flavorKey
          && (i.menu_drink ?? null) === (menuDrink ?? null)
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
        menu_drink: menuDrink,
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
  ): Promise<{ sale: Sale; items: SaleItem[] } | { error: string; componentName?: string; needed?: number; available?: number } | null> => {
    if (cart.length === 0) return null;

    // If component stock is enabled, check and deduct atomically BEFORE creating the sale
    let componentConsumptions: { item_index: number; component_id: string; component_name: string; quantity_consumed: number }[] = [];
    if (settings.component_stock_enabled && siteId) {
      const rpcItems = cart.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        drink_component_id: i.drink_component_id ?? null,
      }));
      const { data: rpcResult, error: rpcError } = await supabase.rpc('check_and_deduct_component_stock', {
        p_site_id: siteId,
        p_items: rpcItems,
      });
      if (rpcError || !rpcResult || rpcResult.success === false) {
        if (rpcResult && rpcResult.error === 'insufficient_stock') {
          return { error: 'insufficient_stock', componentName: rpcResult.component_name, needed: rpcResult.needed, available: rpcResult.available };
        }
        return { error: 'component_stock_check_failed' };
      }
      componentConsumptions = (rpcResult.consumptions ?? []) as typeof componentConsumptions;
    }

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

    if (saleError || !saleData) {
      if (settings.component_stock_enabled && componentConsumptions.length > 0) {
        const restoreMap: Record<string, number> = {};
        for (const c of componentConsumptions) {
          restoreMap[c.component_id] = (restoreMap[c.component_id] ?? 0) + c.quantity_consumed;
        }
        for (const [componentId, qty] of Object.entries(restoreMap)) {
          const { data: comp } = await supabase
            .from('product_components')
            .select('stock')
            .eq('id', componentId)
            .eq('site_id', siteId)
            .maybeSingle();
          if (comp) {
            await supabase
              .from('product_components')
              .update({ stock: Number(comp.stock) + qty, updated_at: new Date().toISOString() })
              .eq('id', componentId)
              .eq('site_id', siteId);
          }
        }
      }
      return null;
    }
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
      menu_drink: i.menu_drink ?? null,
      stock_consumed: !settings.component_stock_enabled && i.product.track_stock && settings.stock_portion_enabled
        ? i.quantity * (i.product.stock_deduction_quantity || 1)
        : null,
    }));

    const { data: itemsData } = await supabase
      .from('sale_items')
      .insert(itemsToInsert)
      .select();

    // Record component consumptions per sale item
    if (settings.component_stock_enabled && itemsData && componentConsumptions.length > 0) {
      const consumptionsToInsert = componentConsumptions.map(c => ({
        site_id: siteId,
        sale_item_id: (itemsData[c.item_index] as SaleItem)?.id ?? '',
        component_id: c.component_id,
        component_name: c.component_name,
        quantity_consumed: c.quantity_consumed,
      })).filter(c => c.sale_item_id);
      if (consumptionsToInsert.length > 0) {
        await supabase.from('sale_item_component_consumptions').insert(consumptionsToInsert);
      }
    }

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
  }, [cart, saleType, tableNumber, selectedCustomer, customerName, orderNotes, subtotal, taxAmount, discountAmount, total, currentUser, settings]);

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
      menu_drink: i.menu_drink ?? null,
      stock_consumed: !settings.component_stock_enabled && i.product.track_stock && settings.stock_portion_enabled
        ? i.quantity * (i.product.stock_deduction_quantity || 1)
        : null,
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
  }, [cart, saleType, tableNumber, selectedCustomer, customerName, orderNotes, subtotal, taxAmount, discountAmount, total, currentUser, settings]);

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
      menu_drink: (si as any).menu_drink ?? null,
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
      checkProductAvailability, canIncreaseQty,
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
