import { useState, useEffect, useRef } from 'react';
import { Check, FileText, Receipt } from 'lucide-react';
import { Company, TemplateStyle } from '../../types';
import { buildInvoiceHtml } from '../../lib/invoiceTemplates';
import { buildTicketHtml } from '../../lib/ticketTemplates';
import { formatCurrency } from '../../lib/utils';

interface Props {
  company: Company;
  onSave: (templateFacture: TemplateStyle, templateTicket: TemplateStyle) => void;
  saving: boolean;
}

const TEMPLATES: { id: TemplateStyle; name: string; desc: string }[] = [
  { id: 'classic', name: 'Classique', desc: 'Mise en page formelle et structuree' },
  { id: 'modern', name: 'Moderne', desc: 'Design colore avec bordures arrondies' },
  { id: 'elegant', name: 'Elegant', desc: 'Style raffine avec typographie serif' },
  { id: 'minimal', name: 'Minimaliste', desc: 'Epure, sans bordures superflues' },
];

const sampleDoc = {
  type: 'facture' as const,
  numero: 'FAC2026-0001',
  date: '2026-03-19',
  dateEcheance: '2026-04-19',
  clientName: 'Amadou Diallo',
  clientPhone: '+221 77 123 45 67',
  clientAddress: 'Dakar, Senegal',
  lignes: [
    { produit_id: '1', designation: 'Ciment CEM II 42.5', quantite: 50, prix_unitaire: 4500, tva_taux: 18, montant_ht: 225000, montant_tva: 40500, montant_ttc: 265500, sort_order: 0, type_vente: 'unite' as const, produits: { unite: 'sac' } as any },
    { produit_id: '2', designation: 'Fer a beton 10mm', quantite: 100, prix_unitaire: 3200, tva_taux: 18, montant_ht: 320000, montant_tva: 57600, montant_ttc: 377600, sort_order: 1, type_vente: 'unite' as const, produits: { unite: 'barre' } as any },
  ],
  sousTotal: 545000,
  tvaMontant: 98100,
  total: 643100,
  montantPaye: 300000,
  resteAPayer: 343100,
  statut: 'partiellement_payee',
};

function TemplatePreview({ html, className }: { html: string; className?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [html]);

  return (
    <iframe
      ref={iframeRef}
      title="Apercu"
      className={className}
      style={{ pointerEvents: 'none' }}
      sandbox="allow-same-origin"
    />
  );
}

export default function TemplateSelector({ company, onSave, saving }: Props) {
  const [selectedFacture, setSelectedFacture] = useState<TemplateStyle>(
    (company.template_facture as TemplateStyle) || 'classic'
  );
  const [selectedTicket, setSelectedTicket] = useState<TemplateStyle>(
    (company.template_ticket as TemplateStyle) || 'classic'
  );
  const [section, setSection] = useState<'facture' | 'ticket'>('facture');

  const previewCompany = {
    ...company,
    name: company.name || 'Ma Societe',
    tva_enabled: true,
    tva_rate: 18,
    currency_symbol: company.currency_symbol || 'F CFA',
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex gap-2">
        <button
          onClick={() => setSection('facture')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            section === 'facture' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />Factures & Devis
        </button>
        <button
          onClick={() => setSection('ticket')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            section === 'ticket' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
          }`}
        >
          <Receipt className="w-4 h-4" />Tickets de caisse
        </button>
      </div>

      {section === 'facture' && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Choisissez le modele utilise pour imprimer vos factures et devis au format A4 / A5.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEMPLATES.map(t => {
              const html = buildInvoiceHtml(sampleDoc, previewCompany as Company, 'A4', t.id);
              const isSelected = selectedFacture === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedFacture(t.id)}
                  className={`group relative flex flex-col border-2 rounded-2xl overflow-hidden transition-all duration-200 text-left ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className="bg-gray-50 p-2 flex-shrink-0">
                    <TemplatePreview
                      html={html}
                      className="w-full h-48 border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div className="p-3">
                    <div className={`font-bold text-sm ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>{t.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {section === 'ticket' && (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Choisissez le modele utilise pour imprimer vos tickets de caisse (format 80mm).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TEMPLATES.map(t => {
              const html = buildTicketHtml(
                { ...sampleDoc, type: 'facture' },
                previewCompany as Company,
                t.id
              );
              const isSelected = selectedTicket === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicket(t.id)}
                  className={`group relative flex flex-col border-2 rounded-2xl overflow-hidden transition-all duration-200 text-left ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className="bg-gray-50 p-2 flex-shrink-0 flex justify-center">
                    <TemplatePreview
                      html={html}
                      className="w-36 h-56 border border-gray-200 rounded-lg bg-white"
                    />
                  </div>
                  <div className="p-3">
                    <div className={`font-bold text-sm ${isSelected ? 'text-blue-700' : 'text-slate-900'}`}>{t.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => onSave(selectedFacture, selectedTicket)}
        disabled={saving}
        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-500 disabled:opacity-60 transition-colors"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer les modeles'}
      </button>
    </div>
  );
}
