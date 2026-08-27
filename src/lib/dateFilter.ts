export type PeriodFilter = 'jour' | 'semaine' | 'mois' | 'annee';

export interface DateRange {
  start: string;
  end: string;
  label: string;
}

export function getDateRange(period: PeriodFilter): DateRange {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (period) {
    case 'jour': {
      const today = fmt(now);
      return { start: today, end: today, label: "Aujourd'hui" };
    }
    case 'semaine': {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: fmt(monday), end: fmt(sunday), label: 'Cette semaine' };
    }
    case 'mois': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start: fmt(first), end: fmt(last), label: 'Ce mois' };
    }
    case 'annee': {
      const first = new Date(now.getFullYear(), 0, 1);
      const last = new Date(now.getFullYear(), 11, 31);
      return { start: fmt(first), end: fmt(last), label: 'Cette année' };
    }
  }
}

export const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'jour', label: 'Jour' },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'annee', label: 'Année' },
];
