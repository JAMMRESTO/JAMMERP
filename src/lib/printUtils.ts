/**
 * Shared print utilities for WAARWI
 * All documents rendered here target pure black text, solid borders,
 * and professional layout suitable for A4 and 80mm thermal printers.
 */

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const fmtNum = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const fmtAmt = (n: number, sym: string) => `${fmtNum(n)}\u00a0${sym}`;

/** Base CSS injected in every print document */
export const BASE_PRINT_CSS = `
  @media (forced-colors: active) { * { forced-color-adjust: none !important; } }
  :root { color-scheme: only light; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    background: #fff !important;
    color: #000 !important;
    -webkit-text-fill-color: #000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
`;

/** CSS for 80mm thermal ticket documents */
export const THERMAL_CSS = `
  ${BASE_PRINT_CSS}
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    font-weight: 700;
    color: #000;
    background: #fff;
    width: 76mm;
    padding: 4px 4px 10px;
  }
  .sep  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .sep-solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  .center { text-align: center; }
  .name { font-family: Impact, 'Arial Narrow', sans-serif; font-size: 16px; letter-spacing: 1px; text-align: center; }
  .section-title { font-family: Impact, 'Arial Narrow', sans-serif; font-size: 11px; letter-spacing: 0.5px; margin: 3px 0 2px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 1px 0; font-size: 11px; font-weight: 700; }
  .row .lbl { flex: 1; }
  .row .val { font-weight: 700; text-align: right; white-space: nowrap; margin-left: 4px; }
  .total-row { font-family: Impact, 'Arial Narrow', sans-serif; font-size: 14px; letter-spacing: 0.5px; }
  .col-header { display: flex; font-size: 10px; font-weight: 700; padding: 2px 0; border-bottom: 2px solid #000; }
  .item-row { display: flex; font-size: 11px; font-weight: 700; padding: 2px 0; align-items: baseline; }
  .qty  { width: 28px; flex-shrink: 0; }
  .desc { flex: 1; min-width: 0; padding-right: 4px; }
  .pu   { width: 52px; text-align: right; flex-shrink: 0; margin-right: 8px; font-weight: 400; }
  .ttl  { width: 52px; text-align: right; flex-shrink: 0; }
  .item-sub { font-size: 10px; padding-left: 28px; font-weight: 700; }
  .banner { text-align: center; font-family: Impact, 'Arial Narrow', sans-serif; font-size: 12px; letter-spacing: 1px; font-weight: 700; background: #000; color: #fff; padding: 3px 0; margin: 4px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .footer { margin-top: 6px; font-size: 10px; text-align: center; }
  @media print { body { padding: 2px 2px 6px; } @page { margin: 2mm; size: 80mm auto; } }
`;

/** Shared A4 layout rules — used by both portrait and landscape variants. */
const A4_BODY_CSS = `
  ${BASE_PRINT_CSS}
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    color: #000;
    background: #fff;
    padding: 24px 28px 32px;
  }
  h1 { font-size: 16pt; font-weight: 700; color: #000; margin-bottom: 4px; }
  h2 { font-size: 13pt; font-weight: 700; color: #000; margin-bottom: 4px; }
  h3 { font-size: 11pt; font-weight: 700; color: #000; margin-bottom: 4px; }
  .subtitle { font-size: 10pt; color: #333; margin-bottom: 16px; }
  .sep { border: none; border-top: 1px solid #000; margin: 10px 0; }
  .sep-light { border: none; border-top: 1px dashed #555; margin: 6px 0; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-top: 8px;
    table-layout: fixed;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; }
  th {
    background: #f0f0f0 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border: 1px solid #000;
    padding: 5px 6px;
    font-weight: 700;
    text-align: left;
    font-size: 9.5pt;
    word-break: break-word;
  }
  td {
    border: 1px solid #555;
    padding: 4px 6px;
    font-size: 9.5pt;
    font-weight: 500;
    word-break: break-word;
    overflow-wrap: anywhere;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .stat-block { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat { border: 2px solid #000; padding: 8px 14px; min-width: 120px; }
  .stat-val { font-size: 16pt; font-weight: 800; color: #000; display: block; }
  .stat-lbl { font-size: 9pt; font-weight: 600; color: #333; display: block; margin-top: 2px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .bold { font-weight: 700; }
  .amount { font-weight: 700; font-size: 10pt; }
  .total-row td { font-weight: 700; border-top: 2px solid #000 !important; font-size: 10.5pt; background: #f7f7f7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc-footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid #000; font-size: 9pt; color: #333; display: flex; justify-content: space-between; }
`;

