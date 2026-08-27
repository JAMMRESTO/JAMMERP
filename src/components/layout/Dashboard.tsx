import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Users, Truck, FileText, CreditCard, Package,
  BarChart3, Settings, TrendingUp, TrendingDown, AlertTriangle, Clock, ShoppingBag, ShoppingCart, DollarSign, Banknote
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Module, Company, Profile } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { PeriodFilter, getDateRange } from '../../lib/dateFilter';
import PeriodFilterBar from '../ui/PeriodFilter';
import { canAccessModule } from '../../lib/permissions';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props {
  onNavigate: (m: Module) => void;
  company: Company | null;
  companyId: string;
  profile?: Profile | null;
}

interface Stats {
  clients: number;
  fournisseurs: number;
  facturesImpayees: number;
  montantImpaye: number;
  facturesFournImpayees: number;
  montantFournImpaye: number;
  chiffreAffaires: number;
  depenses: number;
  beneficeNet: number;
  produitsAlerte: number;
  devisEnAttente: number;
}

const QUICK_BUTTONS = [
  { id: 'pos' as Module, label: 'POS', icon: ShoppingCart, color: 'from-blue-600 to-blue-700' },
  { id: 'produits' as Module, label: 'Produits', icon: ShoppingBag, color: 'from-teal-500 to-teal-600' },
  { id: 'clients' as Module, label: 'Clients', icon: Users, color: 'from-blue-500 to-blue-600' },
  { id: 'encaissement' as Module, label: 'Encaissement', icon: Banknote, color: 'from-emerald-600 to-emerald-700' },
  { id: 'fournisseurs' as Module, label: 'Fournisseurs', icon: Truck, color: 'from-green-500 to-green-600' },
  { id: 'facturation' as Module, label: 'Facturation', icon: FileText, color: 'from-orange-500 to-orange-600' },
  { id: 'depenses' as Module, label: 'Dépenses', icon: CreditCard, color: 'from-rose-500 to-rose-600' },
  { id: 'inventaire' as Module, label: 'Inventaire', icon: Package, color: 'from-cyan-500 to-cyan-600' },
  { id: 'statistiques' as Module, label: 'Stats', icon: BarChart3, color: 'from-sky-500 to-sky-600' },
  { id: 'parametres' as Module, label: 'Paramètres', icon: Settings, color: 'from-slate-500 to-slate-600' },
];

