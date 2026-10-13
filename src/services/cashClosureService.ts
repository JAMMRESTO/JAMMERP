import { supabase } from '../lib/supabase';
import {
  CashSession, CashTotals, CashClosure, CashMovement,
  PaymentMethod, CashClosureType,
} from '../lib/types';
import { getBusinessDayStart } from '../lib/businessDay';

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'WAVE', 'ORANGE_MONEY', 'OTHER'];

export async function getOpenSession(): Promise<CashSession | null> {
  const { data } = await supabase
    .from('cash_sessions')
    .select('*, opened_by_user:users!cash_sessions_opened_by_fkey(nom)')
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .maybeSingle();
  return data as CashSession | null;
}

export async function getOrCreateSession(params: {
  userId: string;
  openingFloat?: number;
}): Promise<CashSession | null> {
  const existing = await getOpenSession();
  if (existing) return existing;
  return openSession({ userId: params.userId, openingFloat: params.openingFloat ?? 0 });
}

let _openingSession = false;

export async function openSession(params: {
  userId: string;
  openingFloat: number;
  notes?: string;
}): Promise<CashSession | null> {
  if (_openingSession) {
    await new Promise(r => setTimeout(r, 300));
    return getOpenSession();
  }

  _openingSession = true;
  try {
    const existing = await getOpenSession();
    if (existing) return existing;

    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({
        caissier_id: params.userId,
        opened_by: params.userId,
        opening_float: params.openingFloat,
        ouverture: new Date().toISOString(),
        opened_at: new Date().toISOString(),
        status: 'open',
        notes: params.notes || '',
        total_especes: 0,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      console.error('[openSession] insert error:', error);
      return getOpenSession();
    }

    await auditLog(params.userId, 'SESSION_OPEN', {
      session_id: data.id,
      opening_float: params.openingFloat,
    });

    return data as CashSession;
  } finally {
    _openingSession = false;
  }
}

export async function computeTotals(session: CashSession | null, periodEnd?: string): Promise<CashTotals> {
  const now = new Date();
  const dayStart = getBusinessDayStart(now).toISOString();
  const start = dayStart;
  const end = periodEnd || now.toISOString();

  const { data: timePayments } = await supabase
    .from('payments')
    .select('*')
    .eq('pay_status', 'valid')
    .gte('paid_at', start)
    .lte('paid_at', end);
  const payments: any[] = timePayments || [];

  const allCandidateOrderIds = [...new Set(payments.map((p: any) => p.order_id).filter(Boolean))];

  let paidOrders: any[] = [];
  if (allCandidateOrderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, ticket_number, created_at, updated_at')
      .in('id', allCandidateOrderIds)
      .eq('statut', 'PAYEE');
    paidOrders = orders || [];
  }

  const paidOrderIds = paidOrders.map((o: any) => o.id);

  const grossRevenue = paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0);

  const byMethod: Record<PaymentMethod, number> = {
    CASH: 0, CARD: 0, WAVE: 0, ORANGE_MONEY: 0, OTHER: 0,
  };

  const paidOrderIdSet = new Set(paidOrderIds);
  const activePayments = payments.filter((p: any) => !p.order_id || paidOrderIdSet.has(p.order_id));

  for (const p of activePayments) {
    const method: PaymentMethod = p.method || (p.mode === 'ESPECES' ? 'CASH' : 'OTHER');
    if (method in byMethod) {
      byMethod[method] += p.montant || 0;
    } else {
      byMethod.OTHER += p.montant || 0;
    }
  }

  let movementsIn = 0;
  let movementsOut = 0;
  let totalExpenses = 0;

  if (session) {
    const { data: movements } = await supabase
      .from('cash_movements')
      .select('*')
      .eq('session_id', session.id);

    movementsIn = (movements || []).filter(m => m.type === 'IN').reduce((s, m) => s + (m.amount || 0), 0);
    movementsOut = (movements || []).filter(m => m.type === 'OUT').reduce((s, m) => s + (m.amount || 0), 0);
  }

  const expensesQuery = session
    ? supabase.from('expenses').select('amount').eq('session_id', session.id)
    : supabase.from('expenses').select('amount').gte('expense_date', start).lte('expense_date', end);
  const { data: dayExpenses } = await expensesQuery;
  totalExpenses = (dayExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);

  const openingFloat = session?.opening_float || 0;
  const cashTheoretical = openingFloat + byMethod.CASH + movementsIn - movementsOut - totalExpenses;

  const productMap = new Map<string, { nom: string; qty: number; amount: number }>();

  if (paidOrderIds.length > 0) {
    const { data: items } = await supabase
      .from('order_items')
      .select('nom_snapshot, qty, prix_snapshot')
      .in('order_id', paidOrderIds);

    for (const item of (items || [])) {
      const existing = productMap.get(item.nom_snapshot);
      if (existing) {
        existing.qty += item.qty;
        existing.amount += item.qty * item.prix_snapshot;
      } else {
        productMap.set(item.nom_snapshot, {
          nom: item.nom_snapshot,
          qty: item.qty,
          amount: item.qty * item.prix_snapshot,
        });
      }
    }
  }

  const allProducts = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount);

  const topProducts = allProducts.slice(0, 10);

  const byCategory: Record<string, number> = {};
  if (paidOrderIds.length > 0) {
    const { data: catItems } = await supabase
      .from('order_items')
      .select('qty, prix_snapshot, product:products(category:categories!category_id(nom))')
      .in('order_id', paidOrderIds);

    for (const item of (catItems || [])) {
      const catNom = (item as any).product?.category?.nom || 'Autre';
      byCategory[catNom] = (byCategory[catNom] || 0) + item.qty * item.prix_snapshot;
    }
  }

  return {
    period_start: start,
    period_end: end,
    paid_orders_count: paidOrderIds.length,
    ticket_average: paidOrderIds.length > 0 ? Math.round(grossRevenue / paidOrderIds.length) : 0,
    gross_revenue: grossRevenue,
    net_revenue: grossRevenue - totalExpenses,
    discounts: 0,
    by_method: byMethod,
    by_category: byCategory,
    top_products: topProducts,
    all_products: allProducts,
    movements_in: movementsIn,
    movements_out: movementsOut,
    cash_theoretical: cashTheoretical,
    opening_float: openingFloat,
    total_expenses: totalExpenses,
  };
}

