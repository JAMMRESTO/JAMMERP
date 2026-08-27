import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, FileText, Users, Package, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Company } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { PeriodFilter, getDateRange } from '../../lib/dateFilter';
import PeriodFilterBar from '../ui/PeriodFilter';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props { companyId: string; company: Company; }

interface MonthData { month: string; ca: number; depenses: number; factures: number; }

export default function StatistiquesPage({ companyId, company }: Props) {
  const [period, setPeriod] = useState<PeriodFilter>('jour');
  const [stats, setStats] = useState({
    ca: 0, depenses: 0,
    facturesTotal: 0, facturesPayees: 0, facturesImpayees: 0,
    facturesFournImpayees: 0, montantFournImpaye: 0, montantClientImpaye: 0,
    totalClients: 0, totalProduits: 0, stockAlerte: 0,
    benefice: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);

  useEffect(() => { load(); }, [companyId, period]);
  useRealtimeRefresh(['factures', 'factures_fournisseurs', 'depenses', 'clients', 'produits', 'pos_ventes', 'paiements'], companyId, useCallback(() => { load(true); }, [companyId, period]));

  async function load(silent = false) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    const { start, end } = getDateRange(period);
    const now = new Date();

    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const chartStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const [factures, facturesFourn, depenses, clients, produits, posVentes, paiementsFacture, encoursPaiements,
           chartFactures, chartDepenses, chartPosVentes, chartPaiementsFacture, chartEncours] = await Promise.all([
      supabase.from('factures').select('total, montant_paye, reste_a_payer, statut, date_facture').eq('company_id', companyId).neq('statut', 'annulée').gte('date_facture', start).lte('date_facture', end),
      supabase.from('factures_fournisseurs').select('reste_a_payer, statut').eq('company_id', companyId).in('statut', ['reçue', 'partiellement_payée']),
      supabase.from('depenses').select('montant, date_depense').eq('company_id', companyId).gte('date_depense', start).lte('date_depense', end),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      supabase.from('produits').select('stock_actuel, stock_minimum').eq('company_id', companyId).eq('is_active', true),
      supabase.from('pos_ventes').select('total_ttc, date_vente').eq('company_id', companyId).eq('statut', 'finalisée').gte('date_vente', start).lte('date_vente', end),
      supabase.from('paiements').select('montant, date_paiement').eq('company_id', companyId).eq('type_paiement', 'facture').gte('date_paiement', start).lte('date_paiement', end),
      supabase.from('paiements').select('montant, date_paiement').eq('company_id', companyId).eq('type_paiement', 'encours').gte('date_paiement', start).lte('date_paiement', end),
      supabase.from('factures').select('statut, date_facture').eq('company_id', companyId).neq('statut', 'annulée').gte('date_facture', chartStart),
      supabase.from('depenses').select('montant, date_depense').eq('company_id', companyId).gte('date_depense', chartStart),
      supabase.from('pos_ventes').select('total_ttc, date_vente').eq('company_id', companyId).eq('statut', 'finalisée').gte('date_vente', chartStart),
      supabase.from('paiements').select('montant, date_paiement').eq('company_id', companyId).eq('type_paiement', 'facture').gte('date_paiement', chartStart),
      supabase.from('paiements').select('montant, date_paiement').eq('company_id', companyId).eq('type_paiement', 'encours').gte('date_paiement', chartStart),
    ]);

    const facturesData = factures.data || [];
    const depensesData = depenses.data || [];
    const produitsData = produits.data || [];
    const posData = posVentes.data || [];
    const facturesFournData = facturesFourn.data || [];
    const paiementsFactureData = paiementsFacture.data || [];
    const encoursData = encoursPaiements.data || [];

    const caFactures = paiementsFactureData.reduce((a, p) => a + p.montant, 0);
    const caPos = posData.reduce((a, v) => a + v.total_ttc, 0);
    const caEncours = encoursData.reduce((a, p) => a + p.montant, 0);
    const ca = caFactures + caPos + caEncours;
    const dep = depensesData.reduce((a, d) => a + d.montant, 0);
    const facturesPayees = facturesData.filter(f => f.statut === 'payée').length;
    const facturesImpayees = facturesData.filter(f => ['envoyée', 'partiellement_payée'].includes(f.statut)).length;
    const montantClientImpaye = facturesData.filter(f => ['envoyée', 'partiellement_payée'].includes(f.statut)).reduce((a, f) => a + (f.reste_a_payer ?? (f.total - f.montant_paye)), 0);
    const stockAlerte = produitsData.filter(p => p.stock_actuel <= p.stock_minimum).length;
    const facturesFournImpayees = facturesFournData.length;
    const montantFournImpaye = facturesFournData.reduce((a, f) => a + f.reste_a_payer, 0);

    setStats({
      ca, depenses: dep,
      facturesTotal: facturesData.length,
      facturesPayees,
      facturesImpayees,
      facturesFournImpayees,
      montantFournImpaye,
      montantClientImpaye,
      totalClients: clients.count || 0,
      totalProduits: produitsData.length,
      stockAlerte,
      benefice: ca - dep,
    });

    const allF = chartFactures.data || [];
    const allD = chartDepenses.data || [];
    const allP = chartPosVentes.data || [];
    const allPF = chartPaiementsFacture.data || [];
    const allE = chartEncours.data || [];

    const months: MonthData[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const y = d.getFullYear();
      const firstDay = `${y}-${m}-01`;
      const lastDay = new Date(y, d.getMonth() + 1, 0).toISOString().split('T')[0];
      const monthLabel = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      const mCaFactures = allPF.filter(p => p.date_paiement >= firstDay && p.date_paiement <= lastDay).reduce((a, p) => a + p.montant, 0);
      const mCaPos = allP.filter(v => v.date_vente >= firstDay && v.date_vente <= lastDay).reduce((a, v) => a + v.total_ttc, 0);
      const mCaEncours = allE.filter(p => p.date_paiement >= firstDay && p.date_paiement <= lastDay).reduce((a, p) => a + p.montant, 0);
      const mCa = mCaFactures + mCaPos + mCaEncours;
      const mDep = allD.filter(x => x.date_depense >= firstDay && x.date_depense <= lastDay).reduce((a, x) => a + x.montant, 0);
      months.push({ month: monthLabel, ca: mCa, depenses: mDep, factures: allF.filter(f => f.date_facture >= firstDay && f.date_facture <= lastDay).length });
    }
    setMonthlyData(months);
    if (!silent) setLoading(false);
    loadingRef.current = false;
  }

  const sym = company.currency_symbol;
  const maxVal = Math.max(...monthlyData.map(m => Math.max(m.ca, m.depenses)), 1);
  const { label: periodLabel } = getDateRange(period);

  const hasData = stats.facturesTotal > 0 || stats.ca > 0 || stats.totalClients > 0 || monthlyData.length > 0;

  if (loading && !hasData) return (
    <div className="p-6 flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className={`p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full transition-opacity duration-150 ${loading ? 'opacity-60' : 'opacity-100'}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Statistiques</h2>
          <p className="text-sm text-slate-500 mt-0.5 font-medium">{periodLabel}</p>
        </div>
        <PeriodFilterBar value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={formatCurrency(stats.ca, sym)} color="emerald" />
        <StatCard icon={TrendingDown} label="Dépenses" value={formatCurrency(stats.depenses, sym)} color="rose" />
        <StatCard icon={FileText} label="Factures total" value={String(stats.facturesTotal)} color="slate" />
        <StatCard icon={FileText} label="Factures payées" value={String(stats.facturesPayees)} color="emerald" />
        <StatCard icon={FileText} label="Impayés clients" value={String(stats.facturesImpayees)} subValue={formatCurrency(stats.montantClientImpaye, sym)} color="amber" />
        <StatCard icon={Truck} label="Impayés fournisseurs" value={String(stats.facturesFournImpayees)} subValue={formatCurrency(stats.montantFournImpaye, sym)} color="red" />
        <StatCard icon={Users} label="Clients actifs" value={String(stats.totalClients)} color="blue" />
        <StatCard icon={Package} label="Produits" value={String(stats.totalProduits)} color="cyan" />
        <StatCard icon={Package} label="Alertes stock" value={String(stats.stockAlerte)} color="red" />
        <div className={`bg-white rounded-2xl p-4 border col-span-2 ${stats.benefice >= 0 ? 'border-emerald-100' : 'border-red-100'}`}>
          <div className={`text-xs font-medium mb-1 ${stats.benefice >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>Bénéfice net ({periodLabel})</div>
          <div className={`text-xl font-bold ${stats.benefice >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatCurrency(stats.benefice, sym)}
          </div>
        </div>
      </div>

      {(stats.facturesImpayees > 0 || stats.facturesFournImpayees > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.facturesImpayees > 0 && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Créances clients</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-700">{formatCurrency(stats.montantClientImpaye, sym)}</div>
              <div className="text-xs text-amber-600 mt-1">{stats.facturesImpayees} facture{stats.facturesImpayees > 1 ? 's' : ''} impayée{stats.facturesImpayees > 1 ? 's' : ''}</div>
            </div>
          )}
          {stats.facturesFournImpayees > 0 && (
            <div className="bg-red-50 rounded-2xl border border-red-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-700 uppercase tracking-wide">Dettes fournisseurs</span>
              </div>
              <div className="text-2xl font-extrabold text-red-700">{formatCurrency(stats.montantFournImpaye, sym)}</div>
              <div className="text-xs text-red-600 mt-1">{stats.facturesFournImpayees} facture{stats.facturesFournImpayees > 1 ? 's' : ''} à régler</div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Évolution sur 6 mois</h3>
        <div className="flex items-end gap-3 h-40">
          {monthlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                <div className="flex-1 bg-blue-200 rounded-t-sm transition-all" style={{ height: `${(m.ca / maxVal) * 100}%` }} title={`CA: ${formatCurrency(m.ca, sym)}`} />
                <div className="flex-1 bg-rose-200 rounded-t-sm transition-all" style={{ height: `${(m.depenses / maxVal) * 100}%` }} title={`Dép: ${formatCurrency(m.depenses, sym)}`} />
              </div>
              <div className="text-xs text-slate-400 text-center">{m.month}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-200 rounded-sm" />CA</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-rose-200 rounded-sm" />Dépenses</div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, subValue, color }: { icon: React.ComponentType<{className?: string}>; label: string; value: string; subValue?: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    orange: 'bg-orange-50 text-orange-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${colors[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-base font-bold text-slate-900">{value}</div>
      {subValue && <div className={`text-xs font-semibold mt-0.5 ${colors[color].split(' ')[1]}`}>{subValue}</div>}
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
