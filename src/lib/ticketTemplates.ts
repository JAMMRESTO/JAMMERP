import { Company, LigneDocument, TemplateStyle } from '../types';
import { formatCurrency, formatDate } from './utils';

export type DocumentType = 'facture' | 'devis';

interface TicketDocData {
  type: DocumentType;
  numero: string;
  date: string;
  clientName?: string;
  clientPhone?: string;
  lignes: LigneDocument[];
  sousTotal: number;
  tvaMontant: number;
  total: number;
  montantPaye?: number;
  resteAPayer?: number;
  notes?: string;
  statut?: string;
}

function getUnite(l: LigneDocument): string {
  if (l.type_vente === 'conditionnement') return l.produits?.conditionnement_nom || 'cond.';
  return l.produits?.unite || l.unite || '';
}

function buildTicketClassic(doc: TicketDocData, company: Company): string {
  const typeLabel = doc.type === 'facture' ? 'FACTURE' : 'DEVIS';
  const linesHtml = doc.lignes.map(l => {
    const unite = getUnite(l);
    return `
      <tr><td colspan="2" style="padding:4px 0 0;font-size:8.5pt;font-weight:600;">${l.designation}${unite ? ` <span style="font-weight:400;color:#666;">(${unite})</span>` : ''}</td></tr>
      <tr>
        <td style="padding:1px 0 4px;font-size:8pt;color:#555;">${l.quantite} x ${formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
        <td style="text-align:right;padding:1px 0 4px;font-size:8.5pt;font-weight:600;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
      </tr>
      <tr><td colspan="2" style="border-bottom:1px dashed #ccc;padding:0;"></td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:80mm auto;margin:3mm 4mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:monospace;font-size:8pt;width:72mm;color:#000;}table{width:100%;border-collapse:collapse;}</style>
  </head><body>
    <div style="text-align:center;padding-bottom:6px;border-bottom:2px solid #000;margin-bottom:6px;">
      ${company.logo_url ? `<img src="${company.logo_url}" style="height:36px;object-fit:contain;display:block;margin:0 auto 4px;" />` : ''}
      <div style="font-size:13pt;font-weight:900;letter-spacing:1px;">${company.name}</div>
      ${company.address ? `<div style="font-size:7.5pt;color:#333;">${company.address}</div>` : ''}
      ${company.phone ? `<div style="font-size:7.5pt;">${company.phone}</div>` : ''}
      ${company.tax_number ? `<div style="font-size:7pt;">NIF: ${company.tax_number}</div>` : ''}
    </div>
    <div style="text-align:center;margin-bottom:6px;">
      <div style="font-size:11pt;font-weight:900;">${typeLabel}</div>
      <div style="font-size:8.5pt;font-weight:700;">N ${doc.numero}</div>
      <div style="font-size:7.5pt;">Date: ${formatDate(doc.date)}</div>
    </div>
    ${doc.clientName ? `<div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;margin-bottom:6px;"><div style="font-size:8.5pt;font-weight:700;">Client: ${doc.clientName}</div>${doc.clientPhone ? `<div style="font-size:7.5pt;">${doc.clientPhone}</div>` : ''}</div>` : '<div style="border-top:1px dashed #000;margin-bottom:6px;"></div>'}
    <table style="margin-bottom:6px;">${linesHtml}</table>
    <div style="border-top:2px solid #000;padding-top:4px;">
      ${company.tva_enabled && doc.tvaMontant > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:7.5pt;"><span>Sous-total HT</span><span>${formatCurrency(doc.sousTotal, company.currency_symbol)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:7.5pt;"><span>TVA</span><span>${formatCurrency(doc.tvaMontant, company.currency_symbol)}</span></div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;font-size:11pt;font-weight:900;border-top:1px dashed #000;margin-top:3px;padding-top:3px;"><span>TOTAL</span><span>${formatCurrency(doc.total, company.currency_symbol)}</span></div>
      ${doc.montantPaye && doc.montantPaye > 0 ? `<div style="display:flex;justify-content:space-between;font-size:8pt;"><span>Paye</span><span>${formatCurrency(doc.montantPaye, company.currency_symbol)}</span></div>` : ''}
      ${doc.resteAPayer && doc.resteAPayer > 0 ? `<div style="display:flex;justify-content:space-between;font-size:9pt;font-weight:700;"><span>RESTE</span><span>${formatCurrency(doc.resteAPayer, company.currency_symbol)}</span></div>` : ''}
    </div>
    ${doc.notes ? `<div style="margin-top:6px;border-top:1px dashed #000;padding-top:4px;font-size:7.5pt;">${doc.notes}</div>` : ''}
    <div style="margin-top:8px;border-top:1px dashed #000;padding-top:4px;text-align:center;font-size:7.5pt;">Merci de votre confiance !</div>
  </body></html>`;
}

function buildTicketModern(doc: TicketDocData, company: Company): string {
  const typeLabel = doc.type === 'facture' ? 'FACTURE' : 'DEVIS';
  const accent = '#0f766e';
  const linesHtml = doc.lignes.map(l => {
    const unite = getUnite(l);
    return `
      <div style="padding:4px 0;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:8.5pt;font-weight:700;color:#1e293b;">${l.designation}</span>
          <span style="font-size:8.5pt;font-weight:700;color:#0f172a;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</span>
        </div>
        <div style="font-size:7.5pt;color:#94a3b8;">${l.quantite}${unite ? ' ' + unite : ''} x ${formatCurrency(l.prix_unitaire, company.currency_symbol)}</div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:80mm auto;margin:3mm 4mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:8pt;width:72mm;color:#1e293b;}</style>
  </head><body>
    <div style="text-align:center;padding-bottom:8px;margin-bottom:8px;border-bottom:2px solid ${accent};">
      ${company.logo_url ? `<img src="${company.logo_url}" style="height:32px;object-fit:contain;display:block;margin:0 auto 4px;" />` : ''}
      <div style="font-size:12pt;font-weight:800;color:${accent};letter-spacing:-0.3px;">${company.name}</div>
      ${company.address ? `<div style="font-size:7pt;color:#64748b;">${company.address}</div>` : ''}
      ${company.phone ? `<div style="font-size:7pt;color:#64748b;">${company.phone}</div>` : ''}
      ${company.tax_number ? `<div style="font-size:6.5pt;color:#94a3b8;">NIF: ${company.tax_number}</div>` : ''}
    </div>
    <div style="background:${accent};color:#fff;text-align:center;padding:4px;margin-bottom:6px;border-radius:3px;">
      <div style="font-size:10pt;font-weight:800;letter-spacing:1px;">${typeLabel}</div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:7.5pt;margin-bottom:4px;padding:0 2px;">
      <span style="color:#64748b;">N: <strong style="color:#0f172a;">${doc.numero}</strong></span>
      <span style="color:#64748b;">${formatDate(doc.date)}</span>
    </div>
    ${doc.clientName ? `<div style="background:#f0fdfa;padding:4px 6px;border-radius:3px;margin-bottom:6px;font-size:8pt;"><strong style="color:${accent};">Client:</strong> ${doc.clientName}${doc.clientPhone ? ` | ${doc.clientPhone}` : ''}</div>` : ''}
    <div style="margin-bottom:6px;">${linesHtml}</div>
    <div style="background:#f8fafc;border-radius:3px;padding:6px;">
      ${company.tva_enabled && doc.tvaMontant > 0 ? `
        <div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#64748b;"><span>Sous-total HT</span><span>${formatCurrency(doc.sousTotal, company.currency_symbol)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#64748b;"><span>TVA</span><span>${formatCurrency(doc.tvaMontant, company.currency_symbol)}</span></div>
      ` : ''}
      <div style="display:flex;justify-content:space-between;font-size:11pt;font-weight:900;color:${accent};border-top:1px solid ${accent};margin-top:3px;padding-top:4px;"><span>TOTAL</span><span>${formatCurrency(doc.total, company.currency_symbol)}</span></div>
      ${doc.montantPaye && doc.montantPaye > 0 ? `<div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#16a34a;font-weight:600;margin-top:2px;"><span>Paye</span><span>${formatCurrency(doc.montantPaye, company.currency_symbol)}</span></div>` : ''}
      ${doc.resteAPayer && doc.resteAPayer > 0 ? `<div style="display:flex;justify-content:space-between;font-size:8.5pt;color:#dc2626;font-weight:700;margin-top:2px;"><span>RESTE</span><span>${formatCurrency(doc.resteAPayer, company.currency_symbol)}</span></div>` : ''}
    </div>
    ${doc.notes ? `<div style="margin-top:6px;font-size:7pt;color:#64748b;padding:4px;">${doc.notes}</div>` : ''}
    <div style="margin-top:8px;text-align:center;font-size:7pt;color:${accent};font-weight:600;">Merci de votre confiance !</div>
  </body></html>`;
}

function buildTicketElegant(doc: TicketDocData, company: Company): string {
  const typeLabel = doc.type === 'facture' ? 'FACTURE' : 'DEVIS';
  const linesHtml = doc.lignes.map(l => {
    const unite = getUnite(l);
    return `
      <tr>
        <td style="padding:3px 0;font-size:8pt;color:#1c1917;">${l.designation}${unite ? ` <span style="color:#a8a29e;font-size:7pt;">(${unite})</span>` : ''}</td>
        <td style="padding:3px 0;text-align:center;font-size:7.5pt;color:#57534e;">${l.quantite}</td>
        <td style="padding:3px 0;text-align:right;font-size:8pt;font-weight:600;color:#1c1917;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:80mm auto;margin:3mm 4mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Georgia,'Times New Roman',serif;font-size:8pt;width:72mm;color:#1c1917;}table{width:100%;border-collapse:collapse;}</style>
  </head><body>
    <div style="text-align:center;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid #1c1917;">
      ${company.logo_url ? `<img src="${company.logo_url}" style="height:34px;object-fit:contain;display:block;margin:0 auto 4px;" />` : ''}
      <div style="font-size:12pt;font-weight:700;letter-spacing:1px;">${company.name}</div>
      ${company.address ? `<div style="font-size:7pt;color:#78716c;font-style:italic;">${company.address}</div>` : ''}
      ${company.phone ? `<div style="font-size:7pt;color:#78716c;">${company.phone}</div>` : ''}
      ${company.tax_number ? `<div style="font-size:6.5pt;color:#a8a29e;">NIF: ${company.tax_number}</div>` : ''}
    </div>
    <div style="text-align:center;margin-bottom:6px;">
      <div style="font-size:7pt;text-transform:uppercase;letter-spacing:3px;color:#92400e;">${typeLabel}</div>
      <div style="font-size:10pt;font-weight:700;margin-top:1px;">${doc.numero}</div>
      <div style="font-size:7pt;color:#78716c;">${formatDate(doc.date)}</div>
    </div>
    ${doc.clientName ? `<div style="border-top:1px solid #d6d3d1;border-bottom:1px solid #d6d3d1;padding:4px 0;margin-bottom:6px;"><div style="font-size:7pt;text-transform:uppercase;letter-spacing:1.5px;color:#92400e;">Client</div><div style="font-size:8.5pt;font-weight:700;">${doc.clientName}</div>${doc.clientPhone ? `<div style="font-size:7pt;color:#78716c;">${doc.clientPhone}</div>` : ''}</div>` : '<div style="border-top:1px solid #d6d3d1;margin-bottom:6px;"></div>'}
    <table style="margin-bottom:6px;">
      <thead><tr style="border-bottom:1px solid #1c1917;"><th style="text-align:left;font-size:6.5pt;text-transform:uppercase;letter-spacing:1px;color:#78716c;padding:2px 0;">Article</th><th style="text-align:center;font-size:6.5pt;text-transform:uppercase;letter-spacing:1px;color:#78716c;padding:2px 0;">Qte</th><th style="text-align:right;font-size:6.5pt;text-transform:uppercase;letter-spacing:1px;color:#78716c;padding:2px 0;">Montant</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <div style="border-top:1px solid #1c1917;padding-top:4px;">
      ${company.tva_enabled && doc.tvaMontant > 0 ? `<div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#78716c;"><span>Sous-total HT</span><span>${formatCurrency(doc.sousTotal, company.currency_symbol)}</span></div><div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#78716c;"><span>TVA</span><span>${formatCurrency(doc.tvaMontant, company.currency_symbol)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:11pt;font-weight:700;margin-top:3px;padding-top:3px;border-top:1px solid #d6d3d1;"><span>TOTAL</span><span>${formatCurrency(doc.total, company.currency_symbol)}</span></div>
      ${doc.montantPaye && doc.montantPaye > 0 ? `<div style="display:flex;justify-content:space-between;font-size:8pt;color:#16a34a;font-weight:600;"><span>Paye</span><span>${formatCurrency(doc.montantPaye, company.currency_symbol)}</span></div>` : ''}
      ${doc.resteAPayer && doc.resteAPayer > 0 ? `<div style="display:flex;justify-content:space-between;font-size:9pt;font-weight:700;color:#dc2626;"><span>RESTE</span><span>${formatCurrency(doc.resteAPayer, company.currency_symbol)}</span></div>` : ''}
    </div>
    ${doc.notes ? `<div style="margin-top:6px;border-top:1px solid #d6d3d1;padding-top:4px;font-size:7pt;font-style:italic;color:#78716c;">${doc.notes}</div>` : ''}
    <div style="margin-top:8px;border-top:1px solid #d6d3d1;padding-top:4px;text-align:center;font-size:7pt;font-style:italic;color:#a8a29e;">Merci de votre confiance</div>
  </body></html>`;
}

function buildTicketMinimal(doc: TicketDocData, company: Company): string {
  const typeLabel = doc.type === 'facture' ? 'FACTURE' : 'DEVIS';
  const linesHtml = doc.lignes.map(l => {
    const unite = getUnite(l);
    return `
      <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #f3f4f6;">
        <div>
          <div style="font-size:8pt;font-weight:600;color:#111827;">${l.designation}</div>
          <div style="font-size:7pt;color:#9ca3af;">${l.quantite}${unite ? ' ' + unite : ''} x ${formatCurrency(l.prix_unitaire, company.currency_symbol)}</div>
        </div>
        <div style="font-size:8.5pt;font-weight:700;color:#111827;white-space:nowrap;padding-left:8px;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:80mm auto;margin:3mm 4mm;}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:8pt;width:72mm;color:#111827;}</style>
  </head><body>
    <div style="text-align:center;padding-bottom:8px;margin-bottom:8px;">
      ${company.logo_url ? `<img src="${company.logo_url}" style="height:30px;object-fit:contain;display:block;margin:0 auto 6px;" />` : ''}
      <div style="font-size:11pt;font-weight:800;color:#111827;">${company.name}</div>
      <div style="font-size:7pt;color:#d1d5db;margin-top:2px;">${[company.address, company.phone].filter(Boolean).join(' | ')}</div>
    </div>
    <div style="background:#111827;color:#fff;text-align:center;padding:5px;margin-bottom:6px;">
      <span style="font-size:9pt;font-weight:800;letter-spacing:2px;">${typeLabel}</span>
      <span style="font-size:8pt;margin-left:8px;">${doc.numero}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af;margin-bottom:4px;">
      <span>${formatDate(doc.date)}</span>
      ${doc.clientName ? `<span style="font-weight:600;color:#111827;">${doc.clientName}</span>` : ''}
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:4px;margin-bottom:4px;">${linesHtml}</div>
    <div style="margin-top:4px;">
      ${company.tva_enabled && doc.tvaMontant > 0 ? `<div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af;"><span>HT</span><span>${formatCurrency(doc.sousTotal, company.currency_symbol)}</span></div><div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af;"><span>TVA</span><span>${formatCurrency(doc.tvaMontant, company.currency_symbol)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-size:12pt;font-weight:900;color:#111827;border-top:2px solid #111827;margin-top:3px;padding-top:4px;"><span>TOTAL</span><span>${formatCurrency(doc.total, company.currency_symbol)}</span></div>
      ${doc.montantPaye && doc.montantPaye > 0 ? `<div style="display:flex;justify-content:space-between;font-size:7.5pt;color:#16a34a;font-weight:600;margin-top:2px;"><span>Paye</span><span>${formatCurrency(doc.montantPaye, company.currency_symbol)}</span></div>` : ''}
      ${doc.resteAPayer && doc.resteAPayer > 0 ? `<div style="display:flex;justify-content:space-between;font-size:8.5pt;color:#dc2626;font-weight:700;margin-top:2px;"><span>RESTE</span><span>${formatCurrency(doc.resteAPayer, company.currency_symbol)}</span></div>` : ''}
    </div>
    <div style="margin-top:10px;text-align:center;font-size:7pt;color:#d1d5db;">Merci</div>
  </body></html>`;
}

export function buildTicketHtml(
  doc: TicketDocData,
  company: Company,
  template: TemplateStyle
): string {
  switch (template) {
    case 'modern': return buildTicketModern(doc, company);
    case 'elegant': return buildTicketElegant(doc, company);
    case 'minimal': return buildTicketMinimal(doc, company);
    default: return buildTicketClassic(doc, company);
  }
}