export async function createXClosure(params: {
  session: CashSession | null;
  userId: string;
  totals: CashTotals;
  notes?: string;
}): Promise<CashClosure | null> {
  const { data, error } = await supabase
    .from('cash_closures')
    .insert({
      session_id: params.session?.id ?? null,
      type: 'X',
      created_by: params.userId,
      totals_json: params.totals,
      excluded_unpaid_count: 0,
      excluded_unpaid_amount: 0,
      notes: params.notes || '',
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('[createXClosure] insert error:', error);
    return null;
  }

  await auditLog(params.userId, 'CLOSURE_X', {
    session_id: params.session?.id ?? null,
    closure_id: data.id,
    gross_revenue: params.totals.gross_revenue,
  });

  return data as CashClosure;
}

export async function createZClosure(params: {
  session: CashSession | null;
  userId: string;
  totals: CashTotals;
  cashCounted: number;
  notes?: string;
}): Promise<{ closure: CashClosure | null; error: string | null }> {
  const cashDifference = params.cashCounted - params.totals.cash_theoretical;

  const now = new Date();
  const dayStart = getBusinessDayStart(now).toISOString();

  let unpaidCount = 0;
  let unpaidAmount = 0;

  const unpaidQuery = supabase
    .from('orders')
    .select('id, total')
    .not('statut', 'in', '("PAYEE","CLOTUREE","ANNULEE")')
    .gte('created_at', dayStart)
    .lte('created_at', now.toISOString());

  const { data: unpaidOrders } = await unpaidQuery;
  for (const o of unpaidOrders || []) {
    unpaidCount += 1;
    unpaidAmount += o.total || 0;
  }

  const { data: closure, error: closureError } = await supabase
    .from('cash_closures')
    .insert({
      session_id: params.session?.id ?? null,
      type: 'Z',
      created_by: params.userId,
      totals_json: params.totals,
      excluded_unpaid_count: unpaidCount,
      excluded_unpaid_amount: unpaidAmount,
      cash_counted: params.cashCounted,
      cash_difference: cashDifference,
      notes: params.notes || '',
    })
    .select()
    .maybeSingle();

  if (closureError || !closure) {
    const msg = closureError?.message || 'Enregistrement échoué';
    console.error('[createZClosure] insert error:', closureError);
    return { closure: null, error: msg };
  }

  if (params.session) {
    const { error: sessionError } = await supabase
      .from('cash_sessions')
      .update({
        status: 'closed',
        closed_by: params.userId,
        closed_at: new Date().toISOString(),
        fermeture: new Date().toISOString(),
        total_especes: params.totals.by_method.CASH,
      })
      .eq('id', params.session.id)
      .eq('status', 'open');

    if (sessionError) {
      console.error('[createZClosure] session update error:', sessionError);
      await supabase.from('cash_closures').delete().eq('id', closure.id);
      return { closure: null, error: sessionError.message };
    }
  }

  const end = now.toISOString();

  const { data: timePayments } = await supabase
    .from('payments')
    .select('order_id')
    .eq('pay_status', 'valid')
    .gte('paid_at', dayStart)
    .lte('paid_at', end);
  const allOrderIdSets: string[] = [];
  for (const p of (timePayments || [])) {
    if (p.order_id) allOrderIdSets.push(p.order_id);
  }

  const sessionOrderIds = [...new Set(allOrderIdSets)];

  let paidOrders: any[] = [];
  let ordersSelectError: any = null;

  if (sessionOrderIds.length > 0) {
    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('id')
      .in('id', sessionOrderIds)
      .eq('statut', 'PAYEE');
    paidOrders = orders || [];
    ordersSelectError = oErr;
  }

  if (ordersSelectError) {
    console.error('[createZClosure] orders select error:', ordersSelectError);
  }

  if (paidOrders && paidOrders.length > 0) {
    const ids = paidOrders.map(o => o.id);
    const { error: ordersUpdateError } = await supabase
      .from('orders')
      .update({ statut: 'CLOTUREE' })
      .in('id', ids);
    if (ordersUpdateError) {
      console.error('[createZClosure] orders update error:', ordersUpdateError);
    }
  }

  await auditLog(params.userId, 'CLOSURE_Z', {
    session_id: params.session?.id ?? null,
    closure_id: closure.id,
    gross_revenue: params.totals.gross_revenue,
    cash_counted: params.cashCounted,
    cash_difference: cashDifference,
    archived_orders: paidOrders?.length ?? 0,
  });

  return { closure: closure as CashClosure, error: null };
}

export async function getSessionClosures(sessionId: string): Promise<CashClosure[]> {
  const { data } = await supabase
    .from('cash_closures')
    .select('*, created_by_user:users!cash_closures_created_by_fkey(nom)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  return (data || []) as CashClosure[];
}

export async function getSessionMovements(sessionId: string): Promise<CashMovement[]> {
  const { data } = await supabase
    .from('cash_movements')
    .select('*, created_by_user:users!cash_movements_created_by_fkey(nom)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  return (data || []) as CashMovement[];
}

export async function addMovement(params: {
  sessionId: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  userId: string;
}): Promise<CashMovement | null> {
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      session_id: params.sessionId,
      type: params.type,
      amount: params.amount,
      reason: params.reason,
      created_by: params.userId,
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;

  await auditLog(params.userId, `MOVEMENT_${params.type}`, {
    session_id: params.sessionId,
    amount: params.amount,
    reason: params.reason,
  });

  return data as CashMovement;
}

async function auditLog(userId: string, action: string, payload: object) {
  await supabase.from('cash_audit_logs').insert({
    user_id: userId,
    action,
    payload,
  });
}

export function generateCashTicketPayload(params: {
  type: CashClosureType;
  session: CashSession | null;
  totals: CashTotals;
  cashCounted?: number;
  caissierNom: string;
  restaurantNom?: string;
}): string {
  const { type, session, totals, cashCounted, caissierNom, restaurantNom = 'LA FIESTA' } = params;

  const ESC = '\x1B';
  const INIT = ESC + '\x40';
  const BOLD_ON = ESC + '\x45\x01';
  const BOLD_OFF = ESC + '\x45\x00';
  const DOUBLE_ON = ESC + '\x21\x30';
  const DOUBLE_OFF = ESC + '\x21\x00';
  const CENTER = ESC + '\x61\x01';
  const LEFT = ESC + '\x61\x00';
  const CUT = '\x1D\x56\x42\x00';
  const COLS = 48;
  const DOUBLE_COLS = 24;
  const LINE = '-'.repeat(COLS) + '\n';
  const DLINE = '='.repeat(COLS) + '\n';

  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  });

  const periodStart = new Date(totals.period_start).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const periodEnd = new Date(totals.period_end).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const methodLabels: Record<PaymentMethod, string> = {
    CASH: 'Espèces', CARD: 'Carte', WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', OTHER: 'Autre',
  };

  const f = (n: number) => n.toLocaleString('fr-FR').replace(/[\u00A0\u202F\u2009\u2007]/g, ' ') + ' F';
  const pad = (left: string, right: string, width = COLS) => {
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right + '\n';
  };

  let text = INIT;
  text += CENTER;
  text += DOUBLE_ON + restaurantNom + '\n' + DOUBLE_OFF;
  text += BOLD_ON + (type === 'X' ? 'RAPPORT X - LECTURE\n' : 'RAPPORT Z - CLOTURE\n') + BOLD_OFF;
  text += now + '\n';
  text += DLINE;
  text += LEFT;
  text += `Caissier: ${caissierNom}\n`;
  text += `Periode: ${periodStart}\n`;
  text += `     au: ${periodEnd}\n`;
  text += `Fond caisse: ${f(totals.opening_float)}\n`;
  text += LINE;

  text += CENTER + BOLD_ON + 'VENTES\n' + BOLD_OFF + LEFT;
  text += pad('Tickets payes:', String(totals.paid_orders_count));
  text += pad('Ticket moyen:', f(totals.ticket_average));
  text += pad('CA brut:', f(totals.gross_revenue));
  if ((totals.total_expenses ?? 0) > 0) {
    text += pad('Depenses:', '-' + f(totals.total_expenses));
    text += BOLD_ON + pad('CA NET:', f(totals.net_revenue)) + BOLD_OFF;
  }
  text += LINE;

  text += CENTER + BOLD_ON + 'PAR MOYEN DE PAIEMENT\n' + BOLD_OFF + LEFT;
  for (const method of METHODS) {
    const amount = totals.by_method[method] || 0;
    if (amount > 0) {
      text += pad(methodLabels[method] + ':', f(amount));
    }
  }
  const totalPaid = METHODS.reduce((s, m) => s + (totals.by_method[m] || 0), 0);
  const totalEncLabel = 'TOTAL ENCAISSE:';
  const totalEncValue = f(totalPaid);
  const totalEncFull = totalEncLabel.length + totalEncValue.length + 1;
  if (totalEncFull <= DOUBLE_COLS) {
    const totalEncPad = Math.max(1, DOUBLE_COLS - totalEncLabel.length - totalEncValue.length);
    text += CENTER + DOUBLE_ON + BOLD_ON;
    text += totalEncLabel + ' '.repeat(totalEncPad) + totalEncValue + '\n';
    text += BOLD_OFF + DOUBLE_OFF + LEFT;
  } else {
    text += BOLD_ON + pad(totalEncLabel, totalEncValue) + BOLD_OFF;
  }
  text += LINE;

  if (Object.keys(totals.by_category).length > 0) {
    text += CENTER + BOLD_ON + 'PAR CATEGORIE\n' + BOLD_OFF + LEFT;
    for (const [cat, amount] of Object.entries(totals.by_category)) {
      text += pad(cat + ':', f(amount));
    }
    text += LINE;
  }

  if (totals.top_products.length > 0) {
    text += CENTER + BOLD_ON + 'TOP PRODUITS\n' + BOLD_OFF + LEFT;
    for (const p of totals.top_products.slice(0, 5)) {
      const label = `${p.qty}x ${p.nom.slice(0, 30)}`;
      text += pad(label, f(p.amount));
    }
    text += LINE;
  }

  if (totals.all_products && totals.all_products.length > 0) {
    text += CENTER + BOLD_ON + 'DETAIL DES PRODUITS\n' + BOLD_OFF + LEFT;
    for (const p of totals.all_products) {
      const label = `${p.qty}x ${p.nom.slice(0, 30)}`;
      text += pad(label, f(p.amount));
    }
    const totalQty = totals.all_products.reduce((s, p) => s + p.qty, 0);
    const totalAmt = totals.all_products.reduce((s, p) => s + p.amount, 0);
    text += BOLD_ON + pad(`TOTAL (${totalQty}):`, f(totalAmt)) + BOLD_OFF;
    text += LINE;
  }

  if (totals.movements_in > 0 || totals.movements_out > 0) {
    text += CENTER + BOLD_ON + 'MOUVEMENTS CAISSE\n' + BOLD_OFF + LEFT;
    if (totals.movements_in > 0) text += pad('Entrees:', f(totals.movements_in));
    if (totals.movements_out > 0) text += pad('Sorties:', f(totals.movements_out));
    text += LINE;
  }

  text += CENTER + BOLD_ON + 'SOLDE ESPECES\n' + BOLD_OFF + LEFT;
  text += pad('Fond initial:', f(totals.opening_float));
  text += pad('Ventes especes:', f(totals.by_method.CASH));
  if (totals.movements_in > 0) text += pad('+ Entrees:', f(totals.movements_in));
  if (totals.movements_out > 0) text += pad('- Sorties:', f(totals.movements_out));
  if ((totals.total_expenses ?? 0) > 0) text += pad('- Depenses:', f(totals.total_expenses));
  const theoLabel = 'Theorique:';
  const theoValue = f(totals.cash_theoretical);
  const theoFull = theoLabel.length + theoValue.length + 1;
  if (theoFull <= DOUBLE_COLS) {
    const theoPad = Math.max(1, DOUBLE_COLS - theoLabel.length - theoValue.length);
    text += CENTER + DOUBLE_ON + BOLD_ON;
    text += theoLabel + ' '.repeat(theoPad) + theoValue + '\n';
    text += BOLD_OFF + DOUBLE_OFF + LEFT;
  } else {
    text += BOLD_ON + pad(theoLabel, theoValue) + BOLD_OFF;
  }

  if (type === 'Z' && cashCounted !== undefined) {
    const diff = cashCounted - totals.cash_theoretical;
    text += pad('Comptage reel:', f(cashCounted));
    const diffLabel = diff >= 0 ? `+${f(diff)}` : f(diff);
    text += BOLD_ON + pad('Ecart:', diffLabel) + BOLD_OFF;
    text += LINE;
    text += CENTER;
    if (Math.abs(diff) < 1) {
      text += BOLD_ON + '** CAISSE CORRECTE **\n' + BOLD_OFF;
    } else if (diff > 0) {
      text += BOLD_ON + '>> EXCEDENT CAISSE <<\n' + BOLD_OFF;
    } else {
      text += BOLD_ON + '<< MANQUANT CAISSE >>\n' + BOLD_OFF;
    }
    text += LEFT;
  }

  text += LINE;
  text += CENTER + 'Signature caissier: ____________\n';
  if (type === 'Z') text += 'Signature responsable: _________\n';
  text += '\n';
  const sessionRef = session ? session.id.slice(0, 8) : new Date().toISOString().slice(0, 10);
  text += (type === 'X' ? 'X-SESSION-' : 'Z-SESSION-') + sessionRef + '\n';
  text += CUT;

  return text;
}
