import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MouvementStock } from '../../types';
import { formatDate } from '../../lib/utils';

interface Props { companyId: string; currencySymbol: string; }

export default function StockMovements({ companyId }: Props) {
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from('mouvements_stock')
      .select('*, produits(name, unite)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setMouvements(data || []); setLoading(false); });
  }, [companyId]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-2">
      {mouvements.length === 0 ? (
        <div className="text-center py-20 text-slate-400">Aucun mouvement de stock enregistré</div>
      ) : mouvements.map(m => (
        <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type_mouvement === 'entrée' ? 'bg-emerald-50' : 'bg-red-50'}`}>
            {m.type_mouvement === 'entrée' ? <ArrowDown className="w-5 h-5 text-emerald-600" /> : m.type_mouvement === 'retour' ? <RefreshCw className="w-5 h-5 text-blue-600" /> : <ArrowUp className="w-5 h-5 text-red-600" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-900 text-sm">{(m.produits as any)?.name || 'Produit inconnu'}</div>
            <div className="text-xs text-slate-500 mt-0.5">{m.notes || m.reference_type} · {formatDate(m.created_at)}</div>
          </div>
          <div className="text-right">
            <div className={`font-bold text-sm ${m.type_mouvement === 'entrée' ? 'text-emerald-600' : 'text-red-600'}`}>
              {m.type_mouvement === 'entrée' ? '+' : '-'}{m.quantite} {(m.produits as any)?.unite}
            </div>
            <div className="text-xs text-slate-400">{m.stock_avant} → {m.stock_apres}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
