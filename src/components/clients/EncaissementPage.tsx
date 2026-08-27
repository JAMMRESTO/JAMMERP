import { useState, useEffect, useRef } from 'react';
import { Search, CreditCard, CheckSquare, Square, Printer, User, AlertCircle, CheckCircle, Wallet, Banknote, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Facture, Company } from '../../types';
import { formatCurrency, formatDate, getStatutColor, getStatutLabel, MODES_PAIEMENT } from '../../lib/utils';

interface Props { companyId: string; company: Company; }

interface PaiementResult {
  client: Client;
  factures: Facture[];
  encoursEncaisse: number;
  montant: number;
  mode_paiement: string;
  date_paiement: string;
  notes: string;
  reference: string;
}

export default function EncaissementPage({ companyId, company }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [encoursSelected, setEncoursSelected] = useState(false);
  const [montantEncours, setMontantEncours] = useState(0);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingFactures, setLoadingFactures] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [modePaiement, setModePaiement] = useState('Espèces');
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');

  const [result, setResult] = useState<PaiementResult | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadClients(); }, [companyId]);

  async function loadClients() {
    setLoadingClients(true);
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    setClients(data || []);
    setLoadingClients(false);
  }

  async function selectClient(client: Client) {
    if (selectedClient?.id === client.id) return;
    setSelectedClient(client);
    setSelectedIds(new Set());
    setEncoursSelected(false);
    setMontantEncours(client.balance || 0);
    setResult(null);
    setError('');
    setLoadingFactures(true);
    const { data } = await supabase
      .from('factures')
      .select('*, clients(name, phone, email, address)')
      .eq('company_id', companyId)
      .eq('client_id', client.id)
      .in('statut', ['envoyée', 'partiellement_payée'])
      .order('date_echeance', { ascending: true });
    setFactures(data || []);
    setLoadingFactures(false);
  }

  function toggleFacture(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === factures.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(factures.map(f => f.id)));
  }

  const selectedFactures = factures.filter(f => selectedIds.has(f.id));
  const totalFactures = selectedFactures.reduce((s, f) => s + f.reste_a_payer, 0);
  const totalSelected = totalFactures + (encoursSelected ? montantEncours : 0);
  const hasAnything = selectedIds.size > 0 || encoursSelected;

  async function handlePay() {
    if (!hasAnything) { setError('Sélectionnez au moins une facture ou l\'encours'); return; }
    if (encoursSelected && montantEncours <= 0) { setError('Le montant de l\'encours doit être positif'); return; }
    setSaving(true);
    setError('');

    for (const f of selectedFactures) {
      const nouveau = f.montant_paye + f.reste_a_payer;
      const { error: pErr } = await supabase.from('paiements').insert({
        company_id: companyId,
        facture_id: f.id,
        client_id: f.client_id,
        date_paiement: datePaiement,
        montant: f.reste_a_payer,
        mode_paiement: modePaiement,
        type_paiement: 'facture',
        reference,
        notes,
      });
      if (pErr) { setError(pErr.message); setSaving(false); return; }
      await supabase.from('factures').update({
        montant_paye: nouveau,
        reste_a_payer: 0,
        statut: 'payée',
      }).eq('id', f.id);
    }

    if (encoursSelected && montantEncours > 0 && selectedClient) {
      const { error: eErr } = await supabase.from('paiements').insert({
        company_id: companyId,
        facture_id: null,
        client_id: selectedClient.id,
        date_paiement: datePaiement,
        montant: montantEncours,
        mode_paiement: modePaiement,
        type_paiement: 'encours',
        reference,
        notes: notes || 'Encaissement d\'encours',
      });
      if (eErr) { setError(eErr.message); setSaving(false); return; }
      const newBalance = Math.max(0, (selectedClient.balance || 0) - montantEncours);
      await supabase.from('clients').update({ balance: newBalance }).eq('id', selectedClient.id);
      setSelectedClient(prev => prev ? { ...prev, balance: newBalance } : prev);
    }

    const res: PaiementResult = {
      client: selectedClient!,
      factures: selectedFactures,
      encoursEncaisse: encoursSelected ? montantEncours : 0,
      montant: totalSelected,
      mode_paiement: modePaiement,
      date_paiement: datePaiement,
      notes,
      reference,
    };
    setResult(res);
    setSaving(false);
    setSelectedIds(new Set());
    setEncoursSelected(false);
    setFactures(prev => prev.filter(f => !selectedIds.has(f.id)));
    await loadClients();
  }

  function handlePrint() {
    if (!printRef.current) return;
    const content = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    win.document.write(`
      <html><head><title>Reçu de paiement</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 20px; }
        .receipt { max-width: 480px; margin: 0 auto; border: 1px solid #ddd; padding: 24px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #111; padding-bottom: 14px; }
        .company-name { font-size: 18px; font-weight: 700; }
        .receipt-title { font-size: 14px; color: #555; margin-top: 4px; }
        .section { margin-bottom: 14px; }
        .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .value { font-weight: 600; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .table th { text-align: left; font-size: 11px; text-transform: uppercase; color: #666; padding: 4px 6px; border-bottom: 1px solid #ddd; }
        .table td { padding: 5px 6px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
        .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 12px; }
        .stamp { text-align: center; margin-top: 16px; }
        .stamp-box { display: inline-block; border: 2px solid #16a34a; color: #16a34a; font-weight: 700; font-size: 16px; padding: 6px 18px; border-radius: 6px; letter-spacing: 2px; transform: rotate(-5deg); }
      </style>
      </head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  function clearClient() {
    setSelectedClient(null);
    setFactures([]);
    setSelectedIds(new Set());
    setEncoursSelected(false);
    setMontantEncours(0);
    setResult(null);
    setError('');
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  const sym = company.currency_symbol;

  return (
    <div className="flex h-full min-h-0">
      <div className="flex flex-col lg:flex-row w-full h-full min-h-0 gap-0">

        {/* Left panel — client list */}
        <div className={`flex flex-col bg-white border-r border-gray-100 ${selectedClient ? 'hidden lg:flex lg:w-72 xl:w-80 flex-shrink-0' : 'flex flex-1 lg:flex-none lg:w-72 xl:w-80 flex-shrink-0'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Banknote className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">Encaissement</div>
                <div className="text-xs text-slate-400">Sélectionnez un client</div>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-gray-50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingClients ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm px-4">Aucun client trouvé</div>
            ) : filteredClients.map(c => {
              const active = selectedClient?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => selectClient(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 ${active ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-slate-500'}`}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm truncate ${active ? 'text-emerald-900' : 'text-slate-800'}`}>{c.name}</div>
                    {c.phone && <div className="text-xs text-slate-400 truncate">{c.phone}</div>}
                  </div>
                  {c.balance > 0 && (
                    <div className="text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md flex-shrink-0 whitespace-nowrap">
                      {formatCurrency(c.balance, sym)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — encaissement detail */}
        {!selectedClient ? (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-emerald-300" />
              </div>
              <div className="text-slate-500 font-medium text-sm">Sélectionnez un client</div>
              <div className="text-slate-400 text-xs mt-1">pour démarrer un encaissement</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-gray-50 overflow-y-auto">

            {/* Client header bar */}
            <div className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center gap-3 flex-shrink-0">
              <button
                onClick={clearClient}
                className="lg:hidden w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-emerald-700 text-sm">
                {selectedClient.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 text-sm">{selectedClient.name}</div>
                <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                  {selectedClient.phone && <span>{selectedClient.phone}</span>}
                  {selectedClient.balance > 0 && (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <Wallet className="w-3 h-3" />
                      Encours : {formatCurrency(selectedClient.balance, sym)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Success receipt banner */}
            {result && (
              <div className="mx-4 lg:mx-6 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-emerald-900 text-sm">Paiement enregistré</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    {result.factures.length > 0 && `${result.factures.length} facture(s) · `}
                    {result.encoursEncaisse > 0 && `Encours ${formatCurrency(result.encoursEncaisse, sym)} · `}
                    <span className="font-bold">{formatCurrency(result.montant, sym)}</span>
                    {' · '}{result.mode_paiement}
                  </div>
                </div>
                <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-900 font-semibold bg-white border border-emerald-200 px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-colors">
                  <Printer className="w-3.5 h-3.5" />
                  Imprimer
                </button>
                <div ref={printRef} className="hidden">
                  <div className="receipt">
                    <div className="header" style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: '14px', marginBottom: '20px' }}>
                      <div className="company-name" style={{ fontSize: '18px', fontWeight: 700 }}>{company.name}</div>
                      {company.address && <div style={{ fontSize: '12px', color: '#666' }}>{company.address}</div>}
                      {company.phone && <div style={{ fontSize: '12px', color: '#666' }}>{company.phone}</div>}
                      <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Reçu de Paiement</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{formatDate(result.date_paiement)}</div>
                    </div>
                    <div className="section" style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Client</div>
                      <div style={{ fontWeight: 600 }}>{result.client.name}</div>
                      {result.client.phone && <div style={{ fontSize: '12px', color: '#666' }}>{result.client.phone}</div>}
                      {result.client.address && <div style={{ fontSize: '12px', color: '#666' }}>{result.client.address}</div>}
                    </div>
                    {result.factures.length > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Factures réglées</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                              <th style={{ textAlign: 'left', fontSize: '11px', color: '#666', padding: '4px 6px' }}>N° Facture</th>
                              <th style={{ textAlign: 'left', fontSize: '11px', color: '#666', padding: '4px 6px' }}>Date</th>
                              <th style={{ textAlign: 'right', fontSize: '11px', color: '#666', padding: '4px 6px' }}>Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.factures.map(f => (
                              <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 600 }}>{f.numero}</td>
                                <td style={{ padding: '5px 6px', fontSize: '12px', color: '#666' }}>{formatDate(f.date_facture)}</td>
                                <td style={{ padding: '5px 6px', textAlign: 'right', fontSize: '12px', fontWeight: 600 }}>{formatCurrency(f.reste_a_payer, sym)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {result.encoursEncaisse > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Encours réglé</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <span style={{ fontSize: '12px' }}>Encours client</span>
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>{formatCurrency(result.encoursEncaisse, sym)}</span>
                        </div>
                      </div>
                    )}
                    <div style={{ background: '#f8f8f8', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Total encaissé</span>
                        <span style={{ color: '#16a34a', fontSize: '16px' }}>{formatCurrency(result.montant, sym)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '6px' }}>
                        <span>Mode de paiement</span>
                        <span style={{ fontWeight: 600, color: '#333' }}>{result.mode_paiement}</span>
                      </div>
                      {result.reference && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          <span>Référence</span>
                          <span style={{ fontWeight: 600, color: '#333' }}>{result.reference}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', border: '2px solid #16a34a', color: '#16a34a', fontWeight: 700, fontSize: '16px', padding: '6px 18px', borderRadius: '6px', letterSpacing: '2px', transform: 'rotate(-4deg)' }}>PAYÉ</div>
                    </div>
                    {result.notes && <div style={{ textAlign: 'center', fontSize: '12px', color: '#999', marginTop: '16px' }}>{result.notes}</div>}
                    <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '12px', fontSize: '11px', color: '#888' }}>
                      Merci pour votre règlement · {company.name}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6 flex-1">

              {/* Left column: encours + invoices */}
              <div className="flex-1 space-y-4 min-w-0">

                {/* Encours card */}
                {selectedClient.balance > 0 && (
                  <div className={`bg-white rounded-xl border transition-all ${encoursSelected ? 'border-amber-300 shadow-sm' : 'border-gray-100'}`}>
                    <div
                      onClick={() => setEncoursSelected(v => !v)}
                      className="flex items-center gap-3 p-4 cursor-pointer"
                    >
                      <div className="flex-shrink-0">
                        {encoursSelected
                          ? <CheckSquare className="w-5 h-5 text-amber-500" />
                          : <Square className="w-5 h-5 text-slate-300" />}
                      </div>
                      <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Wallet className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-800 text-sm">Encours initial</div>
                        <div className="text-xs text-slate-400">Solde reporté — {formatCurrency(selectedClient.balance, sym)}</div>
                      </div>
                      {encoursSelected ? (
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            max={selectedClient.balance}
                            value={montantEncours}
                            onChange={e => setMontantEncours(Number(e.target.value))}
                            className="w-28 border border-amber-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white text-right"
                          />
                          <button
                            type="button"
                            onClick={() => setMontantEncours(selectedClient.balance)}
                            className="text-xs text-amber-600 hover:text-amber-700 font-semibold whitespace-nowrap"
                          >
                            Tout
                          </button>
                        </div>
                      ) : (
                        <div className="font-bold text-amber-700 text-sm flex-shrink-0">
                          {formatCurrency(selectedClient.balance, sym)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoices */}
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-sm">Factures impayées</span>
                    {factures.length > 0 && (
                      <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 font-medium">
                        {selectedIds.size === factures.length
                          ? <CheckSquare className="w-4 h-4 text-emerald-600" />
                          : <Square className="w-4 h-4" />}
                        Tout
                      </button>
                    )}
                  </div>

                  {loadingFactures ? (
                    <div className="flex justify-center py-10">
                      <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : factures.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="text-sm font-medium text-slate-600">Aucune facture impayée</div>
                      <div className="text-xs text-slate-400 mt-0.5">Ce client est à jour</div>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {factures.map(f => {
                        const selected = selectedIds.has(f.id);
                        const overdue = f.date_echeance && new Date(f.date_echeance) < new Date();
                        return (
                          <div
                            key={f.id}
                            onClick={() => toggleFacture(f.id)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selected ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}
                          >
                            <div className="flex-shrink-0">
                              {selected
                                ? <CheckSquare className="w-5 h-5 text-emerald-600" />
                                : <Square className="w-5 h-5 text-slate-300" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-700">{f.numero}</span>
                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold ${getStatutColor(f.statut)}`}>
                                  {getStatutLabel(f.statut)}
                                </span>
                                {overdue && (
                                  <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                                    <AlertCircle className="w-3 h-3" /> En retard
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {formatDate(f.date_facture)}
                                {f.date_echeance && ` · Éch. ${formatDate(f.date_echeance)}`}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-sm text-slate-900">{formatCurrency(f.reste_a_payer, sym)}</div>
                              {f.montant_paye > 0 && (
                                <div className="text-xs text-slate-400">/ {formatCurrency(f.total, sym)}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column: payment form */}
              <div className="lg:w-72 xl:w-80 flex-shrink-0">
                <div className="bg-white rounded-xl border border-gray-100 sticky top-4">
                  <div className="p-4 border-b border-gray-100">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Récapitulatif</div>
                    {hasAnything ? (
                      <div className="space-y-1.5">
                        {selectedFactures.length > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{selectedFactures.length} facture{selectedFactures.length > 1 ? 's' : ''}</span>
                            <span className="font-semibold text-slate-800">{formatCurrency(totalFactures, sym)}</span>
                          </div>
                        )}
                        {encoursSelected && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500 flex items-center gap-1"><Wallet className="w-3 h-3 text-amber-500" /> Encours</span>
                            <span className="font-semibold text-amber-700">{formatCurrency(montantEncours, sym)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                          <span className="font-bold text-slate-700 text-sm">Total</span>
                          <span className="font-bold text-emerald-700 text-base">{formatCurrency(totalSelected, sym)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 text-center py-2">Aucun élément sélectionné</div>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Mode de paiement</label>
                      <select
                        value={modePaiement}
                        onChange={e => setModePaiement(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        {MODES_PAIEMENT.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
                      <input
                        type="date"
                        value={datePaiement}
                        onChange={e => setDatePaiement(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Référence</label>
                      <input
                        type="text"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="N° chèque, virement..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Notes optionnelles..."
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 border border-red-100 text-red-600 text-xs p-2.5 rounded-lg">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handlePay}
                      disabled={!hasAnything || saving}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-100 disabled:text-slate-400 text-white py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      {saving ? 'Traitement...' : 'Confirmer l\'encaissement'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
