"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const license_1 = require("./license");
const db = __importStar(require("./database"));
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        title: 'Ma Caisse',
        icon: (0, path_1.join)(__dirname, '../public/icons/icon-512.png'),
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else {
        mainWindow.loadFile((0, path_1.join)(__dirname, '../dist/index.html'));
    }
}
electron_1.app.whenReady().then(async () => {
    await db.initDatabase();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    db.closeDatabase();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// --- LICENSE IPC ---
electron_1.ipcMain.handle('license:check', () => (0, license_1.checkLicense)());
electron_1.ipcMain.handle('license:activate', (_event, key) => (0, license_1.activateLicense)(key));
electron_1.ipcMain.handle('license:getMachineId', () => (0, license_1.getCurrentMachineId)());
// --- AUTH IPC ---
electron_1.ipcMain.handle('auth:login', (_event, pin) => {
    const user = db.authenticateByPin(pin);
    if (!user)
        return { error: 'Code PIN invalide' };
    return { user };
});
electron_1.ipcMain.handle('auth:getProfile', (_event, id) => db.getProfile(id));
// --- PROFILES IPC ---
electron_1.ipcMain.handle('profiles:getAll', () => db.getAllProfiles());
electron_1.ipcMain.handle('profiles:create', (_event, data) => db.createProfile(data));
electron_1.ipcMain.handle('profiles:update', (_event, id, data) => db.updateProfile(id, data));
electron_1.ipcMain.handle('profiles:delete', (_event, id) => db.deleteProfile(id));
// --- CAISSES IPC ---
electron_1.ipcMain.handle('caisses:getAll', () => db.getAllCaisses());
electron_1.ipcMain.handle('caisses:get', (_event, id) => db.getCaisse(id));
electron_1.ipcMain.handle('caisses:create', (_event, data) => db.createCaisse(data));
electron_1.ipcMain.handle('caisses:update', (_event, id, data) => db.updateCaisse(id, data));
electron_1.ipcMain.handle('caisses:delete', (_event, id) => db.deleteCaisse(id));
// --- SOCIETE IPC ---
electron_1.ipcMain.handle('societe:get', () => db.getSociete());
electron_1.ipcMain.handle('societe:update', (_event, data) => db.updateSociete(data));
// --- COMPTES CHARGES IPC ---
electron_1.ipcMain.handle('comptes:getAll', () => db.getAllComptes());
electron_1.ipcMain.handle('comptes:create', (_event, data) => db.createCompte(data));
electron_1.ipcMain.handle('comptes:update', (_event, id, data) => db.updateCompte(id, data));
electron_1.ipcMain.handle('comptes:delete', (_event, id) => db.deleteCompte(id));
// --- ENCAISSEMENTS IPC ---
electron_1.ipcMain.handle('encaissements:create', (_event, data) => db.createEncaissement(data));
electron_1.ipcMain.handle('encaissements:getAll', (_event, filters) => db.getEncaissements(filters));
electron_1.ipcMain.handle('encaissements:generateNumero', () => db.generateNumeroFacture());
// --- DECAISSEMENTS IPC ---
electron_1.ipcMain.handle('decaissements:create', (_event, data) => db.createDecaissement(data));
electron_1.ipcMain.handle('decaissements:getAll', (_event, filters) => db.getDecaissements(filters));
electron_1.ipcMain.handle('decaissements:generateNumero', () => db.generateNumeroPiece());
// --- SOLDE IPC ---
electron_1.ipcMain.handle('solde:get', (_event, caisseId) => db.getSolde(caisseId));
// --- CLOTURE IPC ---
electron_1.ipcMain.handle('cloture:execute', (_event, caisseId, userId) => db.cloturerCaisse(caisseId, userId));
electron_1.ipcMain.handle('cloture:getAll', (_event, caisseId) => db.getClotures(caisseId));
// --- STATS IPC ---
electron_1.ipcMain.handle('stats:globales', (_event, from, to) => db.getStatsGlobales(from, to));
electron_1.ipcMain.handle('stats:parCaisse', (_event, from, to) => db.getStatsParCaisse(from, to));
electron_1.ipcMain.handle('stats:parMode', (_event, from, to) => db.getStatsParMode(from, to));
electron_1.ipcMain.handle('stats:parJour', (_event, from, to) => db.getStatsParJour(from, to));
// --- DIALOG IPC ---
electron_1.ipcMain.handle('dialog:selectImage', async () => {
    if (!mainWindow)
        return null;
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
    });
    if (result.canceled || result.filePaths.length === 0)
        return null;
    return result.filePaths[0];
});
//# sourceMappingURL=main.js.map