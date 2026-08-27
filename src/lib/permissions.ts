import { Profile, Permission, Module } from '../types';

const MODULE_PERMISSION_MAP: Record<Module, keyof Permission | null> = {
  dashboard: null,
  produits: 'produits',
  facturation: 'factures',
  devis: 'devis',
  clients: 'clients',
  encaissement: 'clients',
  fournisseurs: 'fournisseurs',
  inventaire: 'inventaire',
  depenses: 'depenses',
  statistiques: 'statistiques',
  parametres: 'parametres',
  admin: 'admin',
  pos: 'pos',
};

const MANAGER_DEFAULT_PERMISSIONS: Permission = {
  pos: true,
  clients: true,
  fournisseurs: true,
  factures: true,
  devis: true,
  paiements: true,
  inventaire: true,
  produits: true,
  depenses: true,
  statistiques: true,
  parametres: true,
  import_export: true,
};

export function getPermissions(profile: Profile | null): Permission {
  if (!profile) return {};
  if (profile.role === 'superadmin' || profile.role === 'admin') return { all: true };

  const rolePerms = profile.roles?.permissions_json as Permission | undefined;

  if (rolePerms) {
    return rolePerms;
  }

  if (profile.role === 'manager') {
    return MANAGER_DEFAULT_PERMISSIONS;
  }

  return {};
}

export function hasPermission(profile: Profile | null, key: keyof Permission): boolean {
  if (!profile) return false;
  if (profile.role === 'superadmin' || profile.role === 'admin') return true;
  const perms = getPermissions(profile);
  if (perms.all) return true;
  return !!perms[key];
}

export function isAdmin(profile: Profile | null): boolean {
  if (!profile) return false;
  return profile.role === 'superadmin' || profile.role === 'admin';
}

export function canAccessModule(profile: Profile | null, mod: Module): boolean {
  if (!profile) return false;
  if (mod === 'dashboard') return true;
  if (mod === 'admin') return profile.role === 'superadmin';
  const permKey = MODULE_PERMISSION_MAP[mod];
  if (!permKey) return true;
  return hasPermission(profile, permKey);
}
