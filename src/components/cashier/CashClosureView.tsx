import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Lock,
  Printer, RefreshCw, Check, ChevronRight,
  AlertTriangle, CheckCircle2, DollarSign,
  CreditCard, Smartphone, Banknote, Activity,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CashTotals, CashSession, PaymentMethod } from '../../lib/types';
import {
  computeTotals, createXClosure,
  createZClosure, generateCashTicketPayload,
  getOpenSession, openSession,
} from '../../services/cashClosureService';
import { createPendingPrintJob } from '../../services/printingHub';
import { getCachedBusinessHours, formatBusinessHour } from '../../lib/businessDay';

type SubTab = 'x' | 'z';
type ZStep = 1 | 2 | 3;

const METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { id: 'CASH', label: 'Espèces', icon: <Banknote size={15} /> },
  { id: 'CARD', label: 'Carte', icon: <CreditCard size={15} /> },
  { id: 'WAVE', label: 'Wave', icon: <Smartphone size={15} /> },
  { id: 'ORANGE_MONEY', label: 'Orange Money', icon: <Smartphone size={15} /> },
  { id: 'OTHER', label: 'Autre', icon: <DollarSign size={15} /> },
];

const f = (n: number) => (n || 0).toLocaleString('fr-FR') + ' F';

interface StatusMsg {
  type: 'success' | 'error' | 'info';
  text: string;
}

interface Props {
  onZClose?: () => void;
  onZReturn?: () => void;
}

