import { supabase } from './supabase';
import { CartItem, PrintGroup, PrintLineItem, Printer, PrintJobType, PrintStation, PaymentMethod } from './types';
import { encodePayload, decodePayload, loadCatPrinterCache, resolveCatPrinter, resolveCatPrinterSync } from '../services/printingHub';
import { printWithQzTray } from './qzTray';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  WAVE: 'Wave',
  ORANGE_MONEY: 'Orange Money',
  OTHER: 'Autre',
};

const _printerQueues = new Map<string, Promise<void>>();

function getPrinterQueue(printerId: string): Promise<void> {
  if (!_printerQueues.has(printerId)) {
    _printerQueues.set(printerId, Promise.resolve());
  }
  return _printerQueues.get(printerId)!;
}

export function rawToHtml(raw: string): string {
  const cleaned = raw
    .replace(/\x1B\x21\x01/g, '<span style="font-size:10px;font-weight:normal">')
    .replace(/\x1B\x21\x00/g, '</span>')
    .replace(/\x1B\[\d*[A-Za-z]/g, '')
    .replace(/\x1B./g, '')
    .replace(/\x1D\(k[^]*?\x1D\\/g, '')
    .replace(/\x1D\x56\x42\x00/g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:13px;line-height:1.3;width:80mm;max-width:80mm;margin:0 auto;padding:4px;color:#000;white-space:pre-wrap;word-break:break-word;-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{@page{margin:0mm;size:80mm auto}html,body{width:80mm;padding:0;margin:0}}</style></head><body>${cleaned}</body></html>`;
}

export async function dispatchJobImmediately(
  jobId: string,
  printer: Printer,
  encodedPayload: string,
  group?: PrintGroup,
  ctx?: { tableNom: string; ticketNumber: string; type: PrintJobType; total?: number },
): Promise<void> {
  const isNetwork = printer.connection_type === 'NETWORK' && group && ctx;

  if (isNetwork) return;

  const { error: claimError } = await supabase
    .from('print_jobs')
    .update({ status: 'PRINTING' })
    .eq('id', jobId)
    .eq('status', 'PENDING');
  if (claimError) return;

  const html = rawToHtml(decodePayload(encodedPayload));
  const qzPrinterName = printer.usb_name || printer.nom;
  const printedWithQz = await printWithQzTray(qzPrinterName, html);

  if (printedWithQz) {
    await supabase.from('print_jobs').update({
      status: 'SUCCESS',
      printed_at: new Date().toISOString(),
    }).eq('id', jobId).eq('status', 'PRINTING');
    return;
  }

  try {
    await triggerBrowserPrint(html, printer.id);
    await supabase.from('print_jobs').update({
      status: 'SUCCESS',
      printed_at: new Date().toISOString(),
    }).eq('id', jobId).eq('status', 'PRINTING');
  } catch {
    await supabase.from('print_jobs').update({
      status: 'FAILED',
      last_error: 'Browser print failed',
    }).eq('id', jobId).eq('status', 'PRINTING');
  }
}

export interface PrintContext {
  orderId: string;
  tableId: string | null;
  tableNom: string;
  ticketNumber: string;
  userId: string;
  type: PrintJobType;
  total?: number;
  montantRecu?: number;
  monnaie?: number;
  paymentMethod?: PaymentMethod;
}

interface RestaurantInfo {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  logo_data_url: string | null;
}

let _restaurantInfo: RestaurantInfo | null = null;
let _restaurantInfoTime = 0;
const RESTAURANT_INFO_TTL = 60_000;

export function invalidateRestaurantInfoCache(): void {
  _restaurantInfo = null;
  _restaurantInfoTime = 0;
}

async function fetchLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getRestaurantInfo(): Promise<RestaurantInfo> {
  const now = Date.now();
  if (_restaurantInfo && now - _restaurantInfoTime < RESTAURANT_INFO_TTL) return _restaurantInfo;

  const { data } = await supabase
    .from('restaurants')
    .select('name, address, phone, email, logo_url')
    .maybeSingle();

  const logoUrl = data?.logo_url || null;
  const logoDataUrl = logoUrl ? await fetchLogoDataUrl(logoUrl) : null;

  _restaurantInfo = {
    name: data?.name || 'LA FIESTA',
    address: data?.address || null,
    phone: data?.phone || null,
    email: data?.email || null,
    logo_url: logoUrl,
    logo_data_url: logoDataUrl,
  };
  _restaurantInfoTime = now;
  return _restaurantInfo;
}

export function prewarmCaches(): Promise<void> {
  return Promise.all([
    getRestaurantInfo(),
    loadCatPrinterCache(),
  ]).then(() => {});
}

function fmtNum(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '.' : s;
}

function wrapOptions(text: string, cols: number): string {
  const prefix = '  -> ';
  const indent = '     ';
  const maxFirst = cols - prefix.length;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if ((cur + ' ' + w).length <= maxFirst) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l, i) => (i === 0 ? prefix + l : indent + l)).join('\n') + '\n';
}

function mergeItems(items: PrintLineItem[]): PrintLineItem[] {
  const map = new Map<string, PrintLineItem>();
  for (const item of items) {
    const key = `${item.nom}|${item.unitPrice}|${(item.options || []).join(',')}|${item.notes || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

type GroupedEntry =
  | { type: 'simple'; item: PrintLineItem }
  | { type: 'variants'; nom: string; items: PrintLineItem[] };

function groupByProductName(items: PrintLineItem[]): GroupedEntry[] {
  const result: GroupedEntry[] = [];
  const variantGroups = new Map<string, PrintLineItem[]>();

  for (const item of items) {
    if (item.options && item.options.length > 0) {
      const existing = variantGroups.get(item.nom);
      if (existing) {
        existing.push(item);
      } else {
        variantGroups.set(item.nom, [item]);
      }
    }
  }

  const seen = new Set<string>();
  for (const item of items) {
    if (item.options && item.options.length > 0) {
      if (!seen.has(item.nom)) {
        seen.add(item.nom);
        const group = variantGroups.get(item.nom)!;
        if (group.length === 1) {
          result.push({ type: 'simple', item });
        } else {
          result.push({ type: 'variants', nom: item.nom, items: group });
        }
      }
    } else {
      result.push({ type: 'simple', item });
    }
  }

  return result;
}

function stationFromPrinterType(type: string): PrintStation {
  if (type === 'CUISINE') return 'kitchen';
  if (type === 'BAR') return 'bar';
  if (type === 'CAISSE') return 'cashier';
  return 'other';
}

function destinationLabel(group: PrintGroup): string {
  switch (group.printerType) {
    case 'BAR': return 'BAR';
    case 'CUISINE': return 'CUISINE';
    case 'CAISSE': return 'CAISSE';
    default: return 'PREPARATION';
  }
}

function orderTicketTitle(group: PrintGroup, type: PrintJobType): string {
  const dest = destinationLabel(group);
  if (type === 'INITIAL') return `BON ${dest}`;
  if (type === 'ADDONS') return `AJOUTS ${dest}`;
  return type === 'BILL' ? 'ADDITION' : '';
}

export { loadCatPrinterCache as invalidateRoutingCache };

export async function generatePayloadText(
  group: PrintGroup,
  tableNom: string,
  ticketNumber: string,
  type: PrintJobType,
  total?: number,
  montantRecu?: number,
  monnaie?: number
): Promise<string> {
  const restaurant = await getRestaurantInfo();

  const typeLabel: Record<PrintJobType, string> = {
    INITIAL: 'BON DE COMMANDE',
    ADDONS: 'AJOUTS',
    BILL: 'ADDITION',
    RECEIPT: 'FACTURE',
    TEST: 'TEST IMPRESSION',
    REPORT_X: 'RAPPORT X',
    REPORT_Z: 'CLOTURE Z',
  };

  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  });

  const ESC = '\x1B';
  const INIT = ESC + '\x40';
  const BOLD_ON = ESC + '\x45\x01';
  const BOLD_OFF = ESC + '\x45\x00';
  const SMALL_ON = ESC + '\x21\x01';
  const SMALL_OFF = ESC + '\x21\x00';
  const DOUBLE_ON = ESC + '\x21\x30';
  const DOUBLE_OFF = ESC + '\x21\x00';
  const CENTER = ESC + '\x61\x01';
  const LEFT = ESC + '\x61\x00';
  const CUT = '\x1D\x56\x42\x00';
  const COLS = 48;
  const DOUBLE_COLS = 24;
  const LINE = '-'.repeat(COLS) + '\n';
  const DLINE = '='.repeat(COLS) + '\n';

  const showPrices = type === 'BILL' || type === 'RECEIPT';
  const isOrderTicket = type === 'INITIAL';

  let text = INIT;

  if (isOrderTicket) {
    text += CENTER + DOUBLE_ON + BOLD_ON + orderTicketTitle(group, type) + '\n' + BOLD_OFF + DOUBLE_OFF + LEFT;
    text += DLINE;
    text += BOLD_ON + `Table: ${tableNom}` + BOLD_OFF + ` · Ticket ${ticketNumber} · ${now}\n`;
    text += LINE;
  } else {
    text += CENTER;
    text += DOUBLE_ON + restaurant.name + '\n' + DOUBLE_OFF;

    if (showPrices) {
      if (restaurant.address) text += restaurant.address + '\n';
      if (restaurant.phone) text += 'Tel: ' + restaurant.phone + '\n';
      text += DLINE;
      text += BOLD_ON + typeLabel[type] + '\n' + BOLD_OFF;
    } else {
      text += BOLD_ON + typeLabel[type] + '\n' + BOLD_OFF;
      text += DLINE;
    }

    text += LEFT;
    if (showPrices || type === 'TEST' || type === 'ADDONS') {
      text += `Table ${tableNom} · Ticket ${ticketNumber} · ${now}\n`;
      text += LINE;
    }
  }

  const merged = mergeItems(group.items);

  const grouped = groupByProductName(merged);

  for (const entry of grouped) {
    if (entry.type === 'simple') {
      const item = entry.item;
      const lineTotalStr = fmtNum(item.unitPrice * item.qty) + 'F';
      const prefix = `${item.qty}x `;
      if (isOrderTicket && !showPrices) {
        const dMaxNom = DOUBLE_COLS - prefix.length;
        const dNomShort = truncate(item.nom, Math.max(6, dMaxNom));
        text += DOUBLE_ON + BOLD_ON + prefix + dNomShort + BOLD_OFF + DOUBLE_OFF + '\n';
        if (item.options && item.options.length > 0) {
          text += `  > ${item.options.join(', ')}\n`;
        }
        if (item.notes) {
          text += SMALL_ON + `  ! ${item.notes}` + SMALL_OFF + '\n';
        }
      } else {
        const maxNom = showPrices ? COLS - prefix.length - lineTotalStr.length - 1 : COLS - prefix.length;
        const nomShort = truncate(item.nom, Math.max(8, maxNom));
        const label = prefix + nomShort;
        text += BOLD_ON + label + BOLD_OFF;
        if (showPrices) {
          const padding = Math.max(1, COLS - label.length - lineTotalStr.length);
          text += ' '.repeat(padding) + lineTotalStr + '\n';
        } else {
          text += '\n';
        }
        if (item.options && item.options.length > 0) {
          const optStr = ' (' + item.options.join(', ') + ')';
          if (label.length + optStr.length <= COLS) {
            text += optStr + '\n';
          } else {
            text += '\n' + wrapOptions(item.options.join(', '), COLS);
          }
        }
        if (item.notes) {
          text += `  Note: ${item.notes}\n`;
        }
      }
    } else {
      text += BOLD_ON + entry.nom.toUpperCase() + '\n' + BOLD_OFF;
      for (const item of entry.items) {
        const variantLabel = item.options && item.options.length > 0
          ? item.options.join(', ')
          : item.nom;
        const qtyPrefix = item.qty > 1 ? `${item.qty}x ` : '   ';
        if (isOrderTicket && !showPrices) {
          const dMaxVar = DOUBLE_COLS - qtyPrefix.length;
          const dVarShort = truncate(variantLabel, Math.max(6, dMaxVar));
          text += `   ${DOUBLE_ON}${qtyPrefix}${dVarShort}${DOUBLE_OFF}\n`;
        } else if (showPrices) {
          const lineTotalStr = fmtNum(item.unitPrice * item.qty) + 'F';
          const maxVar = COLS - qtyPrefix.length - lineTotalStr.length - 1;
          const varShort = truncate(variantLabel, Math.max(8, maxVar));
          const label = qtyPrefix + varShort;
          const padding = Math.max(1, COLS - label.length - lineTotalStr.length);
          text += `   ${label}` + ' '.repeat(padding) + lineTotalStr + '\n';
        } else {
          text += `   ${qtyPrefix}${variantLabel}\n`;
        }
        if (item.notes) {
          text += SMALL_ON + `     Note: ${item.notes}` + SMALL_OFF + '\n';
        }
      }
    }
  }

  if (!isOrderTicket) {
    text += LINE;
  }

  if (showPrices) {
    const itemsTotal = merged.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const computedTotal = (total && total > 0) ? total : itemsTotal;
    const totalStr = fmtNum(computedTotal) + ' FCFA';
    const label = 'TOTAL:';
    const fullLine = label + ' ' + totalStr;
    text += DLINE;
    text += CENTER + DOUBLE_ON + BOLD_ON;
    if (fullLine.length <= DOUBLE_COLS) {
      const dPad = Math.max(1, DOUBLE_COLS - label.length - totalStr.length);
      text += label + ' '.repeat(dPad) + totalStr + '\n';
    } else {
      text += label + '\n';
      text += totalStr + '\n';
    }
    text += BOLD_OFF + DOUBLE_OFF + LEFT;

    if (type === 'RECEIPT' && montantRecu !== undefined && montantRecu > 0) {
      const recuStr = fmtNum(montantRecu) + ' FCFA';
      const recuLabel = 'RECU:';
      const recuPad = Math.max(1, COLS - recuLabel.length - recuStr.length);
      text += recuLabel + ' '.repeat(recuPad) + recuStr + '\n';
    }

    if (type === 'RECEIPT' && monnaie !== undefined && monnaie > 0) {
      const monnaieStr = fmtNum(monnaie) + ' FCFA';
      const monnaieLabel = 'MONNAIE:';
      const monnaieFull = monnaieLabel + ' ' + monnaieStr;
      if (monnaieFull.length <= COLS) {
        const mPad = Math.max(1, COLS - monnaieLabel.length - monnaieStr.length);
        text += BOLD_ON + monnaieLabel + ' '.repeat(mPad) + monnaieStr + BOLD_OFF + '\n';
      } else {
        text += BOLD_ON + monnaieLabel + '\n' + monnaieStr + BOLD_OFF + '\n';
      }
    }

    text += LINE;
  }

  if (!isOrderTicket) {
    text += CENTER + 'Merci de votre confiance\n';
  }
  text += CUT;
  return text;
}

export async function generateCancelPayloadText(
  _printer: Printer,
  tableNom: string,
  ticketNumber: string,
  items: PrintLineItem[]
): Promise<string> {
  const restaurant = await getRestaurantInfo();
  const ESC = '\x1B';
  const INIT = ESC + '\x40';
  const BOLD_ON = ESC + '\x45\x01';
  const BOLD_OFF = ESC + '\x45\x00';
  const SMALL_ON = ESC + '\x21\x01';
  const SMALL_OFF = ESC + '\x21\x00';
  const DOUBLE_ON = ESC + '\x21\x30';
  const DOUBLE_OFF = ESC + '\x21\x00';
  const CENTER = ESC + '\x61\x01';
  const LEFT = ESC + '\x61\x00';
  const CUT = '\x1D\x56\x42\x00';
  const COLS = 48;
  const LINE = '-'.repeat(COLS) + '\n';
  const DLINE = '='.repeat(COLS) + '\n';

  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  });

  let text = INIT;
  text += CENTER;
  text += DOUBLE_ON + BOLD_ON + '!! ANNULATION !!\n' + BOLD_OFF + DOUBLE_OFF;
  text += restaurant.name + '\n';
  text += DLINE;
  text += LEFT;
  text += `Table: ${tableNom}\n`;
  text += `Ticket: ${ticketNumber}\n`;
  text += `Heure: ${now}\n`;
  text += LINE;
  text += BOLD_ON + 'ARTICLES ANNULES:\n' + BOLD_OFF;
  for (const item of items) {
    text += `  - ${item.qty}x ${item.nom}\n`;
    if (item.options && item.options.length > 0) {
      text += `    (${item.options.join(', ')})\n`;
    }
  }
  text += LINE;
  text += CENTER + 'Validation responsable requise\n';
  text += CUT;
  return text;
}

async function resolveRouting(
  _productId: string,
  categoryId: string
): Promise<{ printer: Printer; station: PrintStation } | null> {
  return resolveCatPrinter(categoryId);
}

function resolveRoutingSync(
  _productId: string,
  categoryId: string
): { printer: Printer; station: PrintStation } | null {
  return resolveCatPrinterSync(categoryId);
}

export async function buildPrintGroupsFromCart(
  cart: CartItem[]
): Promise<{ groups: PrintGroup[]; missingCategories: string[] }> {
  await loadCatPrinterCache();

  const missingCategories: string[] = [];
  const groupMap = new Map<string, PrintGroup>();

  for (const item of cart) {
    const routing = resolveRoutingSync(item.product.id, item.product.category_id);
    if (!routing) {
      const nomCat = item.product.category_id || 'Categorie inconnue';
      if (!missingCategories.includes(nomCat)) missingCategories.push(nomCat);
      continue;
    }

    const { printer, station } = routing;
    if (!groupMap.has(printer.id)) {
      groupMap.set(printer.id, { printer, printerType: printer.type, station, items: [] });
    }

    const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
    const varTotal = Object.values(item.selectedVariants || {}).reduce((s, v) => s + v.prix_delta, 0);
    const variantNames = Object.values(item.selectedVariants || {}).map(v => v.nom);
    const optionNames = item.selectedOptions.map(o => o.nom);
    const allOptionNames = [...variantNames, ...optionNames];
    const lineItem: PrintLineItem = {
      nom: item.product.nom,
      qty: item.qty,
      notes: item.notes || undefined,
      options: allOptionNames.length > 0 ? allOptionNames : undefined,
      unitPrice: item.product.prix + optTotal + varTotal,
    };

    groupMap.get(printer.id)!.items.push(lineItem);
  }

  return { groups: Array.from(groupMap.values()), missingCategories };
}

export async function buildPrintGroupsFromOrderItems(
  orderId: string,
  onlyUnprinted = false
): Promise<{ groups: PrintGroup[]; missingCategories: string[] }> {
  const { data: items } = await supabase
    .from('order_items')
    .select('*, options:order_item_options(*)')
    .eq('order_id', orderId);

  if (!items || items.length === 0) return { groups: [], missingCategories: [] };

  const missingCategories: string[] = [];
  const groupMap = new Map<string, PrintGroup>();

  for (const item of items) {
    const printQty = onlyUnprinted ? item.qty - item.printed_qty : item.qty;
    if (printQty <= 0) continue;

    const routing = await resolveRouting(item.product_id, item.category_id || '');
    if (!routing) {
      const nomCat = 'Catégorie inconnue';
      if (!missingCategories.includes(nomCat)) missingCategories.push(nomCat);
      continue;
    }

    const { printer, station } = routing;
    if (!groupMap.has(printer.id)) {
      groupMap.set(printer.id, { printer, printerType: printer.type, station, items: [] });
    }

    const lineItem: PrintLineItem = {
      orderItemId: item.id,
      nom: item.nom_snapshot,
      qty: printQty,
      notes: item.notes || undefined,
      options: item.options?.length > 0 ? item.options.map((o: any) => o.nom_snapshot) : undefined,
      unitPrice: item.prix_snapshot,
    };

    groupMap.get(printer.id)!.items.push(lineItem);
  }

  return { groups: Array.from(groupMap.values()), missingCategories };
}

export async function buildBillPrintGroup(
  orderId: string,
  _tableNom: string
): Promise<{ group: PrintGroup | null; error?: string }> {
  const { data: caissePrinter } = await supabase
    .from('printers')
    .select('*')
    .eq('type', 'CAISSE')
    .eq('active', true)
    .maybeSingle();

  if (!caissePrinter) {
    return { group: null, error: 'Aucune imprimante Caisse active trouvée' };
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*, options:order_item_options(*)')
    .eq('order_id', orderId);

  if (!items || items.length === 0) {
    return { group: null, error: 'Aucun article dans la commande' };
  }

  const group: PrintGroup = {
    printer: caissePrinter as Printer,
    printerType: 'CAISSE',
    station: 'cashier',
    items: items.map(item => {
      const optionsDelta = (item.options || []).reduce((s: number, o: any) => s + (o.prix_delta_snapshot || 0), 0);
      return {
        orderItemId: item.id,
        nom: item.nom_snapshot,
        qty: item.qty,
        notes: item.notes || undefined,
        options: item.options?.length > 0 ? item.options.map((o: any) => o.nom_snapshot) : undefined,
        unitPrice: item.prix_snapshot + optionsDelta,
      };
    }),
  };

  return { group };
}

export async function createPrintJobs(
  groups: PrintGroup[],
  ctx: PrintContext,
  waitForCashier = false
): Promise<string[]> {
  if (groups.length === 0) return [];

  const now = Date.now();
  const rowsWithPrinter = await Promise.all(groups.map(async (group, i) => ({
    row: {
      order_id: ctx.orderId || null,
      printer_id: group.printer.id,
      table_id: ctx.tableId || null,
      type: ctx.type,
      content_summary: group.items.map(it => `${it.qty}x ${it.nom}`).join(', '),
      payload_text: encodePayload(await generateTicketHTML(group, ctx.tableNom, ctx.ticketNumber, ctx.type, ctx.total, ctx.montantRecu, ctx.monnaie, ctx.paymentMethod)),
      status: waitForCashier ? 'WAITING_CASHIER' : 'PENDING',
      station: group.station || stationFromPrinterType(group.printer.type),
      retries: 0,
      created_by: ctx.userId || null,
      client_request_id: `${ctx.orderId || 'direct'}-${group.printer.id}-${ctx.type}-${now + i}`,
    },
    printer: group.printer,
  })));

  const rows = rowsWithPrinter.map(r => r.row);
  const { data: jobs } = await supabase.from('print_jobs').insert(rows).select('id');
  const jobIds = (jobs || []).map(j => j.id);

  if (!waitForCashier && jobIds.length > 0) {
    const dispatches = jobIds.flatMap((id, i) => {
      const printer = rowsWithPrinter[i].printer;
      return [dispatchJobImmediately(
        id,
        printer,
        rowsWithPrinter[i].row.payload_text,
        groups[i],
        { tableNom: ctx.tableNom, ticketNumber: ctx.ticketNumber, type: ctx.type, total: ctx.total },
      )];
    });
    await Promise.all(dispatches).catch(() => {});
  }

  return jobIds;
}

export async function retryPendingPrintJobs(): Promise<void> {
  const { data: jobs } = await supabase
    .from('print_jobs')
    .select('id, order_id, type, payload_text, printer:printers(*), order:orders(ticket_number, total, table:tables(nom))')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(20);

  for (const job of jobs || []) {
    const printer = (job as any).printer as Printer | null;
    if (!printer) continue;
    if (printer.connection_type === 'NETWORK' && job.order_id) {
      const order = (job as any).order;
      const { groups } = await buildPrintGroupsFromOrderItems(job.order_id, job.type === 'ADDONS');
      const group = groups.find(candidate => candidate.printer.id === printer.id);
      if (group) {
        await dispatchJobImmediately(job.id, printer, job.payload_text || '', group, {
          tableNom: order?.table?.nom || 'Table',
          ticketNumber: order?.ticket_number || '',
          type: job.type,
          total: order?.total || 0,
        });
      }
    } else {
      await dispatchJobImmediately(job.id, printer, job.payload_text || '');
    }
  }
}

export async function releaseWaitingJobs(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return;

  const { data: jobs } = await supabase
    .from('print_jobs')
    .select('*, printer:printers(*)')
    .in('id', jobIds)
    .eq('status', 'WAITING_CASHIER');

  if (!jobs || jobs.length === 0) return;

  await supabase
    .from('print_jobs')
    .update({ status: 'PENDING' })
    .in('id', jobIds)
    .eq('status', 'WAITING_CASHIER');

  const dispatches = jobs.flatMap(job => {
    const printer = (job as any).printer as Printer | null;
    if (!printer) return [];
    return [dispatchJobImmediately(job.id, printer, job.payload_text || '')];
  });
  await Promise.all(dispatches).catch(() => {});
}

export async function logPrintJobs(
  groups: PrintGroup[],
  ctx: PrintContext,
): Promise<void> {
  await createPrintJobs(groups, ctx);
}

export interface DispatchResult {
  orderId: string;
  ticketNumber: string;
  jobIds: string[];
  missingCategories: string[];
  isNew: boolean;
  stations: PrintStation[];
}

export async function dispatchOrderPrint(params: {
  cart: CartItem[];
  tableId: string;
  tableNom: string;
  userId: string;
  existingOrderId?: string;
  existingTicketNumber?: string;
  existingTotal?: number;
  type: 'INITIAL' | 'ADDONS';
  waitForCashier?: boolean;
}): Promise<DispatchResult> {
  const { cart, tableId, tableNom, userId, type } = params;

  const [routingResult, existingOrderRes] = await Promise.all([
    buildPrintGroupsFromCart(cart),
    params.existingOrderId
      ? Promise.resolve(null)
      : supabase
          .from('orders')
          .select('id, ticket_number, total')
          .eq('table_id', tableId)
          .in('statut', ['BROUILLON', 'VALIDE'])
          .maybeSingle(),
  ]);

  const { groups, missingCategories } = routingResult;
  if (missingCategories.length > 0) {
    return { orderId: '', ticketNumber: '', jobIds: [], missingCategories, isNew: false, stations: [] };
  }
  const stations = Array.from(new Set(groups.map(g => g.station || stationFromPrinterType(g.printer.type))));

  let orderId = params.existingOrderId || '';
  let ticketNumber = params.existingTicketNumber || '';
  let isNew = false;

  const cartTotal = cart.reduce((sum, item) => {
    const optTotal = item.selectedOptions.reduce((s, o) => s + o.prix_delta, 0);
    const varTotal = Object.values(item.selectedVariants || {}).reduce((s, v) => s + v.prix_delta, 0);
    return sum + (item.product.prix + optTotal + varTotal) * item.qty;
  }, 0);

  if (!orderId) {
    const existing = existingOrderRes?.data;
    if (existing) {
      orderId = existing.id;
      ticketNumber = existing.ticket_number;
      await supabase.from('orders').update({
        total: (existing.total || 0) + cartTotal,
        statut: 'VALIDE',
        updated_at: new Date().toISOString(),
      }).eq('id', orderId);
    } else {
      const { data: newOrder, error: orderError } = await supabase.from('orders').insert({
        table_id: tableId,
        serveur_id: userId,
        statut: 'VALIDE',
        total: cartTotal,
      }).select().single();
      if (orderError || !newOrder) {
        console.error('Failed to create order:', orderError);
        return { orderId: '', ticketNumber: '', jobIds: [], missingCategories: ['Erreur création commande'], isNew: false, stations: [] };
      }
      orderId = newOrder.id;
      ticketNumber = newOrder.ticket_number;
      isNew = true;
    }
  }

  const { data: insertedItems } = await supabase.from('order_items').insert(
    cart.map(item => ({
      order_id: orderId,
      product_id: item.product.id,
      nom_snapshot: item.product.nom,
      prix_snapshot: item.product.prix,
      qty: item.qty,
      printed_qty: params.waitForCashier ? 0 : item.qty,
      notes: item.notes,
    }))
  ).select();

  const optionsInsertPromise = (async () => {
    if (!insertedItems) return;
    const allOptions: { order_item_id: string; nom_snapshot: string; prix_delta_snapshot: number }[] = [];
    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      const orderItem = insertedItems[i];
      if (!orderItem) continue;
      for (const o of item.selectedOptions) {
        allOptions.push({ order_item_id: orderItem.id, nom_snapshot: o.nom, prix_delta_snapshot: o.prix_delta });
      }
      for (const v of Object.values(item.selectedVariants || {})) {
        allOptions.push({ order_item_id: orderItem.id, nom_snapshot: v.nom, prix_delta_snapshot: v.prix_delta });
      }
    }
    if (allOptions.length > 0) {
      await supabase.from('order_item_options').insert(allOptions);
    }
  })();

  const [, , jobIds] = await Promise.all([
    supabase.from('tables').update({ statut: 'OCCUPEE' }).eq('id', tableId),
    optionsInsertPromise,
    createPrintJobs(groups, { orderId, tableId, tableNom, ticketNumber, userId, type }, params.waitForCashier ?? false),
  ]);

  return { orderId, ticketNumber, jobIds, missingCategories: [], isNew, stations };
}

export async function reprintOrder(
  orderId: string,
  tableNom: string,
  ticketNumber: string,
  userId: string,
  tableId?: string
): Promise<void> {
  const { groups } = await buildPrintGroupsFromOrderItems(orderId, false);
  if (groups.length === 0) return;

  await createPrintJobs(groups, {
    orderId,
    tableId: tableId || null,
    tableNom,
    ticketNumber,
    userId,
    type: 'INITIAL',
  });
}

export async function resendToKitchen(
  orderId: string,
  tableNom: string,
  ticketNumber: string,
  userId: string,
  tableId?: string
): Promise<void> {
  const { groups } = await buildPrintGroupsFromOrderItems(orderId, true);
  if (groups.length === 0) return;

  await createPrintJobs(groups, {
    orderId,
    tableId: tableId || null,
    tableNom,
    ticketNumber,
    userId,
    type: 'ADDONS',
  });

  const allItemIds = groups.flatMap(g => g.items.map(i => i.orderItemId).filter(Boolean) as string[]);
  await markItemsAsPrinted(allItemIds);
}

export async function updateOrderItemQuantity(orderItemId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc('update_order_item_quantity', {
    p_order_item_id: orderItemId,
    p_quantity: quantity,
  });
  if (error) throw error;
}

export async function cancelLastOrderItem(
  orderId: string,
  orderItemId: string,
  tableNom: string,
  ticketNumber: string,
  userId: string,
  tableId?: string
): Promise<void> {
  const { data: item } = await supabase
    .from('order_items')
    .select('*, options:order_item_options(*)')
    .eq('id', orderItemId)
    .maybeSingle();

  if (!item) return;

  const wasAlreadyPrinted = item.printed_qty > 0;
  await updateOrderItemQuantity(orderItemId, 0);

  if (wasAlreadyPrinted) {
    const { data: product } = await supabase
      .from('products')
      .select('category_id')
      .eq('id', item.product_id)
      .maybeSingle();

    if (product) {
      const routing = await resolveRouting(item.product_id, product.category_id);
      if (routing) {
        const cancelItems: PrintLineItem[] = [{
          orderItemId: item.id,
          nom: item.nom_snapshot,
          qty: item.qty,
          notes: item.notes || undefined,
          options: item.options?.map((o: any) => o.nom_snapshot),
          unitPrice: item.prix_snapshot,
        }];

        const cancelPayload = await generateCancelPayloadText(routing.printer, tableNom, ticketNumber, cancelItems);
        const cancelHtml = rawToHtml(cancelPayload);

        const { error: printJobError } = await supabase.from('print_jobs').insert({
          order_id: orderId,
          printer_id: routing.printer.id,
          table_id: tableId || null,
          type: 'INITIAL',
          content_summary: `ANNULATION: ${item.nom_snapshot}`,
          payload_text: encodePayload(cancelHtml),
          status: 'PENDING',
          station: routing.station,
          retries: 0,
          created_by: userId || null,
        });
        if (printJobError) throw printJobError;
      }
    }
  }
}

export async function markItemsAsPrinted(orderItemIds: string[]): Promise<void> {
  if (orderItemIds.length === 0) return;
  await supabase.rpc('mark_items_printed', { item_ids: orderItemIds });
}

export async function generateTicketHTML(
  group: PrintGroup,
  tableNom: string,
  ticketNumber: string,
  type: PrintJobType,
  total?: number,
  montantRecu?: number,
  monnaie?: number,
  paymentMethod?: PaymentMethod
): Promise<string> {
  const restaurant = await getRestaurantInfo();

  const typeLabel: Record<PrintJobType, string> = {
    INITIAL: 'BON DE COMMANDE',
    ADDONS: 'AJOUTS',
    BILL: 'ADDITION',
    RECEIPT: 'FACTURE',
    TEST: 'TEST IMPRESSION',
    REPORT_X: 'RAPPORT X',
    REPORT_Z: 'CLOTURE Z',
  };

  const now = new Date().toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  });

  const showPrices = type === 'BILL' || type === 'RECEIPT';
  const isOrderTicket = type === 'INITIAL';

  const merged = mergeItems(group.items);
  const htmlGrouped = groupByProductName(merged);

  const itemsHtml = htmlGrouped.map(entry => {
    if (entry.type === 'simple') {
      const item = entry.item;
      const lineTotal = item.unitPrice * item.qty;
      const optsStr = item.options && item.options.length > 0 ? item.options.join(', ') : '';
      return `<div class="item-row"><div class="item-name">${item.qty}x ${item.nom}${optsStr ? ` <span class="opts">(${optsStr})</span>` : ''}${item.notes ? `<span class="note">Note: ${item.notes}</span>` : ''}</div>${showPrices ? `<div class="item-price">${fmtNum(lineTotal)} FCFA</div>` : ''}</div>`;
    } else {
      const headerRow = `<div class="item-group-header">${entry.nom}</div>`;
      const variantRows = entry.items.map(item => {
        const variantLabel = item.options && item.options.length > 0 ? item.options.join(', ') : item.nom;
        const lineTotal = item.unitPrice * item.qty;
        const qtyStr = `${item.qty}x `;
        return `<div class="item-row variant-row"><div class="item-name">${qtyStr}${variantLabel}${item.notes ? `<span class="note">Note: ${item.notes}</span>` : ''}</div>${showPrices ? `<div class="item-price">${fmtNum(lineTotal)} FCFA</div>` : ''}</div>`;
      }).join('');
      return headerRow + variantRows;
    }
  }).join('');

  const itemsTotal = merged.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const computedTotal = (total && total > 0) ? total : itemsTotal;
  const isCashReceipt = type === 'RECEIPT' && montantRecu !== undefined && monnaie !== undefined && monnaie > 0;
  const monnaieHtml = isCashReceipt
    ? `<div class="monnaie-line"><span>MONNAIE</span><span>${fmtNum(monnaie)} FCFA</span></div>`
    : '';
  const paymentMethodHtml = (type === 'RECEIPT' && paymentMethod)
    ? `<div class="payment-method-line"><span>PAIEMENT</span><span>${(PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod).toUpperCase()}</span></div>`
    : '';
  const totalHtml = showPrices
    ? `<div class="total-block"><span class="total-label">TOTAL</span><span class="total-amount">${fmtNum(computedTotal)} FCFA</span></div>${paymentMethodHtml}${monnaieHtml}`
    : '';

  const companyInfoHtml = showPrices
    ? `<div class="contact-block">${[
        restaurant.address || '',
        restaurant.phone ? `Tel: ${restaurant.phone}` : '',
        restaurant.email || '',
      ].filter(Boolean).join('<br>')}</div>`
    : '';

  const showLogo = (showPrices || type === 'TEST') && restaurant.logo_data_url;
  const logoHtml = showLogo
    ? `<img class="logo" src="${restaurant.logo_data_url}" alt="logo" onload="this.style.opacity=1">`
    : '';

  const orderHeaderHtml = isOrderTicket
    ? `<div class="header order-ticket-header"><div class="badge order-ticket-badge">${orderTicketTitle(group, type)}</div>${tableNom ? `<div class="order-ticket-table">TABLE ${tableNom}</div>` : ''}</div>`
    : '';
  const fullHeaderHtml = !isOrderTicket
    ? `<div class="header">${logoHtml}${companyInfoHtml}<div class="badge">${typeLabel[type]}</div></div>
  ${(showPrices || type === 'TEST') ? `<div class="info-line">Table ${tableNom} · Ticket ${ticketNumber} · ${now}</div><hr class="sep">` : '<hr class="sep">'}`
    : '';
  const footerHtml = !isOrderTicket
    ? `<div class="footer"><div class="footer-msg">Merci de votre confiance</div></div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-weight: bold; font-size: 13px; line-height: 1.3; width: 80mm; max-width: 80mm; margin: 0; padding: 0 2px 2px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { text-align: center; margin-bottom: 0; padding-top: 0; padding-bottom: 2px; border-bottom: 2px dashed #000; }
  .logo { max-height: 130px; max-width: 92%; width: auto; height: auto; display: block; margin: 0 auto 0; object-fit: contain; }
  .contact-block { font-size: 12.5px; font-weight: bold; line-height: 1.2; margin: 0 0 3px; color: #000; text-align: center; width: 100%; }
  .badge { display: inline-block; border: 2px solid #000; font-size: 11.5px; padding: 1px 8px; margin: 2px 0 2px; letter-spacing: 1px; }
  .info-line { text-align: center; font-size: 10.5px; margin: 1px 0 0; font-weight: normal; }
  .sep { border: none; border-top: 1px dashed #000; margin: 1px 0; }
  .item-row { display: flex; justify-content: space-between; align-items: baseline; gap: 4px; padding: 0; }
  .variant-row { padding-left: 10px; }
  .item-name { flex: 1; min-width: 0; white-space: normal; overflow-wrap: break-word; word-break: break-word; }
  .item-name .opts { font-weight: normal; font-size: 11px; }
  .item-name .note { font-weight: normal; font-size: 11px; display: block; }
  .item-price { white-space: nowrap; text-align: right; }
  .item-group-header { padding: 1px 0 0 0; text-transform: uppercase; }
  .total-block { margin-top: 2px; border-top: 2px solid #000; padding-top: 2px; display: flex; justify-content: space-between; align-items: baseline; }
  .total-label { font-size: 14px; }
  .total-amount { font-size: 15px; }
  .payment-method-line { font-size: 12px; margin-top: 1px; display: flex; justify-content: space-between; }
  .monnaie-line { font-size: 13px; margin-top: 1px; border-top: 1px dashed #000; padding-top: 1px; display: flex; justify-content: space-between; }
  .footer { margin-top: 3px; text-align: center; font-size: 10.5px; font-weight: normal; border-top: 1px dashed #000; padding-top: 3px; }
  .footer-msg { letter-spacing: 0.5px; }
  .order-ticket-header { border-bottom: 3px solid #000; padding-bottom: 3px; margin-bottom: 3px; text-align: center; }
  .order-ticket-badge { font-size: 18px; padding: 4px 12px; letter-spacing: 2px; border-width: 3px; margin: 2px 0; }
  .order-ticket-table { font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 3px 0 1px; }
  .order-ticket .item-name { font-size: 16px; line-height: 1.3; }
  .order-ticket .item-name .opts { font-size: 14px; }
  .order-ticket .item-name .note { font-size: 14px; }
  .order-ticket .item-group-header { font-size: 16px; margin-top: 4px; }
  .order-ticket .variant-row { padding-left: 16px; }
  .order-ticket .item-row { padding: 2px 0; }
  @media print {
    @page { margin: 0mm; size: 80mm auto; }
    html, body { width: 80mm; margin: 0; padding: 0; }
  }
</style>
</head>
<body>
  <div class="${isOrderTicket ? 'order-ticket' : ''}">
  ${orderHeaderHtml}${fullHeaderHtml}
  <div class="items-list">${itemsHtml}</div>
  ${totalHtml}
  ${footerHtml}
  </div>
</body>
</html>`;
}

export function triggerBrowserPrint(htmlContent: string, printerId: string = 'default', onAfterPrint?: () => void): Promise<void> {
  const queue = getPrinterQueue(printerId);
  const next = queue.then(() => new Promise<void>((resolve) => {
    const iframeId = `restobar-print-iframe-${printerId}`;
    const existing = document.getElementById(iframeId);
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:1px;height:1px;border:none;opacity:0;';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); resolve(); return; }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
        onAfterPrint?.();
        resolve();
      }, 100);
    };

    const contentWindow = iframe.contentWindow;
    if (!contentWindow) { iframe.remove(); resolve(); return; }

    contentWindow.onafterprint = cleanup;
    setTimeout(() => {
      try { contentWindow.focus(); contentWindow.print(); }
      catch { cleanup(); }
    }, 150);
  }));
  _printerQueues.set(printerId, next);
  return next;
}
