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

function strBytes(s: string): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(s);
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
    await connectedDevice.transferOut(connectedEndpoint, data);
    return true;
  } catch {
    connectedDevice = null;
    return false;
  }
}

// ─── Test ticket ───

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

function dashedLine(width = 32): Uint8Array {
  return strBytes('-'.repeat(width) + '\n');
}

function solidLine(width = 32): Uint8Array {
  return strBytes('='.repeat(width) + '\n');
}

function padLine(left: string, right: string, width = 32): string {
  const space = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(space) + right + '\n';
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

  // Items
  for (const item of data.items) {
    parts.push(
      BOLD_ON,
      DOUBLE_ON,
      line(`${item.quantity}x ${item.product_name}`),
      DOUBLE_OFF,
      BOLD_OFF,
    );
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
  const sym = settings.currency_symbol;
  const fmt = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${sym}`;

  const dateObj = new Date(data.createdAt);
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const parts: Uint8Array[] = [INIT, CENTER];

  // Restaurant header
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
  parts.push(LEFT, solidLine());

  // Meta
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

  // Column header
  parts.push(strBytes(padLine('Qté  Designation', 'Total'), dashedLine()));

  // Items
  for (const item of data.items) {
    const name = `${item.quantity}x  ${item.product_name}`;
    parts.push(strBytes(padLine(name, fmtNum(item.subtotal))));
    if (item.variant_label) {
      parts.push(strBytes(`  [${item.variant_label}]\n`));
    }
    if (item.sauces && item.sauces.length > 0) {
      parts.push(strBytes(`  > Sauces: ${item.sauces.map(s => s.name).join(', ')}\n`));
    }
    if (item.flavors && item.flavors.length > 0) {
      parts.push(strBytes(`  > Gouts: ${item.flavors.map(f => f.name).join(', ')}\n`));
    }
  }

  // Totals
  parts.push(dashedLine());
  if (data.discountAmount > 0) {
    parts.push(strBytes(padLine('Sous-total', fmt(data.subtotal))));
    parts.push(strBytes(padLine('Remise', `- ${fmt(data.discountAmount)}`)));
  }
  parts.push(strBytes(padLine(`TVA (${settings.tax_rate}%)`, fmt(data.taxAmount))));
  parts.push(solidLine(), BOLD_ON, DOUBLE_ON, strBytes(padLine('TOTAL', fmt(data.total))), DOUBLE_OFF, BOLD_OFF, solidLine());

  // Payments
  parts.push(BOLD_ON, line('MODE DE REGLEMENT'), BOLD_OFF);
  for (const p of data.payments) {
    parts.push(strBytes(padLine(`${paymentMethodLabels[p.method] ?? p.method}:`, fmt(p.amount))));
  }
  parts.push(dashedLine());

  // Footer
  parts.push(CENTER, line(settings.receipt_footer || 'Merci de votre visite!'), line('A bientot.'), LEFT);

  parts.push(FEED(5), CUT);
  return concat(...parts);
}

function fmtNum(n: number): string {
  return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
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
