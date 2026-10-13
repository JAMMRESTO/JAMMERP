import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, X, Check, Printer as PrinterIcon,
  Usb, FlaskConical, Loader, Network, AlertCircle, CheckCircle2,
  Usb as UsbIcon,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Printer, PrinterType, PrinterStation, PrinterConnectionType } from '../../lib/types';
import {
  connectPrinter, removeAssociation,
  getAssociation, isDeviceAvailable, getDeviceName, sendTestTicket,
  isWebUsbSupported, getAssociations, UsbAssociation, PaperWidth,
} from '../../lib/usbPrintService';
import { startUsbPrintPolling, stopUsbPrintPolling } from '../../lib/usbPrintPoller';
import { useSettings } from '../../contexts/SettingsContext';

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

const typeToStation: Record<PrinterType, PrinterStation> = {
  CUISINE: 'KITCHEN',
  BAR: 'BAR',
  CAISSE: 'CASHIER',
  AUTRE: 'OTHER',
};

export default function PrintersManager() {
  const { settings, updateSetting } = useSettings();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editPrinter, setEditPrinter] = useState<Printer | null>(null);
  const [form, setForm] = useState<PrinterForm>(empty);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ printerId: string; status: string; error: string | null } | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [deviceAvailability, setDeviceAvailability] = useState<Record<string, boolean>>({});
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [associations, setAssociations] = useState<UsbAssociation[]>([]);
  const webUsbSupported = isWebUsbSupported();

  const fetchPrinters = useCallback(async () => {
    const { data } = await supabase.from('printers').select('*').order('type');
    setPrinters(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrinters();
    setAssociations(getAssociations());
    startUsbPrintPolling();
    const interval = setInterval(fetchPrinters, 20_000);
    return () => {
      clearInterval(interval);
      stopUsbPrintPolling();
    };
  }, [fetchPrinters]);

  const refreshUsbStatus = useCallback(async () => {
    const assocs = getAssociations();
    setAssociations(assocs);
    const avail: Record<string, boolean> = {};
    const names: Record<string, string> = {};
    for (const a of assocs) {
      try {
        avail[a.printerId] = await isDeviceAvailable(a.printerId);
        names[a.printerId] = await getDeviceName(a.printerId) || a.deviceName;
      } catch {
        avail[a.printerId] = false;
        names[a.printerId] = a.deviceName;
      }
    }
    setDeviceAvailability(avail);
    setDeviceNames(names);
  }, []);

  useEffect(() => {
    refreshUsbStatus();
    const interval = setInterval(refreshUsbStatus, 10_000);
    return () => clearInterval(interval);
  }, [refreshUsbStatus]);

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
    removeAssociation(id);
    await supabase.from('printers').delete().eq('id', id);
    setPrinters(prev => prev.filter(p => p.id !== id));
    refreshUsbStatus();
  };

  const toggleActive = async (p: Printer) => {
    await supabase.from('printers').update({ active: !p.active }).eq('id', p.id);
    setPrinters(prev => prev.map(pr => pr.id === p.id ? { ...pr, active: !p.active } : pr));
  };

  const handleConnect = async (printer: Printer) => {
    setConnectingId(printer.id);
    setConnectError(null);
    try {
      const existing = getAssociation(printer.id);
      const width: PaperWidth = existing?.width || 80;
      await connectPrinter(printer.id, width);
      await refreshUsbStatus();
    } catch (err: any) {
      setConnectError(err?.message || String(err));
    } finally {
      setConnectingId(null);
    }
  };

  const handleChangeWidth = async (printerId: string, width: PaperWidth) => {
    const existing = getAssociation(printerId);
    if (existing) {
      const updated = { ...existing, width };
      localStorage.setItem('usb_printer_associations', JSON.stringify(
        getAssociations().map(a => a.printerId === printerId ? updated : a)
      ));
      setAssociations(getAssociations());
    }
  };

  const handleTest = async (p: Printer) => {
    setTestingId(p.id);
    setTestResult(null);
    const assoc = getAssociation(p.id);
    if (!assoc) {
      setTestResult({ printerId: p.id, status: 'FAILED', error: 'Aucune association USB. Cliquez sur Connecter d\'abord.' });
      setTestingId(null);
      return;
    }
    try {
      const name = deviceNames[p.id] || p.nom;
      await sendTestTicket(p.id, name, assoc.width);
      setTestResult({ printerId: p.id, status: 'SUCCESS', error: null });
    } catch (err: any) {
      setTestResult({ printerId: p.id, status: 'FAILED', error: err?.message || String(err) });
    } finally {
      setTestingId(null);
    }
  };

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

      {/* WebUSB availability */}
      {!webUsbSupported && (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">WebUSB non disponible</h3>
              <p className="text-sm text-amber-800 mt-1">
                Votre navigateur ne supporte pas WebUSB. Utilisez <strong>Chrome</strong> ou <strong>Edge</strong> sur HTTPS ou localhost pour connecter les imprimantes USB.
                Safari et Firefox ne supportent pas WebUSB.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-print options */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-3">Options d'impression automatique</p>
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <PrinterIcon size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Reçu automatique après paiement</p>
              <p className="text-xs text-gray-500 mt-0.5">Imprime le reçu automatiquement après validation du paiement.</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('autoReceiptPrint', !settings.autoReceiptPrint)}
            className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ml-4 ${settings.autoReceiptPrint ? 'bg-amber-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.autoReceiptPrint ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="flex items-center justify-between py-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <PrinterIcon size={16} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Bon cuisine/bar avec le reçu</p>
              <p className="text-xs text-gray-500 mt-0.5">Envoie uniquement les lignes non encore imprimées avec le reçu de paiement.</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('kitchenTicketWithReceipt', !settings.kitchenTicketWithReceipt)}
            className={`relative w-12 h-6 rounded-full transition-all flex-shrink-0 ml-4 ${settings.kitchenTicketWithReceipt ? 'bg-amber-500' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.kitchenTicketWithReceipt ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Old relay shutdown instructions */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
        <p className="font-bold mb-2">Arrêt de l'ancien relais d'impression</p>
        <p className="text-sky-800 mb-2">Si vous utilisiez l'ancien relais (print-relay), arrêtez-le avant la bascule :</p>
        <ul className="space-y-1 text-sky-900 ml-4 list-disc">
          <li>Windows : fermez la fenêtre Node.js du relais ou utilisez le Gestionnaire des tâches pour terminer le processus <code className="bg-white/60 px-1 rounded">node print-relay.cjs</code></li>
          <li>Mac : ouvrez le Terminal et lancez <code className="bg-white/60 px-1 rounded">pkill -f print-relay</code></li>
          <li>Le retrait des appels au relais dans le code ne désinstalle pas le relais de votre ordinateur. Vous devez l'arrêter manuellement.</li>
        </ul>
      </div>

      {/* Printer list with USB blocks */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {printers.map(p => {
            const cfg = typeConfig[p.type];
            const backupPrinter = printers.find(b => b.id === p.backup_printer_id);
            const assoc = associations.find(a => a.printerId === p.id);
            const available = deviceAvailability[p.id] || false;
            const deviceName = deviceNames[p.id] || assoc?.deviceName || null;
            return (
              <div key={p.id} className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-all ${p.active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${assoc ? 'bg-teal-50' : 'bg-gray-100'}`}>
                      {assoc ? <UsbIcon size={20} className="text-teal-600" /> : <Network size={20} className="text-gray-600" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{p.nom}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${p.connection_type === 'USB' ? 'bg-teal-50 text-teal-700' : 'bg-sky-50 text-sky-700'}`}>
                          {p.connection_type === 'USB' ? 'USB' : 'Réseau'}
                        </span>
                        {assoc && (
                          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {available ? 'Disponible' : 'Hors ligne'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => toggleActive(p)} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all ${p.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {p.active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {/* USB printer block */}
                <div className="border border-gray-200 rounded-xl p-4 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Usb size={16} className="text-teal-600" />
                      <span className="text-sm font-semibold text-gray-700">Imprimante thermique USB</span>
                    </div>
                    {assoc && (
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {available ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                        {available ? 'Connectée' : 'Non détectée'}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    <div>
                      <p className="text-xs text-gray-400">Destination</p>
                      <p className="font-medium text-gray-700">{cfg.label}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Périphérique</p>
                      <p className="font-medium text-gray-700 truncate">{deviceName || 'Non associée'}</p>
                    </div>
                  </div>

                  {assoc && (
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-gray-500">Largeur :</span>
                      <div className="flex gap-2">
                        {[58, 80].map(w => (
                          <button
                            key={w}
                            onClick={() => handleChangeWidth(p.id, w as PaperWidth)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${assoc.width === w ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                          >
                            {w}mm
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleConnect(p)}
                      disabled={connectingId === p.id || !webUsbSupported}
                      className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                    >
                      {connectingId === p.id ? <Loader size={12} className="animate-spin" /> : <Usb size={12} />}
                      {assoc ? 'Changer' : 'Connecter'}
                    </button>
                    {assoc && (
                      <button
                        onClick={() => handleTest(p)}
                        disabled={testingId === p.id}
                        className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {testingId === p.id ? <Loader size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                        Tester
                      </button>
                    )}
                    {assoc && (
                      <button
                        onClick={() => { removeAssociation(p.id); refreshUsbStatus(); }}
                        className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                      >
                        <X size={12} /> Dissocier
                      </button>
                    )}
                    <button onClick={() => openEdit(p)} className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-medium transition-all">
                      <Pencil size={12} /> Modifier
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="w-9 h-9 bg-red-50 hover:bg-red-100 rounded-xl flex items-center justify-center text-red-500 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {connectError && connectingId === p.id && (
                    <div className="mt-3 px-3 py-2 rounded-lg text-xs bg-red-50 text-red-700 flex items-center gap-2">
                      <AlertCircle size={14} /> {connectError}
                    </div>
                  )}

                  {testResult && testResult.printerId === p.id && (
                    <div className={`mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      testResult.status === 'SUCCESS' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {testResult.status === 'SUCCESS' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      <span>
                        {testResult.status === 'SUCCESS' ? 'Test envoyé — vérifiez la sortie papier.' : `Échec: ${testResult.error}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Network config still shown for reference */}
                {p.connection_type === 'NETWORK' && (
                  <div className="mt-2 text-xs text-gray-500">
                    <p className="font-mono">Config réseau conservée : {p.ip_address || '—'}:{p.port}</p>
                    <p className="mt-1 text-gray-400">Le mode USB nécessite une association USB. Zadig ne transforme pas une imprimante réseau en imprimante USB.</p>
                  </div>
                )}
                {backupPrinter && (
                  <p className="text-xs text-amber-600 font-medium mt-2">Backup: {backupPrinter.nom}</p>
                )}
              </div>
            );
          })}
          {printers.length === 0 && (
            <div className="p-12 text-center text-gray-400">
              <PrinterIcon size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Aucune imprimante configurée</p>
              <p className="text-sm mt-1">Ajoutez vos imprimantes pour les associer en USB</p>
            </div>
          )}
        </div>
      )}

      {/* Windows / Zadig instructions */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-950">
        <p className="font-bold mb-3">Instructions Windows — Installation du pilote WinUSB avec Zadig</p>
        <ol className="space-y-2.5">
          <li className="flex gap-3"><span className="font-bold text-sky-700 flex-shrink-0">1.</span><span>Arrêtez l'ancien relais d'impression et fermez la caisse.</span></li>
          <li className="flex gap-3"><span className="font-bold text-sky-700 flex-shrink-0">2.</span><span>Téléchargez Zadig sur <a href="https://zadig.akeo.ie/" target="_blank" rel="noreferrer" className="underline font-semibold">https://zadig.akeo.ie/</a></span></li>
          <li className="flex gap-3"><span className="font-bold text-sky-700 flex-shrink-0">3.</span><span>Ouvrez Zadig, menu <strong>Options → List All Devices</strong>.</span></li>
          <li className="flex gap-3"><span className="font-bold text-sky-700 flex-shrink-0">4.</span><span>Sélectionnez précisément votre imprimante thermique dans la liste (pas un autre périphérique USB).</span></li>
          <li className="flex gap-3"><span className="font-bold text-sky-700 flex-shrink-0">5.</span><span>Choisissez <strong>WinUSB</strong> dans la liste des pilotes, puis cliquez sur <strong>Replace Driver</strong>.</span></li>
          <li className="flex gap-3"><span className="font-bold text-sky-700 flex-shrink-0">6.</span><span>Rouvez la caisse dans <strong>Chrome</strong> ou <strong>Edge</strong> et cliquez sur <strong>Connecter</strong> sur l'imprimante souhaitée.</span></li>
        </ol>
        <div className="mt-3 rounded-xl bg-white/80 border border-sky-200 p-3 space-y-2">
          <p className="text-sky-800 font-semibold">Attention</p>
          <p className="text-sky-900">WinUSB remplace le pilote Windows de l'imprimante. Les logiciels qui utilisent le pilote officiel (pilote d'impression Windows) ne pourront plus accéder à l'imprimante tant que WinUSB est actif.</p>
          <p className="text-sky-900 font-semibold mt-2">Restaurer le pilote officiel Epson :</p>
          <ol className="space-y-1 text-sky-800 ml-4 list-decimal">
            <li>Ouvrez le Gestionnaire de périphériques Windows</li>
            <li>Trouvez l'imprimante sous « Périphériques USB » ou « Imprimantes »</li>
            <li>Clic droit → Mettre à jour le pilote → Rechercher des pilotes sur mon ordinateur</li>
            <li>Sélectionnez le pilote officiel Epson téléchargé depuis le site d'Epson</li>
          </ol>
        </div>
      </div>

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
                  <p className="text-xs text-gray-400 mt-1">L'association USB se fait via le bouton Connecter après création.</p>
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
