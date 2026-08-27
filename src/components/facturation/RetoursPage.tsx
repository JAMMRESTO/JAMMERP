import { useState, useEffect } from 'react';
import { RotateCcw, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Retour, Facture, Company, Client } from '../../types';
import { formatCurrency, formatDate, getStatutColor } from '../../lib/utils';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import SearchBar from '../ui/SearchBar';
import RetourForm from './RetourForm';

interface RetourWithRelations extends Retour {
  factures?: Facture & { clients?: Client };
  clients?: Client;
  retour_lignes?: Array<{
    id: string;
    designation: string;
    quantite_retournee: number;
    prix_unitaire: number;
    motif: string;
  }>;
}

interface Props {
  companyId: string;
  company: Company;
  factures: Facture[];
  onRefreshFactures: () => void;
}

export default function RetoursPage({ companyId, company, factures, onRefreshFactures }: Props) {
  const [retours, setRetours] = useState<RetourWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState<Facture | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [factureSearch, setFactureSearch] = useState('');

  useEffect(() => { load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('retours')
      .select('*, factures(numero, total, date_facture, clients(name)), clients(name), retour_lignes(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setRetours((data as RetourWithRelations[]) || []);
    setLoading(false);
  }

  const filtered = retours.filter(r => {
    const q = search.toLowerCase();
    const facNum = (r.factures as any)?.numero?.toLowerCase() || '';
    const clientName = (r.clients as any)?.name?.toLowerCase() || '';
    return facNum.includes(q) || clientName.includes(q) || r.motif?.toLowerCase().includes(q);
  });

  const totalRembourse = retours.reduce((a, r) => a + r.montant_rembourse, 0);

  function openForm(facture: Facture) {
    setSelectedFacture(facture);
    setShowForm(true);
    setFactureSearch('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">
            {retours.length} retour{retours.length !== 1 ? 's' : ''} —{' '}
            <span className="font-semibold text-amber-600">{formatCurrency(totalRembourse, company.currency_symbol)} remboursés</span>
          </div>
        </div>
        <button
          onClick={() => { setSelectedFacture(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau retour</span>
        </button>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher par facture, client, motif..." />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="Aucun retour"
          description="Les retours de marchandises apparaîtront ici"
          action={
            <button onClick={() => setShowForm(true)} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              Enregistrer un retour
            </button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map(r => {
            const isExpanded = expandedId === r.id;
            const facture = r.factures as any;
            const client = r.clients as any;
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-slate-900">{facture?.numero || '—'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                          r.type_retour === 'total' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {r.type_retour === 'total' ? 'Retour total' : 'Retour partiel'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 mt-0.5">
                        {client?.name} · {formatDate(r.date_retour)}
                      </div>
                      {r.motif && <div className="text-xs text-slate-400 mt-0.5 italic">"{r.motif}"</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold text-amber-600">{formatCurrency(r.montant_rembourse, company.currency_symbol)}</div>
                        <div className="text-xs text-slate-400">remboursé</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </div>
                  </div>
                </button>

                {isExpanded && r.retour_lignes && r.retour_lignes.length > 0 && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-amber-50/40">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Articles retournés</div>
                    <div className="space-y-1.5">
                      {r.retour_lignes.map((l, i) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 px-3 bg-white rounded-xl border border-amber-100">
                          <span className="text-slate-800">{l.designation}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-slate-500">x{l.quantite_retournee}</span>
                            <span className="font-medium text-amber-700">{formatCurrency(l.quantite_retournee * l.prix_unitaire, company.currency_symbol)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && !selectedFacture && (
        <Modal title="Choisir une facture pour le retour" onClose={() => setShowForm(false)} size="md">
          <div className="space-y-3 p-1">
            <input
              type="text"
              value={factureSearch}
              onChange={e => setFactureSearch(e.target.value)}
              placeholder="Rechercher une facture..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
            <div className="max-h-80 overflow-y-auto space-y-2">
              {factures
                .filter(f =>
                  ['envoyée', 'partiellement_payée', 'payée'].includes(f.statut) &&
                  (f.numero.toLowerCase().includes(factureSearch.toLowerCase()) ||
                    (f.clients as any)?.name?.toLowerCase().includes(factureSearch.toLowerCase()))
                )
                .map(f => (
                  <button
                    key={f.id}
                    onClick={() => openForm(f)}
                    className="w-full flex items-center justify-between bg-gray-50 hover:bg-amber-50 border border-gray-100 hover:border-amber-200 rounded-xl p-3 text-left transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">{f.numero}</div>
                      <div className="text-xs text-slate-500">{(f.clients as any)?.name} · {formatDate(f.date_facture)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900 text-sm">{formatCurrency(f.total, company.currency_symbol)}</div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${getStatutColor(f.statut)}`}>
                        {f.statut}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </Modal>
      )}

      {showForm && selectedFacture && (
        <Modal title="Nouveau retour" onClose={() => { setShowForm(false); setSelectedFacture(null); }} size="lg">
          <div className="p-1">
            <RetourForm
              facture={selectedFacture}
              company={company}
              onDone={async () => {
                setShowForm(false);
                setSelectedFacture(null);
                await load();
                onRefreshFactures();
              }}
              onCancel={() => { setShowForm(false); setSelectedFacture(null); }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
