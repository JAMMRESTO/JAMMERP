import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  status: string;
  floor: number;
  notes: string;
  is_active: boolean;
}

interface TablePickerModalProps {
  selectedTable: string;
  onSelect: (tableName: string) => void;
  onClose: () => void;
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  available: { label: 'Libre',    color: 'border-emerald-500/30 bg-emerald-500/5',  dot: 'bg-emerald-400' },
  occupied:  { label: 'Occupée', color: 'border-red-500/30 bg-red-500/5',           dot: 'bg-red-400' },
  reserved:  { label: 'Réservée', color: 'border-amber-500/30 bg-amber-500/5',      dot: 'bg-amber-400' },
  cleaning:  { label: 'Nettoyage', color: 'border-blue-500/30 bg-blue-500/5',       dot: 'bg-blue-400' },
};

export function TablePickerModal({ selectedTable, onSelect, onClose }: TablePickerModalProps) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [floors, setFloors] = useState<number[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('restaurant_tables')
        .select('id, name, capacity, status, floor, notes, is_active')
        .eq('is_active', true)
        .order('floor')
        .order('name');
      if (data) {
        setTables(data as RestaurantTable[]);
        const uniqueFloors = [...new Set((data as RestaurantTable[]).map(t => t.floor))].sort();
        setFloors(uniqueFloors);
        setActiveFloor(uniqueFloors[0] ?? null);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = activeFloor !== null
    ? tables.filter(t => t.floor === activeFloor)
    : tables;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 className="text-white font-semibold text-base">Sélectionner une table</h2>
            <p className="text-white/40 text-xs mt-0.5">
              {tables.filter(t => t.status === 'available').length} table(s) disponible(s)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Floor tabs */}
        {floors.length > 1 && (
          <div className="flex gap-1 px-5 pt-3 pb-0">
            {floors.map(f => (
              <button
                key={f}
                onClick={() => setActiveFloor(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${activeFloor === f ? 'bg-blue-600 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                Étage {f === 0 ? 'RDC' : f}
              </button>
            ))}
          </div>
        )}

        {/* Tables grid */}
        <div className="p-5 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-sm">Aucune table disponible</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {filtered.map(table => {
                const cfg = statusConfig[table.status] ?? statusConfig.available;
                const isSelected = selectedTable === table.name;
                const isAvailable = table.status === 'available';
                return (
                  <motion.button
                    key={table.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      onSelect(table.name);
                      onClose();
                    }}
                    className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all
                      ${isSelected
                        ? 'bg-blue-600/20 border-blue-500/60 shadow-lg shadow-blue-500/10'
                        : isAvailable
                          ? `${cfg.color} hover:border-emerald-400/50 cursor-pointer`
                          : `${cfg.color} opacity-60 cursor-pointer`
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5">
                        <CheckCircle size={12} className="text-blue-400" />
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    </div>
                    <span className="text-white font-bold text-sm leading-none">{table.name}</span>
                    <div className="flex items-center gap-0.5 text-white/40">
                      <Users size={9} />
                      <span className="text-[10px]">{table.capacity}</span>
                    </div>
                    <span className={`text-[9px] font-medium ${isSelected ? 'text-blue-400' : 'text-white/30'}`}>
                      {isSelected ? 'Sélectionnée' : cfg.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear selection */}
        {selectedTable && (
          <div className="px-5 pb-4 border-t border-white/8 pt-3">
            <button
              onClick={() => { onSelect(''); onClose(); }}
              className="w-full py-2 rounded-xl text-white/40 hover:text-white/70 text-xs font-medium hover:bg-white/5 transition-all border border-white/8 hover:border-white/15"
            >
              Effacer la sélection
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