export default function CashClosureView({ onZClose, onZReturn }: Props) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>('x');

  const [session, setSession] = useState<CashSession | null>(null);
  const [totals, setTotals] = useState<CashTotals | null>(null);
  const [totalsLoading, setTotalsLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMsg | null>(null);

  const [zStep, setZStep] = useState<ZStep>(1);
  const [cashCounted, setCashCounted] = useState('');
  const [zNotes, setZNotes] = useState('');
  const [zClosing, setZClosing] = useState(false);
  const [zDone, setZDone] = useState(false);
  const [zError, setZError] = useState<string | null>(null);

  const isAdminRole = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const canDoZ = isAdminRole || user?.role === 'CAISSIER';
  const canDoX = isAdminRole || user?.role === 'CAISSIER';

  const getOrCreateSession = useCallback(async (): Promise<CashSession | null> => {
    if (!user) return null;
    let s = await getOpenSession();
    if (!s) {
      s = await openSession({ userId: user.id, openingFloat: 0 });
    }
    return s;
  }, [user]);

  const loadTotals = useCallback(async () => {
    setTotalsLoading(true);
    setStatusMsg(null);
    try {
      let s = await getOpenSession();
      if (!s && user) {
        s = await openSession({ userId: user.id, openingFloat: 0 });
      }
      setSession(s);
      const t = await computeTotals(s);
      setTotals(t);
    } catch {
      setStatusMsg({ type: 'error', text: 'Erreur lors du chargement des totaux.' });
    } finally {
      setTotalsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTotals();
  }, [loadTotals]);

  const handlePrintX = async () => {
    if (!totals || !user) return;
    setPrinting(true);
    setStatusMsg(null);
    try {
      const activeSession = session || await getOrCreateSession();
      const payload = generateCashTicketPayload({
        type: 'X', session: activeSession, totals, caissierNom: user.nom,
      });

      const closure = await createXClosure({ session: activeSession, userId: user.id, totals });
      if (!closure) {
        setStatusMsg({ type: 'error', text: 'Erreur lors de l\'enregistrement du rapport X.' });
        return;
      }

      const { data: printer } = await supabase
        .from('printers')
        .select('id, ip_address, port')
        .eq('type', 'CAISSE')
        .eq('active', true)
        .maybeSingle();

      if (!printer?.id) {
        setStatusMsg({ type: 'info', text: 'Rapport X enregistré. Aucune imprimante Caisse active — impression ignorée.' });
        return;
      }

      const jobId = await createPendingPrintJob({
        printerId: printer.id,
        type: 'REPORT_X',
        contentSummary: `Rapport X - ${new Date().toLocaleString('fr-FR')}`,
        payloadText: payload,
        createdBy: user.id,
      });

      if (!jobId) {
        setStatusMsg({ type: 'error', text: 'Rapport X enregistré mais l\'envoi à l\'imprimante a échoué.' });
        return;
      }

      setStatusMsg({ type: 'success', text: 'Rapport X enregistré et envoyé à l\'imprimante.' });
    } catch {
      setStatusMsg({ type: 'error', text: 'Une erreur inattendue est survenue.' });
    } finally {
      setPrinting(false);
    }
  };

  const handleZClose = async () => {
    if (!totals || !user) return;

    const counted = parseFloat(cashCounted);
    if (isNaN(counted) || counted < 0) {
      setZError('Veuillez saisir un montant valide (nombre positif).');
      return;
    }

    setZClosing(true);
    setZError(null);

    try {
      const activeSession = session || await getOrCreateSession();

      const { closure, error: zCloseError } = await createZClosure({
        session: activeSession, userId: user.id, totals, cashCounted: counted, notes: zNotes,
      });

      if (!closure) {
        setZError(`Erreur : ${zCloseError || 'Enregistrement échoué. Veuillez réessayer.'}`);
        return;
      }

      const payload = generateCashTicketPayload({
        type: 'Z', session: activeSession, totals, cashCounted: counted, caissierNom: user.nom,
      });

      const { data: printer } = await supabase
        .from('printers')
        .select('id, ip_address, port')
        .eq('type', 'CAISSE')
        .eq('active', true)
        .maybeSingle();

      if (printer?.id) {
        await createPendingPrintJob({
          printerId: printer.id,
          type: 'REPORT_Z',
          contentSummary: `Clôture Z - ${new Date().toLocaleString('fr-FR')}`,
          payloadText: payload,
          createdBy: user.id,
        });
      }

      setSession(null);
      setZDone(true);
      onZClose?.();
    } catch {
      setZError('Une erreur inattendue est survenue. Veuillez réessayer.');
    } finally {
      setZClosing(false);
    }
  };

  const totalPaid = totals ? METHODS.reduce((s, m) => s + (totals.by_method[m.id] || 0), 0) : 0;
  const cashDiff = totals && cashCounted !== '' ? parseFloat(cashCounted) - totals.cash_theoretical : null;

  if (zDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-4">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle2 size={40} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Clôture Z effectuée</h2>
        <p className="text-gray-500 max-w-sm">
          Toutes les opérations de la journée ont été archivées. Le rapport Z a été envoyé à l'imprimante caisse.
        </p>
        <button
          onClick={() => {
            setZDone(false);
            setZStep(1);
            setCashCounted('');
            setZNotes('');
            setZError(null);
            loadTotals();
            onZReturn?.();
          }}
          className="bg-amber-500 hover:bg-amber-400 text-white px-6 py-3 rounded-xl font-semibold transition-all"
        >
          Retour au tableau de bord
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clôture de caisse</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {(() => {
              const { openHour, closeHour } = getCachedBusinessHours();
              return `Période : service en cours (${formatBusinessHour(openHour)} → ${formatBusinessHour(closeHour)})`;
            })()}
          </p>
        </div>
        <button onClick={loadTotals} disabled={totalsLoading} className="text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5 text-sm disabled:opacity-50">
          <RefreshCw size={14} className={totalsLoading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {statusMsg && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
          statusMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          statusMsg.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> :
           statusMsg.type === 'error' ? <XCircle size={16} className="mt-0.5 shrink-0" /> :
           <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          {statusMsg.text}
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'x' as SubTab, label: 'Rapport X' },
          { id: 'z' as SubTab, label: 'Clôture Z' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setSubTab(t.id); setStatusMsg(null); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${subTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'x' && (
        <div className="space-y-4">
          {totalsLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : totals ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>Commandes non payées exclues des totaux. Elles seront comptabilisées après encaissement.</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Tickets payés</p>
                  <p className="text-3xl font-black text-gray-900">{totals.paid_orders_count}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">CA brut</p>
                  <p className="text-xl font-black text-emerald-700">{f(totals.gross_revenue)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Dépenses</p>
                  <p className="text-xl font-black text-red-600">-{f(totals.total_expenses ?? 0)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">CA net</p>
                  <p className="text-xl font-black text-blue-700">{f(totals.net_revenue)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                    <Activity size={14} className="text-gray-400" />
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Par moyen de paiement</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {METHODS.map(m => {
                      const amount = totals.by_method[m.id] || 0;
                      if (amount === 0) return null;
                      return (
                        <div key={m.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="text-gray-400">{m.icon}</span>
                            {m.label}
                          </div>
                          <span className="font-bold text-gray-900 text-sm">{f(amount)}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="font-bold text-gray-700">Total encaissé</span>
                      <span className="font-black text-emerald-700 text-lg">{f(totalPaid)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                    <TrendingUp size={14} className="text-gray-400" />
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Produits vendus</h3>
                    <span className="ml-auto text-xs text-gray-400">{totals.all_products?.length || 0} produit(s)</span>
                  </div>
                  <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
                    {totals.all_products && totals.all_products.length > 0 ? (
                      <>
                        {totals.all_products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                              <span className="text-xs font-medium text-gray-800 truncate">{p.nom}</span>
                              <span className="text-xs text-gray-400 whitespace-nowrap">×{p.qty}</span>
                            </div>
                            <span className="text-xs font-bold text-gray-700 ml-2 whitespace-nowrap">{f(p.amount)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-bold">
                          <span className="text-sm text-gray-700">
                            TOTAL ({totals.all_products.reduce((s, p) => s + p.qty, 0)} articles)
                          </span>
                          <span className="text-sm text-amber-600">
                            {f(totals.all_products.reduce((s, p) => s + p.amount, 0))}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">Aucune vente aujourd'hui</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Solde espèces</h3>
                <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                  <span className="text-gray-500">Fond initial</span>
                  <span className="font-semibold text-gray-700">+{f(totals.opening_float)}</span>
                </div>
                <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                  <span className="text-gray-500">Ventes espèces</span>
                  <span className="font-semibold text-emerald-700">+{f(totals.by_method.CASH)}</span>
                </div>
                {(totals.total_expenses ?? 0) > 0 && (
                  <div className="flex justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-500">Dépenses</span>
                    <span className="font-semibold text-red-600">-{f(totals.total_expenses)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 font-bold">
                  <span className="text-gray-800">Espèces théoriques</span>
                  <span className="text-blue-800 text-base">{f(totals.cash_theoretical)}</span>
                </div>
              </div>

              {canDoX ? (
                <button
                  onClick={handlePrintX}
                  disabled={printing}
                  className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white py-4 rounded-2xl font-bold transition-all"
                >
                  {printing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Printer size={16} />}
                  {printing ? 'Impression en cours...' : 'Imprimer rapport X'}
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center flex items-center justify-center gap-2 text-red-600">
                  <Lock size={16} /> <span className="text-sm font-semibold">Accès réservé aux caissiers et administrateurs</span>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <button onClick={loadTotals} className="text-amber-600 font-semibold text-sm hover:underline">Charger les totaux</button>
            </div>
          )}
        </div>
      )}

      {subTab === 'z' && (
        <div className="space-y-4">
          {!canDoZ ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-2">
              <Lock size={28} className="mx-auto text-red-400" />
              <p className="font-semibold text-red-700">Accès restreint</p>
              <p className="text-sm text-red-500">La clôture Z est réservée aux caissiers et administrateurs.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-2">
                {([1, 2, 3] as ZStep[]).map(step => (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${zStep >= step ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {zStep > step ? <Check size={12} /> : step}
                    </div>
                    <span className={`text-xs font-medium hidden sm:block ${zStep >= step ? 'text-gray-700' : 'text-gray-400'}`}>
                      {step === 1 ? 'Résumé' : step === 2 ? 'Comptage' : 'Confirmation'}
                    </span>
                    {step < 3 && <ChevronRight size={12} className="text-gray-300" />}
                  </div>
                ))}
              </div>

              {zStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    <span>La clôture Z enregistre définitivement les totaux de la journée et archive toutes les commandes payées.</span>
                  </div>

                  {totalsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : totals ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="bg-gray-900 text-white px-5 py-4">
                        <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">CA brut</p>
                        <p className="text-3xl font-black">{f(totals.gross_revenue)}</p>
                        {(totals.total_expenses ?? 0) > 0 && (
                          <p className="text-red-400 text-sm mt-0.5">- {f(totals.total_expenses)} dépenses = <span className="text-white font-bold">{f(totals.net_revenue)} net</span></p>
                        )}
                        <p className="text-gray-400 text-sm mt-0.5">{totals.paid_orders_count} ticket(s) payé(s)</p>
                      </div>
                      <div className="p-4 space-y-2">
                        {METHODS.map(m => {
                          const amount = totals.by_method[m.id] || 0;
                          if (amount === 0) return null;
                          return (
                            <div key={m.id} className="flex justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                              <div className="flex items-center gap-2 text-gray-600">
                                <span className="text-gray-400">{m.icon}</span>
                                {m.label}
                              </div>
                              <span className="font-bold text-gray-800">{f(amount)}</span>
                            </div>
                          );
                        })}
                        {(totals.total_expenses ?? 0) > 0 && (
                          <div className="flex justify-between text-sm py-1 border-t border-gray-200 mt-1">
                            <span className="text-red-600 font-semibold">Dépenses à déduire</span>
                            <span className="font-bold text-red-600">-{f(totals.total_expenses)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button onClick={loadTotals} className="text-amber-600 text-sm font-semibold">Charger les totaux</button>
                  )}

                  {totals && totals.all_products && totals.all_products.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                        <TrendingUp size={14} className="text-gray-400" />
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Produits vendus</h3>
                        <span className="ml-auto text-xs text-gray-400">{totals.all_products.length} produit(s)</span>
                      </div>
                      <div className="p-4 space-y-1 max-h-80 overflow-y-auto">
                        {totals.all_products.map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs text-gray-400 w-5 text-right">{i + 1}.</span>
                              <span className="text-xs font-medium text-gray-800 truncate">{p.nom}</span>
                              <span className="text-xs text-gray-400 whitespace-nowrap">×{p.qty}</span>
                            </div>
                            <span className="text-xs font-bold text-gray-700 ml-2 whitespace-nowrap">{f(p.amount)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200 font-bold">
                          <span className="text-sm text-gray-700">
                            TOTAL ({totals.all_products.reduce((s, p) => s + p.qty, 0)} articles)
                          </span>
                          <span className="text-sm text-amber-600">
                            {f(totals.all_products.reduce((s, p) => s + p.amount, 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setZStep(2)}
                    disabled={!totals}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                  >
                    Suivant : Comptage espèces <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {zStep === 2 && totals && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-gray-800">Comptage des espèces</h3>
                    <div className="flex justify-between text-sm py-2 bg-blue-50 rounded-xl px-3">
                      <span className="text-blue-700 font-semibold">Montant théorique</span>
                      <span className="font-black text-blue-800">{f(totals.cash_theoretical)}</span>
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Montant compté (FCFA)</label>
                      <input
                        type="number"
                        min="0"
                        value={cashCounted}
                        onChange={e => setCashCounted(e.target.value)}
                        placeholder="Saisir le montant réel..."
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-xl font-bold focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                      />
                    </div>
                    {cashCounted !== '' && (
                      <div className={`flex justify-between items-center px-4 py-3 rounded-xl border-2 ${cashDiff === null ? '' : cashDiff >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <span className={`font-semibold text-sm ${cashDiff === null ? 'text-gray-600' : cashDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Écart
                        </span>
                        <span className={`font-black text-lg ${cashDiff === null ? 'text-gray-600' : cashDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {cashDiff !== null ? (cashDiff >= 0 ? '+' : '') + f(cashDiff) : '—'}
                        </span>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Note (optionnel)</label>
                      <textarea
                        value={zNotes}
                        onChange={e => setZNotes(e.target.value)}
                        placeholder="Observations sur la clôture..."
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setZStep(1)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl font-semibold transition-all">
                      Retour
                    </button>
                    <button
                      onClick={() => {
                        const v = parseFloat(cashCounted);
                        if (isNaN(v) || v < 0) {
                          setZError('Veuillez saisir un montant valide.');
                          return;
                        }
                        setZError(null);
                        setZStep(3);
                      }}
                      disabled={cashCounted === ''}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      Confirmer <ChevronRight size={16} />
                    </button>
                  </div>
                  {zError && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                      <XCircle size={15} className="shrink-0" /> {zError}
                    </div>
                  )}
                </div>
              )}

              {zStep === 3 && totals && (
                <div className="space-y-4">
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={20} className="text-red-600" />
                      <h3 className="font-bold text-red-800">Confirmation finale</h3>
                    </div>
                    <p className="text-sm text-red-700">
                      Vous êtes sur le point d'enregistrer la clôture Z. Toutes les commandes payées seront archivées définitivement.
                    </p>
                    <div className="bg-white rounded-xl p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">CA brut</span>
                        <span className="font-bold">{f(totals.gross_revenue)}</span>
                      </div>
                      {(totals.total_expenses ?? 0) > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dépenses</span>
                          <span className="font-bold text-red-600">-{f(totals.total_expenses)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-gray-100 pt-1.5">
                        <span className="text-gray-700 font-semibold">CA net</span>
                        <span className="font-bold text-emerald-700">{f(totals.net_revenue)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-100 pt-1.5">
                        <span className="text-gray-500">Espèces théoriques</span>
                        <span className="font-bold">{f(totals.cash_theoretical)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Comptage réel</span>
                        <span className="font-bold">{f(parseFloat(cashCounted) || 0)}</span>
                      </div>
                      {cashDiff !== null && (
                        <div className={`flex justify-between font-bold border-t border-gray-100 pt-1.5 ${cashDiff >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          <span>Écart</span>
                          <span>{cashDiff >= 0 ? '+' : ''}{f(cashDiff)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {zError && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                      <XCircle size={15} className="shrink-0" /> {zError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => { setZStep(2); setZError(null); }} disabled={zClosing} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-2xl font-semibold transition-all disabled:opacity-50">
                      Retour
                    </button>
                    <button
                      onClick={handleZClose}
                      disabled={zClosing}
                      className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {zClosing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Clôture en cours...
                        </>
                      ) : (
                        <>
                          <Lock size={15} />
                          VALIDER LA CLÔTURE Z
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
