import { useState, useEffect, useRef } from 'react';
import { CreditCard as Edit2, RefreshCw, Share2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Devis, Company, LigneDocument } from '../../types';
import { formatCurrency, formatDate, getStatutColor, getStatutLabel } from '../../lib/utils';
import PrintShareModal from './PrintShareModal';

interface Props {
  devisId: string;
  company: Company;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
  autoOpenPrint?: boolean;
  onPrintOpened?: () => void;
}

export default function DevisDetail({ devisId, company, onClose, onEdit, onConvert, autoOpenPrint, onPrintOpened }: Props) {
  const [devis, setDevis] = useState<Devis | null>(null);
  const [lignes, setLignes] = useState<LigneDocument[]>([]);
  const [showPrintShare, setShowPrintShare] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const autoOpenRef = useRef(false);

  useEffect(() => {
    Promise.all([
      supabase.from('devis').select('*, clients(*)').eq('id', devisId).maybeSingle(),
      supabase.from('devis_lignes').select('*, produits(name, unite, conditionnement_nom)').eq('devis_id', devisId).order('sort_order'),
    ]).then(([{ data: d }, { data: l }]) => {
      setDevis(d);
      setLignes((l as LigneDocument[]) || []);
      setDataLoaded(true);
    });
  }, [devisId]);

  useEffect(() => {
    if (autoOpenPrint && dataLoaded && !autoOpenRef.current) {
      autoOpenRef.current = true;
      setShowPrintShare(true);
      onPrintOpened?.();
    }
  }, [autoOpenPrint, dataLoaded]);

  if (!devis) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  const client = devis.clients as any;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-900">{devis.numero}</div>
          <div className="text-sm text-slate-500 mt-1">{formatDate(devis.date_devis)}</div>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${getStatutColor(devis.statut)}`}>
            {getStatutLabel(devis.statut)}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowPrintShare(true)}
            className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-100 border border-blue-200">
            <Share2 className="w-3 h-3" /> Partager
          </button>
          {devis.statut !== 'converti' && devis.statut !== 'refusé' && (
            <>
              <button onClick={onEdit} className="flex items-center gap-1 text-xs bg-gray-100 text-slate-600 px-3 py-1.5 rounded-xl font-semibold hover:bg-gray-200">
                <Edit2 className="w-3 h-3" /> Modifier
              </button>
              <button onClick={onConvert} className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-semibold hover:bg-blue-500">
                <RefreshCw className="w-3 h-3" /> Convertir en facture
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-4">
        <div className="text-xs text-slate-400 mb-1">Client</div>
        <div className="font-semibold text-slate-900">{client?.name}</div>
        {client?.phone && <div className="text-sm text-slate-500">{client.phone}</div>}
      </div>

      <div>
        <div className="text-sm font-semibold text-slate-700 mb-2">Produits / Services</div>
        <div className="border border-gray-100 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Désignation</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Qté</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500">Unité</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">P.U.</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => {
                const unite = l.type_vente === 'conditionnement'
                  ? (l.produits?.conditionnement_nom || 'cond.')
                  : (l.produits?.unite || '');
                return (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-slate-900">{l.designation}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{l.quantite}</td>
                    <td className="px-4 py-2 text-slate-500 text-xs">{unite}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{formatCurrency(l.prix_unitaire, company.currency_symbol)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{formatCurrency(l.montant_ttc, company.currency_symbol)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 rounded-2xl p-4 text-sm">
        <div className="flex justify-between font-bold text-slate-900 text-base">
          <span>Total</span><span>{formatCurrency(devis.total, company.currency_symbol)}</span>
        </div>
      </div>

      {devis.notes && (
        <div className="bg-amber-50 rounded-2xl p-4">
          <div className="text-xs font-semibold text-amber-700 mb-1">Notes</div>
          <div className="text-sm text-amber-800">{devis.notes}</div>
        </div>
      )}

      {showPrintShare && (
        <PrintShareModal
          document={{
            type: 'devis',
            numero: devis.numero,
            date: devis.date_devis,
            dateEcheance: devis.date_validite || undefined,
            clientName: client?.name || '',
            clientPhone: client?.phone,
            clientAddress: client?.address,
            clientTaxNumber: client?.tax_number,
            lignes,
            sousTotal: devis.sous_total,
            tvaMontant: devis.tva_montant,
            total: devis.total,
            notes: devis.notes,
            statut: devis.statut,
          }}
          company={company}
          onClose={() => setShowPrintShare(false)}
        />
      )}
    </div>
  );
}
