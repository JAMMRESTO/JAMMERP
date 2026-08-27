interface ElectronAPI {
  license: {
    check: () => Promise<any>;
    activate: (key: string) => Promise<any>;
    getMachineId: () => Promise<string>;
  };
  auth: {
    login: (pin: string) => Promise<any>;
    getProfile: (id: string) => Promise<any>;
  };
  profiles: {
    getAll: () => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  caisses: {
    getAll: () => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  societe: {
    get: () => Promise<any>;
    update: (data: any) => Promise<any>;
  };
  comptes: {
    getAll: () => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };
  encaissements: {
    create: (data: any) => Promise<any>;
    getAll: (filters: any) => Promise<any[]>;
    generateNumero: () => Promise<string>;
  };
  decaissements: {
    create: (data: any) => Promise<any>;
    getAll: (filters: any) => Promise<any[]>;
    generateNumero: () => Promise<string>;
  };
  solde: {
    get: (caisseId: string) => Promise<number>;
  };
  cloture: {
    execute: (caisseId: string, userId: string) => Promise<any>;
    getAll: (caisseId?: string) => Promise<any[]>;
  };
  stats: {
    globales: (from?: string, to?: string) => Promise<any>;
    parCaisse: (from?: string, to?: string) => Promise<any[]>;
    parMode: (from?: string, to?: string) => Promise<any[]>;
    parJour: (from?: string, to?: string) => Promise<any[]>;
  };
  dialog: {
    selectImage: () => Promise<string | null>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export type { ElectronAPI };
