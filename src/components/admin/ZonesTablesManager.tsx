import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Check, Map, TableProperties } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Zone, Table } from '../../lib/types';

export default function ZonesTablesManager() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeZone, setActiveZone] = useState<string | null>(null);

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editZone, setEditZone] = useState<Zone | null>(null);
  const [zoneForm, setZoneForm] = useState({ nom: '', ordre: 0 });

  const [showTableModal, setShowTableModal] = useState(false);
  const [editTable, setEditTable] = useState<Table | null>(null);
  const [tableForm, setTableForm] = useState({ nom: '', zone_id: '' });

  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [zonesRes, tablesRes] = await Promise.all([
      supabase.from('zones').select('*').order('ordre'),
      supabase.from('tables').select('*').order('nom'),
    ]);
    const z = zonesRes.data || [];
    setZones(z);
    setTables(tablesRes.data || []);
    if (z.length > 0 && !activeZone) setActiveZone(z[0].id);
    setLoading(false);
  };

  const openCreateZone = () => { setEditZone(null); setZoneForm({ nom: '', ordre: zones.length }); setShowZoneModal(true); };
  const openEditZone = (z: Zone) => { setEditZone(z); setZoneForm({ nom: z.nom, ordre: z.ordre }); setShowZoneModal(true); };
  const closeZoneModal = () => { setShowZoneModal(false); setEditZone(null); };

  const handleSaveZone = async () => {
    if (!zoneForm.nom) return;
    setSaving(true);
    if (editZone) {
      await supabase.from('zones').update(zoneForm).eq('id', editZone.id);
    } else {
      await supabase.from('zones').insert(zoneForm);
    }
    await fetchAll();
    setSaving(false);
    closeZoneModal();
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Supprimer cette zone et toutes ses tables ?')) return;
    await supabase.from('zones').delete().eq('id', id);
    if (activeZone === id) setActiveZone(null);
    await fetchAll();
  };

  const openCreateTable = () => {
    setEditTable(null);
    setTableForm({ nom: '', zone_id: activeZone || '' });
    setShowTableModal(true);
  };
  const openEditTable = (t: Table) => { setEditTable(t); setTableForm({ nom: t.nom, zone_id: t.zone_id }); setShowTableModal(true); };
  const closeTableModal = () => { setShowTableModal(false); setEditTable(null); };

  const handleSaveTable = async () => {
    if (!tableForm.nom || !tableForm.zone_id) return;
    setSaving(true);
    if (editTable) {
      await supabase.from('tables').update(tableForm).eq('id', editTable.id);
    } else {
      await supabase.from('tables').insert({ ...tableForm, statut: 'LIBRE' });
    }
    await fetchAll();
    setSaving(false);
    closeTableModal();
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm('Supprimer cette table ?')) return;
    await supabase.from('tables').delete().eq('id', id);
    setTables(prev => prev.filter(t => t.id !== id));
  };

  const zoneTables = tables.filter(t => t.zone_id === activeZone);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Zones & Tables</h2>
          <p className="text-sm text-gray-500 mt-0.5">{zones.length} zone(s), {tables.length} table(s)</p>
        </div>
        <button onClick={openCreateZone} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <Plus size={16} /> Zone
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Map size={16} className="text-amber-500" />
              <span className="font-semibold text-gray-900 text-sm">Zones</span>
            </div>
            {zones.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">Aucune zone</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {zones.map(z => (
                  <div key={z.id} onClick={() => setActiveZone(z.id)} className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-all ${activeZone === z.id ? 'bg-amber-50' : 'hover:bg-gray-50'}`}>
                    <span className={`text-sm font-medium ${activeZone === z.id ? 'text-amber-700' : 'text-gray-700'}`}>{z.nom}</span>
                    <div className="flex gap-1.5">
                      <button onClick={e => { e.stopPropagation(); openEditZone(z); }} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all">
                        <Pencil size={12} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteZone(z.id); }} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TableProperties size={16} className="text-amber-500" />
                <span className="font-semibold text-gray-900 text-sm">
                  Tables {activeZone ? `— ${zones.find(z => z.id === activeZone)?.nom}` : ''}
                </span>
              </div>
              {activeZone && (
                <button onClick={openCreateTable} className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 text-xs font-semibold">
                  <Plus size={14} /> Ajouter
                </button>
              )}
            </div>
            {!activeZone ? (
              <p className="p-8 text-center text-gray-400 text-sm">Sélectionnez une zone</p>
            ) : zoneTables.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">Aucune table dans cette zone</p>
            ) : (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {zoneTables.map(t => (
                  <div key={t.id} className="border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800">{t.nom}</span>
                    <div className="flex gap-1">
                      <button onClick={() => openEditTable(t)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-all">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDeleteTable(t.id)} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showZoneModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editZone ? 'Modifier' : 'Nouvelle'} zone</h3>
              <button onClick={closeZoneModal}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom de la zone</label>
                <input value={zoneForm.nom} onChange={e => setZoneForm(f => ({ ...f, nom: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" placeholder="Ex: Salle VIP" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Ordre d'affichage</label>
                <input type="number" value={zoneForm.ordre} onChange={e => setZoneForm(f => ({ ...f, ordre: +e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeZoneModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
              <button onClick={handleSaveZone} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTableModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{editTable ? 'Modifier' : 'Nouvelle'} table</h3>
              <button onClick={closeTableModal}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom de la table</label>
                <input value={tableForm.nom} onChange={e => setTableForm(f => ({ ...f, nom: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20" placeholder="Ex: Table 10" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Zone</label>
                <select value={tableForm.zone_id} onChange={e => setTableForm(f => ({ ...f, zone_id: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20">
                  {zones.map(z => <option key={z.id} value={z.id}>{z.nom}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={closeTableModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
              <button onClick={handleSaveTable} disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Check size={16} /> {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
