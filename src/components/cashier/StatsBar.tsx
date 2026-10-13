import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Receipt, BarChart2, Package, Printer, UtensilsCrossed } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { loadBusinessHours } from '../../lib/businessDay';

interface Stats {
  totalJour: number;
  nbTickets: number;
  moyenneTicket: number;
  articlesVendus: number;
  ticketsBar: number;
  ticketsCuisine: number;
}

export default function StatsBar() {
  const [stats, setStats] = useState<Stats>({ totalJour: 0, nbTickets: 0, moyenneTicket: 0, articlesVendus: 0, ticketsBar: 0, ticketsCuisine: 0 });

  const fetchStats = useCallback(async () => {
    await loadBusinessHours();

    // Last Z closure (last 48h to be safe)
    const since48h = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: lastZClosure } = await supabase
      .from('cash_closures')
      .select('created_at')
      .eq('type', 'Z')
      .gte('created_at', since48h)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no Z closure today, use start of current UTC day as fallback
    const utcDayStart = new Date();
    utcDayStart.setUTCHours(0, 0, 0, 0);
    const periodStart = lastZClosure ? lastZClosure.created_at : utcDayStart.toISOString();
    const periodEnd = new Date().toISOString();

    const [ordersRes, printJobsRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, total, items:order_items(qty)')
        .in('statut', ['PAYEE', 'CLOTUREE'])
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd),
      supabase
        .from('print_jobs')
        .select('id, printer:printers(type)')
        .eq('status', 'SUCCESS')
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd),
    ]);

    const orders = ordersRes.data || [];
    const nbTickets = orders.length;
    const totalJour = orders.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const moyenneTicket = nbTickets > 0 ? Math.round(totalJour / nbTickets) : 0;
    const articlesVendus = orders.reduce((s: number, o: any) => s + (o.items || []).reduce((ss: number, i: any) => ss + (i.qty || 0), 0), 0);

    const printJobs = printJobsRes.data || [];
    const ticketsBar = printJobs.filter((j: any) => j.printer?.type === 'BAR').length;
    const ticketsCuisine = printJobs.filter((j: any) => j.printer?.type === 'CUISINE').length;

    setStats({ totalJour, nbTickets, moyenneTicket, articlesVendus, ticketsBar, ticketsCuisine });
  }, []);

  useEffect(() => {
    fetchStats();
    const channel = supabase
      .channel('statsbar_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchStats)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchStats]);

  const items = [
    { label: 'Total jour', value: `${stats.totalJour.toLocaleString('fr-FR')} F`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
    { label: 'Tickets', value: stats.nbTickets, icon: Receipt, color: 'text-blue-600 bg-blue-50' },
    { label: 'Moyenne', value: `${stats.moyenneTicket.toLocaleString('fr-FR')} F`, icon: BarChart2, color: 'text-amber-600 bg-amber-50' },
    { label: 'Articles', value: stats.articlesVendus, icon: Package, color: 'text-gray-600 bg-gray-100' },
    { label: 'Bar', value: stats.ticketsBar, icon: Printer, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Cuisine', value: stats.ticketsCuisine, icon: UtensilsCrossed, color: 'text-orange-600 bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 px-4 py-3 bg-white border-b border-gray-100">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex flex-col items-center gap-1 py-1">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.color}`}>
              <Icon size={14} />
            </div>
            <p className="font-bold text-gray-900 text-sm leading-none tabular-nums">{item.value}</p>
            <p className="text-xs text-gray-400">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}
