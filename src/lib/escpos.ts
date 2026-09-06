/**
 * ESC/POS thermal printer utility for Epson USB printers via WebUSB.
 * Sends raw ESC/POS commands directly — no print dialog, silent printing.
 */

// ─── ESC/POS command bytes ───

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const INIT = new Uint8Array([ESC, 0x40]);
const FEED = (n: number) => new Uint8Array([ESC, 0x64, n]);
// Full cut (GS V 0) — supported by all Epson TM-series. Partial cut (GS V 1)
// is silently ignored by many models, so we default to full cut.
const CUT = new Uint8Array([GS, 0x56, 0x00]);
const FULL_CUT = new Uint8Array([GS, 0x56, 0x00]);

// Text styles
const BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);
const DOUBLE_ON = new Uint8Array([GS, 0x21, 0x11]); // double width + height
const DOUBLE_OFF = new Uint8Array([GS, 0x21, 0x00]);
const LARGE_ON = new Uint8Array([GS, 0x21, 0x22]); // larger
const LARGE_OFF = new Uint8Array([GS, 0x21, 0x00]);
const CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const RIGHT = new Uint8Array([ESC, 0x61, 0x02]);

// ─── Byte helpers ───

function printerSafeText(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u20ac/g, 'EUR');

  let out = '';
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code === 0x0a || code === 0x0d) { out += ch; continue; }
    if (code === 0xa0 || code === 0x202f || code === 0x2009 || code === 0x2007) { out += ' '; continue; }
    if (code >= 0x20 && code <= 0x7e) { out += ch; continue; }
    out += '?';
  }
  return out;
}

function strBytes(s: string): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(printerSafeText(s));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// ─── WebUSB printer connection ───

export interface ConnectResult {
  ok: boolean;
  error?: string;
}

let connectedDevice: USBDevice | null = null;
let connectedEndpoint: number = 1;
let connectedInterface: number = 0;

export function isWebUSBSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

export function isPrinterConnected(): boolean {
  return connectedDevice !== null;
}

function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found|no device|cancelled|aborted/i.test(msg)) return 'Aucune imprimante sélectionnée';
  if (/access|denied|busy|claim/i.test(msg)) return 'L\'imprimante est déjà utilisée par le pilote Windows';
  if (/configuration|interface/i.test(msg)) return 'Impossible d\'accéder au port d\'impression de l\'imprimante';
  return msg || 'Erreur inconnue';
}

export async function requestPrinter(): Promise<ConnectResult> {
  if (!isWebUSBSupported()) return { ok: false, error: 'WebUSB non supporté par ce navigateur' };
  try {
    const device = await navigator.usb.requestDevice({ filters: [] });
    return await openDevice(device);
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  }
}

