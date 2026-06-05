import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Banknote, Smartphone, CreditCard, AlertTriangle,
  CheckCircle2, Loader2, TrendingUp, ShoppingBag,
  Lock, ChevronRight, ArrowUpRight, ArrowDownRight,
  Receipt, Printer
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { esc, fmtAmt, THERMAL_CSS, buildThermalHeader, printViaIframe } from '../../lib/printUtils';
import type { PaymentMethod, CashSession } from '../../types/database';

interface SalesSummary {
  total_sales: number;
  sales_count: number;
  by_method: Record<PaymentMethod, number>;
}

interface CashClosureModalProps {
  onClose: () => void;
  onClosed: (session: CashSession) => void;
  openedAt: string; // ISO — début de session
}

function buildXCaisseHtml(params: {
  session: CashSession;
  summary: SalesSummary;
  restaurantName: string;
  sym: string;
  cashierName: string;
  address: string;
  phone: string;
}): string {
  const { session, summary, restaurantName, sym, cashierName, address, phone } = params;
  const openedAt = new Date(session.opened_at);
  const closedAt = session.closed_at ? new Date(session.closed_at) : new Date();
  const diff = session.cash_difference;
  const diffLabel = diff === 0 ? 'Caisse équilibrée' : diff > 0 ? 'Excédent' : 'Manque';
  const diffSign = diff >= 0 ? '+' : '';
  const fmt = (n: number) => fmtAmt(n, sym);
  const fmtTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const row = (lbl: string, val: string, large = false) =>
    `<div class="row${large ? ' total-row' : ''}"><span class="lbl">${esc(lbl)}</span><span class="val">${esc(val)}</span></div>`;

  const header = buildThermalHeader({ restaurant_name: restaurantName, address, phone });

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="color-scheme" content="only light">
  <title>X de Caisse — Session #${String(session.session_number).padStart(4, '0')}</title>
  <style>${THERMAL_CSS}</style>
</head>
<body>
  ${header}
  <div class="center" style="font-size:14px;font-weight:700;margin:4px 0;">*** X DE CAISSE ***</div>
  <div class="center" style="font-size:11px;margin-bottom:3px;">Session #${String(session.session_number).padStart(4, '0')}</div>
  <hr class="sep">
  ${row('Date', fmtDate(openedAt))}
  ${row('Ouverture', fmtTime(openedAt))}
  ${row('Fermeture', fmtTime(closedAt))}
  ${row('Caissier', cashierName)}
  <hr class="sep">
  <div class="section-title">ACTIVITÉ</div>
  ${row('Nb de ventes', String(summary.sales_count))}
  ${row('CA Total', fmt(summary.total_sales), true)}
  <hr class="sep">
  <div class="section-title">ENCAISSEMENTS</div>
  ${row('Espèces', fmt(session.total_cash))}
  ${row('Wave', fmt(session.total_wave))}
  ${row('Orange Money', fmt(session.total_orange_money))}
  ${row('Carte', fmt(session.total_card))}
  <hr class="sep">
  <div class="section-title">COMPTAGE CAISSE</div>
  ${row('Fonds initial', fmt(session.opening_balance))}
  ${row('Espèces attendues', fmt(session.expected_cash))}
  ${row('Espèces comptées', fmt(session.actual_cash))}
  <hr class="sep-solid">
  ${row(diffLabel, `${diffSign}${fmt(diff)}`, true)}
  ${session.notes ? `<hr class="sep"><div class="section-title">NOTES</div><div style="font-size:11px;">${esc(session.notes)}</div>` : ''}
  <hr class="sep-solid">
  <div class="footer">
    Imprimé le ${new Date().toLocaleString('fr-FR')}<br>
    Document de fermeture — à conserver
  </div>
</body>
</html>`;
}

function printXCaisse(params: {
  session: CashSession;
  summary: SalesSummary;
  restaurantName: string;
  sym: string;
  cashierName: string;
  address: string;
  phone: string;
}) {
  printViaIframe(buildXCaisseHtml(params), '__xcaisse_print_frame__');
}

function fmt(n: number, sym: string) {
  return `${n.toLocaleString('fr-FR')} ${sym}`;
}

const METHOD_CONFIG: { id: PaymentMethod; label: string; icon: typeof Banknote; color: string }[] = [
  { id: 'cash', label: 'Espèces', icon: Banknote, color: 'text-emerald-400' },
  { id: 'wave', label: 'Wave', icon: Smartphone, color: 'text-blue-400' },
  { id: 'orange_money', label: 'Orange Money', icon: Smartphone, color: 'text-orange-400' },
  { id: 'card', label: 'Carte', icon: CreditCard, color: 'text-violet-400' },
];

export function CashClosureModal({ onClose, onClosed, openedAt }: CashClosureModalProps) {
  const { currentUser } = useAuth();
  const { currentSite } = useTenant();
  const siteId = currentSite?.id ?? null;
  const { settings } = useSettings();
  const sym = settings.currency_symbol;

  const [step, setStep] = useState<'review' | 'count' | 'confirm' | 'done'>('review');
  const [summary, setSummary] = useState<SalesSummary>({ total_sales: 0, sales_count: 0, by_method: { cash: 0, wave: 0, orange_money: 0, card: 0 } });
  const [openingBalance, setOpeningBalance] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closedSession, setClosedSession] = useState<CashSession | null>(null);

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      // Récupère toutes les ventes payées depuis l'ouverture de session
      const { data: salesData } = await supabase
        .from('sales')
        .select('id, total')
        .eq('site_id', siteId)
        .eq('status', 'paid')
        .gte('paid_at', openedAt);

      const saleIds = (salesData ?? []).map(s => s.id);
      const totalSales = (salesData ?? []).reduce((s, v) => s + v.total, 0);

      const byMethod: Record<PaymentMethod, number> = { cash: 0, wave: 0, orange_money: 0, card: 0 };

      if (saleIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('method, amount')
          .eq('site_id', siteId)
          .in('sale_id', saleIds);

        for (const p of paymentsData ?? []) {
          byMethod[p.method as PaymentMethod] = (byMethod[p.method as PaymentMethod] ?? 0) + p.amount;
        }
      }

      setSummary({ total_sales: totalSales, sales_count: saleIds.length, by_method: byMethod });
      setLoading(false);
    }
    loadSummary();
  }, [openedAt, siteId]);

  const opening = parseFloat(openingBalance) || 0;
  const actual = parseFloat(actualCash) || 0;
  const expectedCash = opening + summary.by_method.cash;
  const difference = actual - expectedCash;

  async function handleClose() {
    setSaving(true);
    const { data } = await supabase.from('cash_sessions').insert({
      cashier_id: currentUser?.id ?? null,
      closed_by: currentUser?.id ?? null,
      opened_at: openedAt,
      closed_at: new Date().toISOString(),
      opening_balance: opening,
      expected_cash: expectedCash,
      actual_cash: actual,
      cash_difference: difference,
      total_sales: summary.total_sales,
      total_cash: summary.by_method.cash,
      total_wave: summary.by_method.wave,
      total_orange_money: summary.by_method.orange_money,
      total_card: summary.by_method.card,
      sales_count: summary.sales_count,
      notes,
      status: 'closed',
      site_id: siteId,
    }).select().maybeSingle();

    setSaving(false);
    if (data) {
      const session = data as CashSession;
      setClosedSession(session);
      setStep('done');
      // Impression automatique du X de caisse
      printXCaisse({
        session,
        summary,
        restaurantName: settings.restaurant_name,
        sym,
        cashierName: currentUser?.name ?? 'Caissier',
        address: settings.address,
        phone: settings.phone,
      });
      onClosed(session);
    }
  }

  function handleReprint() {
    if (!closedSession) return;
    printXCaisse({
      session: closedSession,
      summary,
      restaurantName: settings.restaurant_name,
      sym,
      cashierName: currentUser?.name ?? 'Caissier',
      address: settings.address,
      phone: settings.phone,
    });
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Lock size={16} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Fermeture de caisse</h2>
              <p className="text-white/40 text-[10px]">
                Session depuis {new Date(openedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
            <X size={15} />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="text-amber-400 animate-spin" />
            <p className="text-white/40 text-sm">Calcul des totaux...</p>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            {step !== 'done' && (
              <div className="flex items-center gap-1 px-5 pt-4">
                {(['review', 'count', 'confirm'] as const).map((s, i) => (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <div className={`h-1 flex-1 rounded-full transition-all ${
                      step === s ? 'bg-amber-500' :
                      (['review','count','confirm'].indexOf(step) > i) ? 'bg-emerald-500' : 'bg-white/10'
                    }`} />
                  </div>
                ))}
              </div>
            )}

            <div className="px-5 py-4">
              <AnimatePresence mode="wait">
                {/* STEP 1 — Résumé des ventes */}
                {step === 'review' && (
                  <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <p className="text-white/60 text-xs mb-3">Ventes depuis l'ouverture de caisse</p>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <div className="bg-white/4 rounded-xl p-3 border border-white/6">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShoppingBag size={12} className="text-white/40" />
                          <span className="text-white/40 text-[10px]">Ventes</span>
                        </div>
                        <p className="text-white font-black text-xl">{summary.sales_count}</p>
                      </div>
                      <div className="bg-white/4 rounded-xl p-3 border border-white/6">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp size={12} className="text-white/40" />
                          <span className="text-white/40 text-[10px]">Chiffre</span>
                        </div>
                        <p className="text-emerald-400 font-black text-lg leading-tight">{fmt(summary.total_sales, sym)}</p>
                      </div>
                    </div>

                    {/* Détail par méthode */}
                    <div className="space-y-1.5 mb-5">
                      {METHOD_CONFIG.map(m => (
                        <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-white/3 rounded-xl border border-white/5">
                          <div className="flex items-center gap-2">
                            <m.icon size={13} className={m.color} />
                            <span className="text-white/60 text-xs">{m.label}</span>
                          </div>
                          <span className={`font-semibold text-sm ${summary.by_method[m.id] > 0 ? 'text-white' : 'text-white/25'}`}>
                            {fmt(summary.by_method[m.id], sym)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => setStep('count')}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors">
                      Continuer <ChevronRight size={15} />
                    </button>
                  </motion.div>
                )}

                {/* STEP 2 — Comptage caisse */}
                {step === 'count' && (
                  <motion.div key="count" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <p className="text-white/60 text-xs mb-4">Renseignez les montants physiques</p>

                    <div className="space-y-3 mb-4">
                      {/* Fonds d'ouverture */}
                      <div>
                        <label className="text-white/50 text-[11px] font-medium block mb-1.5">Fonds de caisse initial</label>
                        <div className="relative">
                          <input type="number" min="0" value={openingBalance}
                            onChange={e => setOpeningBalance(e.target.value)}
                            placeholder="0"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-500/50 transition-colors pr-16" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">{sym}</span>
                        </div>
                      </div>

                      {/* Espèces comptées */}
                      <div>
                        <label className="text-white/50 text-[11px] font-medium block mb-1.5">Espèces comptées en caisse</label>
                        <div className="relative">
                          <input type="number" min="0" value={actualCash}
                            onChange={e => setActualCash(e.target.value)}
                            placeholder="0"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-amber-500/50 transition-colors pr-16" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">{sym}</span>
                        </div>
                      </div>

                      {/* Calcul écart */}
                      {actualCash !== '' && (
                        <div className={`p-3 rounded-xl border ${
                          difference === 0 ? 'bg-emerald-500/8 border-emerald-500/20' :
                          difference > 0  ? 'bg-blue-500/8 border-blue-500/20' :
                                            'bg-red-500/8 border-red-500/20'
                        }`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-white/50 text-xs">Espèces attendues</span>
                            <span className="text-white/70 text-sm font-semibold">{fmt(expectedCash, sym)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              {difference === 0 ? <CheckCircle2 size={13} className="text-emerald-400" />
                                : difference > 0 ? <ArrowUpRight size={13} className="text-blue-400" />
                                : <ArrowDownRight size={13} className="text-red-400" />}
                              <span className="text-white/60 text-xs">Écart</span>
                            </div>
                            <span className={`text-sm font-bold ${
                              difference === 0 ? 'text-emerald-400' :
                              difference > 0  ? 'text-blue-400' : 'text-red-400'
                            }`}>
                              {difference >= 0 ? '+' : ''}{fmt(difference, sym)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      <div>
                        <label className="text-white/50 text-[11px] font-medium block mb-1.5">Notes (optionnel)</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)}
                          placeholder="Commentaires sur la clôture..."
                          rows={2}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white/80 placeholder-white/20 text-sm focus:outline-none focus:border-amber-500/50 resize-none transition-colors" />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => setStep('review')}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/8 text-white/60 hover:text-white/80 font-medium rounded-xl text-sm transition-colors">
                        Retour
                      </button>
                      <button onClick={() => setStep('confirm')} disabled={actualCash === ''}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-40">
                        Continuer <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* STEP DONE — Fermeture réussie */}
                {step === 'done' && closedSession && (
                  <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="py-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="text-white font-bold text-base mb-1">Caisse clôturée</h3>
                    <p className="text-white/40 text-xs mb-1">Session #{String(closedSession.session_number).padStart(4, '0')}</p>
                    <p className="text-emerald-400 font-black text-xl mb-4">{fmt(closedSession.total_sales, sym)}</p>
                    <div className="flex gap-2 mb-2">
                      <button onClick={handleReprint}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium rounded-xl text-sm transition-all border border-white/8 hover:border-white/15">
                        <Printer size={14} /> Réimprimer
                      </button>
                      <button onClick={onClose}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors">
                        Fermer
                      </button>
                    </div>
                    <p className="text-white/25 text-[10px]">Le X de caisse a été imprimé</p>
                  </motion.div>
                )}

                {/* STEP 3 — Confirmation finale */}
                {step === 'confirm' && (
                  <motion.div key="confirm" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <p className="text-white/60 text-xs mb-4">Récapitulatif de clôture</p>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Ventes réalisées</span>
                        <span className="text-white font-semibold">{summary.sales_count} vente{summary.sales_count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Chiffre d'affaires</span>
                        <span className="text-emerald-400 font-bold">{fmt(summary.total_sales, sym)}</span>
                      </div>
                      <div className="border-t border-white/8 my-2" />
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Fonds initial</span>
                        <span className="text-white/70">{fmt(opening, sym)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/50">Espèces comptées</span>
                        <span className="text-white/70">{fmt(actual, sym)}</span>
                      </div>
                      <div className={`flex justify-between text-sm font-bold ${
                        difference === 0 ? 'text-emerald-400' :
                        difference > 0 ? 'text-blue-400' : 'text-red-400'
                      }`}>
                        <span>Écart de caisse</span>
                        <span>{difference >= 0 ? '+' : ''}{fmt(difference, sym)}</span>
                      </div>
                    </div>

                    {difference !== 0 && (
                      <div className={`flex items-start gap-2 p-3 rounded-xl mb-4 ${
                        difference > 0 ? 'bg-blue-500/8 border border-blue-500/20' : 'bg-amber-500/8 border border-amber-500/25'
                      }`}>
                        <AlertTriangle size={14} className={difference > 0 ? 'text-blue-400 mt-0.5' : 'text-amber-400 mt-0.5'} />
                        <p className={`text-xs ${difference > 0 ? 'text-blue-300' : 'text-amber-300'}`}>
                          {difference > 0
                            ? 'Excédent de caisse détecté. Vérifiez vos enregistrements.'
                            : 'Manque en caisse détecté. Un rapport sera généré.'}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={() => setStep('count')}
                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/8 text-white/60 hover:text-white/80 font-medium rounded-xl text-sm transition-colors">
                        Retour
                      </button>
                      <motion.button onClick={handleClose} disabled={saving}
                        whileTap={{ scale: 0.97 }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
                        Fermer la caisse
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
