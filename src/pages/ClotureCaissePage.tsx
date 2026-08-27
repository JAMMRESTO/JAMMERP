import { useState, useEffect } from 'react';
import { Lock, AlertTriangle, ArrowDownCircle, ArrowUpCircle, DollarSign, FileText, ChevronDown, ChevronUp, Printer, Banknote, Pencil, Check, X } from 'lucide-react';
import { supabase, getSessionToken } from '../lib/supabase';
import type { Caisse, ClotureCaisse } from '../types/database';

interface CaisseStats {
  fond_de_caisse: number;
  total_encaissements: number;
  total_decaissements: number;
  solde: number;
  nb_encaissements: number;
  nb_decaissements: number;
}

interface Props {
  caisseActive: Caisse | null;
  caisses: Caisse[];
  userRole: string;
}

export default function ClotureCaissePage({ caisseActive, caisses, userRole }: Props) {
  const [stats, setStats] = useState<CaisseStats | null>(null);
  const [clotures, setClotures] = useState<(ClotureCaisse & { caisse?: { nom: string }; profile?: { nom: string } })[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fond de caisse editing
  const [editingFond, setEditingFond] = useState(false);
  const [fondText, setFondText] = useState('');
  const [fondLoading, setFondLoading] = useState(false);
  const [fondResult, setFondResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isCaissier = userRole === 'caissier';

  const loadStats = async () => {
    if (!caisseActive) return;

    const [encRes, decRes, caisseRes] = await Promise.all([
      supabase.from('encaissements').select('montant').eq('caisse_id', caisseActive.id).eq('archived', false),
      supabase.from('decaissements').select('montant').eq('caisse_id', caisseActive.id).eq('archived', false),
      supabase.from('caisses').select('fond_de_caisse').eq('id', caisseActive.id).maybeSingle(),
    ]);

    const fond = Number(caisseRes.data?.fond_de_caisse ?? 0);
    const encs = encRes.data ?? [];
    const decs = decRes.data ?? [];
    const totalEnc = encs.reduce((s, r) => s + Number(r.montant), 0);
    const totalDec = decs.reduce((s, r) => s + Number(r.montant), 0);
    setStats({
      fond_de_caisse: fond,
      total_encaissements: totalEnc,
      total_decaissements: totalDec,
      solde: fond + totalEnc - totalDec,
      nb_encaissements: encs.length,
      nb_decaissements: decs.length,
    });
  };

  const loadClotures = async () => {
    let query = supabase
      .from('clotures_caisses')
      .select('*, caisse:caisses(nom), profile:profiles!clotures_caisses_created_by_fkey(nom)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (isCaissier) {
      query = query.eq('caisse_id', caisseActive?.id ?? '');
    }

    const { data } = await query;
    setClotures((data as unknown as typeof clotures) ?? []);
  };

  useEffect(() => { loadStats(); loadClotures(); }, [caisseActive?.id]);

  const handleSetFond = async () => {
    if (!caisseActive) return;
    const montant = Number(fondText.replace(/\s/g, ''));
    if (isNaN(montant) || montant < 0) return;
    setFondLoading(true);
    setFondResult(null);
    try {
      const token = getSessionToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin/set-fond-caisse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ token, caisse_id: caisseActive.id, montant }),
      });
      const data = await res.json();
      if (data?.error) {
        setFondResult({ ok: false, message: data.error });
        return;
      }
      setFondResult({ ok: true, message: 'Fond de caisse mis a jour.' });
      setEditingFond(false);
      setFondText('');
      loadStats();
    } catch (err) {
      setFondResult({ ok: false, message: String(err) });
    } finally {
      setFondLoading(false);
    }
  };

  const handleCloturer = async () => {
    if (!caisseActive || !stats) return;
    const montantSaisi = Number(confirmText.replace(/\s/g, ''));
    if (isNaN(montantSaisi) || montantSaisi !== stats.solde) return;
    setLoading(true);
    setResult(null);

    try {
      const token = getSessionToken();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-pin/cloturer-caisse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ token, caisse_id: caisseActive.id }),
      });
      const data = await res.json();

      if (data?.error) {
        setResult({ ok: false, message: data.error });
        return;
      }

      setResult({ ok: true, message: `Caisse "${caisseActive.nom}" cloturee avec succes. Les transactions ont ete archivees et le fond de caisse remis a zero.` });
      setConfirming(false);
      setConfirmText('');
      loadStats();
      loadClotures();
    } catch (err) {
      setResult({ ok: false, message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  const totalTransactions = stats ? stats.nb_encaissements + stats.nb_decaissements : 0;
  const hasNoTransactions = totalTransactions === 0;
  const canCloturer = !hasNoTransactions || (stats?.fond_de_caisse ?? 0) > 0;
  const needsFond = hasNoTransactions && (stats?.fond_de_caisse ?? 0) === 0;

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const formatMoney = (n: number) =>
    new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  const handlePrint = (cl: ClotureCaisse & { caisse?: { nom: string }; profile?: { nom: string } }) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const fond = Number(cl.fond_de_caisse ?? 0);
    w.document.write(`<!DOCTYPE html><html><head><title>Cloture ${cl.caisse?.nom ?? ''}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:40px;color:#222}
      h1{font-size:18px;border-bottom:2px solid #000;padding-bottom:8px}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{border:1px solid #ccc;padding:8px 12px;text-align:left;font-size:14px}
      th{background:#f5f5f5;font-weight:bold}
      .right{text-align:right}
      .total{font-weight:bold;font-size:15px}
      .footer{margin-top:24px;font-size:12px;color:#888}
    </style></head><body>
    <h1>Cloture de caisse : ${cl.caisse?.nom ?? ''}</h1>
    <p>Periode du ${formatDate(cl.date_debut)} au ${formatDate(cl.date_fin)}</p>
    <p>Cloturee par : ${cl.profile?.nom ?? 'N/A'} le ${new Date(cl.created_at).toLocaleString('fr-FR')}</p>
    <table>
      <tr><th></th><th class="right">Montant</th><th class="right">Nombre</th></tr>
      ${fond > 0 ? `<tr><td>Fond de caisse (ouverture)</td><td class="right">${formatMoney(fond)}</td><td class="right">—</td></tr>` : ''}
      <tr><td>Total encaissements</td><td class="right">${formatMoney(cl.total_encaissements)}</td><td class="right">${cl.nb_encaissements}</td></tr>
      <tr><td>Total decaissements</td><td class="right">${formatMoney(cl.total_decaissements)}</td><td class="right">${cl.nb_decaissements}</td></tr>
      <tr class="total"><td>Solde final</td><td class="right">${formatMoney(cl.solde)}</td><td></td></tr>
    </table>
    <p class="footer">Document genere automatiquement</p>
    </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="h-[calc(100vh-56px)] bg-gray-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0">
            <Lock size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-gray-900">Cloture de caisse</h1>
            {caisseActive && (
              <p className="text-sm text-gray-500">{caisseActive.nom}</p>
            )}
          </div>
        </div>

        {/* Fond de caisse card */}
        {caisseActive && stats !== null && (
          <div className={`rounded-3xl border shadow-sm p-5 ${needsFond && !editingFond ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Banknote size={18} className={needsFond && !editingFond ? 'text-amber-500' : 'text-gray-400'} />
                <h3 className="font-bold text-gray-900">Fond de caisse</h3>
              </div>
              {!editingFond && (
                <button
                  onClick={() => { setEditingFond(true); setFondText(stats.fond_de_caisse > 0 ? String(stats.fond_de_caisse) : ''); setFondResult(null); }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition"
                >
                  <Pencil size={12} />
                  {stats.fond_de_caisse > 0 ? 'Modifier' : 'Saisir'}
                </button>
              )}
            </div>

            {needsFond && !editingFond && (
              <p className="text-xs text-amber-700 mb-3">
                Saisissez le montant d'ouverture de caisse avant de commencer les operations ou d'effectuer une cloture.
              </p>
            )}

            {!editingFond ? (
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-2xl font-black tabular-nums ${stats.fond_de_caisse > 0 ? 'text-slate-800' : 'text-gray-300'}`}>
                  {stats.fond_de_caisse > 0 ? formatMoney(stats.fond_de_caisse) : '—'}
                </span>
                {stats.fond_de_caisse > 0 && <span className="text-sm font-medium text-gray-400">FCFA</span>}
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    value={fondText}
                    onChange={e => setFondText(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="Montant en FCFA"
                    inputMode="numeric"
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-500"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSetFond(); if (e.key === 'Escape') { setEditingFond(false); setFondText(''); } }}
                  />
                  <button
                    onClick={handleSetFond}
                    disabled={!fondText || fondLoading}
                    className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-gray-200 text-white rounded-xl transition"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => { setEditingFond(false); setFondText(''); setFondResult(null); }}
                    disabled={fondLoading}
                    className="px-3 py-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
                  >
                    <X size={16} />
                  </button>
                </div>
                {fondResult && (
                  <p className={`text-xs ${fondResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>{fondResult.message}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Current stats */}
        {stats && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-3">
              {isCaissier ? 'Mes operations en cours' : 'Situation actuelle'}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                <ArrowDownCircle size={20} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-xl font-black text-emerald-700">{formatMoney(stats.total_encaissements)}</p>
                <p className="text-xs font-medium text-emerald-600 mt-0.5">Encaissements</p>
                <p className="text-[10px] text-emerald-400">{stats.nb_encaissements} operation{stats.nb_encaissements > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-orange-50 rounded-2xl p-4 text-center">
                <ArrowUpCircle size={20} className="text-orange-500 mx-auto mb-1" />
                <p className="text-xl font-black text-orange-700">{formatMoney(stats.total_decaissements)}</p>
                <p className="text-xs font-medium text-orange-600 mt-0.5">Decaissements</p>
                <p className="text-[10px] text-orange-400">{stats.nb_decaissements} operation{stats.nb_decaissements > 1 ? 's' : ''}</p>
              </div>
              <div className="bg-sky-50 rounded-2xl p-4 text-center">
                <DollarSign size={20} className="text-sky-500 mx-auto mb-1" />
                <p className="text-xl font-black text-sky-700">{formatMoney(stats.solde)}</p>
                <p className="text-xs font-medium text-sky-600 mt-0.5">Solde final</p>
                <p className="text-[10px] text-sky-400">{totalTransactions} operation{totalTransactions > 1 ? 's' : ''}</p>
              </div>
            </div>
            {stats.fond_de_caisse > 0 && (
              <p className="text-[11px] text-gray-400 text-center mt-3">
                Solde = Fond ({formatMoney(stats.fond_de_caisse)}) + Enc. ({formatMoney(stats.total_encaissements)}) − Dec. ({formatMoney(stats.total_decaissements)})
              </p>
            )}
          </div>
        )}

        {/* Cloture action */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">
              {isCaissier ? 'Cloturer ma journee' : 'Effectuer une cloture'}
            </h3>
          </div>

          <div className="p-5">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Action irreversible</p>
                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                  La cloture archive les totaux de la periode puis supprime toutes les transactions et remet le fond de caisse a zero.
                </p>
              </div>
            </div>

            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                disabled={!canCloturer || !caisseActive}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
              >
                <Lock size={16} />
                {needsFond
                  ? 'Saisir le fond de caisse pour continuer'
                  : hasNoTransactions
                  ? 'Cloturer (fond de caisse uniquement)'
                  : isCaissier ? 'Cloturer ma caisse' : 'Cloturer cette caisse'}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <p className="text-xs text-red-700 leading-relaxed">
                    Vous allez cloturer <strong>{caisseActive?.nom}</strong>.
                    {stats && stats.fond_de_caisse > 0 && <> Fond d'ouverture : <strong>{formatMoney(stats.fond_de_caisse)}</strong>.</>}
                    {' '}Cela supprimera <strong>{stats?.nb_encaissements ?? 0} encaissements</strong> et <strong>{stats?.nb_decaissements ?? 0} decaissements</strong>.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                    Saisissez le <span className="font-semibold text-slate-800">solde final</span> pour confirmer
                    {stats && stats.fond_de_caisse > 0 && (
                      <span className="font-normal text-gray-400 ml-1">(fond + enc. − dec.)</span>
                    )}
                  </label>
                  <input
                    value={confirmText}
                    onChange={e => { const v = e.target.value.replace(/[^\d]/g, ''); setConfirmText(v); }}
                    placeholder={`${formatMoney(stats?.solde ?? 0)}`}
                    inputMode="numeric"
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-slate-500"
                    autoFocus
                  />
                  {confirmText && Number(confirmText) !== (stats?.solde ?? 0) && (
                    <p className="text-xs text-red-500 mt-1.5 text-center">Le montant ne correspond pas au solde final</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCloturer}
                    disabled={Number(confirmText.replace(/\s/g, '')) !== (stats?.solde ?? 0) || loading || !confirmText}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-200 disabled:text-red-300 text-white font-bold py-3 rounded-xl transition active:scale-[0.98] text-sm"
                  >
                    <Lock size={16} />
                    {loading ? 'Cloture en cours...' : 'Confirmer la cloture'}
                  </button>
                  <button
                    onClick={() => { setConfirming(false); setConfirmText(''); }}
                    disabled={loading}
                    className="px-5 py-3 text-gray-500 hover:text-gray-700 font-medium rounded-xl hover:bg-gray-100 transition text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {result && (
              <div className={`mt-4 text-sm rounded-xl px-4 py-3 ${
                result.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {result.message}
              </div>
            )}
          </div>
        </div>

        {/* Historique des clotures */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              {isCaissier ? 'Mes clotures' : 'Historique des clotures'}
            </h3>
          </div>

          {clotures.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <FileText size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucune cloture enregistree</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {clotures.map(cl => {
                const expanded = expandedId === cl.id;
                const fond = Number(cl.fond_de_caisse ?? 0);
                return (
                  <div key={cl.id} className="px-5 py-3">
                    <button
                      onClick={() => setExpandedId(expanded ? null : cl.id)}
                      className="w-full flex items-center justify-between text-left"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{cl.caisse?.nom ?? 'Caisse'}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            {formatDate(cl.date_debut)} - {formatDate(cl.date_fin)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Par {cl.profile?.nom ?? 'N/A'} le {new Date(cl.created_at).toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${cl.solde >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatMoney(cl.solde)}
                        </span>
                        <button
                          onClick={e => { e.stopPropagation(); handlePrint(cl); }}
                          className="p-1.5 text-gray-300 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
                        >
                          <Printer size={14} />
                        </button>
                        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-3 bg-gray-50 rounded-2xl p-4 space-y-2">
                        {fond > 0 && (
                          <div className="bg-slate-100 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Banknote size={14} className="text-slate-500" />
                              <p className="text-xs text-slate-600 font-medium">Fond d'ouverture</p>
                            </div>
                            <p className="text-sm font-black text-slate-700">{formatMoney(fond)}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-emerald-50 rounded-xl p-3">
                            <p className="text-xs text-emerald-600 font-medium">Encaissements</p>
                            <p className="text-lg font-black text-emerald-700">{formatMoney(cl.total_encaissements)}</p>
                            <p className="text-[10px] text-emerald-400">{cl.nb_encaissements} operation{cl.nb_encaissements > 1 ? 's' : ''}</p>
                          </div>
                          <div className="bg-orange-50 rounded-xl p-3">
                            <p className="text-xs text-orange-600 font-medium">Decaissements</p>
                            <p className="text-lg font-black text-orange-700">{formatMoney(cl.total_decaissements)}</p>
                            <p className="text-[10px] text-orange-400">{cl.nb_decaissements} operation{cl.nb_decaissements > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="bg-sky-50 rounded-xl p-3 flex items-center justify-between">
                          <span className="text-xs text-sky-600 font-medium">Solde final</span>
                          <span className={`text-lg font-black ${cl.solde >= 0 ? 'text-sky-700' : 'text-red-600'}`}>
                            {formatMoney(cl.solde)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
