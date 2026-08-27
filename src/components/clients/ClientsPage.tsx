import { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Phone, Mail, CreditCard as Edit2, Trash2, UserCheck, Banknote, ChevronRight, Upload, Moon, Sun, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Client, Company, Profile } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { hasPermission, isAdmin } from '../../lib/permissions';
import { exportClients, downloadClientsTemplate, parseClients, CLIENTS_TEMPLATE_COLUMNS, CLIENTS_TEMPLATE_EXAMPLES } from '../../lib/importExport';
import Modal from '../ui/Modal';
import SearchBar from '../ui/SearchBar';
import EmptyState from '../ui/EmptyState';
import ClientForm from './ClientForm';
import ClientDetail from './ClientDetail';
import EncaissementPage from './EncaissementPage';
import ImportExportModal from '../ui/ImportExportModal';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';

interface Props {
  companyId: string;
  currencySymbol: string;
  company: Company;
  onCreateFacture?: (clientId: string) => void;
  onCreateDevis?: (clientId: string) => void;
  onCreateRetour?: (clientId: string) => void;
  companyName?: string;
  profile?: Profile | null;
  defaultTab?: 'clients' | 'encaissement';
}

type Tab = 'clients' | 'encaissement';

export default function ClientsPage({ companyId, currencySymbol, company, onCreateFacture, onCreateDevis, onCreateRetour, companyName, profile, defaultTab }: Props) {
  const [tab, setTab] = useState<Tab>(defaultTab || 'clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [showInactifs, setShowInactifs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const cn = companyName || company?.name || 'entreprise';

  useEffect(() => { load(); }, [companyId]);
  useRealtimeRefresh(['clients'], companyId, useCallback(() => { load(true); }, [companyId]));
  useEffect(() => {
    setFiltered(clients.filter(c =>
      (showInactifs ? !c.is_active : c.is_active) &&
      (c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) || c.email.toLowerCase().includes(search.toLowerCase()))
    ));
  }, [search, clients, showInactifs]);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const { data } = await supabase.from('clients').select('*').eq('company_id', companyId).order('name');
    setClients(data || []);
    if (!silent) setLoading(false);
  }

  async function deleteClient(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const [{ count: fCount }, { count: dCount }, { count: pCount }, { count: rCount }, { count: posCount }] = await Promise.all([
      supabase.from('factures').select('id', { count: 'exact', head: true }).eq('client_id', id),
      supabase.from('devis').select('id', { count: 'exact', head: true }).eq('client_id', id),
      supabase.from('paiements').select('id', { count: 'exact', head: true }).eq('client_id', id),
      supabase.from('retours').select('id', { count: 'exact', head: true }).eq('client_id', id),
      supabase.from('pos_ventes').select('id', { count: 'exact', head: true }).eq('client_id', id),
    ]);
    const total = (fCount || 0) + (dCount || 0) + (pCount || 0) + (rCount || 0) + (posCount || 0);
    if (total > 0) {
      alert('Impossible de supprimer ce client car il a des mouvements (factures, devis, paiements, retours ou ventes POS).');
      return;
    }
    if (!confirm('Supprimer ce client ?')) return;
    await supabase.from('clients').delete().eq('id', id);
    load(true);
  }

  async function toggleSommeil(c: Client, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from('clients').update({ is_active: !c.is_active }).eq('id', c.id);
    load(true);
  }

  function openEdit(c: Client, e?: React.MouseEvent) {
    e?.stopPropagation();
    setEditing(c);
    setShowForm(true);
  }

  function openNew() { setEditing(null); setShowForm(true); }

  if (selectedClient) {
    return (
      <>
        <ClientDetail
          client={selectedClient}
          company={company}
          companyId={companyId}
          onBack={() => setSelectedClient(null)}
          onEdit={(c) => openEdit(c)}
          onCreateFacture={(clientId) => onCreateFacture?.(clientId)}
          onCreateDevis={(clientId) => onCreateDevis?.(clientId)}
          onCreateRetour={(clientId) => onCreateRetour?.(clientId)}
        />
        {showForm && (
          <Modal title={editing ? 'Modifier le client' : 'Nouveau client'} onClose={() => setShowForm(false)}>
            <ClientForm
              companyId={companyId}
              client={editing}
              onSave={async () => {
                setShowForm(false);
                await load(true);
                if (editing) {
                  const updated = clients.find(c => c.id === editing.id);
                  if (updated) setSelectedClient(updated);
                }
              }}
              onCancel={() => setShowForm(false)}
            />
          </Modal>
        )}
      </>
    );
  }

  return (
    <div className={tab === 'encaissement' ? 'flex flex-col h-full min-h-0' : 'p-4 lg:p-6'}>
      <div className={`flex items-center justify-between ${tab === 'encaissement' ? 'px-4 lg:px-6 pt-4 lg:pt-6 pb-0' : 'mb-6'}`}>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Clients</h2>
          <p className="text-sm text-slate-500">
            {clients.filter(c => c.is_active).length} client(s) actif(s)
            {clients.filter(c => !c.is_active).length > 0 && <> · <span className="text-slate-400">{clients.filter(c => !c.is_active).length} en sommeil</span></>}
          </p>
        </div>
        {tab === 'clients' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInactifs(v => !v)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors ${showInactifs ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
              title={showInactifs ? 'Voir clients actifs' : 'Voir clients en sommeil'}
            >
              {showInactifs ? <Sun className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{showInactifs ? 'Actifs' : 'En sommeil'}</span>
              {!showInactifs && clients.filter(c => !c.is_active).length > 0 && (
                <span className="bg-slate-400 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{clients.filter(c => !c.is_active).length}</span>
              )}
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
              <button
                onClick={openNew}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Nouveau client</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`flex gap-0 border-b border-gray-200 ${tab === 'encaissement' ? 'px-4 lg:px-6 mt-3' : 'mb-5'}`}>
        <button
          onClick={() => setTab('clients')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === 'clients' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clients</span>
        </button>
        <button
          onClick={() => setTab('encaissement')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            tab === 'encaissement' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Encaissement</span>
        </button>
      </div>

      {tab === 'encaissement' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <EncaissementPage companyId={companyId} company={company} />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <SearchBar value={search} onChange={setSearch} placeholder="Rechercher un client..." />
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={showInactifs ? Moon : Users}
              title={showInactifs ? 'Aucun client en sommeil' : 'Aucun client'}
              description={showInactifs ? "Aucun client n'a été mis en sommeil" : 'Commencez par ajouter votre premier client'}
              action={!showInactifs ? <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">Ajouter un client</button> : undefined}
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map(client => (
                <div
                  key={client.id}
                  onClick={() => client.is_active && setSelectedClient(client)}
                  className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-all group ${client.is_active ? 'hover:border-blue-100 cursor-pointer' : 'opacity-75 cursor-default'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${client.is_active ? 'bg-blue-50' : 'bg-slate-100'}`}>
                        <UserCheck className={`w-5 h-5 ${client.is_active ? 'text-blue-600' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5">
                          {client.name}
                          {!client.is_active && <span className="text-xs font-normal bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">En sommeil</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          {client.phone && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="w-3 h-3" />{client.phone}
                            </span>
                          )}
                          {client.email && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Mail className="w-3 h-3" />{client.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block">
                        {client.balance !== 0 && (
                          <div className={`text-sm font-semibold ${client.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(Math.abs(client.balance), currencySymbol)}
                          </div>
                        )}
                      </div>
                      {client.is_active && (
                        <button
                          onClick={(e) => openEdit(client, e)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => toggleSommeil(client, e)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${client.is_active ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-emerald-50 text-emerald-500'}`}
                        title={client.is_active ? 'Mettre en sommeil' : 'Réactiver'}
                      >
                        {client.is_active ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      </button>
                      {isAdmin(profile ?? null) && (
                        <button
                          onClick={(e) => deleteClient(client.id, e)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {client.is_active && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />}
                    </div>
                  </div>
                  {client.address && <p className="text-xs text-slate-400 mt-2 ml-13">{client.address}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showForm && !selectedClient && (
        <Modal title={editing ? 'Modifier le client' : 'Nouveau client'} onClose={() => setShowForm(false)}>
          <ClientForm
            companyId={companyId}
            client={editing}
            onSave={() => { setShowForm(false); load(true); }}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      )}

      {showImportExport && (
        <ImportExportModal
          entityType="clients"
          companyId={companyId}
          companyName={cn}
          onClose={() => setShowImportExport(false)}
          onImportDone={() => { setShowImportExport(false); load(true); }}
          onExport={() => exportClients(clients as unknown as Record<string, unknown>[], cn)}
          onDownloadTemplate={() => downloadClientsTemplate(cn)}
          parseRows={parseClients}
          tableName="clients"
          entityLabel="Clients"
          templateColumns={CLIENTS_TEMPLATE_COLUMNS}
          templateExamples={CLIENTS_TEMPLATE_EXAMPLES}
          columnToDataKey={{ nom: 'name', telephone: 'phone', adresse: 'address', numero_fiscal: 'tax_number', limite_credit: 'credit_limit', encours: 'balance' }}
          duplicateKeys={['name', 'phone']}
        />
      )}
    </div>
  );
}
