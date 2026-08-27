import { useState, useEffect, useRef } from 'react';
import { Printer, Download, MessageCircle, X, Check, Eye } from 'lucide-react';
import { Company, LigneDocument, TemplateStyle } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { buildInvoiceHtml } from '../../lib/invoiceTemplates';
import { buildTicketHtml } from '../../lib/ticketTemplates';

export type DocumentType = 'facture' | 'devis';
export type PrintFormat = 'A4' | 'A5' | 'ticket80';

interface DocumentData {
  type: DocumentType;
  numero: string;
  date: string;
  dateEcheance?: string;
  clientName: string;
  clientPhone?: string;
  clientAddress?: string;
  clientTaxNumber?: string;
  lignes: LigneDocument[];
  sousTotal: number;
  tvaMontant: number;
  total: number;
  montantPaye?: number;
  resteAPayer?: number;
  notes?: string;
  statut?: string;
}

interface Props {
  document: DocumentData;
  company: Company;
  onClose: () => void;
}

export default function PrintShareModal({ document: doc, company, onClose }: Props) {
  const [format, setFormat] = useState<PrintFormat>('A4');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  function getUnite(l: LigneDocument): string {
    if (l.type_vente === 'conditionnement') return l.produits?.conditionnement_nom || 'cond.';
    return l.produits?.unite || l.unite || '';
  }

  const templateStyle = (company.template_facture || 'classic') as TemplateStyle;
  const ticketStyle = (company.template_ticket || 'classic') as TemplateStyle;

  function buildHtml(fmt: PrintFormat): string {
    if (fmt === 'ticket80') {
      return buildTicketHtml(doc, company, ticketStyle);
    }
    return buildInvoiceHtml(doc, company, fmt, templateStyle);
  }

  function buildWhatsAppMessage(): string {
    const lines = doc.lignes.map(l => {
      const unite = getUnite(l);
      return `  • ${l.designation}${unite ? ` (${unite})` : ''} x${l.quantite} = ${formatCurrency(l.montant_ttc, company.currency_symbol)}`;
    }).join('\n');

    const typeLabel = doc.type === 'facture' ? 'FACTURE' : 'DEVIS';

    let msg = `*${typeLabel} N° ${doc.numero}*\n`;
    msg += `Date: ${formatDate(doc.date)}\n`;
    msg += `Client: ${doc.clientName}\n\n`;
    msg += `*Articles:*\n${lines}\n\n`;
    if (company.tva_enabled && doc.tvaMontant > 0) {
      msg += `Sous-total HT: ${formatCurrency(doc.sousTotal, company.currency_symbol)}\n`;
      msg += `TVA: ${formatCurrency(doc.tvaMontant, company.currency_symbol)}\n`;
    }
    msg += `*TOTAL: ${formatCurrency(doc.total, company.currency_symbol)}*`;
    if (doc.resteAPayer && doc.resteAPayer > 0) {
      msg += `\nReste à payer: ${formatCurrency(doc.resteAPayer, company.currency_symbol)}`;
    }
    if (doc.notes) msg += `\n\nNotes: ${doc.notes}`;
    msg += `\n\n_${company.name}_`;
    if (company.phone) msg += `\n${company.phone}`;
    return msg;
  }

  function sendWhatsApp() {
    const phone = doc.clientPhone?.replace(/\D/g, '') || '';
    const msg = encodeURIComponent(buildWhatsAppMessage());
    const url = phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
    window.open(url, '_blank');
  }

  function copyWhatsApp() {
    navigator.clipboard.writeText(buildWhatsAppMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    if (!showPreview || !iframeRef.current) return;
    const html = buildHtml(format);
    const iframe = iframeRef.current;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    return () => { URL.revokeObjectURL(url); };
  }, [showPreview, format]);

  function openPrintWindow() {
    const printScript = `<script>window.onload=function(){window.focus();setTimeout(function(){window.print();},400);}<\/script>`;
    const html = buildHtml(format).replace('</body>', printScript + '</body>');
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) { URL.revokeObjectURL(url); return; }
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  }

  function printFromIframe() {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      openPrintWindow();
    }
  }

  function printDocument() { showPreview ? printFromIframe() : openPrintWindow(); }
  function downloadDocument() { openPrintWindow(); }

  const formatOptions: { value: PrintFormat; label: string; desc: string }[] = [
    { value: 'A4', label: 'A4', desc: 'Format standard' },
    { value: 'A5', label: 'A5', desc: 'Format demi-page' },
    { value: 'ticket80', label: 'Ticket 80mm', desc: 'Ticket de caisse' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col transition-all duration-300 ${
          showPreview ? 'max-w-5xl h-[92vh]' : 'max-w-sm'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="font-bold text-slate-900 text-base">Partager / Imprimer</div>
            <div className="text-xs text-slate-400 mt-0.5">{doc.numero} · {doc.clientName}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                showPreview
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {showPreview ? 'Masquer aperçu' : 'Aperçu'}
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className={`flex flex-1 min-h-0 ${showPreview ? 'flex-row' : 'flex-col'}`}>
          <div className={`flex flex-col ${showPreview ? 'w-72 flex-shrink-0 border-r border-gray-100 overflow-y-auto' : ''}`}>
            <div className="p-5 space-y-5">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Format d'impression</div>
                <div className="grid grid-cols-3 gap-2">
                  {formatOptions.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setFormat(f.value)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all ${
                        format === f.value
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-slate-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`rounded border-2 flex items-center justify-center ${
                        f.value === 'ticket80' ? 'w-5 h-9' : f.value === 'A5' ? 'w-7 h-9' : 'w-8 h-10'
                      } ${format === f.value ? 'border-blue-400 bg-blue-100' : 'border-gray-300 bg-gray-50'}`}>
                        {format === f.value && <Check className="w-3 h-3 text-blue-600" />}
                      </div>
                      <div className="text-xs font-bold">{f.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actions</div>
                <div className="space-y-2">
                  <button
                    onClick={sendWhatsApp}
                    className="w-full flex items-center gap-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors"
                  >
                    <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold">Envoyer par WhatsApp</div>
                      <div className="text-xs text-emerald-600 font-normal">
                        {doc.clientPhone ? `Envoyer à ${doc.clientPhone}` : 'Ouvre WhatsApp Web'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={copyWhatsApp}
                    className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-slate-700 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors"
                  >
                    <div className="w-9 h-9 bg-slate-400 rounded-xl flex items-center justify-center flex-shrink-0">
                      {copied ? <Check className="w-5 h-5 text-white" /> : <MessageCircle className="w-5 h-5 text-white" />}
                    </div>
                    <div className="text-left">
                      <div className="font-bold">{copied ? 'Copié !' : 'Copier le message'}</div>
                      <div className="text-xs text-slate-400 font-normal">Message WhatsApp prêt à coller</div>
                    </div>
                  </button>

                  <button
                    onClick={printDocument}
                    className="w-full flex items-center gap-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors"
                  >
                    <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Printer className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold">Imprimer</div>
                      <div className="text-xs text-blue-500 font-normal">Format {format === 'ticket80' ? 'Ticket 80mm' : format}</div>
                    </div>
                  </button>

                  <button
                    onClick={downloadDocument}
                    className="w-full flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-3 rounded-2xl font-semibold text-sm transition-colors"
                  >
                    <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Download className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold">Télécharger en PDF</div>
                      <div className="text-xs text-slate-400 font-normal">Enregistrer via impression PDF</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {showPreview && (
            <div className="flex-1 min-w-0 bg-slate-100 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-200 border-b border-slate-300 flex-shrink-0">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Aperçu — {format === 'ticket80' ? 'Ticket 80mm' : format}</span>
              </div>
              <div className="flex-1 overflow-auto p-4 flex justify-center">
                <iframe
                  ref={iframeRef}
                  title="Aperçu document"
                  className={`bg-white shadow-lg border border-slate-300 rounded ${
                    format === 'ticket80' ? 'w-80' : format === 'A5' ? 'w-full max-w-xl' : 'w-full max-w-3xl'
                  }`}
                  style={{ minHeight: '600px', height: '100%' }}
                  sandbox="allow-same-origin allow-scripts allow-modals allow-popups"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
