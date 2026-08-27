import { CheckCircle, Printer, X, RotateCcw } from 'lucide-react';
import { POSVente, POSVenteLigne, Company, TemplateStyle } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { buildTicketHtml } from '../../lib/ticketTemplates';

interface Props {
  vente: POSVente & { lignes: POSVenteLigne[] };
  company: Company;
  onClose: () => void;
  onNewSale: () => void;
}

export default function POSReceipt({ vente, company, onClose, onNewSale }: Props) {
  function handlePrint() {
    const ticketStyle = (company.template_ticket || 'classic') as TemplateStyle;
    const lignes = vente.lignes.map(l => ({
      ...l,
      type_vente: 'unite' as const,
    }));
    const html = buildTicketHtml({
      type: 'facture',
      numero: vente.numero,
      date: vente.date_vente,
      lignes,
      sousTotal: vente.total_ht,
      tvaMontant: vente.total_tva,
      total: vente.total_ttc,
    }, company, ticketStyle);
    const printScript = `<script>window.onload=function(){window.focus();setTimeout(function(){window.print();},400);}<\/script>`;
    const fullHtml = html.replace('</body>', printScript + '</body>');
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) { URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  return (
    <>

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Vente enregistrée</h2>
              <p className="text-xs text-slate-500">{vente.numero}</p>
            </div>
            <button onClick={onClose} className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="text-center mb-4">
              <div className="font-bold text-slate-900 text-lg">{company.name}</div>
              {company.address && <div className="text-xs text-slate-500">{company.address}</div>}
              {company.phone && <div className="text-xs text-slate-500">{company.phone}</div>}
              <div className="text-xs text-slate-400 mt-1">{formatDate(vente.date_vente)}</div>
              <div className="text-sm font-semibold text-slate-700 mt-1">{vente.numero}</div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="space-y-2 text-sm">
              {vente.lignes.map((l, i) => (
                <div key={i} className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{l.designation}</div>
                    <div className="text-xs text-slate-400">{l.quantite} × {formatCurrency(l.prix_unitaire, company.currency_symbol)}</div>
                  </div>
                  <div className="font-semibold text-slate-900 flex-shrink-0">{formatCurrency(l.montant_ttc, company.currency_symbol)}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />

            <div className="space-y-1 text-sm">
              {company.tva_enabled && (
                <>
                  <div className="flex justify-between text-slate-500"><span>Sous-total HT</span><span>{formatCurrency(vente.total_ht, company.currency_symbol)}</span></div>
                  <div className="flex justify-between text-slate-500"><span>TVA</span><span>{formatCurrency(vente.total_tva, company.currency_symbol)}</span></div>
                </>
              )}
              <div className="flex justify-between font-bold text-base text-slate-900">
                <span>TOTAL</span>
                <span>{formatCurrency(vente.total_ttc, company.currency_symbol)}</span>
              </div>
              <div className="flex justify-between text-slate-500"><span>Mode</span><span>{vente.mode_paiement}</span></div>
              {vente.montant_recu > 0 && (
                <>
                  <div className="flex justify-between text-slate-500"><span>Reçu</span><span>{formatCurrency(vente.montant_recu, company.currency_symbol)}</span></div>
                  {vente.monnaie_rendue > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold"><span>Monnaie</span><span>{formatCurrency(vente.monnaie_rendue, company.currency_symbol)}</span></div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3" />
            <div className="text-center text-xs text-slate-400">Merci de votre achat !</div>
          </div>

          <div className="p-4 border-t border-gray-100 flex gap-2">
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 text-slate-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50">
              <Printer className="w-4 h-4" />Imprimer
            </button>
            <button onClick={onNewSale}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500">
              <RotateCcw className="w-4 h-4" />Nouvelle vente
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
