import { PeriodFilter, PERIOD_OPTIONS } from '../../lib/dateFilter';

interface Props {
  value: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
  className?: string;
}

export default function PeriodFilterBar({ value, onChange, className = '' }: Props) {
  return (
    <div className={`flex gap-1 bg-gray-100 p-1 rounded-xl ${className}`}>
      {PERIOD_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            value === opt.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
