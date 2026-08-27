import { useEffect, useState, useCallback, useRef } from 'react';
import { Send, CheckCheck, ChefHat, GlassWater, Printer, Clock, Receipt, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { releaseWaitingJobs, buildBillPrintGroup, logPrintJobs } from '../../lib/printService';
import { useSettings } from '../../contexts/SettingsContext';
import { useFeedback } from '../../hooks/useFeedback';
import { showToast } from '../shared/Toast';

interface WaitingJob {
  id: string;
  order_id: string | null;
  table_id: string | null;
  type: string;
  content_summary: string;
  station: string;
  created_at: string;
  printer: { nom: string; type: string } | null;
  table: { nom: string; statut: string } | null;
  order: { ticket_number: string; total: number } | null;
  creator: { nom: string } | null;
}

interface OrderGroup {
  orderId: string | null;
  tableId: string | null;
  tableNom: string;
  tableStatut: string;
  ticketNumber: string;
  orderTotal: number;
  serveurNom: string;
  createdAt: string;
  jobs: WaitingJob[];
  byStation: { station: string; jobs: WaitingJob[] }[];
}

const stationLabel: Record<string, string> = {
  kitchen: 'Cuisine',
  bar: 'Bar',
  cashier: 'Caisse',
  other: 'Autre',
};

const stationIcon: Record<string, React.ElementType> = {
  kitchen: ChefHat,
  bar: GlassWater,
  cashier: Printer,
  other: Printer,
};

const stationColors: Record<string, { bg: string; text: string; border: string }> = {
  kitchen: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  bar: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  cashier: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  other: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

const typeColors: Record<string, { bg: string; text: string }> = {
  INITIAL: { bg: 'bg-blue-100', text: 'text-blue-700' },
  ADDONS: { bg: 'bg-amber-100', text: 'text-amber-700' },
};

function groupJobs(jobs: WaitingJob[]): OrderGroup[] {
  const groupMap = new Map<string, OrderGroup>();

  for (const job of jobs) {
    const key = job.order_id || job.table_id || 'unknown';
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        orderId: job.order_id,
        tableId: job.table_id,
        tableNom: job.table?.nom || 'Table inconnue',
        tableStatut: job.table?.statut || '',
        ticketNumber: job.order?.ticket_number || '',
        orderTotal: job.order?.total || 0,
        serveurNom: job.creator?.nom || '—',
        createdAt: job.created_at,
        jobs: [],
        byStation: [],
      });
    }
    groupMap.get(key)!.jobs.push(job);
  }

  for (const group of groupMap.values()) {
    const stationMap = new Map<string, WaitingJob[]>();
    for (const job of group.jobs) {
      const s = job.station || 'other';
      if (!stationMap.has(s)) stationMap.set(s, []);
      stationMap.get(s)!.push(job);
    }
    group.byStation = Array.from(stationMap.entries()).map(([station, jobs]) => ({ station, jobs }));
  }

  return Array.from(groupMap.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

export default function PendingOrdersView() {
  const [jobs, setJobs] = useState<WaitingJob[]>([]);
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [sendingAll, setSendingAll] = useState(false);
  const [printingBill, setPrintingBill] = useState<string | null>(null);
  const { settings } = useSettings();
  const { feedback } = useFeedback();
  const prevCountRef = useRef(0);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from('print_jobs')
      .select(`
        id, order_id, table_id, type, content_summary, station, created_at,
        printer:printers(nom, type),
        table:tables(nom, statut),
        order:orders(ticket_number, total),
        creator:users(nom)
      `)
      .eq('status', 'WAITING_CASHIER')
      .order('created_at', { ascending: true });

    const newJobs = (data || []) as unknown as WaitingJob[];

    if (newJobs.length > prevCountRef.current && prevCountRef.current >= 0) {
      feedback('print');
    }
    prevCountRef.current = newJobs.length;
    setJobs(newJobs);
  }, [feedback]);

  useEffect(() => {
    prevCountRef.current = -1;
    fetchJobs();

    let debounceTimer: ReturnType<typeof setTimeout>;
    const channel = supabase
      .channel('pending_orders_jobs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchJobs, 500);
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchJobs]);

  const groups = groupJobs(jobs);

  const dispatchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settings.autoDispatchCashier || jobs.length === 0) return;
    const newIds = jobs.map(j => j.id).filter(id => !dispatchedRef.current.has(id));
    if (newIds.length === 0) return;
    newIds.forEach(id => dispatchedRef.current.add(id));
    releaseWaitingJobs(newIds).catch(() => {});
  }, [jobs, settings.autoDispatchCashier]);

  useEffect(() => {
    dispatchedRef.current = new Set(jobs.map(j => j.id));
  }, []);

  const handleSendGroup = async (group: OrderGroup) => {
    const ids = group.jobs.map(j => j.id);
    setSending(prev => new Set([...prev, ...ids]));
    try {
      await releaseWaitingJobs(ids);
      showToast(`Commande ${group.tableNom} envoyée aux imprimantes`, 'success');
      feedback('print');
      await fetchJobs();
    } catch {
      showToast('Erreur lors de l\'envoi', 'error');
    } finally {
      setSending(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const handleSendAll = async () => {
    if (jobs.length === 0) return;
    setSendingAll(true);
    try {
      const ids = jobs.map(j => j.id);
      await releaseWaitingJobs(ids);
      showToast(`${groups.length} commande(s) envoyée(s) aux imprimantes`, 'success');
      feedback('print');
      await fetchJobs();
    } catch {
      showToast('Erreur lors de l\'envoi groupé', 'error');
    } finally {
      setSendingAll(false);
    }
  };

  const handlePrintBill = async (group: OrderGroup) => {
    if (!group.orderId) return;
    setPrintingBill(group.orderId);
    try {
      const sendIds = group.jobs.map(j => j.id);
      await releaseWaitingJobs(sendIds);

      const { group: billGroup, error } = await buildBillPrintGroup(group.orderId, group.tableNom);
      if (error || !billGroup) {
        showToast(error || 'Imprimante caisse introuvable', 'error');
      } else {
        await logPrintJobs([billGroup], {
          orderId: group.orderId,
          tableId: group.tableId,
          tableNom: group.tableNom,
          ticketNumber: group.ticketNumber,
          userId: '',
          type: 'BILL',
          total: group.orderTotal,
        });
        showToast(`Addition imprimée pour ${group.tableNom}`, 'success');
        feedback('print');
      }
      await fetchJobs();
    } catch {
      showToast('Erreur impression addition', 'error');
    } finally {
      setPrintingBill(null);
    }
  };

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCheck size={26} className="text-green-500" />
        </div>
        <p className="text-gray-700 font-semibold">Aucune commande en attente</p>
        <p className="text-gray-400 text-sm mt-1">Les nouvelles commandes des serveurs apparaîtront ici</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Commandes à envoyer</h1>
          <p className="text-xs text-gray-500 mt-0.5">{groups.length} commande(s) en attente d'envoi</p>
        </div>
        {groups.length > 1 && (
          <button
            onClick={handleSendAll}
            disabled={sendingAll}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
          >
            {sendingAll
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCheck size={16} />
            }
            Tout envoyer
          </button>
        )}
      </div>

      {groups.map(group => {
        const isGroupSending = group.jobs.some(j => sending.has(j.id));
        const isEncaisser = group.tableStatut === 'A_ENCAISSER';
        const hasAddons = group.jobs.some(j => j.type === 'ADDONS');
        const isBillPrinting = printingBill === group.orderId;

        return (
          <div
            key={group.orderId || group.tableId}
            className={`bg-white rounded-2xl overflow-hidden shadow-sm border-2 transition-all ${isEncaisser ? 'border-orange-400' : 'border-gray-100'}`}
          >
            {isEncaisser && (
              <div className="bg-orange-500 px-3 py-1 text-xs text-white font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Addition demandée
              </div>
            )}

            <div className="p-3">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-base">{group.tableNom}</p>
                    {group.ticketNumber && (
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{group.ticketNumber}</span>
                    )}
                    {hasAddons && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Ajouts</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-xs text-gray-500">{group.serveurNom}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={10} />
                      {new Date(group.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                {group.orderTotal > 0 && (
                  <div className="text-right ml-2">
                    <p className="text-lg font-bold text-gray-900 leading-none">{group.orderTotal.toLocaleString('fr-FR')}</p>
                    <p className="text-xs text-gray-400">FCFA</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-3">
                {group.byStation.map(({ station, jobs: stationJobs }) => {
                  const colors = stationColors[station] || stationColors.other;
                  const StIcon = stationIcon[station] || Printer;
                  return (
                    <div key={station} className={`${colors.bg} border ${colors.border} rounded-xl p-2.5`}>
                      <div className={`flex items-center gap-1.5 ${colors.text} font-bold text-xs mb-2`}>
                        <StIcon size={12} />
                        {stationLabel[station] || station}
                      </div>
                      <div className="space-y-1.5">
                        {stationJobs.map(job => {
                          const tc = typeColors[job.type] || typeColors.INITIAL;
                          return (
                            <div key={job.id} className="flex items-start gap-2">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-md flex-shrink-0 ${tc.bg} ${tc.text}`}>
                                {job.type === 'ADDONS' ? '+' : job.type === 'INITIAL' ? 'NEW' : job.type}
                              </span>
                              <p className="text-xs text-gray-700 leading-snug flex-1 min-w-0">{job.content_summary}</p>
                              {job.printer && (
                                <span className="text-xs text-gray-400 flex-shrink-0">{job.printer.nom}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                {isEncaisser && group.orderId && (
                  <button
                    onClick={() => handlePrintBill(group)}
                    disabled={isBillPrinting || isGroupSending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-orange-100 hover:bg-orange-200 disabled:opacity-50 text-orange-700 py-2.5 rounded-xl text-xs font-bold transition-all"
                  >
                    {isBillPrinting
                      ? <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                      : <Receipt size={13} />
                    }
                    Imprimer addition
                  </button>
                )}
                <button
                  onClick={() => handleSendGroup(group)}
                  disabled={isGroupSending || sendingAll}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95"
                >
                  {isGroupSending
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send size={13} />
                  }
                  Envoyer aux imprimantes
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <div className="pb-4 flex items-start gap-2 text-xs text-gray-400">
        <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
        Les tickets sont envoyés vers les imprimantes cuisine, bar, etc. selon la catégorie de chaque article.
      </div>
    </div>
  );
}
