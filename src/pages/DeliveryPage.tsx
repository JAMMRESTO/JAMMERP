import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, User, Phone, Star, Plus, X, Check,
  MapPin, Clock, CheckCircle2, XCircle, Bike,
  ArrowRight, Edit3, Trash2, DollarSign, TrendingUp,
  RefreshCw, Search, Filter, Wallet, Package,
  AlertCircle, ChevronDown, Printer, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { printDeliveryTicket, type EscposDeliveryData } from '../lib/escpos';
import { buildDeliveryTicketHtml, printViaIframe } from '../lib/printUtils';
import { usePrinter } from '../context/PrinterContext';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../components/ui/Toast';
import { useSettings } from '../context/SettingsContext';
import type {
  Driver, DriverStatus, Delivery, DeliveryStatus,
  DeliveryWithDriver, DriverPayment, DriverPaymentType
} from '../types/database';

// ─────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────
const driverStatusConfig: Record<DriverStatus, { label: string; color: string; bg: string; border: string; dot: string }> = {
  available: { label: 'Disponible', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: '#10B981' },
  busy:      { label: 'En course',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   dot: '#F59E0B' },
  offline:   { label: 'Hors ligne', color: 'text-white/40',    bg: 'bg-white/5',        border: 'border-white/10',       dot: '#6B7280' },
};

const deliveryStatusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string; border: string; next?: DeliveryStatus }> = {
  pending:    { label: 'En attente',   color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   next: 'assigned' },
  assigned:   { label: 'Assignée',     color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    next: 'picked_up' },
  picked_up:  { label: 'En route',     color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25',  next: 'delivered' },
  delivered:  { label: 'Livrée',       color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  cancelled:  { label: 'Annulée',      color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25' },
};

const paymentTypeConfig: Record<DriverPaymentType, { label: string; color: string }> = {
  commission: { label: 'Commission',  color: 'text-emerald-400' },
  bonus:      { label: 'Bonus',       color: 'text-blue-400' },
  deduction:  { label: 'Déduction',   color: 'text-red-400' },
  advance:    { label: 'Avance',      color: 'text-amber-400' },
};

// ─────────────────────────────────────────────────────────
// Driver form modal
// ─────────────────────────────────────────────────────────
interface DriverFormProps {
  driver: Driver | null;
  onSave: () => void;
  onClose: () => void;
}

function DriverForm({ driver, onSave, onClose }: DriverFormProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [form, setForm] = useState({
    name: driver?.name ?? '',
    phone: driver?.phone ?? '',
    photo_url: driver?.photo_url ?? '',
    commission_rate: driver?.commission_rate ?? 10,
    notes: driver?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (driver) {
      const { error } = await supabase.from('drivers').update({ ...form, updated_at: new Date().toISOString() }).eq('id', driver.id).eq('site_id', siteId);
      if (error) { toast('error', 'Erreur'); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('drivers').insert({ ...form, status: 'offline', site_id: siteId });
      if (error) { toast('error', 'Erreur'); setSaving(false); return; }
    }
    toast('success', driver ? 'Livreur modifié' : 'Livreur ajouté');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-3xl p-4 sm:p-6 w-full sm:max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-white font-bold text-lg mb-5">{driver ? 'Modifier le livreur' : 'Nouveau livreur'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo preview */}
          {form.photo_url && (
            <div className="flex justify-center">
              <img src={form.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-white/10" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-white/50 text-xs font-medium block mb-1.5">Nom complet</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                placeholder="Ex: Moussa Diallo"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Téléphone</label>
              <input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+221 77 000 00 00"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Commission (%)</label>
              <input
                type="number"
                value={form.commission_rate || ''}
                onChange={e => setForm(f => ({ ...f, commission_rate: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.select()}
                placeholder="0"
                min={0}
                max={100}
                step={0.5}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-white/50 text-xs font-medium block mb-1.5">URL Photo</label>
              <input
                value={form.photo_url}
                onChange={e => setForm(f => ({ ...f, photo_url: e.target.value }))}
                placeholder="https://..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-white/50 text-xs font-medium block mb-1.5">Notes</label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
              {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
              Enregistrer
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">
              <X size={15} />
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// New delivery form modal
// ─────────────────────────────────────────────────────────
interface NewDeliveryModalProps {
  drivers: Driver[];
  onSave: () => void;
  onClose: () => void;
}

function NewDeliveryModal({ drivers, onSave, onClose }: NewDeliveryModalProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { settings } = useSettings();
  const sym = settings.currency_symbol;

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    delivery_address: '',
    delivery_fee: 0,
    notes: '',
    driver_id: '',
  });
  const [saving, setSaving] = useState(false);
  const availableDrivers = drivers.filter(d => d.status === 'available' && d.is_active);

  const selectedDriver = drivers.find(d => d.id === form.driver_id);
  const commission = selectedDriver
    ? Math.round(form.delivery_fee * selectedDriver.commission_rate / 100)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: delivData, error } = await supabase.from('deliveries').insert({
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      delivery_address: form.delivery_address,
      delivery_fee: form.delivery_fee,
      commission_amount: commission,
      notes: form.notes,
      driver_id: form.driver_id || null,
      status: form.driver_id ? 'assigned' : 'pending',
      assigned_at: form.driver_id ? new Date().toISOString() : null,
      site_id: siteId,
    }).select().single();

    if (error || !delivData) { toast('error', 'Erreur de création'); setSaving(false); return; }

    if (form.driver_id) {
      await supabase.from('drivers').update({ status: 'busy' }).eq('id', form.driver_id).eq('site_id', siteId);
      // Auto-create commission record
      await supabase.from('driver_payments').insert({
        driver_id: form.driver_id,
        delivery_id: delivData.id,
        payment_type: 'commission',
        amount: commission,
        status: 'pending',
        notes: `Commission livraison #${delivData.delivery_number}`,
        site_id: siteId,
      });
    }

    toast('success', 'Livraison créée');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-3xl p-4 sm:p-6 w-full sm:max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-white font-bold text-lg mb-5">Nouvelle livraison</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Client</label>
              <input
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                required
                placeholder="Nom du client"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Téléphone</label>
              <input
                value={form.customer_phone}
                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                placeholder="+221..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Adresse de livraison</label>
            <input
              value={form.delivery_address}
              onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))}
              required
              placeholder="Ex: Rue 15, Médina, Dakar"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Frais de livraison ({sym})</label>
              <input
                type="number"
                value={form.delivery_fee || ''}
                onChange={e => setForm(f => ({ ...f, delivery_fee: parseFloat(e.target.value) || 0 }))}
                onFocus={e => e.target.select()}
                placeholder="0"
                min={0}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs font-medium block mb-1.5">Livreur</label>
              <select
                value={form.driver_id}
                onChange={e => setForm(f => ({ ...f, driver_id: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
              >
                <option value="" className="bg-gray-900">Non assignée</option>
                {availableDrivers.map(d => (
                  <option key={d.id} value={d.id} className="bg-gray-900">{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {form.driver_id && commission > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-emerald-400 text-sm">Commission livreur</span>
              <span className="text-emerald-400 font-bold">{commission.toLocaleString('fr-FR')} {sym}</span>
            </div>
          )}

          <input
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes de livraison..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
          />

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
              {saving ? <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" /> : <Truck size={14} />}
              Créer la livraison
            </button>
            <button type="button" onClick={onClose} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Assign driver modal
// ─────────────────────────────────────────────────────────
interface AssignDriverModalProps {
  delivery: Delivery;
  drivers: Driver[];
  onSave: () => void;
  onClose: () => void;
}

function AssignDriverModal({ delivery, drivers, onSave, onClose }: AssignDriverModalProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const [driverId, setDriverId] = useState('');
  const [saving, setSaving] = useState(false);
  const availableDrivers = drivers.filter(d => d.status === 'available' && d.is_active);

  const selectedDriver = drivers.find(d => d.id === driverId);
  const commission = selectedDriver
    ? Math.round(delivery.delivery_fee * selectedDriver.commission_rate / 100)
    : 0;

  async function handleAssign() {
    if (!driverId) return;
    setSaving(true);

    await supabase.from('deliveries').update({
      driver_id: driverId,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      commission_amount: commission,
    }).eq('id', delivery.id).eq('site_id', siteId);

    await supabase.from('drivers').update({ status: 'busy' }).eq('id', driverId).eq('site_id', siteId);

    await supabase.from('driver_payments').insert({
      driver_id: driverId,
      delivery_id: delivery.id,
      payment_type: 'commission',
      amount: commission,
      status: 'pending',
      notes: `Commission livraison #${delivery.delivery_number}`,
      site_id: siteId,
    });

    toast('success', 'Livreur assigné');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-4">Assigner un livreur</h2>
        <p className="text-white/40 text-sm mb-4">Livraison #{delivery.delivery_number} — {delivery.customer_name}</p>

        {availableDrivers.length === 0 ? (
          <div className="py-8 text-center">
            <AlertCircle size={24} className="text-white/20 mx-auto mb-2" />
            <p className="text-white/40 text-sm">Aucun livreur disponible</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {availableDrivers.map(d => (
              <button
                key={d.id}
                onClick={() => setDriverId(d.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all
                  ${driverId === d.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/3 border-white/8 hover:bg-white/5'}`}
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                  {d.photo_url ? (
                    <img src={d.photo_url} alt={d.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40 text-xs font-bold">
                      {d.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${driverId === d.id ? 'text-blue-300' : 'text-white'}`}>{d.name}</p>
                  <p className="text-white/40 text-xs">{d.phone}</p>
                </div>
                <span className="text-emerald-400 text-xs">{d.commission_rate}%</span>
              </button>
            ))}
          </div>
        )}

        {driverId && commission > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2 mb-4 flex justify-between">
            <span className="text-emerald-400 text-sm">Commission</span>
            <span className="text-emerald-400 font-bold">{commission.toLocaleString('fr-FR')} FCFA</span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={handleAssign} disabled={!driverId || saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-all">
            Assigner
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm">Annuler</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Payment modal
// ─────────────────────────────────────────────────────────
interface PaymentModalProps {
  driver: Driver;
  onSave: () => void;
  onClose: () => void;
}

function ManualPaymentModal({ driver, onSave, onClose }: PaymentModalProps) {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { settings } = useSettings();
  const [form, setForm] = useState({ payment_type: 'bonus' as DriverPaymentType, amount: 0, notes: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.amount <= 0) return;
    setSaving(true);

    await supabase.from('driver_payments').insert({
      driver_id: driver.id,
      payment_type: form.payment_type,
      amount: form.amount,
      status: 'pending',
      notes: form.notes,
      site_id: siteId,
    });

    toast('success', 'Paiement enregistré');
    onSave();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
      >
        <h2 className="text-white font-bold text-lg mb-1">Paiement manuel</h2>
        <p className="text-white/40 text-sm mb-4">{driver.name}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['bonus', 'deduction', 'advance'] as DriverPaymentType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, payment_type: t }))}
                  className={`py-2 rounded-xl border text-xs transition-all ${form.payment_type === t ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/40'}`}
                >
                  {paymentTypeConfig[t].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Montant ({settings.currency_symbol})</label>
            <input
              type="number"
              value={form.amount || ''}
              onChange={e => setForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              onFocus={e => e.target.select()}
              placeholder="0"
              min={0}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs font-medium block mb-1.5">Notes</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Raison..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || form.amount <= 0} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium">Enregistrer</button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/5 text-white/60 text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Driver card
// ─────────────────────────────────────────────────────────
interface DriverCardProps {
  driver: Driver;
  pendingAmount: number;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: DriverStatus) => void;
  onPayment: () => void;
  onMarkPaid: () => void;
  sym: string;
}

function DriverCard({ driver, pendingAmount, onEdit, onDelete, onStatusChange, onPayment, onMarkPaid, sym }: DriverCardProps) {
  const cfg = driverStatusConfig[driver.status];
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/60 border border-white/8 rounded-2xl p-4 hover:border-white/14 transition-all relative"
    >
      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white/10 flex-shrink-0 border border-white/10">
          {driver.photo_url ? (
            <img src={driver.photo_url} alt={driver.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50 text-lg font-bold">
              {driver.name.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{driver.name}</p>
          {driver.phone && (
            <div className="flex items-center gap-1 text-white/40 text-xs mt-0.5">
              <Phone size={10} /> {driver.phone}
            </div>
          )}
          <span className={`inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-lg ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
            {cfg.label}
          </span>
        </div>
        <button onClick={() => setMenuOpen(m => !m)} className="text-white/30 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/5">
          <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/3 rounded-xl p-2 text-center">
          <p className="text-white font-bold text-sm">{driver.total_deliveries}</p>
          <p className="text-white/30 text-[9px]">Livraisons</p>
        </div>
        <div className="bg-white/3 rounded-xl p-2 text-center">
          <p className="text-blue-400 font-bold text-sm">{driver.commission_rate}%</p>
          <p className="text-white/30 text-[9px]">Commission</p>
        </div>
        <div className="bg-white/3 rounded-xl p-2 text-center">
          <p className="text-emerald-400 font-bold text-xs">{(driver.total_earnings).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
          <p className="text-white/30 text-[9px]">{sym} total</p>
        </div>
      </div>

      {/* Pending payment badge */}
      {pendingAmount > 0 && (
        <button
          onClick={onMarkPaid}
          className="w-full flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-2 hover:bg-amber-500/15 transition-all"
        >
          <span className="text-amber-400 text-xs font-medium">En attente</span>
          <span className="text-amber-400 font-bold text-xs">{pendingAmount.toLocaleString('fr-FR')} {sym}</span>
        </button>
      )}

      {/* Actions */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 border-t border-white/8 pt-3">
              {/* Status switcher */}
              <div className="flex gap-1">
                {(['available', 'busy', 'offline'] as DriverStatus[]).map(s => {
                  const sc = driverStatusConfig[s];
                  return (
                    <button
                      key={s}
                      onClick={() => onStatusChange(s)}
                      className={`flex-1 py-1.5 rounded-xl border text-[10px] font-medium transition-all
                        ${driver.status === s ? `${sc.bg} ${sc.border} ${sc.color}` : 'bg-white/3 border-white/8 text-white/30 hover:text-white/60'}`}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                <button onClick={onPayment} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs hover:bg-emerald-500/15 transition-all">
                  <Wallet size={11} /> Paiement
                </button>
                <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/8 transition-all">
                  <Edit3 size={11} /> Modifier
                </button>
                <button onClick={onDelete} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-all">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Delivery row
// ─────────────────────────────────────────────────────────
interface DeliveryRowProps {
  delivery: DeliveryWithDriver;
  drivers: Driver[];
  onAssign: () => void;
  onStatusChange: (id: string, status: DeliveryStatus) => void;
  onPrint: (delivery: DeliveryWithDriver) => void;
  printing: boolean;
  sym: string;
}

function DeliveryRow({ delivery, drivers, onAssign, onStatusChange, onPrint, printing, sym }: DeliveryRowProps) {
  const cfg = deliveryStatusConfig[delivery.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
        <Bike size={14} className={cfg.color} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">#{delivery.delivery_number}</span>
          <span className="text-white/60 text-sm truncate">{delivery.customer_name}</span>
        </div>
        <div className="flex items-center gap-1 text-white/30 text-xs mt-0.5">
          <MapPin size={9} /> <span className="truncate">{delivery.delivery_address}</span>
        </div>
      </div>

      <div className="hidden md:block flex-shrink-0">
        {delivery.driver ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10">
              {delivery.driver.photo_url
                ? <img src={delivery.driver.photo_url} alt="" className="w-full h-full object-cover" />
                : <span className="text-white/50 text-[9px] flex items-center justify-center h-full">{delivery.driver.name.charAt(0)}</span>
              }
            </div>
            <span className="text-white/60 text-xs">{delivery.driver.name}</span>
          </div>
        ) : (
          <button onClick={onAssign} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors">
            <User size={11} /> Assigner
          </button>
        )}
      </div>

      <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>

      <div className="text-right flex-shrink-0 w-20">
        <p className="text-white text-sm font-semibold">{delivery.delivery_fee.toLocaleString('fr-FR')} {sym}</p>
        {delivery.commission_amount > 0 && (
          <p className="text-emerald-400 text-[10px]">{delivery.commission_amount.toLocaleString('fr-FR')} com.</p>
        )}
      </div>

      <button
        onClick={() => onPrint(delivery)}
        disabled={printing}
        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border bg-white/5 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all disabled:opacity-40"
        title="Imprimer le bon de livraison"
      >
        {printing ? <Loader2 size={11} className="animate-spin" /> : <Printer size={11} />}
        <span className="hidden sm:inline">Imprimer</span>
      </button>

      {cfg.next && delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
        <button
          onClick={() => onStatusChange(delivery.id, cfg.next!)}
          className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs border transition-all
            ${deliveryStatusConfig[cfg.next].bg} ${deliveryStatusConfig[cfg.next].border} ${deliveryStatusConfig[cfg.next].color}`}
        >
          <ArrowRight size={10} />
          <span className="hidden sm:inline">{deliveryStatusConfig[cfg.next].label}</span>
        </button>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────
type PageTab = 'active' | 'history' | 'drivers' | 'payments';

export function DeliveryPage() {
  const toast = useToast();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { settings } = useSettings();
  const { connected: printerConnected } = usePrinter();
  const sym = settings.currency_symbol;

  const [tab, setTab] = useState<PageTab>('active');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryWithDriver[]>([]);
  const [payments, setPayments] = useState<(DriverPayment & { driver: Pick<Driver, 'id' | 'name'> | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewDelivery, setShowNewDelivery] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [assigningDelivery, setAssigningDelivery] = useState<Delivery | null>(null);
  const [paymentDriver, setPaymentDriver] = useState<Driver | null>(null);
  const [search, setSearch] = useState('');
  const [printingDeliveryId, setPrintingDeliveryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const isHistory = tab === 'history';
    const activeStatuses = ['pending', 'assigned', 'picked_up'];
    const historyStatuses = ['delivered', 'cancelled'];

    const [dRes, delivRes, payRes] = await Promise.all([
      supabase.from('drivers').select('*').eq('site_id', siteId).eq('is_active', true).order('name'),
      tab === 'payments'
        ? Promise.resolve({ data: [] })
        : supabase
            .from('deliveries')
            .select('*, driver:drivers(id, name, phone, photo_url)')
            .eq('site_id', siteId)
            .in('status', isHistory ? historyStatuses : activeStatuses)
            .order('created_at', { ascending: false }),
      tab === 'payments'
        ? supabase
            .from('driver_payments')
            .select('*, driver:drivers(id, name)')
            .eq('site_id', siteId)
            .order('created_at', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
    ]);

    if (dRes.data) setDrivers(dRes.data as Driver[]);
    if (delivRes.data) setDeliveries(delivRes.data as DeliveryWithDriver[]);
    if (payRes.data) setPayments(payRes.data as (DriverPayment & { driver: Pick<Driver, 'id' | 'name'> | null })[]);
    setLoading(false);
  }, [tab, siteId]);

  useEffect(() => { load(); }, [load]);

  async function handleDriverStatusChange(id: string, status: DriverStatus) {
    await supabase.from('drivers').update({ status }).eq('id', id).eq('site_id', siteId);
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, status } : d));
  }

  async function handleDriverDelete(id: string) {
    await supabase.from('drivers').update({ is_active: false }).eq('id', id).eq('site_id', siteId);
    setDrivers(prev => prev.filter(d => d.id !== id));
    toast('success', 'Livreur désactivé');
  }

  async function handlePrintDelivery(delivery: DeliveryWithDriver) {
    if (printingDeliveryId) return;
    setPrintingDeliveryId(delivery.id);
    const data: EscposDeliveryData = {
      deliveryNumber: delivery.delivery_number,
      createdAt: delivery.created_at,
      customerName: delivery.customer_name,
      customerPhone: delivery.customer_phone,
      deliveryAddress: delivery.delivery_address,
      deliveryFee: delivery.delivery_fee,
      notes: delivery.notes,
      driverName: delivery.driver?.name ?? null,
      status: delivery.status,
    };
    if (printerConnected) {
      const ok = await printDeliveryTicket(data, settings);
      if (!ok) toast('error', 'Echec de l’impression');
    } else {
      printViaIframe(buildDeliveryTicketHtml(data, settings));
    }
    setPrintingDeliveryId(null);
  }

  async function handleDeliveryStatus(id: string, status: DeliveryStatus) {
    const now = new Date().toISOString();
    const extra: Record<string, string> = {};
    if (status === 'picked_up') extra.picked_up_at = now;
    if (status === 'delivered') extra.delivered_at = now;
    if (status === 'cancelled') extra.cancelled_at = now;

    await supabase.from('deliveries').update({ status, updated_at: now, ...extra }).eq('id', id).eq('site_id', siteId);

    if (status === 'delivered' || status === 'cancelled') {
      const d = deliveries.find(x => x.id === id);
      if (d?.driver_id) {
        await supabase.from('drivers').update({ status: 'available' }).eq('id', d.driver_id).eq('site_id', siteId);
        if (status === 'delivered') {
          // Increment total_deliveries on driver
          await supabase.rpc('increment_driver_stats', {
            p_driver_id: d.driver_id,
            p_earnings: d.commission_amount,
          }).then(() => null).catch(() => null);
        }
      }
    }

    setDeliveries(prev => prev.filter(x => x.id !== id));
    toast('success', status === 'delivered' ? 'Livraison confirmée' : 'Statut mis à jour');
  }

  async function handleMarkPendingPaid(driverId: string) {
    await supabase
      .from('driver_payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('driver_id', driverId)
      .eq('status', 'pending')
      .eq('site_id', siteId);

    const totalPaid = payments
      .filter(p => p.driver_id === driverId && p.status === 'pending')
      .reduce((s, p) => s + (p.payment_type === 'deduction' ? -p.amount : p.amount), 0);

    await supabase.from('drivers').update({
      total_earnings: drivers.find(d => d.id === driverId)!.total_earnings + totalPaid,
    }).eq('id', driverId).eq('site_id', siteId);

    toast('success', 'Paiements marqués comme payés');
    load();
  }

  // Pending amounts per driver
  const pendingByDriver = payments.reduce((acc, p) => {
    if (p.status === 'pending') {
      acc[p.driver_id] = (acc[p.driver_id] ?? 0) + (p.payment_type === 'deduction' ? -p.amount : p.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  // Load payments for sidebar data
  const loadPendingPayments = useCallback(async () => {
    const { data } = await supabase
      .from('driver_payments')
      .select('driver_id, payment_type, amount, status')
      .eq('site_id', siteId)
      .eq('status', 'pending');
    if (data) {
      const map: Record<string, number> = {};
      (data as Pick<DriverPayment, 'driver_id' | 'payment_type' | 'amount' | 'status'>[]).forEach(p => {
        map[p.driver_id] = (map[p.driver_id] ?? 0) + (p.payment_type === 'deduction' ? -p.amount : p.amount);
      });
      return map;
    }
    return {};
  }, [siteId]);

  const [pendingMap, setPendingMap] = useState<Record<string, number>>({});
  useEffect(() => {
    loadPendingPayments().then(setPendingMap);
  }, [loadPendingPayments, drivers]);

  const filteredDeliveries = deliveries.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.customer_name.toLowerCase().includes(q) || d.delivery_address.toLowerCase().includes(q);
  });

  const stats = {
    active: deliveries.filter(d => ['assigned', 'picked_up'].includes(d.status)).length,
    pending: deliveries.filter(d => d.status === 'pending').length,
    available: drivers.filter(d => d.status === 'available').length,
    today: 0,
  };

  const tabDefs: { id: PageTab; label: string; icon: typeof Truck }[] = [
    { id: 'active', label: 'Actives', icon: Truck },
    { id: 'history', label: 'Historique', icon: CheckCircle2 },
    { id: 'drivers', label: 'Livreurs', icon: User },
    { id: 'payments', label: 'Paiements', icon: Wallet },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 lg:px-6 pt-4 pb-3">
        {/* Stats row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {[
            { label: 'En course', value: stats.active, color: 'text-amber-400' },
            { label: 'En attente', value: stats.pending, color: 'text-blue-400' },
            { label: 'Livreurs disponibles', value: stats.available, color: 'text-emerald-400' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-xl px-3 py-1.5">
              <span className={`font-bold text-sm ${s.color}`}>{s.value}</span>
              <span className="text-white/40 text-xs">{s.label}</span>
            </div>
          ))}
          <div className="flex-1" />
          <button onClick={load} className="p-2 rounded-xl bg-white/5 border border-white/8 text-white/40 hover:text-white/70 transition-all">
            <RefreshCw size={14} />
          </button>
          {tab !== 'drivers' && tab !== 'payments' && (
            <button
              onClick={() => setShowNewDelivery(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
            >
              <Plus size={14} /> Nouvelle livraison
            </button>
          )}
          {tab === 'drivers' && (
            <button
              onClick={() => { setEditingDriver(null); setShowDriverForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-600/25 transition-all"
            >
              <Plus size={14} /> Nouveau livreur
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-2xl border border-white/8 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {tabDefs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0
                  ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                <Icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-4 scrollbar-thin">
        {/* Active / History deliveries */}
        {(tab === 'active' || tab === 'history') && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher client ou adresse..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/40"
                />
              </div>
            </div>
            <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 bg-white/3">
                <div className="w-8 flex-shrink-0" />
                <div className="flex-1 text-white/30 text-xs font-medium">Client / Adresse</div>
                <div className="hidden md:block text-white/30 text-xs font-medium w-28">Livreur</div>
                <div className="text-white/30 text-xs font-medium">Statut</div>
                <div className="w-20 text-white/30 text-xs font-medium text-right">Montant</div>
                <div className="w-20 flex-shrink-0" />
              </div>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <div className="w-8 h-8 rounded-xl bg-white/5 animate-pulse" />
                    <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
                  </div>
                ))
              ) : filteredDeliveries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14">
                  <Truck size={28} className="text-white/15 mb-2" />
                  <p className="text-white/30 text-sm">{tab === 'active' ? 'Aucune livraison active' : 'Aucun historique'}</p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredDeliveries.map(d => (
                    <DeliveryRow
                      key={d.id}
                      delivery={d}
                      drivers={drivers}
                      sym={sym}
                      printing={printingDeliveryId === d.id}
                      onAssign={() => setAssigningDelivery(d)}
                      onPrint={handlePrintDelivery}
                      onStatusChange={handleDeliveryStatus}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </>
        )}

        {/* Drivers */}
        {tab === 'drivers' && (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-52 bg-white/3 border border-white/8 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <User size={32} className="text-white/10 mb-3" />
              <p className="text-white/30 font-medium">Aucun livreur</p>
              <button
                onClick={() => { setEditingDriver(null); setShowDriverForm(true); }}
                className="mt-3 flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm"
              >
                <Plus size={13} /> Ajouter un livreur
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2">
              <AnimatePresence mode="popLayout">
                {drivers.map(d => (
                  <DriverCard
                    key={d.id}
                    driver={d}
                    sym={sym}
                    pendingAmount={pendingMap[d.id] ?? 0}
                    onEdit={() => { setEditingDriver(d); setShowDriverForm(true); }}
                    onDelete={() => handleDriverDelete(d.id)}
                    onStatusChange={s => handleDriverStatusChange(d.id, s)}
                    onPayment={() => setPaymentDriver(d)}
                    onMarkPaid={() => handleMarkPendingPaid(d.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )
        )}

        {/* Payments */}
        {tab === 'payments' && (
          <div className="mt-2">
            {/* Summary by driver */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {drivers.map(d => {
                const pending = pendingMap[d.id] ?? 0;
                return (
                  <div key={d.id} className="bg-gray-900/60 border border-white/8 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                        {d.photo_url ? <img src={d.photo_url} alt={d.name} className="w-full h-full object-cover" /> : <span className="text-white/50 text-sm font-bold flex items-center justify-center h-full">{d.name.charAt(0)}</span>}
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{d.name}</p>
                        <p className="text-white/30 text-xs">{d.total_deliveries} livraisons</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/40">Total gagné</span>
                      <span className="text-white font-bold">{d.total_earnings.toLocaleString('fr-FR')} {sym}</span>
                    </div>
                    {pending > 0 && (
                      <div className="flex justify-between text-sm mb-3">
                        <span className="text-amber-400">En attente</span>
                        <span className="text-amber-400 font-bold">{pending.toLocaleString('fr-FR')} {sym}</span>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      {pending > 0 && (
                        <button onClick={() => handleMarkPendingPaid(d.id)} className="flex-1 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-all">
                          Payer tout
                        </button>
                      )}
                      <button onClick={() => setPaymentDriver(d)} className="flex-1 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/50 text-xs hover:bg-white/8 transition-all">
                        + Paiement
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment history */}
            <div className="bg-white/2 border border-white/8 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-white/3">
                <h3 className="text-white/60 text-xs font-medium">Historique des paiements</h3>
              </div>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                    <div className="flex-1 h-8 bg-white/5 rounded animate-pulse" />
                  </div>
                ))
              ) : payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <DollarSign size={24} className="text-white/15 mb-2" />
                  <p className="text-white/30 text-sm">Aucun paiement enregistré</p>
                </div>
              ) : (
                payments.map(p => {
                  const ptCfg = paymentTypeConfig[p.payment_type];
                  const isDeduction = p.payment_type === 'deduction';
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{p.driver?.name ?? '—'}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-lg ${ptCfg.color} bg-white/5`}>{ptCfg.label}</span>
                        </div>
                        {p.notes && <p className="text-white/30 text-xs mt-0.5 truncate">{p.notes}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${p.status === 'paid' ? (isDeduction ? 'text-red-400' : 'text-emerald-400') : 'text-amber-400'}`}>
                          {isDeduction ? '-' : '+'}{p.amount.toLocaleString('fr-FR')} {sym}
                        </p>
                        <p className="text-white/30 text-[10px]">
                          {p.status === 'paid' ? 'Payé' : 'En attente'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white/30 text-xs">
                          {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNewDelivery && (
          <NewDeliveryModal
            drivers={drivers}
            onSave={() => { setShowNewDelivery(false); load(); }}
            onClose={() => setShowNewDelivery(false)}
          />
        )}
        {showDriverForm && (
          <DriverForm
            driver={editingDriver}
            onSave={() => { setShowDriverForm(false); load(); }}
            onClose={() => setShowDriverForm(false)}
          />
        )}
        {assigningDelivery && (
          <AssignDriverModal
            delivery={assigningDelivery}
            drivers={drivers}
            onSave={() => { setAssigningDelivery(null); load(); }}
            onClose={() => setAssigningDelivery(null)}
          />
        )}
        {paymentDriver && (
          <ManualPaymentModal
            driver={paymentDriver}
            onSave={() => { setPaymentDriver(null); load(); }}
            onClose={() => setPaymentDriver(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
