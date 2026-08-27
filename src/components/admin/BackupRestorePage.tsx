import { useState, useRef } from 'react';
import {
  Download, Upload, CheckCircle, AlertCircle, Loader,
  Building2, Calendar, Database, ShieldAlert, RefreshCw, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company } from '../../types';
import { formatDate } from '../../lib/utils';

interface Props {
  companies: Company[];
}

interface BackupMeta {
  version: string;
  created_at: string;
  company_id: string;
  company_name: string;
  data: Record<string, unknown[]>;
}

type RestoreMode = 'full' | 'merge';

interface TableResult {
  inserted: number;
  errors: number;
}

interface RestoreResults {
  success: boolean;
  results: Record<string, TableResult>;
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

async function getToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function BackupRestorePage({ companies }: Props) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResults, setRestoreResults] = useState<RestoreResults | null>(null);
  const [pendingBackup, setPendingBackup] = useState<BackupMeta | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge');
  const [confirmFull, setConfirmFull] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  async function handleBackup() {
    if (!selectedCompanyId) return;
    setBackupLoading(true);
    setBackupError(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-backup-restore?action=backup&company_id=${selectedCompanyId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la sauvegarde');
      }
      const data: BackupMeta = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `backup_${data.company_name.replace(/\s+/g, '_')}_${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBackupError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setBackupLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed: BackupMeta = JSON.parse(ev.target?.result as string);
        if (!parsed.version || !parsed.company_id || !parsed.data) {
          setRestoreError('Fichier de sauvegarde invalide');
          return;
        }
        setPendingBackup(parsed);
        setRestoreError(null);
        setRestoreResults(null);
        setSelectedCompanyId(parsed.company_id);
      } catch {
        setRestoreError('Impossible de lire le fichier JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleRestore() {
    if (!pendingBackup || !selectedCompanyId) return;
    if (restoreMode === 'full' && !confirmFull) {
      setConfirmFull(true);
      return;
    }
    setRestoreLoading(true);
    setRestoreError(null);
    setRestoreResults(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-backup-restore?action=restore`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            company_id: selectedCompanyId,
            backup_data: pendingBackup.data,
            mode: restoreMode,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de la restauration');
      }
      const result: RestoreResults = await res.json();
      setRestoreResults(result);
      setConfirmFull(false);
    } catch (e) {
      setRestoreError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setRestoreLoading(false);
    }
  }

  function totalRows(backup: BackupMeta): number {
    return Object.values(backup.data).reduce((sum, arr) => sum + (arr?.length ?? 0), 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <Database className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Sauvegarde & Restauration</h3>
          <p className="text-sm text-slate-500">Exportez ou restaurez les données complètes d'une société</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Ces opérations sont réservées au super administrateur. La restauration complète efface toutes les données existantes de la société avant de les remplacer.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* SAUVEGARDE */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <Download className="w-5 h-5" />
              <h4 className="font-bold text-base">Sauvegarde</h4>
            </div>
            <p className="text-blue-100 text-xs mt-1">Télécharger toutes les données d'une société</p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Société à sauvegarder</label>
              <select
                value={selectedCompanyId}
                onChange={e => { setSelectedCompanyId(e.target.value); setBackupError(null); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">-- Choisir une société --</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {selectedCompany && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">{selectedCompany.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Créée le {formatDate(selectedCompany.created_at)}</span>
                </div>
              </div>
            )}

            {backupError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{backupError}</p>
              </div>
            )}

            <button
              onClick={handleBackup}
              disabled={!selectedCompanyId || backupLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
            >
              {backupLoading ? (
                <><Loader className="w-4 h-4 animate-spin" /> Préparation...</>
              ) : (
                <><Download className="w-4 h-4" /> Télécharger la sauvegarde</>
              )}
            </button>
          </div>
        </div>

        {/* RESTAURATION */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <Upload className="w-5 h-5" />
              <h4 className="font-bold text-base">Restauration</h4>
            </div>
            <p className="text-emerald-100 text-xs mt-1">Importer un fichier de sauvegarde</p>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Fichier de sauvegarde (.json)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 hover:border-emerald-400 rounded-xl py-4 flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs font-medium">Cliquer pour choisir un fichier</span>
              </button>
            </div>

            {pendingBackup && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-800">Fichier chargé</span>
                  </div>
                  <button onClick={() => { setPendingBackup(null); setRestoreResults(null); setConfirmFull(false); }}>
                    <X className="w-4 h-4 text-emerald-400 hover:text-emerald-600" />
                  </button>
                </div>
                <div className="text-xs text-emerald-700 space-y-0.5">
                  <div><span className="font-medium">Société :</span> {pendingBackup.company_name}</div>
                  <div><span className="font-medium">Date :</span> {formatDate(pendingBackup.created_at)}</div>
                  <div><span className="font-medium">Enregistrements :</span> {totalRows(pendingBackup).toLocaleString()}</div>
                </div>
              </div>
            )}

            {pendingBackup && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Société cible</label>
                <select
                  value={selectedCompanyId}
                  onChange={e => { setSelectedCompanyId(e.target.value); setRestoreError(null); setRestoreResults(null); setConfirmFull(false); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- Choisir une société --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {pendingBackup && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">Mode de restauration</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setRestoreMode('merge'); setConfirmFull(false); }}
                    className={`text-xs px-3 py-2.5 rounded-xl border font-medium transition-colors ${
                      restoreMode === 'merge'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    Fusion
                    <div className="text-[10px] font-normal mt-0.5 opacity-75">Ajoute sans écraser</div>
                  </button>
                  <button
                    onClick={() => { setRestoreMode('full'); setConfirmFull(false); }}
                    className={`text-xs px-3 py-2.5 rounded-xl border font-medium transition-colors ${
                      restoreMode === 'full'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-600 border-gray-200 hover:border-red-300'
                    }`}
                  >
                    Complète
                    <div className="text-[10px] font-normal mt-0.5 opacity-75">Efface et remplace</div>
                  </button>
                </div>
              </div>
            )}

            {confirmFull && restoreMode === 'full' && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-3">
                <p className="text-xs text-red-800 font-semibold mb-2">
                  Attention : toutes les données actuelles de la société seront effacées définitivement. Confirmer ?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRestore}
                    disabled={restoreLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                  >
                    Confirmer la suppression
                  </button>
                  <button
                    onClick={() => setConfirmFull(false)}
                    className="flex-1 bg-white border border-gray-200 text-slate-600 text-xs font-semibold py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {restoreError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{restoreError}</p>
              </div>
            )}

            {!confirmFull && (
              <button
                onClick={handleRestore}
                disabled={!pendingBackup || !selectedCompanyId || restoreLoading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold text-sm py-2.5 rounded-xl transition-colors"
              >
                {restoreLoading ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Restauration...</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> Lancer la restauration</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {restoreResults && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h4 className="font-bold text-slate-900">Résultats de la restauration</h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {Object.entries(restoreResults.results).map(([table, res]) => (
                <div
                  key={table}
                  className={`rounded-xl border p-3 ${
                    res.errors > 0
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-100 bg-slate-50'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-slate-700 truncate">{TABLE_LABELS[table] || table}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-emerald-600">{res.inserted} restauré{res.inserted !== 1 ? 's' : ''}</span>
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
