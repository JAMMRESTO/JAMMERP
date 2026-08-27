import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Printer as PrinterIcon, CheckCircle, XCircle, Clock, RotateCcw, Filter, AlertTriangle, Radio } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PrintJob, PrintJobType, PrintJobStatus, PrintStation } from '../../lib/types';
import { retryPrintJob } from '../../services/printingHub';
import { dispatchJobImmediately } from '../../lib/printService';

const typeConfig: Record<PrintJobType, { label: string; color: string; bg: string }> = {
  INITIAL: { label: 'Commande', color: 'text-blue-700', bg: 'bg-blue-100' },
  ADDONS: { label: 'Ajouts', color: 'text-amber-700', bg: 'bg-amber-100' },
  BILL: { label: 'Addition', color: 'text-green-700', bg: 'bg-green-100' },
  RECEIPT: { label: 'Facture', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  TEST: { label: 'Test', color: 'text-gray-700', bg: 'bg-gray-100' },
  REPORT_X: { label: 'Rapport X', color: 'text-cyan-700', bg: 'bg-cyan-100' },
  REPORT_Z: { label: 'Cloture Z', color: 'text-rose-700', bg: 'bg-rose-100' },
};

const stationConfig: Record<PrintStation, { label: string; color: string }> = {
  kitchen: { label: 'Cuisine', color: 'text-orange-600' },
  bar: { label: 'Bar', color: 'text-blue-600' },
  cashier: { label: 'Caisse', color: 'text-green-600' },
  other: { label: 'Autre', color: 'text-gray-500' },
};

type StatusFilter = PrintJobStatus | 'ALL';
type TypeFilter = PrintJobType | 'ALL';

function StatusIcon({ status }: { status: PrintJobStatus }) {
  if (status === 'SUCCESS') return <CheckCircle size={16} className="text-green-500 flex-shrink-0" />;
  if (status === 'FAILED') return <XCircle size={16} className="text-red-500 flex-shrink-0" />;
  if (status === 'PRINTING') return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />;
  return <Clock size={16} className="text-amber-500 flex-shrink-0" />;
}

interface RelayStatus {
  online: boolean;
  lastSeen: string | null;
  printerName: string;
}

export default function PrintJobsManager() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [filterType, setFilterType] = useState<TypeFilter>('ALL');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [relayStatus, setRelayStatus] = useState<RelayStatus | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchJobs();
    fetchRelayStatus();
    const statusInterval = setInterval(fetchRelayStatus, 20_000);

    const channel = supabase
      .channel('print_jobs_manager')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'print_jobs' }, () => {
        if (debounce.current) clearTimeout(debounce.current);
        debounce.current = setTimeout(fetchJobs, 600);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'printers' }, () => {
        fetchRelayStatus();
      })
      .subscribe();

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      supabase.removeChannel(channel);
      clearInterval(statusInterval);
    };
  }, []);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('print_jobs')
      .select('*, printer:printers(nom, type), table:tables(nom), order:orders(ticket_number, total), created_by_user:users(nom)')
      .order('created_at', { ascending: false })
      .limit(300);
    setJobs((data || []) as PrintJob[]);
    setLoading(false);
  };

  const fetchRelayStatus = async () => {
    const { data } = await supabase
      .from('printers')
      .select('nom, relay_last_seen, connection_type, active')
      .eq('connection_type', 'NETWORK')
      .eq('active', true)
      .order('relay_last_seen', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!data) { setRelayStatus(null); return; }
    const lastSeen = (data as { relay_last_seen: string | null; nom: string }).relay_last_seen;
    const age = lastSeen ? Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000) : null;
    setRelayStatus({
      online: age !== null && age < 90,
      lastSeen,
      printerName: data.nom,
    });
  };

  const handleRetry = async (job: PrintJob) => {
    setRetrying(job.id);
    await retryPrintJob(job.id);
    const { data: fresh } = await supabase
      .from('print_jobs')
      .select('*, printer:printers(*)')
      .eq('id', job.id)
      .maybeSingle();
    const printer = (fresh as any)?.printer;
    if (printer && fresh?.payload_text) {
      dispatchJobImmediately(job.id, printer, fresh.payload_text);
    }
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'PRINTING', last_error: null } : j));
    setRetrying(null);
  };

  const filtered = jobs.filter(j => {
    const matchStatus = filterStatus === 'ALL' || j.status === filterStatus;
    const matchType = filterType === 'ALL' || j.type === filterType;
    return matchStatus && matchType;
  });

  const pendingCount = jobs.filter(j => j.status === 'PENDING').length;
  const printingCount = jobs.filter(j => j.status === 'PRINTING').length;
  const failedCount = jobs.filter(j => j.status === 'FAILED').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">File d'impression</h2>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <p className="text-sm text-gray-500">{jobs.length} job(s)</p>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <Clock size={11} /> {pendingCount} en attente
              </span>
            )}
            {printingCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                <PrinterIcon size={11} /> {printingCount} en cours
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                <AlertTriangle size={11} /> {failedCount} échec(s)
              </span>
            )}
          </div>
        </div>
        <button onClick={fetchJobs} className="w-9 h-9 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition-all">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Relay status strip */}
      {relayStatus !== null && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          relayStatus.online
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <Radio size={15} className={relayStatus.online ? 'text-green-600 animate-pulse' : 'text-amber-500'} />
          {relayStatus.online
            ? `Relais actif — ${relayStatus.printerName} reçoit les bons de commande automatiquement`
            : `Relais hors ligne — les bons cuisine ne seront pas imprimés tant que l'ordinateur du restaurant n'est pas démarré`
          }
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          <Filter size={14} className="text-gray-400 ml-2" />
          {(['ALL', 'INITIAL', 'ADDONS', 'BILL', 'TEST'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterType === t ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {t === 'ALL' ? 'Tous types' : typeConfig[t as PrintJobType].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
          {(['ALL', 'PENDING', 'PRINTING', 'SUCCESS', 'FAILED'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterStatus === s ? 'bg-amber-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {s === 'ALL' ? 'Tous' : s === 'PENDING' ? 'En attente' : s === 'PRINTING' ? 'En cours' : s === 'SUCCESS' ? 'Réussis' : 'Échoués'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <PrinterIcon size={40} className="mx-auto mb-3 text-gray-300" />
          <p>Aucune impression correspondante</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtered.map(job => {
              const typeCfg = typeConfig[job.type] || typeConfig.TEST;
              const stationCfg = job.station ? stationConfig[job.station] : null;
              return (
                <div key={job.id} className={`flex items-start gap-3 px-4 py-3 ${job.status === 'PENDING' ? 'bg-amber-50/40' : job.status === 'PRINTING' ? 'bg-blue-50/30' : ''}`}>
                  <div className="pt-0.5">
                    <StatusIcon status={job.status} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${typeCfg.bg} ${typeCfg.color}`}>{typeCfg.label}</span>
                      {stationCfg && (
                        <span className={`text-xs font-semibold ${stationCfg.color}`}>{stationCfg.label}</span>
                      )}
                      <span className="text-sm font-medium text-gray-800">{(job as any).table?.nom || '—'}</span>
                      {(job as any).order?.ticket_number && (
                        <span className="text-xs text-gray-400 font-mono">{(job as any).order?.ticket_number}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{job.content_summary}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{(job as any).printer?.nom || 'Imprimante inconnue'}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(job.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {job.printed_at && (
                        <span className="text-xs text-green-600">
                          Imprimé: {new Date(job.printed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {job.retries > 0 && (
                        <span className="text-xs text-orange-500 font-medium">{job.retries} tentative(s)</span>
                      )}
                      {(job as any).created_by_user?.nom && (
                        <span className="text-xs text-gray-400">{(job as any).created_by_user.nom}</span>
                      )}
                    </div>
                    {job.last_error && (
                      <p className="text-xs text-red-500 mt-1 bg-red-50 px-2 py-1 rounded-lg">
                        {job.last_error}
                      </p>
                    )}
                  </div>
                  {(job.status === 'FAILED' || job.status === 'PENDING') && (
                    <button
                      onClick={() => handleRetry(job)}
                      disabled={retrying === job.id}
                      className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 ${
                        job.status === 'FAILED'
                          ? 'bg-red-50 hover:bg-red-100 text-red-700'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-700'
                      }`}
                      title="Remettre en attente"
                    >
                      {retrying === job.id
                        ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        : <RotateCcw size={12} />
                      }
                      {job.status === 'FAILED' ? 'Réessayer' : 'Forcer'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