export default function Dashboard({ onNavigate, company, companyId, profile }: Props) {
  const [period, setPeriod] = useState<PeriodFilter>('jour');
  const [stats, setStats] = useState<Stats>({
    clients: 0, fournisseurs: 0,
    facturesImpayees: 0, montantImpaye: 0,
    facturesFournImpayees: 0, montantFournImpaye: 0,
    chiffreAffaires: 0, depenses: 0, beneficeNet: 0,
    produitsAlerte: 0, devisEnAttente: 0
  });
  const loadingRef = useRef(false);

  useEffect(() => { loadStats(); }, [companyId, period]);

  const silentRefresh = useCallback(() => { loadStats(); }, [companyId, period]);
  useRealtimeRefresh(['clients', 'fournisseurs', 'factures', 'factures_fournisseurs', 'depenses', 'produits', 'devis', 'pos_ventes'], companyId, silentRefresh);

  async function loadStats() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const { start, end } = getDateRange(period);

    const [clients, fournisseurs, factures, facturesFourn, depenses, produits, devis, posVentes] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      supabase.from('fournisseurs').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      supabase.from('factures').select('total, montant_paye, reste_a_payer, statut').eq('company_id', companyId).neq('statut', 'annulée').gte('date_facture', start).lte('date_facture', end),
      supabase.from('factures_fournisseurs').select('reste_a_payer, statut').eq('company_id', companyId).in('statut', ['reçue', 'partiellement_payée']),
      supabase.from('depenses').select('montant').eq('company_id', companyId).gte('date_depense', start).lte('date_depense', end),
      supabase.from('produits').select('stock_actuel, stock_minimum').eq('company_id', companyId).eq('is_active', true),
      supabase.from('devis').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('statut', ['brouillon', 'envoyé']),
      supabase.from('pos_ventes').select('total_ttc').eq('company_id', companyId).eq('statut', 'finalisée').gte('date_vente', start).lte('date_vente', end),
    ]);

    const facturesData = factures.data || [];
    const caFactures = facturesData.filter(f => f.statut === 'payée').reduce((acc, f) => acc + f.total, 0);
    const caPos = (posVentes.data || []).reduce((acc, v) => acc + v.total_ttc, 0);
    const chiffreAffaires = caFactures + caPos;
    const impayees = facturesData.filter(f => f.statut === 'envoyée' || f.statut === 'partiellement_payée');
    const montantImpaye = impayees.reduce((acc, f) => acc + (f.reste_a_payer ?? (f.total - f.montant_paye)), 0);
    const depensesTotal = (depenses.data || []).reduce((acc, d) => acc + d.montant, 0);
    const produitsAlerte = (produits.data || []).filter(p => p.stock_actuel <= p.stock_minimum).length;
    const beneficeNet = chiffreAffaires - depensesTotal;
    const facturesFournData = facturesFourn.data || [];
    const montantFournImpaye = facturesFournData.reduce((acc, f) => acc + f.reste_a_payer, 0);

    setStats({
      clients: clients.count || 0,
      fournisseurs: fournisseurs.count || 0,
      facturesImpayees: impayees.length,
      montantImpaye,
      facturesFournImpayees: facturesFournData.length,
      montantFournImpaye,
      chiffreAffaires,
      depenses: depensesTotal,
      beneficeNet,
      produitsAlerte,
      devisEnAttente: devis.count || 0,
    });
    loadingRef.current = false;
  }

  const symbol = company?.currency_symbol || 'F CFA';
  const { label: periodLabel } = getDateRange(period);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Bonjour</h2>
          <p className="text-slate-500 text-xs mt-0.5">{company?.name} — <span className="font-medium text-slate-700">{periodLabel}</span></p>
        </div>
        <PeriodFilterBar value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {canAccessModule(profile ?? null, 'facturation') && (
          <MiniCard label="Chiffre d'affaires" value={formatCurrency(stats.chiffreAffaires, symbol)} icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" />
        )}
        {canAccessModule(profile ?? null, 'depenses') && (
          <MiniCard label="Dépenses" value={formatCurrency(stats.depenses, symbol)} icon={TrendingDown} color="text-rose-600" bg="bg-rose-50" />
        )}
        {canAccessModule(profile ?? null, 'facturation') && canAccessModule(profile ?? null, 'depenses') && (
          <MiniCard
            label="Bénéfice net"
            value={formatCurrency(stats.beneficeNet, symbol)}
            icon={DollarSign}
            color={stats.beneficeNet >= 0 ? 'text-teal-600' : 'text-red-600'}
            bg={stats.beneficeNet >= 0 ? 'bg-teal-50' : 'bg-red-50'}
          />
        )}
        {canAccessModule(profile ?? null, 'facturation') && (
          <MiniCard label="Impayés clients" value={String(stats.facturesImpayees)} subValue={formatCurrency(stats.montantImpaye, symbol)} icon={Clock} color="text-amber-600" bg="bg-amber-50" onClick={() => onNavigate('facturation')} />
        )}
        {canAccessModule(profile ?? null, 'fournisseurs') && stats.facturesFournImpayees > 0 && (
          <MiniCard label="Impayés fournisseurs" value={String(stats.facturesFournImpayees)} subValue={formatCurrency(stats.montantFournImpaye, symbol)} icon={Truck} color="text-red-600" bg="bg-red-50" onClick={() => onNavigate('fournisseurs')} />
        )}
        {canAccessModule(profile ?? null, 'clients') && (
          <MiniCard label="Clients actifs" value={String(stats.clients)} icon={Users} color="text-blue-600" bg="bg-blue-50" onClick={() => onNavigate('clients')} />
        )}
        {canAccessModule(profile ?? null, 'fournisseurs') && (
          <MiniCard label="Fournisseurs" value={String(stats.fournisseurs)} icon={Truck} color="text-emerald-600" bg="bg-emerald-50" onClick={() => onNavigate('fournisseurs')} />
        )}
        {canAccessModule(profile ?? null, 'facturation') && (
          <MiniCard label="Devis en attente" value={String(stats.devisEnAttente)} icon={FileText} color="text-orange-600" bg="bg-orange-50" onClick={() => onNavigate('facturation')} />
        )}
        {canAccessModule(profile ?? null, 'inventaire') && (
          <MiniCard label="Alertes stock" value={String(stats.produitsAlerte)} icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50" onClick={() => onNavigate('inventaire')} />
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Accès rapide</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_BUTTONS.filter(b => (b.id !== 'pos' || company?.pos_enabled) && canAccessModule(profile ?? null, b.id)).map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${color} text-white font-medium text-xs shadow hover:opacity-90 hover:scale-105 transition-all duration-150 active:scale-95`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value, subValue, icon: Icon, color, bg, onClick }: {
  label: string; value: string; subValue?: string; icon: React.ComponentType<{className?: string}>;
  color: string; bg: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-3 border border-gray-100 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md' : ''} transition-shadow`}
    >
      <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="text-sm font-bold text-slate-900 leading-tight truncate">{value}</div>
      {subValue && <div className={`text-xs font-semibold mt-0.5 truncate ${color}`}>{subValue}</div>}
      <div className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</div>
    </div>
  );
}
