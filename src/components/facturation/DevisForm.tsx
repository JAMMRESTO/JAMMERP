import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Devis, Client, Company, Produit, LigneDocument } from '../../types';
import { formatCurrency } from '../../lib/utils';
import DocumentLignes, { emptyLigne } from './DocumentLignes';

interface Props {
  companyId: string;
  company: Company;
  clients: Client[];
  devis?: Devis | null;
  preselectedClientId?: string | null;
  onSave: (newId?: string) => void;
  onCancel: () => void;
  onClientCreated?: (client: Client) => void;
}

export default function DevisForm({ companyId, company, clients, devis, preselectedClientId, onSave, onCancel, onClientCreated }: Props) {
  const [clientId, setClientId] = useState(devis?.client_id || preselectedClientId || '');
  const [dateDevis, setDateDevis] = useState(devis?.date_devis || new Date().toISOString().split('T')[0]);
  const [dateValidite, setDateValidite] = useState(devis?.date_validite || '');
  const [notes, setNotes] = useState(devis?.notes || '');
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

  useEffect(() => {
    supabase.from('produits').select('*, produit_unites(*)').eq('company_id', companyId).eq('is_active', true).order('name')
      .then(({ data }) => setProduits(data || []));
    if (devis?.id) {
      supabase.from('devis_lignes').select('*').eq('devis_id', devis.id).order('sort_order')
        .then(({ data }) => { if (data && data.length > 0) setLignes(data as LigneDocument[]); });
    }
  }, [companyId, devis]);

  useEffect(() => {
    if (!clientId) { setFreshClient(null); return; }
    supabase.from('clients').select('*').eq('id', clientId).maybeSingle()
      .then(({ data }) => setFreshClient(data as Client | null));
  }, [clientId]);

  const totaux = lignes.reduce((acc, l) => ({
    ht: acc.ht + l.montant_ht, tva: acc.tva + l.montant_tva, ttc: acc.ttc + l.montant_ttc
  }), { ht: 0, tva: 0, ttc: 0 });

  async function handleCreateClient(e: React.FormEvent) {
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
    setLoading(true);
    setError('');

    if (devis?.id) {
      await supabase.from('devis').update({
        client_id: clientId, date_devis: dateDevis, date_validite: dateValidite || null,
        notes, sous_total: totaux.ht, tva_montant: totaux.tva, total: totaux.ttc,
        updated_at: new Date().toISOString()
      }).eq('id', devis.id);
      await supabase.from('devis_lignes').delete().eq('devis_id', devis.id);
      await supabase.from('devis_lignes').insert(
        lignes.map(l => ({
          devis_id: devis.id,
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
    } else {
      const { data: count } = await supabase.from('devis').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
      const numero = `DEV${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`;

      const { data: newDevis, error: devisError } = await supabase.from('devis').insert({
        company_id: companyId, client_id: clientId, numero, date_devis: dateDevis,
        date_validite: dateValidite || null, statut: 'envoyé', notes,
        sous_total: totaux.ht, tva_montant: totaux.tva, total: totaux.ttc
      }).select().single();

      if (devisError || !newDevis) { setError(devisError?.message || 'Erreur'); setLoading(false); return; }
      await supabase.from('devis_lignes').insert(
        lignes.map(l => ({
          devis_id: newDevis.id,
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
      onSave(newDevis.id);
      return;
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-xl flex gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
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
            <form onSubmit={handleCreateClient} className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-blue-700">Nouveau client (rapide)</p>
              {newClientError && <p className="text-xs text-red-600">{newClientError}</p>}
              <input type="text" placeholder="Nom *" required value={newClientForm.name}
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
              <button type="submit" disabled={newClientLoading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-semibold hover:bg-blue-500 disabled:opacity-60 transition-colors">
                {newClientLoading ? 'Création...' : 'Créer et sélectionner'}
              </button>
            </form>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date devis</label>
          <input type="date" value={dateDevis} onChange={e => setDateDevis(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {selectedClient && (encours > 0 || creditLimit > 0) && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 ${
          encoursDangereux
            ? 'bg-red-50 border-red-400 animate-pulse'
            : encoursAttention
              ? 'bg-amber-50 border-amber-400 animate-pulse'
              : 'bg-blue-50 border-blue-200'
        }`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${encoursDangereux ? 'text-red-600' : encoursAttention ? 'text-amber-600' : 'text-blue-500'}`} />
          <div className="flex-1 min-w-0">
            <div className={`text-sm font-bold ${encoursDangereux ? 'text-red-700' : encoursAttention ? 'text-amber-700' : 'text-blue-700'}`}>
              Encours client : {formatCurrency(encours, company.currency_symbol)}
              {creditLimit > 0 && (
                <span className={`ml-2 font-normal text-xs ${encoursDangereux ? 'text-red-500' : encoursAttention ? 'text-amber-500' : 'text-blue-400'}`}>
                  / Limite : {formatCurrency(creditLimit, company.currency_symbol)}
                </span>
              )}
            </div>
            {encoursDangereux && (
              <div className="text-xs font-bold text-red-600 mt-0.5">
                LIMITE DE CREDIT ATTEINTE — Vente déconseillée
              </div>
            )}
            {encoursAttention && (
              <div className="text-xs font-semibold text-amber-600 mt-0.5">
                Encours proche de la limite — Attention
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Date de validité</label>
        <input type="date" value={dateValidite} onChange={e => setDateValidite(e.target.value)}
          className="w-full sm:w-48 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <DocumentLignes
        lignes={lignes} produits={produits} tvaEnabled={company.tva_enabled}
        tvaRate={company.tva_rate} currencySymbol={company.currency_symbol}
        onChange={setLignes}
      />

      <div className="bg-slate-50 rounded-2xl p-4 text-sm space-y-1">
        {company.tva_enabled && <div className="flex justify-between text-slate-600"><span>Sous-total HT</span><span>{formatCurrency(totaux.ht, company.currency_symbol)}</span></div>}
        {company.tva_enabled && <div className="flex justify-between text-slate-600"><span>TVA</span><span>{formatCurrency(totaux.tva, company.currency_symbol)}</span></div>}
        <div className="flex justify-between font-bold text-slate-900 text-base pt-1 border-t border-gray-200">
          <span>Total</span><span>{formatCurrency(totaux.ttc, company.currency_symbol)}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
        <button type="submit" disabled={loading} className="flex-1 bg-slate-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-600 disabled:opacity-60">
          {loading ? 'Enregistrement...' : devis ? 'Modifier' : 'Créer le devis'}
        </button>
      </div>
    </form>
  );
}
