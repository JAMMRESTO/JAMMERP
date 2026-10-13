import { useEffect, useRef } from 'react';
import { Printer as PrinterIcon, X, Printer } from 'lucide-react';
import { PrintGroup, PrintJobType, PrintLineItem } from '../../lib/types';

interface Props {
  groups: PrintGroup[];
  tableNom: string;
  ticketNumber: string;
  type: PrintJobType;
  total?: number;
  onClose: () => void;
  title?: string;
}

const typeConfig: Record<PrintJobType, { label: string; color: string; bg: string }> = {
  INITIAL: { label: 'Bon de commande', color: 'text-blue-700', bg: 'bg-blue-50' },
  ADDONS: { label: 'Ajouts', color: 'text-amber-700', bg: 'bg-amber-50' },
  BILL: { label: 'Addition', color: 'text-green-700', bg: 'bg-green-50' },
  RECEIPT: { label: 'Facture', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  TEST: { label: 'Test', color: 'text-gray-700', bg: 'bg-gray-50' },
  REPORT_X: { label: 'Rapport X', color: 'text-cyan-700', bg: 'bg-cyan-50' },
  REPORT_Z: { label: 'Cloture Z', color: 'text-rose-700', bg: 'bg-rose-50' },
};

const printerTypeLabels: Record<string, { label: string; bg: string; text: string }> = {
  CUISINE: { label: 'Cuisine', bg: 'bg-orange-100', text: 'text-orange-700' },
  BAR: { label: 'Bar', bg: 'bg-blue-100', text: 'text-blue-700' },
  CAISSE: { label: 'Caisse', bg: 'bg-green-100', text: 'text-green-700' },
  AUTRE: { label: 'Autre', bg: 'bg-gray-100', text: 'text-gray-700' },
};

function mergeItems(items: PrintLineItem[]): PrintLineItem[] {
  const map = new Map<string, PrintLineItem>();
  for (const item of items) {
    const key = `${item.nom}|${item.unitPrice}|${(item.options || []).join(',')}|${item.notes || ''}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += item.qty;
    } else {
      map.set(key, { ...item });
    }
  }
  return Array.from(map.values());
}

export default function PrintTicketModal({ groups, tableNom, ticketNumber, type, total, onClose, title }: Props) {
  const cfg = typeConfig[type];
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    shownRef.current = true;
    // The USB poller on the workstation picks up PENDING print jobs automatically.
    // This modal now serves as a preview summary only — no direct browser print.
  }, []);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.bg}`}>
              <Printer size={18} className={cfg.color} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">{title || 'Tickets envoyés'}</h3>
              <p className="text-xs text-gray-500">{tableNom} · {ticketNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            Les tickets sont envoyés au moteur d'impression USB. Le poste caisse connecté récupère les travaux automatiquement.
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <PrinterIcon size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Aucune imprimante à notifier</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group, i) => {
                const pCfg = printerTypeLabels[group.printerType] || printerTypeLabels.AUTRE;
                return (
                  <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <PrinterIcon size={16} className="text-gray-500" />
                        <span className="font-semibold text-gray-800 text-sm">{group.printer.nom}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pCfg.bg} ${pCfg.text}`}>{pCfg.label}</span>
                      </div>
                    </div>
                    <div className="px-4 py-2 space-y-1">
                      {mergeItems(group.items).map((item, j) => (
                        <div key={j} className="flex items-baseline justify-between text-sm gap-2">
                          <div className="flex-1 min-w-0 truncate">
                            <span className="font-bold text-gray-900">{item.qty}× {item.nom}</span>
                            {item.options && item.options.length > 0 && (
                              <span className="font-normal text-gray-500 text-xs"> ({item.options.join(', ')})</span>
                            )}
                            {item.notes && <span className="font-normal text-gray-400 text-xs italic"> · "{item.notes}"</span>}
                          </div>
                          {type === 'BILL' && (
                            <span className="font-bold text-gray-900 text-sm whitespace-nowrap">{(item.unitPrice * item.qty).toLocaleString('fr-FR')} FCFA</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(type === 'BILL' || type === 'RECEIPT') && (
            <div className="bg-gray-900 rounded-xl px-4 py-3 flex justify-between items-baseline">
              <span className="text-gray-300 font-bold text-sm tracking-wide">TOTAL</span>
              <span className="text-white font-extrabold text-lg">
                {(total ?? groups.flatMap(g => g.items).reduce((s, i) => s + i.unitPrice * i.qty, 0)).toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-5 sticky bottom-0 bg-white pt-3 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl text-sm font-semibold transition-all">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
