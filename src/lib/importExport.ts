import * as XLSX from 'xlsx';

export type EntityType = 'produits' | 'clients' | 'fournisseurs';

export interface ImportResult {
  success: number;
  errors: { row: number; message: string }[];
}

// ─── Template Column type ────────────────────────────────────────────────────

export interface TemplateColumn {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  example: string;
}

// ─── Excel helpers ───────────────────────────────────────────────────────────

function downloadXlsx(filename: string, wb: XLSX.WorkBook) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function createTemplateWorkbook(
  title: string,
  columns: TemplateColumn[],
  examples: Record<string, string>[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const dataRows: unknown[][] = [
    [title],
    ['>>> Remplissez vos données sous les lignes d\'exemples. Ne modifiez pas la ligne des colonnes.'],
    columns.map(c => c.label),
    ...examples.map(ex => columns.map(c => ex[c.key] ?? '')),
  ];

  const ws = XLSX.utils.aoa_to_sheet(dataRows);

  const colWidths = columns.map(c => ({ wch: Math.max(c.label.length + 4, 18) }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Import');

  const guideRows: unknown[][] = [
    ['Colonne', 'Description', 'Exemple', 'Obligatoire'],
    ...columns.map(c => [c.label, c.hint, c.example, c.required ? 'OUI' : 'Non']),
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 28 }, { wch: 55 }, { wch: 22 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Guide');

  return wb;
}

export function parseXlsx(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as string[][];
        resolve(rows.filter(r => r.some(c => String(c).trim() !== '')));
      } catch {
        reject(new Error('Fichier Excel invalide ou corrompu'));
      }
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier'));
    reader.readAsArrayBuffer(file);
  });
}

export function parseCsv(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 2; }
      else if (ch === '"') { inQuotes = false; i++; }
      else { cell += ch; i++; }
    } else {
      if (ch === '"') { inQuotes = true; i++; }
      else if (ch === ',') { row.push(cell); cell = ''; i++; }
      else if (ch === '\n') { row.push(cell); cell = ''; lines.push(row); row = []; i++; }
      else if (ch === '\r' && text[i + 1] === '\n') { row.push(cell); cell = ''; lines.push(row); row = []; i += 2; }
      else { cell += ch; i++; }
    }
  }
  if (cell || row.length > 0) { row.push(cell); lines.push(row); }
  return lines.filter(r => r.some(c => c.trim() !== ''));
}

function buildColumnMap(headerRow: string[], columns: TemplateColumn[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((cell, i) => {
    const normalized = cell.trim().toLowerCase();
    const col = columns.find(c =>
      c.label.toLowerCase() === normalized || c.key.toLowerCase() === normalized
    );
    if (col) map[col.key] = i;
  });
  return map;
}

function getCell(row: string[], map: Record<string, number>, key: string): string {
  const idx = map[key];
  return idx !== undefined ? (String(row[idx] ?? '').trim()) : '';
}

function isSkippableRow(row: string[]): boolean {
  const first = row[0]?.trim() || '';
  return (
    first === '' ||
    first.startsWith('>>>') ||
    first.startsWith('MODELE') ||
    first.startsWith('OBLIGATOIRE') ||
    first.startsWith('Optionnel')
  );
}

// ─── Produits ────────────────────────────────────────────────────────────────

export const PRODUITS_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { key: 'nom', label: 'Nom', hint: 'Nom du produit', required: true, example: 'Riz Brisé 25kg' },
  { key: 'reference', label: 'Référence', hint: 'Code ou référence unique', required: false, example: 'RIZ-25' },
  { key: 'description', label: 'Description', hint: 'Description courte du produit', required: false, example: 'Riz brisé importé' },
  { key: 'prix_achat', label: 'Prix achat', hint: 'Prix d\'achat (nombre entier ou décimal)', required: false, example: '12000' },
  { key: 'prix_vente', label: 'Prix vente', hint: 'Prix de vente (nombre entier ou décimal)', required: true, example: '15000' },
  { key: 'stock_actuel', label: 'Stock actuel', hint: 'Quantité en stock au moment de l\'import', required: false, example: '200' },
  { key: 'stock_minimum', label: 'Stock minimum', hint: 'Seuil d\'alerte stock bas', required: false, example: '20' },
  { key: 'unite', label: 'Unité', hint: 'Unité de mesure: pièce / kg / litre / boite / sac / sachet / mètre...', required: false, example: 'sac' },
  { key: 'tva_taux', label: 'TVA (%)', hint: 'Taux de TVA en pourcentage: 0, 10, 18 ou 20', required: false, example: '0' },
  { key: 'conditionnement_nom', label: 'Conditionnement', hint: 'Nom du conditionnement groupé (ex: Carton, Palette)', required: false, example: 'Palette' },
  { key: 'quantite_par_conditionnement', label: 'Qté / conditionnement', hint: 'Nombre d\'unités par conditionnement', required: false, example: '50' },
  { key: 'prix_conditionnement', label: 'Prix conditionnement', hint: 'Prix du conditionnement entier (laisser vide si non applicable)', required: false, example: '700000' },
];

