import { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, Wallet, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSolde } from '../hooks/useSolde';
import type { Caisse } from '../types/database';

interface Props {
  caisseActive: Caisse | null;
  caisses: Caisse[];
  userRole: string;
  onNavigate: (page: string) => void;
  subscriptionDaysLeft: number | null;
  societeNom?: string;
  societeLogo?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.abs(n));
}

interface CaisseSolde {
  id: string;
  nom: string;
  solde: number;
}

const POLL_INTERVAL = 5000;

function useAllCaissesSoldes(caisses: Caisse[], isAdmin: boolean) {
  const [soldes, setSoldes] = useState<CaisseSolde[]>([]);
  const [totalSolde, setTotalSolde] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!isAdmin || caisses.length === 0) {
      setSoldes([]);
      setTotalSolde(null);
      return;
    }

    const results: CaisseSolde[] = [];

    for (const caisse of caisses) {
      const [encRes, decRes, caisseRes] = await Promise.all([
        supabase.from('encaissements').select('montant').eq('caisse_id', caisse.id).eq('archived', false),
        supabase.from('decaissements').select('montant').eq('caisse_id', caisse.id).eq('archived', false),
        supabase.from('caisses').select('fond_de_caisse').eq('id', caisse.id).maybeSingle(),
      ]);
      const fond = Number(caisseRes.data?.fond_de_caisse ?? 0);
      const totalEnc = (encRes.data ?? []).reduce((s, r) => s + Number(r.montant), 0);
      const totalDec = (decRes.data ?? []).reduce((s, r) => s + Number(r.montant), 0);
      results.push({ id: caisse.id, nom: caisse.nom, solde: fond + totalEnc - totalDec });
    }

    setSoldes(results);
    setTotalSolde(results.reduce((s, c) => s + c.solde, 0));
  }, [caisses, isAdmin]);

  useEffect(() => {
    fetchAll();

    if (!isAdmin) return;

    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll, isAdmin]);

  return { soldes, totalSolde };
}

export default function HomePage({ caisseActive, caisses, userRole, onNavigate, subscriptionDaysLeft, societeNom, societeLogo }: Props) {
  const isAdmin = userRole === 'admin';
  const solde = useSolde(caisseActive?.id ?? null);
  const { soldes, totalSolde } = useAllCaissesSoldes(caisses, isAdmin);

  return (
    <div className="relative h-[calc(100vh-56px)] bg-gray-50 flex flex-col items-center justify-center p-4 overflow-y-auto">
      {/* Subscription badge - top right */}
      {subscriptionDaysLeft !== null && (
        <div className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl border shadow-sm text-xs font-semibold ${
          subscriptionDaysLeft <= 7
            ? 'bg-red-50 border-red-200 text-red-600'
            : subscriptionDaysLeft <= 30
              ? 'bg-amber-50 border-amber-200 text-amber-600'
              : 'bg-emerald-50 border-emerald-200 text-emerald-600'
        }`}>
          <Shield size={14} />
          <span>Votre abonnement expire dans <strong>{subscriptionDaysLeft} jour{subscriptionDaysLeft > 1 ? 's' : ''}</strong></span>
        </div>
      )}
      <div className="text-center mb-5">
        {societeLogo ? (
          <img src={societeLogo} alt="" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-3" />
        ) : null}
        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">{societeNom || 'MA CAISSE'}</h1>
        {caisseActive && (
          <p className="text-gray-400 mt-1 text-xs font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {caisseActive.nom} active
            </span>
          </p>
        )}

        {/* Solde global (admin) ou solde caisse active (caissier) */}
        {isAdmin && totalSolde !== null ? (
          <div className="mt-4 inline-flex flex-col items-center gap-0.5 bg-white border border-gray-100 shadow-sm rounded-2xl px-6 py-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Solde Global</span>
            <span className={`text-2xl sm:text-3xl font-black tabular-nums ${totalSolde >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalSolde >= 0 ? '' : '-'}{fmt(totalSolde)}
              <span className="text-sm font-bold text-gray-400 ml-1">FCFA</span>
            </span>
          </div>
        ) : (
          <div className="mt-4 inline-flex flex-col items-center gap-0.5 bg-white border border-gray-100 shadow-sm rounded-2xl px-6 py-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Solde Caisse</span>
            {solde === null ? (
              <span className="text-xl font-black text-gray-300">&mdash;</span>
            ) : (
              <span className={`text-2xl sm:text-3xl font-black tabular-nums ${solde >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {solde >= 0 ? '' : '-'}{fmt(solde)}
                <span className="text-sm font-bold text-gray-400 ml-1">FCFA</span>
              </span>
            )}
          </div>
        )}

        {/* Solde par caisse (admin uniquement) */}
        {isAdmin && soldes.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {soldes.map(cs => (
              <div
                key={cs.id}
                className={`inline-flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm ${
                  caisseActive?.id === cs.id ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-gray-100'
                }`}
              >
                <Wallet size={14} className="text-gray-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block leading-tight">{cs.nom}</span>
                  <span className={`text-sm font-black tabular-nums ${cs.solde >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {cs.solde >= 0 ? '' : '-'}{fmt(cs.solde)}
                    <span className="text-[10px] font-medium text-gray-400 ml-0.5">FCFA</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button
          onClick={() => onNavigate('encaissement')}
          className="group relative overflow-hidden bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-3 shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 transition-all duration-300 active:scale-[0.97] min-h-[160px] sm:min-h-[200px]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/30 to-transparent" />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TrendingUp size={28} strokeWidth={2.5} />
          </div>
          <div className="relative text-center">
            <div className="text-lg sm:text-xl font-black tracking-tight leading-tight">ENCAISSEMENT</div>
            <div className="text-emerald-100 text-[10px] sm:text-xs mt-0.5">Enregistrer un encaissement</div>
          </div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-6 translate-y-6" />
        </button>

        <button
          onClick={() => onNavigate('decaissement')}
          className="group relative overflow-hidden bg-red-500 hover:bg-red-600 text-white rounded-2xl p-5 flex flex-col items-center justify-center gap-3 shadow-lg shadow-red-200 hover:shadow-xl hover:shadow-red-300 transition-all duration-300 active:scale-[0.97] min-h-[160px] sm:min-h-[200px]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 to-transparent" />
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TrendingDown size={28} strokeWidth={2.5} />
          </div>
          <div className="relative text-center">
            <div className="text-lg sm:text-xl font-black tracking-tight leading-tight">DECAISSEMENT</div>
            <div className="text-red-100 text-[10px] sm:text-xs mt-0.5">Enregistrer une depense</div>
          </div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full translate-x-6 translate-y-6" />
        </button>
      </div>
    </div>
  );
}
