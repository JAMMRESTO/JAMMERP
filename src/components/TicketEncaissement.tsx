import { Printer, X } from 'lucide-react';
import type { Encaissement, Caisse, Societe } from '../types/database';

const MODE_LABELS: Record<string, string> = {
  especes: 'Especes',
  wave: 'Wave',
  orange_money: 'Orange Money',
  carte: 'Carte bancaire',
  cheque: 'Cheque',
};

interface Props {
  encaissement: Encaissement;
  caisse: Caisse | null;
  societe: Societe | null;
  onClose: () => void;
  onNew: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default function TicketEncaissement({ encaissement, caisse, societe, onClose, onNew }: Props) {
  const format = societe?.format_ticket || '80mm';
  const is55 = format === '55mm';

  const print = () => {
    const handler = () => {
      window.removeEventListener('afterprint', handler);
      onClose();
    };
    window.addEventListener('afterprint', handler);
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Ticket de caisse</h3>
            <span className="text-[10px] text-gray-400 font-medium">Format: {format}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div id="ticket-print" className={`p-6 font-mono text-xs ${is55 ? 'format-55mm' : ''}`}>
          <div className="text-center mb-4 space-y-0.5">
            {societe?.logo_url && <img src={societe.logo_url} alt="logo" className={`mx-auto mb-2 object-contain ${is55 ? 'h-8' : 'h-12'}`} />}
            <div className={`font-bold uppercase ticket-header-text ${is55 ? 'text-xs' : 'text-sm'}`}>{societe?.nom ?? 'MA SOCIETE'}</div>
            {societe?.adresse && <div className="text-gray-500 break-words">{societe.adresse}</div>}
            {societe?.telephone && <div className="text-gray-500">Tel: {societe.telephone}</div>}
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-0.5">
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Caisse:</span><span className="text-right truncate">{caisse?.nom}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Date:</span><span>{encaissement.date_transaction}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Heure:</span><span>{encaissement.heure_transaction?.slice(0, 5)}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Facture:</span><span className="font-bold truncate text-right">{encaissement.numero_facture}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Client:</span><span className="truncate text-right">{encaissement.client_nom}</span></div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-0.5">
            <div className={`flex justify-between font-bold ticket-amount ${is55 ? 'text-xs' : 'text-sm'}`}><span>MONTANT:</span><span>{fmt(encaissement.montant)} F</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Mode:</span><span>{MODE_LABELS[encaissement.mode_paiement]}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Recu:</span><span>{fmt(encaissement.montant_recu)} F</span></div>
            <div className="flex justify-between font-bold text-emerald-700"><span>Monnaie:</span><span>{fmt(encaissement.monnaie_rendue)} F</span></div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="text-center text-gray-500 break-words">{societe?.message_ticket ?? 'Merci de votre visite !'}</div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={print} className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm transition active:scale-95">
            <Printer size={16} /> Imprimer
          </button>
          <button onClick={onNew} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-semibold text-sm transition active:scale-95">
            Nouveau
          </button>
        </div>
      </div>
    </div>
  );
}
