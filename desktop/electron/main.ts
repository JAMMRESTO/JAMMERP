import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { checkLicense, activateLicense, getCurrentMachineId } from './license';
import * as db from './database';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Ma Caisse',
    icon: join(__dirname, '../public/icons/icon-512.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  await db.initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  db.closeDatabase();
  if (process.platform !== 'darwin') app.quit();
});

// --- LICENSE IPC ---

ipcMain.handle('license:check', () => checkLicense());
ipcMain.handle('license:activate', (_event, key: string) => activateLicense(key));
ipcMain.handle('license:getMachineId', () => getCurrentMachineId());

// --- AUTH IPC ---

ipcMain.handle('auth:login', (_event, pin: string) => {
  const user = db.authenticateByPin(pin);
  if (!user) return { error: 'Code PIN invalide' };
  return { user };
});

ipcMain.handle('auth:getProfile', (_event, id: string) => db.getProfile(id));

// --- PROFILES IPC ---

ipcMain.handle('profiles:getAll', () => db.getAllProfiles());
ipcMain.handle('profiles:create', (_event, data) => db.createProfile(data));
ipcMain.handle('profiles:update', (_event, id: string, data) => db.updateProfile(id, data));
ipcMain.handle('profiles:delete', (_event, id: string) => db.deleteProfile(id));

// --- CAISSES IPC ---

ipcMain.handle('caisses:getAll', () => db.getAllCaisses());
ipcMain.handle('caisses:get', (_event, id: string) => db.getCaisse(id));
ipcMain.handle('caisses:create', (_event, data) => db.createCaisse(data));
ipcMain.handle('caisses:update', (_event, id: string, data) => db.updateCaisse(id, data));
ipcMain.handle('caisses:delete', (_event, id: string) => db.deleteCaisse(id));

// --- SOCIETE IPC ---

ipcMain.handle('societe:get', () => db.getSociete());
ipcMain.handle('societe:update', (_event, data) => db.updateSociete(data));

// --- COMPTES CHARGES IPC ---

ipcMain.handle('comptes:getAll', () => db.getAllComptes());
ipcMain.handle('comptes:create', (_event, data) => db.createCompte(data));
ipcMain.handle('comptes:update', (_event, id: string, data) => db.updateCompte(id, data));
ipcMain.handle('comptes:delete', (_event, id: string) => db.deleteCompte(id));

// --- ENCAISSEMENTS IPC ---

ipcMain.handle('encaissements:create', (_event, data) => db.createEncaissement(data));
ipcMain.handle('encaissements:getAll', (_event, filters) => db.getEncaissements(filters));
ipcMain.handle('encaissements:generateNumero', () => db.generateNumeroFacture());

// --- DECAISSEMENTS IPC ---

ipcMain.handle('decaissements:create', (_event, data) => db.createDecaissement(data));
ipcMain.handle('decaissements:getAll', (_event, filters) => db.getDecaissements(filters));
ipcMain.handle('decaissements:generateNumero', () => db.generateNumeroPiece());

// --- SOLDE IPC ---

ipcMain.handle('solde:get', (_event, caisseId: string) => db.getSolde(caisseId));

// --- CLOTURE IPC ---

ipcMain.handle('cloture:execute', (_event, caisseId: string, userId: string) => db.cloturerCaisse(caisseId, userId));
ipcMain.handle('cloture:getAll', (_event, caisseId?: string) => db.getClotures(caisseId));

// --- STATS IPC ---

ipcMain.handle('stats:globales', (_event, from?: string, to?: string) => db.getStatsGlobales(from, to));
ipcMain.handle('stats:parCaisse', (_event, from?: string, to?: string) => db.getStatsParCaisse(from, to));
ipcMain.handle('stats:parMode', (_event, from?: string, to?: string) => db.getStatsParMode(from, to));
ipcMain.handle('stats:parJour', (_event, from?: string, to?: string) => db.getStatsParJour(from, to));

// --- DIALOG IPC ---

ipcMain.handle('dialog:selectImage', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
