import { supabase } from '../lib/supabase';

export interface ExportScope {
  catalog: boolean;
  zones_tables: boolean;
  printers: boolean;
  settings: boolean;
  users: boolean;
  orders: boolean;
  payments: boolean;
  cash_sessions: boolean;
}

export interface RestaurantExport {
  version: string;
  exported_at: string;
  scope: Partial<ExportScope>;
  data: {
    zones?: object[];
    tables?: object[];
    categories?: object[];
    products?: object[];
    product_options?: object[];
    printers?: object[];
    app_settings?: object[];
    users?: object[];
    orders?: object[];
    order_items?: object[];
    order_item_options?: object[];
    payments?: object[];
    cash_sessions?: object[];
    cash_movements?: object[];
    cash_closures?: object[];
  };
}

export interface ResetScope {
  orders: boolean;
  payments: boolean;
  cash_sessions: boolean;
  print_jobs: boolean;
  catalog: boolean;
  zones_tables: boolean;
  printers: boolean;
  users: boolean;
  settings: boolean;
}

export type ImportMode = 'merge' | 'replace';

async function fetchAll(table: string, select = '*', orderBy = 'created_at') {
  let query = supabase.from(table).select(select);
  if (orderBy) query = query.order(orderBy as never);
  const { data, error } = await query;
  if (error) throw new Error(`Export ${table}: ${error.message}`);
  return data ?? [];
}

export async function exportData(scope: ExportScope): Promise<RestaurantExport> {
  const result: RestaurantExport = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    scope,
    data: {},
  };

  if (scope.zones_tables) {
    result.data.zones = await fetchAll('zones');
    result.data.tables = await fetchAll('tables');
  }

  if (scope.catalog) {
    result.data.categories = await fetchAll('categories');
    result.data.products = await fetchAll('products');
    result.data.product_options = await fetchAll('product_options');
  }

  if (scope.printers) {
    result.data.printers = await fetchAll('printers');
  }

  if (scope.settings) {
    result.data.app_settings = await fetchAll('app_settings', '*', 'key');
  }

  if (scope.users) {
    result.data.users = await fetchAll('users');
  }

  if (scope.orders) {
    result.data.orders = await fetchAll('orders');
    result.data.order_items = await fetchAll('order_items');
    result.data.order_item_options = await fetchAll('order_item_options');
  }

  if (scope.payments) {
    result.data.payments = await fetchAll('payments');
  }

  if (scope.cash_sessions) {
    result.data.cash_sessions = await fetchAll('cash_sessions');
    result.data.cash_movements = await fetchAll('cash_movements');
    result.data.cash_closures = await fetchAll('cash_closures');
  }

  return result;
}

