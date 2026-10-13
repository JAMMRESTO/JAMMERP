import { useState, useRef } from 'react';
import {
  Database, Download, Upload, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Loader, FileJson, RefreshCw,
  ShoppingBag, Users, Map, Printer, Settings, CreditCard, Archive, X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  exportData, downloadExport, parseImportFile, importData, resetData, logOperation,
  ExportScope, ResetScope, ImportMode, RestaurantExport
} from '../../services/dataManager';

type Tab = 'export' | 'import' | 'reset';

interface ScopeItem<T> {
  key: keyof T;
  label: string;
  description: string;
  icon: React.ReactNode;
  danger?: boolean;
}

const EXPORT_SCOPE_ITEMS: ScopeItem<ExportScope>[] = [
  { key: 'catalog', label: 'Catalogue', description: 'Catégories, produits, options', icon: <ShoppingBag size={15} /> },
  { key: 'zones_tables', label: 'Zones & Tables', description: 'Plan de salle complet', icon: <Map size={15} /> },
  { key: 'printers', label: 'Imprimantes', description: 'Configuration des imprimantes', icon: <Printer size={15} /> },
  { key: 'settings', label: 'Paramètres', description: 'Paramètres système et app', icon: <Settings size={15} /> },
  { key: 'users', label: 'Utilisateurs', description: 'Comptes et permissions', icon: <Users size={15} /> },
  { key: 'orders', label: 'Commandes', description: 'Historique des commandes', icon: <Archive size={15} /> },
  { key: 'payments', label: 'Paiements', description: 'Historique des transactions', icon: <CreditCard size={15} /> },
  { key: 'cash_sessions', label: 'Sessions caisse', description: 'Caisses, mouvements, clôtures', icon: <Database size={15} /> },
];

const RESET_SCOPE_ITEMS: ScopeItem<ResetScope>[] = [
  { key: 'print_jobs', label: 'File impression', description: 'Vide la file d\'impression (logs)', icon: <Printer size={15} /> },
  { key: 'orders', label: 'Commandes', description: 'Supprime toutes les commandes et lignes', icon: <Archive size={15} />, danger: true },
  { key: 'payments', label: 'Paiements', description: 'Supprime tous les paiements', icon: <CreditCard size={15} />, danger: true },
  { key: 'cash_sessions', label: 'Sessions caisse', description: 'Sessions, mouvements et clôtures', icon: <Database size={15} />, danger: true },
  { key: 'catalog', label: 'Catalogue', description: 'Catégories, produits et options', icon: <ShoppingBag size={15} />, danger: true },
  { key: 'zones_tables', label: 'Zones & Tables', description: 'Toutes les zones et tables', icon: <Map size={15} />, danger: true },
  { key: 'printers', label: 'Imprimantes', description: 'Toutes les imprimantes', icon: <Printer size={15} />, danger: true },
  { key: 'users', label: 'Utilisateurs', description: 'Tous les comptes utilisateurs', icon: <Users size={15} />, danger: true },
  { key: 'settings', label: 'Paramètres', description: 'Paramètres système et logs', icon: <Settings size={15} /> },
];

