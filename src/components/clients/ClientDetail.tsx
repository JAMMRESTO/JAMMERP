import { useState, useEffect } from 'react';
import { ArrowLeft, Phone, Mail, MapPin, FileText, Receipt, RotateCcw, TrendingUp, AlertTriangle, CheckCircle, Clock, CreditCard, CreditCard as Edit2, Banknote, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Facture, Devis, Company } from '../../types';
import { formatCurrency, formatDate, getStatutColor, getStatutLabel } from '../../lib/utils';

interface Props {
  client: Client;
  company: Company;
  companyId: string;
  onBack: () => void;
  onEdit: (client: Client) => void;
  onCreateFacture: (clientId: string) => void;
  onCreateDevis: (clientId: string) => void;
  onCreateRetour: (clientId: string) => void;
}

interface ClientStats {
  totalFacture: number;
  totalPaye: number;
  totalImpaye: number;
  totalDevis: number;
  nbFactures: number;
  nbDevis: number;
  nbRetours: number;
}

export default function ClientDetail({
  client, company, companyId, onBack, onEdit,
  onCreateFacture, onCreateDevis, onCreateRetour
}: Props) {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'factures' | 'devis'>('factures');

  useEffect(() => { load(); }, [client.id]);

  async function load() {
    setLoading(true);
    const [{ data: f }, { data: d }] = await Promise.all([
      supabase.from('factures')
        .select('*')
        .eq('company_id', companyId)
        .eq('client_id', client.id)
        .order('date_facture', { ascending: false })
        .limit(20),
      supabase.from('devis')
        .select('*')
        .eq('company_id', companyId)
        .eq('client_id', client.id)
        .order('date_devis', { ascending: false })
        .limit(20),
    ]);

    const fList = f || [];
    const dList = d || [];
    setFactures(fList);
    setDevis(dList);

    const totalFacture = fList.reduce((s, x) => s + x.total, 0);
    const totalPaye = fList.reduce((s, x) => s + x.montant_paye, 0);
    const totalImpaye = fList
      .filter(x => ['envoyée', 'partiellement_payée'].includes(x.statut))
      .reduce((s, x) => s + x.reste_a_payer, 0);

    setStats({
      totalFacture,
      totalPaye,
      totalImpaye,
      totalDevis: dList.reduce((s, x) => s + x.total, 0),
      nbFactures: fList.length,
      nbDevis: dList.length,
      nbRetours: 0,
    });
    setLoading(false);
  }

  const sym = company.currency_symbol;
  const solde = client.balance;
  const encours = factures
    .filter(f => ['envoyée', 'partiellement_payée'].includes(f.statut))
    .reduce((s, f) => s + f.reste_a_payer, 0);
  const creditLimit = client.credit_limit || 0;
  const limitPct = creditLimit > 0 ? Math.min((encours / creditLimit) * 100, 100) : 0;
  const limitDanger = creditLimit > 0 && encours >= creditLimit;
  const limitWarning = creditLimit > 0 && encours >= creditLimit * 0.8 && !limitDanger;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold text-lg">{client.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{client.name}</h2>
                {client.tax_number && (
                  <span className="text-xs text-slate-400">NINEA: {client.tax_number}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => onEdit(client)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-slate-600 hover:bg-gray-50 text-xs font-medium transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Modifier
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {client.phone && (
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-slate-600 truncate">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="truncate">{client.email}</span>
              </div>
            )}
            {client.address && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{client.address}</span>
              </div>
            )}
          </div>

          {client.notes && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-slate-500">{client.notes}</div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className={`rounded-2xl border p-4 shadow-sm ${
            solde > 0 ? 'bg-red-50 border-red-200' :
            solde < 0 ? 'bg-emerald-50 border-emerald-200' :
            'bg-white border-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <Banknote className={`w-4 h-4 ${solde > 0 ? 'text-red-500' : solde < 0 ? 'text-emerald-500' : 'text-slate-400'}`} />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Solde</span>
            </div>
            <div className={`text-xl font-bold ${solde > 0 ? 'text-red-600' : solde < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
              {solde > 0 ? '+' : ''}{formatCurrency(solde, sym)}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {solde > 0 ? 'Montant dû par le client' : solde < 0 ? 'Crédit / trop-perçu' : 'Compte soldé'}
            </div>
          </div>

          <div className={`rounded-2xl border p-4 shadow-sm ${
            limitDanger ? 'bg-red-50 border-red-200' :
            limitWarning ? 'bg-amber-50 border-amber-200' :
            'bg-white border-gray-100'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              {limitDanger ? <AlertTriangle className="w-4 h-4 text-red-500" /> :
               limitWarning ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
               <Activity className="w-4 h-4 text-slate-400" />}
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Encours</span>
            </div>
            <div className={`text-xl font-bold ${limitDanger ? 'text-red-600' : limitWarning ? 'text-amber-600' : 'text-slate-700'}`}>
              {formatCurrency(encours, sym)}
            </div>
            {creditLimit > 0 ? (
              <>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${limitDanger ? 'bg-red-500' : limitWarning ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${limitPct}%` }}
                  />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Limite : {formatCurrency(creditLimit, sym)} ({Math.round(limitPct)}% utilisé)
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 mt-0.5">Factures impayées en cours</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Facturé total', value: formatCurrency(stats?.totalFacture ?? 0, sym), icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Encaissé', value: formatCurrency(stats?.totalPaye ?? 0, sym), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Impayé', value: formatCurrency(stats?.totalImpaye ?? 0, sym), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-center">
            <div className={`w-8 h-8 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="font-bold text-slate-900 text-sm">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-slate-800 text-sm mb-3">Actions rapides</h3>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onCreateDevis(client.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 transition-all group"
            >
              <div className="w-9 h-9 bg-white group-hover:bg-blue-100 rounded-xl flex items-center justify-center shadow-sm transition-colors">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-700">Nouveau devis</span>
            </button>
            <button
              onClick={() => onCreateFacture(client.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-200 transition-all group"
            >
              <div className="w-9 h-9 bg-white group-hover:bg-emerald-100 rounded-xl flex items-center justify-center shadow-sm transition-colors">
                <Receipt className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">Nouvelle facture</span>
            </button>
            <button
              onClick={() => onCreateRetour(client.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 transition-all group"
            >
              <div className="w-9 h-9 bg-white group-hover:bg-orange-100 rounded-xl flex items-center justify-center shadow-sm transition-colors">
                <RotateCcw className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-xs font-semibold text-slate-700 group-hover:text-orange-700">Retour facture</span>
            </button>
          </div>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('factures')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'factures' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Factures
            {stats && <span className="ml-1 bg-gray-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{stats.nbFactures}</span>}
          </button>
          <button
            onClick={() => setActiveTab('devis')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === 'devis' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Devis
            {stats && <span className="ml-1 bg-gray-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">{stats.nbDevis}</span>}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'factures' ? (
          factures.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Aucune facture pour ce client</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {factures.map(f => {
                const overdue = f.date_echeance && new Date(f.date_echeance) < new Date() && f.statut !== 'payée';
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-slate-700">{f.numero}</span>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getStatutColor(f.statut)}`}>
                          {getStatutLabel(f.statut)}
                        </span>
                        {overdue && (
                          <span className="flex items-center gap-0.5 text-xs text-red-500">
                            <AlertTriangle className="w-3 h-3" /> En retard
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(f.date_facture)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-900 text-sm">{formatCurrency(f.total, sym)}</div>
                      {f.reste_a_payer > 0 && f.statut !== 'payée' && (
                        <div className="text-xs text-amber-600">Reste: {formatCurrency(f.reste_a_payer, sym)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          devis.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">Aucun devis pour ce client</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {devis.map(d => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-slate-700">{d.numero}</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${getStatutColor(d.statut)}`}>
                        {getStatutLabel(d.statut)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{formatDate(d.date_devis)}</div>
                  </div>
                  <div className="font-bold text-slate-900 text-sm flex-shrink-0">{formatCurrency(d.total, sym)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
