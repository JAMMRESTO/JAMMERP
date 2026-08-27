import { useState, useEffect, useCallback } from 'react';
import { Plus, Truck, Phone, Mail, CreditCard as Edit2, Trash2, FileText, Upload, Moon, Sun, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Fournisseur, FactureFournisseur, Profile } from '../../types';
import { formatCurrency, formatDate, getStatutColor, getStatutLabel } from '../../lib/utils';
import { hasPermission, isAdmin } from '../../lib/permissions';
import { exportFournisseurs, downloadFournisseursTemplate, parseFournisseurs, FOURNISSEURS_TEMPLATE_COLUMNS, FOURNISSEURS_TEMPLATE_EXAMPLES } from '../../lib/importExport';
import Modal from '../ui/Modal';
import SearchBar from '../ui/SearchBar';
import EmptyState from '../ui/EmptyState';
import FournisseurForm from './FournisseurForm';
import FactureFournisseurForm from './FactureFournisseurForm';
import ReglementFournisseurModal from './ReglementFournisseurModal';
import ImportExportModal from '../ui/ImportExportModal';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props { companyId: string; currencySymbol: string; tvaEnabled: boolean; tvaRate: number; companyName?: string; profile?: Profile | null; }

export default function FournisseursPage({ companyId, currencySymbol, tvaEnabled, tvaRate, companyName = 'entreprise', profile }: Props) {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [filtered, setFiltered] = useState<Fournisseur[]>([]);
  const [factures, setFactures] = useState<FactureFournisseur[]>([]);
  const [search, setSearch] = useState('');
  const [showInactifs, setShowInactifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'fournisseurs' | 'factures'>('fournisseurs');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Fournisseur | null>(null);
  const [showFactureForm, setShowFactureForm] = useState(false);
  const [editingFacture, setEditingFacture] = useState<FactureFournisseur | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [reglementFacture, setReglementFacture] = useState<FactureFournisseur | null>(null);

  useEffect(() => { load(); }, [companyId]);
  useRealtimeRefresh(['fournisseurs', 'factures_fournisseurs'], companyId, useCallback(() => { load(true); }, [companyId]));
  useEffect(() => {
    setFiltered(fournisseurs.filter(f =>
      (showInactifs ? !f.is_active : f.is_active) &&
      (f.name.toLowerCase().includes(search.toLowerCase()) || f.phone.includes(search))
    ));
  }, [search, fournisseurs, showInactifs]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: fourn }, { data: fact }] = await Promise.all([
      supabase.from('fournisseurs').select('*').eq('company_id', companyId).order('name'),
      supabase.from('factures_fournisseurs').select('*, fournisseurs(name)').eq('company_id', companyId).order('date_facture', { ascending: false }),
    ]);
    setFournisseurs(fourn || []);
    setFactures(fact || []);
    if (!silent) setLoading(false);
  }

  async function toggleSommeil(f: Fournisseur) {
    await supabase.from('fournisseurs').update({ is_active: !f.is_active }).eq('id', f.id);
    load(true);
  }

  async function deleteItem(id: string) {
    const [{ count: ffCount }, { count: pfCount }] = await Promise.all([
      supabase.from('factures_fournisseurs').select('id', { count: 'exact', head: true }).eq('fournisseur_id', id),
      supabase.from('paiements_fournisseurs').select('id', { count: 'exact', head: true }).eq('fournisseur_id', id),
    ]);
    if ((ffCount || 0) + (pfCount || 0) > 0) {
      alert('Impossible de supprimer ce fournisseur car il a des mouvements (factures ou paiements fournisseur).');
      return;
    }
    if (!confirm('Supprimer ce fournisseur ?')) return;
    await supabase.from('fournisseurs').delete().eq('id', id);
    load(true);
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Fournisseurs</h2>
          <p className="text-sm text-slate-500">
            {fournisseurs.filter(f => f.is_active).length} fournisseur(s) actif(s)
            {fournisseurs.filter(f => !f.is_active).length > 0 && <> · <span className="text-slate-400">{fournisseurs.filter(f => !f.is_active).length} en sommeil</span></>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInactifs(v => !v)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors ${showInactifs ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
            title={showInactifs ? 'Voir fournisseurs actifs' : 'Voir fournisseurs en sommeil'}
          >
            {showInactifs ? <Sun className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{showInactifs ? 'Actifs' : 'En sommeil'}</span>
            {!showInactifs && fournisseurs.filter(f => !f.is_active).length > 0 && (
              <span className="bg-slate-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{fournisseurs.filter(f => !f.is_active).length}</span>
            )}
          </button>
          {hasPermission(profile ?? null, 'import_export') && (
            <button
              onClick={() => setShowImportExport(true)}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import / Export</span>
            </button>
          )}
          {!showInactifs && (
            <>
              <button onClick={() => { setEditingFacture(null); setShowFactureForm(true); }}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Facture achat</span>
              </button>
              <button onClick={() => { setEditing(null); setShowForm(true); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouveau</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {(['fournisseurs', 'factures'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
            {t === 'fournisseurs' ? 'Fournisseurs' : 'Factures achat'}
          </button>
        ))}
      </div>

      {tab === 'fournisseurs' && (
        <>
          <div className="mb-4"><SearchBar value={search} onChange={setSearch} placeholder="Rechercher..." /></div>
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={showInactifs ? Moon : Truck}
              title={showInactifs ? 'Aucun fournisseur en sommeil' : 'Aucun fournisseur'}
              description={showInactifs ? "Aucun fournisseur n'a été mis en sommeil" : 'Ajoutez vos fournisseurs'}
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map(f => (
                <div key={f.id} className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow ${!f.is_active ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${f.is_active ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                        <Truck className={`w-5 h-5 ${f.is_active ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {f.name}
                          {!f.is_active && <span className="text-xs font-normal bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">En sommeil</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {f.phone && <span className="flex items-center gap-1 text-xs text-slate-500"><Phone className="w-3 h-3" />{f.phone}</span>}
                          {f.email && <span className="flex items-center gap-1 text-xs text-slate-500"><Mail className="w-3 h-3" />{f.email}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.balance !== 0 && (
                        <div className={`text-sm font-semibold hidden sm:block ${f.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {formatCurrency(Math.abs(f.balance), currencySymbol)}
                        </div>
                      )}
                      {f.is_active && (
                        <button onClick={() => { setEditing(f); setShowForm(true); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleSommeil(f)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${f.is_active ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-emerald-50 text-emerald-500'}`}
                        title={f.is_active ? 'Mettre en sommeil' : 'Réactiver'}
                      >
                        {f.is_active ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </button>
                      {isAdmin(profile ?? null) && (
                        <button onClick={() => deleteItem(f.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'factures' && (() => {
        const impayees = factures.filter(f => f.statut === 'reçue' || f.statut === 'partiellement_payée');
        const totalImpaye = impayees.reduce((s, f) => s + f.reste_a_payer, 0);
        return (
          <div className="space-y-3">
            {impayees.length > 0 && (
              <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
                <div className="px-4 py-2.5 flex items-center justify-between border-b border-red-100">
                  <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Factures à régler</span>
                  <span className="text-xs text-red-500">{impayees.length} facture{impayees.length > 1 ? 's' : ''}</span>
                </div>
                <div className="px-4 py-3">
                  <div className="text-xs text-red-600 font-medium mb-0.5">Total dû aux fournisseurs</div>
                  <div className="font-extrabold text-red-700 text-base">{formatCurrency(totalImpaye, currencySymbol)}</div>
                </div>
              </div>
            )}
            {factures.length === 0 ? (
              <EmptyState icon={FileText} title="Aucune facture achat" description="Enregistrez vos achats fournisseurs" />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Facture</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Fournisseur</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">Statut</th>
                      <th className="text-right px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Montant</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-500 text-xs uppercase tracking-wide">Solde</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {factures.map(f => (
                      <tr key={f.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-4 py-3 cursor-pointer" onClick={() => { setEditingFacture(f); setShowFactureForm(true); }}>
                          <div className="font-semibold text-slate-900 text-sm">{f.numero}</div>
                          <div className="text-xs text-slate-500 sm:hidden">{(f.fournisseurs as any)?.name || '—'}</div>
                          <div className="sm:hidden mt-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(f.statut)}`}>{getStatutLabel(f.statut)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600 hidden sm:table-cell cursor-pointer" onClick={() => { setEditingFacture(f); setShowFactureForm(true); }}>
                          {(f.fournisseurs as any)?.name || '—'}
                        </td>
                        <td className="px-3 py-3 text-slate-500 text-xs hidden md:table-cell cursor-pointer" onClick={() => { setEditingFacture(f); setShowFactureForm(true); }}>
                          {formatDate(f.date_facture)}
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell cursor-pointer" onClick={() => { setEditingFacture(f); setShowFactureForm(true); }}>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(f.statut)}`}>{getStatutLabel(f.statut)}</span>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900 whitespace-nowrap cursor-pointer" onClick={() => { setEditingFacture(f); setShowFactureForm(true); }}>
                          {formatCurrency(f.total, currencySymbol)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap cursor-pointer" onClick={() => { setEditingFacture(f); setShowFactureForm(true); }}>
                          {f.reste_a_payer > 0
                            ? <span className="font-bold text-red-500">{formatCurrency(f.reste_a_payer, currencySymbol)}</span>
                            : <span className="text-emerald-500 font-semibold text-xs">Soldée</span>
                          }
                        </td>
                        <td className="px-3 py-3 text-right">
                          {f.reste_a_payer > 0 && (
                            <button
                              onClick={() => setReglementFacture(f)}
                              className="flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl font-semibold hover:bg-emerald-100 border border-emerald-200 whitespace-nowrap"
                            >
                              <FileText className="w-3 h-3" />
                              Régler
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {showForm && (
        <Modal title={editing ? 'Modifier fournisseur' : 'Nouveau fournisseur'} onClose={() => setShowForm(false)}>
          <FournisseurForm companyId={companyId} fournisseur={editing}
            onSave={() => { setShowForm(false); load(true); }} onCancel={() => setShowForm(false)} />
        </Modal>
      )}

      {showFactureForm && (
        <Modal title={editingFacture ? 'Facture achat' : 'Nouvelle facture achat'} onClose={() => setShowFactureForm(false)} size="xl">
          <FactureFournisseurForm companyId={companyId} fournisseurs={fournisseurs} facture={editingFacture}
            currencySymbol={currencySymbol} tvaEnabled={tvaEnabled} tvaRate={tvaRate}
            onSave={() => { setShowFactureForm(false); load(true); }} onCancel={() => setShowFactureForm(false)} />
        </Modal>
      )}

      {reglementFacture && (
        <Modal title="Régler la facture fournisseur" onClose={() => setReglementFacture(null)} size="lg">
          <ReglementFournisseurModal
            facture={reglementFacture}
            currencySymbol={currencySymbol}
            companyId={companyId}
            onSave={() => { setReglementFacture(null); load(true); }}
            onCancel={() => setReglementFacture(null)}
          />
        </Modal>
      )}

      {showImportExport && (
        <ImportExportModal
          entityType="fournisseurs"
          companyId={companyId}
          companyName={companyName}
          onClose={() => setShowImportExport(false)}
          onImportDone={() => { setShowImportExport(false); load(true); }}
          onExport={() => exportFournisseurs(fournisseurs as unknown as Record<string, unknown>[], companyName)}
          onDownloadTemplate={() => downloadFournisseursTemplate(companyName)}
          parseRows={parseFournisseurs}
          tableName="fournisseurs"
          entityLabel="Fournisseurs"
          templateColumns={FOURNISSEURS_TEMPLATE_COLUMNS}
          templateExamples={FOURNISSEURS_TEMPLATE_EXAMPLES}
          columnToDataKey={{ nom: 'name', telephone: 'phone', adresse: 'address', numero_fiscal: 'tax_number', encours: 'balance' }}
          duplicateKeys={['name', 'phone']}
        />
      )}
    </div>
  );
}