function ScopeCheckbox<T>({
  items,
  selected,
  onToggle,
}: {
  items: ScopeItem<T>[];
  selected: Partial<Record<keyof T, boolean>>;
  onToggle: (key: keyof T) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map(item => {
        const checked = !!selected[item.key];
        return (
          <button
            key={String(item.key)}
            onClick={() => onToggle(item.key)}
            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
              checked
                ? item.danger
                  ? 'bg-red-50 border-red-300 shadow-sm'
                  : 'bg-blue-50 border-blue-300 shadow-sm'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
              checked
                ? item.danger ? 'bg-red-500 border-red-500' : 'bg-blue-600 border-blue-600'
                : 'border-gray-300'
            }`}>
              {checked && <CheckCircle size={12} className="text-white" />}
            </div>
            <div className="min-w-0">
              <div className={`flex items-center gap-1.5 text-sm font-semibold ${
                checked ? (item.danger ? 'text-red-700' : 'text-blue-700') : 'text-gray-700'
              }`}>
                <span className={checked ? (item.danger ? 'text-red-500' : 'text-blue-500') : 'text-gray-400'}>
                  {item.icon}
                </span>
                {item.label}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function LogPanel({ lines, onClose }: { lines: string[]; onClose: () => void }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Journal d'opération</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start gap-2 text-xs font-mono">
            <span className="text-green-400 flex-shrink-0 mt-0.5">›</span>
            <span className="text-gray-300">{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DataManagerView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('export');

  const [exportScope, setExportScope] = useState<ExportScope>({
    catalog: true, zones_tables: true, printers: true, settings: true,
    users: false, orders: false, payments: false, cash_sessions: false,
  });

  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<RestaurantExport | null>(null);
  const [importParseError, setImportParseError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [resetScope, setResetScope] = useState<ResetScope>({
    orders: false, payments: false, cash_sessions: false, print_jobs: false,
    catalog: false, zones_tables: false, printers: false, users: false, settings: false,
  });
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [showResetWarning, setShowResetWarning] = useState(false);

  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const toggleExport = (key: keyof ExportScope) =>
    setExportScope(s => ({ ...s, [key]: !s[key] }));

  const toggleReset = (key: keyof ResetScope) =>
    setResetScope(s => ({ ...s, [key]: !s[key] }));

  const selectedExportCount = Object.values(exportScope).filter(Boolean).length;
  const selectedResetCount = Object.values(resetScope).filter(Boolean).length;
  const hasDangerReset = RESET_SCOPE_ITEMS.some(i => i.danger && resetScope[i.key]);

  const handleExport = async () => {
    if (!selectedExportCount) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setLog([]);
    try {
      const payload = await exportData(exportScope);
      downloadExport(payload);
      const scopeKeys = (Object.keys(exportScope) as (keyof ExportScope)[])
        .filter(k => exportScope[k]);
      await logOperation(user?.id, 'EXPORT', scopeKeys, `Export — ${scopeKeys.join(', ')}`);
      setSuccess('Export téléchargé avec succès.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportParseError('');
    setImportPreview(null);
    try {
      const parsed = await parseImportFile(file);
      setImportPreview(parsed);
    } catch (err) {
      setImportParseError((err as Error).message);
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setLog([]);
    try {
      const lines = await importData(importPreview, importMode);
      setLog(lines);
      const scopeKeys = Object.keys(importPreview.data).filter(
        k => (importPreview.data as Record<string, unknown[]>)[k]?.length
      );
      await logOperation(user?.id, 'IMPORT', scopeKeys, `Import ${importMode} — ${importFile?.name ?? ''}`);
      setSuccess(`Import terminé — ${lines.length} domaines traités.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!selectedResetCount || resetConfirmText !== 'REINITIALISER') return;
    setLoading(true);
    setError('');
    setSuccess('');
    setLog([]);
    try {
      const lines = await resetData(resetScope);
      setLog(lines);
      const scopeKeys = (Object.keys(resetScope) as (keyof ResetScope)[]).filter(k => resetScope[k]);
      await logOperation(user?.id, 'RESET', scopeKeys, `Reset — ${scopeKeys.join(', ')}`);
      setSuccess('Réinitialisation effectuée.');
      setResetConfirmText('');
      setShowResetWarning(false);
      setResetScope({
        orders: false, payments: false, cash_sessions: false, print_jobs: false,
        catalog: false, zones_tables: false, printers: false, users: false, settings: false,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'export', label: 'Export', icon: <Download size={16} /> },
    { id: 'import', label: 'Import', icon: <Upload size={16} /> },
    { id: 'reset', label: 'Réinitialisation', icon: <Trash2 size={16} /> },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center">
          <Database size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Gestion des données</h2>
          <p className="text-xs text-gray-500">Export complet, import et réinitialisation sélective</p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setError(''); setSuccess(''); setLog([]); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? t.id === 'reset'
                  ? 'bg-red-600 text-white shadow'
                  : 'bg-white text-gray-900 shadow'
                : t.id === 'reset'
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-gray-600 hover:bg-white/60'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircle size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {tab === 'export' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">Sélectionner les domaines à exporter</p>
            <p className="text-xs text-gray-500 mb-3">Le fichier JSON généré est réimportable dans cette interface.</p>
            <ScopeCheckbox items={EXPORT_SCOPE_ITEMS} selected={exportScope} onToggle={toggleExport} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setExportScope(s => Object.fromEntries(Object.keys(s).map(k => [k, true])) as unknown as ExportScope)}
                className="text-xs text-blue-600 hover:underline"
              >
                Tout sélectionner
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setExportScope(s => Object.fromEntries(Object.keys(s).map(k => [k, false])) as unknown as ExportScope)}
                className="text-xs text-gray-500 hover:underline"
              >
                Tout désélectionner
              </button>
            </div>
            <button
              onClick={handleExport}
              disabled={loading || !selectedExportCount}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
            >
              {loading ? <Loader size={15} className="animate-spin" /> : <Download size={15} />}
              Exporter ({selectedExportCount})
            </button>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-sm font-bold text-gray-800 mb-1">Charger un fichier d'export</p>
            <p className="text-xs text-gray-500 mb-3">Format JSON généré par cet outil. Les données existantes ne sont pas supprimées en mode fusion.</p>
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-all"
          >
            <FileJson size={28} className="mx-auto text-gray-300 mb-2" />
            {importFile ? (
              <div>
                <p className="text-sm font-semibold text-gray-700">{importFile.name}</p>
                <p className="text-xs text-gray-400 mt-1">{(importFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-500">Cliquer pour sélectionner</p>
                <p className="text-xs text-gray-400 mt-1">Fichier .json exporté par THE WEST AFRICAN</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </div>

          {importParseError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-xs text-red-700">{importParseError}</p>
            </div>
          )}

          {importPreview && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                <span className="text-sm font-semibold text-gray-700">Fichier valide — version {importPreview.version}</span>
              </div>
              <p className="text-xs text-gray-500">Exporté le {new Date(importPreview.exported_at).toLocaleString('fr-FR')}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(importPreview.data).map(([key, rows]) => {
                  const arr = rows as unknown[];
                  return arr?.length ? (
                    <div key={key} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-1.5">
                      <span className="text-xs text-gray-600 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-bold text-gray-800">{arr.length}</span>
                    </div>
                  ) : null;
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">Mode d'import</p>
            <div className="flex gap-2">
              {([
                { id: 'merge' as ImportMode, label: 'Fusion', desc: 'Ajoute/met à jour sans supprimer' },
                { id: 'replace' as ImportMode, label: 'Remplacement', desc: 'Ecrase les données existantes' },
              ]).map(m => (
                <button
                  key={m.id}
                  onClick={() => setImportMode(m.id)}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    importMode === m.id
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className={`text-sm font-semibold ${importMode === m.id ? 'text-blue-700' : 'text-gray-700'}`}>{m.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button
              onClick={handleImport}
              disabled={loading || !importPreview}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
            >
              {loading ? <Loader size={15} className="animate-spin" /> : <Upload size={15} />}
              Importer
            </button>
          </div>
        </div>
      )}

      {tab === 'reset' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Zone de danger</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Les suppressions sont <strong>irréversibles</strong>. Effectuez un export complet avant toute réinitialisation.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <p className="text-sm font-bold text-gray-800 mb-1">Sélectionner les domaines à effacer</p>
              <p className="text-xs text-gray-500 mb-3">Les dépendances sont respectées (ex: commandes avant paiements).</p>
              <ScopeCheckbox items={RESET_SCOPE_ITEMS} selected={resetScope} onToggle={toggleReset} />
            </div>

            {selectedResetCount > 0 && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                {hasDangerReset && (
                  <button
                    onClick={() => setShowResetWarning(v => !v)}
                    className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-semibold text-red-700 hover:bg-red-100 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={15} />
                      {showResetWarning ? 'Masquer la confirmation' : `Confirmer la suppression (${selectedResetCount} domaine${selectedResetCount > 1 ? 's' : ''})`}
                    </div>
                    {showResetWarning ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                )}

                {(showResetWarning || !hasDangerReset) && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">
                      Tapez <strong>REINITIALISER</strong> pour confirmer la suppression définitive.
                    </p>
                    <input
                      type="text"
                      value={resetConfirmText}
                      onChange={e => setResetConfirmText(e.target.value)}
                      placeholder="REINITIALISER"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
                    />
                    <button
                      onClick={handleReset}
                      disabled={loading || resetConfirmText !== 'REINITIALISER'}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
                    >
                      {loading ? <Loader size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                      Réinitialiser les données sélectionnées
                    </button>
                  </div>
                )}

                {!hasDangerReset && (
                  <button
                    onClick={handleReset}
                    disabled={loading || !selectedResetCount}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all"
                  >
                    {loading ? <Loader size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Vider les données sélectionnées
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {log.length > 0 && <LogPanel lines={log} onClose={() => setLog([])} />}
    </div>
  );
}
