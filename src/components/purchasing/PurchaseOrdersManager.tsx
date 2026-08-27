import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save, Loader2, Package, Trash2, ClipboardCheck, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, SupplierInvoice, Ingredient, Product } from '../../types/database';

interface Props {
  orders: PurchaseOrder[];
  orderItems: PurchaseOrderItem[];
  suppliers: Supplier[];
  invoices: SupplierInvoice[];
  ingredients: Ingredient[];
  products: Product[];
  siteId: string | null;
  onRefresh: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'text-white/40 bg-white/[0.05] border-white/[0.08]' },
  ordered: { label: 'Commande', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  partial: { label: 'Recu partiel', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  received: { label: 'Recu', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cancelled: { label: 'Annule', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export function PurchaseOrdersManager({ orders, orderItems, suppliers, invoices, ingredients, products, siteId, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [showReception, setShowReception] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New order form state
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [items, setItems] = useState<{ description: string; ingredient_id: string; product_id: string; quantity: number; unit: string; unit_price: number }[]>([]);

  // Invoice form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

  function addItem() {
    setItems([...items, { description: '', ingredient_id: '', product_id: '', quantity: 1, unit: 'pcs', unit_price: 0 }]);
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    if (field === 'ingredient_id' && value) {
      const ing = ingredients.find(i => i.id === value);
      if (ing) {
        updated[index].description = ing.name;
        updated[index].unit = ing.unit;
        updated[index].unit_price = Number(ing.cost_per_unit);
      }
    }
    if (field === 'product_id' && value) {
      const prod = products.find(p => p.id === value);
      if (prod) {
        updated[index].description = prod.name;
        updated[index].unit = prod.unit || 'pcs';
        updated[index].unit_price = Number(prod.cost_price);
      }
    }
    setItems(updated);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function handleCreateOrder() {
    if (!siteId || !supplierId || items.length === 0) return;
    setSaving(true);

    const totalAmount = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

    const { data: orderData, error } = await supabase.from('purchase_orders').insert({
      site_id: siteId,
      supplier_id: supplierId,
      status: 'draft',
      expected_date: expectedDate || null,
      total_amount: totalAmount,
      notes: orderNotes.trim() || null,
    }).select('id').single();

    if (!error && orderData) {
      const orderItemsPayload = items.map(it => ({
        site_id: siteId,
        purchase_order_id: orderData.id,
        ingredient_id: it.ingredient_id || null,
        product_id: it.product_id || null,
        description: it.description,
        quantity_ordered: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price: it.quantity * it.unit_price,
      }));
      await supabase.from('purchase_order_items').insert(orderItemsPayload);
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    onRefresh();
  }

  function resetForm() {
    setSupplierId('');
    setExpectedDate('');
    setOrderNotes('');
    setItems([]);
  }

  async function updateOrderStatus(orderId: string, newStatus: string) {
    const update: any = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'received') update.received_date = new Date().toISOString().split('T')[0];
    await supabase.from('purchase_orders').update(update).eq('id', orderId);
    onRefresh();
  }

  async function handleReception(orderId: string, receptionItems: { id: string; qty: number }[]) {
    for (const ri of receptionItems) {
      const item = orderItems.find(oi => oi.id === ri.id);
      if (!item) continue;
      const newReceived = Number(item.quantity_received) + ri.qty;
      await supabase.from('purchase_order_items').update({ quantity_received: newReceived }).eq('id', ri.id);

      // Update stock
      if (item.ingredient_id) {
        const ing = ingredients.find(i => i.id === item.ingredient_id);
        if (ing) {
          await supabase.from('ingredients').update({ stock_quantity: Number(ing.stock) + ri.qty }).eq('id', ing.id);
        }
      }
      if (item.product_id) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod && prod.track_stock) {
          await supabase.from('products').update({ stock: (prod.stock || 0) + ri.qty }).eq('id', prod.id);
        }
      }
    }

    // Determine new status
    const allItems = orderItems.filter(oi => oi.purchase_order_id === orderId);
    const allFullyReceived = allItems.every(oi => {
      const ri = receptionItems.find(r => r.id === oi.id);
      const newQty = Number(oi.quantity_received) + (ri?.qty || 0);
      return newQty >= Number(oi.quantity_ordered);
    });

    await updateOrderStatus(orderId, allFullyReceived ? 'received' : 'partial');
    setShowReception(null);
    onRefresh();
  }

  async function handleCreateInvoice(orderId: string) {
    if (!siteId) return;
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    setSaving(true);

    await supabase.from('supplier_invoices').insert({
      site_id: siteId,
      invoice_number: invoiceNumber.trim() || null,
      supplier_id: order.supplier_id,
      purchase_order_id: orderId,
      total_amount: order.total_amount,
      due_date: invoiceDueDate || null,
    });

    setSaving(false);
    setShowInvoiceForm(null);
    setInvoiceNumber('');
    setInvoiceDueDate('');
    onRefresh();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {[{ id: 'all', label: 'Tous' }, ...Object.entries(STATUS_CONFIG).map(([id, c]) => ({ id, label: c.label }))].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                statusFilter === f.id ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
          <Plus size={13} /> Bon de commande
        </button>
      </div>

      {/* Orders list */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-blue-400" />
          </div>
          <p className="text-white/70 text-sm font-medium">Aucun bon de commande</p>
          <p className="text-white/40 text-xs mt-1.5 max-w-xs mx-auto">
            {suppliers.length === 0
              ? 'Ajoutez d\'abord un fournisseur dans l\'onglet "Fournisseurs" pour pouvoir creer des bons de commande.'
              : 'Creez votre premier bon de commande pour suivre vos achats aupres de vos fournisseurs.'}
          </p>
          {suppliers.length > 0 && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-lg shadow-blue-600/25 transition-colors"
            >
              <Plus size={13} /> Creer un bon de commande
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map(order => {
            const supplier = suppliers.find(s => s.id === order.supplier_id);
            const items = orderItems.filter(oi => oi.purchase_order_id === order.id);
            const expanded = expandedOrder === order.id;
            const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;

            return (
              <div key={order.id} className="bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-hidden">
                <div
                  className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedOrder(expanded ? null : order.id)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-white font-semibold text-sm">BC-{String(order.order_number).padStart(4, '0')}</span>
                      <p className="text-white/35 text-[10px]">{supplier?.name || 'Fournisseur inconnu'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 text-xs hidden sm:block">{new Date(order.order_date).toLocaleDateString('fr-FR')}</span>
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-medium ${sc.color}`}>{sc.label}</span>
                    <span className="text-white font-medium text-sm">{Number(order.total_amount).toLocaleString('fr-FR')} F</span>
                    {expanded ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
                  </div>
                </div>

                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/[0.04] pt-3">
                        {/* Items */}
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-white/30 text-[10px] uppercase">
                              <th className="text-left pb-1.5">Article</th>
                              <th className="text-right pb-1.5">Qte cmd</th>
                              <th className="text-right pb-1.5">Qte recue</th>
                              <th className="text-right pb-1.5">P.U.</th>
                              <th className="text-right pb-1.5">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(item => (
                              <tr key={item.id} className="border-t border-white/[0.03]">
                                <td className="py-1.5 text-white/70">{item.description}</td>
                                <td className="py-1.5 text-right text-white/50">{Number(item.quantity_ordered)} {item.unit}</td>
                                <td className="py-1.5 text-right text-white/50">{Number(item.quantity_received)} {item.unit}</td>
                                <td className="py-1.5 text-right text-white/50">{Number(item.unit_price).toLocaleString('fr-FR')}</td>
                                <td className="py-1.5 text-right text-white/70 font-medium">{Number(item.total_price).toLocaleString('fr-FR')} F</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Actions */}
                        <div className="flex gap-2 flex-wrap pt-2 border-t border-white/[0.04]">
                          {order.status === 'draft' && (
                            <button onClick={() => updateOrderStatus(order.id, 'ordered')} className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-medium hover:bg-blue-600/30 transition-colors">
                              Valider la commande
                            </button>
                          )}
                          {(order.status === 'ordered' || order.status === 'partial') && (
                            <button onClick={() => setShowReception(order.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium hover:bg-emerald-600/30 transition-colors">
                              <ClipboardCheck size={11} /> Reception
                            </button>
                          )}
                          {(order.status === 'received' || order.status === 'partial') && (
                            <button onClick={() => setShowInvoiceForm(order.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/20 border border-amber-500/30 text-amber-400 text-[10px] font-medium hover:bg-amber-600/30 transition-colors">
                              <FileText size={11} /> Facture
                            </button>
                          )}
                          {order.status === 'draft' && (
                            <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-600/20 transition-colors">
                              Annuler
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* New Order Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm">Nouveau bon de commande</h3>
                <button onClick={() => setShowForm(false)} className="text-white/30 hover:text-white/60"><X size={16} /></button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Fournisseur *</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40">
                    <option value="">Selectionner...</option>
                    {suppliers.filter(s => s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Date de livraison prevue</label>
                  <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white/40 text-[10px] font-medium">Articles</label>
                    <button onClick={addItem} className="text-blue-400 text-[10px] hover:text-blue-300 transition-colors">+ Ajouter</button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="bg-white/[0.02] rounded-lg border border-white/[0.05] p-2.5 space-y-2">
                        <div className="flex gap-2">
                          <select value={item.ingredient_id} onChange={e => updateItem(idx, 'ingredient_id', e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none">
                            <option value="">Ingredient...</option>
                            {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                          </select>
                          <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none">
                            <option value="">Produit...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <button onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 size={11} /></button>
                        </div>
                        <div className="flex gap-2">
                          <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none" />
                          <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} className="w-16 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] text-right focus:outline-none" />
                          <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-14 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none" />
                          <input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="P.U." className="w-20 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] text-right focus:outline-none" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {items.length > 0 && (
                    <div className="text-right mt-2">
                      <span className="text-white/50 text-xs">Total: </span>
                      <span className="text-white font-bold text-sm">{items.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString('fr-FR')} F</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Notes</label>
                  <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 resize-none" />
                </div>
              </div>

              <button onClick={handleCreateOrder} disabled={saving || !supplierId || items.length === 0} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Creer le bon de commande
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reception Modal */}
      <AnimatePresence>
        {showReception && (
          <ReceptionModal
            orderId={showReception}
            items={orderItems.filter(oi => oi.purchase_order_id === showReception)}
            onConfirm={(receptionItems) => handleReception(showReception, receptionItems)}
            onClose={() => setShowReception(null)}
          />
        )}
      </AnimatePresence>

      {/* Invoice Modal */}
      <AnimatePresence>
        {showInvoiceForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowInvoiceForm(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold text-sm">Enregistrer une facture</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Numero de facture</label>
                  <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40" placeholder="FAC-001" />
                </div>
                <div>
                  <label className="text-white/40 text-[10px] font-medium block mb-1">Date d'echeance</label>
                  <input type="date" value={invoiceDueDate} onChange={e => setInvoiceDueDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40" />
                </div>
              </div>
              <button onClick={() => handleCreateInvoice(showInvoiceForm)} disabled={saving} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Enregistrer la facture
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReceptionModal({ orderId, items, onConfirm, onClose }: {
  orderId: string;
  items: PurchaseOrderItem[];
  onConfirm: (items: { id: string; qty: number }[]) => void;
  onClose: () => void;
}) {
  const [receptionQtys, setReceptionQtys] = useState<Record<string, number>>(
    Object.fromEntries(items.map(i => [i.id, Number(i.quantity_ordered) - Number(i.quantity_received)]))
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-white font-bold text-sm">Reception des marchandises</h3>
        <div className="space-y-2">
          {items.map(item => {
            const remaining = Number(item.quantity_ordered) - Number(item.quantity_received);
            if (remaining <= 0) return null;
            return (
              <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                <div>
                  <p className="text-white text-xs font-medium">{item.description}</p>
                  <p className="text-white/30 text-[10px]">Reste: {remaining} {item.unit}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  value={receptionQtys[item.id] || 0}
                  onChange={e => setReceptionQtys({ ...receptionQtys, [item.id]: Math.min(remaining, parseFloat(e.target.value) || 0) })}
                  className="w-20 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white text-xs text-right focus:outline-none focus:border-emerald-500/40"
                />
              </div>
            );
          })}
        </div>
        <button
          onClick={() => onConfirm(Object.entries(receptionQtys).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })))}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <ClipboardCheck size={14} /> Confirmer la reception
        </button>
      </motion.div>
    </motion.div>
  );
}