/** CSS for A4 portrait report documents */
export const A4_CSS = `
  ${A4_BODY_CSS}
  @media print { body { padding: 0; } @page { margin: 12mm 10mm; size: A4 portrait; } }
`;

/** CSS for A4 landscape report documents (wide tables) */
export const A4_CSS_LANDSCAPE = `
  ${A4_BODY_CSS}
  @media print { body { padding: 0; } @page { margin: 10mm 10mm; size: A4 landscape; } }
`;

/**
 * Print using a hidden iframe to avoid popup blocker.
 * Waits for iframe load then triggers window.print().
 */
export function printViaIframe(html: string, frameId = '__waarwi_print_frame__') {
  const existing = document.getElementById(frameId);
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = frameId;
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.onload = () => {
    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        // ignore
      }
      setTimeout(() => iframe.remove(), 2000);
    };
    setTimeout(triggerPrint, 50);
  };
}

/**
 * Print via Blob URL in a popup window.
 * Falls back gracefully if popup is blocked.
 */
export function printViaPopup(html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=520,height=750,toolbar=0,menubar=0,location=0,scrollbars=1');
  if (win) {
    win.onunload = () => URL.revokeObjectURL(url);
  } else {
    URL.revokeObjectURL(url);
  }
}

/** Build a standard thermal receipt header HTML */
export function buildThermalHeader(settings: {
  restaurant_name: string;
  legal_form?: string;
  capital?: string;
  address?: string;
  phone?: string;
  vat_number?: string;
  siret?: string;
}): string {
  const lines: string[] = [
    `<hr class="sep-solid">`,
    `<div class="name">${esc(settings.restaurant_name.toUpperCase())}</div>`,
  ];
  if (settings.legal_form || settings.capital) {
    lines.push(`<div class="center">${esc([settings.legal_form ?? '', settings.capital ? `Au capital de ${settings.capital}` : ''].filter(Boolean).join(' — '))}</div>`);
  }
  if (settings.address) lines.push(`<div class="center">${esc(settings.address)}</div>`);
  if (settings.phone) lines.push(`<div class="center">Tél : ${esc(settings.phone)}</div>`);
  if (settings.vat_number) lines.push(`<div class="center">N° TVA : ${esc(settings.vat_number)}</div>`);
  if (settings.siret) lines.push(`<div class="center">SIRET : ${esc(settings.siret)}</div>`);
  lines.push(`<hr class="sep-solid">`);
  return lines.join('\n');
}

