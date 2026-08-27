import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // License
  license: {
    check: () => ipcRenderer.invoke('license:check'),
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    getMachineId: () => ipcRenderer.invoke('license:getMachineId'),
  },

  // Auth
  auth: {
    login: (pin: string) => ipcRenderer.invoke('auth:login', pin),
    getProfile: (id: string) => ipcRenderer.invoke('auth:getProfile', id),
  },

  // Profiles
  profiles: {
    getAll: () => ipcRenderer.invoke('profiles:getAll'),
    create: (data: any) => ipcRenderer.invoke('profiles:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('profiles:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('profiles:delete', id),
  },

  // Caisses
  caisses: {
    getAll: () => ipcRenderer.invoke('caisses:getAll'),
    get: (id: string) => ipcRenderer.invoke('caisses:get', id),
    create: (data: any) => ipcRenderer.invoke('caisses:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('caisses:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('caisses:delete', id),
  },

  // Societe
  societe: {
    get: () => ipcRenderer.invoke('societe:get'),
    update: (data: any) => ipcRenderer.invoke('societe:update', data),
  },

  // Comptes charges
  comptes: {
    getAll: () => ipcRenderer.invoke('comptes:getAll'),
    create: (data: any) => ipcRenderer.invoke('comptes:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('comptes:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('comptes:delete', id),
  },

  // Encaissements
  encaissements: {
    create: (data: any) => ipcRenderer.invoke('encaissements:create', data),
    getAll: (filters: any) => ipcRenderer.invoke('encaissements:getAll', filters),
    generateNumero: () => ipcRenderer.invoke('encaissements:generateNumero'),
  },

  // Decaissements
  decaissements: {
    create: (data: any) => ipcRenderer.invoke('decaissements:create', data),
    getAll: (filters: any) => ipcRenderer.invoke('decaissements:getAll', filters),
    generateNumero: () => ipcRenderer.invoke('decaissements:generateNumero'),
  },

  // Solde
  solde: {
    get: (caisseId: string) => ipcRenderer.invoke('solde:get', caisseId),
  },

  // Cloture
  cloture: {
    execute: (caisseId: string, userId: string) => ipcRenderer.invoke('cloture:execute', caisseId, userId),
    getAll: (caisseId?: string) => ipcRenderer.invoke('cloture:getAll', caisseId),
  },

  // Stats
  stats: {
    globales: (from?: string, to?: string) => ipcRenderer.invoke('stats:globales', from, to),
    parCaisse: (from?: string, to?: string) => ipcRenderer.invoke('stats:parCaisse', from, to),
    parMode: (from?: string, to?: string) => ipcRenderer.invoke('stats:parMode', from, to),
    parJour: (from?: string, to?: string) => ipcRenderer.invoke('stats:parJour', from, to),
  },

  // Dialog
  dialog: {
    selectImage: () => ipcRenderer.invoke('dialog:selectImage'),
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
