import { useState } from 'react';
import {
  Trash2, AlertTriangle, CheckCircle, Loader, ShieldAlert,
  Building2, RotateCcw, ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company } from '../../types';

interface Props {
  companies: Company[];
}

interface ResetScope {
  id: string;
  label: string;
  description: string;
  tables: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ResetResult {
  success: boolean;
  total_deleted: number;
  results: Record<string, { deleted: number; errors: number }>;
}

const TABLE_LABELS: Record<string, string> = {
  clients: 'Clients',
  fournisseurs: 'Fournisseurs',
  categories: 'Catégories',
  produits: 'Produits',
  produit_unites: 'Unités produits',
  roles: 'Rôles',
  devis: 'Devis',
  devis_lignes: 'Lignes devis',
  factures: 'Factures',
  facture_lignes: 'Lignes factures',
  paiements: 'Paiements',
  factures_fournisseurs: 'Factures fournisseurs',
  factures_fournisseurs_lignes: 'Lignes fact. fourn.',
  paiements_fournisseurs: 'Paiements fournisseurs',
  depenses: 'Dépenses',
  retours: 'Retours',
  retour_lignes: 'Lignes retours',
  mouvements_stock: 'Mouvements stock',
  pos_sessions: 'Sessions POS',
  pos_ventes: 'Ventes POS',
  pos_vente_lignes: 'Lignes ventes POS',
  pos_facture_payments: 'Paiements POS',
};

const SCOPES: ResetScope[] = [
  {
    id: 'transactions',
    label: 'Transactions uniquement',
    description: 'Factures, devis, retours, POS — conserve les clients, produits, fournisseurs',
    tables: ['factures', 'facture_lignes', 'paiements', 'devis', 'devis_lignes', 'retours', 'retour_lignes', 'pos_sessions', 'pos_ventes', 'pos_vente_lignes', 'pos_facture_payments'],
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: RotateCcw,
  },
  {
    id: 'depenses',
    label: 'Dépenses uniquement',
    description: 'Supprime toutes les dépenses enregistrées',
    tables: ['depenses'],
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: Trash2,
  },
  {
    id: 'produits',
    label: 'Produits & Stock',
    description: 'Supprime produits, catégories, unités et mouvements de stock',
    tables: ['produits', 'produit_unites', 'categories', 'mouvements_stock'],
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    icon: Trash2,
  },
  {
    id: 'clients_fournisseurs',
    label: 'Clients & Fournisseurs',
    description: 'Supprime les fiches clients et fournisseurs',
    tables: ['clients', 'fournisseurs'],
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: Trash2,
  },
  {
    id: 'factures_fournisseurs',
    label: 'Factures fournisseurs',
    description: 'Supprime les factures et paiements fournisseurs',
    tables: ['factures_fournisseurs', 'factures_fournisseurs_lignes', 'paiements_fournisseurs'],
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: Trash2,
  },
  {
    id: 'all',
    label: 'Tout réinitialiser',
    description: 'Efface TOUTES les données de la société — structure et tables conservées',
    tables: [],
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    icon: AlertTriangle,
  },
];

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function ResetDataPage({ companies }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedScope, setSelectedScope] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(0);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const scope = SCOPES.find(s => s.id === selectedScope);

  function handleSelectScope(scopeId: string) {
    setSelectedScope(scopeId);
    setConfirmStep(0);
    setConfirmText('');
    setError(null);
    setResult(null);
  }

  function handleReset() {
    if (!selectedCompanyId || !selectedScope) return;
    if (confirmStep === 0) {
      setConfirmStep(1);
      return;
    }
    if (selectedScope === 'all' && confirmText !== selectedCompany?.name) return;
    executeReset();
  }