export const PRODUITS_TEMPLATE_EXAMPLES: Record<string, string>[] = [
  { nom: 'Riz Brisé 25kg', reference: 'RIZ-25', description: 'Riz brisé importé', prix_achat: '12000', prix_vente: '15000', stock_actuel: '200', stock_minimum: '20', unite: 'sac', tva_taux: '0', conditionnement_nom: 'Palette', quantite_par_conditionnement: '50', prix_conditionnement: '700000' },
  { nom: 'Huile Végétale 1L', reference: 'HUI-1L', description: 'Huile de cuisine', prix_achat: '800', prix_vente: '1100', stock_actuel: '500', stock_minimum: '50', unite: 'litre', tva_taux: '18', conditionnement_nom: 'Carton', quantite_par_conditionnement: '12', prix_conditionnement: '12500' },
  { nom: 'Sucre 1kg', reference: 'SUC-1KG', description: '', prix_achat: '450', prix_vente: '600', stock_actuel: '300', stock_minimum: '30', unite: 'kg', tva_taux: '0', conditionnement_nom: '', quantite_par_conditionnement: '', prix_conditionnement: '' },
  { nom: 'Savon de Ménage', reference: 'SAV-001', description: 'Savon 200g', prix_achat: '150', prix_vente: '250', stock_actuel: '150', stock_minimum: '15', unite: 'pièce', tva_taux: '0', conditionnement_nom: 'Carton', quantite_par_conditionnement: '24', prix_conditionnement: '5500' },
];

export function downloadProduitsTemplate(companyName: string) {
  const wb = createTemplateWorkbook(
    `MODELE IMPORT PRODUITS - ${companyName}`,
    PRODUITS_TEMPLATE_COLUMNS,
    PRODUITS_TEMPLATE_EXAMPLES,
  );
  downloadXlsx(`modele_produits_${companyName.replace(/\s+/g, '_')}.xlsx`, wb);
}