/** Build a standard A4 document header */
export function buildA4Header(settings: {
  restaurant_name: string;
  legal_form?: string;
  capital?: string;
  address?: string;
  phone?: string;
  vat_number?: string;
  siret?: string;
}): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
      <div>
        <h1 style="margin-bottom:2px;">${esc(settings.restaurant_name)}</h1>
        ${settings.legal_form ? `<div class="subtitle">${esc(settings.legal_form)}${settings.capital ? ` — Au capital de ${esc(settings.capital)}` : ''}</div>` : ''}
        ${settings.address ? `<div style="font-size:10pt;color:#333;">${esc(settings.address)}</div>` : ''}
        ${settings.phone ? `<div style="font-size:10pt;color:#333;">Tél : ${esc(settings.phone)}</div>` : ''}
        ${settings.vat_number ? `<div style="font-size:9pt;color:#333;">N° TVA : ${esc(settings.vat_number)}</div>` : ''}
        ${settings.siret ? `<div style="font-size:9pt;color:#333;">SIRET : ${esc(settings.siret)}</div>` : ''}
      </div>
    </div>
    <hr class="sep">
  `;
}

const saleTypeReceiptLabels: Record<string, string> = {
  dine_in: 'Sur place',
  takeaway: 'Commandes client',
  delivery: 'Vente directe',
};

const paymentMethodReceiptLabels: Record<string, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte bancaire',
};

export interface SaleReceiptData {
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

export interface SaleReceiptSettings {
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

/** Build only the inner body (no <html>/<body>/<script>) of a thermal sale receipt. */
export function buildSaleReceiptBody(
  data: SaleReceiptData,
  settings: SaleReceiptSettings
): string {
  const sym = settings.currency_symbol;
  const fmt = (n: number) => fmtAmt(n, sym);

  const dateObj = new Date(data.createdAt);
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const row = (left: string, right: string, large = false) =>
    `<div class="row${large ? ' total-row' : ''}"><span class="lbl">${esc(left)}</span><span class="val">${esc(right)}</span></div>`;

  const headerHtml = buildThermalHeader(settings);

  const metaHtml = [
    row(`Ticket N° : ${data.saleNumber}`, ''),
    row(`Date : ${dateStr}`, `Heure : ${timeStr}`),
    ...(data.tableNumber
      ? [row(`Table : ${data.tableNumber}`, `Serveur : ${data.cashierName ?? 'N/A'}`)]
      : [row('Serveur :', data.cashierName ?? 'N/A')]),
    ...(data.customerName ? [row('Client :', data.customerName)] : []),
    ...(data.saleType !== 'dine_in'
      ? [row('Mode :', saleTypeReceiptLabels[data.saleType] ?? data.saleType)]
      : []),
    `<hr class="sep">`,
  ].join('\n');

  const colHeaderHtml =
    `<div class="col-header"><span class="qty">Qté</span><span class="desc">Désignation</span><span class="pu">P.U.</span><span class="ttl">Total</span></div>`;

  const itemsHtml = data.items.map(item => {
    const variant = item.variant_label
      ? `<div class="item-sub">[${esc(item.variant_label)}]</div>`
      : '';
    const saucesLine = item.sauces && item.sauces.length > 0
      ? `<div class="item-sub">&#8627; Sauces : ${esc(item.sauces.map(s => s.name).join(', '))}</div>`
      : '';
    const flavorsLine = item.flavors && item.flavors.length > 0
      ? `<div class="item-sub">&#8627; Gouts : ${esc(item.flavors.map(f => f.name).join(', '))}</div>`
      : '';
    return `<div class="item-row"><span class="qty">${item.quantity}x</span><span class="desc">${esc(item.product_name)}</span><span class="pu">${fmtNum(item.unit_price)}</span><span class="ttl">${fmtNum(item.subtotal)}</span></div>${variant}${saucesLine}${flavorsLine}`;
  }).join('');

  const totalsHtml = [
    `<hr class="sep">`,
    ...(data.discountAmount > 0 ? [row('Sous-total', fmt(data.subtotal))] : []),
    ...(data.discountAmount > 0 ? [row('Remise', `- ${fmt(data.discountAmount)}`)] : []),
    row(`TVA (${settings.tax_rate}%)`, fmt(data.taxAmount)),
    `<hr class="sep-solid">`,
    row('TOTAL TTC', fmt(data.total), true),
    `<hr class="sep-solid">`,
  ].join('\n');

  const paymentsHtml = [
    `<div class="section-title">MODE DE RÈGLEMENT</div>`,
    ...data.payments.map(p => row(`${paymentMethodReceiptLabels[p.method] ?? p.method} :`, fmt(p.amount))),
    `<hr class="sep">`,
  ].join('\n');

  const footerHtml = [
    `<div class="footer">${esc(settings.receipt_footer || 'Merci de votre visite !')}</div>`,
    `<div class="footer">À bientôt.</div>`,
    `<hr class="sep">`,
  ].join('\n');

  return `${headerHtml}\n${metaHtml}\n${colHeaderHtml}\n${itemsHtml}\n${totalsHtml}\n${paymentsHtml}\n${footerHtml}`;
}

