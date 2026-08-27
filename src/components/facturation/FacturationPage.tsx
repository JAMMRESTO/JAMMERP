import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Facture, Devis, Client, Company } from '../../types';
import { formatCurrency, formatDate, getStatutColor, getStatutLabel } from '../../lib/utils';
import { PeriodFilter, getDateRange } from '../../lib/dateFilter';
import PeriodFilterBar from '../ui/PeriodFilter';
import Modal from '../ui/Modal';
import SearchBar from '../ui/SearchBar';
import EmptyState from '../ui/EmptyState';
import FactureForm from './FactureForm';
import DevisForm from './DevisForm';
import FactureDetail from './FactureDetail';
import DevisDetail from './DevisDetail';
import RetoursPage from './RetoursPage';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props {
  companyId: string;
  company: Company;
  preselectedClientId?: string | null;
  initialAction?: 'facture' | 'devis' | 'retour' | null;
  onActionConsumed?: () => void;
}

export default function FacturationPage({ companyId, company, preselectedClientId, initialAction, onActionConsumed }: Props) {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('jour');
  const [tab, setTab] = useState<'factures' | 'devis' | 'retours'>('factures');
  const [showFactureForm, setShowFactureForm] = useState(false);
  const [showDevisForm, setShowDevisForm] = useState(false);
  const [viewFacture, setViewFacture] = useState<Facture | null>(null);
  const [viewDevis, setViewDevis] = useState<Devis | null>(null);
  const [editingFacture, setEditingFacture] = useState<Facture | null>(null);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [pendingPrintId, setPendingPrintId] = useState<string | null>(null);
  const [pendingPrintType, setPendingPrintType] = useState<'facture' | 'devis' | null>(null);
  const [formClientId, setFormClientId] = useState<string | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => { load(); }, [companyId, period]);
  useRealtimeRefresh(['factures', 'devis', 'clients'], companyId, useCallback(() => { load(true); }, [companyId, period]));

  useEffect(() => {
    if (initialAction && preselectedClientId) {
      setFormClientId(preselectedClientId);
      if (initialAction === 'facture') {
        setEditingFacture(null);
        setShowFactureForm(true);
        setTab('factures');
      } else if (initialAction === 'devis') {
        setEditingDevis(null);
        setShowDevisForm(true);
        setTab('devis');
      } else if (initialAction === 'retour') {
        setTab('retours');
      }
      onActionConsumed?.();
    }
  }, [initialAction, preselectedClientId]);

  async function load(silent = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    const { start, end } = getDateRange(period);
    const [{ data: f }, { data: d }, { data: c }] = await Promise.all([
      supabase.from('factures').select('*, clients(name)').eq('company_id', companyId).gte('date_facture', start).lte('date_facture', end).order('date_facture', { ascending: false }),
      supabase.from('devis').select('*, clients(name)').eq('company_id', companyId).gte('date_devis', start).lte('date_devis', end).order('date_devis', { ascending: false }),
      supabase.from('clients').select('id, name, phone, email, address, tax_number, credit_limit, balance, is_active').eq('company_id', companyId).eq('is_active', true).order('name'),
    ]);
    setFactures(f || []);
    setDevis(d || []);
    setClients(c || []);
    if (!silent) setLoading(false);
    loadingRef.current = false;
  }

  const filteredFactures = factures.filter(f =>
    f.numero.toLowerCase().includes(search.toLowerCase()) ||
    (f.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredDevis = devis.filter(d =>
    d.numero.toLowerCase().includes(search.toLowerCase()) ||
    (d.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const facturesNonPayees = factures.filter(f => ['envoyée', 'brouillon', 'partiellement_payée'].includes(f.statut));
  const totalImpaye = facturesNonPayees.reduce((a, f) => a + f.reste_a_payer, 0);
  const facturesEnvoyees = factures.filter(f => f.statut === 'envoyée');
  const facturesPartielles = factures.filter(f => f.statut === 'partiellement_payée');

  async function convertDevis(d: Devis) {
    const { data: count } = await supabase.from('factures').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    const numero = `FAC${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

    const { data: facture } = await supabase.from('factures').insert({
      company_id: companyId, client_id: d.client_id, devis_id: d.id, numero,
      date_facture: new Date().toISOString().split('T')[0], statut: 'brouillon',
      type_paiement: 'comptant', notes: d.notes, sous_total: d.sous_total,
      tva_montant: d.tva_montant, total: d.total, reste_a_payer: d.total
    }).select().single();

    if (!facture) return;

    const { data: lignes } = await supabase.from('devis_lignes').select('*').eq('devis_id', d.id);
    if (lignes) {
      await supabase.from('facture_lignes').insert(lignes.map(l => ({
        facture_id: facture.id, produit_id: l.produit_id, designation: l.designation,
        quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva_taux: l.tva_taux,
        montant_ht: l.montant_ht, montant_tva: l.montant_tva, montant_ttc: l.montant_ttc, sort_order: l.sort_order
      })));
    }

    await supabase.from('devis').update({ statut: 'converti' }).eq('id', d.id);
    load(true);
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Facturation</h2>
          {totalImpaye > 0 && (
            <p className="text-sm text-amber-600 font-medium">Impayés: {formatCurrency(totalImpaye, company.currency_symbol)}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab !== 'retours' && <PeriodFilterBar value={period} onChange={setPeriod} />}
          {tab !== 'retours' && (
            <>
              <button onClick={() => { setEditingDevis(null); setShowDevisForm(true); }}
                className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-3 py-2.5 rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">Devis</span>
              </button>
              <button onClick={() => { setEditingFacture(null); setShowFactureForm(true); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2.5 rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /><span className="hidden sm:inline">Facture</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab('factures')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'factures' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
          Factures ({factures.length})
        </button>
        <button onClick={() => setTab('devis')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'devis' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
          Devis ({devis.length})
        </button>
        <button onClick={() => setTab('retours')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'retours' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'}`}>
          Retours
        </button>
      </div>

      {tab !== 'retours' && (
        <div className="mb-4">
          <SearchBar value={search} onChange={setSearch} placeholder={`Rechercher un ${tab === 'factures' ? 'facture' : 'devis'}...`} />
        </div>
      )}

      {tab === 'retours' ? (
        <RetoursPage
          companyId={companyId}
          company={company}
          factures={factures}
          onRefreshFactures={() => load(true)}
        />
      ) : loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : tab === 'factures' ? (
        filteredFactures.length === 0 ? (
          <EmptyState icon={FileText} title="Aucune facture" description="Créez votre première facture" action={
            <button onClick={() => setShowFactureForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Nouvelle facture</button>
          } />
        ) : (() => {
          const totalFacture = filteredFactures.reduce((s, f) => s + f.total, 0);
          const totalPaye = filteredFactures.reduce((s, f) => s + (f.total - f.reste_a_payer), 0);
          const totalSolde = filteredFactures.reduce((s, f) => s + f.reste_a_payer, 0);
          return (
            <div className="space-y-3">
              {totalImpaye > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
                  <div className="px-4 py-2.5 flex items-center justify-between border-b border-red-100">
                    <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Récapitulatif des impayés</span>
                    <span className="text-xs text-red-500">{facturesNonPayees.length} facture{facturesNonPayees.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-red-100">
                    {facturesEnvoyees.length > 0 && (
                      <div className="px-4 py-3">
                        <div className="text-xs text-red-500 font-medium mb-0.5">Envoyées non payées</div>
                        <div className="font-bold text-red-700 text-sm">{formatCurrency(facturesEnvoyees.reduce((s, f) => s + f.reste_a_payer, 0), company.currency_symbol)}</div>
                        <div className="text-xs text-red-400">{facturesEnvoyees.length} facture{facturesEnvoyees.length > 1 ? 's' : ''}</div>
                      </div>
                    )}
                    {facturesPartielles.length > 0 && (
                      <div className="px-4 py-3">
                        <div className="text-xs text-amber-600 font-medium mb-0.5">Partiellement payées</div>
                        <div className="font-bold text-amber-700 text-sm">{formatCurrency(facturesPartielles.reduce((s, f) => s + f.reste_a_payer, 0), company.currency_symbol)}</div>
                        <div className="text-xs text-amber-500">{facturesPartielles.length} facture{facturesPartielles.length > 1 ? 's' : ''}</div>
                      </div>
                    )}
                    <div className="px-4 py-3 bg-red-100/60 col-span-2 sm:col-span-1">
                      <div className="text-xs text-red-600 font-medium mb-0.5">Total impayé</div>
                      <div className="font-extrabold text-red-700 text-base">{formatCurrency(totalImpaye, company.currency_symbol)}</div>
                    </div>
                  </div>
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Facture</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Client</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Date</th>
                      <th className="text-left px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide hidden lg:table-cell">Statut</th>
                      <th className="text-right px-3 py-3 font-semibold text-slate-600 text-xs uppercase tracking-wide">Montant</th>
                      <th className="text-right px-3 py-3 font-semibold text-emerald-600 text-xs uppercase tracking-wide hidden sm:table-cell">Payé</th>
                      <th className="text-right px-4 py-3 font-semibold text-red-500 text-xs uppercase tracking-wide">Solde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredFactures.map(f => {
                      const montantPaye = f.total - f.reste_a_payer;
                      return (
                        <tr key={f.id} className="hover:bg-blue-50/40 cursor-pointer transition-colors" onClick={() => setViewFacture(f)}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 text-sm">{f.numero}</div>
                            <div className="text-xs text-slate-500 sm:hidden">{(f.clients as any)?.name}</div>
                            <div className="sm:hidden mt-0.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(f.statut)}`}>{getStatutLabel(f.statut)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600 hidden sm:table-cell">
                            <div className="font-medium">{(f.clients as any)?.name}</div>
                            <div className="text-xs text-slate-400 capitalize">{f.type_paiement}</div>
                          </td>
                          <td className="px-3 py-3 text-slate-500 text-xs hidden md:table-cell">{formatDate(f.date_facture)}</td>
                          <td className="px-3 py-3 hidden lg:table-cell">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(f.statut)}`}>{getStatutLabel(f.statut)}</span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(f.total, company.currency_symbol)}</td>
                          <td className="px-3 py-3 text-right text-emerald-600 font-medium whitespace-nowrap hidden sm:table-cell">{formatCurrency(montantPaye, company.currency_symbol)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {f.reste_a_payer > 0
                              ? <span className="font-bold text-red-500">{formatCurrency(f.reste_a_payer, company.currency_symbol)}</span>
                              : <span className="text-emerald-500 font-semibold text-xs">Soldé</span>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-slate-50">
                      <td colSpan={2} className="px-4 py-3 font-bold text-slate-700 text-sm uppercase tracking-wide">Totaux</td>
                      <td className="hidden md:table-cell" />
                      <td className="hidden lg:table-cell" />
                      <td className="px-3 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(totalFacture, company.currency_symbol)}</td>
                      <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap hidden sm:table-cell">{formatCurrency(totalPaye, company.currency_symbol)}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-500 whitespace-nowrap">{formatCurrency(totalSolde, company.currency_symbol)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })()
      ) : (
        filteredDevis.length === 0 ? (
          <EmptyState icon={FileText} title="Aucun devis" description="Créez votre premier devis" action={
            <button onClick={() => setShowDevisForm(true)} className="bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Nouveau devis</button>
          } />
        ) : (
          <div className="grid gap-3">
            {filteredDevis.map(d => (
              <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="cursor-pointer flex-1" onClick={() => setViewDevis(d)}>
                    <div className="font-semibold text-slate-900">{d.numero}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{(d.clients as any)?.name} · {formatDate(d.date_devis)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-slate-900">{formatCurrency(d.total, company.currency_symbol)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(d.statut)}`}>{getStatutLabel(d.statut)}</span>
                    </div>
                    {d.statut !== 'converti' && d.statut !== 'refusé' && (
                      <button
                        onClick={() => { if (confirm('Convertir ce devis en facture ?')) convertDevis(d); }}
                        className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-100"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span className="hidden sm:inline">Convertir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showFactureForm && (
        <Modal title={editingFacture ? 'Modifier la facture' : 'Nouvelle facture'} onClose={() => setShowFactureForm(false)} size="xl">
          <FactureForm companyId={companyId} company={company} clients={clients} facture={editingFacture}
            preselectedClientId={editingFacture ? null : formClientId}
            onClientCreated={(newClient) => setClients(prev => [...prev, newClient])}
            onSave={async (newId) => {
              setShowFactureForm(false);
              setFormClientId(null);
              await load(true);
              if (newId && !editingFacture) {
                const { data: f } = await supabase.from('factures').select('*, clients(*)').eq('id', newId).maybeSingle();
                if (f) { setViewFacture(f); setPendingPrintId(newId); setPendingPrintType('facture'); }
              }
            }}
            onCancel={() => { setShowFactureForm(false); setFormClientId(null); }} />
        </Modal>
      )}

      {showDevisForm && (
        <Modal title={editingDevis ? 'Modifier le devis' : 'Nouveau devis'} onClose={() => setShowDevisForm(false)} size="xl">
          <DevisForm companyId={companyId} company={company} clients={clients} devis={editingDevis}
            preselectedClientId={editingDevis ? null : formClientId}
            onClientCreated={(newClient) => setClients(prev => [...prev, newClient])}
            onSave={async (newId) => {
              setShowDevisForm(false);
              setFormClientId(null);
              await load(true);
              if (newId && !editingDevis) {
                const { data: d } = await supabase.from('devis').select('*, clients(*)').eq('id', newId).maybeSingle();
                if (d) { setViewDevis(d); setPendingPrintId(newId); setPendingPrintType('devis'); }
              }
            }}
            onCancel={() => { setShowDevisForm(false); setFormClientId(null); }} />
        </Modal>
      )}

      {viewFacture && (
        <Modal title="Détail facture" onClose={() => { setViewFacture(null); setPendingPrintId(null); setPendingPrintType(null); }} size="xl">
          <FactureDetail
            factureId={viewFacture.id}
            company={company}
            onClose={() => { setViewFacture(null); setPendingPrintId(null); setPendingPrintType(null); }}
            onEdit={() => {
              if (!viewFacture || !['brouillon', 'envoyée'].includes(viewFacture.statut)) return;
              setEditingFacture(viewFacture); setViewFacture(null); setShowFactureForm(true); setPendingPrintId(null); setPendingPrintType(null);
            }}
            onRefresh={() => load(true)}
            autoOpenPrint={pendingPrintType === 'facture' && pendingPrintId === viewFacture.id}
            onPrintOpened={() => { setPendingPrintId(null); setPendingPrintType(null); }}
          />
        </Modal>
      )}

      {viewDevis && (
        <Modal title="Détail devis" onClose={() => { setViewDevis(null); setPendingPrintId(null); setPendingPrintType(null); }} size="xl">
          <DevisDetail
            devisId={viewDevis.id}
            company={company}
            onClose={() => { setViewDevis(null); setPendingPrintId(null); setPendingPrintType(null); }}
            onEdit={() => { setEditingDevis(viewDevis); setViewDevis(null); setShowDevisForm(true); setPendingPrintId(null); setPendingPrintType(null); }}
            onConvert={() => { convertDevis(viewDevis); setViewDevis(null); }}
            autoOpenPrint={pendingPrintType === 'devis' && pendingPrintId === viewDevis.id}
            onPrintOpened={() => { setPendingPrintId(null); setPendingPrintType(null); }}
          />
        </Modal>
      )}
    </div>
  );
}
