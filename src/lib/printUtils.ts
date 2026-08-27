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
    font-size: 12px;
    font-weight: 700;
    color: #000;
    background: #fff;
    width: 72mm;
    padding: 5px 5px 12px;
  }
  .sep  { border: none; border-top: 1px dashed #000; margin: 5px 0; }
  .sep-solid { border: none; border-top: 2px solid #000; margin: 5px 0; }
  .center { text-align: center; }
  .name { font-family: Impact, 'Arial Narrow', sans-serif; font-size: 17px; letter-spacing: 1px; text-align: center; }
  .section-title { font-family: Impact, 'Arial Narrow', sans-serif; font-size: 12px; letter-spacing: 0.5px; margin: 4px 0 2px; }
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 1px 0; font-size: 12px; font-weight: 700; }
  .row .lbl { flex: 1; }
  .row .val { font-weight: 700; text-align: right; white-space: nowrap; margin-left: 4px; }
  .total-row { font-family: Impact, 'Arial Narrow', sans-serif; font-size: 15px; letter-spacing: 0.5px; }
  .col-header { display: flex; font-size: 11px; font-weight: 700; padding: 2px 0; border-bottom: 2px solid #000; }
  .item-row { display: flex; font-size: 12px; font-weight: 700; padding: 2px 0; align-items: baseline; }
  .qty  { width: 24px; flex-shrink: 0; }
  .desc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 4px; }
  .pu   { width: 48px; text-align: right; flex-shrink: 0; margin-right: 10px; font-weight: 400; }
  .ttl  { width: 48px; text-align: right; flex-shrink: 0; }
  .banner { text-align: center; font-family: Impact, 'Arial Narrow', sans-serif; font-size: 13px; letter-spacing: 1px; font-weight: 700; background: #000; color: #fff; padding: 3px 0; margin: 4px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .footer { margin-top: 8px; font-size: 10px; text-align: center; }
  @media print { body { padding: 3px 2px 8px; } @page { margin: 3mm; size: 80mm auto; } }
`;

/** CSS for A4 report documents */
export const A4_CSS = `
  ${BASE_PRINT_CSS}
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
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
  table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8px; }
  th {
    background: #f0f0f0 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    border: 1px solid #000;
    padding: 6px 8px;
    font-weight: 700;
    text-align: left;
    font-size: 10pt;
  }
  td { border: 1px solid #555; padding: 5px 8px; font-size: 10pt; font-weight: 500; }
  tr:nth-child(even) td { background: #fafafa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .stat-block { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; }
  .stat { border: 2px solid #000; padding: 8px 14px; min-width: 120px; }
  .stat-val { font-size: 18pt; font-weight: 800; color: #000; display: block; }
  .stat-lbl { font-size: 9pt; font-weight: 600; color: #333; display: block; margin-top: 2px; }
  .text-right { text-align: right; }
  .text-center { text-align: center; }
  .bold { font-weight: 700; }
  .amount { font-weight: 700; font-size: 11pt; }
  .total-row td { font-weight: 700; border-top: 2px solid #000 !important; font-size: 11pt; }
  @media print { body { padding: 0; } @page { margin: 12mm 10mm; size: A4 portrait; } }
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
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1500);
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

/** Build a full thermal sale receipt HTML document that auto-prints on load */
export function buildSaleReceiptHtml(
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
      ? `<div style="font-size:10px;padding-left:24px;">[${esc(item.variant_label)}]</div>`
      : '';
    return `<div class="item-row"><span class="qty">${item.quantity}x</span><span class="desc">${esc(item.product_name)}</span><span class="pu">${fmtNum(item.unit_price)}</span><span class="ttl">${fmtNum(item.subtotal)}</span></div>${variant}`;
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

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="only light">
  <title>Ticket #${esc(data.saleNumber)}</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  ${headerHtml}
  ${metaHtml}
  ${colHeaderHtml}
  ${itemsHtml}
  ${totalsHtml}
  ${paymentsHtml}
  ${footerHtml}
  <script>window.addEventListener('load',function(){window.print();window.addEventListener('afterprint',function(){window.close();});});<\/script>
</body>
</html>`;
}
