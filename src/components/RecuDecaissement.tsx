import { Printer, X, Plus } from 'lucide-react';
import type { Decaissement, Caisse, Societe } from '../types/database';

interface Props {
  decaissement: Decaissement;
  caisse: Caisse | null;
  societe: Societe | null;
  onClose: () => void;
  onNew: () => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export default function RecuDecaissement({ decaissement, caisse, societe, onClose, onNew }: Props) {
  const format = societe?.format_ticket || '80mm';
  const is55 = format === '55mm';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Recu de decaissement</h3>
            <span className="text-[10px] text-gray-400 font-medium">Format: {format}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div id="recu-print" className={`p-6 font-mono text-xs ${is55 ? 'format-55mm' : ''}`}>
          <div className="text-center mb-4 space-y-0.5">
            {societe?.logo_url && <img src={societe.logo_url} alt="logo" className={`mx-auto mb-2 object-contain ${is55 ? 'h-8' : 'h-12'}`} />}
            <div className={`font-bold uppercase ticket-header-text ${is55 ? 'text-xs' : 'text-sm'}`}>{societe?.nom ?? 'MA SOCIETE'}</div>
            {societe?.adresse && <div className="text-gray-500 break-words">{societe.adresse}</div>}
            {societe?.telephone && <div className="text-gray-500">Tel: {societe.telephone}</div>}
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="text-center font-bold mb-2 uppercase tracking-widest text-xs">Recu de Depense</div>

          <div className="space-y-0.5">
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Caisse:</span><span className="truncate text-right">{caisse?.nom}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Date:</span><span>{decaissement.date_transaction}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">N Piece:</span><span className="font-bold truncate text-right">{decaissement.numero_piece}</span></div>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className="space-y-0.5">
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Compte:</span><span className="truncate text-right">{decaissement.compte_numero}</span></div>
            <div className="flex justify-between gap-1"><span className="text-gray-500 shrink-0">Libelle:</span><span className="truncate text-right">{decaissement.compte_libelle}</span></div>
            {decaissement.description && (
              <div className="break-words"><span className="text-gray-500">Desc: </span><span>{decaissement.description}</span></div>
            )}
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />

          <div className={`flex justify-between font-bold ticket-amount ${is55 ? 'text-xs' : 'text-sm'}`}>
            <span>MONTANT:</span>
            <span className="text-red-700">{fmt(decaissement.montant)} F</span>
          </div>

          <div className="border-t border-dashed border-gray-300 my-2" />
          <div className="text-center text-gray-500">Signature _______________</div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => {
              const handler = () => {
                window.removeEventListener('afterprint', handler);
                onClose();
              };
              window.addEventListener('afterprint', handler);
              window.print();
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm transition active:scale-95"
          >
            <Printer size={16} /> Imprimer
          </button>
          <button onClick={onNew} className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-semibold text-sm transition active:scale-95">
            <Plus size={16} /> Nouveau
          </button>
        </div>
      </div>
    </div>
  );
}
