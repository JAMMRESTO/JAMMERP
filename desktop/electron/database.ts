import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';

let db: SqlJsDatabase;
let dbPath: string;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveToDisk(): void {
  if (!db) return;
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToDisk, 500);
}

function run(sql: string, params?: any[]): void {
  db.run(sql, params);
  scheduleSave();
}

function get(sql: string, params?: any[]): any {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row: any = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    return row;
  }
  stmt.free();
  return undefined;
}

function all(sql: string, params?: any[]): any[] {
  const stmt = db.prepare(sql);
  if (params) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row: any = {};
    cols.forEach((col, i) => { row[col] = vals[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}

export async function initDatabase(): Promise<void> {
  dbPath = join(app.getPath('userData'), 'macaisse.db');

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');
  createTables();
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS societe (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nom TEXT NOT NULL DEFAULT '',
      nom_societe TEXT NOT NULL DEFAULT '',
      telephone TEXT DEFAULT '',
      adresse TEXT DEFAULT '',
      message_ticket TEXT DEFAULT '',
      logo_url TEXT DEFAULT '',
      format_ticket TEXT DEFAULT '80mm',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS caisses (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nom TEXT NOT NULL,
      ordre INTEGER DEFAULT 0,
      fond_de_caisse REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      nom TEXT NOT NULL,
      email TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'caissier',
      pin_code TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      caisse_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (caisse_id) REFERENCES caisses(id)
    );

    CREATE TABLE IF NOT EXISTS comptes_charges (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      numero TEXT NOT NULL,
      libelle TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clotures_caisses (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      caisse_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      date_debut TEXT,
      date_fin TEXT,
      fond_de_caisse REAL DEFAULT 0,
      total_encaissements REAL DEFAULT 0,
      total_decaissements REAL DEFAULT 0,
      solde REAL DEFAULT 0,
      nb_encaissements INTEGER DEFAULT 0,
      nb_decaissements INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (caisse_id) REFERENCES caisses(id),
      FOREIGN KEY (created_by) REFERENCES profiles(id)
    );

    CREATE TABLE IF NOT EXISTS encaissements (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      numero_facture TEXT NOT NULL,
      caisse_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      client_nom TEXT DEFAULT '',
      montant REAL NOT NULL,
      mode_paiement TEXT NOT NULL DEFAULT 'especes',
      montant_recu REAL DEFAULT 0,
      monnaie_rendue REAL DEFAULT 0,
      date_transaction TEXT NOT NULL,
      heure_transaction TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      cloture_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (caisse_id) REFERENCES caisses(id),
      FOREIGN KEY (user_id) REFERENCES profiles(id),
      FOREIGN KEY (cloture_id) REFERENCES clotures_caisses(id)
    );

    CREATE TABLE IF NOT EXISTS decaissements (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      numero_piece TEXT NOT NULL,
      caisse_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      compte_id TEXT,
      compte_numero TEXT DEFAULT '',
      compte_libelle TEXT DEFAULT '',
      description TEXT DEFAULT '',
      montant REAL NOT NULL,
      date_transaction TEXT NOT NULL,
      archived INTEGER DEFAULT 0,
      cloture_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (caisse_id) REFERENCES caisses(id),
      FOREIGN KEY (user_id) REFERENCES profiles(id),
      FOREIGN KEY (compte_id) REFERENCES comptes_charges(id),
      FOREIGN KEY (cloture_id) REFERENCES clotures_caisses(id)
    );

    CREATE INDEX IF NOT EXISTS idx_enc_caisse ON encaissements(caisse_id, archived);
    CREATE INDEX IF NOT EXISTS idx_dec_caisse ON decaissements(caisse_id, archived);
    CREATE INDEX IF NOT EXISTS idx_enc_date ON encaissements(date_transaction);
    CREATE INDEX IF NOT EXISTS idx_dec_date ON decaissements(date_transaction);
  `);

  // Seed default societe if none exists
  const count = get('SELECT COUNT(*) as cnt FROM societe');
  if (count.cnt === 0) {
    run('INSERT INTO societe (id, nom, nom_societe) VALUES (?, ?, ?)',
      [randomUUID(), 'Ma Caisse', 'Ma Societe']);
  }

  // Seed default admin if no profiles exist
  const profileCount = get('SELECT COUNT(*) as cnt FROM profiles');
  if (profileCount.cnt === 0) {
    run('INSERT INTO profiles (id, nom, pin_code, role) VALUES (?, ?, ?, ?)',
      [randomUUID(), 'Administrateur', '0000', 'admin']);
  }

  // Seed a default caisse if none exists
  const caisseCount = get('SELECT COUNT(*) as cnt FROM caisses');
  if (caisseCount.cnt === 0) {
    run('INSERT INTO caisses (id, nom, ordre) VALUES (?, ?, ?)',
      [randomUUID(), 'Caisse 1', 1]);
  }

  saveToDisk();
}

// --- PROFILES / AUTH ---

export function authenticateByPin(pin: string) {
  return get('SELECT * FROM profiles WHERE pin_code = ? AND actif = 1', [pin]);
}

export function getProfile(id: string) {
  return get('SELECT * FROM profiles WHERE id = ?', [id]);
}

export function getAllProfiles() {
  return all('SELECT * FROM profiles ORDER BY nom');
}

export function createProfile(data: { nom: string; pin_code: string; role: string; caisse_id?: string }) {
  const id = randomUUID();
  run('INSERT INTO profiles (id, nom, pin_code, role, caisse_id) VALUES (?, ?, ?, ?, ?)',
    [id, data.nom, data.pin_code, data.role, data.caisse_id || null]);
  return getProfile(id);
}

export function updateProfile(id: string, data: Partial<{ nom: string; pin_code: string; role: string; actif: boolean; caisse_id: string }>) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.nom !== undefined) { fields.push('nom = ?'); values.push(data.nom); }
  if (data.pin_code !== undefined) { fields.push('pin_code = ?'); values.push(data.pin_code); }
  if (data.role !== undefined) { fields.push('role = ?'); values.push(data.role); }
  if (data.actif !== undefined) { fields.push('actif = ?'); values.push(data.actif ? 1 : 0); }
  if (data.caisse_id !== undefined) { fields.push('caisse_id = ?'); values.push(data.caisse_id || null); }
  if (fields.length === 0) return;
  values.push(id);
  run(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteProfile(id: string) {
  run('DELETE FROM profiles WHERE id = ?', [id]);
}

// --- CAISSES ---

export function getAllCaisses() {
  return all('SELECT * FROM caisses ORDER BY ordre, nom');
}

export function getCaisse(id: string) {
  return get('SELECT * FROM caisses WHERE id = ?', [id]);
}

export function createCaisse(data: { nom: string; ordre?: number; fond_de_caisse?: number }) {
  const id = randomUUID();
  run('INSERT INTO caisses (id, nom, ordre, fond_de_caisse) VALUES (?, ?, ?, ?)',
    [id, data.nom, data.ordre || 0, data.fond_de_caisse || 0]);
  return getCaisse(id);
}

export function updateCaisse(id: string, data: Partial<{ nom: string; ordre: number; fond_de_caisse: number }>) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.nom !== undefined) { fields.push('nom = ?'); values.push(data.nom); }
  if (data.ordre !== undefined) { fields.push('ordre = ?'); values.push(data.ordre); }
  if (data.fond_de_caisse !== undefined) { fields.push('fond_de_caisse = ?'); values.push(data.fond_de_caisse); }
  if (fields.length === 0) return;
  values.push(id);
  run(`UPDATE caisses SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteCaisse(id: string) {
  run('DELETE FROM caisses WHERE id = ?', [id]);
}

// --- SOCIETE ---

export function getSociete() {
  return get('SELECT * FROM societe LIMIT 1');
}

export function updateSociete(data: Partial<{ nom: string; nom_societe: string; telephone: string; adresse: string; message_ticket: string; logo_url: string; format_ticket: string }>) {
  const societe = getSociete() as any;
  if (!societe) return;
  const fields: string[] = [];
  const values: any[] = [];
  Object.entries(data).forEach(([key, val]) => {
    if (val !== undefined) { fields.push(`${key} = ?`); values.push(val); }
  });
  if (fields.length === 0) return;
  fields.push("updated_at = datetime('now')");
  values.push(societe.id);
  run(`UPDATE societe SET ${fields.join(', ')} WHERE id = ?`, values);
  return getSociete();
}

// --- COMPTES CHARGES ---

export function getAllComptes() {
  return all('SELECT * FROM comptes_charges ORDER BY numero');
}

export function createCompte(data: { numero: string; libelle: string }) {
  const id = randomUUID();
  run('INSERT INTO comptes_charges (id, numero, libelle) VALUES (?, ?, ?)', [id, data.numero, data.libelle]);
  return get('SELECT * FROM comptes_charges WHERE id = ?', [id]);
}

export function updateCompte(id: string, data: { numero?: string; libelle?: string }) {
  const fields: string[] = [];
  const values: any[] = [];
  if (data.numero !== undefined) { fields.push('numero = ?'); values.push(data.numero); }
  if (data.libelle !== undefined) { fields.push('libelle = ?'); values.push(data.libelle); }
  if (fields.length === 0) return;
  values.push(id);
  run(`UPDATE comptes_charges SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteCompte(id: string) {
  run('DELETE FROM comptes_charges WHERE id = ?', [id]);
}

// --- ENCAISSEMENTS ---

export function generateNumeroFacture(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayDate = new Date().toISOString().slice(0, 10);
  const count = get(
    "SELECT COUNT(*) as cnt FROM encaissements WHERE date_transaction = ?", [todayDate]
  );
  return `F${today}-${String((count.cnt || 0) + 1).padStart(4, '0')}`;
}

export function createEncaissement(data: {
  caisse_id: string; user_id: string; client_nom: string;
  montant: number; mode_paiement: string; montant_recu: number; monnaie_rendue: number;
}) {
  const id = randomUUID();
  const now = new Date();
  const dateTransaction = now.toISOString().slice(0, 10);
  const heureTransaction = now.toTimeString().slice(0, 8);
  const numero_facture = generateNumeroFacture();

  run(`
    INSERT INTO encaissements (id, numero_facture, caisse_id, user_id, client_nom, montant, mode_paiement, montant_recu, monnaie_rendue, date_transaction, heure_transaction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, numero_facture, data.caisse_id, data.user_id, data.client_nom, data.montant, data.mode_paiement, data.montant_recu, data.monnaie_rendue, dateTransaction, heureTransaction]);

  return get('SELECT * FROM encaissements WHERE id = ?', [id]);
}

export function getEncaissements(filters: { caisse_id?: string; date_from?: string; date_to?: string; archived?: boolean }) {
  let sql = 'SELECT * FROM encaissements WHERE 1=1';
  const params: any[] = [];
  if (filters.caisse_id) { sql += ' AND caisse_id = ?'; params.push(filters.caisse_id); }
  if (filters.date_from) { sql += ' AND date_transaction >= ?'; params.push(filters.date_from); }
  if (filters.date_to) { sql += ' AND date_transaction <= ?'; params.push(filters.date_to); }
  if (filters.archived !== undefined) { sql += ' AND archived = ?'; params.push(filters.archived ? 1 : 0); }
  sql += ' ORDER BY date_transaction DESC, heure_transaction DESC LIMIT 500';
  return all(sql, params);
}

// --- DECAISSEMENTS ---

export function generateNumeroPiece(): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayDate = new Date().toISOString().slice(0, 10);
  const count = get(
    "SELECT COUNT(*) as cnt FROM decaissements WHERE date_transaction = ?", [todayDate]
  );
  return `D${today}-${String((count.cnt || 0) + 1).padStart(4, '0')}`;
}

export function createDecaissement(data: {
  caisse_id: string; user_id: string; compte_id: string;
  compte_numero: string; compte_libelle: string;
  description: string; montant: number;
}) {
  const id = randomUUID();
  const dateTransaction = new Date().toISOString().slice(0, 10);
  const numero_piece = generateNumeroPiece();

  run(`
    INSERT INTO decaissements (id, numero_piece, caisse_id, user_id, compte_id, compte_numero, compte_libelle, description, montant, date_transaction)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, numero_piece, data.caisse_id, data.user_id, data.compte_id, data.compte_numero, data.compte_libelle, data.description, data.montant, dateTransaction]);

  return get('SELECT * FROM decaissements WHERE id = ?', [id]);
}

export function getDecaissements(filters: { caisse_id?: string; date_from?: string; date_to?: string; archived?: boolean }) {
  let sql = 'SELECT * FROM decaissements WHERE 1=1';
  const params: any[] = [];
  if (filters.caisse_id) { sql += ' AND caisse_id = ?'; params.push(filters.caisse_id); }
  if (filters.date_from) { sql += ' AND date_transaction >= ?'; params.push(filters.date_from); }
  if (filters.date_to) { sql += ' AND date_transaction <= ?'; params.push(filters.date_to); }
  if (filters.archived !== undefined) { sql += ' AND archived = ?'; params.push(filters.archived ? 1 : 0); }
  sql += ' ORDER BY date_transaction DESC, created_at DESC LIMIT 500';
  return all(sql, params);
}

// --- SOLDE ---

export function getSolde(caisseId: string): number {
  const caisse = getCaisse(caisseId) as any;
  const fondDeCaisse = caisse?.fond_de_caisse || 0;

  const encResult = get(
    'SELECT COALESCE(SUM(montant), 0) as total FROM encaissements WHERE caisse_id = ? AND archived = 0', [caisseId]
  );

  const decResult = get(
    'SELECT COALESCE(SUM(montant), 0) as total FROM decaissements WHERE caisse_id = ? AND archived = 0', [caisseId]
  );

  return fondDeCaisse + (encResult.total || 0) - (decResult.total || 0);
}

// --- CLOTURE ---

export function cloturerCaisse(caisseId: string, userId: string): any {
  const caisse = getCaisse(caisseId) as any;
  if (!caisse) throw new Error('Caisse introuvable');

  const encaissements = all(
    'SELECT * FROM encaissements WHERE caisse_id = ? AND archived = 0', [caisseId]
  );

  const decaissements = all(
    'SELECT * FROM decaissements WHERE caisse_id = ? AND archived = 0', [caisseId]
  );

  const totalEnc = encaissements.reduce((sum: number, e: any) => sum + e.montant, 0);
  const totalDec = decaissements.reduce((sum: number, d: any) => sum + d.montant, 0);
  const solde = caisse.fond_de_caisse + totalEnc - totalDec;

  const dates = [...encaissements.map((e: any) => e.date_transaction), ...decaissements.map((d: any) => d.date_transaction)];
  const dateDebut = dates.length > 0 ? dates.sort()[0] : new Date().toISOString().slice(0, 10);
  const dateFin = dates.length > 0 ? dates.sort().pop() : new Date().toISOString().slice(0, 10);

  const clotureId = randomUUID();

  db.run(`
    INSERT INTO clotures_caisses (id, caisse_id, created_by, date_debut, date_fin, fond_de_caisse, total_encaissements, total_decaissements, solde, nb_encaissements, nb_decaissements)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [clotureId, caisseId, userId, dateDebut, dateFin, caisse.fond_de_caisse, totalEnc, totalDec, solde, encaissements.length, decaissements.length]);

  db.run('UPDATE encaissements SET archived = 1, cloture_id = ? WHERE caisse_id = ? AND archived = 0', [clotureId, caisseId]);
  db.run('UPDATE decaissements SET archived = 1, cloture_id = ? WHERE caisse_id = ? AND archived = 0', [clotureId, caisseId]);
  db.run('UPDATE caisses SET fond_de_caisse = 0 WHERE id = ?', [caisseId]);

  saveToDisk();
  return get('SELECT * FROM clotures_caisses WHERE id = ?', [clotureId]);
}

export function getClotures(caisseId?: string, limit = 20) {
  if (caisseId) {
    return all('SELECT * FROM clotures_caisses WHERE caisse_id = ? ORDER BY created_at DESC LIMIT ?', [caisseId, limit]);
  }
  return all('SELECT * FROM clotures_caisses ORDER BY created_at DESC LIMIT ?', [limit]);
}

// --- STATS ---

export function getStatsGlobales(dateFrom?: string, dateTo?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const to = dateTo || today;

  const enc = get('SELECT COALESCE(SUM(montant), 0) as total, COUNT(*) as count FROM encaissements WHERE date_transaction BETWEEN ? AND ?', [from, to]);
  const dec = get('SELECT COALESCE(SUM(montant), 0) as total, COUNT(*) as count FROM decaissements WHERE date_transaction BETWEEN ? AND ?', [from, to]);

  return {
    total_encaissements: enc.total,
    total_decaissements: dec.total,
    nb_encaissements: enc.count,
    nb_decaissements: dec.count,
    solde: enc.total - dec.total,
  };
}

export function getStatsParCaisse(dateFrom?: string, dateTo?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const to = dateTo || today;

  return all(`
    SELECT c.id, c.nom,
      COALESCE((SELECT SUM(montant) FROM encaissements WHERE caisse_id = c.id AND date_transaction BETWEEN ? AND ?), 0) as total_encaissements,
      COALESCE((SELECT SUM(montant) FROM decaissements WHERE caisse_id = c.id AND date_transaction BETWEEN ? AND ?), 0) as total_decaissements
    FROM caisses c ORDER BY c.ordre
  `, [from, to, from, to]);
}

export function getStatsParMode(dateFrom?: string, dateTo?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const to = dateTo || today;

  return all(`
    SELECT mode_paiement, SUM(montant) as total, COUNT(*) as count
    FROM encaissements WHERE date_transaction BETWEEN ? AND ?
    GROUP BY mode_paiement ORDER BY total DESC
  `, [from, to]);
}

export function getStatsParJour(dateFrom?: string, dateTo?: string) {
  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const to = dateTo || today;

  return all(`
    SELECT date_transaction as jour,
      SUM(montant) as total_encaissements,
      COUNT(*) as nb_encaissements
    FROM encaissements WHERE date_transaction BETWEEN ? AND ?
    GROUP BY date_transaction ORDER BY date_transaction
  `, [from, to]);
}

export function closeDatabase(): void {
  if (saveTimer) clearTimeout(saveTimer);
  if (db) {
    saveToDisk();
    db.close();
  }
}