export function downloadExport(payload: RestaurantExport): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `senresto_export_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportFile(file: File): Promise<RestaurantExport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.version || !parsed.data) {
          reject(new Error('Format invalide: fichier non reconnu (champs version/data manquants)'));
          return;
        }
        resolve(parsed as RestaurantExport);
      } catch {
        reject(new Error('Fichier JSON invalide'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}

type UpsertRow = Record<string, unknown>;

const TABLE_COLUMNS: Record<string, string[]> = {
  users: ['id', 'nom', 'pin', 'role', 'actif', 'created_at'],
  printers: ['id', 'nom', 'type', 'ip_address', 'port', 'active', 'created_at', 'backup_printer_id', 'connection_type', 'usb_name', 'station', 'restaurant_id'],
  zones: ['id', 'nom', 'ordre', 'created_at', 'restaurant_id'],
  tables: ['id', 'zone_id', 'nom', 'statut', 'created_at', 'locked_by', 'restaurant_id'],
  categories: ['id', 'nom', 'ordre', 'actif', 'created_at', 'printer_id', 'parent_id', 'restaurant_id', 'description'],
  products: ['id', 'category_id', 'nom', 'prix', 'image_url', 'actif', 'created_at', 'restaurant_id', 'description', 'subcategory_id'],
  product_options: ['id', 'product_id', 'nom', 'prix_delta', 'created_at'],
  app_settings: ['id', 'key', 'value', 'updated_at', 'restaurant_id'],
  orders: ['id', 'table_id', 'serveur_id', 'statut', 'total', 'ticket_number', 'created_at', 'updated_at', 'order_type', 'caissier_id'],
  order_items: ['id', 'order_id', 'product_id', 'nom_snapshot', 'prix_snapshot', 'qty', 'printed_qty', 'notes', 'created_at'],
  order_item_options: ['id', 'order_item_id', 'nom_snapshot', 'prix_delta_snapshot', 'created_at'],
  payments: ['id', 'order_id', 'mode', 'montant', 'reference', 'caissier_id', 'created_at', 'method', 'pay_status', 'paid_at', 'session_id'],
  cash_sessions: ['id', 'caissier_id', 'ouverture', 'fermeture', 'total_especes', 'notes', 'created_at', 'status', 'opening_float', 'opened_by', 'closed_by', 'opened_at', 'closed_at'],
  cash_movements: ['id', 'session_id', 'type', 'amount', 'reason', 'created_by', 'created_at'],
  cash_closures: ['id', 'session_id', 'type', 'created_by', 'totals_json', 'excluded_unpaid_count', 'excluded_unpaid_amount', 'cash_counted', 'cash_difference', 'notes', 'created_at'],
};

function stripUnknownColumns(table: string, rows: UpsertRow[]): UpsertRow[] {
  const allowed = TABLE_COLUMNS[table];
  if (!allowed) return rows;
  return rows.map((row) => {
    const cleaned: UpsertRow = {};
    for (const col of allowed) {
      if (col in row) cleaned[col] = row[col];
    }
    return cleaned;
  });
}

async function upsertRows(table: string, rows: UpsertRow[], conflictCol = 'id') {
  if (!rows.length) return;
  const cleaned = stripUnknownColumns(table, rows);
  const { error } = await supabase.from(table).upsert(cleaned as never, { onConflict: conflictCol });
  if (error) throw new Error(`Import ${table}: ${error.message}`);
}

export async function importData(payload: RestaurantExport, mode: ImportMode): Promise<string[]> {
  const log: string[] = [];
  const { data } = payload;

  if (mode === 'replace') {
    log.push('Mode remplacement: les données existantes seront écrasées');
  }

  if (data.printers?.length) {
    await upsertRows('printers', data.printers as UpsertRow[]);
    log.push(`Imprimantes: ${data.printers.length} enregistrements`);
  }

  if (data.zones?.length) {
    await upsertRows('zones', data.zones as UpsertRow[]);
    log.push(`Zones: ${data.zones.length} enregistrements`);
  }

  if (data.tables?.length) {
    await upsertRows('tables', data.tables as UpsertRow[]);
    log.push(`Tables: ${data.tables.length} enregistrements`);
  }

  if (data.categories?.length) {
    await upsertRows('categories', data.categories as UpsertRow[]);
    log.push(`Catégories: ${data.categories.length} enregistrements`);
  }

  if (data.products?.length) {
    await upsertRows('products', data.products as UpsertRow[]);
    log.push(`Produits: ${data.products.length} enregistrements`);
  }

  if (data.product_options?.length) {
    await upsertRows('product_options', data.product_options as UpsertRow[]);
    log.push(`Options produit: ${data.product_options.length} enregistrements`);
  }

  if (data.app_settings?.length) {
    await upsertRows('app_settings', data.app_settings as UpsertRow[], 'restaurant_id,key');
    log.push(`Paramètres: ${data.app_settings.length} enregistrements`);
  }

  if (data.users?.length) {
    await upsertRows('users', data.users as UpsertRow[], 'pin');
    log.push(`Utilisateurs: ${data.users.length} enregistrements`);
  }

  if (data.orders?.length) {
    await upsertRows('orders', data.orders as UpsertRow[]);
    log.push(`Commandes: ${data.orders.length} enregistrements`);
  }

  if (data.order_items?.length) {
    await upsertRows('order_items', data.order_items as UpsertRow[]);
    log.push(`Lignes commande: ${data.order_items.length} enregistrements`);
  }

  if (data.order_item_options?.length) {
    await upsertRows('order_item_options', data.order_item_options as UpsertRow[]);
    log.push(`Options commande: ${data.order_item_options.length} enregistrements`);
  }

  if (data.cash_sessions?.length) {
    await upsertRows('cash_sessions', data.cash_sessions as UpsertRow[]);
    log.push(`Sessions caisse: ${data.cash_sessions.length} enregistrements`);
  }

  if (data.payments?.length) {
    await upsertRows('payments', data.payments as UpsertRow[]);
    log.push(`Paiements: ${data.payments.length} enregistrements`);
  }

  if (data.cash_movements?.length) {
    await upsertRows('cash_movements', data.cash_movements as UpsertRow[]);
    log.push(`Mouvements caisse: ${data.cash_movements.length} enregistrements`);
  }

  if (data.cash_closures?.length) {
    await upsertRows('cash_closures', data.cash_closures as UpsertRow[]);
    log.push(`Clôtures caisse: ${data.cash_closures.length} enregistrements`);
  }

  return log;
}

async function deleteAll(table: string) {
  const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) throw new Error(`Reset ${table}: ${error.message}`);
}

export async function resetData(scope: ResetScope): Promise<string[]> {
  const log: string[] = [];

  if (scope.print_jobs) {
    await deleteAll('print_jobs');
    log.push('File impression effacée');
  }

  if (scope.payments) {
    await deleteAll('payments');
    log.push('Paiements effacés');
  }

  if (scope.cash_sessions) {
    await deleteAll('cash_closures');
    await deleteAll('cash_movements');
    await deleteAll('cash_sessions');
    log.push('Sessions et clôtures caisse effacées');
  }

  if (scope.orders) {
    await deleteAll('order_item_options');
    await deleteAll('order_items');
    await deleteAll('orders');
    log.push('Commandes effacées');
  }

  if (scope.catalog) {
    await deleteAll('product_options');
    await deleteAll('products');
    await deleteAll('categories');
    log.push('Catalogue (catégories + produits) effacé');
  }

  if (scope.zones_tables) {
    await deleteAll('tables');
    await deleteAll('zones');
    log.push('Zones et tables effacées');
  }

  if (scope.printers) {
    await deleteAll('printers');
    log.push('Imprimantes effacées');
  }

  if (scope.users) {
    await deleteAll('user_permissions');
    await deleteAll('users');
    log.push('Utilisateurs effacés');
  }

  if (scope.settings) {
    await deleteAll('app_settings');
    await deleteAll('activity_logs');
    log.push('Paramètres et logs effacés');
  }

  return log;
}

export async function logOperation(
  userId: string | undefined,
  type: 'EXPORT' | 'IMPORT' | 'RESET',
  scopeKeys: string[],
  notes: string
): Promise<void> {
  await supabase.from('data_exports').insert({
    type,
    scope: scopeKeys,
    performed_by: userId ?? null,
    notes,
  });
}
