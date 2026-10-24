import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Save, Loader2, Package, Trash2, ClipboardCheck, FileText, ChevronDown, ChevronUp, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { PurchaseOrder, PurchaseOrderItem, Supplier, SupplierInvoice, Ingredient, Product, ProductComponent } from '../../types/database';

interface Props {
  orders: PurchaseOrder[];
  orderItems: PurchaseOrderItem[];
  suppliers: Supplier[];
  invoices: SupplierInvoice[];
  ingredients: Ingredient[];
  products: Product[];
  components: ProductComponent[];
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

export function PurchaseOrdersManager({ orders, orderItems, suppliers, invoices, ingredients, products, components, siteId, onRefresh }: Props) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowState, setWorkflowState] = useState<{ mode: 'new' } | { mode: 'edit'; orderId: string } | null>(null);

  const filteredOrders = statusFilter === 'all' ? orders : orders.filter(o => o.status === statusFilter);

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
        <button onClick={() => setWorkflowState({ mode: 'new' })} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors">
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
              onClick={() => setWorkflowState({ mode: 'new' })}
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
            const oi = orderItems.filter(oi => oi.purchase_order_id === order.id);
            const expanded = expandedOrder === order.id;
            const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.draft;
            const hasInvoice = invoices.some(inv => inv.purchase_order_id === order.id);

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
                            {oi.map(item => (
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

                        <div className="flex gap-2 flex-wrap pt-2 border-t border-white/[0.04]">
                          {order.status !== 'received' && order.status !== 'cancelled' && (
                            <button
                              onClick={() => setWorkflowState({ mode: 'edit', orderId: order.id })}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[10px] font-medium hover:bg-blue-600/30 transition-colors"
                            >
                              <ArrowRight size={11} /> {order.status === 'draft' ? 'Valider' : order.status === 'partial' ? 'Continuer' : 'Receptionner'}
                            </button>
                          )}
                          {hasInvoice && (
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium">
                              <FileText size={11} /> Facture enregistree
                            </span>
                          )}
                          {order.status === 'draft' && (
                            <button
                              onClick={async () => {
                                await supabase.from('purchase_orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id);
                                onRefresh();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-600/20 transition-colors"
                            >
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

      {/* Unified Workflow Modal */}
      <AnimatePresence>
        {workflowState && (
          <OrderWorkflowModal
            mode={workflowState.mode}
            orderId={workflowState.mode === 'edit' ? workflowState.orderId : null}
            siteId={siteId}
            suppliers={suppliers}
            ingredients={ingredients}
            products={products}
            components={components}
            existingOrders={orders}
            existingOrderItems={orderItems}
            onRefresh={onRefresh}
            onClose={() => setWorkflowState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// UNIFIED ORDER WORKFLOW MODAL
// Handles create → validate → receive → invoice in one window
// ─────────────────────────────────────────────────────────
interface WorkflowProps {
  mode: 'new' | 'edit';
  orderId: string | null;
  siteId: string | null;
  suppliers: Supplier[];
  ingredients: Ingredient[];
  products: Product[];
  components: ProductComponent[];
  existingOrders: PurchaseOrder[];
  existingOrderItems: PurchaseOrderItem[];
  onRefresh: () => void;
  onClose: () => void;
}

function OrderWorkflowModal({ mode, orderId, siteId, suppliers, ingredients, products, components, existingOrders, existingOrderItems, onRefresh, onClose }: WorkflowProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Current order being edited (fetched after creation or from props)
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(mode === 'edit' ? orderId : null);
  const [currentOrder, setCurrentOrder] = useState<PurchaseOrder | null>(null);
  const [currentItems, setCurrentItems] = useState<PurchaseOrderItem[]>([]);

  // New order form state
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [formItems, setFormItems] = useState<{ description: string; ingredient_id: string; product_id: string; component_id: string; quantity: number; unit: string; unit_price: number }[]>([]);

  // Reception state
  const [receptionQtys, setReceptionQtys] = useState<Record<string, number>>({});

  // Invoice state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');

  const fetchOrderData = useCallback(async (id: string) => {
    const [orderRes, itemsRes] = await Promise.all([
      supabase.from('purchase_orders').select('*').eq('id', id).single(),
      supabase.from('purchase_order_items').select('*').eq('purchase_order_id', id).order('created_at', { ascending: true }),
    ]);
    if (orderRes.data) setCurrentOrder(orderRes.data as PurchaseOrder);
    if (itemsRes.data) {
      setCurrentItems(itemsRes.data as PurchaseOrderItem[]);
      // Initialize reception quantities for remaining items
      const qtys: Record<string, number> = {};
      (itemsRes.data as PurchaseOrderItem[]).forEach(it => {
        const remaining = Number(it.quantity_ordered) - Number(it.quantity_received);
        if (remaining > 0) qtys[it.id] = remaining;
      });
      setReceptionQtys(qtys);
    }
  }, []);

  useEffect(() => {
    if (currentOrderId) {
      fetchOrderData(currentOrderId);
    }
  }, [currentOrderId, fetchOrderData]);

  // Also sync from props when parent refreshes
  useEffect(() => {
    if (currentOrderId) {
      const order = existingOrders.find(o => o.id === currentOrderId);
      if (order) setCurrentOrder(order);
      const items = existingOrderItems.filter(oi => oi.purchase_order_id === currentOrderId);
      if (items.length > 0) {
        setCurrentItems(items);
        const qtys: Record<string, number> = {};
        items.forEach(it => {
          const remaining = Number(it.quantity_ordered) - Number(it.quantity_received);
          if (remaining > 0 && receptionQtys[it.id] === undefined) qtys[it.id] = remaining;
        });
        if (Object.keys(qtys).length > 0) setReceptionQtys(prev => ({ ...qtys, ...prev }));
      }
    }
  }, [existingOrders, existingOrderItems, currentOrderId]);

  // ── Form helpers ──
  function addItem() {
    setFormItems([...formItems, { description: '', ingredient_id: '', product_id: '', component_id: '', quantity: 0, unit: 'pcs', unit_price: 0 }]);
  }

  function updateItem(index: number, field: string, value: string | number) {
    const updated = [...formItems];
    (updated[index] as any)[field] = value;
    if (field === 'product_id' && value) {
      const prod = products.find(p => p.id === value);
      if (prod) {
        updated[index].description = prod.name;
        updated[index].unit = prod.unit || 'pcs';
        updated[index].unit_price = Number(prod.cost_price);
      }
    }
    if (field === 'component_id' && value) {
      const comp = components.find(c => c.id === value);
      if (comp) {
        updated[index].description = comp.name;
        updated[index].unit = comp.unit;
        updated[index].unit_price = Number(comp.avg_cost);
      }
    }
    setFormItems(updated);
  }

  function removeItem(index: number) {
    setFormItems(formItems.filter((_, i) => i !== index));
  }

  const formTotal = formItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Create order (draft) ──
  async function handleCreateDraft() {
    if (!siteId || !supplierId || formItems.length === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const totalAmount = formTotal;
      const { data: orderData, error: createError } = await supabase.from('purchase_orders').insert({
        site_id: siteId,
        supplier_id: supplierId,
        status: 'draft',
        expected_date: expectedDate || null,
        total_amount: totalAmount,
        notes: orderNotes.trim() || null,
      }).select('id').single();

      if (createError || !orderData) { setError('Erreur lors de la creation'); setSaving(false); return; }

      const payload = formItems.map(it => ({
        site_id: siteId,
        purchase_order_id: orderData.id,
        ingredient_id: it.ingredient_id || null,
        product_id: it.product_id || null,
        component_id: it.component_id || null,
        description: it.description,
        quantity_ordered: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price: it.quantity * it.unit_price,
      }));
      const { error: itemsError } = await supabase.from('purchase_order_items').insert(payload);
      if (itemsError) { setError('Erreur lors de l\'ajout des articles'); setSaving(false); return; }

      setCurrentOrderId(orderData.id);
      onRefresh();
    } catch { setError('Une erreur est survenue'); }
    setSaving(false);
  }

  // ── Validate and receive in one action ──
  async function handleValidateAndReceive() {
    if (!siteId || !supplierId || formItems.length === 0 || saving) return;
    setSaving(true);
    setError('');
    try {
      const totalAmount = formTotal;
      const today = new Date().toISOString().split('T')[0];

      // Create as ordered directly
      const { data: orderData, error: createError } = await supabase.from('purchase_orders').insert({
        site_id: siteId,
        supplier_id: supplierId,
        status: 'received',
        expected_date: expectedDate || null,
        total_amount: totalAmount,
        notes: orderNotes.trim() || null,
        received_date: today,
      }).select('id').single();

      if (createError || !orderData) { setError('Erreur lors de la creation'); setSaving(false); return; }

      // Insert items with full reception
      const payload = formItems.map(it => ({
        site_id: siteId,
        purchase_order_id: orderData.id,
        ingredient_id: it.ingredient_id || null,
        product_id: it.product_id || null,
        component_id: it.component_id || null,
        description: it.description,
        quantity_ordered: it.quantity,
        quantity_received: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        total_price: it.quantity * it.unit_price,
      }));
      const { error: itemsError } = await supabase.from('purchase_order_items').insert(payload);
      if (itemsError) { setError('Erreur lors de l\'ajout des articles'); setSaving(false); return; }

      // Update stock for each item
      for (const it of formItems) {
        if (it.component_id) {
          const comp = components.find(c => c.id === it.component_id);
          if (comp) {
            const stockBefore = Number(comp.stock);
            const stockAfter = stockBefore + it.quantity;
            await supabase.from('product_components').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', comp.id);
            await supabase.from('component_stock_movements').insert({
              site_id: siteId,
              component_id: it.component_id,
              movement_type: 'in',
              quantity: it.quantity,
              stock_before: stockBefore,
              stock_after: stockAfter,
              reason: `Reception BC-${String(orderData.order_number ?? 0).padStart(4, '0')}`,
              reference_type: 'purchase_order',
              reference_id: orderData.id,
            });
          }
        }
        if (it.ingredient_id) {
          const ing = ingredients.find(i => i.id === it.ingredient_id);
          if (ing) await supabase.from('ingredients').update({ stock_quantity: Number(ing.stock) + it.quantity }).eq('id', ing.id);
        }
        if (it.product_id) {
          const prod = products.find(p => p.id === it.product_id);
          if (prod && prod.track_stock) await supabase.from('products').update({ stock: (prod.stock || 0) + it.quantity }).eq('id', prod.id);
        }
      }

      setCurrentOrderId(orderData.id);
      onRefresh();
    } catch { setError('Une erreur est survenue'); }
    setSaving(false);
  }

  // ── Validate (draft → ordered) ──
  async function handleValidate() {
    if (!currentOrderId || saving) return;
    setSaving(true);
    setError('');
    try {
      await supabase.from('purchase_orders').update({ status: 'ordered', updated_at: new Date().toISOString() }).eq('id', currentOrderId);
      await fetchOrderData(currentOrderId);
      onRefresh();
    } catch { setError('Erreur lors de la validation'); }
    setSaving(false);
  }

  // ── Receive goods (partial or full) ──
  async function handleReceive() {
    if (!currentOrderId || !siteId || saving) return;
    const itemsToReceive = Object.entries(receptionQtys).filter(([, qty]) => qty > 0);
    if (itemsToReceive.length === 0) return;
    setSaving(true);
    setError('');
    try {
      const order = currentOrder;
      const orderNum = order ? String(order.order_number).padStart(4, '0') : '0000';

      for (const [itemId, qty] of itemsToReceive) {
        const item = currentItems.find(oi => oi.id === itemId);
        if (!item) continue;
        const newReceived = Number(item.quantity_received) + qty;
        await supabase.from('purchase_order_items').update({ quantity_received: newReceived }).eq('id', itemId);

        if (item.ingredient_id) {
          const ing = ingredients.find(i => i.id === item.ingredient_id);
          if (ing) await supabase.from('ingredients').update({ stock_quantity: Number(ing.stock) + qty }).eq('id', ing.id);
        }
        if (item.product_id) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod && prod.track_stock) await supabase.from('products').update({ stock: (prod.stock || 0) + qty }).eq('id', prod.id);
        }
        if (item.component_id) {
          const comp = components.find(c => c.id === item.component_id);
          if (comp) {
            const stockBefore = Number(comp.stock);
            const stockAfter = stockBefore + qty;
            await supabase.from('product_components').update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq('id', comp.id);
            await supabase.from('component_stock_movements').insert({
              site_id: siteId,
              component_id: item.component_id,
              movement_type: 'in',
              quantity: qty,
              stock_before: stockBefore,
              stock_after: stockAfter,
              reason: `Reception BC-${orderNum}`,
              reference_type: 'purchase_order',
              reference_id: currentOrderId,
            });
          }
        }
      }

      // Determine new status
      const allFullyReceived = currentItems.every(oi => {
        const ri = receptionQtys[oi.id] || 0;
        return Number(oi.quantity_received) + ri >= Number(oi.quantity_ordered);
      });

      const update: any = { status: allFullyReceived ? 'received' : 'partial', updated_at: new Date().toISOString() };
      if (allFullyReceived) update.received_date = new Date().toISOString().split('T')[0];
      await supabase.from('purchase_orders').update(update).eq('id', currentOrderId);

      // Clear received quantities
      setReceptionQtys({});
      await fetchOrderData(currentOrderId);
      onRefresh();
    } catch { setError('Erreur lors de la reception'); }
    setSaving(false);
  }

  // ── Create invoice ──
  async function handleCreateInvoice() {
    if (!currentOrderId || !siteId || saving || !currentOrder) return;
    setSaving(true);
    setError('');
    try {
      await supabase.from('supplier_invoices').insert({
        site_id: siteId,
        invoice_number: invoiceNumber.trim() || null,
        supplier_id: currentOrder.supplier_id,
        purchase_order_id: currentOrderId,
        total_amount: currentOrder.total_amount,
        due_date: invoiceDueDate || null,
      });
      setInvoiceNumber('');
      setInvoiceDueDate('');
      onRefresh();
    } catch { setError('Erreur lors de la creation de la facture'); }
    setSaving(false);
  }

  const supplier = currentOrder ? suppliers.find(s => s.id === currentOrder.supplier_id) : null;
  const isCreating = !currentOrderId;
  const status = currentOrder?.status;
  const allReceived = currentItems.length > 0 && currentItems.every(oi => Number(oi.quantity_received) >= Number(oi.quantity_ordered));
  const hasInvoice = currentOrder ? existingOrders.length > 0 && false : false; // invoices tracked by parent

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-gray-900 rounded-2xl border border-white/10 w-full max-w-lg max-h-[88vh] overflow-y-auto p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-sm">
              {isCreating ? 'Nouveau bon de commande' : `BC-${String(currentOrder?.order_number ?? 0).padStart(4, '0')}`}
            </h3>
            {currentOrder && (
              <p className="text-white/30 text-[10px] mt-0.5">
                {supplier?.name || 'Fournisseur inconnu'} · {STATUS_CONFIG[currentOrder.status]?.label}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={16} /></button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-red-400 text-[10px]">
            {error}
          </div>
        )}

        {/* ── Step 1: Create form ── */}
        {isCreating && (
          <>
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/40 text-[10px] font-medium">Articles</label>
                  <button onClick={addItem} className="text-blue-400 text-[10px] hover:text-blue-300 transition-colors">+ Ajouter</button>
                </div>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="bg-white/[0.02] rounded-lg border border-white/[0.05] p-2.5 space-y-2">
                      <div className="flex gap-2">
                        <select value={item.product_id} onChange={e => updateItem(idx, 'product_id', e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none">
                          <option value="">Produit...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <select value={item.component_id} onChange={e => updateItem(idx, 'component_id', e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none">
                          <option value="">Composant...</option>
                          {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 p-1"><Trash2 size={11} /></button>
                      </div>
                      <div className="flex gap-2">
                        <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Description" className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none" />
                        <input type="number" value={item.quantity || ''} onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} placeholder="Qté" className="w-16 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] text-right focus:outline-none" />
                        <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="w-14 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] focus:outline-none" />
                        <input type="number" value={item.unit_price || ''} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} placeholder="P.U." className="w-20 bg-white/[0.04] border border-white/[0.06] rounded px-2 py-1.5 text-white text-[10px] text-right focus:outline-none" />
                      </div>
                    </div>
                  ))}
                </div>
                {formItems.length > 0 && (
                  <div className="text-right mt-2">
                    <span className="text-white/50 text-xs">Total: </span>
                    <span className="text-white font-bold text-sm">{formTotal.toLocaleString('fr-FR')} F</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-white/40 text-[10px] font-medium block mb-1">Notes</label>
                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/40 resize-none" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <button
                onClick={handleCreateDraft}
                disabled={saving || !supplierId || formItems.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer le brouillon
              </button>
              <button
                onClick={handleValidateAndReceive}
                disabled={saving || !supplierId || formItems.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Valider et réceptionner
              </button>
            </div>
          </>
        )}

        {/* ── Step 2+: Order detail with contextual actions ── */}
        {!isCreating && currentOrder && (
          <div className="space-y-4">
            {/* Order info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/40 text-[10px] font-medium block mb-1">Fournisseur</label>
                <p className="text-white text-sm">{supplier?.name || '—'}</p>
              </div>
              <div>
                <label className="text-white/40 text-[10px] font-medium block mb-1">Statut</label>
                <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-medium ${STATUS_CONFIG[currentOrder.status]?.color}`}>
                  {STATUS_CONFIG[currentOrder.status]?.label}
                </span>
              </div>
            </div>

            {/* Items table */}
            <div className="bg-white/[0.02] rounded-lg border border-white/[0.05] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/30 text-[10px] uppercase bg-white/[0.02]">
                    <th className="text-left px-2.5 py-2">Article</th>
                    <th className="text-right px-2.5 py-2">Cmd</th>
                    <th className="text-right px-2.5 py-2">Recu</th>
                    <th className="text-right px-2.5 py-2">P.U.</th>
                    <th className="text-right px-2.5 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map(item => {
                    const remaining = Number(item.quantity_ordered) - Number(item.quantity_received);
                    return (
                      <tr key={item.id} className="border-t border-white/[0.03]">
                        <td className="px-2.5 py-2 text-white/70">{item.description}</td>
                        <td className="px-2.5 py-2 text-right text-white/50">{Number(item.quantity_ordered)} {item.unit}</td>
                        <td className="px-2.5 py-2 text-right text-white/50">{Number(item.quantity_received)} {item.unit}</td>
                        <td className="px-2.5 py-2 text-right text-white/50">{Number(item.unit_price).toLocaleString('fr-FR')}</td>
                        <td className="px-2.5 py-2 text-right text-white/70 font-medium">{Number(item.total_price).toLocaleString('fr-FR')} F</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-white/[0.06] bg-white/[0.02]">
                    <td colSpan={4} className="px-2.5 py-2 text-right text-white/50 text-[10px]">Total</td>
                    <td className="px-2.5 py-2 text-right text-white font-bold">{Number(currentOrder.total_amount).toLocaleString('fr-FR')} F</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Reception inputs (for ordered/partial status) */}
            {(status === 'ordered' || status === 'partial') && !allReceived && (
              <div className="space-y-2">
                <label className="text-white/40 text-[10px] font-medium block">Réceptionner les marchandises</label>
                {currentItems.map(item => {
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
                        value={receptionQtys[item.id] ?? ''}
                        onChange={e => setReceptionQtys({ ...receptionQtys, [item.id]: Math.min(remaining, parseFloat(e.target.value) || 0) })}
                        className="w-20 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1.5 text-white text-xs text-right focus:outline-none focus:border-emerald-500/40"
                      />
                    </div>
                  );
                })}
                <button
                  onClick={handleReceive}
                  disabled={saving || Object.values(receptionQtys).every(q => !q)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />}
                  Réceptionner
                </button>
              </div>
            )}

            {/* Validate button (draft status) */}
            {status === 'draft' && (
              <button
                onClick={handleValidate}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Valider la commande
              </button>
            )}

            {/* Fully received indicator */}
            {allReceived && (
              <div className="flex items-center justify-center gap-2 py-2 text-emerald-400 text-sm font-medium">
                <CheckCircle2 size={16} /> Marchandises entièrement reçues
              </div>
            )}

            {/* Invoice form (received or partial) */}
            {(status === 'received' || (status === 'partial' && allReceived)) && (
              <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                <h4 className="text-white/60 text-xs font-semibold flex items-center gap-1.5"><FileText size={12} /> Enregistrer une facture</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-white/40 text-[10px] font-medium block mb-1">N° facture</label>
                    <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/40" placeholder="FAC-001" />
                  </div>
                  <div>
                    <label className="text-white/40 text-[10px] font-medium block mb-1">Échéance</label>
                    <input type="date" value={invoiceDueDate} onChange={e => setInvoiceDueDate(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/40" />
                  </div>
                </div>
                <button
                  onClick={handleCreateInvoice}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  Enregistrer la facture
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
