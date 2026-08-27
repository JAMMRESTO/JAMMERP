import { useState, useEffect, useCallback } from 'react';
import { Plus, Package, CreditCard as Edit2, Trash2, AlertTriangle, Upload, Moon, Sun, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Produit, Categorie, Profile } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { hasPermission, isAdmin } from '../../lib/permissions';
import {
  exportProduits,
  downloadProduitsTemplate,
  parseProduits,
  PRODUITS_TEMPLATE_COLUMNS,
  PRODUITS_TEMPLATE_EXAMPLES,
} from '../../lib/importExport';
import Modal from '../ui/Modal';
import SearchBar from '../ui/SearchBar';
import EmptyState from '../ui/EmptyState';
import ProduitForm from './ProduitForm';
import ImportExportModal from '../ui/ImportExportModal';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props { companyId: string; currencySymbol: string; companyName?: string; profile?: Profile | null; }

export default function ProduitsPage({ companyId, currencySymbol, companyName = 'entreprise', profile }: Props) {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [filtered, setFiltered] = useState<Produit[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [showInactifs, setShowInactifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Produit | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);

  useEffect(() => { load(); }, [companyId]);
  useRealtimeRefresh(['produits', 'categories'], companyId, useCallback(() => { load(true); }, [companyId]));
  useEffect(() => {
    let list = produits.filter(p => showInactifs ? !p.is_active : p.is_active);
    if (search) list = list.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.reference.includes(search));
    if (catFilter) list = list.filter(p => p.category_id === catFilter);
    setFiltered(list);
  }, [search, catFilter, produits, showInactifs]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produits').select('*, categories(name), produit_unites(*)').eq('company_id', companyId).order('name'),
      supabase.from('categories').select('*').eq('company_id', companyId).order('name'),
    ]);
    setProduits(prods || []);
    setCategories(cats || []);
    if (!silent) setLoading(false);
  }

  async function deleteProduct(id: string) {
    const [{ count: flCount }, { count: dlCount }, { count: fflCount }, { count: msCount }, { count: pvlCount }, { count: rlCount }] = await Promise.all([
      supabase.from('facture_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('devis_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('factures_fournisseurs_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('mouvements_stock').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('pos_vente_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
      supabase.from('retour_lignes').select('id', { count: 'exact', head: true }).eq('produit_id', id),
    ]);
    const total = (flCount || 0) + (dlCount || 0) + (fflCount || 0) + (msCount || 0) + (pvlCount || 0) + (rlCount || 0);
    if (total > 0) {
      alert('Impossible de supprimer ce produit car il a des mouvements (factures, devis, achats, stock ou ventes POS).');
      return;
    }
    if (!confirm('Supprimer ce produit ?')) return;
    await supabase.from('produits').delete().eq('id', id);
    load(true);
  }

  async function toggleSommeil(p: Produit, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from('produits').update({ is_active: !p.is_active }).eq('id', p.id);
    load(true);
  }

  const actifs = produits.filter(p => p.is_active);
  const inactifs = produits.filter(p => !p.is_active);
  const alertes = actifs.filter(p => p.stock_actuel <= p.stock_minimum);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Produits</h2>
          <p className="text-sm text-slate-500">
            {actifs.length} produit(s) actif(s)
            {inactifs.length > 0 && <> · <span className="text-slate-400">{inactifs.length} en sommeil</span></>}
            {alertes.length > 0 && <> · <span className="text-orange-500 font-semibold">{alertes.length} alerte(s) stock</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInactifs(v => !v)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors ${showInactifs ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
            title={showInactifs ? 'Voir produits actifs' : 'Voir produits en sommeil'}
          >
            {showInactifs ? <Sun className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span className="hidden sm:inline">{showInactifs ? 'Actifs' : 'En sommeil'}</span>
            {!showInactifs && inactifs.length > 0 && <span className="bg-slate-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{inactifs.length}</span>}
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
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">Nouveau produit</span>
            </button>
          )}
        </div>
      </div>

      {alertes.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-orange-800 text-sm">Alertes de stock</div>
            <div className="text-orange-700 text-xs mt-1">
              {alertes.map(p => p.name).join(', ')} — stock faible ou épuisé
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="Rechercher un produit..." /></div>
        {categories.length > 0 && (
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Toutes catégories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={showInactifs ? Moon : Package}
          title={showInactifs ? 'Aucun produit en sommeil' : 'Aucun produit'}
          description={showInactifs ? 'Aucun produit n\'a été mis en sommeil' : 'Ajoutez vos produits au catalogue'}
          action={!showInactifs ? <button onClick={() => setShowForm(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Ajouter un produit</button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const imgSrc = p.image_path || p.image_url || '';
            return (
              <div key={p.id} className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow ${!p.is_active ? 'border-slate-200 opacity-75' : p.stock_actuel <= p.stock_minimum ? 'border-orange-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {imgSrc ? (
                      <img src={imgSrc} alt={p.name} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                        <Package className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                        {p.name}
                        {!p.is_active && <span className="text-xs font-normal bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">En sommeil</span>}
                      </div>
                      {p.reference && <div className="text-xs text-slate-400">Réf: {p.reference}</div>}
                      {(p.categories as any)?.name && <div className="text-xs text-blue-500">{(p.categories as any).name}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {p.is_active && (
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => toggleSommeil(p, e)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.is_active ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-emerald-50 text-emerald-500'}`}
                      title={p.is_active ? 'Mettre en sommeil' : 'Réactiver'}
                    >
                      {p.is_active ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                    </button>
                    {isAdmin(profile ?? null) && (
                      <button onClick={() => deleteProduct(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 rounded-xl p-2 space-y-1">
                    <div>
                      <div className="text-slate-400">Prix vente / unité</div>
                      <div className="font-bold text-slate-900">{formatCurrency(p.prix_vente, currencySymbol)}</div>
                    </div>
                    {p.prix_achat > 0 && (
                      <div>
                        <div className="text-slate-400">Prix achat / unité</div>
                        <div className="font-semibold text-slate-600">{formatCurrency(p.prix_achat, currencySymbol)}</div>
                      </div>
                    )}
                    {p.conditionnement_nom && (
                      <div className="border-t border-gray-200 pt-1">
                        <div className="text-slate-400">{p.conditionnement_nom}</div>
                        <div className="font-semibold text-slate-700">
                          {p.prix_conditionnement != null
                            ? formatCurrency(p.prix_conditionnement, currencySymbol)
                            : formatCurrency(p.prix_vente * (p.conditionnement_quantite || 1), currencySymbol)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`rounded-xl p-2 ${p.stock_actuel <= p.stock_minimum ? 'bg-orange-50' : 'bg-emerald-50'}`}>
                    <div className={`text-xs mb-1 font-medium ${p.stock_actuel <= p.stock_minimum ? 'text-orange-500' : 'text-emerald-500'}`}>
                      {p.stock_actuel <= 0 ? 'Épuisé' : p.stock_actuel <= p.stock_minimum ? 'Alerte' : 'En stock'}
                    </div>
                    <div className={`font-bold ${p.stock_actuel <= p.stock_minimum ? 'text-orange-700' : 'text-emerald-700'}`}>
                      {p.stock_actuel} {p.unite}
                    </div>
                    {p.conditionnement_nom && (p.conditionnement_quantite || 0) > 0 && (
                      <div className={`mt-1 border-t pt-1 ${p.stock_actuel <= p.stock_minimum ? 'border-orange-200' : 'border-emerald-200'}`}>
                        <div className={`text-xs ${p.stock_actuel <= p.stock_minimum ? 'text-orange-400' : 'text-emerald-400'}`}>
                          {p.conditionnement_nom}
                        </div>
                        <div className={`font-bold ${p.stock_actuel <= p.stock_minimum ? 'text-orange-700' : 'text-emerald-700'}`}>
                          {Math.floor(p.stock_actuel / (p.conditionnement_quantite || 1))} pack(s)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Modifier le produit' : 'Nouveau produit'} onClose={() => setShowForm(false)} size="lg">
          <ProduitForm companyId={companyId} produit={editing} categories={categories}
            onSave={() => { setShowForm(false); load(true); }} onCancel={() => setShowForm(false)}
            onCategoryCreated={() => supabase.from('categories').select('*').eq('company_id', companyId).order('name').then(({ data }) => setCategories(data || []))} />
        </Modal>
      )}

      {showImportExport && (
        <ImportExportModal
          entityType="produits"
          companyId={companyId}
          companyName={companyName}
          onClose={() => setShowImportExport(false)}
          onImportDone={() => { setShowImportExport(false); load(true); }}
          onExport={() => exportProduits(produits as unknown as Record<string, unknown>[], companyName)}
          onDownloadTemplate={() => downloadProduitsTemplate(companyName)}
          parseRows={parseProduits}
          tableName="produits"
          entityLabel="Produits"
          templateColumns={PRODUITS_TEMPLATE_COLUMNS}
          templateExamples={PRODUITS_TEMPLATE_EXAMPLES}
          columnToDataKey={{ nom: 'name' }}
        />
      )}
    </div>
  );
}