export interface KitchenTicketData {
  createdAt: string;
  saleType: string;
  tableNumber?: string | number | null;
  cashierName?: string | null;
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

export type KitchenTicketSettings = Pick<
  SaleReceiptSettings,
  'restaurant_name' | 'legal_form' | 'capital' | 'address' | 'phone' | 'vat_number' | 'siret'
>;

const saleTypeKitchenLabels: Record<string, string> = {
  dine_in: 'SUR PLACE',
  takeaway: 'À EMPORTER',
  delivery: 'VENTE DIRECTE',
};

/** Build only the inner body of a kitchen preparation ticket. */
export function buildKitchenTicketBody(
  data: KitchenTicketData,
  _settings: KitchenTicketSettings
): string {
  const dateObj = new Date(data.createdAt);
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const row = (left: string, right: string) =>
    `<div class="row"><span class="lbl">${esc(left)}</span><span class="val">${esc(right)}</span></div>`;

  const metaHtml = [
    `<div class="banner">CUISINE</div>`,
    ...(data.saleType === 'dine_in' && data.tableNumber ? [row('Sur place', `n${data.tableNumber}`)] : []),
    ...(data.saleType !== 'dine_in' && data.customerName ? [row('Client :', data.customerName)] : []),
    row('Heure :', timeStr),
    `<hr class="sep-solid">`,
  ].join('\n');

  const itemsHtml = data.items.map(item => {
    const variant = item.variant_label
      ? `<div style="font-size:11px;padding-left:28px;font-weight:700;">[${esc(item.variant_label)}]</div>`
      : '';
    const saucesLine = item.sauces && item.sauces.length > 0
      ? `<div style="font-size:13px;padding-left:28px;font-weight:700;">&#8627; Sauces : ${esc(item.sauces.map(s => s.name).join(', '))}</div>`
      : '';
    const flavorsLine = item.flavors && item.flavors.length > 0
      ? `<div style="font-size:13px;padding-left:28px;font-weight:700;">&#8627; Gouts : ${esc(item.flavors.map(f => f.name).join(', '))}</div>`
      : '';
    const note = item.kitchen_note
      ? `<div style="font-size:11px;padding-left:28px;font-style:italic;">&gt;&gt; ${esc(item.kitchen_note)}</div>`
      : '';
    return `<div class="item-row" style="font-size:14px;">
        <span class="qty" style="font-size:15px;">${item.quantity}x</span>
        <span class="desc" style="font-size:14px;white-space:normal;">${esc(item.product_name)}</span>
      </div>${variant}${saucesLine}${flavorsLine}${note}`;
  }).join('');

  const notesHtml = data.orderNotes && data.orderNotes.trim()
    ? [
        `<hr class="sep">`,
        `<div class="section-title">NOTE COMMANDE</div>`,
        `<div style="font-size:12px;font-weight:700;">${esc(data.orderNotes)}</div>`,
      ].join('\n')
    : '';

  return `${metaHtml}\n${itemsHtml}\n${notesHtml}`;
}

function wrapThermalDoc(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>${esc(title)}</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export function buildKitchenTicketHtml(
  data: KitchenTicketData,
  settings: KitchenTicketSettings
): string {
  return wrapThermalDoc('Ticket cuisine', buildKitchenTicketBody(data, settings));
}

/** Full thermal sale receipt HTML document that auto-prints on load. */
export function buildSaleReceiptHtml(
  data: SaleReceiptData,
  settings: SaleReceiptSettings
): string {
  return wrapThermalDoc(`Ticket #${data.saleNumber}`, buildSaleReceiptBody(data, settings));
}

/**
 * Combined kitchen ticket + sale receipt in one print job.
 * The two tickets are separated by a page-break so a thermal printer cuts between them.
 */
export function buildCombinedKitchenAndReceiptHtml(
  kitchen: KitchenTicketData,
  receipt: SaleReceiptData,
  settings: SaleReceiptSettings
): string {
  const kitchenBody = buildKitchenTicketBody(kitchen, settings);
  const receiptBody = buildSaleReceiptBody(receipt, settings);
  const combined = `${kitchenBody}
<div style="page-break-before: always; height: 0; margin: 0; padding: 0;"></div>
${receiptBody}`;
  return wrapThermalDoc(`Ticket #${receipt.saleNumber}`, combined);
}

// ─── Cancelled receipt HTML ───

export interface CancelledReceiptData extends SaleReceiptData {
  cancelledByName?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
}

export function buildCancelledReceiptHtml(
  data: CancelledReceiptData,
  settings: SaleReceiptSettings
): string {
  const bannerLines: string[] = [
    `<div class="banner" style="background:#000;color:#fff;font-size:14px;letter-spacing:2px;padding:5px 0;">*** ANNULÉ ***</div>`,
  ];
  if (data.cancelReason) {
    bannerLines.push(`<div class="row"><span class="lbl" style="font-weight:700;">Motif :</span><span class="val">${esc(data.cancelReason)}</span></div>`);
  }
  if (data.cancelledByName) {
    bannerLines.push(`<div class="row"><span class="lbl" style="font-weight:700;">Annulé par :</span><span class="val">${esc(data.cancelledByName)}</span></div>`);
  }
  if (data.cancelledAt) {
    const cancelTime = new Date(data.cancelledAt).toLocaleString('fr-FR');
    bannerLines.push(`<div class="row"><span class="lbl" style="font-weight:700;">Le :</span><span class="val">${esc(cancelTime)}</span></div>`);
  }
  bannerLines.push(`<hr class="sep">`);

  const receiptBody = buildSaleReceiptBody(data, settings);
  const combined = `${bannerLines.join('\n')}\n${receiptBody}`;
  return wrapThermalDoc(`Ticket ANNULÉ #${data.saleNumber}`, combined);
}

// ─── Delivery ticket HTML ───

export interface DeliveryTicketData {
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

export type DeliveryTicketSettings = Pick<
  SaleReceiptSettings,
  'restaurant_name' | 'address' | 'phone' | 'currency_symbol'
>;

const deliveryStatusLabels: Record<string, string> = {
  pending: 'EN ATTENTE DE PAIEMENT',
  assigned: 'ASSIGNÉE',
  picked_up: 'EN ROUTE',
  delivered: 'LIVRÉE',
  cancelled: 'ANNULÉE',
};

export function buildDeliveryTicketHtml(
  data: DeliveryTicketData,
  settings: DeliveryTicketSettings
): string {
  const sym = settings.currency_symbol;
  const fmt = (n: number) => fmtAmt(n, sym);

  const dateObj = new Date(data.createdAt);
  const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const row = (left: string, right: string, large = false) =>
    `<div class="row${large ? ' total-row' : ''}"><span class="lbl">${esc(left)}</span><span class="val">${esc(right)}</span></div>`;

  const headerHtml = buildThermalHeader(settings);

  const bodyHtml = [
    headerHtml,
    `<div class="banner">BON DE LIVRAISON</div>`,
    row(`N° : ${data.deliveryNumber}`, ''),
    row(`Date : ${dateStr}`, `Heure : ${timeStr}`),
    `<hr class="sep">`,
    `<div class="section-title">CLIENT</div>`,
    `<div style="font-size:13px;font-weight:700;">${esc(data.customerName)}</div>`,
    ...(data.customerPhone ? [`<div style="font-size:11px;">Tél : ${esc(data.customerPhone)}</div>`] : []),
    `<hr class="sep">`,
    `<div class="section-title">ADRESSE</div>`,
    `<div style="font-size:12px;font-weight:700;">${esc(data.deliveryAddress)}</div>`,
    `<hr class="sep">`,
    ...(data.driverName ? [row('Livreur :', data.driverName)] : []),
    row('Statut :', deliveryStatusLabels[data.status] ?? data.status),
    `<hr class="sep">`,
    row('Frais de livraison :', fmt(data.deliveryFee), true),
    `<hr class="sep-solid">`,
    ...(data.notes && data.notes.trim() ? [
      `<div class="section-title">NOTES</div>`,
      `<div style="font-size:12px;font-weight:700;">${esc(data.notes)}</div>`,
      `<hr class="sep">`,
    ] : []),
    `<div class="footer">--- Bon de livraison ---</div>`,
  ].join('\n');

  return wrapThermalDoc(`Bon de livraison #${data.deliveryNumber}`, bodyHtml);
}
