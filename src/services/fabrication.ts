import { supabase } from '../lib/supabase';
import { CartItem, PrintLineItem, Printer, PrintJobType } from '../lib/types';
import { loadCatPrinterCache, resolveCatPrinterSync } from './printingHub';
import { createPrintJobs } from '../lib/printService';

export interface FabricationResult {
  successCount: number;
  failCount: number;
  failedPrinters: string[];
  noPrinterConfigured: boolean;
  allAlreadyPrinted: boolean;
}

interface FabricationTicket {
  printer: Printer;
  items: PrintLineItem[];
  type: PrintJobType;
  orderItemIds: string[];
}

export async function printFabrication(
  cart: CartItem[],
  orderId: string | null,
  userId: string
): Promise<FabricationResult> {
  const result: FabricationResult = {
    successCount: 0,
    failCount: 0,
    failedPrinters: [],
    noPrinterConfigured: false,
    allAlreadyPrinted: false,
  };

  if (cart.length === 0) return result;

  await loadCatPrinterCache();

  const orderItemMap = new Map<string, { id: string; printed_qty: number }>();

  if (orderId) {
    const { data: existingItems } = await supabase
      .from('order_items')
      .select('id, product_id, printed_qty')
      .eq('order_id', orderId);

    for (const item of existingItems || []) {
      orderItemMap.set(item.product_id, {
        id: item.id,
        printed_qty: item.printed_qty ?? 0,
      });
    }
  }

  const groupMap = new Map<string, FabricationTicket>();
  let hasBarOrCuisineItems = false;
  let allDeltaZero = true;

  for (const cartItem of cart) {
    const routing = resolveCatPrinterSync(cartItem.product.category_id);
    if (!routing) continue;

    const { printer } = routing;
    if (printer.type !== 'CUISINE' && printer.type !== 'BAR') continue;

    hasBarOrCuisineItems = true;

    const existing = orderItemMap.get(cartItem.product.id);
    const printedQty = existing?.printed_qty ?? 0;
    const delta = cartItem.qty - printedQty;

    if (delta <= 0) continue;

    allDeltaZero = false;

    const alreadyPrinted = printedQty > 0;

    if (!groupMap.has(printer.id)) {
      groupMap.set(printer.id, {
        printer,
        items: [],
        type: alreadyPrinted ? 'ADDONS' : 'INITIAL',
        orderItemIds: existing ? [existing.id] : [],
      });
    }

    const group = groupMap.get(printer.id)!;
    if (group.type === 'INITIAL' && alreadyPrinted) group.type = 'ADDONS';

    const optTotal = cartItem.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
    const lineItem: PrintLineItem = {
      nom: cartItem.product.nom,
      qty: delta,
      notes: cartItem.notes || undefined,
      options: cartItem.selectedOptions.length > 0 ? cartItem.selectedOptions.map(o => o.nom) : undefined,
      unitPrice: cartItem.product.prix + optTotal,
    };

    group.items.push(lineItem);
    if (existing && !group.orderItemIds.includes(existing.id)) {
      group.orderItemIds.push(existing.id);
    }
  }

  if (!hasBarOrCuisineItems) {
    result.noPrinterConfigured = true;
    return result;
  }

  if (allDeltaZero || groupMap.size === 0) {
    result.allAlreadyPrinted = true;
    return result;
  }

  const ticketNumber = `FAB-${Date.now()}`;
  const allPrintedQtyUpdates: { id: string; printed_qty: number }[] = [];

  for (const [, ticket] of groupMap) {
    await createPrintJobs([{
      printer: ticket.printer,
      printerType: ticket.printer.type,
      station: ticket.printer.type === 'CUISINE' ? 'kitchen' : 'bar',
      items: ticket.items,
    }], {
      orderId: orderId || '',
      tableId: null,
      tableNom: 'Vente directe',
      ticketNumber,
      userId,
      type: ticket.type,
    });

    if (orderId) {
      for (const cartItem of cart) {
        const existing = orderItemMap.get(cartItem.product.id);
        if (existing && ticket.orderItemIds.includes(existing.id)) {
          allPrintedQtyUpdates.push({ id: existing.id, printed_qty: cartItem.qty });
        }
      }
    }

    result.successCount++;
  }

  if (allPrintedQtyUpdates.length > 0) {
    await supabase.rpc('batch_update_printed_qty', { items: allPrintedQtyUpdates });
  }

  return result;
}
