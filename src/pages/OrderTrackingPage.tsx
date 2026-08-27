import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag, CheckCircle2, ChefHat, Package, Truck, Ban,
  Clock, Phone, MapPin, Loader2, ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { OnlineOrder, OnlineOrderStatus } from '../types/database';

const STEPS: { status: OnlineOrderStatus; label: string; icon: typeof Clock; color: string }[] = [
  { status: 'new', label: 'Commande recue', icon: ShoppingBag, color: '#3B82F6' },
  { status: 'confirmed', label: 'Confirmee', icon: CheckCircle2, color: '#06B6D4' },
  { status: 'preparing', label: 'En preparation', icon: ChefHat, color: '#F59E0B' },
  { status: 'ready', label: 'Prete', icon: Package, color: '#10B981' },
  { status: 'delivered', label: 'Livree / Recuperee', icon: Truck, color: '#10B981' },
];

const STATUS_INDEX: Record<string, number> = {
  new: 0, confirmed: 1, preparing: 2, ready: 3, delivered: 4, cancelled: -1,
};

export function OrderTrackingPage() {
  const [order, setOrder] = useState<OnlineOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const orderId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (!orderId) {
      setError('Aucun identifiant de commande fourni');
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      const { data, error: err } = await supabase
        .from('online_orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();

      if (err || !data) {
        setError('Commande introuvable');
        setLoading(false);
        return;
      }
      setOrder(data as OnlineOrder);
      setLoading(false);
    }

    fetchOrder();

    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'online_orders', filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder(prev => prev ? { ...prev, ...payload.new } as OnlineOrder : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-3">
        <Loader2 size={28} className="text-orange-400 animate-spin" />
        <p className="text-gray-400 text-sm">Chargement...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4 p-6 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
          <Ban size={28} className="text-red-400" />
        </div>
        <p className="text-gray-600 font-medium">{error || 'Commande introuvable'}</p>
        <a href="/order" className="flex items-center gap-2 text-orange-500 text-sm font-medium hover:underline">
          <ArrowLeft size={14} /> Retour au menu
        </a>
      </div>
    );
  }

  const currentIdx = STATUS_INDEX[order.status] ?? -1;
  const isCancelled = order.status === 'cancelled';
  const isDelivered = order.status === 'delivered';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <a href="/order"
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors">
            <ArrowLeft size={18} />
          </a>
          <div>
            <h1 className="font-bold text-gray-800 text-base">Suivi commande #{String(order.order_number).padStart(4, '0')}</h1>
            <p className="text-gray-400 text-xs mt-0.5">Mise a jour en temps reel</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        {/* Status banner */}
        {isCancelled ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center"
          >
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Ban size={24} className="text-red-500" />
            </div>
            <p className="text-red-700 font-bold text-base">Commande annulee</p>
            <p className="text-red-500 text-sm mt-1">Cette commande a ete annulee.</p>
          </motion.div>
        ) : isDelivered ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center"
          >
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} className="text-emerald-500" />
            </div>
            <p className="text-emerald-700 font-bold text-base">Commande livree !</p>
            <p className="text-emerald-500 text-sm mt-1">Merci pour votre commande. Bon appetit !</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              {(() => { const step = STEPS[currentIdx]; const Icon = step?.icon ?? Clock; return <Icon size={20} className="text-orange-500" />; })()}
            </div>
            <div>
              <p className="text-orange-800 font-bold text-sm">
                {STEPS[currentIdx]?.label ?? order.status}
              </p>
              <p className="text-orange-600 text-xs mt-0.5">
                Votre commande est en cours de traitement
              </p>
            </div>
            <div className="ml-auto flex-shrink-0">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          </motion.div>
        )}

        {/* Progress tracker */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="font-semibold text-gray-700 text-sm mb-5">Progression</p>
            <div className="relative">
              {STEPS.map((step, i) => {
                const done = i <= currentIdx;
                const active = i === currentIdx;
                const Icon = step.icon;
                return (
                  <div key={step.status} className="flex items-start gap-3 relative">
                    {/* Vertical line */}
                    {i < STEPS.length - 1 && (
                      <div className="absolute left-[15px] top-8 w-0.5 h-8"
                        style={{ backgroundColor: i < currentIdx ? step.color : '#E5E7EB' }} />
                    )}
                    {/* Circle */}
                    <motion.div
                      animate={active ? { scale: [1, 1.15, 1] } : {}}
                      transition={active ? { repeat: Infinity, duration: 2 } : {}}
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border-2 transition-all"
                      style={{
                        backgroundColor: done ? step.color + '15' : '#F9FAFB',
                        borderColor: done ? step.color : '#E5E7EB',
                      }}
                    >
                      <Icon size={14} style={{ color: done ? step.color : '#9CA3AF' }} />
                    </motion.div>
                    {/* Text */}
                    <div className="pb-8">
                      <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>
                        {step.label}
                      </p>
                      {active && !isDelivered && (
                        <p className="text-orange-500 text-xs mt-0.5 font-medium">En cours...</p>
                      )}
                      {done && !active && i === 0 && order.created_at && (
                        <p className="text-gray-400 text-[10px] mt-0.5">
                          {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {done && !active && i === 1 && order.confirmed_at && (
                        <p className="text-gray-400 text-[10px] mt-0.5">
                          {new Date(order.confirmed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {done && !active && i === 3 && order.ready_at && (
                        <p className="text-gray-400 text-[10px] mt-0.5">
                          {new Date(order.ready_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {done && !active && i === 4 && order.delivered_at && (
                        <p className="text-gray-400 text-[10px] mt-0.5">
                          {new Date(order.delivered_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <p className="font-semibold text-gray-700 text-sm">Details de la commande</p>

          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <Package size={14} className="text-gray-400 flex-shrink-0" />
            <span>{order.order_type === 'delivery' ? 'Livraison' : 'A emporter'}</span>
          </div>

          {order.customer_phone && (
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Phone size={14} className="text-gray-400 flex-shrink-0" />
              <span>{order.customer_phone}</span>
            </div>
          )}

          {order.customer_address && (
            <div className="flex items-start gap-2 text-gray-600 text-sm">
              <MapPin size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <span>{order.customer_address}</span>
            </div>
          )}

          {/* Items */}
          <div className="border-t border-gray-100 pt-3 mt-3 space-y-2">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-600">{item.quantity}x {item.product_name}</span>
                <span className="text-gray-800 font-medium">{item.subtotal.toLocaleString('fr-FR')}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-100">
              <span className="text-gray-800">Total</span>
              <span className="text-orange-600">{Number(order.total).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>

        {/* Return link */}
        <div className="text-center pt-2">
          <a href="/order" className="text-orange-500 text-sm font-medium hover:underline">
            Passer une nouvelle commande
          </a>
        </div>
      </div>
    </div>
  );
}
