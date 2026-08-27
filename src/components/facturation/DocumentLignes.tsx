import { Plus, Trash2, Package } from 'lucide-react';
import { LigneDocument, Produit, ProduitUnite } from '../../types';
import { formatCurrency } from '../../lib/utils';

interface Props {
  lignes: LigneDocument[];
  produits: Produit[];
  tvaEnabled: boolean;
  tvaRate: number;
  currencySymbol: string;
  onChange: (lignes: LigneDocument[]) => void;
}

export const emptyLigne = (): LigneDocument => ({
  produit_id: null, designation: '', quantite: 1, prix_unitaire: 0,
  tva_taux: 0, montant_ht: 0, montant_tva: 0, montant_ttc: 0,
  sort_order: 0, type_vente: 'unite',
});

function recalc(l: LigneDocument): LigneDocument {
  const ht = Number(l.quantite) * Number(l.prix_unitaire);
  const tva = ht * (Number(l.tva_taux) / 100);
  return { ...l, montant_ht: ht, montant_tva: tva, montant_ttc: ht + tva };
}

function getUniteOptions(p: Produit, tvaEnabled: boolean, tvaRate: number): { value: string; label: string; prix: number; isConditionnement: boolean; unite?: ProduitUnite }[] {
  const opts: { value: string; label: string; prix: number; isConditionnement: boolean; unite?: ProduitUnite }[] = [];

  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
  opts.push({ value: 'unite|base', label: `${p.unite || 'Unité'} — ${fmt(p.prix_vente)}`, prix: p.prix_vente, isConditionnement: false });

  if (p.produit_unites && p.produit_unites.length > 0) {
    for (const u of p.produit_unites) {
      const prix = u.prix != null ? u.prix : p.prix_vente * u.quantite;
      const label = u.type === 'conditionnement'
        ? `${u.nom} (×${u.quantite} ${p.unite || 'u'}) — ${fmt(prix)}`
        : `${u.nom} — ${fmt(prix)}`;
      opts.push({ value: `${u.type}|${u.id || u.nom}`, label, prix, isConditionnement: u.type === 'conditionnement', unite: u });
    }
  } else {
    if (p.conditionnement_nom && (p.conditionnement_quantite > 1 || p.quantite_par_conditionnement > 1)) {
      const qpc = p.quantite_par_conditionnement || p.conditionnement_quantite || 1;
      const prix = p.prix_conditionnement != null ? p.prix_conditionnement : p.prix_vente * qpc;
      opts.push({ value: `conditionnement|legacy`, label: `${p.conditionnement_nom} (×${qpc}) — ${fmt(prix)}`, prix, isConditionnement: true });
    }
  }

  return opts;
}

function applyProduitWithUnite(
  l: LigneDocument,
  produit: Produit,
  uniteValue: string,
  tvaEnabled: boolean,
  tvaRate: number
): LigneDocument {
  const opts = getUniteOptions(produit, tvaEnabled, tvaRate);
  const selected = opts.find(o => o.value === uniteValue) || opts[0];

  if (!selected) return l;

  const isConditionnement = selected.isConditionnement;
  const uniteData = selected.unite;

  let designation = produit.name;
  if (isConditionnement && uniteData) {
    designation = `${produit.name} (${uniteData.nom})`;
  } else if (uniteValue === 'conditionnement|legacy' && produit.conditionnement_nom) {
    designation = `${produit.name} (${produit.conditionnement_nom})`;
  }

  return recalc({
    ...l,
    produit_id: produit.id,
    type_vente: isConditionnement ? 'conditionnement' : 'unite',
    designation,
    prix_unitaire: selected.prix,
    tva_taux: tvaEnabled ? (produit.tva_taux || tvaRate) : 0,
  });
}

