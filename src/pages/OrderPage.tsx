import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, X, Plus, Minus, ChefHat, Phone, MapPin,
  User, Package, Truck, CheckCircle2, Loader2, ChevronRight,
  ArrowLeft, Clock, Search, FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, Category, OnlineOrderType, OnlineOrderItem } from '../types/database';

// ─────────────────────────────────────────────────────────
// Types locaux
// ─────────────────────────────────────────────────────────
interface RestaurantInfo {
  restaurant_name: string;
  currency_symbol: string;
  tax_rate: number;
  logo_url: string | null;
  address: string;
  phone: string;
}

interface CartEntry {
  product: Product;
  quantity: number;
  note: string;
}

type Step = 'menu' | 'checkout' | 'confirmed';

const DEFAULT_COVER = 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
function fmt(n: number, sym: string) {
  return `${n.toLocaleString('fr-FR')} ${sym}`;
}

// ─────────────────────────────────────────────────────────
// Product Card
// ─────────────────────────────────────────────────────────
function ProductCard({ product, qty, sym, onAdd, onRemove }: {
  product: Product; qty: number; sym: string;
  onAdd: () => void; onRemove: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-shadow"
    >
      <div className="relative h-36 overflow-hidden bg-gray-100">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
            <ChefHat size={32} className="text-orange-200" />
          </div>
        )}
        {qty > 0 && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-white text-[10px] font-black">{qty}</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{product.name}</p>
        {product.description && (
          <p className="text-gray-400 text-[11px] mt-0.5 line-clamp-1">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <span className="text-orange-600 font-bold text-sm">{fmt(product.price, sym)}</span>
          {qty === 0 ? (
            <motion.button whileTap={{ scale: 0.93 }} onClick={onAdd}
              className="w-8 h-8 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-orange-500/30 transition-colors">
              <Plus size={16} />
            </motion.button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={onRemove}
                className="w-7 h-7 bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-500 rounded-lg flex items-center justify-center transition-colors">
                <Minus size={12} />
              </button>
              <span className="text-gray-800 font-bold text-sm w-5 text-center">{qty}</span>
              <button onClick={onAdd}
                className="w-7 h-7 bg-orange-500 hover:bg-orange-600 text-white rounded-lg flex items-center justify-center transition-colors">
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Cart Drawer
// ─────────────────────────────────────────────────────────
function CartDrawer({ entries, sym, taxRate, onClose, onCheckout, onAdd, onRemove, onNoteChange }: {
  entries: CartEntry[]; sym: string; taxRate: number;
  onClose: () => void; onCheckout: () => void;
  onAdd: (id: string) => void; onRemove: (id: string) => void;
  onNoteChange: (id: string, note: string) => void;
}) {
  const subtotal = entries.reduce((s, e) => s + e.product.price * e.quantity, 0);
  const tax = Math.round(subtotal * taxRate / 100);
  const total = subtotal + tax;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-sm bg-white flex flex-col h-full shadow-2xl">

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800 text-lg">Mon panier</h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
          {entries.map(e => (
            <div key={e.product.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                {e.product.image_url
                  ? <img src={e.product.image_url} alt={e.product.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><ChefHat size={18} className="text-gray-300" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm truncate">{e.product.name}</p>
                <p className="text-orange-600 font-bold text-sm mt-0.5">{fmt(e.product.price * e.quantity, sym)}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button onClick={() => onRemove(e.product.id)}
                    className="w-6 h-6 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors">
                    <Minus size={10} />
                  </button>
                  <span className="text-gray-700 font-bold text-sm w-5 text-center">{e.quantity}</span>
                  <button onClick={() => onAdd(e.product.id)}
                    className="w-6 h-6 bg-orange-500 rounded-lg flex items-center justify-center text-white hover:bg-orange-600 transition-colors">
                    <Plus size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-gray-500 text-sm">
              <span>Sous-total</span><span>{fmt(subtotal, sym)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-sm">
              <span>TVA ({taxRate}%)</span><span>{fmt(tax, sym)}</span>
            </div>
            <div className="flex justify-between text-gray-800 font-bold text-base pt-1.5 border-t border-gray-100">
              <span>Total</span><span className="text-orange-600">{fmt(total, sym)}</span>
            </div>
          </div>
          <motion.button onClick={onCheckout} whileTap={{ scale: 0.98 }}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/30 transition-colors text-sm">
            Commander <ChevronRight size={16} />
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Checkout Step
// ─────────────────────────────────────────────────────────
function CheckoutStep({ entries, sym, taxRate, onBack, onConfirm, loading }: {
  entries: CartEntry[]; sym: string; taxRate: number;
  onBack: () => void; onConfirm: (form: { name: string; phone: string; address: string; type: OnlineOrderType; notes: string }) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({ name: '', phone: '', address: '', type: 'delivery' as OnlineOrderType, notes: '' });
  const subtotal = entries.reduce((s, e) => s + e.product.price * e.quantity, 0);
  const tax = Math.round(subtotal * taxRate / 100);
  const total = subtotal + tax;

  const valid = form.name.trim() && form.phone.trim() && (form.type === 'takeaway' || form.address.trim());

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button onClick={onBack}
          className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-bold text-gray-800 text-base">Finaliser la commande</h1>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {/* Type */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="font-semibold text-gray-700 text-sm mb-3">Mode de récupération</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: 'delivery', label: 'Livraison', icon: Truck, desc: 'Livré à votre adresse' },
              { id: 'takeaway', label: 'À emporter', icon: Package, desc: 'Récupération sur place' },
            ] as const).map(t => {
              const active = form.type === t.id;
              return (
                <button key={t.id} onClick={() => setForm(f => ({ ...f, type: t.id }))}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${active ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <t.icon size={20} className={active ? 'text-orange-500' : 'text-gray-400'} />
                  <span className={`font-semibold text-xs ${active ? 'text-orange-700' : 'text-gray-600'}`}>{t.label}</span>
                  <span className="text-gray-400 text-[10px] leading-tight">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Customer info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <p className="font-semibold text-gray-700 text-sm">Vos informations</p>
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom complet *"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors" />
          </div>
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="Téléphone *" type="tel"
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors" />
          </div>
          {form.type === 'delivery' && (
            <div className="relative">
              <MapPin size={15} className="absolute left-3 top-3 text-gray-400" />
              <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Adresse de livraison *" rows={2}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 resize-none transition-colors" />
            </div>
          )}
          <div className="relative">
            <FileText size={15} className="absolute left-3 top-3 text-gray-400" />
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Instructions particulières (optionnel)" rows={2}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-orange-400 resize-none transition-colors" />
          </div>
        </div>

        {/* Récap commande */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="font-semibold text-gray-700 text-sm mb-3">Récapitulatif</p>
          <div className="space-y-2 mb-3">
            {entries.map(e => (
              <div key={e.product.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{e.quantity}× {e.product.name}</span>
                <span className="text-gray-800 font-medium">{fmt(e.product.price * e.quantity, sym)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-2.5 space-y-1">
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Sous-total</span><span>{fmt(subtotal, sym)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs">
              <span>TVA ({taxRate}%)</span><span>{fmt(tax, sym)}</span>
            </div>
            <div className="flex justify-between text-gray-800 font-bold text-sm pt-1.5 border-t border-gray-100">
              <span>Total à payer</span><span className="text-orange-600">{fmt(total, sym)}</span>
            </div>
          </div>
        </div>

        <motion.button
          onClick={() => valid && onConfirm(form)}
          disabled={!valid || loading}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-base"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          Confirmer la commande · {fmt(total, sym)}
        </motion.button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Confirmation screen
// ─────────────────────────────────────────────────────────
function ConfirmedScreen({ orderNumber, orderType, restName, onNewOrder }: {
  orderNumber: number; orderType: OnlineOrderType; restName: string; onNewOrder: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 250 }}
        className="w-24 h-24 bg-green-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
        <CheckCircle2 size={44} className="text-green-500" />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h2 className="text-2xl font-black text-gray-800 mb-1">Commande confirmée !</h2>
        <p className="text-gray-500 text-base mb-4">
          Commande <span className="font-bold text-gray-700">#{String(orderNumber).padStart(4, '0')}</span> reçue par <span className="font-bold">{restName}</span>
        </p>
        <div className="flex items-center justify-center gap-2 mb-6 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-3">
          {orderType === 'delivery'
            ? <><Truck size={18} className="text-orange-500" /><span className="text-orange-700 font-semibold text-sm">Livraison en cours de préparation</span></>
            : <><Package size={18} className="text-orange-500" /><span className="text-orange-700 font-semibold text-sm">Votre commande est en préparation</span></>
          }
        </div>
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 max-w-xs mx-auto mb-6 text-left">
          <Clock size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-blue-700 text-sm">Vous serez contacté pour confirmer les détails de votre commande.</p>
        </div>
        <button onClick={onNewOrder}
          className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-md shadow-orange-500/25 transition-colors text-sm">
          Passer une nouvelle commande
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────
export function OrderPage() {
  const [siteId, setSiteId] = useState<string | null>(null);
  const [info, setInfo] = useState<RestaurantInfo>({
    restaurant_name: 'Mon Restaurant',
    currency_symbol: 'FCFA',
    tax_rate: 18,
    logo_url: null,
    address: '',
    phone: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [step, setStep] = useState<Step>('menu');
  const [confirmedOrder, setConfirmedOrder] = useState<{ number: number; type: OnlineOrderType } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const catBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      // Resolve site_id from ?site=<slug> URL param
      const slug = new URLSearchParams(window.location.search).get('site');
      let resolvedSiteId: string | null = null;
      if (slug) {
        const { data: siteData } = await supabase
          .from('sites')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();
        resolvedSiteId = siteData?.id ?? null;
      }
      setSiteId(resolvedSiteId);

      const settingsQuery = supabase.from('settings').select('key, value');
      const catsQuery = supabase.from('categories').select('*').eq('is_active', true).order('sort_order');
      const prodsQuery = supabase.from('products').select('*').eq('is_available', true).order('name');

      if (resolvedSiteId) {
        settingsQuery.eq('site_id', resolvedSiteId);
        catsQuery.eq('site_id', resolvedSiteId);
        prodsQuery.eq('site_id', resolvedSiteId);
      }

      const [settingsRes, catsRes, prodsRes] = await Promise.all([
        settingsQuery,
        catsQuery,
        prodsQuery,
      ]);

      const rows: { key: string; value: string }[] = settingsRes.data ?? [];
      const get = (k: string) => rows.find(r => r.key === k)?.value;
      setInfo({
        restaurant_name: get('restaurant_name') ?? 'Mon Restaurant',
        currency_symbol: get('currency_symbol') ?? 'FCFA',
        tax_rate: parseFloat(get('tax_rate') ?? '18'),
        logo_url: get('logo_url') ?? null,
        address: get('address') ?? '',
        phone: get('phone') ?? '',
      });
      setCategories((catsRes.data ?? []) as Category[]);
      setProducts((prodsRes.data ?? []) as Product[]);
      setLoading(false);
    }
    loadData();
  }, []);

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const ex = prev.find(e => e.product.id === product.id);
      if (ex) return prev.map(e => e.product.id === product.id ? { ...e, quantity: e.quantity + 1 } : e);
      return [...prev, { product, quantity: 1, note: '' }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => {
      const ex = prev.find(e => e.product.id === productId);
      if (!ex) return prev;
      if (ex.quantity === 1) return prev.filter(e => e.product.id !== productId);
      return prev.map(e => e.product.id === productId ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }, []);

  const totalCount = cart.reduce((s, e) => s + e.quantity, 0);
  const subtotal = cart.reduce((s, e) => s + e.product.price * e.quantity, 0);
  const tax = Math.round(subtotal * info.tax_rate / 100);
  const total = subtotal + tax;

  const filteredProducts = products.filter(p => {
    if (activeCat !== 'all' && p.category_id !== activeCat) return false;
    if (search.trim() && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function handleConfirm(form: { name: string; phone: string; address: string; type: OnlineOrderType; notes: string }) {
    setSubmitting(true);
    const items: OnlineOrderItem[] = cart.map(e => ({
      product_id: e.product.id,
      product_name: e.product.name,
      unit_price: e.product.price,
      quantity: e.quantity,
      subtotal: e.product.price * e.quantity,
      kitchen_note: e.note || undefined,
    }));

    const { data } = await supabase.from('online_orders').insert({
      customer_name: form.name,
      customer_phone: form.phone,
      customer_address: form.address,
      order_type: form.type,
      notes: form.notes,
      items,
      subtotal,
      tax_amount: tax,
      discount_amount: 0,
      total,
      status: 'new',
      source: 'online',
      site_id: siteId,
    }).select('order_number').maybeSingle();

    setSubmitting(false);
    if (data) {
      setConfirmedOrder({ number: data.order_number, type: form.type });
      setStep('confirmed');
      setCart([]);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-3">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center">
          <ChefHat size={24} className="text-orange-500" />
        </div>
        <Loader2 size={20} className="text-orange-400 animate-spin" />
        <p className="text-gray-400 text-sm">Chargement du menu...</p>
      </div>
    );
  }

  if (step === 'confirmed' && confirmedOrder) {
    return (
      <ConfirmedScreen
        orderNumber={confirmedOrder.number}
        orderType={confirmedOrder.type}
        restName={info.restaurant_name}
        onNewOrder={() => { setStep('menu'); setConfirmedOrder(null); }}
      />
    );
  }

  if (step === 'checkout') {
    return (
      <CheckoutStep
        entries={cart} sym={info.currency_symbol} taxRate={info.tax_rate}
        loading={submitting}
        onBack={() => setStep('menu')}
        onConfirm={handleConfirm}
      />
    );
  }

  // ── Menu step ──
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero header */}
      <div className="relative h-48 sm:h-64 overflow-hidden">
        <img src={DEFAULT_COVER} alt="cover" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center mb-3 shadow-lg">
            <ChefHat size={26} className="text-white" />
          </div>
          <h1 className="text-white font-black text-2xl sm:text-3xl drop-shadow-md">{info.restaurant_name}</h1>
          {info.address && (
            <p className="text-white/70 text-xs mt-1 flex items-center gap-1">
              <MapPin size={11} />{info.address}
            </p>
          )}
        </div>
      </div>

      {/* Sticky nav: search + categories */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm">
        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Chercher dans le menu..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-400 transition-colors" />
          </div>
        </div>

        {/* Category tabs */}
        {categories.length > 0 && (
          <div ref={catBarRef} className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setActiveCat('all')}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCat === 'all' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Tout
            </button>
            {categories.map(cat => (
              <button key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCat === cat.id ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Products grid */}
      <div className="flex-1 px-4 py-5 pb-28 max-w-2xl mx-auto w-full">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ChefHat size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">Aucun article trouvé</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map(p => (
              <ProductCard key={p.id} product={p} sym={info.currency_symbol}
                qty={cart.find(e => e.product.id === p.id)?.quantity ?? 0}
                onAdd={() => addToCart(p)}
                onRemove={() => removeFromCart(p.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating cart button */}
      <AnimatePresence>
        {totalCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-5 left-4 right-4 z-30"
          >
            <button onClick={() => setShowCart(true)}
              className="w-full max-w-lg mx-auto flex items-center justify-between bg-orange-500 hover:bg-orange-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-orange-500/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShoppingCart size={15} />
                </div>
                <span className="font-bold text-sm">{totalCount} article{totalCount > 1 ? 's' : ''}</span>
              </div>
              <span className="font-black text-base">{fmt(total, info.currency_symbol)}</span>
              <div className="flex items-center gap-1 text-white/90 text-sm font-semibold">
                Voir <ChevronRight size={15} />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <CartDrawer
            entries={cart} sym={info.currency_symbol} taxRate={info.tax_rate}
            onClose={() => setShowCart(false)}
            onCheckout={() => { setShowCart(false); setStep('checkout'); }}
            onAdd={id => addToCart(products.find(p => p.id === id)!)}
            onRemove={removeFromCart}
            onNoteChange={() => {}}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
