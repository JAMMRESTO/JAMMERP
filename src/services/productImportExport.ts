import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Product, Category } from '../lib/types';

export interface ImportRow {
  designation: string;
  categorie: string;
  prix: number;
}

export interface ValidatedRow extends ImportRow {
  lineNumber: number;
  categoryId: string | null;
  isNewCategory: boolean;
  error?: string;
}

export interface ValidationResult {
  valid: ValidatedRow[];
  errors: ValidatedRow[];
  categoriesToCreate: string[];
}

export interface ImportResult {
  categoriesCreated: number;
  productsCreated: number;
  productsUpdated: number;
  errors: string[];
}

const HEADER_ALIASES: Record<string, string[]> = {
  designation: ['designation', 'nom', 'produit', 'libelle', 'libellé', 'name', 'product'],
  categorie: ['categorie', 'catégorie', 'category', 'famille', 'type'],
  prix: ['prix', 'price', 'montant', 'cout', 'coût', 'amount'],
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function resolveCategoryLabel(categoryId: string, categories: Category[]): string {
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) return '';
  if (cat.parent_id) {
    const parent = categories.find(c => c.id === cat.parent_id);
    return parent ? `${parent.nom} › ${cat.nom}` : cat.nom;
  }
  return cat.nom;
}

function parseCategoryLabel(label: string, categories: Category[]): { id: string | null; isNew: boolean } {
  const trimmed = label.trim();
  if (!trimmed) return { id: null, isNew: false };

  // Try exact match on full label (Parent › Sub)
  const exact = categories.find(c => resolveCategoryLabel(c.id, categories).toLowerCase() === trimmed.toLowerCase());
  if (exact) return { id: exact.id, isNew: false };

  // Try match on category name only (last segment after ›)
  const lastSegment = trimmed.split('›').pop()?.trim() || trimmed;
  const byName = categories.find(c => c.nom.toLowerCase() === lastSegment.toLowerCase());
  if (byName) return { id: byName.id, isNew: false };

  // Not found -> will be created
  return { id: null, isNew: true };
}

function cellToNumber(cell: any): number | null {
  if (cell == null) return null;
  if (typeof cell === 'number') return Math.round(cell);
  if (typeof cell === 'string') {
    const cleaned = cell.replace(/[^\d.,-]/g, '').replace(/\s/g, '');
    const normalized = cleaned.replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? null : Math.round(n);
  }
  if (typeof cell === 'boolean') return null;
  return null;
}

function cellToString(cell: any): string {
  if (cell == null) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return String(cell);
  return String(cell).trim();
}