export async function reconnectPrinter(): Promise<boolean> {
  if (!isWebUSBSupported()) return false;
  try {
    const devices = await navigator.usb.getDevices();
    for (const device of devices) {
      const r = await openDevice(device);
      if (r.ok) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function openDevice(device: USBDevice): Promise<ConnectResult> {
  try {
    if (!device.opened) await device.open();

    // Try every configuration the device exposes
    const configs = device.configurations.length > 0 ? device.configurations : [null];
    for (const cfg of configs) {
      if (cfg && (!device.configuration || device.configuration.configurationValue !== cfg.configurationValue)) {
        try { await device.selectConfiguration(cfg.configurationValue); } catch { /* keep trying */ }
      }
      const activeConfig = device.configuration ?? cfg;
      const interfaces = activeConfig?.interfaces ?? [];
      for (const iface of interfaces) {
        for (const alt of iface.alternates) {
          const outEp = alt.endpoints?.find(e => e.direction === 'out');
          if (!outEp) continue;
          try {
            await device.claimInterface(iface.interfaceNumber);
            connectedInterface = iface.interfaceNumber;
            connectedEndpoint = outEp.endpointNumber;
            connectedDevice = device;
            return { ok: true };
          } catch {
            // interface may be claimed by another driver — try the next
          }
        }
      }
    }
    return { ok: false, error: 'Aucun canal d\'écriture trouvé. Le pilote Windows occupe peut-être l\'imprimante.' };
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  }
}

export async function disconnectPrinter(): Promise<void> {
  if (connectedDevice) {
    try {
      await connectedDevice.releaseInterface(connectedInterface);
    } catch { /* ignore */ }
    try {
      await connectedDevice.close();
    } catch { /* ignore */ }
    connectedDevice = null;
  }
}

async function sendBytes(data: Uint8Array): Promise<boolean> {
  if (!connectedDevice) {
    const reconnected = await reconnectPrinter();
    if (!reconnected) return false;
  }
  if (!connectedDevice) return false;
  try {
    const result = await connectedDevice.transferOut(connectedEndpoint, data);
    if (result.status !== 'ok') {
      console.warn('[escpos] transferOut status:', result.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[escpos] transferOut failed:', err);
    connectedDevice = null;
    return false;
  }
}

// ─── Test ticket ───

export async function openCashDrawer(): Promise<boolean> {
  // Try connector m=0 (DK-1) with a 100ms pulse, then m=1 (DK-2) as fallback.
  const DRAWER_KICK_1 = concat(INIT, new Uint8Array([ESC, 0x70, 0x00, 0x32, 0xff]));
  const DRAWER_KICK_2 = concat(INIT, new Uint8Array([ESC, 0x70, 0x01, 0x32, 0xff]));

  const ok1 = await sendBytes(DRAWER_KICK_1);
  if (ok1) return true;
  return sendBytes(DRAWER_KICK_2);
}

export async function printTestTicket(restaurantName: string): Promise<boolean> {
  const parts: Uint8Array[] = [
    INIT,
    CENTER,
    BOLD_ON,
    LARGE_ON,
    line(restaurantName.toUpperCase() || 'TEST IMPRESSION'),
    LARGE_OFF,
    BOLD_OFF,
    LEFT,
    dashedLine(),
    line('Ticket de test'),
    line(new Date().toLocaleString('fr-FR')),
    line('Si vous lisez ce texte,'),
    line('l\'imprimante fonctionne.'),
    dashedLine(),
    FEED(5),
    CUT,
  ];
  return sendBytes(concat(...parts));
}

// ─── Line / text builders ───

function line(text: string): Uint8Array {
  return strBytes(text + '\n');
}

function dashedLine(width = RECEIPT_WIDTH): Uint8Array {
  return strBytes('-'.repeat(width) + '\n');
}

function solidLine(width = RECEIPT_WIDTH): Uint8Array {
  return strBytes('='.repeat(width) + '\n');
}

const RECEIPT_WIDTH = 42;
const RECEIPT_QTY_WIDTH = 4;
const RECEIPT_DESCRIPTION_WIDTH = 16;
const RECEIPT_UNIT_WIDTH = 10;
const RECEIPT_TOTAL_WIDTH = 12;

function fitText(text: string, width: number): string {
  return printerSafeText(text).slice(0, width);
}

function padLine(left: string, right: string, width = RECEIPT_WIDTH): string {
  const safeLeft = fitText(left, width);
  const safeRight = fitText(right, width);
  const space = Math.max(1, width - safeLeft.length - safeRight.length);
  return safeLeft + ' '.repeat(space) + safeRight + '\n';
}

function padColumns(qty: string, description: string, unit: string, total: string): string {
  return `${fitText(qty, RECEIPT_QTY_WIDTH).padEnd(RECEIPT_QTY_WIDTH)}${fitText(description, RECEIPT_DESCRIPTION_WIDTH).padEnd(RECEIPT_DESCRIPTION_WIDTH)}${fitText(unit, RECEIPT_UNIT_WIDTH).padStart(RECEIPT_UNIT_WIDTH)}${fitText(total, RECEIPT_TOTAL_WIDTH).padStart(RECEIPT_TOTAL_WIDTH)}\n`;
}

function wrapPrinterText(text: string, width: number): string[] {
  const words = printerSafeText(text).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.slice(0, width);
    } else if ((current.length + 1 + word.length) <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word.slice(0, width);
    }
  }
  if (current) lines.push(current);
  return lines;
}

// ─── Kitchen ticket (compact, no restaurant info) ───

export interface EscposKitchenData {
  createdAt: string;
  saleType: string;
  tableNumber?: string | number | null;
  customerName?: string | null;
  orderNotes?: string;
  items: {
    quantity: number;
    product_name: string;
    variant_label?: string | null;
    sauces?: { name: string }[] | null;
    flavors?: { name: string }[] | null;
    kitchen_note?: string | null;
  }[];
}

const saleTypeKitchenLabels: Record<string, string> = {
  dine_in: 'SUR PLACE',
  takeaway: 'A EMPORTER',
  delivery: 'VENTE DIRECTE',
};

export function buildKitchenTicketBytes(data: EscposKitchenData): Uint8Array {
  const dateObj = new Date(data.createdAt);
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const parts: Uint8Array[] = [
    INIT,
    CENTER,
    BOLD_ON,
    LARGE_ON,
    line('CUISINE'),
    LARGE_OFF,
    BOLD_OFF,
    LEFT,
  ];

  // Table or customer
  if (data.saleType === 'dine_in' && data.tableNumber) {
    parts.push(BOLD_ON, line(`Sur place n${data.tableNumber}`), BOLD_OFF);
  } else if (data.customerName) {
    parts.push(BOLD_ON, line(`${data.customerName}`), BOLD_OFF);
  }

  parts.push(line(timeStr), dashedLine());

  for (const item of data.items) {
    const nameLines = wrapPrinterText(item.product_name, 20);
    parts.push(
      BOLD_ON,
      DOUBLE_ON,
      line(`${item.quantity}x ${nameLines[0]}`),
      DOUBLE_OFF,
      BOLD_OFF,
    );
    for (const nameLine of nameLines.slice(1)) {
      parts.push(line(`   ${nameLine}`));
    }
    if (item.variant_label) {
      parts.push(strBytes(`  > ${item.variant_label}\n`));
    }
    if (item.sauces && item.sauces.length > 0) {
      parts.push(strBytes(`  > Sauces: ${item.sauces.map(s => s.name).join(', ')}\n`));
    }
    if (item.flavors && item.flavors.length > 0) {
      parts.push(strBytes(`  > Gouts: ${item.flavors.map(f => f.name).join(', ')}\n`));
    }
    if (item.kitchen_note) {
      parts.push(BOLD_ON, strBytes(`  >> ${item.kitchen_note}\n`), BOLD_OFF);
    }
  }

  if (data.orderNotes && data.orderNotes.trim()) {
    parts.push(dashedLine(), BOLD_ON, line('NOTE:'), line(data.orderNotes), BOLD_OFF);
  }

  parts.push(FEED(5), CUT);
  return concat(...parts);
}

// ─── Customer receipt ticket ───

export interface EscposReceiptData {
  saleNumber: string;
  createdAt: string;
  saleType: string;
  tableNumber?: string | number | null;
  cashierName?: string | null;
  customerName?: string | null;
  items: {
    quantity: number;
    product_name: string;
    unit_price: number;
    subtotal: number;
    variant_label?: string | null;
    sauces?: { name: string; price_supplement?: number }[] | null;
    flavors?: { name: string }[] | null;
  }[];
  payments: { method: string; amount: number }[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

export interface EscposReceiptSettings {
  restaurant_name: string;
  legal_form?: string;
  capital?: string;
  address?: string;
  phone?: string;
  vat_number?: string;
  siret?: string;
  tax_rate: number;
  currency_symbol: string;
  receipt_footer?: string;
}

const paymentMethodLabels: Record<string, string> = {
  cash: 'Especes',
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte',
};

const saleTypeReceiptLabels: Record<string, string> = {
  dine_in: 'Sur place',
  takeaway: 'Commandes client',
  delivery: 'Vente directe',
};

export function buildReceiptBytes(
  data: EscposReceiptData,
  settings: EscposReceiptSettings
): Uint8Array {
  const sym = printerSafeText(settings.currency_symbol);
  const fmtNumber = (n: number) => printerSafeText(n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }));
  const fmt = (n: number) => `${fmtNumber(n)} ${sym}`;

  const dateObj = new Date(data.createdAt);
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const parts: Uint8Array[] = [INIT, CENTER];

  parts.push(
    BOLD_ON,
    LARGE_ON,
    line(settings.restaurant_name.toUpperCase()),
    LARGE_OFF,
    BOLD_OFF,
  );
  if (settings.address) parts.push(line(settings.address));
  if (settings.phone) parts.push(line(`Tel: ${settings.phone}`));
  if (settings.vat_number) parts.push(line(`TVA: ${settings.vat_number}`));
  if (settings.siret) parts.push(line(`SIRET: ${settings.siret}`));
  parts.push(LEFT, solidLine(RECEIPT_WIDTH));

  parts.push(strBytes(padLine(`Ticket N: ${data.saleNumber}`, '')));
  parts.push(strBytes(padLine(`Date: ${dateStr}`, `Heure: ${timeStr}`)));
  if (data.tableNumber) {
    parts.push(strBytes(padLine(`Table: ${data.tableNumber}`, `Serveur: ${data.cashierName ?? 'N/A'}`)));
  } else {
    parts.push(strBytes(padLine('Serveur:', data.cashierName ?? 'N/A')));
  }
  if (data.customerName) parts.push(strBytes(padLine('Client:', data.customerName)));
  if (data.saleType !== 'dine_in') {
    parts.push(strBytes(padLine('Mode:', saleTypeReceiptLabels[data.saleType] ?? data.saleType)));
  }
  parts.push(dashedLine());
  parts.push(strBytes(padColumns('Qte', 'Designation', 'P.U.', 'Total')));
  parts.push(dashedLine());

  for (const item of data.items) {
    const nameLines = wrapPrinterText(item.product_name, RECEIPT_DESCRIPTION_WIDTH);
    parts.push(strBytes(padColumns(`${item.quantity}x`, nameLines[0], fmtNumber(item.unit_price), fmtNumber(item.subtotal))));
    for (const nameLine of nameLines.slice(1)) {
      parts.push(strBytes(padColumns('', nameLine, '', '')));
    }
    if (item.variant_label) {
      parts.push(strBytes(`  > ${printerSafeText(item.variant_label)}\n`));
    }
    if (item.sauces && item.sauces.length > 0) {
      parts.push(strBytes(`  > Sauces: ${item.sauces.map(s => printerSafeText(s.name)).join(', ')}\n`));
    }
    if (item.flavors && item.flavors.length > 0) {
      parts.push(strBytes(`  > Gouts: ${item.flavors.map(f => printerSafeText(f.name)).join(', ')}\n`));
    }
  }

  parts.push(dashedLine());
  if (data.discountAmount > 0) {
    parts.push(strBytes(padLine('Sous-total', fmt(data.subtotal))));
    parts.push(strBytes(padLine('Remise', `- ${fmt(data.discountAmount)}`)));
  }
  parts.push(strBytes(padLine(`TVA (${settings.tax_rate}%)`, fmt(data.taxAmount))));
  parts.push(solidLine(RECEIPT_WIDTH));
  parts.push(BOLD_ON, strBytes(padLine('TOTAL TTC', fmt(data.total))), BOLD_OFF);
  parts.push(solidLine(RECEIPT_WIDTH));

  parts.push(BOLD_ON, line('MODE DE REGLEMENT'), BOLD_OFF);
  for (const p of data.payments) {
    parts.push(strBytes(padLine(`${paymentMethodLabels[p.method] ?? p.method}:`, fmt(p.amount))));
  }
  parts.push(dashedLine());

  parts.push(CENTER, line(settings.receipt_footer || 'Merci de votre visite!'), line('A bientot.'), LEFT);
  parts.push(FEED(5), CUT);
  return concat(...parts);
}

function fmtNum(n: number): string {
  return printerSafeText(n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }));
}

// ─── Combined: kitchen + receipt with cut between ───

export function buildCombinedBytes(
  kitchen: EscposKitchenData,
  receipt: EscposReceiptData,
  settings: EscposReceiptSettings
): Uint8Array {
  const kitchenBytes = buildKitchenTicketBytes(kitchen);
  const receiptBytes = buildReceiptBytes(receipt, settings);
  return concat(kitchenBytes, receiptBytes);
}

// ─── Public print API ───

export async function printBytes(data: Uint8Array): Promise<boolean> {
  return sendBytes(data);
}

export async function printKitchenTicket(data: EscposKitchenData): Promise<boolean> {
  const bytes = buildKitchenTicketBytes(data);
  return sendBytes(bytes);
}

export async function printReceipt(
  data: EscposReceiptData,
  settings: EscposReceiptSettings
): Promise<boolean> {
  const bytes = buildReceiptBytes(data, settings);
  return sendBytes(bytes);
}

export async function printCombined(
  kitchen: EscposKitchenData,
  receipt: EscposReceiptData,
  settings: EscposReceiptSettings
): Promise<boolean> {
  const kitchenBytes = buildKitchenTicketBytes(kitchen);
  const receiptBytes = buildReceiptBytes(receipt, settings);
  const ok1 = await sendBytes(kitchenBytes);
  if (!ok1) return false;
  // Give the printer time to execute the cut before the next job starts.
  await new Promise(r => setTimeout(r, 700));
  return sendBytes(receiptBytes);
}

// ─── X Report (cash session closure) ───

export interface EscposXReportData {
  sessionNumber: number;
  openedAt: string;
  closedAt: string;
  cashierName: string;
  salesCount: number;
  totalSales: number;
  byMethod: {
    cash: number;
    wave: number;
    orange_money: number;
    card: number;
  };
  byCategory: { name: string; count: number; total: number }[];
  openingBalance: number;
  expectedCash: number;
  actualCash: number;
  cashDifference: number;
  notes?: string | null;
}

export interface EscposXReportSettings {
  restaurant_name: string;
  address: string;
  phone: string;
  vat_number?: string;
  siret?: string;
  currency_symbol: string;
}

export function buildXReportBytes(
  data: EscposXReportData,
  settings: EscposXReportSettings
): Uint8Array {
  const sym = printerSafeText(settings.currency_symbol);
  const fmtNumber = (n: number) =>
    printerSafeText(n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }));
  const fmtSigned = (n: number) => `${n >= 0 ? '+' : '-'}${fmtNumber(Math.abs(n))} ${sym}`;
  const fmt = (n: number) => `${fmtNumber(n)} ${sym}`;

  const openedAt = new Date(data.openedAt);
  const closedAt = new Date(data.closedAt);
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const parts: Uint8Array[] = [INIT, CENTER];

  parts.push(
    BOLD_ON,
    LARGE_ON,
    line(settings.restaurant_name.toUpperCase()),
    LARGE_OFF,
    BOLD_OFF,
  );
  if (settings.address) parts.push(line(settings.address));
  if (settings.phone) parts.push(line(`Tel: ${settings.phone}`));
  if (settings.vat_number) parts.push(line(`TVA: ${settings.vat_number}`));
  if (settings.siret) parts.push(line(`SIRET: ${settings.siret}`));

  parts.push(solidLine(RECEIPT_WIDTH));
  parts.push(BOLD_ON, DOUBLE_ON, line('X DE CAISSE'), DOUBLE_OFF, BOLD_OFF);
  parts.push(line(`Session N ${String(data.sessionNumber).padStart(4, '0')}`));
  parts.push(solidLine(RECEIPT_WIDTH));

  parts.push(LEFT);
  parts.push(strBytes(padLine('Date', fmtDate(openedAt))));
  parts.push(strBytes(padLine('Ouverture', fmtTime(openedAt))));
  parts.push(strBytes(padLine('Fermeture', fmtTime(closedAt))));
  parts.push(strBytes(padLine('Caissier', data.cashierName)));
  parts.push(dashedLine());

  parts.push(BOLD_ON, line('ACTIVITE'), BOLD_OFF);
  parts.push(strBytes(padLine('Nb de ventes', String(data.salesCount))));
  parts.push(BOLD_ON, strBytes(padLine('CA Total', fmt(data.totalSales))), BOLD_OFF);
  parts.push(dashedLine());

  parts.push(BOLD_ON, line('ENCAISSEMENTS'), BOLD_OFF);
  parts.push(strBytes(padLine('Especes', fmt(data.byMethod.cash))));
  parts.push(strBytes(padLine('Wave', fmt(data.byMethod.wave))));
  parts.push(strBytes(padLine('Orange Money', fmt(data.byMethod.orange_money))));
  parts.push(strBytes(padLine('Carte', fmt(data.byMethod.card))));
  const totalEncaisse =
    data.byMethod.cash + data.byMethod.wave + data.byMethod.orange_money + data.byMethod.card;
  parts.push(dashedLine());
  parts.push(BOLD_ON, strBytes(padLine('Total encaisse', fmt(totalEncaisse))), BOLD_OFF);
  parts.push(dashedLine());

  if (data.byCategory.length > 0) {
    parts.push(BOLD_ON, line('VENTES PAR CATEGORIE'), BOLD_OFF);
    for (const cat of data.byCategory) {
      parts.push(strBytes(padLine(`${cat.name} (${cat.count})`, fmt(cat.total))));
    }
    parts.push(dashedLine());
  }

  parts.push(BOLD_ON, line('COMPTAGE CAISSE'), BOLD_OFF);
  parts.push(strBytes(padLine('Fonds initial', fmt(data.openingBalance))));
  parts.push(strBytes(padLine('Especes attendues', fmt(data.expectedCash))));
  parts.push(strBytes(padLine('Especes comptees', fmt(data.actualCash))));
  parts.push(solidLine(RECEIPT_WIDTH));

  const diff = data.cashDifference;
  const diffLabel =
    diff === 0 ? 'CAISSE EQUILIBREE' : diff > 0 ? 'EXCEDENT' : 'MANQUE';
  parts.push(BOLD_ON, strBytes(padLine(diffLabel, fmtSigned(diff))), BOLD_OFF);
  parts.push(solidLine(RECEIPT_WIDTH));

  if (data.notes && data.notes.trim().length > 0) {
    parts.push(BOLD_ON, line('NOTES'), BOLD_OFF);
    const wrapped = wrapPrinterText(data.notes, RECEIPT_WIDTH);
    for (const l of wrapped) parts.push(line(l));
    parts.push(dashedLine());
  }

  parts.push(CENTER);
  parts.push(line(`Imprime le ${new Date().toLocaleString('fr-FR')}`));
  parts.push(line('Document a conserver'));
  parts.push(LEFT);
  parts.push(FEED(5), CUT);

  return concat(...parts);
}

