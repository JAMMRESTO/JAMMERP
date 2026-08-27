"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // License
    license: {
        check: () => electron_1.ipcRenderer.invoke('license:check'),
        activate: (key) => electron_1.ipcRenderer.invoke('license:activate', key),
        getMachineId: () => electron_1.ipcRenderer.invoke('license:getMachineId'),
    },
    // Auth
    auth: {
        login: (pin) => electron_1.ipcRenderer.invoke('auth:login', pin),
        getProfile: (id) => electron_1.ipcRenderer.invoke('auth:getProfile', id),
    },
    // Profiles
    profiles: {
        getAll: () => electron_1.ipcRenderer.invoke('profiles:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('profiles:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('profiles:update', id, data),
        delete: (id) => electron_1.ipcRenderer.invoke('profiles:delete', id),
    },
    // Caisses
    caisses: {
        getAll: () => electron_1.ipcRenderer.invoke('caisses:getAll'),
        get: (id) => electron_1.ipcRenderer.invoke('caisses:get', id),
        create: (data) => electron_1.ipcRenderer.invoke('caisses:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('caisses:update', id, data),
        delete: (id) => electron_1.ipcRenderer.invoke('caisses:delete', id),
    },
    // Societe
    societe: {
        get: () => electron_1.ipcRenderer.invoke('societe:get'),
        update: (data) => electron_1.ipcRenderer.invoke('societe:update', data),
    },
    // Comptes charges
    comptes: {
        getAll: () => electron_1.ipcRenderer.invoke('comptes:getAll'),
        create: (data) => electron_1.ipcRenderer.invoke('comptes:create', data),
        update: (id, data) => electron_1.ipcRenderer.invoke('comptes:update', id, data),
        delete: (id) => electron_1.ipcRenderer.invoke('comptes:delete', id),
    },
    // Encaissements
    encaissements: {
        create: (data) => electron_1.ipcRenderer.invoke('encaissements:create', data),
        getAll: (filters) => electron_1.ipcRenderer.invoke('encaissements:getAll', filters),
        generateNumero: () => electron_1.ipcRenderer.invoke('encaissements:generateNumero'),
    },
    // Decaissements
    decaissements: {
        create: (data) => electron_1.ipcRenderer.invoke('decaissements:create', data),
        getAll: (filters) => electron_1.ipcRenderer.invoke('decaissements:getAll', filters),
        generateNumero: () => electron_1.ipcRenderer.invoke('decaissements:generateNumero'),
    },
    // Solde
    solde: {
        get: (caisseId) => electron_1.ipcRenderer.invoke('solde:get', caisseId),
    },
    // Cloture
    cloture: {
        execute: (caisseId, userId) => electron_1.ipcRenderer.invoke('cloture:execute', caisseId, userId),
        getAll: (caisseId) => electron_1.ipcRenderer.invoke('cloture:getAll', caisseId),
    },
    // Stats
    stats: {
        globales: (from, to) => electron_1.ipcRenderer.invoke('stats:globales', from, to),
        parCaisse: (from, to) => electron_1.ipcRenderer.invoke('stats:parCaisse', from, to),
        parMode: (from, to) => electron_1.ipcRenderer.invoke('stats:parMode', from, to),
        parJour: (from, to) => electron_1.ipcRenderer.invoke('stats:parJour', from, to),
    },
    // Dialog
    dialog: {
        selectImage: () => electron_1.ipcRenderer.invoke('dialog:selectImage'),
    },
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
//# sourceMappingURL=preload.js.map