  async function executeReset() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-backup-restore?action=reset`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ company_id: selectedCompanyId, scope: selectedScope }),
        }
      );
      if (!res.ok) {
        let errMsg = 'Erreur lors de la réinitialisation';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          const text = await res.text();
          errMsg = text || `Erreur HTTP ${res.status}`;
        }
        throw new Error(errMsg);
      }
      const data: ResetResult = await res.json();
      setResult(data);
      setConfirmStep(0);
      setConfirmText('');
      setSelectedScope(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  function cancelConfirm() {
    setConfirmStep(0);
    setConfirmText('');
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Réinitialisation des données</h3>
          <p className="text-sm text-slate-500">Supprime les données d'une société en conservant la structure</p>
        </div>
      </div>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-red-800">
          <span className="font-bold">Attention :</span> ces opérations sont irréversibles. Les tables et la structure de la base de données restent intactes. Seules les données enregistrées sont supprimées. Effectuez une sauvegarde avant toute réinitialisation.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <label className="block text-xs font-semibold text-slate-600 mb-2">Société concernée</label>
          <select
            value={selectedCompanyId}
            onChange={e => { setSelectedCompanyId(e.target.value); setSelectedScope(null); setConfirmStep(0); setResult(null); setError(null); }}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
          >
            <option value="">-- Choisir une société --</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {selectedCompany && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-700">{selectedCompany.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                {selectedCompany.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          )}
        </div>

        {selectedCompanyId && (
          <div className="p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Périmètre de réinitialisation</p>
            {SCOPES.map(s => {
              const Icon = s.icon;
              const isSelected = selectedScope === s.id;
              const isAll = s.id === 'all';
              return (
                <button
                  key={s.id}
                  onClick={() => handleSelectScope(s.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? `${s.bgColor} ${s.borderColor}`
                      : `bg-white border-gray-100 hover:${s.borderColor} hover:${s.bgColor}`
                  } ${isAll ? 'mt-2 border-dashed' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? s.bgColor : 'bg-gray-50'}`}>
                    <Icon className={`w-4 h-4 ${isSelected ? s.color : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${isSelected ? s.color : 'text-slate-700'}`}>{s.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-tight">{s.description}</div>
                  </div>
                  {isSelected && <ChevronRight className={`w-4 h-4 flex-shrink-0 ${s.color}`} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedScope && selectedCompanyId && confirmStep === 0 && (
        <div className={`rounded-2xl border-2 p-5 ${scope?.bgColor} ${scope?.borderColor}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${scope?.color}`} />
            <div className="flex-1">
              <p className={`text-sm font-bold ${scope?.color}`}>
                Réinitialisation : {scope?.label}
              </p>
              <p className={`text-xs mt-1 ${scope?.color} opacity-80`}>
                Société : <span className="font-semibold">{selectedCompany?.name}</span>
              </p>
              {scope && scope.tables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {scope.tables.map(t => (
                    <span key={t} className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${scope.bgColor} ${scope.color} border ${scope.borderColor}`}>
                      {TABLE_LABELS[t] || t}
                    </span>
                  ))}
                </div>
              )}
              <button
                onClick={handleReset}
                className={`mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-colors ${
                  selectedScope === 'all' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                Procéder à la réinitialisation
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedScope && selectedCompanyId && confirmStep === 1 && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Confirmation requise</p>
              <p className="text-xs text-red-700 mt-1">
                Cette action est <span className="font-bold">irréversible</span>. Les données supprimées ne pourront pas être récupérées.
              </p>
            </div>
          </div>

          {selectedScope === 'all' && (
            <div>
              <p className="text-xs text-red-700 font-semibold mb-1.5">
                Saisissez le nom exact de la société pour confirmer : <span className="font-bold">{selectedCompany?.name}</span>
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={selectedCompany?.name}
                className="w-full border-2 border-red-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-white border border-red-300 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={executeReset}
              disabled={loading || (selectedScope === 'all' && confirmText !== selectedCompany?.name)}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold text-sm py-2.5 rounded-xl transition-colors"
            >
              {loading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Suppression en cours...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Confirmer la suppression</>
              )}
            </button>
            <button
              onClick={cancelConfirm}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-slate-600 text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900">Réinitialisation terminée</h4>
            <span className="ml-auto text-sm font-bold text-slate-700">
              {result.total_deleted.toLocaleString()} enregistrement{result.total_deleted !== 1 ? 's' : ''} supprimé{result.total_deleted !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(result.results).map(([table, res]) => (
                <div
                  key={table}
                  className={`rounded-xl border p-3 ${
                    res.errors > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-slate-50'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{TABLE_LABELS[table] || table}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-slate-600">{res.deleted} supprimé{res.deleted !== 1 ? 's' : ''}</span>
                    {res.errors > 0 && (
                      <span className="text-xs font-bold text-red-600">{res.errors} erreur{res.errors !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
