import { useState, useEffect } from 'react';
import { TrendingUp, Package, AlertTriangle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Produit } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface Props { companyId: string; currencySymbol: string; }

type SortField = 'name' | 'stock' | 'prix_achat' | 'valeur';
type SortDir = 'asc' | 'desc';

export default function ValuationPage({ companyId, currencySymbol }: Props) {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('valeur');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    supabase
      .from('produits')
      .select('*, categories(name)')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .then(({ data }) => {
        setProduits(data || []);
        setLoading(false);
      });
  }, [companyId]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const filtered = produits.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.reference || '').toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let va: number | string = 0, vb: number | string = 0;
    if (sortField === 'name') { va = a.name; vb = b.name; }
    else if (sortField === 'stock') { va = a.stock_actuel; vb = b.stock_actuel; }
    else if (sortField === 'prix_achat') { va = a.prix_achat; vb = b.prix_achat; }
    else if (sortField === 'valeur') { va = a.stock_actuel * a.prix_achat; vb = b.stock_actuel * b.prix_achat; }

    if (typeof va === 'string' && typeof vb === 'string') {
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const totalValeur = produits.reduce((sum, p) => sum + p.stock_actuel * p.prix_achat, 0);
  const totalUnites = produits.reduce((sum, p) => sum + p.stock_actuel, 0);
  const nbEnAlerte = produits.filter(p => p.stock_actuel <= p.stock_minimum).length;
  const nbRupture = produits.filter(p => p.stock_actuel === 0).length;

  const top5 = [...produits]
    .sort((a, b) => (b.stock_actuel * b.prix_achat) - (a.stock_actuel * a.prix_achat))
    .slice(0, 5);

  const byCategory: Record<string, { name: string; valeur: number; count: number }> = {};
  produits.forEach(p => {
    const catName = (p.categories as any)?.name || 'Sans catégorie';
    if (!byCategory[catName]) byCategory[catName] = { name: catName, valeur: 0, count: 0 };
    byCategory[catName].valeur += p.stock_actuel * p.prix_achat;
    byCategory[catName].count += 1;
  });
  const categories = Object.values(byCategory).sort((a, b) => b.valeur - a.valeur);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown className="w-3.5 h-3.5 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 text-blue-500" />
      : <ChevronDown className="w-3.5 h-3.5 text-blue-500" />;
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">{formatCurrency(totalValeur, currencySymbol)}</div>
          <div className="text-xs text-slate-500 mt-0.5">Valeur totale du stock</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">{produits.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Références actives</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-600">{nbEnAlerte}</div>
          <div className="text-xs text-slate-500 mt-0.5">En alerte de stock</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-red-500" />
            </div>
          </div>
          <div className="text-xl font-bold text-red-600">{nbRupture}</div>
          <div className="text-xs text-slate-500 mt-0.5">En rupture</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top 5 par valeur</h3>
          <div className="space-y-2">
            {top5.map((p, i) => {
              const val = p.stock_actuel * p.prix_achat;
              const pct = totalValeur > 0 ? (val / totalValeur) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[60%]">
                      <span className="text-slate-400 mr-1">{i + 1}.</span>{p.name}
                    </span>
                    <span className="font-semibold text-slate-900">{formatCurrency(val, currencySymbol)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Par catégorie</h3>
          <div className="space-y-2">
            {categories.slice(0, 5).map(cat => {
              const pct = totalValeur > 0 ? (cat.valeur / totalValeur) * 100 : 0;
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 truncate max-w-[55%]">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{cat.count} réf.</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(cat.valeur, currencySymbol)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700">Detail par produit</h3>
            <div className="flex items-center gap-1 sm:hidden">
              {(['name', 'stock', 'valeur'] as SortField[]).map(f => {
                const labels: Record<string, string> = { name: 'Nom', stock: 'Stock', valeur: 'Valeur' };
                return (
                  <button key={f} onClick={() => toggleSort(f)}
                    className={`flex items-center gap-0.5 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      sortField === f ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-slate-500'
                    }`}>
                    {labels[f]}<SortIcon field={f} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">Aucun produit trouvé</div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3">
                      <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700">
                        Produit <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('stock')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 ml-auto">
                        Stock <SortIcon field="stock" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('prix_achat')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 ml-auto">
                        Prix achat <SortIcon field="prix_achat" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3">
                      <button onClick={() => toggleSort('valeur')} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-slate-700 ml-auto">
                        Valeur <SortIcon field="valeur" />
                      </button>
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">%</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(p => {
                    const valeur = p.stock_actuel * p.prix_achat;
                    const pct = totalValeur > 0 ? (valeur / totalValeur) * 100 : 0;
                    const enAlerte = p.stock_actuel <= p.stock_minimum;
                    const enRupture = p.stock_actuel === 0;
                    return (
                      <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {(enRupture || enAlerte) && (
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${enRupture ? 'bg-red-500' : 'bg-amber-400'}`} />
                            )}
                            <div>
                              <div className="font-medium text-slate-900">{p.name}</div>
                              {p.reference && <div className="text-xs text-slate-400">{p.reference}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${enRupture ? 'text-red-600' : enAlerte ? 'text-amber-600' : 'text-slate-700'}`}>
                            {p.stock_actuel}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">{p.unite}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(p.prix_achat, currencySymbol)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(valeur, currencySymbol)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {sorted.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-700 text-sm">Total ({sorted.length} produits)</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">{totalUnites.toLocaleString()}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 text-sm">{formatCurrency(totalValeur, currencySymbol)}</td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="sm:hidden divide-y divide-gray-50">
              {sorted.map(p => {
                const valeur = p.stock_actuel * p.prix_achat;
                const pct = totalValeur > 0 ? (valeur / totalValeur) * 100 : 0;
                const enAlerte = p.stock_actuel <= p.stock_minimum;
                const enRupture = p.stock_actuel === 0;
                return (
                  <div key={p.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {(enRupture || enAlerte) && (
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${enRupture ? 'bg-red-500' : 'bg-amber-400'}`} />
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 text-sm truncate">{p.name}</div>
                          {p.reference && <div className="text-xs text-slate-400">{p.reference}</div>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-slate-900 text-sm">{formatCurrency(valeur, currencySymbol)}</div>
                        <div className="text-xs text-slate-400">{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                      <span>
                        Stock :
                        <span className={`font-semibold ml-1 ${enRupture ? 'text-red-600' : enAlerte ? 'text-amber-600' : 'text-slate-700'}`}>
                          {p.stock_actuel} {p.unite}
                        </span>
                      </span>
                      <span>P.A. : <span className="font-semibold text-slate-700">{formatCurrency(p.prix_achat, currencySymbol)}</span></span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Total ({sorted.length} produits)</span>
                <span className="text-sm font-bold text-emerald-700">{formatCurrency(totalValeur, currencySymbol)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