export default function DocumentLignes({ lignes, produits, tvaEnabled, tvaRate, currencySymbol, onChange }: Props) {

  function updateLigne(idx: number, field: string, value: string | number | null) {
    const next = [...lignes];
    let l = { ...next[idx], [field]: value };

    if (field === 'produit_id') {
      const p = produits.find(x => x.id === value);
      if (p) {
        l = applyProduitWithUnite(l, p, 'unite|base', tvaEnabled, tvaRate);
        if (p.stock_actuel <= 0) {
          alert(`Attention: "${p.name}" est en rupture de stock !`);
        }
      } else {
        l = { ...l, produit_id: null, type_vente: 'unite' };
      }
    } else if (field === 'unite_option') {
      const p = produits.find(x => x.id === l.produit_id);
      if (p) {
        l = applyProduitWithUnite(l, p, value as string, tvaEnabled, tvaRate);
      }
    } else {
      l = recalc(l);
    }

    l.sort_order = idx;
    next[idx] = l;
    onChange(next);
  }

  function addLigne() { onChange([...lignes, emptyLigne()]); }
  function removeLigne(idx: number) { onChange(lignes.filter((_, i) => i !== idx)); }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-slate-700">Lignes de facturation</label>
        <button type="button" onClick={addLigne}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 font-semibold">
          <Plus className="w-3 h-3" /> Ajouter une ligne
        </button>
      </div>

      <div className="space-y-2">
        {lignes.map((l, i) => {
          const produit = produits.find(p => p.id === l.produit_id);
          const uniteOptions = produit ? getUniteOptions(produit, tvaEnabled, tvaRate) : [];
          const hasMultipleOptions = uniteOptions.length > 1;

          const currentUniteValue = (() => {
            if (!produit) return 'unite|base';
            if (l.type_vente === 'conditionnement') {
              if (produit.produit_unites?.length) {
                const match = produit.produit_unites.find(u => u.type === 'conditionnement' && l.designation.includes(u.nom));
                if (match) return `conditionnement|${match.id || match.nom}`;
              }
              return 'conditionnement|legacy';
            }
            return 'unite|base';
          })();

          return (
            <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-2">
              <div className="grid grid-cols-12 gap-2">
                <div className={`col-span-12 ${hasMultipleOptions ? 'sm:col-span-3' : 'sm:col-span-4'}`}>
                  <select
                    value={l.produit_id || ''}
                    onChange={e => updateLigne(i, 'produit_id', e.target.value || null)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Ligne libre</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id} disabled={p.stock_actuel <= 0}>
                        {p.name} {p.stock_actuel <= 0 ? '(épuisé)' : `(${p.stock_actuel} ${p.unite})`}
                      </option>
                    ))}
                  </select>
                </div>

                {hasMultipleOptions && (
                  <div className="col-span-12 sm:col-span-3">
                    <select
                      value={currentUniteValue}
                      onChange={e => updateLigne(i, 'unite_option', e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {uniteOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={`col-span-12 ${hasMultipleOptions ? 'sm:col-span-2' : 'sm:col-span-3'}`}>
                  <input
                    type="text" value={l.designation}
                    onChange={e => updateLigne(i, 'designation', e.target.value)}
                    placeholder="Désignation" required
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-3 sm:col-span-1">
                  <input
                    type="number" value={l.quantite || ''}
                    onChange={e => updateLigne(i, 'quantite', Number(e.target.value))}
                    min="0.001" step="0.001" placeholder="Qté"
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="col-span-5 sm:col-span-2">
                  <input
                    type="number" value={l.prix_unitaire || ''}
                    onChange={e => updateLigne(i, 'prix_unitaire', Number(e.target.value))}
                    min="0" placeholder="P.U."
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {tvaEnabled && (
                  <div className="col-span-2 sm:col-span-1">
                    <input
                      type="number" value={l.tva_taux || ''}
                      onChange={e => updateLigne(i, 'tva_taux', Number(e.target.value))}
                      min="0" max="100" placeholder="TVA%"
                      className="w-full bg-white border border-gray-200 rounded-lg px-1 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="col-span-2 sm:col-span-1 flex items-center justify-end">
                  {lignes.length > 1 && (
                    <button type="button" onClick={() => removeLigne(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  {l.type_vente === 'conditionnement' && (
                    <span className="flex items-center gap-1 text-cyan-600 font-medium">
                      <Package className="w-3 h-3" /> Conditionnement
                    </span>
                  )}
                  {produit && (
                    <span className={`font-medium ${produit.stock_actuel <= produit.stock_minimum ? 'text-amber-600' : 'text-emerald-600'}`}>
                      Stock: {produit.stock_actuel} {produit.unite}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {tvaEnabled && <span className="mr-3">HT: {formatCurrency(l.montant_ht, currencySymbol)}</span>}
                  Total: <span className="font-semibold text-slate-700 ml-1">{formatCurrency(l.montant_ttc, currencySymbol)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
