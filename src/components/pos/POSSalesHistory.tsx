import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { POSVente, POSVenteLigne } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

interface Props {
  companyId: string;
  currencySymbol: string;
  onClose: () => void;
}

export default function POSSalesHistory({ companyId, currencySymbol, onClose }: Props) {
  const [ventes, setVentes] = useState<(POSVente & { lignes: POSVenteLigne[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, [companyId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('pos_ventes')
      .select('*, pos_vente_lignes(*), clients(name)')
      .eq('company_id', companyId)
      .eq('statut', 'finalisée')
      .order('created_at', { ascending: false })
      .limit(50);

    setVentes((data || []).map(v => ({ ...v, lignes: v.pos_vente_lignes || [] })));
    setLoading(false);
  }

  const total = ventes.reduce((a, v) => a + v.total_ttc, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-slate-900">Historique des ventes POS</h2>
            <p className="text-xs text-slate-500">50 dernières ventes</p>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-500">Total</div>
              <div className="font-bold text-blue-600">{formatCurrency(total, currencySymbol)}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ventes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Aucune vente enregistrée</div>
          ) : (
            ventes.map(v => (
              <div key={v.id} className="bg-gray-50 rounded-xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">{v.numero}</div>
                    <div className="text-xs text-slate-500">{formatDate(v.date_vente)} · {v.mode_paiement}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-bold text-slate-900">{formatCurrency(v.total_ttc, currencySymbol)}</div>
                    {expanded === v.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </button>
                {expanded === v.id && (
                  <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-1">
                    {v.lignes.map((l, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-600">{l.designation} × {l.quantite}</span>
                        <span className="font-medium text-slate-900">{formatCurrency(l.montant_ttc, currencySymbol)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
