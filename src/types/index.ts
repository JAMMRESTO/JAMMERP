export interface Company {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  tax_number: string;
  currency: string;
  currency_symbol: string;
  tva_enabled: boolean;
  tva_rate: number;
  subscription_plan: string;
  subscription_status: string;
  subscription_end_date: string;
  is_active: boolean;
  pos_enabled: boolean;
  template_facture: string;
  template_ticket: string;
  created_at: string;
}

export type TemplateStyle = 'classic' | 'modern' | 'elegant' | 'minimal';

export interface Role {
  id: string;
  company_id: string;
  tenant_id?: string;
  nom: string;
  permissions_json: Record<string, boolean | string | number>;
  created_at: string;
}

export interface Profile {
  id: string;
  company_id: string;
  full_name: string;
  role: 'superadmin' | 'admin' | 'manager' | 'salesperson' | 'accountant';
  role_id?: string | null;
  is_active: boolean;
  created_at: string;
  roles?: Role;
}

export interface Client {
  id: string;
  company_id: string;
  tenant_id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_number: string;
  credit_limit: number;
  balance: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface Fournisseur {
  id: string;
  company_id: string;
  tenant_id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  tax_number: string;
  balance: number;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface Categorie {
  id: string;
  company_id: string;
  tenant_id?: string;
  name: string;
  created_at: string;
}

export interface Produit {
  id: string;
  company_id: string;
  tenant_id?: string;
  category_id: string | null;
  name: string;
  description: string;
  image_url: string;
  reference: string;
  prix_achat: number;
  prix_vente: number;
  stock_actuel: number;
  stock_minimum: number;
  unite: string;
  conditionnement: string;
  conditionnement_nom: string;
  conditionnement_quantite: number;
  quantite_par_conditionnement: number;
  prix_conditionnement: number | null;
  tva_taux: number;
  image_path: string | null;
  is_active: boolean;
  created_at: string;
  categories?: Categorie;
  produit_unites?: ProduitUnite[];
}

export interface ProduitUnite {
  id?: string;
  produit_id?: string;
  company_id?: string;
  nom: string;
  type: 'unite' | 'conditionnement';
  quantite: number;
  prix: number | null;
  sort_order: number;
}

export type TypeVente = 'unite' | 'conditionnement';

export interface LigneDocument {
  id?: string;
  produit_id: string | null;
  designation: string;
  quantite: number;
  unite?: string;
  prix_unitaire: number;
  tva_taux: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  sort_order: number;
  type_vente: TypeVente;
  produits?: Produit;
}

export interface Devis {
  id: string;
  company_id: string;
  tenant_id?: string;
  client_id: string;
  numero: string;
  date_devis: string;
  date_validite: string | null;
  statut: 'brouillon' | 'envoyé' | 'accepté' | 'refusé' | 'converti';
  notes: string;
  sous_total: number;
  tva_montant: number;
  total: number;
  created_at: string;
  updated_at: string;
  clients?: Client;
  devis_lignes?: LigneDocument[];
}

export interface Facture {
  id: string;
  company_id: string;
  tenant_id?: string;
  client_id: string;
  devis_id: string | null;
  numero: string;
  date_facture: string;
  date_echeance: string | null;
  statut: 'brouillon' | 'envoyée' | 'partiellement_payée' | 'payée' | 'annulée';
  type_paiement: 'comptant' | 'acompte' | 'crédit';
  notes: string;
  sous_total: number;
  tva_montant: number;
  total: number;
  montant_paye: number;
  reste_a_payer: number;
  created_at: string;
  updated_at: string;
  clients?: Client;
  facture_lignes?: LigneDocument[];
}

export interface Paiement {
  id: string;
  company_id: string;
  tenant_id?: string;
  facture_id: string;
  client_id: string | null;
  date_paiement: string;
  montant: number;
  mode_paiement: string;
  reference: string;
  notes: string;
  created_at: string;
  factures?: Facture;
  clients?: Client;
}

export interface FactureFournisseur {
  id: string;
  company_id: string;
  tenant_id?: string;
  fournisseur_id: string;
  numero: string;
  date_facture: string;
  date_echeance: string | null;
  statut: 'reçue' | 'partiellement_payée' | 'payée';
  notes: string;
  sous_total: number;
  tva_montant: number;
  total: number;
  montant_paye: number;
  reste_a_payer: number;
  stock_mis_a_jour: boolean;
  created_at: string;
  updated_at: string;
  fournisseurs?: Fournisseur;
  factures_fournisseurs_lignes?: LigneDocument[];
}

export interface Depense {
  id: string;
  company_id: string;
  tenant_id?: string;
  categorie: string;
  description: string;
  montant: number;
  date_depense: string;
  mode_paiement: string;
  reference: string;
  notes: string;
  created_at: string;
}

export interface Retour {
  id: string;
  company_id: string;
  tenant_id?: string;
  facture_id: string;
  client_id: string | null;
  date_retour: string;
  type_retour: 'partiel' | 'total';
  motif: string;
  statut: 'traité';
  montant_rembourse: number;
  created_at: string;
  factures?: Facture;
  clients?: Client;
  retour_lignes?: RetourLigne[];
}

export interface RetourLigne {
  id?: string;
  retour_id?: string;
  facture_ligne_id: string | null;
  produit_id: string | null;
  designation: string;
  quantite_retournee: number;
  prix_unitaire: number;
  motif: string;
}

export interface MouvementStock {
  id: string;
  company_id: string;
  tenant_id?: string;
  produit_id: string;
  type_mouvement: 'entrée' | 'sortie' | 'retour';
  quantite: number;
  stock_avant: number;
  stock_apres: number;
  reference_type: string;
  source: string;
  notes: string;
  created_at: string;
  produits?: Produit;
}

export interface Permission {
  factures?: boolean;
  devis?: boolean;
  clients?: boolean;
  fournisseurs?: boolean;
  produits?: boolean;
  depenses?: boolean;
  statistiques?: boolean;
  paiements?: boolean;
  inventaire?: boolean;
  parametres?: boolean;
  admin?: boolean;
  pos?: boolean;
  import_export?: boolean;
  all?: boolean;
}

export type Module =
  | 'dashboard'
  | 'produits'
  | 'facturation'
  | 'devis'
  | 'clients'
  | 'encaissement'
  | 'fournisseurs'
  | 'inventaire'
  | 'depenses'
  | 'statistiques'
  | 'parametres'
  | 'admin'
  | 'pos';

export interface POSSession {
  id: string;
  company_id: string;
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  fond_caisse_ouverture: number;
  fond_caisse_fermeture: number | null;
  total_ventes: number;
  total_especes: number;
  total_wave: number;
  total_om: number;
  total_autres: number;
  notes: string;
  statut: 'ouverte' | 'fermée';
  created_at: string;
}

export interface POSVente {
  id: string;
  company_id: string;
  session_id: string | null;
  numero: string;
  client_id: string | null;
  date_vente: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  montant_recu: number;
  monnaie_rendue: number;
  mode_paiement: string;
  statut: 'finalisée' | 'annulée';
  notes: string;
  created_by: string | null;
  created_at: string;
  pos_vente_lignes?: POSVenteLigne[];
  clients?: Client;
}

export interface POSVenteLigne {
  id?: string;
  vente_id?: string;
  produit_id: string | null;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  tva_taux: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  sort_order: number;
}

export interface POSCartItem {
  produit_id: string;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  tva_taux: number;
  montant_ht: number;
  montant_tva: number;
  montant_ttc: number;
  stock_actuel: number;
  type_vente: 'unite' | 'conditionnement';
  conditionnement_quantite?: number;
  unite_label?: string;
}