export function exportProductsToExcel(products: Product[], categories: Category[]): void {
  const rows = products.map(p => ({
    Designation: p.nom,
    Categorie: resolveCategoryLabel(p.category_id, categories),
    Prix: p.prix,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Designation', 'Categorie', 'Prix'] });
  ws['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produits');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `produits_export_${date}.xlsx`);
}

export function downloadProductTemplate(categories: Category[]): void {
  const exampleRows = [
    { Designation: 'Thiéboudienne', Categorie: 'Plats', Prix: 2500 },
    { Designation: 'Attiéké Poulet', Categorie: 'Plats', Prix: 2000 },
    { Designation: 'Jus Bissap', Categorie: 'Boissons', Prix: 500 },
  ];
  const ws = XLSX.utils.json_to_sheet(exampleRows, { header: ['Designation', 'Categorie', 'Prix'] });
  ws['!cols'] = [{ wch: 32 }, { wch: 28 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produits');

  // Second sheet listing existing categories to guide the user
  const catRows = categories.map(c => ({
    Categorie: resolveCategoryLabel(c.id, categories),
    Actif: c.actif ? 'Oui' : 'Non',
  }));
  const catWs = XLSX.utils.json_to_sheet(catRows, { header: ['Categorie', 'Actif'] });
  catWs['!cols'] = [{ wch: 32 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, catWs, 'Categories existantes');

  XLSX.writeFile(wb, 'modele_import_produits.xlsx');
}

export async function parseProductsExcel(file: File): Promise<ImportRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  if (wb.SheetNames.length === 0) throw new Error('Le fichier ne contient aucune feuille.');

  // Pick first sheet whose name contains "produit", else first sheet
  let sheetName = wb.SheetNames.find(n => /produit/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Feuille introuvable.');

  const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null, blankrows: false });
  if (raw.length === 0) throw new Error('La feuille est vide.');

  const headers = (raw[0] as any[]).map(h => cellToString(h));
  const desigIdx = findColumnIndex(headers, HEADER_ALIASES.designation);
  const catIdx = findColumnIndex(headers, HEADER_ALIASES.categorie);
  const prixIdx = findColumnIndex(headers, HEADER_ALIASES.prix);

  if (desigIdx === -1) throw new Error('Colonne "Designation" introuvable. En-têtes détectés : ' + headers.join(', '));
  if (catIdx === -1) throw new Error('Colonne "Categorie" introuvable. En-têtes détectés : ' + headers.join(', '));
  if (prixIdx === -1) throw new Error('Colonne "Prix" introuvable. En-têtes détectés : ' + headers.join(', '));

  const rows: ImportRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as any[];
    const designation = cellToString(r[desigIdx]);
    const categorie = cellToString(r[catIdx]);
    const prix = cellToNumber(r[prixIdx]);
    if (!designation && !categorie && (prix == null)) continue; // skip fully empty
    rows.push({ designation, categorie, prix: prix ?? 0 });
  }
  return rows;
}

export function validateImportRows(rows: ImportRow[], categories: Category[]): ValidationResult {
  const valid: ValidatedRow[] = [];
  const errors: ValidatedRow[] = [];
  const categoriesToCreateSet = new Set<string>();

  rows.forEach((row, idx) => {
    const lineNumber = idx + 2; // +1 for header, +1 for 1-based
    const { id: categoryId, isNew } = parseCategoryLabel(row.categorie, categories);

    let error: string | undefined;
    if (!row.designation.trim()) error = 'Désignation vide';
    else if (row.prix == null || isNaN(row.prix)) error = 'Prix invalide';
    else if (row.prix < 0) error = 'Prix négatif';

    const validated: ValidatedRow = {
      ...row,
      lineNumber,
      categoryId,
      isNewCategory: isNew,
      error,
    };

    if (isNew && row.categorie.trim()) categoriesToCreateSet.add(row.categorie.trim());

    if (error) errors.push(validated);
    else valid.push(validated);
  });

  return {
    valid,
    errors,
    categoriesToCreate: Array.from(categoriesToCreateSet),
  };
}

export async function importProducts(
  validRows: ValidatedRow[],
  existingCategories: Category[],
  mode: 'merge' | 'replace'
): Promise<ImportResult> {
  const result: ImportResult = {
    categoriesCreated: 0,
    productsCreated: 0,
    productsUpdated: 0,
    errors: [],
  };

  // 1. Create missing categories
  const categoryMap = new Map<string, string>(); // label(lowercase) -> id
  existingCategories.forEach(c => {
    categoryMap.set(resolveCategoryLabel(c.id, existingCategories).toLowerCase(), c.id);
    categoryMap.set(c.nom.toLowerCase(), c.id);
  });

  const labelsToCreate = new Set<string>();
  validRows.forEach(r => {
    if (r.isNewCategory && r.categorie.trim()) labelsToCreate.add(r.categorie.trim());
  });

  let nextOrdre = existingCategories.length;
  for (const label of labelsToCreate) {
    const lastSegment = label.split('›').pop()?.trim() || label;
    const { data, error } = await supabase
      .from('categories')
      .insert({ nom: lastSegment, ordre: nextOrdre++, actif: true })
      .select()
      .single();
    if (error) {
      result.errors.push(`Catégorie "${label}" : ${error.message}`);
    } else if (data) {
      categoryMap.set(label.toLowerCase(), data.id);
      categoryMap.set(lastSegment.toLowerCase(), data.id);
      result.categoriesCreated++;
    }
  }

  // 2. Fetch existing products to match by (nom, category_id)
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, nom, category_id');
  const existingByNomCat = new Map<string, string>();
  (existingProducts || []).forEach((p: any) => {
    existingByNomCat.set(`${p.nom.trim().toLowerCase()}|${p.category_id}`, p.id);
  });

  // 3. Upsert products
  for (const row of validRows) {
    const categoryId = row.isNewCategory
      ? categoryMap.get(row.categorie.trim().toLowerCase())
      : row.categoryId;
    if (!categoryId) {
      result.errors.push(`Ligne ${row.lineNumber} : catégorie introuvable "${row.categorie}"`);
      continue;
    }

    const key = `${row.designation.trim().toLowerCase()}|${categoryId}`;
    const existingId = existingByNomCat.get(key);

    if (existingId) {
      // Update only price, preserve options/variants
      const { error } = await supabase
        .from('products')
        .update({ prix: row.prix })
        .eq('id', existingId);
      if (error) result.errors.push(`Ligne ${row.lineNumber} : ${error.message}`);
      else result.productsUpdated++;
    } else {
      const { data, error } = await supabase
        .from('products')
        .insert({
          nom: row.designation.trim(),
          category_id: categoryId,
          prix: row.prix,
          image_url: '',
          actif: true,
        })
        .select()
        .single();
      if (error) result.errors.push(`Ligne ${row.lineNumber} : ${error.message}`);
      else if (data) {
        existingByNomCat.set(key, data.id);
        result.productsCreated++;
      }
    }
  }

  // mode 'replace' intentionally does NOT delete absent products (safer)
  void mode;

  return result;
}
