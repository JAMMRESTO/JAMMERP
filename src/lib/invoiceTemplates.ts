import { Company, LigneDocument, TemplateStyle } from '../types';
import { formatCurrency, formatDate } from './utils';

export type DocumentType = 'facture' | 'devis';

interface DocumentData {
  type: DocumentType;
  numero: string;
  date: string;
  dateEcheance?: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  clientTaxNumber?: string;
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

function statutBadgeHtml(statut: string | undefined): string {
  if (!statut) return '';
  const map: Record<string, { label: string; bg: string; color: string }> = {
    payee:              { label: 'PAYEE',              bg: '#dcfce7', color: '#166534' },
    partiellement_payee:{ label: 'PARTIELLEMENT PAYEE',bg: '#fef9c3', color: '#854d0e' },
    envoyee:            { label: 'ENVOYEE',            bg: '#dbeafe', color: '#1e40af' },
    brouillon:          { label: 'BROUILLON',          bg: '#f1f5f9', color: '#475569' },
    annulee:            { label: 'ANNULEE',            bg: '#fee2e2', color: '#991b1b' },
    accepte:            { label: 'ACCEPTE',            bg: '#dcfce7', color: '#166534' },
    refuse:             { label: 'REFUSE',             bg: '#fee2e2', color: '#991b1b' },
    converti:           { label: 'CONVERTI',           bg: '#e0e7ff', color: '#3730a3' },
    envoye:             { label: 'ENVOYE',             bg: '#dbeafe', color: '#1e40af' },
  };
  const s = map[statut] || { label: statut.toUpperCase(), bg: '#f1f5f9', color: '#475569' };
  return `<span style="display:inline-block;padding:3px 12px;border-radius:20px;font-size:8pt;font-weight:700;background:${s.bg};color:${s.color};letter-spacing:0.5px;">${s.label}</span>`;
}

function linesHtml(doc: DocumentData, company: Company, fontSize: string): string {
  return doc.lignes.map(l => {
    const unite = getUnite(l);
    const isGroupHeader = !l.produit_id && l.quantite === 0 && l.prix_unitaire === 0;
    if (isGroupHeader) {
      return `<tr><td colspan="${company.tva_enabled ? '5' : '4'}" style="padding:10px 12px 6px;font-weight:800;font-size:${fontSize};color:#0f172a;border-bottom:1px solid #e2e8f0;text-transform:uppercase;letter-spacing:0.3px;">${l.designation}</td></tr>`;
    }
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e8ecf0;color:#0f172a;">${l.designation}${l.type_vente === 'conditionnement' ? `<div style="font-size:7.5pt;color:#64748b;font-style:italic;">Conditionnement</div>` : ''}</td>
      <td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e8ecf0;color:#374151;white-space:nowrap;">${l.quantite.toFixed(2)}${unite ? `<span style="font-size:8pt;color:#64748b;"> ${unite}</span>` : ''}</td>
      <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e8ecf0;color:#374151;white-space:nowrap;">${formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
      ${company.tva_enabled ? `<td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e8ecf0;color:#64748b;">${l.tva_taux}%</td>` : ''}
      <td style="padding:8px 12px;text-align:right;border-bottom:1px solid #e8ecf0;color:#0f172a;font-weight:600;white-space:nowrap;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
    </tr>`;
  }).join('');
}

function totalsHtml(doc: DocumentData, company: Company, accentColor: string, fontSize: string): string {
  return `
    ${company.tva_enabled && doc.tvaMontant > 0 ? `
      <tr><td style="padding:5px 12px;color:#64748b;font-size:${fontSize};">Sous-total HT</td><td style="padding:5px 12px;text-align:right;color:#64748b;">${formatCurrency(doc.sousTotal, company.currency_symbol)}</td></tr>
      <tr><td style="padding:5px 12px;color:#64748b;font-size:${fontSize};">TVA (${company.tva_rate}%)</td><td style="padding:5px 12px;text-align:right;color:#64748b;">${formatCurrency(doc.tvaMontant, company.currency_symbol)}</td></tr>
    ` : ''}
    <tr style="background:${accentColor};"><td style="padding:10px 12px;font-weight:800;color:#fff;font-size:11pt;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#fff;font-size:11pt;">${formatCurrency(doc.total, company.currency_symbol)}</td></tr>
    ${doc.montantPaye && doc.montantPaye > 0 ? `<tr><td style="padding:5px 12px;color:#16a34a;font-weight:600;">Montant paye</td><td style="padding:5px 12px;text-align:right;color:#16a34a;font-weight:600;">${formatCurrency(doc.montantPaye, company.currency_symbol)}</td></tr>` : ''}
    ${doc.resteAPayer && doc.resteAPayer > 0 ? `<tr style="background:#fef2f2;"><td style="padding:6px 12px;color:#dc2626;font-weight:800;">Reste a payer</td><td style="padding:6px 12px;text-align:right;color:#dc2626;font-weight:800;">${formatCurrency(doc.resteAPayer, company.currency_symbol)}</td></tr>` : ''}
  `;
}

function buildClassic(doc: DocumentData, company: Company, isA5: boolean): string {
  const accentColor = doc.type === 'facture' ? '#1d4ed8' : '#0369a1';
  const typeLabel = doc.type === 'facture' ? 'Facture' : 'Devis';
  const fontSize = isA5 ? '9pt' : '10pt';
  const pageMargin = isA5 ? '12mm 10mm' : '15mm 15mm';

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:${isA5 ? 'A5' : 'A4'};margin:${pageMargin};}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;font-size:${fontSize};color:#1e293b;line-height:1.5;}table{border-collapse:collapse;width:100%;}.items-table{border:1px solid #d1d5db;}.items-table th{background:#fff;color:#0f172a;font-weight:700;font-size:9pt;text-transform:uppercase;letter-spacing:0.3px;padding:9px 12px;border-bottom:2px solid #d1d5db;}.items-table th:not(:first-child),.items-table td:not(:first-child){border-left:1px solid #d1d5db;}.totals-table{border:1px solid #d1d5db;overflow:hidden;}.totals-table td{border-bottom:1px solid #e5e7eb;}</style>
  </head><body>
    <table style="width:100%;margin-bottom:${isA5 ? '20px' : '30px'};"><tr>
      <td style="vertical-align:top;width:50%;">${company.logo_url ? `<img src="${company.logo_url}" style="height:${isA5 ? '44px' : '60px'};object-fit:contain;display:block;margin-bottom:6px;" />` : ''}</td>
      <td style="text-align:right;vertical-align:top;">
        <div style="font-size:${isA5 ? '10pt' : '11pt'};font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:0.3px;">${company.name}</div>
        ${company.address ? `<div style="color:#4b5563;margin-top:1px;">${company.address}</div>` : ''}
        ${company.phone ? `<div style="color:#4b5563;">${company.phone}</div>` : ''}
        ${company.email ? `<div style="color:#4b5563;">${company.email}</div>` : ''}
        ${company.tax_number ? `<div style="color:#4b5563;margin-top:2px;">RCCM / NINEA : ${company.tax_number}</div>` : ''}
      </td>
    </tr></table>

    <div style="text-align:center;margin-bottom:${isA5 ? '6px' : '8px'};font-size:${isA5 ? '9pt' : '10pt'};color:#374151;font-weight:600;">${doc.clientName}</div>

    <div style="margin-bottom:${isA5 ? '14px' : '20px'};">
      <div style="font-size:${isA5 ? '22pt' : '28pt'};font-weight:900;color:${accentColor};line-height:1.1;">${typeLabel} ${doc.numero}</div>
      <table style="width:auto;margin-top:6px;"><tr>
        <td style="padding-right:40px;"><div style="font-size:8.5pt;font-weight:700;color:${accentColor};">Date</div><div style="color:#374151;">${formatDate(doc.date)}</div></td>
        ${doc.dateEcheance ? `<td><div style="font-size:8.5pt;font-weight:700;color:${accentColor};">Echeance</div><div style="color:#374151;">${formatDate(doc.dateEcheance)}</div></td>` : ''}
      </tr></table>
      ${statutBadgeHtml(doc.statut) ? `<div style="margin-top:8px;">${statutBadgeHtml(doc.statut)}</div>` : ''}
    </div>

    <table class="items-table" style="margin-bottom:${isA5 ? '14px' : '20px'};"><thead><tr>
      <th style="text-align:left;width:${company.tva_enabled ? '38%' : '46%'};">DESCRIPTION</th>
      <th style="text-align:center;width:13%;">QTE</th>
      <th style="text-align:right;width:${company.tva_enabled ? '17%' : '20%'};">P.U.</th>
      ${company.tva_enabled ? `<th style="text-align:center;width:10%;">TVA</th>` : ''}
      <th style="text-align:right;width:${company.tva_enabled ? '22%' : '21%'};">MONTANT</th>
    </tr></thead><tbody>${linesHtml(doc, company, fontSize)}</tbody></table>

    <table style="width:100%;margin-bottom:${isA5 ? '14px' : '20px'};"><tr>
      <td style="vertical-align:bottom;"><div style="font-size:${fontSize};color:#374151;"><span style="font-weight:600;">Ref. paiement :</span> ${doc.numero}</div></td>
      <td style="width:${isA5 ? '200px' : '260px'};vertical-align:top;"><table class="totals-table"><tbody>${totalsHtml(doc, company, accentColor, fontSize)}</tbody></table></td>
    </tr></table>

    ${doc.notes ? `<div style="margin-bottom:16px;padding:10px 12px;background:#fffbeb;border-left:3px solid #f59e0b;"><div style="font-size:8pt;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:3px;">Notes</div><div style="color:#78350f;">${doc.notes}</div></div>` : ''}

    <div style="margin-top:${isA5 ? '20px' : '40px'};padding-top:10px;border-top:1px solid #e5e7eb;text-align:center;">
      <div style="color:#6b7280;font-size:8.5pt;">${company.tax_number ? `RCCM / NINEA: ${company.tax_number}` : company.name}<span style="margin:0 12px;">.</span>Page 1 / 1</div>
      ${company.email ? `<div style="color:#6b7280;font-size:8.5pt;margin-top:2px;">${company.email}</div>` : ''}
    </div>
  </body></html>`;
}

function buildModern(doc: DocumentData, company: Company, isA5: boolean): string {
  const accent = doc.type === 'facture' ? '#0f766e' : '#0e7490';
  const accentLight = doc.type === 'facture' ? '#f0fdfa' : '#ecfeff';
  const accentMid = doc.type === 'facture' ? '#ccfbf1' : '#cffafe';
  const typeLabel = doc.type === 'facture' ? 'Facture' : 'Devis';
  const fontSize = isA5 ? '9pt' : '10pt';
  const pageMargin = isA5 ? '10mm' : '12mm 14mm';

  const rows = doc.lignes.map((l, i) => {
    const unite = getUnite(l);
    const isGroupHeader = !l.produit_id && l.quantite === 0 && l.prix_unitaire === 0;
    if (isGroupHeader) return `<tr><td colspan="${company.tva_enabled ? 5 : 4}" style="padding:12px 14px 6px;font-weight:800;font-size:${fontSize};color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;background:${accentLight};">${l.designation}</td></tr>`;
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr style="background:${bg};">
      <td style="padding:9px 14px;color:#1e293b;">${l.designation}${l.type_vente === 'conditionnement' ? `<div style="font-size:7pt;color:#94a3b8;">Conditionnement</div>` : ''}</td>
      <td style="padding:9px 14px;text-align:center;color:#475569;">${l.quantite.toFixed(2)}${unite ? ` <span style="font-size:7.5pt;color:#94a3b8;">${unite}</span>` : ''}</td>
      <td style="padding:9px 14px;text-align:right;color:#475569;">${formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
      ${company.tva_enabled ? `<td style="padding:9px 14px;text-align:center;color:#94a3b8;font-size:8.5pt;">${l.tva_taux}%</td>` : ''}
      <td style="padding:9px 14px;text-align:right;font-weight:700;color:#0f172a;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:${isA5 ? 'A5' : 'A4'};margin:${pageMargin};}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Segoe UI',Roboto,Arial,sans-serif;font-size:${fontSize};color:#1e293b;line-height:1.55;}table{border-collapse:collapse;width:100%;}</style>
  </head><body>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${isA5 ? '16px' : '24px'};padding-bottom:${isA5 ? '14px' : '20px'};border-bottom:3px solid ${accent};">
      <div style="display:flex;align-items:center;gap:12px;">
        ${company.logo_url ? `<img src="${company.logo_url}" style="height:${isA5 ? '48px' : '64px'};object-fit:contain;" />` : ''}
        <div>
          <div style="font-size:${isA5 ? '13pt' : '16pt'};font-weight:900;color:#0f172a;letter-spacing:-0.3px;">${company.name}</div>
          ${company.address ? `<div style="color:#64748b;font-size:${isA5 ? '8pt' : '9pt'};">${company.address}</div>` : ''}
          ${company.phone ? `<div style="color:#64748b;font-size:${isA5 ? '8pt' : '9pt'};">${company.phone}${company.email ? ` | ${company.email}` : ''}</div>` : ''}
          ${company.tax_number ? `<div style="color:#94a3b8;font-size:8pt;">RCCM / NINEA : ${company.tax_number}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:${isA5 ? '16pt' : '22pt'};font-weight:900;color:${accent};letter-spacing:-0.5px;">${typeLabel.toUpperCase()}</div>
        <div style="font-size:${isA5 ? '11pt' : '13pt'};font-weight:700;color:#475569;margin-top:2px;">${doc.numero}</div>
        ${doc.statut ? `<div style="margin-top:4px;">${statutBadgeHtml(doc.statut)}</div>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:${isA5 ? '12px' : '20px'};margin-bottom:${isA5 ? '16px' : '24px'};">
      <div style="flex:1;background:${accentLight};border-radius:10px;padding:${isA5 ? '10px 12px' : '14px 16px'};">
        <div style="font-size:7.5pt;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Client</div>
        <div style="font-weight:700;color:#0f172a;font-size:${isA5 ? '10pt' : '11pt'};">${doc.clientName}</div>
        ${doc.clientPhone ? `<div style="color:#475569;font-size:${fontSize};margin-top:2px;">${doc.clientPhone}</div>` : ''}
        ${doc.clientAddress ? `<div style="color:#64748b;font-size:${isA5 ? '8pt' : '9pt'};">${doc.clientAddress}</div>` : ''}
        ${doc.clientTaxNumber ? `<div style="color:#94a3b8;font-size:8pt;">NIF: ${doc.clientTaxNumber}</div>` : ''}
      </div>
      <div style="background:${accentLight};border-radius:10px;padding:${isA5 ? '10px 12px' : '14px 16px'};min-width:${isA5 ? '130px' : '160px'};">
        <div style="font-size:7.5pt;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">Date</div>
        <div style="font-weight:600;color:#0f172a;">${formatDate(doc.date)}</div>
        ${doc.dateEcheance ? `<div style="font-size:7.5pt;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:0.8px;margin-top:8px;margin-bottom:4px;">Echeance</div><div style="font-weight:600;color:#0f172a;">${formatDate(doc.dateEcheance)}</div>` : ''}
      </div>
    </div>

    <table style="margin-bottom:${isA5 ? '14px' : '20px'};border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <thead><tr style="background:${accent};">
        <th style="text-align:left;padding:10px 14px;color:#fff;font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
        <th style="text-align:center;padding:10px 14px;color:#fff;font-size:8.5pt;font-weight:700;text-transform:uppercase;">Qte</th>
        <th style="text-align:right;padding:10px 14px;color:#fff;font-size:8.5pt;font-weight:700;text-transform:uppercase;">Prix unit.</th>
        ${company.tva_enabled ? `<th style="text-align:center;padding:10px 14px;color:#fff;font-size:8.5pt;font-weight:700;text-transform:uppercase;">TVA</th>` : ''}
        <th style="text-align:right;padding:10px 14px;color:#fff;font-size:8.5pt;font-weight:700;text-transform:uppercase;">Montant</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table style="width:100%;margin-bottom:${isA5 ? '14px' : '20px'};"><tr>
      <td style="vertical-align:top;padding-right:20px;">${doc.notes ? `<div style="background:#fffbeb;border-radius:8px;padding:12px;border-left:3px solid #f59e0b;"><div style="font-size:7.5pt;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px;">Notes</div><div style="color:#78350f;font-size:${fontSize};">${doc.notes}</div></div>` : ''}</td>
      <td style="width:${isA5 ? '200px' : '260px'};vertical-align:top;">
        <table style="width:100%;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;"><tbody>
          ${company.tva_enabled && doc.tvaMontant > 0 ? `<tr style="background:#f8fafc;"><td style="padding:6px 12px;color:#64748b;">Sous-total HT</td><td style="padding:6px 12px;text-align:right;color:#64748b;">${formatCurrency(doc.sousTotal, company.currency_symbol)}</td></tr><tr style="background:#f8fafc;"><td style="padding:6px 12px;color:#64748b;">TVA</td><td style="padding:6px 12px;text-align:right;color:#64748b;">${formatCurrency(doc.tvaMontant, company.currency_symbol)}</td></tr>` : ''}
          <tr style="background:${accent};"><td style="padding:10px 12px;font-weight:800;color:#fff;font-size:11pt;">Total</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#fff;font-size:11pt;">${formatCurrency(doc.total, company.currency_symbol)}</td></tr>
          ${doc.montantPaye && doc.montantPaye > 0 ? `<tr><td style="padding:5px 12px;color:#16a34a;font-weight:600;">Paye</td><td style="padding:5px 12px;text-align:right;color:#16a34a;font-weight:600;">${formatCurrency(doc.montantPaye, company.currency_symbol)}</td></tr>` : ''}
          ${doc.resteAPayer && doc.resteAPayer > 0 ? `<tr style="background:#fef2f2;"><td style="padding:6px 12px;color:#dc2626;font-weight:800;">Reste</td><td style="padding:6px 12px;text-align:right;color:#dc2626;font-weight:800;">${formatCurrency(doc.resteAPayer, company.currency_symbol)}</td></tr>` : ''}
        </tbody></table>
      </td>
    </tr></table>

    <div style="margin-top:${isA5 ? '20px' : '40px'};padding-top:10px;border-top:2px solid ${accentMid};text-align:center;color:#94a3b8;font-size:8pt;">
      ${company.name}${company.tax_number ? ` | RCCM / NINEA: ${company.tax_number}` : ''}${company.email ? ` | ${company.email}` : ''}
    </div>
  </body></html>`;
}

function buildElegant(doc: DocumentData, company: Company, isA5: boolean): string {
  const typeLabel = doc.type === 'facture' ? 'Facture' : 'Devis';
  const fontSize = isA5 ? '9pt' : '10pt';
  const pageMargin = isA5 ? '10mm' : '14mm';
  const gold = '#92400e';
  const goldLight = '#fef3c7';

  const rows = doc.lignes.map(l => {
    const unite = getUnite(l);
    const isGroupHeader = !l.produit_id && l.quantite === 0 && l.prix_unitaire === 0;
    if (isGroupHeader) return `<tr><td colspan="${company.tva_enabled ? 5 : 4}" style="padding:12px 16px 6px;font-weight:700;font-size:${fontSize};color:#1c1917;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #d6d3d1;">${l.designation}</td></tr>`;
    return `<tr>
      <td style="padding:9px 16px;border-bottom:1px solid #f5f5f4;color:#1c1917;font-size:${fontSize};">${l.designation}${l.type_vente === 'conditionnement' ? `<div style="font-size:7pt;color:#a8a29e;">Cond.</div>` : ''}</td>
      <td style="padding:9px 16px;text-align:center;border-bottom:1px solid #f5f5f4;color:#57534e;">${l.quantite.toFixed(2)}${unite ? ` <span style="font-size:7.5pt;color:#a8a29e;">${unite}</span>` : ''}</td>
      <td style="padding:9px 16px;text-align:right;border-bottom:1px solid #f5f5f4;color:#57534e;">${formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
      ${company.tva_enabled ? `<td style="padding:9px 16px;text-align:center;border-bottom:1px solid #f5f5f4;color:#a8a29e;">${l.tva_taux}%</td>` : ''}
      <td style="padding:9px 16px;text-align:right;border-bottom:1px solid #f5f5f4;font-weight:700;color:#1c1917;">${formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:${isA5 ? 'A5' : 'A4'};margin:${pageMargin};}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Georgia,'Times New Roman',serif;font-size:${fontSize};color:#1c1917;line-height:1.6;}table{border-collapse:collapse;width:100%;}</style>
  </head><body>
    <div style="border-bottom:2px solid #1c1917;padding-bottom:${isA5 ? '14px' : '20px'};margin-bottom:${isA5 ? '14px' : '20px'};">
      <table style="width:100%;"><tr>
        <td style="vertical-align:middle;">
          ${company.logo_url ? `<img src="${company.logo_url}" style="height:${isA5 ? '50px' : '68px'};object-fit:contain;display:block;" />` : `<div style="font-size:${isA5 ? '16pt' : '20pt'};font-weight:700;color:#1c1917;letter-spacing:1px;">${company.name}</div>`}
        </td>
        <td style="text-align:right;vertical-align:middle;">
          ${company.logo_url ? `<div style="font-size:${isA5 ? '11pt' : '13pt'};font-weight:700;color:#1c1917;letter-spacing:0.5px;">${company.name}</div>` : ''}
          <div style="color:#78716c;font-size:${isA5 ? '8pt' : '9pt'};margin-top:2px;">
            ${[company.address, company.phone, company.email].filter(Boolean).join(' | ')}
          </div>
          ${company.tax_number ? `<div style="color:#a8a29e;font-size:8pt;margin-top:2px;">RCCM / NINEA : ${company.tax_number}</div>` : ''}
        </td>
      </tr></table>
    </div>

    <div style="text-align:center;margin-bottom:${isA5 ? '16px' : '24px'};">
      <div style="font-size:${isA5 ? '8pt' : '9pt'};text-transform:uppercase;letter-spacing:3px;color:${gold};font-weight:700;margin-bottom:4px;">${typeLabel}</div>
      <div style="font-size:${isA5 ? '20pt' : '26pt'};font-weight:700;color:#1c1917;line-height:1;">${doc.numero}</div>
      ${doc.statut ? `<div style="margin-top:6px;">${statutBadgeHtml(doc.statut)}</div>` : ''}
    </div>

    <table style="width:100%;margin-bottom:${isA5 ? '16px' : '24px'};"><tr>
      <td style="width:50%;vertical-align:top;padding-right:16px;">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:${gold};font-weight:700;margin-bottom:6px;">Facturer a</div>
        <div style="font-weight:700;font-size:${isA5 ? '10pt' : '11pt'};color:#1c1917;">${doc.clientName}</div>
        ${doc.clientPhone ? `<div style="color:#57534e;">${doc.clientPhone}</div>` : ''}
        ${doc.clientAddress ? `<div style="color:#78716c;font-size:${isA5 ? '8pt' : '9pt'};">${doc.clientAddress}</div>` : ''}
        ${doc.clientTaxNumber ? `<div style="color:#a8a29e;font-size:8pt;">NIF: ${doc.clientTaxNumber}</div>` : ''}
      </td>
      <td style="vertical-align:top;">
        <table style="width:auto;float:right;">
          <tr><td style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:${gold};font-weight:700;padding:4px 0;">Date</td><td style="padding:4px 0 4px 20px;font-weight:600;">${formatDate(doc.date)}</td></tr>
          ${doc.dateEcheance ? `<tr><td style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:${gold};font-weight:700;padding:4px 0;">Echeance</td><td style="padding:4px 0 4px 20px;font-weight:600;">${formatDate(doc.dateEcheance)}</td></tr>` : ''}
        </table>
      </td>
    </tr></table>

    <table style="margin-bottom:${isA5 ? '14px' : '20px'};">
      <thead><tr style="border-bottom:2px solid #1c1917;">
        <th style="text-align:left;padding:10px 16px;font-size:8pt;text-transform:uppercase;letter-spacing:1.5px;color:#57534e;font-weight:700;">Description</th>
        <th style="text-align:center;padding:10px 16px;font-size:8pt;text-transform:uppercase;letter-spacing:1.5px;color:#57534e;font-weight:700;">Qte</th>
        <th style="text-align:right;padding:10px 16px;font-size:8pt;text-transform:uppercase;letter-spacing:1.5px;color:#57534e;font-weight:700;">P.U.</th>
        ${company.tva_enabled ? `<th style="text-align:center;padding:10px 16px;font-size:8pt;text-transform:uppercase;letter-spacing:1.5px;color:#57534e;font-weight:700;">TVA</th>` : ''}
        <th style="text-align:right;padding:10px 16px;font-size:8pt;text-transform:uppercase;letter-spacing:1.5px;color:#57534e;font-weight:700;">Montant</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table style="width:100%;margin-bottom:${isA5 ? '14px' : '20px'};"><tr>
      <td style="vertical-align:top;">${doc.notes ? `<div style="padding:12px 16px;background:${goldLight};border-radius:4px;"><div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:${gold};font-weight:700;margin-bottom:4px;">Notes</div><div style="color:#78350f;font-size:${fontSize};">${doc.notes}</div></div>` : ''}</td>
      <td style="width:${isA5 ? '200px' : '260px'};vertical-align:top;">
        <table style="width:100%;"><tbody>
          ${company.tva_enabled && doc.tvaMontant > 0 ? `<tr><td style="padding:5px 16px;color:#78716c;">Sous-total HT</td><td style="padding:5px 16px;text-align:right;color:#78716c;">${formatCurrency(doc.sousTotal, company.currency_symbol)}</td></tr><tr><td style="padding:5px 16px;color:#78716c;">TVA</td><td style="padding:5px 16px;text-align:right;color:#78716c;">${formatCurrency(doc.tvaMontant, company.currency_symbol)}</td></tr>` : ''}
          <tr style="border-top:2px solid #1c1917;"><td style="padding:10px 16px;font-weight:700;font-size:12pt;color:#1c1917;">Total</td><td style="padding:10px 16px;text-align:right;font-weight:700;font-size:12pt;color:#1c1917;">${formatCurrency(doc.total, company.currency_symbol)}</td></tr>
          ${doc.montantPaye && doc.montantPaye > 0 ? `<tr><td style="padding:5px 16px;color:#16a34a;font-weight:600;">Paye</td><td style="padding:5px 16px;text-align:right;color:#16a34a;font-weight:600;">${formatCurrency(doc.montantPaye, company.currency_symbol)}</td></tr>` : ''}
          ${doc.resteAPayer && doc.resteAPayer > 0 ? `<tr style="background:#fef2f2;"><td style="padding:6px 16px;color:#dc2626;font-weight:700;">Reste</td><td style="padding:6px 16px;text-align:right;color:#dc2626;font-weight:700;">${formatCurrency(doc.resteAPayer, company.currency_symbol)}</td></tr>` : ''}
        </tbody></table>
      </td>
    </tr></table>

    <div style="margin-top:${isA5 ? '24px' : '40px'};text-align:center;border-top:1px solid #d6d3d1;padding-top:10px;">
      <div style="font-size:8pt;color:#a8a29e;letter-spacing:0.5px;">${company.name}${company.tax_number ? ` | ${company.tax_number}` : ''}${company.phone ? ` | ${company.phone}` : ''}</div>
    </div>
  </body></html>`;
}

function buildMinimal(doc: DocumentData, company: Company, isA5: boolean): string {
  const typeLabel = doc.type === 'facture' ? 'Facture' : 'Devis';
  const fontSize = isA5 ? '9pt' : '10pt';
  const pageMargin = isA5 ? '12mm' : '16mm';
  const dark = '#111827';

  const rows = doc.lignes.map(l => {
    const unite = getUnite(l);
    const isGroupHeader = !l.produit_id && l.quantite === 0 && l.prix_unitaire === 0;
    if (isGroupHeader) return `<tr><td colspan="${company.tva_enabled ? 5 : 4}" style="padding:14px 0 6px;font-weight:700;font-size:${fontSize};color:${dark};letter-spacing:0.5px;">${l.designation}</td></tr>`;
    return `<tr>
      <td style="padding:10px 0;color:${dark};">${l.designation}${l.type_vente === 'conditionnement' ? `<span style="font-size:7pt;color:#9ca3af;margin-left:4px;">Cond.</span>` : ''}</td>
      <td style="padding:10px 0;text-align:center;color:#6b7280;">${l.quantite.toFixed(2)}${unite ? ` ${unite}` : ''}</td>
      <td style="padding:10px 0;text-align:right;color:#6b7280;">${formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
      ${company.tva_enabled ? `<td style="padding:10px 0;text-align:center;color:#9ca3af;">${l.tva_taux}%</td>` : ''}
      <td style="padding:10px 0;text-align:right;font-weight:600;color:${dark};">${formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${typeLabel} ${doc.numero}</title>
    <style>@page{size:${isA5 ? 'A5' : 'A4'};margin:${pageMargin};}*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:${fontSize};color:${dark};line-height:1.5;}table{border-collapse:collapse;width:100%;}</style>
  </head><body>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:${isA5 ? '24px' : '36px'};">
      <div>
        ${company.logo_url ? `<img src="${company.logo_url}" style="height:${isA5 ? '40px' : '52px'};object-fit:contain;display:block;margin-bottom:8px;" />` : ''}
        <div style="font-size:${isA5 ? '11pt' : '13pt'};font-weight:800;color:${dark};">${company.name}</div>
        <div style="color:#9ca3af;font-size:${isA5 ? '8pt' : '8.5pt'};margin-top:2px;">${[company.address, company.phone, company.email].filter(Boolean).join(' | ')}</div>
        ${company.tax_number ? `<div style="color:#d1d5db;font-size:8pt;">${company.tax_number}</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-size:${isA5 ? '24pt' : '32pt'};font-weight:900;color:${dark};line-height:1;letter-spacing:-1px;">${typeLabel.toUpperCase()}</div>
        <div style="font-size:${isA5 ? '10pt' : '12pt'};color:#6b7280;margin-top:4px;">${doc.numero}</div>
        ${doc.statut ? `<div style="margin-top:6px;">${statutBadgeHtml(doc.statut)}</div>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:${isA5 ? '16px' : '24px'};margin-bottom:${isA5 ? '20px' : '30px'};padding:${isA5 ? '12px 0' : '16px 0'};border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
      <div style="flex:1;">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;margin-bottom:4px;">Client</div>
        <div style="font-weight:700;font-size:${isA5 ? '10pt' : '11pt'};">${doc.clientName}</div>
        ${doc.clientPhone ? `<div style="color:#6b7280;margin-top:2px;">${doc.clientPhone}</div>` : ''}
        ${doc.clientAddress ? `<div style="color:#9ca3af;font-size:${isA5 ? '8pt' : '9pt'};">${doc.clientAddress}</div>` : ''}
      </div>
      <div style="min-width:${isA5 ? '110px' : '140px'};">
        <div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;margin-bottom:4px;">Date</div>
        <div style="font-weight:600;">${formatDate(doc.date)}</div>
        ${doc.dateEcheance ? `<div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;margin-top:10px;margin-bottom:4px;">Echeance</div><div style="font-weight:600;">${formatDate(doc.dateEcheance)}</div>` : ''}
      </div>
    </div>

    <table style="margin-bottom:${isA5 ? '20px' : '28px'};">
      <thead><tr style="border-bottom:1px solid ${dark};">
        <th style="text-align:left;padding:8px 0;font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;">Description</th>
        <th style="text-align:center;padding:8px 0;font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;">Qte</th>
        <th style="text-align:right;padding:8px 0;font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;">P.U.</th>
        ${company.tva_enabled ? `<th style="text-align:center;padding:8px 0;font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;">TVA</th>` : ''}
        <th style="text-align:right;padding:8px 0;font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;">Montant</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table style="width:100%;margin-bottom:${isA5 ? '14px' : '20px'};"><tr>
      <td style="vertical-align:top;">${doc.notes ? `<div style="padding:10px 0;border-top:1px solid #e5e7eb;"><div style="font-size:7.5pt;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;font-weight:600;margin-bottom:4px;">Notes</div><div style="color:#6b7280;font-size:${fontSize};">${doc.notes}</div></div>` : ''}</td>
      <td style="width:${isA5 ? '190px' : '240px'};vertical-align:top;">
        <table style="width:100%;"><tbody>
          ${company.tva_enabled && doc.tvaMontant > 0 ? `<tr><td style="padding:4px 0;color:#9ca3af;">Sous-total HT</td><td style="padding:4px 0;text-align:right;color:#9ca3af;">${formatCurrency(doc.sousTotal, company.currency_symbol)}</td></tr><tr><td style="padding:4px 0;color:#9ca3af;">TVA</td><td style="padding:4px 0;text-align:right;color:#9ca3af;">${formatCurrency(doc.tvaMontant, company.currency_symbol)}</td></tr>` : ''}
          <tr style="border-top:2px solid ${dark};"><td style="padding:10px 0;font-weight:900;font-size:${isA5 ? '12pt' : '14pt'};">Total</td><td style="padding:10px 0;text-align:right;font-weight:900;font-size:${isA5 ? '12pt' : '14pt'};">${formatCurrency(doc.total, company.currency_symbol)}</td></tr>
          ${doc.montantPaye && doc.montantPaye > 0 ? `<tr><td style="padding:4px 0;color:#16a34a;font-weight:600;">Paye</td><td style="padding:4px 0;text-align:right;color:#16a34a;font-weight:600;">${formatCurrency(doc.montantPaye, company.currency_symbol)}</td></tr>` : ''}
          ${doc.resteAPayer && doc.resteAPayer > 0 ? `<tr><td style="padding:4px 0;color:#dc2626;font-weight:700;">Reste</td><td style="padding:4px 0;text-align:right;color:#dc2626;font-weight:700;">${formatCurrency(doc.resteAPayer, company.currency_symbol)}</td></tr>` : ''}
        </tbody></table>
      </td>
    </tr></table>

    <div style="margin-top:${isA5 ? '24px' : '44px'};text-align:center;color:#d1d5db;font-size:8pt;">
      ${company.name}${company.tax_number ? ` . ${company.tax_number}` : ''}
    </div>
  </body></html>`;
}

export function buildInvoiceHtml(
  doc: DocumentData,
  company: Company,
  format: 'A4' | 'A5',
  template: TemplateStyle
): string {
  const isA5 = format === 'A5';
  switch (template) {
    case 'modern': return buildModern(doc, company, isA5);
    case 'elegant': return buildElegant(doc, company, isA5);
    case 'minimal': return buildMinimal(doc, company, isA5);
    default: return buildClassic(doc, company, isA5);
  }
}
