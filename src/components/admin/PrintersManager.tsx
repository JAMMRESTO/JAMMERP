import { useEffect, useState } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, Printer as PrinterIcon,
  Wifi, WifiOff, FlaskConical, Loader, Network, Usb,
  Download, Radio, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Printer, PrinterType, PrinterStation, PrinterConnectionType } from '../../lib/types';
import { createPendingPrintJob } from '../../services/printingHub';
import { connectQzTray, listQzPrinters, subscribeQzTrayStatus } from '../../lib/qzTray';
import { generateInstallerCmd, generateUninstallerCmd } from '../../lib/printRelayInstaller';

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface PrinterForm {
  nom: string;
  type: PrinterType;
  station: PrinterStation;
  connection_type: PrinterConnectionType;
  ip_address: string;
  port: number;
  usb_name: string;
  active: boolean;
  backup_printer_id: string | null;
}

const empty: PrinterForm = {
  nom: '',
  type: 'CUISINE',
  station: 'KITCHEN',
  connection_type: 'NETWORK',
  ip_address: '',
  port: 9100,
  usb_name: '',
  active: true,
  backup_printer_id: null,
};

const typeConfig: Record<PrinterType, { label: string; color: string; bg: string }> = {
  CUISINE: { label: 'Cuisine', color: 'text-orange-700', bg: 'bg-orange-100' },
  BAR: { label: 'Bar', color: 'text-blue-700', bg: 'bg-blue-100' },
  CAISSE: { label: 'Caisse', color: 'text-green-700', bg: 'bg-green-100' },
  AUTRE: { label: 'Autre', color: 'text-gray-700', bg: 'bg-gray-100' },
};

const stationLabels: Record<PrinterStation, string> = {
  KITCHEN: 'Cuisine',
  BAR: 'Bar',
  CASHIER: 'Caisse',
  OTHER: 'Autre',
};

const typeToStation: Record<PrinterType, PrinterStation> = {
  CUISINE: 'KITCHEN',
  BAR: 'BAR',
  CAISSE: 'CASHIER',
  AUTRE: 'OTHER',
};

function relayAge(ts: string | null): number | null {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
}

function RelayBadge({ lastSeen }: { lastSeen: string | null }) {
  const age = relayAge(lastSeen);
  const online = age !== null && age < 90;
  return (
    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      <Radio size={11} className={online ? 'animate-pulse' : ''} />
      {online ? `Relais actif (${age}s)` : 'Relais hors ligne'}
    </span>
  );
}

