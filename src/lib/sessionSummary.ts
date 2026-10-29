import { supabase } from './supabase';
import { formatItemDisplayName } from './variantLabel';
import type { PaymentMethod } from '../types/database';

export interface SessionSummary {
  total_sales: number;
  sales_count: number;
  by_method: Record<PaymentMethod, number>;
  by_category: { name: string; count: number; total: number }[];
  by_user: { name: string; products: { name: string; qty: number }[] }[];
  cash_expenses: number;
  cancelled_items: { name: string; qty: number; total: number }[];
  cancelled_tickets: CancelledTicket[];
  cancelled_total: number;
}

export interface CancelledTicket {
  id: string;
  sale_number: number;
  total: number;
  cancelled_at: string;
  cancelled_by_name: string;
  cancel_reason: string;
}

export interface SessionWindow {
  id: string | null;
  opened_at: string;
  closed_at: string | null;
}

export function emptySessionSummary(): SessionSummary {
  return {
    total_sales: 0,
    sales_count: 0,
    by_method: { cash: 0, wave: 0, orange_money: 0, card: 0 },
    by_category: [],
    by_user: [],
    cash_expenses: 0,
    cancelled_items: [],
    cancelled_tickets: [],
    cancelled_total: 0,
  };
}

type SaleRow = { id: string; total: number; cashier_id: string | null };

async function loadPaidSales(siteId: string, session: SessionWindow): Promise<SaleRow[]> {
  if (session.id) {
    const { data } = await supabase
      .from('sales')
      .select('id, total, cashier_id')
      .eq('site_id', siteId)
      .eq('status', 'paid')
      .eq('cash_session_id', session.id);
    if (data && data.length > 0) return data as SaleRow[];
  }
  const { data } = await supabase
    .from('sales')
    .select('id, total, cashier_id')
    .eq('site_id', siteId)
    .eq('status', 'paid')
    .gte('paid_at', session.opened_at)
    .lte('paid_at', session.closed_at ?? new Date().toISOString());
  return (data ?? []) as SaleRow[];
}

export async function fetchSessionSummary(siteId: string, session: SessionWindow): Promise<SessionSummary> {
  const summary = emptySessionSummary();
  const closedAt = session.closed_at ?? new Date().toISOString();

  const salesData = await loadPaidSales(siteId, session);
  const saleIds = salesData.map(s => s.id);
  summary.total_sales = salesData.reduce((s, v) => s + v.total, 0);
  summary.sales_count = saleIds.length;

  const { data: expensesData } = await supabase
    .from('expenses')
    .select('amount')
    .eq('site_id', siteId)
    .eq('payment_method', 'cash')
    .gte('created_at', session.opened_at)
    .lte('created_at', closedAt);
  summary.cash_expenses = (expensesData ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const { data: cancelledSales } = await supabase
    .from('sales')
    .select('id, sale_number, total, cancelled_at, cancelled_by_name, cancel_reason')
    .eq('site_id', siteId)
    .eq('status', 'cancelled')
    .gte('cancelled_at', session.opened_at)
    .lte('cancelled_at', closedAt)
    .order('cancelled_at', { ascending: true });
  summary.cancelled_tickets = ((cancelledSales ?? []) as CancelledTicket[]).map(s => ({
    ...s,
    total: Number(s.total),
    cancelled_by_name: s.cancelled_by_name ?? '',
    cancel_reason: s.cancel_reason ?? '',
  }));
  summary.cancelled_total = summary.cancelled_tickets.reduce((s, t) => s + t.total, 0);
  const cancelledIds = summary.cancelled_tickets.map(s => s.id);
  if (cancelledIds.length > 0) {
    const { data: cancelledItems } = await supabase
      .from('sale_items')
      .select('quantity, product_name, variant_label, subtotal')
      .eq('site_id', siteId)
      .in('sale_id', cancelledIds);
    const cancelledMap = new Map<string, { qty: number; total: number }>();
    for (const item of cancelledItems ?? []) {
      const name = formatItemDisplayName(item.product_name, (item as any).variant_label);
      const existing = cancelledMap.get(name) ?? { qty: 0, total: 0 };
      existing.qty += item.quantity;
      existing.total += item.subtotal;
      cancelledMap.set(name, existing);
    }
    summary.cancelled_items = Array.from(cancelledMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty);
  }

  if (saleIds.length === 0) return summary;

  const [{ data: paymentsData }, { data: itemsData }] = await Promise.all([
    supabase.from('payments').select('method, amount').eq('site_id', siteId).in('sale_id', saleIds),
    supabase
      .from('sale_items')
      .select('sale_id, quantity, product_name, variant_label, subtotal, product:products(category:categories(name))')
      .eq('site_id', siteId)
      .in('sale_id', saleIds),
  ]);

  for (const p of paymentsData ?? []) {
    summary.by_method[p.method as PaymentMethod] = (summary.by_method[p.method as PaymentMethod] ?? 0) + p.amount;
  }

  const cashierIds = [...new Set(salesData.map(s => s.cashier_id).filter(Boolean))] as string[];
  const cashierNameMap: Record<string, string> = {};
  if (cashierIds.length > 0) {
    const { data: usersData } = await supabase.from('users').select('id, name').in('id', cashierIds);
    for (const user of usersData ?? []) cashierNameMap[user.id] = user.name;
  }
  const saleCashierMap = new Map(salesData.map(sale => [sale.id, sale.cashier_id ?? '']));

  const userProductMap = new Map<string, Map<string, number>>();
  const catMap = new Map<string, { count: number; total: number }>();
  for (const item of itemsData ?? []) {
    const cashierId = saleCashierMap.get(item.sale_id) ?? '';
    const userName = cashierId ? (cashierNameMap[cashierId] ?? 'UTILISATEUR NON RENSEIGNÉ') : 'UTILISATEUR NON RENSEIGNÉ';
    if (!userProductMap.has(userName)) userProductMap.set(userName, new Map());
    const productMap = userProductMap.get(userName)!;
    const displayName = formatItemDisplayName(item.product_name, (item as any).variant_label);
    productMap.set(displayName, (productMap.get(displayName) ?? 0) + item.quantity);

    const catName = (item as any).product?.category?.name ?? 'Sans catégorie';
    const existing = catMap.get(catName) ?? { count: 0, total: 0 };
    existing.count += item.quantity;
    existing.total += item.subtotal;
    catMap.set(catName, existing);
  }

  summary.by_user = Array.from(userProductMap.entries()).map(([name, productMap]) => ({
    name,
    products: Array.from(productMap.entries())
      .map(([productName, qty]) => ({ name: productName, qty }))
      .sort((a, b) => b.qty - a.qty),
  }));
  summary.by_category = Array.from(catMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total);

  return summary;
}
