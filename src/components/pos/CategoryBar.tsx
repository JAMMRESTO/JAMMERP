import { useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Salad, Utensils, Flame, Fish, GlassWater, Cake,
  Sandwich, Coffee, Grid3X3, type LucideIcon
} from 'lucide-react';
import type { Category } from '../../types/database';

const iconMap: Record<string, LucideIcon> = {
  salad: Salad,
  utensils: Utensils,
  flame: Flame,
  fish: Fish,
  'glass-water': GlassWater,
  cake: Cake,
  sandwich: Sandwich,
  coffee: Coffee,
};

interface CategoryBarProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CategoryBar({ categories, selectedId, onSelect }: CategoryBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0.5 sm:pb-1 scrollbar-thin flex-shrink-0"
      style={{ scrollbarWidth: 'none' }}
    >
      {/* All */}
      <motion.button
        onClick={() => onSelect(null)}
        whileTap={{ scale: 0.95 }}
        className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium transition-all
          ${selectedId === null
            ? 'text-white shadow-lg'
            : 'bg-white/5 border-white/10 text-white/60 hover:text-white/90 hover:bg-white/10'
          }`}
        style={selectedId === null ? {
          backgroundColor: 'var(--color-primary)',
          borderColor: 'var(--color-primary)',
          boxShadow: '0 4px 14px color-mix(in srgb, var(--color-primary) 25%, transparent)',
        } : undefined}
      >
        <Grid3X3 size={14} className="sm:hidden" />
        <Grid3X3 size={15} className="hidden sm:block" />
        <span>Tout</span>
      </motion.button>

      {categories.map(cat => {
        const Icon = iconMap[cat.icon] ?? Utensils;
        const active = selectedId === cat.id;
        return (
          <motion.button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            whileTap={{ scale: 0.95 }}
            className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium transition-all
              ${active
                ? 'text-white shadow-lg border-opacity-60'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white/90 hover:bg-white/10'
              }`}
            style={active ? {
              backgroundColor: cat.color + '25',
              borderColor: cat.color + '60',
              color: cat.color,
              boxShadow: `0 4px 14px ${cat.color}25`,
            } : {}}
          >
            <Icon size={14} className="sm:hidden" />
            <Icon size={15} className="hidden sm:block" />
            <span>{cat.name}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