export async function printXReport(
  data: EscposXReportData,
  settings: EscposXReportSettings
): Promise<boolean> {
  const bytes = buildXReportBytes(data, settings);
  return sendBytes(bytes);
}

// ─── Cancelled receipt ticket ───

export interface EscposCancelledReceiptData extends EscposReceiptData {
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

export function buildCancelledReceiptBytes(
  data: EscposCancelledReceiptData,
  settings: EscposReceiptSettings
): Uint8Array {
  const receiptBytes = buildReceiptBytes(data, settings);
  const bannerParts: Uint8Array[] = [
    INIT,
    CENTER,
    BOLD_ON,
    DOUBLE_ON,
    line('*** ANNULE ***'),
    DOUBLE_OFF,
    BOLD_OFF,
    LEFT,
  ];
  if (data.cancelReason) {
    bannerParts.push(BOLD_ON, line(`Motif: ${data.cancelReason}`), BOLD_OFF);
  }
  if (data.cancelledByName) {
    bannerParts.push(line(`Annule par: ${data.cancelledByName}`));
  }
  if (data.cancelledAt) {
    const cancelTime = new Date(data.cancelledAt).toLocaleString('fr-FR');
    bannerParts.push(line(`Le: ${cancelTime}`));
  }
  bannerParts.push(dashedLine());
  return concat(...bannerParts, receiptBytes);
}

export async function printCancelledReceipt(
  data: EscposCancelledReceiptData,
  settings: EscposReceiptSettings
): Promise<boolean> {
  const bytes = buildCancelledReceiptBytes(data, settings);
  return sendBytes(bytes);
}

// ─── Delivery ticket ───

export interface EscposDeliveryData {
  deliveryNumber: number;
  createdAt: string;
  customerName: string;
  customerPhone?: string | null;
  deliveryAddress: string;
  deliveryFee: number;
  notes?: string | null;
  driverName?: string | null;
  status: string;
}

export interface EscposDeliverySettings {
  restaurant_name: string;
  address?: string;
  phone?: string;
  currency_symbol: string;
}

export function buildDeliveryTicketBytes(
  data: EscposDeliveryData,
  settings: EscposDeliverySettings
): Uint8Array {
  const sym = printerSafeText(settings.currency_symbol);
  const fmtNumber = (n: number) => printerSafeText(n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }));
  const fmt = (n: number) => `${fmtNumber(n)} ${sym}`;

  const dateObj = new Date(data.createdAt);
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const statusLabels: Record<string, string> = {
    pending: 'EN ATTENTE DE PAIEMENT',
    assigned: 'ASSIGNEE',
    picked_up: 'EN ROUTE',
    delivered: 'LIVREE',
    cancelled: 'ANNULEE',
  };

  const parts: Uint8Array[] = [INIT, CENTER];

  parts.push(
    BOLD_ON,
    LARGE_ON,
    line(settings.restaurant_name.toUpperCase()),
    LARGE_OFF,
    BOLD_OFF,
  );
  if (settings.address) parts.push(line(settings.address));
  if (settings.phone) parts.push(line(`Tel: ${settings.phone}`));
  parts.push(LEFT, solidLine(RECEIPT_WIDTH));

  parts.push(BOLD_ON, DOUBLE_ON, line('BON DE LIVRAISON'), DOUBLE_OFF, BOLD_OFF);
  parts.push(line(`N: ${data.deliveryNumber}`));
  parts.push(line(`${dateStr} ${timeStr}`));
  parts.push(dashedLine());

  parts.push(BOLD_ON, line('CLIENT'), BOLD_OFF);
  parts.push(line(data.customerName));
  if (data.customerPhone) parts.push(line(`Tel: ${data.customerPhone}`));
  parts.push(dashedLine());

  parts.push(BOLD_ON, line('ADRESSE'), BOLD_OFF);
  const addrLines = wrapPrinterText(data.deliveryAddress, RECEIPT_WIDTH);
  for (const l of addrLines) parts.push(line(l));
  parts.push(dashedLine());

  if (data.driverName) {
    parts.push(strBytes(padLine('Livreur:', data.driverName)));
  }

  parts.push(strBytes(padLine('Statut:', statusLabels[data.status] ?? data.status)));
  parts.push(dashedLine());

  parts.push(BOLD_ON, strBytes(padLine('Frais de livraison:', fmt(data.deliveryFee))), BOLD_OFF);
  parts.push(solidLine(RECEIPT_WIDTH));

  if (data.notes && data.notes.trim()) {
    parts.push(BOLD_ON, line('NOTES'), BOLD_OFF);
    const noteLines = wrapPrinterText(data.notes, RECEIPT_WIDTH);
    for (const l of noteLines) parts.push(line(l));
    parts.push(dashedLine());
  }

  parts.push(CENTER, line('--- Bon de livraison ---'), LEFT);
  parts.push(FEED(5), CUT);
  return concat(...parts);
}

export async function printDeliveryTicket(
  data: EscposDeliveryData,
  settings: EscposDeliverySettings
): Promise<boolean> {
  const bytes = buildDeliveryTicketBytes(data, settings);
  return sendBytes(bytes);
}