export function exportProduits(produits: Record<string, unknown>[], companyName: string) {
  const wb = XLSX.utils.book_new();
  const rows = produits.map(p => ({
    'Nom': p.name,
    'Référence': p.reference,
    'Description': p.description,
    'Prix achat': p.prix_achat,
    'Prix vente': p.prix_vente,
    'Stock actuel': p.stock_actuel,
    'Stock minimum': p.stock_minimum,
    'Unité': p.unite,
    'TVA (%)': p.tva_taux,
    'Conditionnement': p.conditionnement_nom,
    'Qté / conditionnement': p.quantite_par_conditionnement,
    'Prix conditionnement': p.prix_conditionnement ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Produits');
  downloadXlsx(`produits_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`, wb);
}

export function parseProduits(
  rows: string[][],
  companyId: string
): { data: Record<string, unknown>[]; errors: { row: number; message: string }[] } {
  const headerIdx = rows.findIndex(r => {
    const v = r[0]?.trim().toLowerCase();
    return v === 'nom' || v === 'name';
  });
  if (headerIdx < 0) return { data: [], errors: [{ row: 1, message: 'Ligne d\'en-tête introuvable (colonne "Nom" manquante)' }] };

  const colMap = buildColumnMap(rows[headerIdx], PRODUITS_TEMPLATE_COLUMNS);
  const dataRows = rows.slice(headerIdx + 1).filter(r => !isSkippableRow(r));
  const data: Record<string, unknown>[] = [];
  const errors: { row: number; message: string }[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const g = (key: string) => getCell(row, colMap, key);

    const nom = g('nom');
    if (!nom) { errors.push({ row: rowNum, message: 'Le nom est obligatoire' }); return; }
    const pv = parseFloat(g('prix_vente'));
    if (isNaN(pv)) { errors.push({ row: rowNum, message: 'Prix vente invalide' }); return; }

    const condNom = g('conditionnement_nom');
    const qcond = parseInt(g('quantite_par_conditionnement')) || 1;
    const pcondRaw = g('prix_conditionnement');
    const pcond = pcondRaw ? parseFloat(pcondRaw) : null;

    data.push({
      company_id: companyId,
      name: nom,
      reference: g('reference'),
      description: g('description'),
      prix_achat: parseFloat(g('prix_achat')) || 0,
      prix_vente: pv,
      stock_actuel: parseFloat(g('stock_actuel')) || 0,
      stock_minimum: parseFloat(g('stock_minimum')) || 0,
      unite: g('unite') || 'unité',
      tva_taux: parseFloat(g('tva_taux')) || 0,
      conditionnement_nom: condNom,
      conditionnement: condNom,
      quantite_par_conditionnement: qcond,
      conditionnement_quantite: qcond,
      prix_conditionnement: pcond !== null && !isNaN(pcond) ? pcond : null,
      is_active: true,
      category_id: null,
    });
  });

  return { data, errors };
}

// ─── Clients ─────────────────────────────────────────────────────────────────

export const CLIENTS_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { key: 'nom', label: 'Nom', hint: 'Nom complet ou raison sociale du client', required: true, example: 'Mamadou Diallo' },
  { key: 'telephone', label: 'Téléphone', hint: 'Numéro de téléphone', required: false, example: '771234567' },
  { key: 'email', label: 'Email', hint: 'Adresse email', required: false, example: 'client@email.com' },
  { key: 'adresse', label: 'Adresse', hint: 'Adresse physique complète', required: false, example: 'Dakar - Plateau' },
  { key: 'numero_fiscal', label: 'N° fiscal', hint: 'Numéro NINEA, NIF ou numéro TVA (optionnel)', required: false, example: 'SN-12345' },
  { key: 'limite_credit', label: 'Limite crédit', hint: 'Plafond de crédit autorisé (0 = aucune limite)', required: false, example: '500000' },
  { key: 'encours', label: 'Encours', hint: 'Solde dû par le client (montant positif = dette client)', required: false, example: '150000' },
  { key: 'notes', label: 'Notes', hint: 'Notes internes sur ce client', required: false, example: 'Client régulier' },
];

export const CLIENTS_TEMPLATE_EXAMPLES: Record<string, string>[] = [
  { nom: 'Mamadou Diallo', telephone: '771234567', email: 'mdiallo@email.com', adresse: 'Dakar - Plateau', numero_fiscal: 'SN-12345', limite_credit: '500000', encours: '150000', notes: 'Client régulier' },
  { nom: 'Fatou Ndiaye SARL', telephone: '338456789', email: 'contact@fatoundiaye.sn', adresse: 'Thiès - Centre ville', numero_fiscal: '', limite_credit: '0', encours: '0', notes: '' },
  { nom: 'Boutique Centrale', telephone: '779876543', email: '', adresse: 'Ziguinchor - Marché central', numero_fiscal: '', limite_credit: '200000', encours: '75000', notes: 'Paiement mensuel' },
];

export function downloadClientsTemplate(companyName: string) {
  const wb = createTemplateWorkbook(
    `MODELE IMPORT CLIENTS - ${companyName}`,
    CLIENTS_TEMPLATE_COLUMNS,
    CLIENTS_TEMPLATE_EXAMPLES,
  );
  downloadXlsx(`modele_clients_${companyName.replace(/\s+/g, '_')}.xlsx`, wb);
}

export function exportClients(clients: Record<string, unknown>[], companyName: string) {
  const wb = XLSX.utils.book_new();
  const rows = clients.map(c => ({
    'Nom': c.name,
    'Téléphone': c.phone,
    'Email': c.email,
    'Adresse': c.address,
    'N° fiscal': c.tax_number,
    'Limite crédit': c.credit_limit,
    'Encours': c.balance,
    'Notes': c.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 35 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Clients');
  downloadXlsx(`clients_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`, wb);
}

export function parseClients(
  rows: string[][],
  companyId: string
): { data: Record<string, unknown>[]; errors: { row: number; message: string }[] } {
  const headerIdx = rows.findIndex(r => r[0]?.trim().toLowerCase() === 'nom');
  if (headerIdx < 0) return { data: [], errors: [{ row: 1, message: 'Ligne d\'en-tête introuvable (colonne "Nom" manquante)' }] };

  const colMap = buildColumnMap(rows[headerIdx], CLIENTS_TEMPLATE_COLUMNS);
  const dataRows = rows.slice(headerIdx + 1).filter(r => !isSkippableRow(r));
  const data: Record<string, unknown>[] = [];
  const errors: { row: number; message: string }[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const g = (key: string) => getCell(row, colMap, key);

    const nom = g('nom');
    if (!nom) { errors.push({ row: rowNum, message: 'Le nom est obligatoire' }); return; }

    data.push({
      company_id: companyId,
      name: nom,
      phone: g('telephone'),
      email: g('email'),
      address: g('adresse'),
      tax_number: g('numero_fiscal'),
      credit_limit: parseFloat(g('limite_credit')) || 0,
      balance: parseFloat(g('encours')) || 0,
      notes: g('notes'),
      is_active: true,
    });
  });

  return { data, errors };
}

// ─── Fournisseurs ─────────────────────────────────────────────────────────────

export const FOURNISSEURS_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { key: 'nom', label: 'Nom', hint: 'Nom complet ou raison sociale du fournisseur', required: true, example: 'Importex SARL' },
  { key: 'telephone', label: 'Téléphone', hint: 'Numéro de téléphone', required: false, example: '338456789' },
  { key: 'email', label: 'Email', hint: 'Adresse email de contact', required: false, example: 'contact@importex.sn' },
  { key: 'adresse', label: 'Adresse', hint: 'Adresse physique complète', required: false, example: 'Dakar - Zone industrielle' },
  { key: 'numero_fiscal', label: 'N° fiscal', hint: 'Numéro NINEA, NIF ou registre de commerce (optionnel)', required: false, example: 'SN-98765' },
  { key: 'encours', label: 'Encours', hint: 'Solde dû au fournisseur (montant positif = dette envers fournisseur)', required: false, example: '250000' },
  { key: 'notes', label: 'Notes', hint: 'Notes internes sur ce fournisseur', required: false, example: 'Livraison sous 48h' },
];

export const FOURNISSEURS_TEMPLATE_EXAMPLES: Record<string, string>[] = [
  { nom: 'Importex SARL', telephone: '338456789', email: 'contact@importex.sn', adresse: 'Dakar - Zone industrielle', numero_fiscal: 'SN-98765', encours: '250000', notes: 'Livraison sous 48h' },
  { nom: 'Distribouest SA', telephone: '771122334', email: 'orders@distribouest.com', adresse: 'Thiès - Quartier commercial', numero_fiscal: '', encours: '0', notes: '' },
  { nom: 'Grossiste El Hadj Diop', telephone: '779988776', email: '', adresse: 'Touba - Marché Ocas', numero_fiscal: '', encours: '180000', notes: 'Commande minimum 100 000 F' },
];

export function downloadFournisseursTemplate(companyName: string) {
  const wb = createTemplateWorkbook(
    `MODELE IMPORT FOURNISSEURS - ${companyName}`,
    FOURNISSEURS_TEMPLATE_COLUMNS,
    FOURNISSEURS_TEMPLATE_EXAMPLES,
  );
  downloadXlsx(`modele_fournisseurs_${companyName.replace(/\s+/g, '_')}.xlsx`, wb);
}

export function exportFournisseurs(fournisseurs: Record<string, unknown>[], companyName: string) {
  const wb = XLSX.utils.book_new();
  const rows = fournisseurs.map(f => ({
    'Nom': f.name,
    'Téléphone': f.phone,
    'Email': f.email,
    'Adresse': f.address,
    'N° fiscal': f.tax_number,
    'Encours': f.balance,
    'Notes': f.notes,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 35 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Fournisseurs');
  downloadXlsx(`fournisseurs_${companyName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`, wb);
}

export function parseFournisseurs(
  rows: string[][],
  companyId: string
): { data: Record<string, unknown>[]; errors: { row: number; message: string }[] } {
  const headerIdx = rows.findIndex(r => r[0]?.trim().toLowerCase() === 'nom');
  if (headerIdx < 0) return { data: [], errors: [{ row: 1, message: 'Ligne d\'en-tête introuvable (colonne "Nom" manquante)' }] };

  const colMap = buildColumnMap(rows[headerIdx], FOURNISSEURS_TEMPLATE_COLUMNS);
  const dataRows = rows.slice(headerIdx + 1).filter(r => !isSkippableRow(r));
  const data: Record<string, unknown>[] = [];
  const errors: { row: number; message: string }[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = headerIdx + idx + 2;
    const g = (key: string) => getCell(row, colMap, key);

    const nom = g('nom');
    if (!nom) { errors.push({ row: rowNum, message: 'Le nom est obligatoire' }); return; }

    data.push({
      company_id: companyId,
      name: nom,
      phone: g('telephone'),
      email: g('email'),
      address: g('adresse'),
      tax_number: g('numero_fiscal'),
      balance: parseFloat(g('encours')) || 0,
      notes: g('notes'),
      is_active: true,
    });
  });

  return { data, errors };
}
