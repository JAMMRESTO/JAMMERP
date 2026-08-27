import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, CreditCard, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Facture, Client, Company, Produit, LigneDocument } from '../../types';
import { formatCurrency, MODES_PAIEMENT } from '../../lib/utils';
import DocumentLignes, { emptyLigne } from './DocumentLignes';

function getStockQty(l: LigneDocument, produit: Produit): number {
  if (l.type_vente === 'conditionnement') {
    const qpc = produit.quantite_par_conditionnement || produit.conditionnement_quantite || 1;
    return l.quantite * qpc;
  }
  return l.quantite;
}

interface Props {
  companyId: string;
  company: Company;
  clients: Client[];
  facture?: Facture | null;
  preselectedClientId?: string | null;
  onSave: (newId?: string) => void;
  onCancel: () => void;
  onClientCreated?: (client: Client) => void;
}

const TYPE_INFO = {
  comptant: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', desc: 'Facture marquée payée — paiement enregistré automatiquement' },
  acompte:  { icon: CreditCard,   color: 'text-amber-600',  bg: 'bg-amber-50 border-amber-200',   desc: 'Montant partiel payé maintenant — reste à encaisser' },
  crédit:   { icon: Clock,        color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',     desc: 'Totalité reste à payer — aucun paiement enregistré' },
};

export default function FactureForm({ companyId, company, clients, facture, preselectedClientId, onSave, onCancel, onClientCreated }: Props) {
  const [clientId, setClientId] = useState(facture?.client_id || preselectedClientId || '');
  const [dateFacture, setDateFacture] = useState(facture?.date_facture || new Date().toISOString().split('T')[0]);
  const [dateEcheance, setDateEcheance] = useState(facture?.date_echeance || '');
  const [typePaiement, setTypePaiement] = useState<'comptant' | 'acompte' | 'crédit'>(facture?.type_paiement || 'comptant');
  const [acompteInitial, setAcompteInitial] = useState(0);
  const [modePaiement, setModePaiement] = useState('Espèces');
  const [notes, setNotes] = useState(facture?.notes || '');
  const [lignes, setLignes] = useState<LigneDocument[]>([emptyLigne()]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [freshClient, setFreshClient] = useState<Client | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '', email: '' });
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [newClientError, setNewClientError] = useState('');
  const [localClients, setLocalClients] = useState<Client[]>([]);

  const allClients = [...clients, ...localClients];

  const selectedClient = allClients.find(c => c.id === clientId) || null;
  const encours = freshClient?.balance ?? selectedClient?.balance ?? 0;
  const creditLimit = freshClient?.credit_limit ?? selectedClient?.credit_limit ?? 0;
  const encoursDangereux = creditLimit > 0 && encours >= creditLimit;
  const encoursAttention = creditLimit > 0 && encours > 0 && encours >= creditLimit * 0.8 && !encoursDangereux;
  const encoursApresFacture = (nouveauResteAPayer: number) => encours + nouveauResteAPayer;
  const venteBloquee = creditLimit > 0 && !facture && encoursDangereux;
  const depasseEncours = (nouveauResteAPayer: number) =>
    venteBloquee || (creditLimit > 0 && !facture && nouveauResteAPayer > 0 && encoursApresFacture(nouveauResteAPayer) > creditLimit);

  useEffect(() => {
    supabase.from('produits').select('*, produit_unites(*)').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProduits(data || []));
    if (facture?.id) {
      supabase.from('facture_lignes').select('*').eq('facture_id', facture.id).order('sort_order')
        .then(({ data }) => { if (data && data.length > 0) setLignes(data as LigneDocument[]); });
    }
  }, [companyId, facture]);

  useEffect(() => {
    if (!clientId) { setFreshClient(null); return; }
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
      .then(({ data }) => setFreshClient(data as Client | null));
  }, [clientId]);

  const totaux = lignes.reduce((acc, l) => ({
    ht: acc.ht + l.montant_ht, tva: acc.tva + l.montant_tva, ttc: acc.ttc + l.montant_ttc
  }), { ht: 0, tva: 0, ttc: 0 });

  const montantPaye = typePaiement === 'comptant' ? totaux.ttc
    : typePaiement === 'acompte' ? Math.min(acompteInitial, totaux.ttc)
    : 0;
  const resteAPayer = Math.max(0, totaux.ttc - montantPaye);

  async function handleCreateClient(e: React.MouseEvent | React.FormEvent) {
    e.preventDefault();
    if (!newClientForm.name.trim()) return;
    setNewClientLoading(true);
    setNewClientError('');
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...newClientForm, company_id: companyId, credit_limit: 0, balance: 0, is_active: true })
      .select()
      .maybeSingle();
    if (error) { setNewClientError(error.message); setNewClientLoading(false); return; }
    if (data) {
      const newClient = data as Client;
      setLocalClients(prev => [...prev, newClient]);
      setClientId(newClient.id);
      onClientCreated?.(newClient);
    }
    setShowNewClient(false);
    setNewClientForm({ name: '', phone: '', email: '' });
    setNewClientLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) { setError('Sélectionnez un client'); return; }
    if (lignes.some(l => !l.designation)) { setError('Complétez toutes les lignes'); return; }

    if (depasseEncours(resteAPayer)) {
      const apres = encoursApresFacture(resteAPayer);
      const disponible = Math.max(0, creditLimit - encours);
      setError(
        `Encours autorisé dépassé pour ${selectedClient?.name}. ` +
        `Encours actuel : ${formatCurrency(encours, company.currency_symbol)} — ` +
        `Limite : ${formatCurrency(creditLimit, company.currency_symbol)} — ` +
        `Disponible : ${formatCurrency(disponible, company.currency_symbol)} — ` +
        `Après cette facture : ${formatCurrency(apres, company.currency_symbol)}. ` +
        `Réglez le solde du client ou augmentez sa limite de crédit avant de créer cette facture.`
      );
      return;
    }

    if (!facture) {
      const stockErrors: string[] = [];
      for (const l of lignes) {
        if (!l.produit_id) continue;
        const p = produits.find(x => x.id === l.produit_id);
        if (!p) continue;
        const needed = getStockQty(l, p);
        if (p.stock_actuel <= 0) {
          stockErrors.push(`"${p.name}" en rupture de stock`);
        } else if (p.stock_actuel < needed) {
          stockErrors.push(`"${p.name}": ${p.stock_actuel} ${p.unite} dispo, besoin de ${needed}`);
        }
      }
      if (stockErrors.length > 0) { setError(stockErrors.join(' | ')); return; }
    }

    setLoading(true);
    setError('');

    if (facture?.id) {
      await supabase.from('factures').update({
        client_id: clientId, date_facture: dateFacture,
        date_echeance: dateEcheance || null, type_paiement: typePaiement, notes,
        sous_total: totaux.ht, tva_montant: totaux.tva, total: totaux.ttc,
        reste_a_payer: Math.max(0, totaux.ttc - facture.montant_paye),
        updated_at: new Date().toISOString()
      }).eq('id', facture.id);
      await supabase.from('facture_lignes').delete().eq('facture_id', facture.id);
      await supabase.from('facture_lignes').insert(
        lignes.map(l => ({
          facture_id: facture.id,
          produit_id: l.produit_id,
          designation: l.designation,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          tva_taux: l.tva_taux,
          montant_ht: l.montant_ht,
          montant_tva: l.montant_tva,
          montant_ttc: l.montant_ttc,
          sort_order: l.sort_order,
          type_vente: l.type_vente,
        }))
      );
      onSave();
      return;
    }

    const { data: countData } = await supabase.from('factures').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
    const numero = `FAC${new Date().getFullYear()}-${String((countData || 0) + 1).padStart(4, '0')}`;

    const statut = resteAPayer <= 0 ? 'payée' : (montantPaye > 0 ? 'partiellement_payée' : 'envoyée');

    const { data: newFacture, error: factError } = await supabase.from('factures').insert({
      company_id: companyId, client_id: clientId, numero, date_facture: dateFacture,
      date_echeance: dateEcheance || null, statut, type_paiement: typePaiement,
      notes, sous_total: totaux.ht, tva_montant: totaux.tva, total: totaux.ttc,
      montant_paye: montantPaye, reste_a_payer: resteAPayer
    }).select().single();

    if (factError || !newFacture) { setError(factError?.message || 'Erreur'); setLoading(false); return; }

    await supabase.from('facture_lignes').insert(
      lignes.map(l => ({
        facture_id: newFacture.id,
        produit_id: l.produit_id,
        designation: l.designation,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        tva_taux: l.tva_taux,
        montant_ht: l.montant_ht,
        montant_tva: l.montant_tva,
        montant_ttc: l.montant_ttc,
        sort_order: l.sort_order,
        type_vente: l.type_vente,
      }))
    );

    if (montantPaye > 0) {
      await supabase.from('paiements').insert({
        company_id: companyId, facture_id: newFacture.id, client_id: clientId,
        date_paiement: dateFacture, montant: montantPaye, mode_paiement: modePaiement,
        notes: typePaiement === 'comptant' ? 'Paiement comptant' : 'Acompte initial'
      });
    }

    for (const l of lignes) {
      if (!l.produit_id) continue;
      const p = produits.find(x => x.id === l.produit_id);
      if (!p) continue;
      const qtyStock = getStockQty(l, p);
      const stockApres = Math.max(0, p.stock_actuel - qtyStock);
      await supabase.from('produits').update({ stock_actuel: stockApres }).eq('id', l.produit_id);
      await supabase.from('mouvements_stock').insert({
        company_id: companyId, produit_id: l.produit_id, type_mouvement: 'sortie',
        quantite: qtyStock, stock_avant: p.stock_actuel, stock_apres: stockApres,
        reference_id: newFacture.id, reference_type: 'facture', source: 'vente',
        notes: `Vente ${l.type_vente === 'conditionnement' ? '(cond.) ' : ''}${numero}`
      });
      if (stockApres <= p.stock_minimum) {
        console.warn(`ALERTE STOCK: "${p.name}" (${stockApres} ${p.unite} ≤ min ${p.stock_minimum})`);
      }
    }
    onSave(newFacture.id);
  }

  const info = TYPE_INFO[typePaiement];
  const Icon = info.icon;

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">Client *</label>
            <button type="button" onClick={() => { setShowNewClient(v => !v); setNewClientError(''); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-500 font-semibold transition-colors">
              {showNewClient ? <><X className="w-3 h-3" />Annuler</> : <><Plus className="w-3 h-3" />Nouveau client</>}
            </button>
          </div>
          <select value={clientId} onChange={e => setClientId(e.target.value)} required={!showNewClient}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sélectionner un client...</option>
            {allClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {showNewClient && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-blue-700">Nouveau client (rapide)</p>
              {newClientError && <p className="text-xs text-red-600">{newClientError}</p>}
              <input type="text" placeholder="Nom *" value={newClientForm.name}
                onChange={e => setNewClientForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <input type="tel" placeholder="Téléphone" value={newClientForm.phone}
                  onChange={e => setNewClientForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                <input type="email" placeholder="Email" value={newClientForm.email}
                  onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
              </div>
              <button type="button" disabled={newClientLoading} onClick={handleCreateClient}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-500 disabled:opacity-60 transition-colors">
                {newClientLoading ? 'Création...' : 'Créer et sélectionner'}
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {selectedClient && (
        <div className={`rounded-2xl border-2 overflow-hidden ${
          encoursDangereux
            ? 'border-red-400'
            : encoursAttention
              ? 'border-amber-400'
              : 'border-slate-200'
        }`}>
          <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
            encoursDangereux ? 'bg-red-600 text-white' : encoursAttention ? 'bg-amber-500 text-white' : 'bg-slate-700 text-white'
          }`}>
            Situation financière — {selectedClient.name}
          </div>
          <div className={`grid grid-cols-2 divide-x ${
            encoursDangereux ? 'divide-red-200 bg-red-50' : encoursAttention ? 'divide-amber-200 bg-amber-50' : 'divide-slate-100 bg-slate-50'
          }`}>
            <div className="px-4 py-3">
              <div className="text-xs text-slate-500 mb-0.5">Solde dû (encours)</div>
              <div className={`text-lg font-bold ${encoursDangereux ? 'text-red-700' : encoursAttention ? 'text-amber-700' : encours > 0 ? 'text-slate-800' : 'text-emerald-600'}`}>
                {formatCurrency(encours, company.currency_symbol)}
              </div>
              {encours <= 0 && <div className="text-xs text-emerald-600 font-medium mt-0.5">Aucune dette</div>}
            </div>
            <div className="px-4 py-3">
              <div className="text-xs text-slate-500 mb-0.5">Encours autorisé</div>
              {creditLimit > 0 ? (
                <>
                  <div className={`text-lg font-bold ${encoursDangereux ? 'text-red-700' : encoursAttention ? 'text-amber-700' : 'text-slate-800'}`}>
                    {formatCurrency(creditLimit, company.currency_symbol)}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${encoursDangereux ? 'bg-red-500' : encoursAttention ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (encours / creditLimit) * 100)}%` }} />
                  </div>
                  <div className="text-xs mt-0.5 text-slate-400">{Math.round((encours / creditLimit) * 100)}% utilisé</div>
                </>
              ) : (
                <div className="text-lg font-bold text-slate-400">Illimité</div>
              )}
            </div>
          </div>
          {venteBloquee && (
            <div className="px-4 py-3 bg-red-600 text-white">
              <div className="flex items-center gap-2 text-sm font-bold mb-1">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                VENTE DÉFINITIVEMENT BLOQUÉE — Encours autorisé dépassé
              </div>
              <div className="text-xs text-red-100">
                L'encours de {selectedClient?.name} ({formatCurrency(encours, company.currency_symbol)}) a atteint ou dépassé la limite autorisée de {formatCurrency(creditLimit, company.currency_symbol)}.
                Aucune nouvelle facture à crédit ne peut être émise tant que le solde n'est pas régularisé.
              </div>
            </div>
          )}
          {!venteBloquee && depasseEncours(resteAPayer) && (
            <div className="px-4 py-3 bg-red-600 text-white">
              <div className="flex items-center gap-2 text-sm font-bold mb-1">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                FACTURATION BLOQUÉE — Cette facture dépasserait l'encours autorisé
              </div>
              <div className="text-xs text-red-100">
                Cette facture porterait l'encours à {formatCurrency(encoursApresFacture(resteAPayer), company.currency_symbol)},
                soit {formatCurrency(encoursApresFacture(resteAPayer) - creditLimit, company.currency_symbol)} au-delà de la limite autorisée.
                Réglez le solde du client ou augmentez sa limite de crédit.
              </div>
            </div>
          )}
          {!depasseEncours(resteAPayer) && (encoursDangereux || encoursAttention) && (
            <div className={`px-4 py-2 flex items-center gap-2 text-xs font-semibold ${encoursDangereux ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {encoursDangereux ? 'LIMITE DE CRÉDIT ATTEINTE — Vente déconseillée' : 'Encours proche de la limite — Procéder avec prudence'}
            </div>
          )}
          {!depasseEncours(resteAPayer) && !facture && creditLimit > 0 && resteAPayer > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
              <span>Encours après cette facture : <strong className="text-slate-700">{formatCurrency(encoursApresFacture(resteAPayer), company.currency_symbol)}</strong></span>
              <span className="text-slate-300">·</span>
              <span>Disponible restant : <strong className="text-emerald-600">{formatCurrency(Math.max(0, creditLimit - encoursApresFacture(resteAPayer)), company.currency_symbol)}</strong></span>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Mode de facturation</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {(['comptant', 'acompte', 'crédit'] as const).map(tp => {
            const ti = TYPE_INFO[tp];
            const TIcon = ti.icon;
            return (
              <button key={tp} type="button" onClick={() => setTypePaiement(tp)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  typePaiement === tp
                    ? `border-current ${ti.bg} ${ti.color}`
                    : 'border-gray-100 text-slate-400 hover:border-gray-200'
                }`}>
                <TIcon className="w-5 h-5" />
                <span className="text-xs font-semibold capitalize">{tp}</span>
              </button>
            );
          })}
        </div>
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border ${info.bg} ${info.color} font-medium`}>
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />{info.desc}
        </div>
      </div>

      {!facture && (typePaiement === 'comptant' || typePaiement === 'acompte') && (
        <div className={`rounded-2xl border p-4 space-y-3 ${info.bg}`}>
          {typePaiement === 'acompte' && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${info.color}`}>Acompte versé maintenant</label>
              <input type="number" value={acompteInitial || ''}
                onChange={e => setAcompteInitial(Number(e.target.value))}
                min="0" max={totaux.ttc} step="any" placeholder="0"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          )}
          <div>
            <label className={`block text-sm font-medium mb-1 ${info.color}`}>Mode de paiement</label>
            <select value={modePaiement} onChange={e => setModePaiement(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {MODES_PAIEMENT.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      {(typePaiement === 'crédit' || typePaiement === 'acompte') && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date d'échéance</label>
          <input type="date" value={dateEcheance} onChange={e => setDateEcheance(e.target.value)}
            className="w-full sm:w-48 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      )}

      <DocumentLignes
        lignes={lignes} produits={produits} tvaEnabled={company.tva_enabled}
        tvaRate={company.tva_rate} currencySymbol={company.currency_symbol}
        onChange={setLignes}
      />

      <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-1.5">
        {company.tva_enabled && (
          <div className="flex justify-between text-slate-500"><span>Sous-total HT</span><span>{formatCurrency(totaux.ht, company.currency_symbol)}</span></div>
        )}
        {company.tva_enabled && (
          <div className="flex justify-between text-slate-500"><span>TVA ({company.tva_rate}%)</span><span>{formatCurrency(totaux.tva, company.currency_symbol)}</span></div>
        )}
        <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-gray-200">
          <span>Total TTC</span><span>{formatCurrency(totaux.ttc, company.currency_symbol)}</span>
        </div>
        {montantPaye > 0 && (
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>{typePaiement === 'comptant' ? 'Payé' : 'Acompte'}</span>
            <span>{formatCurrency(montantPaye, company.currency_symbol)}</span>
          </div>
        )}
        {resteAPayer > 0 && (
          <div className="flex justify-between text-red-600 font-bold border-t border-gray-200 pt-1">
            <span>Reste à payer</span><span>{formatCurrency(resteAPayer, company.currency_symbol)}</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
          Annuler
        </button>
        <button type="submit" disabled={loading || depasseEncours(resteAPayer)}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            depasseEncours(resteAPayer)
              ? 'bg-red-100 text-red-400 cursor-not-allowed border-2 border-red-200'
              : 'bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60'
          }`}>
          {loading
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création...</>
            : depasseEncours(resteAPayer)
              ? <><AlertTriangle className="w-4 h-4" />Vente bloquée</>
              : facture ? 'Modifier' : `Créer${typePaiement === 'comptant' ? ' & encaisser' : ''}`}
        </button>
      </div>
    </form>
  );
}