export default function PrintersManager() {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPrinter, setEditPrinter] = useState<Printer | null>(null);
  const [form, setForm] = useState<PrinterForm>(empty);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [qzConnected, setQzConnected] = useState(false);
  const [qzPrinters, setQzPrinters] = useState<string[]>([]);
  const [checkingQz, setCheckingQz] = useState(false);


  useEffect(() => {
    fetchPrinters();
    const unsubscribe = subscribeQzTrayStatus(setQzConnected);
    const interval = setInterval(fetchPrinters, 20_000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const fetchPrinters = async () => {
    const { data } = await supabase.from('printers').select('*').order('type');
    setPrinters(data || []);
    setLoading(false);
  };

  const openCreate = () => { setEditPrinter(null); setForm(empty); setShowModal(true); };

  const openEdit = (p: Printer) => {
    setEditPrinter(p);
    setForm({
      nom: p.nom,
      type: p.type,
      station: p.station || typeToStation[p.type],
      connection_type: p.connection_type || 'NETWORK',
      ip_address: p.ip_address || '',
      port: p.port || 9100,
      usb_name: p.usb_name || '',
      active: p.active,
      backup_printer_id: p.backup_printer_id || null,
    });
    setShowModal(true);
  };

  const close = () => { setShowModal(false); setEditPrinter(null); };

  const handleTypeChange = (type: PrinterType) => {
    setForm(f => ({ ...f, type, station: typeToStation[type] }));
  };

  const handleSave = async () => {
    if (!form.nom) return;
    setSaving(true);
    const isUsb = form.connection_type === 'USB';
    const payload = {
      nom: form.nom,
      type: form.type,
      station: form.station,
      connection_type: form.connection_type,
      ip_address: isUsb ? '' : form.ip_address,
      port: isUsb ? 9100 : form.port,
      usb_name: isUsb ? (form.usb_name || null) : null,
      active: form.active,
      backup_printer_id: form.backup_printer_id || null,
    };
    if (editPrinter) {
      await supabase.from('printers').update(payload).eq('id', editPrinter.id);
    } else {
      await supabase.from('printers').insert(payload);
    }
    await fetchPrinters();
    setSaving(false);
    close();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette imprimante ? Les catégories associées seront désliées.')) return;
    await supabase.from('printers').delete().eq('id', id);
    setPrinters(prev => prev.filter(p => p.id !== id));
  };

  const toggleActive = async (p: Printer) => {
    await supabase.from('printers').update({ active: !p.active }).eq('id', p.id);
    setPrinters(prev => prev.map(pr => pr.id === p.id ? { ...pr, active: !pr.active } : pr));
  };

  const checkQzTray = async () => {
    setCheckingQz(true);
    const connected = await connectQzTray();
    setQzConnected(connected);
    if (connected) setQzPrinters(await listQzPrinters());
    setCheckingQz(false);
  };

  const handleTest = async (p: Printer) => {
    setTestingId(p.id);
    const label = p.connection_type === 'USB' ? (p.usb_name || p.nom) : `${p.ip_address}:${p.port}`;
    const payload = `\x1B\x40TEST IMPRESSION\n${p.nom}\n${label}\n\x1D\x56\x42\x00`;
    await createPendingPrintJob({
      printerId: p.id,
      type: 'TEST',
      contentSummary: `Test ${p.nom}`,
      payloadText: payload,
    });
    setTimeout(() => setTestingId(null), 1500);
  };

  const networkPrinters = printers.filter(p => p.connection_type === 'NETWORK' && p.active);
  const anyRelayOnline = networkPrinters.some(p => {
    const age = relayAge(p.relay_last_seen);
    return age !== null && age < 90;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Imprimantes</h2>
          <p className="text-sm text-gray-500 mt-0.5">{printers.length} imprimante(s) configurée(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <div className={`rounded-2xl border-2 p-5 ${qzConnected ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${qzConnected ? 'bg-green-100' : 'bg-amber-100'}`}>
            <PrinterIcon size={20} className={qzConnected ? 'text-green-600' : 'text-amber-600'} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900">QZ Tray</h3>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${qzConnected ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {qzConnected ? 'Connecté' : 'Hors ligne'}
              </span>
            </div>
            <p className={`text-sm mt-1 ${qzConnected ? 'text-green-700' : 'text-amber-800'}`}>
              {qzConnected ? 'QZ Tray est disponible pour les imprimantes USB connectées à cet ordinateur.' : 'QZ Tray est optionnel : les imprimantes réseau utilisent le relais du restaurant.'}
            </p>
            {!qzConnected && <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-amber-800 underline mt-2">Télécharger QZ Tray pour USB</a>}
            {qzPrinters.length > 0 && <p className="text-xs text-green-700 mt-2">{qzPrinters.length} imprimante(s) détectée(s) : {qzPrinters.join(', ')}</p>}
          </div>
          <button onClick={checkQzTray} disabled={checkingQz} className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:border-amber-300 disabled:opacity-50">
            {checkingQz ? '...' : 'Vérifier'}
          </button>
        </div>
      </div>

      {/* Network printing is handled by the local relay, independently of QZ Tray. */}
      {networkPrinters.length > 0 && (
        <div className={`rounded-2xl border-2 p-5 ${anyRelayOnline ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${anyRelayOnline ? 'bg-green-100' : 'bg-amber-100'}`}>
              <Radio size={20} className={anyRelayOnline ? 'text-green-600' : 'text-amber-600'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900">Relais d’impression local</h3>
                {anyRelayOnline
                  ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle2 size={11} /> En ligne</span>
                  : <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full"><AlertCircle size={11} /> Hors ligne</span>
                }
              </div>
              {anyRelayOnline ? (
                <p className="text-sm text-green-700 mt-1">
                  Le relais tourne sur l’ordinateur du restaurant. Les bons de commande sont envoyés automatiquement aux imprimantes.
                </p>
              ) : (
                <p className="text-sm text-amber-800 mt-1">
                  Le relais n’est pas actif. Téléchargez l’installateur ci-dessous et lancez-le sur l’ordinateur du restaurant connecté aux imprimantes.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadTextFile('install-print-relay.cmd', generateInstallerCmd())}
                  className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
                >
                  <Download size={16} /> Télécharger l’installateur
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile('uninstall-print-relay.cmd', generateUninstallerCmd())}
                  className="flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  Désinstaller
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {networkPrinters.length > 0 && !anyRelayOnline && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
          <p className="font-bold text-sky-950 mb-2">Installation en 2 etapes</p>
          <ol className="space-y-2">
            <li className="flex gap-3"><span className="font-bold text-sky-700">1.</span><span>Cliquez sur <strong>Telecharger l’installateur</strong> ci-dessus, puis copiez le fichier sur l’ordinateur du restaurant (celui connecte aux imprimantes reseau).</span></li>
            <li className="flex gap-3"><span className="font-bold text-sky-700">2.</span><span>Double-cliquez sur <strong>install-print-relay.cmd</strong>. L’installateur installe Node.js si necessaire, configure le relais et le demarrage automatique. C’est tout.</span></li>
          </ol>
          <div className="mt-3 rounded-xl bg-white/80 border border-sky-200 p-3">
            <p className="text-sky-800">Le relais demarre en arriere-plan sans fenetre visible. Il redemarrera automatiquement a chaque allumage de l’ordinateur. Pour le retirer, telechargez et lancez <strong>uninstall-print-relay.cmd</strong>.</p>
          </div>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <p><strong>Connexion :</strong> Choisissez entre réseau TCP (IP + port) ou USB (nom système de l'imprimante).</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {printers.map(p => {
            const cfg = typeConfig[p.type];
            const backupPrinter = printers.find(b => b.id === p.backup_printer_id);
            const isUsb = p.connection_type === 'USB';
            const relaySeen = p.relay_last_seen;
            return (
              <div key={p.id} className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all ${p.active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isUsb ? 'bg-teal-50' : 'bg-gray-100'}`}>
                    {isUsb ? <Usb size={20} className="text-teal-600" /> : <Network size={20} className="text-gray-600" />}
                  </div>
                  <button onClick={() => toggleActive(p)} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${p.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {p.active ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {p.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <h3 className="font-bold text-gray-900">{p.nom}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isUsb ? 'bg-teal-50 text-teal-700' : 'bg-sky-50 text-sky-700'}`}>
                    {isUsb ? 'USB' : 'Réseau'}
                  </span>
                  {p.station && p.station !== typeToStation[p.type] && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-700">
                      {stationLabels[p.station]}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-1">
                  {isUsb ? (
                    <p className="text-xs text-gray-500 font-mono">{p.usb_name || 'Non liée'}</p>
                  ) : (
                    <p className="text-xs text-gray-500 font-mono">{p.ip_address || '—'} : {p.port}</p>
                  )}
                  {backupPrinter && (
                    <p className="text-xs text-amber-600 font-medium">Backup: {backupPrinter.nom}</p>
                  )}
                  {!isUsb && <RelayBadge lastSeen={relaySeen} />}
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => openEdit(p)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-all">
                    <Pencil size={12} /> Modifier
                  </button>
                  <button
                    onClick={() => handleTest(p)}
                    disabled={testingId === p.id}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                  >
                    {testingId === p.id ? <Loader size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                    Test
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center text-red-500 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {printers.length === 0 && (
            <div className="col-span-full p-12 text-center text-gray-400">
              <PrinterIcon size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Aucune imprimante configurée</p>
              <p className="text-sm mt-1">Ajoutez vos imprimantes réseau ou USB</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <PrinterIcon size={18} className="text-amber-500" />
                <h3 className="font-semibold text-gray-900">{editPrinter ? 'Modifier' : 'Nouvelle'} imprimante</h3>
              </div>
              <button onClick={close}><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom</label>
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                  placeholder="Ex: Cuisine principale"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Station / Rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(typeConfig) as PrinterType[]).map(type => (
                    <button
                      key={type}
                      onClick={() => handleTypeChange(type)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${form.type === type ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-gray-100 bg-gray-50 text-gray-600'}`}
                    >
                      {typeConfig[type].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Type de connexion</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setForm(f => ({ ...f, connection_type: 'NETWORK' }))}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.connection_type === 'NETWORK'
                        ? 'border-sky-400 bg-sky-50 text-sky-700'
                        : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    <Network size={16} />
                    Réseau TCP
                  </button>
                  <button
                    onClick={() => setForm(f => ({ ...f, connection_type: 'USB' }))}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                      form.connection_type === 'USB'
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    <Usb size={16} />
                    USB
                  </button>
                </div>
              </div>

              {form.connection_type === 'NETWORK' ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Adresse IP</label>
                    <input
                      value={form.ip_address}
                      onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      placeholder="192.168.1.101"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">Port</label>
                    <input
                      type="number"
                      value={form.port}
                      onChange={e => setForm(f => ({ ...f, port: +e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Nom système de l'imprimante USB</label>
                  <input
                    value={form.usb_name}
                    onChange={e => setForm(f => ({ ...f, usb_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                    placeholder="Nom exact (ex: POS-80, EPSON TM-T20)"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Imprimante backup (en cas de panne)</label>
                <select
                  value={form.backup_printer_id || ''}
                  onChange={e => setForm(f => ({ ...f, backup_printer_id: e.target.value || null }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 bg-white"
                >
                  <option value="">Aucun backup</option>
                  {printers
                    .filter(p => !editPrinter || p.id !== editPrinter.id)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nom} ({p.connection_type === 'USB' ? (p.usb_name || 'USB') : p.ip_address})
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-12 h-6 rounded-full transition-colors flex items-center ${form.active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.active ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-gray-700">{form.active ? 'Imprimante active' : 'Imprimante inactive'}</span>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={close} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-medium">Annuler</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.nom}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Check size={16} /> {saving ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
