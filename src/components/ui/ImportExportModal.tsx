import { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, X, Loader, Info } from 'lucide-react';
import { parseXlsx, parseCsv, EntityType } from '../../lib/importExport';
import { supabase } from '../../lib/supabase';

interface TemplateColumn {
  key: string;
  label: string;
  hint: string;
  required: boolean;
  example: string;
}

interface Props {
  entityType: EntityType;
  companyId: string;
  companyName: string;
  onClose: () => void;
  onImportDone: () => void;
  onExport: () => void;
  onDownloadTemplate: () => void;
  parseRows: (rows: string[][], companyId: string) => {
    data: Record<string, unknown>[];
    errors: { row: number; message: string }[];
  };
  tableName: string;
  entityLabel: string;
  templateColumns: TemplateColumn[];
  templateExamples: Record<string, string>[];
  columnToDataKey?: Record<string, string>;
  duplicateKeys?: string[];
}

type Step = 'idle' | 'preview' | 'importing' | 'done';

interface PreviewRow {
  index: number;
  data: Record<string, unknown>;
  error?: string;
  duplicate?: boolean;
}

const HIDDEN_KEYS = ['company_id', 'is_active', 'category_id', 'conditionnement', 'conditionnement_quantite'];

export default function ImportExportModal({
  companyId,
  onClose,
  onImportDone,
  onExport,
  onDownloadTemplate,
  parseRows,
  tableName,
  entityLabel,
  templateColumns,
  templateExamples,
  columnToDataKey = {},
  duplicateKeys = [],
}: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<{ row: number; message: string }[]>([]);
  const [importResult, setImportResult] = useState<{ success: number; errors: number; skipped: number } | null>(null);
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState<'colonnes' | 'exemples'>('colonnes');
  const fileRef = useRef<HTMLInputElement>(null);

  function makeKey(row: Record<string, unknown>, keys: string[]): string {
    return keys.map(k => String(row[k] ?? '').toLowerCase().trim()).join('|||');
  }

  async function processRows(rows: string[][]) {
    if (rows.length < 2) {
      setParseErrors([{ row: 0, message: 'Le fichier est vide ou ne contient que l\'entête' }]);
      setStep('preview');
      return;
    }
    const { data, errors } = parseRows(rows, companyId);
    const preview: PreviewRow[] = data.map((d, i) => ({ index: i + 2, data: d }));
    errors.forEach(err => {
      const existing = preview.find(p => p.index === err.row);
      if (existing) existing.error = err.message;
      else preview.push({ index: err.row, data: {}, error: err.message });
    });

    if (duplicateKeys.length > 0) {
      const selectCols = duplicateKeys.join(',');
      const { data: existing } = await supabase
        .from(tableName)
        .select(selectCols)
        .eq('company_id', companyId);

      const existingKeys = new Set(
        (existing || []).map((r: Record<string, unknown>) => makeKey(r, duplicateKeys))
      );

      const seenInFile = new Set<string>();
      for (const row of preview) {
        if (row.error || Object.keys(row.data).length === 0) continue;
        const key = makeKey(row.data, duplicateKeys);
        if (existingKeys.has(key) || seenInFile.has(key)) {
          row.duplicate = true;
        }
        seenInFile.add(key);
      }
    }

    preview.sort((a, b) => a.index - b.index);
    setPreviewRows(preview);
    setParseErrors(errors);
    setStep('preview');
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';

    if (isXlsx) {
      try {
        const rows = await parseXlsx(file);
        await processRows(rows);
      } catch (e) {
        setParseErrors([{ row: 0, message: e instanceof Error ? e.message : 'Erreur de lecture du fichier Excel' }]);
        setStep('preview');
      }
    } else {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const rows = parseCsv(text);
        await processRows(rows);
      };
      reader.readAsText(file, 'UTF-8');
    }
  }

  async function handleImport() {
    const validRows = previewRows.filter(r => !r.error && !r.duplicate && Object.keys(r.data).length > 0);
    const skippedCount = previewRows.filter(r => r.duplicate).length;
    if (validRows.length === 0 && skippedCount === 0) return;

    setStep('importing');
    let success = 0;
    let errors = 0;

    for (const row of validRows) {
      const { error } = await supabase.from(tableName).insert(row.data);
      if (error) errors++;
      else success++;
    }

    setImportResult({ success, errors, skipped: skippedCount });
    setStep('done');
    if (success > 0) onImportDone();
  }

  const duplicateCount = previewRows.filter(r => r.duplicate).length;
  const validCount = previewRows.filter(r => !r.error && !r.duplicate).length;
  const errorCount = parseErrors.length;
  const previewColumns = templateColumns.filter(c => !HIDDEN_KEYS.includes(c.key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-slate-900">Import / Export — {entityLabel}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'idle' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={onDownloadTemplate}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800 text-sm">Télécharger le modèle Excel</div>
                    <div className="text-xs text-slate-500 mt-0.5">Fichier .xlsx pré-rempli avec exemples et guide</div>
                  </div>
                </button>

                <button
                  onClick={onExport}
                  className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors flex-shrink-0">
                    <Download className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-800 text-sm">Exporter les données</div>
                    <div className="text-xs text-slate-500 mt-0.5">Exporter tous les {entityLabel.toLowerCase()} en Excel</div>
                  </div>
                </button>
              </div>

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex border-b border-gray-200 bg-gray-50">
                  <button
                    onClick={() => setActiveTab('colonnes')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === 'colonnes' ? 'bg-white text-blue-600 border-b-2 border-blue-500 -mb-px' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Info className="w-4 h-4" />
                    Guide des colonnes
                  </button>
                  <button
                    onClick={() => setActiveTab('exemples')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === 'exemples' ? 'bg-white text-blue-600 border-b-2 border-blue-500 -mb-px' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <FileText className="w-4 h-4" />
                    Aperçu des exemples
                  </button>
                </div>

                {activeTab === 'colonnes' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-semibold w-8">#</th>
                          <th className="px-4 py-3 text-left font-semibold">Colonne</th>
                          <th className="px-4 py-3 text-left font-semibold">Description</th>
                          <th className="px-4 py-3 text-left font-semibold">Exemple</th>
                          <th className="px-4 py-3 text-left font-semibold w-24">Requis</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {templateColumns.map((col, i) => (
                          <tr key={col.key} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-4 py-3 text-slate-400 text-xs">{i + 1}</td>
                            <td className="px-4 py-3">
                              <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-xs font-mono">{col.label}</code>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{col.hint}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs font-mono">{col.example || '—'}</td>
                            <td className="px-4 py-3">
                              {col.required ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">Obligatoire</span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Optionnel</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'exemples' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                          <th className="px-3 py-3 text-left font-semibold w-8">#</th>
                          {previewColumns.map(col => (
                            <th key={col.key} className="px-3 py-3 text-left font-semibold whitespace-nowrap">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {templateExamples.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                            {previewColumns.map(col => (
                              <td key={col.key} className="px-3 py-3 text-slate-700 whitespace-nowrap max-w-[160px] truncate">
                                {row[col.key] || <span className="text-slate-300">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-slate-400">importer un fichier Excel ou CSV</span>
                </div>
              </div>

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-3 p-7 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-slate-700 text-sm">Cliquer pour sélectionner un fichier</div>
                  <div className="text-xs text-slate-400 mt-1">Formats acceptés : Excel (.xlsx) et CSV (.csv)</div>
                </div>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <FileText className="w-5 h-5 text-slate-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 truncate">{fileName}</div>
                  <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                    <span className="text-emerald-600 font-semibold">{validCount} ligne(s) valide(s)</span>
                    {duplicateCount > 0 && <span className="text-amber-600 font-semibold">{duplicateCount} doublon(s)</span>}
                    {errorCount > 0 && <span className="text-red-500 font-semibold">{errorCount} erreur(s)</span>}
                  </div>
                </div>
              </div>

              {errorCount > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm font-semibold text-red-700">Erreurs détectées</span>
                  </div>
                  <ul className="space-y-1">
                    {parseErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600">
                        Ligne {err.row}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {duplicateCount > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm text-amber-700">
                      <span className="font-semibold">{duplicateCount} doublon(s)</span> ignor{duplicateCount > 1 ? 'es' : 'e'} (nom + telephone identiques)
                    </span>
                  </div>
                </div>
              )}

              {validCount > 0 && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-emerald-700">
                      <span className="font-semibold">{validCount} enregistrement(s)</span> prêt(s) à importer
                    </span>
                  </div>
                </div>
              )}

              {previewRows.filter(r => !r.error).length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-slate-500 uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold">#</th>
                        {previewColumns.map(col => (
                          <th key={col.key} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{col.label}</th>
                        ))}
                        <th className="px-3 py-2.5 text-left font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewRows.filter(r => !r.error).map((row, i) => (
                        <tr key={row.index} className={`${row.duplicate ? 'bg-amber-50/60 opacity-60' : i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-slate-50/50 hover:bg-gray-50'}`}>
                          <td className="px-3 py-2.5 text-slate-400">{row.index}</td>
                          {previewColumns.map(col => {
                            const dataKey = columnToDataKey[col.key] ?? col.key;
                            const val = String(row.data[dataKey] ?? '');
                            return (
                              <td key={col.key} className={`px-3 py-2.5 whitespace-nowrap max-w-[160px] truncate ${row.duplicate ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                                {val || <span className="text-slate-300">—</span>}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {row.duplicate ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Doublon</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Nouveau</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validCount + duplicateCount > 5 && (
                    <div className="px-3 py-2 text-xs text-slate-400 bg-gray-50 border-t border-gray-100">
                      {validCount} nouveau(x) sur {validCount + duplicateCount} ligne(s)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader className="w-12 h-12 text-blue-500 animate-spin" />
              <div className="text-sm font-semibold text-slate-700">Importation en cours...</div>
              <div className="text-xs text-slate-400">Veuillez patienter</div>
            </div>
          )}

          {step === 'done' && importResult && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-slate-900">Importation terminée</div>
                <div className="text-sm text-slate-500 mt-1 flex flex-wrap justify-center gap-x-3">
                  <span className="text-emerald-600 font-semibold">{importResult.success} importé(s)</span>
                  {importResult.skipped > 0 && (
                    <span className="text-amber-600 font-semibold">{importResult.skipped} doublon(s) ignoré(s)</span>
                  )}
                  {importResult.errors > 0 && (
                    <span className="text-red-500 font-semibold">{importResult.errors} échec(s)</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          {step === 'idle' || step === 'done' ? (
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors">
              Fermer
            </button>
          ) : step === 'preview' ? (
            <>
              <button
                onClick={() => { setStep('idle'); setPreviewRows([]); setParseErrors([]); setFileName(''); }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm transition-colors"
              >
                Importer {validCount} ligne(s)
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
